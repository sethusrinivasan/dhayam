/**
 * demo.js - Interactive Guided Demo & Auto-Play Controller
 *
 * Orchestrates a step-by-step tutorial introducing piece entry, movement, and commentary,
 * supporting pause/resume, variable speed (0.5x - 2x), and silent super-speed.
 */
"use strict";

      function stopDemo() {
        if (demoTimer) clearTimeout(demoTimer);
        if (demoSpeechTimer) clearTimeout(demoSpeechTimer);
        demoTimer = null;
        demoSpeechTimer = null;
        demoSpeechId++;
        demoWaitingForSpeech = false;
        if ("speechSynthesis" in window) speechSynthesis.cancel();
        if (superSpeed) {
          demoSpeed = savedDemoSpeed;
          audioEnabled = savedAudioEnabled;
        }
        demo = false;
        demoPaused = false;
        demoStep = 0;
        superSpeed = false;
        demoSpeed = 1;
        demoRollQueue = [];
        if ($("demoBar")) $("demoBar").hidden = true;
      }

      function findBonusRolls(total) {
        return [12, 6, 5, 1].find((value) => value <= total) ?? null;
      }
      function planDemoTurn(piece) {
        // A planned demo turn uses one special roll plus one ordinary roll so
        // it remains predictable while normal games use diminishing bonuses.
        const reserve = piece.progress < 0,
          remaining = reserve ? 43 : 43 - piece.progress;
        if (remaining === 1) return [1, 2];
        if (reserve) return [1, 4];
        const ordinaryRoll = [4, 3, 2].find((value) => value <= remaining);
        if (!ordinaryRoll) return [1, 2];
        const bonusRoll = findBonusRolls(remaining - ordinaryRoll);
        return bonusRoll ? [bonusRoll, ordinaryRoll] : [ordinaryRoll];
      }
      function chooseDemoMove() {
        return bestAutomaticMove();
      }
      function demoRollAction() {
        const player = active();
        if (!demoRollQueue.length) {
          const piece = player.pieces.find((item) => item.progress < 43);
          demoRollQueue = planDemoTurn(piece);
        }
        const value = demoRollQueue.shift(),
          faces = DEMO_FACES[value];
        game.pool.push(value);
        game.history.push(value);
        const bonusResult = bonusDecision(value),
          { specialRoll, bonus } = bonusResult;
        game.last = { a: faces[0], b: faces[1], value, ...bonusResult };
        if (!bonus) game.phase = "move";
        recordAudit("ROLL", {
          firstFace: faces[0],
          secondFace: faces[1],
          value,
          specialRoll,
          bonus,
          bonusDepth: bonusResult.bonusDepth,
          bonusChance: bonusResult.bonusChance,
          bonusDraw: bonusResult.bonusDraw,
          rollNumberInTurn: game.history.length,
          legalMoveCount: game.phase === "move" ? options().length : null,
          plannedDemoRoll: true,
        });
        render();
        const bonusMessage = bonus
          ? " It earns another roll."
          : specialRoll
            ? " Its reduced bonus chance ends the chain, so it is time to move."
            : "";
        const message = player.name + " rolls " + value + "." + bonusMessage;
        $("statusTitle").textContent = "Full guided game · Turn " + game.turn;
        $("statusText").textContent = message;
        speakDemo(message);
        triggerDiceAnimation();
      }
      async function demoMoveAction() {
        const player = active(),
          move = chooseDemoMove();
        if (!move) {
          recordAudit("PASS", { reason: "NO_LEGAL_MOVE" });
          nextTurn("No legal moves — turn passed.");
          demoRollQueue = [];
          const message =
            player.name + " has no legal move, so the turn passes.";
          $("statusTitle").textContent = "Full guided game · Turn " + game.turn;
          $("statusText").textContent = message;
          speakDemo(message);
          return;
        }
        const from = move.piece.progress,
          captures = move.test.targets.length,
          willFinish = move.test.progress === 43;
        await apply(move, "guided-demo");
        demoRollQueue = [];
        let message =
          player.name +
          (from < 0 ? " enters a piece and " : " moves a piece ") +
          "using " +
          move.values.join(" + ") +
          ".";
        if (captures)
          message += " An opponent is captured and returns to reserve.";
        if (willFinish)
          message += " That piece reaches the center and finishes.";
        if (game.phase === "done")
          message =
            player.name +
            " finishes all six pieces, wins the game, and play stops.";
        $("statusTitle").textContent =
          game.phase === "done"
            ? "Full guided game complete"
            : "Full guided game · Turn " + game.turn;
        $("statusText").textContent = message;
        speakDemo(message);
      }
      async function runDemoGameStep() {
        if (game.phase === "done") return;
        if (game.phase === "roll") demoRollAction();
        else await demoMoveAction();
      }
      function updateDemoControls() {
        const complete = game && game.phase === "done",
          available = "speechSynthesis" in window,
          opening = demoStep < DEMO_STEPS.length;
        $("demoBar").hidden = !demo;
        $("demoProgress").textContent = complete
          ? "Full match complete"
          : (demoPaused ? "Paused · " : "") +
            (opening
              ? "Opening lesson " +
                Math.max(1, demoStep) +
                " of " +
                DEMO_STEPS.length
              : "Full game · Turn " + game.turn) +
            (superSpeed ? " · Super 3× · Audio off" : "");
        $("demoPause").textContent = demoPaused ? "Resume" : "Pause";
        $("demoPause").disabled = complete;
        $("demoSpeed").value = String(Math.min(demoSpeed, 2));
        $("demoSpeed").disabled = superSpeed;
        $("demoSpeedValue").value = superSpeed ? "Super 3×" : demoSpeed + "×";
        $("demoSuperSpeed").textContent = superSpeed
          ? "⚡ Super speed on"
          : "⚡ Super speed";
        $("demoSuperSpeed").setAttribute("aria-pressed", String(superSpeed));
        $("demoSuperSpeed").disabled = complete;
        $("demoAudioToggle").textContent = available
          ? audioEnabled
            ? "🔊 Audio on"
            : "🔇 Audio off"
          : "Audio unavailable";
        $("demoAudioToggle").setAttribute("aria-pressed", String(audioEnabled));
        $("demoAudioToggle").disabled = !available || superSpeed;
      }
      function scheduleDemo(delay = DEMO_DELAY) {
        if (!demo || demoPaused || game.phase === "done") return;
        if (demoTimer) clearTimeout(demoTimer);
        demoTimer = setTimeout(runDemoStep, scaledDemoDelay(delay));
      }
      async function runDemoStep() {
        demoTimer = null;
        if (!demo || demoPaused) return;
        if (demoStep < DEMO_STEPS.length) {
          await DEMO_STEPS[demoStep]();
          demoStep++;
        } else await runDemoGameStep();
        updateDemoControls();
        if (game.phase !== "done" && !demoWaitingForSpeech)
          scheduleDemo(demoNextDelay);
      }
      function startGuidedDemo() {
        newGame(2);
        demo = true;
        audit.mode = "guided-demo";
        recordAudit("MODE_CHANGE", { mode: audit.mode });
        demoPaused = false;
        demoStep = 0;
        demoRollQueue = [];
        $("demoBar").hidden = false;
        runDemoStep();
      }
      function restartGuidedDemo() {
        startGuidedDemo();
      }
      function toggleDemoPause() {
        if (!demo) return;
        demoPaused = !demoPaused;
        if (demoPaused) {
          if (demoTimer) {
            clearTimeout(demoTimer);
            demoTimer = null;
          }
          if (demoSpeechTimer) {
            clearTimeout(demoSpeechTimer);
            demoSpeechTimer = null;
          }
          if ("speechSynthesis" in window) speechSynthesis.pause();
        } else {
          if ("speechSynthesis" in window) speechSynthesis.resume();
          if (demoWaitingForSpeech) {
            const id = demoSpeechId;
            demoSpeechTimer = setTimeout(
              () => finishDemoSpeech(id),
              scaledDemoDelay(demoNextDelay + 2500),
            );
          } else scheduleDemo(800);
        }
        updateDemoControls();
      }
      function toggleSuperSpeed() {
        if (!demo || game.phase === "done") return;
        if (!superSpeed) {
          savedDemoSpeed = demoSpeed;
          savedAudioEnabled = audioEnabled;
          superSpeed = true;
          demoSpeed = SUPER_DEMO_SPEED;
          audioEnabled = false;
          if (demoSpeechTimer) clearTimeout(demoSpeechTimer);
          demoSpeechTimer = null;
          demoSpeechId++;
          demoWaitingForSpeech = false;
          if ("speechSynthesis" in window) speechSynthesis.cancel();
        } else {
          superSpeed = false;
          demoSpeed = savedDemoSpeed;
          audioEnabled = savedAudioEnabled;
          if (audioEnabled) speakDemo($("statusText").textContent);
        }
        if (demoTimer) clearTimeout(demoTimer);
        demoTimer = null;
        if (!demoPaused) scheduleDemo(450);
        updateAudioToggle();
        updateDemoControls();
      }

      function exitGuidedDemo() {
        newGame(4);
      }
