/**
 * turn.js - Turn Lifecycle, Movement Animations & AI Scheduling
 *
 * Coordinates roll completion, sequential square-by-square piece movement,
 * capture animation sequencing, turn advancement, and automated computer play.
 */
"use strict";

      function finishRoll(d) {
        const player = active();
        game.pool.push(d.value);
        game.history.push(d.value);
        rolling = false;
        const bonusResult = bonusDecision(d.value),
          { specialRoll, bonus } = bonusResult;
        game.last = { ...d, ...bonusResult };
        if (!bonus) game.phase = "move";
        const legalMoveCount = game.phase === "move" ? options().length : null;
        recordAudit("ROLL", {
          firstFace: d.a,
          secondFace: d.b,
          value: d.value,
          specialRoll,
          bonus,
          bonusDepth: bonusResult.bonusDepth,
          bonusChance: bonusResult.bonusChance,
          bonusDraw: bonusResult.bonusDraw,
          rollNumberInTurn: game.history.length,
          legalMoveCount,
          pacingAssist: Boolean(d.pacingAssist),
        });
        if (!bonus) {
          if (!legalMoveCount) {
            game.pool = [];
            speakGame(
              player.name +
                " rolled " +
                d.value +
                " but has no legal move. The turn passes.",
            );
            recordAudit("PASS", { reason: "NO_LEGAL_MOVE" });
            nextTurn("No legal moves — turn passed.");
            return;
          }
        }
        speakGame(
          player.name +
            " rolled " +
            d.value +
            "." +
            (d.pacingAssist
              ? " The pacing assist selected a playable outcome."
              : "") +
            (bonus
              ? " That earns another roll."
              : specialRoll
                ? " Its reduced bonus chance did not extend this turn, so now choose a legal move."
                : " Now choose a legal move."),
        );
        if (multiplayer.active && multiplayer.isHost) {
          broadcastState();
        }
        render();
      }
      function roll() {
        if (!game || game.phase !== "roll" || rolling || demo) return;
        if (multiplayer.active && !multiplayer.isHost) {
          if (game.current === multiplayer.mySeat) {
            sendPlayerAction({ type: "ROLL" });
          }
          return;
        }
        const d = pacingAssistRoll() || rollDice();
        rolling = true;
        setDieFace("dieA", d.a, "First die rolling");
        setDieFace("dieB", d.b, "Second die rolling");
        $("actionBtn").textContent = "Rolling…";
        $("actionBtn").disabled = true;
        triggerDiceAnimation();
        rollTimer = setTimeout(() => {
          rollTimer = null;
          finishRoll(d);
        }, 1220);
      }

      function nextTurn(message = "") {
        if (!game) return;
        recordAudit("TURN_END", { message: message || null });
        game.pool = [];
        game.history = [];
        game.phase = "roll";
        selectedRoll = 0;
        if (game.players.every((p) => p.rank !== null)) {
          game.phase = "done";
          if (multiplayer.active && multiplayer.isHost) broadcastState();
          render();
          return;
        }
        let i = game.current;
        do {
          i = (i + 1) % game.players.length;
        } while (game.players[i].rank !== null && i !== game.current);
        game.current = i;
        game.turn++;
        game.message = message;
        if (multiplayer.active && multiplayer.isHost) broadcastState();
        render();
      }
      function waitForMoveStep() {
        return new Promise((resolve) =>
          setTimeout(
            resolve,
            superSpeed
              ? Math.max(MIN_SUPER_MOVE_DELAY, scaledDemoDelay(MOVE_STEP_DELAY))
              : scaledDemoDelay(MOVE_STEP_DELAY),
          ),
        );
      }
      function waitForCaptureAnimation() {
        return new Promise((resolve) =>
          setTimeout(resolve, scaledDemoDelay(750)),
        );
      }
      async function animatePiece(player, piece, targetProgress) {
        // Update progress one square at a time so the avatar visibly traces the
        // route. The final game state (including captures) is committed by apply.
        const totalSteps =
            piece.progress < 0
              ? targetProgress + 1
              : targetProgress - piece.progress,
          playerName = player.name;
        let completed = 0;
        if (piece.progress < 0) {
          piece.progress = 0;
          completed++;
          render();
          $("statusTitle").textContent = playerName + " is moving";
          $("statusText").textContent =
            "Entering the board · step " + completed + " of " + totalSteps;
          await waitForMoveStep();
        }
        while (piece.progress < targetProgress) {
          piece.progress++;
          completed++;
          render();
          $("statusTitle").textContent = playerName + " is moving";
          $("statusText").textContent =
            "Following the route · step " + completed + " of " + totalSteps;
          await waitForMoveStep();
        }
      }
      async function animateScriptedPiece(player, piece, targetProgress) {
        moving = true;
        movingPieceId = piece.id;
        render();
        await animatePiece(player, piece, targetProgress);
        moving = false;
        movingPieceId = null;
      }
      async function apply(opt, inputSource = "board") {
        if (!opt || game.phase !== "move" || moving) return;
        if (multiplayer.active && !multiplayer.isHost) {
          if (game.current === multiplayer.mySeat) {
            sendPlayerAction({ type: "MOVE", pieceId: opt.piece.id, targetProgress: opt.test.progress });
          }
          return;
        }
        const player = active(),
          piece = opt.piece,
          wasReserve = piece.progress < 0,
          captureCount = opt.test.targets.length,
          willFinish = opt.test.progress === 43,
          fromProgress = piece.progress,
          fromSquare = node(player, piece),
          legalMoveCount = options().length,
          capturedPieces = opt.test.targets.map((hit) => ({
            playerId: hit.other.id,
            playerName: hit.other.name,
            pieceId: hit.q.id,
            pieceNumber: hit.other.pieces.indexOf(hit.q) + 1,
          }));
        let commentary =
          player.name +
          (wasReserve
            ? opt.test.openingEntry
              ? " uses the opening entry allowance to enter a piece and"
              : " enters a piece and"
            : " moves a piece") +
          " uses " +
          opt.values.join(" plus ") +
          ".";
        if (captureCount)
          commentary += " An opponent is captured and returns to reserve.";
        if (willFinish) commentary += " The piece reaches the center.";
        moving = true;
        movingPieceId = piece.id;
        speakGame(commentary);
        await animatePiece(player, piece, opt.test.progress);
        if (
          wasReserve &&
          game.turn <= game.players.length &&
          !game.openingEntryPlayers.includes(player.id)
        )
          game.openingEntryPlayers.push(player.id);
        player.captured = opt.test.captured;
        if (captureCount) {
          capturedPieceIds = opt.test.targets.map((hit) => hit.q.id);
          capturedPlayerIds = opt.test.targets.map((hit) => hit.other.id);
          render();
          const capturedLabels = capturedPieces
            .map((hit) => hit.playerName + "’s piece #" + hit.pieceNumber)
            .join(" and ");
          $("statusTitle").textContent = "Capture!";
          $("statusText").textContent =
            player.name +
            " sends " +
            capturedLabels +
            " from the board back to the family table.";
          await waitForCaptureAnimation();
          for (const hit of opt.test.targets) hit.q.progress = -1;
          capturedPieceIds = [];
          capturedPlayerIds = [];
        }
        game.pool = game.pool.filter(
          (_, index) => !opt.indices.includes(index),
        );
        moving = false;
        movingPieceId = null;
        recordAudit("MOVE", {
          pieceId: piece.id,
          pieceNumber: player.pieces.indexOf(piece) + 1,
          fromProgress,
          toProgress: piece.progress,
          fromSquare,
          toSquare: node(player, piece),
          values: [...opt.values],
          combinedRolls: opt.values.length > 1,
          legalMoveCount,
          captures: capturedPieces,
          enteredBoard: wasReserve,
          openingEntryAllowance: Boolean(opt.test.openingEntry),
          finishedPiece: willFinish,
          inputSource,
        });
        if (finished(player) && player.rank === null) {
          player.rank = 1;
          game.finished = 1;
          game.phase = "done";
          recordAudit("PLAYER_FINISH", {
            playerId: player.id,
            rank: 1,
          });
          commentary +=
            " " + player.name + " finishes all six pieces and wins the game!";
          recordAudit("GAME_END", {
            winner: {
              playerId: player.id,
              playerName: player.name,
            },
          });
          speakGame(commentary);
          if (multiplayer.active && multiplayer.isHost) broadcastState();
          render();
          return;
        }
        if (!game.pool.length || !options().length) {
          nextTurn();
          return;
        }
        selectedRoll = 0;
        if (multiplayer.active && multiplayer.isHost) broadcastState();
        render();
      }

      function scheduleComputerIfNeeded() {
        if (computerTimer) clearTimeout(computerTimer);
        computerTimer = null;
        if (
          !game ||
          demo ||
          rolling ||
          moving ||
          game.phase === "done" ||
          !active().computer
        )
          return;
        const naturalDelay = 1400 + Math.floor(Math.random() * 700),
          speechDelay = Math.max(0, commentaryUntil - Date.now() + 700);
        computerTimer = setTimeout(
          runComputerAction,
          Math.max(naturalDelay, speechDelay),
        );
      }
      function runComputerAction() {
        computerTimer = null;
        if (!game || demo || game.phase === "done" || !active().computer)
          return;
        if (game.phase === "roll") {
          roll();
          return;
        }
        const move = bestAutomaticMove();
        if (move) apply(move, "computer");
        else {
          recordAudit("PASS", { reason: "NO_LEGAL_MOVE" });
          nextTurn("No legal moves — turn passed.");
        }
      }
      function passRemainingRolls() {
        if (options().some((move) => move.test.openingEntry)) {
          $("statusText").textContent =
            "The opening entry allowance must be used so the game can begin.";
          return;
        }
        recordAudit("PASS", {
          reason: "PLAYER_CHOICE",
          unusedRolls: [...game.pool],
          legalMoveCount: options().length,
        });
        nextTurn("Unused rolls passed.");
      }
