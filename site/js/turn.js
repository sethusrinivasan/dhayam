/**
 * turn.js - Turn Lifecycle, Movement Animations & AI Scheduling
 *
 * Coordinates roll completion, sequential square-by-square piece movement,
 * capture animation sequencing, turn advancement, and automated computer play.
 */
"use strict";

      const TAMIL_SPOKEN_NUMBERS = {
        1: "\u0ba4\u0bbe\u0baf\u0bae\u0bcd",
        2: "\u0b87\u0bb0\u0ba3\u0bcd\u0b9f\u0bc1",
        3: "\u0bae\u0bc2\u0ba9\u0bcd\u0bb1\u0bc1",
        4: "\u0ba8\u0bbe\u0ba9\u0bcd\u0b95\u0bc1",
        5: "\u0b80\u0ba8\u0bcd\u0ba4\u0bc1",
        6: "\u0b86\u0bb1\u0bc1",
        12: "\u0baa\u0ba9\u0bcd\u0ba9\u0bbf\u0bb0\u0ba3\u0bcd\u0b9f\u0bc1",
      };

      const TANGLISH_SPOKEN_NUMBERS = {
        1: "Dhayam",
        2: "irandu",
        3: "moondru",
        4: "naangu",
        5: "ainthu",
        6: "aaru",
        12: "pannirandu",
      };

      /**
       * Generates friendly, human-like guidance for the player following a dice roll.
       * Replaces bureaucratic repetitive phrases ("choose a legal move") with tactical,
       * engaging advice tailored to the state of the board.
       */
      function announceRollAndGuidance(player, val, bonus, opts) {
        const valWordTa = TAMIL_SPOKEN_NUMBERS[val] || val;
        const valWordTanglish = TANGLISH_SPOKEN_NUMBERS[val] || val;

        // 1. Bonus rolls
        if (bonus) {
          if (val === 1) {
            return {
              text: player.name + " rolled a 1 — Dhayam! That earns another roll. Roll again!",
              ta: player.name + " \u0ba4\u0bbe\u0baf\u0bae\u0bcd \u0b89\u0bb0\u0bc1\u0b9f\u0bcd\u0b9f\u0bbf\u0ba9\u0bbe\u0bb0\u0bcd! \u0b95\u0bc2\u0b9f\u0bc1\u0ba4\u0bb2\u0bcd \u0bb5\u0bbe\u0baf\u0bcd\u0baa\u0bcd\u0baa\u0bc1, \u0bae\u0bc0\u0ba3\u0bcd\u0b9f\u0bc1\u0bae\u0bcd \u0b89\u0bb0\u0bc1\u0b9f\u0bcd\u0b9f\u0bc1\u0b99\u0bcd\u0b95\u0bb3\u0bcd!",
              tanglish: player.name + " Dhayam uruttinaar! Kooduthal vaaippu, meendum uruttungal!",
            };
          }
          if (val === 12) {
            return {
              text: player.name + " rolled a 12! Double sixes — take another throw!",
              ta: player.name + " \u0baa\u0ba9\u0bcd\u0ba9\u0bbf\u0bb0\u0ba3\u0bcd\u0b9f\u0bc1 \u0b89\u0bb0\u0bc1\u0b9f\u0bcd\u0b9f\u0bbf\u0ba9\u0bbe\u0bb0\u0bcd! \u0b87\u0bb0\u0b9f\u0bcd\u0b9f\u0bc8 \u0b86\u0bb1\u0bc1, \u0bae\u0bc0\u0ba3\u0bcd\u0b9f\u0bc1\u0bae\u0bcd \u0b89\u0bb0\u0bc1\u0b9f\u0bcd\u0b9f\u0bc1\u0b99\u0bcd\u0b95\u0bb3\u0bcd!",
              tanglish: player.name + " pannirandu uruttinaar! Irattai aaru, meendum uruttungal!",
            };
          }
          return {
            text: player.name + " rolled a " + val + "! That earns a bonus throw. Roll again!",
            ta: player.name + " " + valWordTa + " \u0b89\u0bb0\u0bc1\u0b9f\u0bcd\u0b9f\u0bbf\u0ba9\u0bbe\u0bb0\u0bcd! \u0b95\u0bc2\u0b9f\u0bc1\u0ba4\u0bb2\u0bcd \u0bb5\u0bbe\u0baf\u0bcd\u0baa\u0bcd\u0baa\u0bc1, \u0bae\u0bc0\u0ba3\u0bcd\u0b9f\u0bc1\u0bae\u0bcd \u0b89\u0bb0\u0bc1\u0b9f\u0bcd\u0b9f\u0bc1\u0b99\u0bcd\u0b95\u0bb3\u0bcd!",
            tanglish: player.name + " " + valWordTanglish + " uruttinaar! Kooduthal vaaippu, meendum uruttungal!",
          };
        }

        // 2. Blocked / No options
        if (!opts || opts.length === 0) {
          return {
            text: player.name + " rolled " + val + ", but the path is blocked this time. Passing to the next player.",
            ta: player.name + " " + valWordTa + " \u0b89\u0bb0\u0bc1\u0b9f\u0bcd\u0b9f\u0bbf\u0ba9\u0bbe\u0bb0\u0bcd, \u0b86\u0ba9\u0bbe\u0bb2\u0bcd \u0bb5\u0bb4\u0bbf \u0b85\u0b9f\u0bc8\u0baa\u0bcd\u0baa\u0b9f\u0bcd\u0b9f\u0bc1\u0bb3\u0bcd\u0bb3\u0ba4\u0bc1. \u0b85\u0b9f\u0bc1\u0ba4\u0bcd\u0ba4\u0bb5\u0bb0\u0bcd \u0bae\u0bc1\u0bb1\u0bc8.",
            tanglish: player.name + " " + valWordTanglish + " uruttinaar, aanaal vazhi adaipattullathu. Aduthavar murai.",
          };
        }

        // 3. Center Goal milestone opportunity
        const canGoal = opts.some((m) => m.test.progress === 43);
        if (canGoal) {
          return {
            text: player.name + " rolled " + val + "! You can reach the center goal now!",
            ta: player.name + " " + valWordTa + " \u0b89\u0bb0\u0bc1\u0b9f\u0bcd\u0b9f\u0bbf\u0ba9\u0bbe\u0bb0\u0bcd! \u0baa\u0bb0\u0bae\u0baa\u0ba4\u0ba4\u0bcd\u0ba4\u0bc8 \u0b85\u0b9f\u0bc8\u0baf \u0b85\u0bb0\u0bc1\u0bae\u0bc8\u0baf\u0bbe\u0ba9 \u0bb5\u0bbe\u0baf\u0bcd\u0baa\u0bcd\u0baa\u0bc1!",
            tanglish: player.name + " " + valWordTanglish + " uruttinaar! Paramapadathai adaiya arumaiyaana vaaippu!",
          };
        }

        // 4. Capture opportunity
        const captureMove = opts.find((m) => m.test.targets && m.test.targets.length > 0);
        if (captureMove) {
          const victim = captureMove.test.targets[0]?.other?.name || "an opponent";
          return {
            text: player.name + " rolled " + val + "! You have a chance to capture " + victim + "!",
            ta: player.name + " " + valWordTa + " \u0b89\u0bb0\u0bc1\u0b9f\u0bcd\u0b9f\u0bbf\u0ba9\u0bbe\u0bb0\u0bcd! \u0b8e\u0ba4\u0bbf\u0bb0\u0bbf \u0b95\u0bbe\u0baf\u0bc8 \u0bb5\u0bc6\u0b9f\u0bcd\u0b9f\u0bc1\u0bae\u0bcd \u0bb5\u0bbe\u0baf\u0bcd\u0baa\u0bcd\u0baa\u0bc1 \u0b89\u0bb3\u0bcd\u0bb3\u0ba4\u0bc1!",
            tanglish: player.name + " " + valWordTanglish + " uruttinaar! Ethiri kaayai vettum vaaippu ullathu!",
          };
        }

        // 5. Piece entry opportunity
        const canEnter = opts.some((m) => m.piece && m.piece.progress < 0);
        if (canEnter) {
          return {
            text: player.name + " rolled " + (val === 1 ? "a 1" : val) + "! Time to bring a new piece onto the board.",
            ta: player.name + " " + valWordTa + " \u0b89\u0bb0\u0bc1\u0b9f\u0bcd\u0b9f\u0bbf\u0ba9\u0bbe\u0bb0\u0bcd! \u0baa\u0bc1\u0ba4\u0bbf\u0baf \u0b95\u0bbe\u0baf\u0bc8 \u0b95\u0bb3\u0ba4\u0bcd\u0ba4\u0bbf\u0bb2\u0bcd \u0b87\u0bb1\u0b95\u0bcd\u0b95\u0bb2\u0bbe\u0bae\u0bcd.",
            tanglish: player.name + " " + valWordTanglish + " uruttinaar! Puthiya kaayai kalathil irakkalaam.",
          };
        }

        // 6. Safe sanctuary opportunity
        const canSanctuary = opts.some((m) => {
          const dest = typeof ROUTES !== "undefined" && ROUTES[player.seat] ? ROUTES[player.seat][m.test.progress] : null;
          return dest && typeof SAFE !== "undefined" && SAFE.has(dest);
        });
        if (canSanctuary) {
          return {
            text: player.name + " rolled " + val + "! A safe sanctuary square is open for you.",
            ta: player.name + " " + valWordTa + " \u0b89\u0bb0\u0bc1\u0b9f\u0bcd\u0b9f\u0bbf\u0ba9\u0bbe\u0bb0\u0bcd! \u0baa\u0bbe\u0ba4\u0bc1\u0b95\u0bbe\u0baa\u0bcd\u0baa\u0bc1 \u0bae\u0bb2\u0bc8\u0b95\u0bcd \u0b95\u0b9f\u0bcd\u0b9f\u0ba4\u0bcd\u0ba4\u0bc8 \u0b85\u0b9f\u0bc8\u0baf\u0bb2\u0bbe\u0bae\u0bcd.",
            tanglish: player.name + " " + valWordTanglish + " uruttinaar! Paathukaappu malai kattathai adaiyalaam.",
          };
        }

        // 7. Varied friendly guidance
        const promptsEn = [
          player.name + " rolled " + val + ". Which piece would you like to advance?",
          player.name + " rolled " + val + ". Pick your piece and advance along the path.",
          player.name + " rolled " + val + ". Tap your piece to step forward!",
          player.name + " rolled " + val + ". Step forward along the trail.",
        ];
        const promptsTa = [
          player.name + " " + valWordTa + " \u0b89\u0bb0\u0bc1\u0b9f\u0bcd\u0b9f\u0bbf\u0ba9\u0bbe\u0bb0\u0bcd. \u0b8e\u0ba8\u0bcd\u0ba4 \u0b95\u0bbe\u0baf\u0bc8 \u0ba8\u0b95\u0bb0\u0bcd\u0ba4\u0bcd\u0ba4\u0baa\u0bcd \u0baa\u0bcb\u0b95\u0bbf\u0bb1\u0bc0\u0bb0\u0bcd\u0b95\u0bb3\u0bcd?",
          player.name + " " + valWordTa + " \u0b89\u0bb0\u0bc1\u0b9f\u0bcd\u0b9f\u0bbf\u0ba9\u0bbe\u0bb0\u0bcd. \u0b95\u0bbe\u0baf\u0bc8\u0ba4\u0bcd \u0ba4\u0bc7\u0bb0\u0bcd\u0ba8\u0bcd\u0ba4\u0bc6\u0b9f\u0bc1\u0ba4\u0bcd\u0ba4\u0bc1 \u0bae\u0bc1\u0ba9\u0bcd\u0ba9\u0bc7\u0bb1\u0bc1\u0b99\u0bcd\u0b95\u0bb3\u0bcd.",
          player.name + " " + valWordTa + " \u0b89\u0bb0\u0bc1\u0b9f\u0bcd\u0b9f\u0bbf\u0ba9\u0bbe\u0bb0\u0bcd. \u0b89\u0b99\u0bcd\u0b95\u0bb3\u0bcd \u0b95\u0bbe\u0baf\u0bc8 \u0ba8\u0b95\u0bb0\u0bcd\u0ba4\u0bcd\u0ba4\u0bbf \u0bb5\u0bbe\u0bb0\u0bc1\u0b99\u0bcd\u0b95\u0bb3\u0bcd.",
        ];
        const promptsTanglish = [
          player.name + " " + valWordTanglish + " uruttinaar. Entha kaayai nagartha pogireerkal?",
          player.name + " " + valWordTanglish + " uruttinaar. Kaayai therntheduthu munnerungal.",
          player.name + " " + valWordTanglish + " uruttinaar. Ungal kaayai nagarthi vaarungal.",
        ];
        const turnVal = (typeof game !== "undefined" && game ? game.turn : 1) + val;
        const pIdx = turnVal % promptsEn.length;
        const taIdx = turnVal % promptsTa.length;

        return {
          text: promptsEn[pIdx],
          ta: promptsTa[taIdx],
          tanglish: promptsTanglish[taIdx],
        };
      }
      window.announceRollAndGuidance = announceRollAndGuidance;

      function speakGuidance(guidance) {
        if (!guidance || typeof speakGame !== "function") return;
        const isTamil = typeof getLanguage === "function" && getLanguage() === "ta";
        if (isTamil) {
          speakGame(guidance.ta, { tanglish: guidance.tanglish });
        } else {
          speakGame(guidance.text);
        }
      }
      window.speakGuidance = speakGuidance;

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
        const guidance = announceRollAndGuidance(player, val, bonus, bonus ? [] : options());
        if (!bonus) {
          if (!legalMoveCount) {
            game.pool = [];
            speakGuidance(guidance);
            recordAudit("PASS", { reason: "NO_LEGAL_MOVE" });
            nextTurn(typeof t === "function" ? t("no_legal_moves_passed") : "No moves available — turn passed.");
            return;
          }
        }
        speakGuidance(guidance);
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
              sendWsMessage({ type: "ROLL", secret: rollSecret || "" });
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
        const isFast = Boolean(superSpeed || (typeof quantumMode !== "undefined" && quantumMode) || demoSpeed >= 32);
        const minDelay = isFast ? (demoSpeed >= 32 ? 4 : MIN_SUPER_MOVE_DELAY) : 40;
        return new Promise((resolve) =>
          setTimeout(
            resolve,
            Math.max(minDelay, scaledDemoDelay(MOVE_STEP_DELAY)),
          ),
        );
      }
      function waitForCaptureAnimation() {
        const isFast = Boolean(superSpeed || (typeof quantumMode !== "undefined" && quantumMode) || demoSpeed >= 32);
        const minDelay = isFast ? 10 : 80;
        return new Promise((resolve) =>
          setTimeout(resolve, Math.max(minDelay, scaledDemoDelay(1250))),
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
        movingStepRemaining = totalSteps;
        render();
        if (piece.progress < 0) {
          piece.progress = 0;
          completed++;
          movingStepRemaining = totalSteps - completed;
          renderAnimationStep();
          $("statusTitle").textContent = playerName + " is moving";
          $("statusText").textContent =
            "Entering the board · step " + completed + " of " + totalSteps;
          await waitForMoveStep();
        }
        while (piece.progress < targetProgress) {
          piece.progress++;
          completed++;
          movingStepRemaining = totalSteps - completed;
          renderAnimationStep();
          $("statusTitle").textContent = playerName + " is moving";
          $("statusText").textContent =
            "Following the route · step " + completed + " of " + totalSteps;
          await waitForMoveStep();
        }
        render();
      }
      async function animateScriptedPiece(player, piece, targetProgress) {
        moving = true;
        movingPieceId = piece.id;
        movingStepRemaining = 1;
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
        let commentary = "";
        let tanglishCommentary = "";
        const stepSum = opt.values.reduce((sum, v) => sum + v, 0);
        if (typeof getLanguage === "function" && getLanguage() === "ta") {
          if (wasReserve) {
            commentary = player.name + " \u0baa\u0bc1\u0ba4\u0bbf\u0baf \u0b95\u0bbe\u0baf\u0bc8 \u0b95\u0bb3\u0ba4\u0bcd\u0ba4\u0bbf\u0bb2\u0bcd \u0b87\u0bb1\u0b95\u0bcd\u0b95\u0bbf\u0ba9\u0bbe\u0bb0\u0bcd.";
            tanglishCommentary = player.name + " puthiya kaayai kalathil irakkinaar.";
          } else {
            commentary = player.name + " \u0b95\u0bbe\u0baf\u0bc8 " + stepSum + " \u0b95\u0b9f\u0bcd\u0b9f\u0b99\u0bcd\u0b95\u0bb3\u0bcd \u0ba8\u0b95\u0bb0\u0bcd\u0ba4\u0bcd\u0ba4\u0bbf\u0ba9\u0bbe\u0bb0\u0bcd.";
            tanglishCommentary = player.name + " kaayai " + stepSum + " kattangal nagarthinaar.";
          }
          if (captureCount) {
            const victimDesc = capturedPieces.map((cp) => cp.playerName).join(", ");
            commentary += " \u0bb5\u0bc6\u0b9f\u0bcd\u0b9f\u0bc1! " + victimDesc + " \u0b95\u0bbe\u0baf\u0bcd \u0bb5\u0bc6\u0b9f\u0bcd\u0b9f\u0baa\u0bcd\u0baa\u0b9f\u0bcd\u0b9f\u0ba4\u0bc1!";
            tanglishCommentary += " Vettu! " + victimDesc + " kaay vettappattathu!";
          }
          if (willFinish) {
            commentary += " \u0bb5\u0bbe\u0bb4\u0bcd\u0ba4\u0bcd\u0ba4\u0bc1\u0b95\u0bb3\u0bcd " + player.name + "! \u0b95\u0bbe\u0baf\u0bcd \u0baa\u0bb0\u0bae\u0baa\u0ba4\u0ba4\u0bcd\u0ba4\u0bc8 \u0b85\u0b9f\u0bc8\u0ba8\u0bcd\u0ba4\u0ba4\u0bc1!";
            tanglishCommentary += " Vaazhthukkal " + player.name + "! Kaay Paramapadathai adainthathu!";
          }
        } else {
          if (wasReserve) {
            commentary = player.name + " brings a " + avName + " onto the board.";
          } else {
            commentary = player.name + " advances the " + avName + " " + stepSum + (stepSum === 1 ? " square." : " squares.");
          }
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
            commentary += " Capture! " + victimDesc + " is captured and sent back to reserve!";
          }
          if (willFinish) {
            commentary += " Congratulations " + player.name + "! The " + avName + " reaches the center goal!";
          }
        }
        moving = true;
        movingPieceId = piece.id;
        speakGame(commentary, { tanglish: tanglishCommentary });

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

          // Bonus Point Award: Coin entered onto the board from reserve
          if (wasReserve) {
            player.bonusPoints = (player.bonusPoints || 0) + 1;
            if (typeof showToast === "function") {
              showToast("⭐ +1 Bonus Point! " + player.name + " entered a coin onto the board.");
            }
            if (typeof displayFloatingEmote === "function") {
              displayFloatingEmote("⭐", player.name);
            }
            if (typeof FlightRecorder !== "undefined") {
              FlightRecorder.record("BONUS_POINT_AWARDED", {
                player: player.name,
                reason: "COIN_ENTERED_BOARD",
                bonusPoints: player.bonusPoints,
              });
            }
          }

          // Bonus Point Award & Congratulatory Celebration: Coin reached the sacred center (Goal / D4)
          if (willFinish) {
            player.bonusPoints = (player.bonusPoints || 0) + 1;
            const destSq = node(player, piece) || "D4";
            if (typeof showGoalSplash === "function") {
              showGoalSplash(destSq, player.name, player.avatar);
            }
            if (typeof displayFloatingEmote === "function") {
              displayFloatingEmote("🎯", player.name);
              setTimeout(() => displayFloatingEmote("🏆", player.name), 250);
              setTimeout(() => displayFloatingEmote("🎉", player.name), 500);
            }
            if (typeof showToast === "function") {
              showToast("🎉 Congratulations " + player.name + "! Reached the center (+1 bonus point)!");
            }
            $("statusTitle").textContent = "🎯 Center Reached!";
            if ($("statusText")) {
              $("statusText").textContent = "🎉 Congratulations " + player.name + "! Coin reached the sacred center (+1 bonus point)!";
            }
            if (typeof FlightRecorder !== "undefined") {
              FlightRecorder.record("COIN_REACHED_CENTER", {
                player: player.name,
                pieceId: piece.id,
                bonusPoints: player.bonusPoints,
              });
            }
          }

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
            const victimSummary = opt.test.targets
              .map((hit) => (hit.other.avatar ? hit.other.avatar + " " : "") + hit.other.name)
              .join(" & ");
            const detail = (player.avatar ? player.avatar + " " : "") + player.name + " captured " + victimSummary;

            if (typeof showCaptureSplash === "function") {
              showCaptureSplash(capSquare, detail);
            }
            if (typeof FlightRecorder !== "undefined") {
              FlightRecorder.record("PIECE_CAPTURED", {
                capturer: player.name,
                square: capSquare,
                victims: capturedPieces,
                detail
              });
            }
            $("statusTitle").textContent = "⚔️ Capture!";
            if ($("statusText")) $("statusText").textContent = "";
            if (typeof animateCapturedPiecesToTable === "function") {
              await animateCapturedPiecesToTable(capSquare, opt.test.targets);
            } else {
              await waitForCaptureAnimation();
            }
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
          movingStepRemaining = 0;
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
          if (typeof getLanguage === "function" && getLanguage() === "ta") {
            const winTa = player.name + " \u0bb5\u0bc6\u0bb1\u0bcd\u0bb1\u0bbf \u0baa\u0bc6\u0bb1\u0bcd\u0bb1\u0bbe\u0bb0\u0bcd! \u0bb5\u0bbe\u0bb4\u0bcd\u0ba4\u0bcd\u0ba4\u0bc1\u0b95\u0bb3\u0bcd!";
            const winTanglish = player.name + " vetri petraar! Vaazhthukkal!";
            commentary += " " + winTa;
            speakGame(commentary, { tanglish: tanglishCommentary + " " + winTanglish });
          } else {
            commentary +=
              " " + player.name + " finishes all six pieces and wins the game!";
            speakGame(commentary);
          }
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
        const naturalDelay = 750 + Math.floor(Math.random() * 400);
        const isSpeaking = typeof isAudioSpeaking === "function" ? isAudioSpeaking() : (typeof speechSynthesis !== "undefined" && speechSynthesis.speaking);
        const speechRemaining = Math.max(0, commentaryUntil - Date.now());
        const waitTime = (audioEnabled && (isSpeaking || speechRemaining > 0))
          ? Math.max(naturalDelay, speechRemaining + 350)
          : naturalDelay;
        computerTimer = setTimeout(
          runComputerAction,
          waitTime,
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
            const guidance = announceRollAndGuidance(activeP || { name: pName }, val, isBonus, isBonus ? [] : options());
            speakGuidance(guidance);

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

          if (wasReserve) {
            player.bonusPoints = (player.bonusPoints || 0) + 1;
            if (typeof displayFloatingEmote === "function") {
              displayFloatingEmote("⭐", player.name);
            }
          }

          if (data.targetProgress === 43) {
            player.bonusPoints = (player.bonusPoints || 0) + 1;
            const destSq = (ROUTES[player.seat] && ROUTES[player.seat][43]) || "D4";
            if (typeof showGoalSplash === "function") {
              showGoalSplash(destSq, player.name, player.avatar);
            }
            if (typeof displayFloatingEmote === "function") {
              displayFloatingEmote("🎯", player.name);
              setTimeout(() => displayFloatingEmote("🏆", player.name), 250);
              setTimeout(() => displayFloatingEmote("🎉", player.name), 500);
            }
          }

          if (data.captures && data.captures.length) {
            const capSquare = ROUTES[player.seat][data.targetProgress];
            capturedPieceIds = data.captures.map((c) => c.pieceId || c.q?.id || c);
            capturedPlayerIds = data.captures.map((c) => c.playerId || c.other?.id || c);
            render();
            const victimSummary = data.captures
              .map((c) => {
                const victimPlayer = game.players.find((p) => p.id === (c.playerId || c.other?.id));
                return victimPlayer ? (victimPlayer.avatar ? victimPlayer.avatar + " " : "") + victimPlayer.name : "opponent";
              })
              .join(" & ");
            const detail = (player.avatar ? player.avatar + " " : "") + player.name + " captured " + victimSummary;

            if (typeof showCaptureSplash === "function") {
              showCaptureSplash(capSquare, detail);
            }
            if (typeof FlightRecorder !== "undefined") {
              FlightRecorder.record("PIECE_CAPTURED", {
                capturer: player.name,
                square: capSquare,
                victims: data.captures,
                detail
              });
            }
            $("statusTitle").textContent = "⚔️ Capture!";
            if ($("statusText")) $("statusText").textContent = "";
            if (typeof animateCapturedPiecesToTable === "function") {
              await animateCapturedPiecesToTable(capSquare, data.captures);
            } else {
              await waitForCaptureAnimation();
            }
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
