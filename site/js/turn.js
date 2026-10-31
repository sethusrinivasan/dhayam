/**
 * turn.js - Turn Lifecycle, Movement Animations & AI Scheduling
 *
 * Coordinates roll completion, sequential square-by-square piece movement,
 * capture animation sequencing, turn advancement, and automated computer play.
 */
"use strict";

      function finishRoll(d) {
        const player = active();
        const val = typeof d.value === "number" ? d.value : (typeof d.val === "number" ? d.val : (d.a + d.b === 0 ? 12 : d.a + d.b));
        d.value = val;
        d.val = val;
        if (typeof val === "number" && !isNaN(val)) {
          game.pool.push(val);
          game.history.push(val);
        }
        rolling = false;
        const bonusResult = typeof d.bonus === "boolean" && d.specialRoll !== undefined
          ? { specialRoll: d.specialRoll, bonus: d.bonus, bonusDepth: Math.max(0, game.history.length - 1), bonusChance: d.bonus ? 1 : 0, bonusDraw: null }
          : bonusDecision(val),
          { specialRoll, bonus } = bonusResult;
        game.last = { ...d, ...bonusResult, value: val, val };
        if (!bonus) game.phase = "move";
        const legalMoveCount = game.phase === "move" ? options().length : null;
        if (typeof FlightRecorder !== "undefined") {
          FlightRecorder.record("ROLL_FINISHED", {
            value: val,
            faces: [d.a, d.b],
            bonus,
            specialRoll,
            pool: [...game.pool],
            phase: game.phase,
            legalMoveCount,
          });
        }
        recordAudit("ROLL", {
          firstFace: d.a,
          secondFace: d.b,
          value: val,
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
                val +
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
            val +
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
        if (typeof checkPendingRemoteState === "function" && checkPendingRemoteState()) {
          // Applied pending remote state which already called render()
        } else {
          render();
        }
      }
      function roll() {
        if (!game || game.phase !== "roll" || rolling || demo) return;
        if (typeof FlightRecorder !== "undefined") {
          FlightRecorder.record("ROLL_INITIATED", {
            player: active().name,
            current: game.current,
            pool: [...game.pool],
          });
        }
        if (multiplayer.active && !demo) {
          if (!isMyTurn()) return;
          if (multiplayer.transport === "cf_ws") {
            if (typeof sendWsMessage === "function") {
              sendWsMessage({ type: "ROLL" });
            }
            return;
          }
          if (!multiplayer.isHost) {
            sendPlayerAction({ type: "ROLL" });
            return;
          }
        }
        const d = pacingAssistRoll() || rollDice();
        const val = typeof d.value === "number" ? d.value : (typeof d.val === "number" ? d.val : (d.a + d.b === 0 ? 12 : d.a + d.b));
        d.value = val;
        d.val = val;
        rolling = true;
        setDieFace("dieA", d.a, "First die rolling");
        setDieFace("dieB", d.b, "Second die rolling");
        $("actionBtn").textContent = "Rolling…";
        $("actionBtn").disabled = true;
        triggerDiceAnimation();
        if (multiplayer.active && multiplayer.isHost && multiplayer.transport !== "cf_ws") {
          multiplayer.connections.forEach((conn) => {
            if (conn.open) {
              conn.send({
                type: "ROLL_START",
                seat: game.current,
                dice: { a: d.a, b: d.b },
                value: val,
                val: val,
                bonus: BONUS_VALUES.has(val)
              });
            }
          });
        }
        rollTimer = setTimeout(() => {
          rollTimer = null;
          try {
            finishRoll(d);
          } catch (err) {
            console.error("Error during finishRoll:", err);
            rolling = false;
            render();
          }
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
        if (typeof FlightRecorder !== "undefined") {
          FlightRecorder.record("MOVE_APPLIED", {
            pieceId: opt.piece.id,
            targetProgress: opt.test.progress,
            inputSource,
            values: opt.values,
          });
        }
        if (multiplayer.active && !demo) {
          if (!isMyTurn()) return;
          if (multiplayer.transport === "cf_ws") {
            if (typeof sendWsMessage === "function") {
              sendWsMessage({
                type: "MOVE",
                pieceId: opt.piece.id,
                diceValues: opt.values,
                targetProgress: opt.test.progress
              });
            }
            return;
          }
          if (!multiplayer.isHost) {
            sendPlayerAction({
              type: "MOVE",
              pieceId: opt.piece.id,
              values: opt.values,
              targetProgress: opt.test.progress
            });
            return;
          }
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
        const avName =
          typeof getPlayerAvatarSpeechName === "function"
            ? getPlayerAvatarSpeechName(player)
            : "piece";
        let commentary =
          player.name +
          (wasReserve
            ? opt.test.openingEntry
              ? " uses the opening entry allowance to enter a " + avName + " and"
              : " enters a " + avName + " and"
            : " moves a " + avName) +
          " uses " +
          opt.values.join(" plus ") +
          ".";
        if (captureCount) {
          const victimDesc = capturedPieces
            .map((cp) => {
              const victimPlayer = game.players.find((p) => p.id === cp.playerId);
              const victimAv =
                typeof getPlayerAvatarSpeechName === "function"
                  ? getPlayerAvatarSpeechName(victimPlayer)
                  : "piece";
              return cp.playerName + "’s " + victimAv;
            })
            .join(" and ");
          commentary += " " + victimDesc + " is captured and returns to reserve!";
        }
        if (willFinish) commentary += " The " + avName + " reaches the center!";
        moving = true;
        movingPieceId = piece.id;
        speakGame(commentary);

        try {
          if (multiplayer.active && multiplayer.isHost && multiplayer.transport !== "cf_ws") {
            multiplayer.connections.forEach((conn) => {
              if (conn.open) {
                conn.send({
                  type: "MOVE_START",
                  seat: game.current,
                  pieceId: piece.id,
                  fromProgress: piece.progress,
                  targetProgress: opt.test.progress,
                  destination: opt.test.destination || node(player, piece),
                  captures: capturedPieces,
                  commentary,
                  winner: willFinish && player.pieces.filter((q) => q.id !== piece.id).every((q) => q.progress === 43) ? player.name : null
                });
              }
            });
          }

          await animatePiece(player, piece, opt.test.progress);
          if (
            wasReserve &&
            game.turn <= game.players.length &&
            !game.openingEntryPlayers.includes(player.id)
          )
            game.openingEntryPlayers.push(player.id);
          player.captured = opt.test.captured;
          if (captureCount) {
            const capSquare = ROUTES[player.seat][opt.test.progress];
            capturedPieceIds = opt.test.targets.map((hit) => hit.q.id);
            capturedPlayerIds = opt.test.targets.map((hit) => hit.other.id);
            render();
            if (typeof showCaptureSplash === "function") {
              showCaptureSplash(capSquare);
            }
            $("statusTitle").textContent = "⚔️ Capture!";
            if ($("statusText")) $("statusText").textContent = "";
            await waitForCaptureAnimation();
            for (const hit of opt.test.targets) hit.q.progress = -1;
            capturedPieceIds = [];
            capturedPlayerIds = [];
          }
          game.pool = game.pool.filter(
            (_, index) => !opt.indices.includes(index),
          );
        } catch (err) {
          console.error("Error during move execution:", err);
        } finally {
          moving = false;
          movingPieceId = null;
        }

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
        const naturalDelay = 750 + Math.floor(Math.random() * 400),
          speechDelay = Math.min(900, Math.max(0, commentaryUntil - Date.now()));
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
        if (multiplayer.active && !demo) {
          if (!isMyTurn()) return;
          if (multiplayer.transport === "cf_ws") {
            if (typeof sendWsMessage === "function") {
              sendWsMessage({ type: "PASS" });
            }
            return;
          }
          if (!multiplayer.isHost) {
            sendPlayerAction({ type: "PASS" });
            return;
          }
        }
        recordAudit("PASS", {
          reason: "PLAYER_CHOICE",
          unusedRolls: [...game.pool],
          legalMoveCount: options().length,
        });
        nextTurn("Unused rolls passed.");
      }

      function handleSynchronizedRollStart(data) {
        if (!game || rolling) return;
        rolling = true;
        setDieFace("dieA", data.dice.a, "First die rolling");
        setDieFace("dieB", data.dice.b, "Second die rolling");
        const activeP = game.players[data.seat];
        if ($("actionBtn")) {
          $("actionBtn").textContent =
            data.seat === multiplayer.mySeat
              ? "Rolling…"
              : activeP
                ? activeP.name + " rolling…"
                : "Rolling…";
          $("actionBtn").disabled = true;
        }
        triggerDiceAnimation();
        rollTimer = setTimeout(() => {
          rollTimer = null;
          rolling = false;

          const val =
            typeof data.value === "number"
              ? data.value
              : typeof data.val === "number"
                ? data.val
                : data.dice.a + data.dice.b === 0
                  ? 12
                  : data.dice.a + data.dice.b;
          const isBonus =
            typeof data.bonus === "boolean" ? data.bonus : BONUS_VALUES.has(val);
          const specialRoll =
            typeof data.specialRoll === "boolean"
              ? data.specialRoll
              : BONUS_VALUES.has(val);

          setDieFace("dieA", data.dice.a, "First die showing " + data.dice.a);
          setDieFace("dieB", data.dice.b, "Second die showing " + data.dice.b);

          if (multiplayer.active && multiplayer.transport === "cf_ws") {
            game.last = {
              a: data.dice.a,
              b: data.dice.b,
              value: val,
              val,
              bonus: isBonus,
              specialRoll,
            };
            game.pool = Array.isArray(data.pool) ? [...data.pool] : [val];
            game.history = Array.isArray(data.history) ? [...data.history] : [val];
            game.phase = data.phase || (isBonus ? "roll" : "move");

            const legalMoveCount =
              game.phase === "move" ? options().length : null;
            if (typeof FlightRecorder !== "undefined") {
              FlightRecorder.record("ROLL_FINISHED", {
                value: val,
                faces: [data.dice.a, data.dice.b],
                bonus: isBonus,
                specialRoll,
                pool: [...game.pool],
                phase: game.phase,
                legalMoveCount,
              });
            }

            const pName = activeP ? activeP.name : "Player";
            if (!isBonus && game.phase === "roll") {
              speakGame(
                pName +
                  " rolled " +
                  val +
                  " but has no legal move. The turn passes.",
              );
            } else {
              speakGame(
                pName +
                  " rolled " +
                  val +
                  "." +
                  (isBonus
                    ? " That earns another roll."
                    : " Now choose a legal move."),
              );
            }

            if (typeof checkPendingRemoteState === "function" && checkPendingRemoteState()) {
              // Applied pending remote state
            } else {
              render();
            }
            return;
          }

          finishRoll({
            a: data.dice.a,
            b: data.dice.b,
            value: val,
            val,
            bonus: isBonus,
            specialRoll,
          });
        }, 1220);
      }

      async function handleSynchronizedMoveStart(data) {
        if (!game) return;
        const player = game.players[data.seat];
        if (!player) return;
        const piece = player.pieces.find((q) =>
          typeof matchPieceId === "function"
            ? matchPieceId(q.id, data.pieceId)
            : q.id === data.pieceId,
        );
        if (!piece) return;

        moving = true;
        movingPieceId = piece.id;

        try {
          const avName =
            typeof getPlayerAvatarSpeechName === "function"
              ? getPlayerAvatarSpeechName(player)
              : "piece";
          const wasReserve = piece.progress < 0;
          let commentary =
            data.commentary ||
            player.name +
              (wasReserve ? " enters a " + avName + " and " : " moves a " + avName + " ") +
              "to " +
              (data.destination || "the next square") +
              ".";
          if (data.captures && data.captures.length) {
            const victimDesc = data.captures
              .map((c) => {
                const victimPlayer = game.players.find(
                  (p) => p.id === (c.playerId || c.other?.id),
                );
                const victimAv =
                  typeof getPlayerAvatarSpeechName === "function"
                    ? getPlayerAvatarSpeechName(victimPlayer)
                    : "piece";
                return (
                  (victimPlayer ? victimPlayer.name : "An opponent") +
                  "’s " +
                  victimAv
                );
              })
              .join(" and ");
            commentary += " " + victimDesc + " is captured and returns to reserve!";
          }
          if (data.winner) {
            commentary +=
              " " + player.name + " finishes all six pieces and wins the game!";
          }
          speakGame(commentary);

          await animatePiece(player, piece, data.targetProgress);

          if (data.captures && data.captures.length) {
            const capSquare = ROUTES[player.seat][data.targetProgress];
            capturedPieceIds = data.captures.map((c) => c.pieceId || c.q?.id || c);
            capturedPlayerIds = data.captures.map((c) => c.playerId || c.other?.id || c);
            render();
            if (typeof showCaptureSplash === "function") {
              showCaptureSplash(capSquare);
            }
            $("statusTitle").textContent = "⚔️ Capture!";
            if ($("statusText")) $("statusText").textContent = "";
            await waitForCaptureAnimation();
            capturedPieceIds = [];
            capturedPlayerIds = [];
          }
        } catch (err) {
          console.error("Error during synchronized move execution:", err);
        } finally {
          moving = false;
          movingPieceId = null;
        }

        if (typeof checkPendingRemoteState === "function" && checkPendingRemoteState()) {
          // Applied pending remote state which already called render()
        } else {
          render();
        }
      }

      window.handleSynchronizedRollStart = handleSynchronizedRollStart;
      window.handleSynchronizedMoveStart = handleSynchronizedMoveStart;
