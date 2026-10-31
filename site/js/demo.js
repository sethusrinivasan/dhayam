/**
 * demo.js - Interactive Guided Demo & Auto-Play Controller
 *
 * Orchestrates step-by-step tutorials introducing piece entry, movement, and commentary,
 * supporting classic tabletop rules walkthrough and online multiplayer simulation with
 * Cloudflare Edge Durable Objects, QR code mobile joins, and live floating emoji banter.
 */
"use strict";

      const DEMO_STEPS_MULTIPLAYER = [
        () => {
          const p1 = (game && game.players && game.players[0]) || { name: "Maya", avatar: "🎃" };
          if (typeof displayFloatingEmote === "function") displayFloatingEmote("👋", p1.name);
          return demoScene(
            "Cloudflare Edge Room CF88 created. WebSocket hibernation active with host " + p1.name + " in Seat 1.",
            () => {
              game.current = 0;
              game.turn = 1;
              game.phase = "roll";
              game.pool = [];
              game.history = [];
              game.last = null;
              if (typeof updateMultiplayerBadge === "function") updateMultiplayerBadge();
            },
          );
        },
        () => {
          const p2 = (game && game.players && game.players[1]) || { name: "Leo", avatar: "👻" };
          if (typeof displayFloatingEmote === "function") {
            displayFloatingEmote("📱", p2.name);
            if (game.players.length > 2) {
              setTimeout(() => displayFloatingEmote("🎮", game.players[2].name), 400);
            }
            if (game.players.length > 3) {
              setTimeout(() => displayFloatingEmote("✨", game.players[3].name), 800);
            }
          }
          const otherNames = game.players.slice(1).map((p) => p.name).join(" and ");
          return demoScene(
            otherNames + " scanned the QR code on mobile and joined Room CF88! Seats are synchronized across all devices.",
            () => {
              game.current = 0;
              game.turn = 1;
              game.phase = "roll";
            },
          );
        },
        () => {
          const p1 = (game && game.players && game.players[0]) || { name: "Maya", avatar: "🎃" };
          if (typeof displayFloatingEmote === "function") displayFloatingEmote("🎲", p1.name);
          return demoScene(
            p1.name + " rolls a 1 (Dhayam) on desktop. 3D dice physics and result are broadcast via WebSockets to all players.",
            () => {
              game.last = {
                a: 0,
                b: 1,
                value: 1,
                val: 1,
                bonus: true,
                specialRoll: true,
              };
              game.pool = [1];
              game.history = [1];
              game.phase = "move";
            },
          );
        },
        () => {
          const p1 = (game && game.players && game.players[0]) || { name: "Maya", avatar: "🎃" };
          const p2 = (game && game.players && game.players[1]) || { name: "Leo", avatar: "👻" };
          const avName1 = typeof getPlayerAvatarSpeechName === "function" ? getPlayerAvatarSpeechName(p1) : "piece";
          if (typeof displayFloatingEmote === "function") {
            setTimeout(() => displayFloatingEmote("👏", p2.name), 450);
          }
          return demoScene(
            "A roll of 1 allows " + p1.name + " to enter a " + avName1 + " on the board. Movement streams to every device.",
            async () => {
              await animateScriptedPiece(
                game.players[0],
                game.players[0].pieces[0],
                0,
              );
              game.pool = [];
              game.phase = "roll";
            },
          );
        },
        () => {
          const p1 = (game && game.players && game.players[0]) || { name: "Maya", avatar: "🎃" };
          const avName1 = typeof getPlayerAvatarSpeechName === "function" ? getPlayerAvatarSpeechName(p1) : "piece";
          if (typeof displayFloatingEmote === "function") displayFloatingEmote("🔥", p1.name);
          return demoScene(
            "Rolling 1 grants a bonus roll! " + p1.name + " rolls 3 and advances three spaces along the circuit.",
            async () => {
              game.last = {
                a: 0,
                b: 3,
                value: 3,
                val: 3,
                bonus: false,
                specialRoll: false,
              };
              game.pool = [3];
              game.history = [1, 3];
              game.phase = "move";
              await animateScriptedPiece(
                game.players[0],
                game.players[0].pieces[0],
                3,
              );
              game.pool = [];
              game.history = [];
              game.current = 1;
              game.turn = 2;
              game.phase = "roll";
            },
          );
        },
        () => {
          const p2 = (game && game.players && game.players[1]) || { name: "Leo", avatar: "👻" };
          if (typeof displayFloatingEmote === "function") displayFloatingEmote("📱", p2.name);
          return demoScene(
            "Turn handed over Cloudflare Edge to " + p2.name + " on mobile. Interactive controls illuminate on Leo's phone.",
            () => {
              game.current = 1;
              game.turn = 2;
              game.phase = "roll";
              game.pool = [];
              game.history = [];
            },
          );
        },
        () => {
          const p2 = (game && game.players && game.players[1]) || { name: "Leo", avatar: "👻" };
          const avName2 = typeof getPlayerAvatarSpeechName === "function" ? getPlayerAvatarSpeechName(p2) : "piece";
          if (typeof displayFloatingEmote === "function") displayFloatingEmote("🎉", p2.name);
          return demoScene(
            p2.name + " rolls a 1 on mobile and enters their " + avName2 + "! Turn state remains fully synchronized.",
            async () => {
              game.last = {
                a: 0,
                b: 1,
                value: 1,
                val: 1,
                bonus: true,
                specialRoll: true,
              };
              game.pool = [1];
              game.history = [1];
              game.phase = "move";
              await animateScriptedPiece(
                game.players[1],
                game.players[1].pieces[0],
                0,
              );
              game.pool = [];
              game.history = [];
              game.phase = "roll";
            },
          );
        },
        () => {
          if (typeof displayFloatingEmote === "function") {
            displayFloatingEmote("⚡", game.players[0].name);
            setTimeout(() => displayFloatingEmote("😎", game.players[1].name), 500);
          }
          return demoScene(
            "Session tokens protect against disconnects. The online match will now auto-play with live floating reactions!",
            () => {
              game.players.forEach((p) => {
                p.captured = true;
              });
              game.current = 0;
              game.turn = 3;
              game.pool = [];
              game.history = [];
              game.phase = "roll";
            },
          );
        },
      ];

      function stopDemo() {
        if (demoTimer) clearTimeout(demoTimer);
        if (demoSpeechTimer) clearTimeout(demoSpeechTimer);
        if (demoWatchdogTimer) clearTimeout(demoWatchdogTimer);
        if (demoKeepAliveTimer) clearInterval(demoKeepAliveTimer);
        if (realDemoStallDetector) clearInterval(realDemoStallDetector);
        demoTimer = null;
        demoSpeechTimer = null;
        demoWatchdogTimer = null;
        demoKeepAliveTimer = null;
        realDemoStallDetector = null;
        demoSpeechId++;
        demoWaitingForSpeech = false;
        if ("speechSynthesis" in window) speechSynthesis.cancel();
        if (superSpeed || (typeof quantumMode !== "undefined" && quantumMode)) {
          demoSpeed = savedDemoSpeed;
          audioEnabled = savedAudioEnabled;
        }
        demo = false;
        demoPaused = false;
        demoStep = 0;
        superSpeed = false;
        quantumMode = false;
        demoSpeed = 1;
        demoRollQueue = [];
        if (Array.isArray(demoWebSockets) && demoWebSockets.length) {
          demoWebSockets.forEach((ws) => {
            try { ws.close(); } catch (e) {}
          });
          demoWebSockets = [];
        }
        if (typeof multiplayer !== "undefined" && multiplayer.active && (demoMode === "multiplayer" || demoMode === "multiplayer-real" || multiplayer.roomCode === "CF88")) {
          if (typeof leaveMultiplayer === "function") {
            leaveMultiplayer();
          } else {
            multiplayer.active = false;
            multiplayer.isHost = false;
            multiplayer.roomCode = null;
            multiplayer.claimedSeats = {};
            if (typeof updateMultiplayerBadge === "function") updateMultiplayerBadge();
          }
        }
        demoMode = "classic";
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
        game.last = { a: faces[0], b: faces[1], value, val: value, ...bonusResult };
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
        const statusPrefix =
          demoMode === "multiplayer" ? "🌐 Room CF88 · " : "Full guided game · ";
        $("statusTitle").textContent = statusPrefix + "Turn " + game.turn;
        $("statusText").textContent = message;
        speakDemo(message);
        triggerDiceAnimation();
        if (demoMode === "multiplayer" && typeof displayFloatingEmote === "function") {
          if (value === 1 || value === 5 || value === 6 || value === 12) {
            const rollEmotes = ["🔥", "⚡", "🎲", "🎉", "✨"];
            const emote = rollEmotes[Math.floor(Math.random() * rollEmotes.length)];
            displayFloatingEmote(emote, player.name);
          }
        }
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
          const statusPrefix =
            demoMode === "multiplayer" ? "🌐 Room CF88 · " : "Full guided game · ";
          $("statusTitle").textContent = statusPrefix + "Turn " + game.turn;
          $("statusText").textContent = message;
          speakDemo(message);
          return;
        }
        const from = move.piece.progress,
          captures = move.test.targets.length,
          willFinish = move.test.progress === 43;
        await apply(move, "guided-demo");
        demoRollQueue = [];
        const avName =
          typeof getPlayerAvatarSpeechName === "function"
            ? getPlayerAvatarSpeechName(player)
            : "piece";
        let message =
          player.name +
          (from < 0
            ? " enters a " + avName + " and "
            : " moves a " + avName + " ") +
          "using " +
          move.values.join(" + ") +
          ".";
        if (captures) {
          const victim = move.test.targets[0]?.other;
          const victimAv =
            typeof getPlayerAvatarSpeechName === "function"
              ? getPlayerAvatarSpeechName(victim)
              : "piece";
          const victimDesc = victim
            ? victim.name + "’s " + victimAv
            : "An opponent";
          message += " " + victimDesc + " is captured and returns to reserve.";
        }
        if (willFinish)
          message += " That " + avName + " reaches the center and finishes.";
        if (game.phase === "done")
          message =
            player.name +
            " finishes all six pieces, wins the game, and play stops.";
        $("statusTitle").textContent =
          game.phase === "done"
            ? (demoMode === "multiplayer" ? "🌐 Room CF88 complete" : "Full guided game complete")
            : (demoMode === "multiplayer" ? "🌐 Room CF88 · Turn " + game.turn : "Full guided game · Turn " + game.turn);
        $("statusText").textContent = message;
        speakDemo(message);
        if (demoMode === "multiplayer" && typeof displayFloatingEmote === "function") {
          if (captures) {
            const victim = move.test.targets[0]?.other;
            const detail = (player.avatar ? player.avatar + " " : "") + player.name + " captured " + (victim ? (victim.avatar ? victim.avatar + " " : "") + victim.name : "opponent");
            if (typeof showCaptureSplash === "function") {
              const capSquare = ROUTES[player.seat][move.test.progress];
              showCaptureSplash(capSquare, detail);
            }
            if (typeof animateCapturedPiecesToTable === "function") {
              const capSquare = ROUTES[player.seat][move.test.progress];
              animateCapturedPiecesToTable(capSquare, move.test.targets);
            }
            displayFloatingEmote("😎", player.name);
            if (victim) {
              setTimeout(() => displayFloatingEmote("😱", victim.name), 450);
            }
          } else if (willFinish) {
            displayFloatingEmote("🏆", player.name);
          } else if (Math.random() < 0.25) {
            const banter = ["👏", "✨", "🎯", "⚡", "👍"];
            const emote = banter[Math.floor(Math.random() * banter.length)];
            displayFloatingEmote(emote, player.name);
          }
        }
      }
      async function runDemoGameStep() {
        if (game.phase === "done") return;
        if (game.phase === "roll") demoRollAction();
        else await demoMoveAction();
      }
      function updateDemoControls() {
        const complete = game && game.phase === "done",
          available = "speechSynthesis" in window,
          isReal = demoMode === "multiplayer-real",
          currentSteps =
            demoMode === "multiplayer" ? DEMO_STEPS_MULTIPLAYER : DEMO_STEPS,
          opening = !isReal && demoStep < currentSteps.length,
          isQuantum = (typeof quantumMode !== "undefined" && quantumMode) || demoSpeed >= 32,
          isSuper = superSpeed && !isQuantum,
          isFastMuted = isQuantum || isSuper;
        $("demoBar").hidden = !demo;
        $("demoProgress").textContent = complete
          ? (demoMode.startsWith("multiplayer") ? "🌐 Room match complete" : "Full match complete")
          : (demoPaused ? "Paused · " : "") +
            (isReal
              ? "🌐 Cloudflare Live Edge · Room " + (multiplayer.roomCode || "") + " · Turn " + (game ? game.turn : 1)
              : opening
                ? (demoMode === "multiplayer" ? "Multiplayer demo " : "Lesson ") +
                  Math.max(1, demoStep) +
                  " of " +
                  currentSteps.length
                : (demoMode === "multiplayer" ? "🌐 Room CF88 · Turn " + game.turn : "Full game · Turn " + game.turn)) +
            (isQuantum
              ? " · ⚛️ Quantum " + demoSpeed + "× · Audio off"
              : isSuper
                ? " · Super 3× · Audio off"
                : demoSpeed > 1
                  ? " · " + demoSpeed + "×"
                  : "");
        $("demoPause").textContent = demoPaused ? "Resume" : "Pause";
        $("demoPause").disabled = complete;
        $("demoSpeed").value = String(demoSpeed);
        $("demoSpeed").disabled = complete;
        $("demoSpeedValue").value = isQuantum
          ? `⚛️ Quantum ${demoSpeed}×`
          : isSuper
            ? "Super 3×"
            : demoSpeed + "×";
        if ($("demoQuantumSpeed")) {
          $("demoQuantumSpeed").textContent = isQuantum
            ? `⚛️ Quantum ${demoSpeed}× (On)`
            : "⚛️ Quantum 32×";
          $("demoQuantumSpeed").setAttribute("aria-pressed", String(isQuantum));
          $("demoQuantumSpeed").disabled = complete;
        }
        if ($("demoSuperSpeed")) {
          $("demoSuperSpeed").textContent = isSuper
            ? "⚡ Super 3× on"
            : "⚡ Super 3×";
          $("demoSuperSpeed").setAttribute("aria-pressed", String(isSuper));
          $("demoSuperSpeed").disabled = complete || isQuantum;
        }
        $("demoAudioToggle").textContent = available
          ? audioEnabled && !isFastMuted
            ? "🔊 Audio on"
            : "🔇 Audio off"
          : "Audio unavailable";
        $("demoAudioToggle").setAttribute("aria-pressed", String(audioEnabled && !isFastMuted));
        $("demoAudioToggle").disabled = !available || isFastMuted;
      }
      function scheduleDemo(delay = DEMO_DELAY) {
        if (!demo || demoPaused || game.phase === "done") return;
        if (demoTimer) clearTimeout(demoTimer);
        demoTimer = setTimeout(runDemoStep, scaledDemoDelay(delay));
      }
      async function runDemoStep() {
        demoTimer = null;
        if (!demo || demoPaused) return;
        const currentSteps =
          demoMode === "multiplayer" ? DEMO_STEPS_MULTIPLAYER : DEMO_STEPS;
        if (demoStep < currentSteps.length) {
          await currentSteps[demoStep]();
          demoStep++;
        } else await runDemoGameStep();
        updateDemoControls();
        if (game.phase !== "done" && !demoWaitingForSpeech)
          scheduleDemo(demoNextDelay);
      }
      function startGuidedDemo(mode = "classic", playerCount = 2) {
        if (mode === "multiplayer-real") {
          return startRealOnlineDemo(playerCount);
        }
        stopDemo();
        demoMode = mode || "classic";
        demoPlayerCount = Number(playerCount) || 2;
        newGame(demoMode === "multiplayer" ? demoPlayerCount : 2, 0);
        demo = true;
        audit.mode =
          demoMode === "multiplayer" ? "demo-multiplayer-sim" : "demo-classic";
        recordAudit("MODE_CHANGE", {
          mode: audit.mode,
          playerCount: demoPlayerCount,
        });
        demoPaused = false;
        demoStep = 0;
        demoRollQueue = [];

        if (demoMode === "multiplayer") {
          multiplayer.active = true;
          multiplayer.isHost = true;
          multiplayer.roomCode = "CF88";
          multiplayer.transport = "cf_ws";
          multiplayer.status = "connected";
          multiplayer.mySeat = 0;
          multiplayer.roomTargetCount = demoPlayerCount;
          multiplayer.claimedSeats = {};
          if (game && game.players) {
            game.players.forEach((p, idx) => {
              multiplayer.claimedSeats[idx] = {
                name: p.name,
                connected: true,
                isHost: idx === 0,
                device: idx === 0 ? "desktop" : "mobile",
              };
            });
          }
          if (typeof updateMultiplayerBadge === "function") updateMultiplayerBadge();
        } else {
          multiplayer.active = false;
          multiplayer.isHost = false;
          multiplayer.roomCode = null;
          multiplayer.claimedSeats = {};
          if (typeof updateMultiplayerBadge === "function") updateMultiplayerBadge();
        }

        if (typeof FlightRecorder !== "undefined") {
          if (typeof FlightRecorder.recordGameStart === "function") {
            FlightRecorder.recordGameStart({
              mode: demoMode === "multiplayer" ? "demo-multiplayer-sim" : "demo-classic",
              playerCount: demoPlayerCount,
              computerCount: 0,
              roomCode: demoMode === "multiplayer" ? "CF88" : null,
              transport: demoMode === "multiplayer" ? "simulated_cf_ws" : "local",
              seat: 0,
              players: (game && game.players ? game.players : []).map((p) => ({
                id: p.id,
                name: p.name,
                seat: p.seat,
                computer: false,
              })),
              theme: document.body ? document.body.getAttribute("data-theme") || "halloween" : "halloween",
              rulesVariant: "Dhayam 7x7 scripted demo",
            });
          }
        }

        $("demoBar").hidden = false;
        runDemoStep();
      }

      async function startRealOnlineDemo(playerCount = 2) {
        stopDemo();
        demo = true;
        demoMode = "multiplayer-real";
        demoPlayerCount = Number(playerCount) || 2;
        audit.mode = "demo-real-cloudflare";
        recordAudit("MODE_CHANGE", { mode: audit.mode, playerCount: demoPlayerCount });
        demoPaused = false;
        demoStep = 0;
        demoRollQueue = [];
        $("demoBar").hidden = false;

        const cfHost = window.location.host && window.location.host.includes("workers.dev")
          ? window.location.host
          : "dhayam.cancun.workers.dev";
        const wsProtocol = "wss:";
        const roomCode = "CF" + Math.floor(1000 + Math.random() * 9000);

        multiplayer.active = true;
        multiplayer.isHost = true;
        multiplayer.roomCode = roomCode;
        multiplayer.transport = "cf_ws";
        multiplayer.status = "connecting";
        multiplayer.mySeat = 0;
        multiplayer.roomTargetCount = demoPlayerCount;
        multiplayer.claimedSeats = {};
        if (typeof updateMultiplayerBadge === "function") updateMultiplayerBadge();

        const pNames =
          typeof THEMES !== "undefined" && THEMES.length >= 8
            ? THEMES.map((t) => t.name)
            : ["Maya", "Leo", "Amina", "Kai", "Sofia", "Noah", "Zara", "Arun"];
        $("statusTitle").textContent = "Connecting to Cloudflare Edge";
        $("statusText").textContent =
          "Establishing live WebSocket room " + roomCode + " on Cloudflare Durable Objects…";
        speakDemo("Connecting to live Cloudflare Edge room " + roomCode);

        if (typeof FlightRecorder !== "undefined") {
          if (typeof FlightRecorder.recordGameStart === "function") {
            FlightRecorder.recordGameStart({
              mode: "demo-real-cloudflare",
              playerCount: demoPlayerCount,
              computerCount: 0,
              roomCode,
              cfHost,
              transport: "cf_ws",
              seat: 0,
              players: pNames.slice(0, demoPlayerCount).map((name, i) => ({
                id: "P" + i,
                name,
                seat: SEATS[i % 4],
                computer: false,
              })),
              theme: document.body ? document.body.getAttribute("data-theme") || "halloween" : "halloween",
              rulesVariant: "Dhayam 7x7 live Cloudflare Durable Objects multiplayer demo",
            });
          }
        }

        try {
          const wsUrlBase = `${wsProtocol}//${cfHost}/api/room/${roomCode}/ws?code=${roomCode}&players=${demoPlayerCount}`;
          const tokens = [
            "demo-host-" + Math.random().toString(36).slice(2, 8),
            ...Array.from({ length: demoPlayerCount - 1 }, (_, s) => "demo-g-" + (s + 1) + "-" + Math.random().toString(36).slice(2, 8)),
          ];
          demoWebSockets = [];

          function handleRealDemoWsMessage(data, fromSeat) {
            if (!demo || demoMode !== "multiplayer-real") {
              return;
            }

            // CRITICAL RCA FIX: Keepalive PONG messages from the Cloudflare Durable Object
            // must NEVER disarm the turn watchdog or reset timers. In the observed Turn 22 stall,
            // a 20s PONG arrived shortly after a bonus roll, cleared demoWatchdogTimer,
            // and left the game permanently frozen waiting for a server event.
            if (data.type === "PONG") {
              if (typeof FlightRecorder !== "undefined") {
                FlightRecorder.record("PONG", { seat: fromSeat });
              }
              return;
            }

            if (typeof FlightRecorder !== "undefined") {
              FlightRecorder.record("DEMO_WS_RECV", {
                seat: fromSeat,
                type: data.type,
                turn: data.game ? data.game.turn : (game ? game.turn : undefined),
                phase: data.game ? data.game.phase : (game ? game.phase : undefined),
              });
            }

            // Only clear the action watchdog when receiving authoritative state updates
            // (INIT, ROOM_STATE, SYNC_STATE) or an ERROR that triggers turn rescheduling.
            // Never clear watchdog on presentation events (ROLL_START, MOVE_START, EMOTE, PRESENCE).
            if (
              data.type === "INIT" ||
              data.type === "ROOM_STATE" ||
              data.type === "SYNC_STATE" ||
              data.type === "ERROR"
            ) {
              if (demoWatchdogTimer) {
                clearTimeout(demoWatchdogTimer);
                demoWatchdogTimer = null;
              }
              lastRealDemoActionTime = Date.now();
            }

            if (data.type === "INIT" || data.type === "ROOM_STATE" || data.type === "SYNC_STATE") {
              if (data.game) {
                applyRemoteState(data.game, data.audit);
              }
              multiplayer.status = "connected";
              if (data.seats) {
                multiplayer.claimedSeats = data.seats;
              }
              updateMultiplayerBadge();
              updateDemoControls();
              scheduleRealDemoTurn();
            } else if (data.type === "ERROR") {
              console.warn("Real demo WS error on seat", fromSeat, ":", data.message);
              if (typeof FlightRecorder !== "undefined") {
                FlightRecorder.record("DEMO_WS_ERROR", { seat: fromSeat, message: data.message });
              }
              if (game && game.phase !== "done") {
                scheduleRealDemoTurn();
              }
            } else if (data.type === "ROLL_START") {
              setDieFace("dieA", data.dice.a, "First die: " + data.dice.a);
              setDieFace("dieB", data.dice.b, "Second die: " + data.dice.b);
              triggerDiceAnimation();
              if (typeof displayFloatingEmote === "function") {
                const val = data.value || data.val;
                if (val === 1 || val === 5 || val === 6 || val === 12) {
                  displayFloatingEmote("⚡", data.player || "Player");
                }
              }
            } else if (data.type === "MOVE_START") {
              if (data.captures && data.captures.length && typeof displayFloatingEmote === "function") {
                setTimeout(() => displayFloatingEmote("😎", data.player || "Player"), 300);
              }
              if (data.winner && typeof displayFloatingEmote === "function") {
                setTimeout(() => displayFloatingEmote("🏆", data.winner), 500);
              }
            } else if (data.type === "PRESENCE" || data.type === "ROOM_UPDATE") {
              if (data.seats) {
                multiplayer.claimedSeats = data.seats;
              }
              updateMultiplayerBadge();
            } else if (data.type === "EMOTE") {
              if (typeof displayFloatingEmote === "function") {
                displayFloatingEmote(data.emote, data.name || "Opponent");
              }
            }
          }

          function createAndWireSocket(seatIndex) {
            const token = tokens[seatIndex];
            const name = pNames[seatIndex];
            const ws = new WebSocket(`${wsUrlBase}&token=${token}&seat=${seatIndex}`);
            demoWebSockets[seatIndex] = ws;
            if (seatIndex === 0) multiplayer.ws = ws;

            ws.onopen = () => {
              if (typeof FlightRecorder !== "undefined") {
                FlightRecorder.record("DEMO_WS_OPEN", { seat: seatIndex, name, roomCode });
              }
              ws.send(JSON.stringify({ type: "CLAIM_SEAT", seat: seatIndex, name, token }));
              if (seatIndex === 0) {
                multiplayer.status = "connected";
                updateMultiplayerBadge();
                const startMsg = "Live Cloudflare room " + roomCode + " established with " + demoPlayerCount + " players!";
                $("statusTitle").textContent = "🌐 Live Room " + roomCode;
                $("statusText").textContent = startMsg;
                speakDemo(startMsg);
                if (typeof displayFloatingEmote === "function") {
                  setTimeout(() => displayFloatingEmote("🚀", pNames[0]), 500);
                  if (demoPlayerCount > 1) {
                    setTimeout(() => displayFloatingEmote("📱", pNames[1]), 1000);
                  }
                }
                scheduleRealDemoTurn();
              }
            };

            ws.onmessage = async (event) => {
              if (!demo || demoMode !== "multiplayer-real") return;
              try {
                const data = JSON.parse(event.data);
                handleRealDemoWsMessage(data, seatIndex);
              } catch (err) {
                console.warn("Real demo WS parse error:", err);
              }
            };

            ws.onerror = (e) => {
              const errMsg = e && e.message ? e.message : "WebSocket connection error";
              console.warn(`WebSocket error on seat ${seatIndex}:`, errMsg);
              if (typeof FlightRecorder !== "undefined") {
                FlightRecorder.record("DEMO_WS_ERROR", { seat: seatIndex, error: errMsg });
              }
              if (seatIndex === 0 && multiplayer.status === "connecting") {
                console.warn("Live Cloudflare WebSocket failed to connect, falling back to simulated demo");
                startGuidedDemo("multiplayer", demoPlayerCount);
              }
            };

            ws.onclose = (ev) => {
              if (typeof FlightRecorder !== "undefined") {
                FlightRecorder.record("DEMO_WS_CLOSE", { seat: seatIndex, code: ev.code, reason: ev.reason });
              }
              if (demo && demoMode === "multiplayer-real" && game && game.phase !== "done") {
                setTimeout(() => {
                  if (demo && demoMode === "multiplayer-real" && (!demoWebSockets[seatIndex] || demoWebSockets[seatIndex].readyState > 1)) {
                    createAndWireSocket(seatIndex);
                  }
                }, 1500);
              }
            };

            return ws;
          }

          for (let s = 0; s < demoPlayerCount; s++) {
            createAndWireSocket(s);
          }

          // Fan out keepalive PINGs across all active sockets to prevent edge idle timeouts
          if (demoKeepAliveTimer) clearInterval(demoKeepAliveTimer);
          demoKeepAliveTimer = setInterval(() => {
            if (!demo || demoMode !== "multiplayer-real") {
              clearInterval(demoKeepAliveTimer);
              demoKeepAliveTimer = null;
              return;
            }
            demoWebSockets.forEach((ws) => {
              if (ws && ws.readyState === WebSocket.OPEN) {
                try {
                  ws.send(JSON.stringify({ type: "PING" }));
                } catch (e) {}
              }
            });
          }, 20000);

          // Autonomous periodic stall detector (heartbeat guard):
          // If no turn progression occurs for >5 seconds, query DO for state and re-kick turn
          if (realDemoStallDetector) clearInterval(realDemoStallDetector);
          lastRealDemoActionTime = Date.now();
          realDemoStallDetector = setInterval(() => {
            if (!demo || demoMode !== "multiplayer-real" || demoPaused || !game || game.phase === "done") {
              return;
            }
            const idleMs = Date.now() - lastRealDemoActionTime;
            if (idleMs > 5000) {
              lastRealDemoActionTime = Date.now();
              if (typeof FlightRecorder !== "undefined") {
                FlightRecorder.record("DEMO_STALL_RECOVERY", {
                  idleMs,
                  turn: game.turn,
                  phase: game.phase,
                  current: game.current,
                });
              }
              try {
                if (demoWebSockets[0] && demoWebSockets[0].readyState === WebSocket.OPEN) {
                  demoWebSockets[0].send(JSON.stringify({ type: "GET_STATE" }));
                }
              } catch (e) {}
              scheduleRealDemoTurn();
            }
          }, 3000);

        } catch (err) {
          console.warn("Error starting real online demo:", err);
          if (typeof FlightRecorder !== "undefined") {
            FlightRecorder.record("DEMO_START_ERROR", { error: String(err && err.message ? err.message : err) });
          }
          startGuidedDemo("multiplayer", demoPlayerCount);
        }
      }

      function scheduleRealDemoTurn() {
        if (!demo || demoMode !== "multiplayer-real" || demoPaused || !game || game.phase === "done") return;
        if (demoTimer) clearTimeout(demoTimer);
        // Ensure minimum WAN roundtrip pacing floor (160ms) to give Cloudflare DO SQLite storage time to settle
        const delay = Math.max(160, scaledDemoDelay(2200));
        demoTimer = setTimeout(runRealDemoTurnStep, delay);
      }

      async function runRealDemoTurnStep() {
        demoTimer = null;
        if (!demo || demoMode !== "multiplayer-real" || demoPaused || !game || game.phase === "done") return;
        const curSeat = game.current;
        const activeSocket = demoWebSockets[curSeat] || demoWebSockets[0];
        if (!activeSocket || activeSocket.readyState !== WebSocket.OPEN) {
          scheduleRealDemoTurn();
          return;
        }

        const p = game.players[curSeat] || { name: "Player " + (curSeat + 1) };
        let actionSent = false;

        if (game.phase === "roll") {
          try {
            activeSocket.send(JSON.stringify({ type: "ROLL" }));
            actionSent = true;
            $("statusTitle").textContent = "🌐 Room " + (multiplayer.roomCode || "") + " · Turn " + game.turn;
            $("statusText").textContent = p.name + " is rolling via Cloudflare Durable Object…";
            if (typeof FlightRecorder !== "undefined") {
              FlightRecorder.record("DEMO_ACTION_SENT", {
                type: "ROLL",
                seat: curSeat,
                player: p.name,
                turn: game.turn,
                phase: "roll",
              });
            }
          } catch (err) {
            console.warn("Error sending ROLL:", err);
            scheduleRealDemoTurn();
            return;
          }
        } else if (game.phase === "move") {
          const move = bestAutomaticMove();
          if (move) {
            try {
              activeSocket.send(JSON.stringify({
                type: "MOVE",
                pieceId: move.piece.id,
                targetProgress: move.test.progress,
                diceValues: move.values,
              }));
              actionSent = true;
              $("statusTitle").textContent = "🌐 Room " + (multiplayer.roomCode || "") + " · Turn " + game.turn;
              $("statusText").textContent = p.name + " moves a piece using " + move.values.join(" + ") + "…";
              if (typeof FlightRecorder !== "undefined") {
                FlightRecorder.record("DEMO_ACTION_SENT", {
                  type: "MOVE",
                  seat: curSeat,
                  player: p.name,
                  turn: game.turn,
                  pieceId: move.piece.id,
                  targetProgress: move.test.progress,
                  values: move.values,
                });
              }
              if (move.test.targets.length && typeof displayFloatingEmote === "function") {
                setTimeout(() => displayFloatingEmote("😎", p.name), 400);
              }
            } catch (err) {
              console.warn("Error sending MOVE:", err);
              scheduleRealDemoTurn();
              return;
            }
          } else {
            try {
              activeSocket.send(JSON.stringify({ type: "PASS" }));
              actionSent = true;
              if (typeof FlightRecorder !== "undefined") {
                FlightRecorder.record("DEMO_ACTION_SENT", {
                  type: "PASS",
                  seat: curSeat,
                  player: p.name,
                  turn: game.turn,
                });
              }
            } catch (err) {
              console.warn("Error sending PASS:", err);
              scheduleRealDemoTurn();
              return;
            }
          }
        }

        if (actionSent) {
          if (demoWatchdogTimer) clearTimeout(demoWatchdogTimer);
          demoWatchdogTimer = setTimeout(() => {
            demoWatchdogTimer = null;
            if (!demo || demoMode !== "multiplayer-real" || demoPaused || !game || game.phase === "done") return;
            if (typeof FlightRecorder !== "undefined") {
              FlightRecorder.record("DEMO_WATCHDOG_TRIGGER", {
                curSeat,
                turn: game.turn,
                phase: game.phase,
                readyState: activeSocket ? activeSocket.readyState : null,
              });
            }
            try {
              if (demoWebSockets[0] && demoWebSockets[0].readyState === WebSocket.OPEN) {
                demoWebSockets[0].send(JSON.stringify({ type: "GET_STATE" }));
              }
            } catch (e) {}
            scheduleRealDemoTurn();
          }, 6000);
        }

        updateDemoControls();
      }

      function restartGuidedDemo() {
        startGuidedDemo(demoMode, demoPlayerCount);
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
      function toggleQuantumSpeed() {
        if (!demo || game.phase === "done") return;
        if (!quantumMode && demoSpeed < 32) {
          savedDemoSpeed = demoSpeed;
          savedAudioEnabled = audioEnabled;
          quantumMode = true;
          superSpeed = false;
          demoSpeed = typeof QUANTUM_DEMO_SPEED !== "undefined" ? QUANTUM_DEMO_SPEED : 32;
          audioEnabled = false;
          if (demoSpeechTimer) clearTimeout(demoSpeechTimer);
          demoSpeechTimer = null;
          demoSpeechId++;
          demoWaitingForSpeech = false;
          if ("speechSynthesis" in window) speechSynthesis.cancel();
        } else {
          quantumMode = false;
          demoSpeed = savedDemoSpeed >= 32 ? 1 : savedDemoSpeed;
          audioEnabled = savedAudioEnabled;
          if (audioEnabled) speakDemo($("statusText").textContent);
        }
        if (demoTimer) clearTimeout(demoTimer);
        demoTimer = null;
        if (!demoPaused) {
          if (demoMode === "multiplayer-real") scheduleRealDemoTurn();
          else scheduleDemo(100);
        }
        updateAudioToggle();
        updateDemoControls();
      }
      window.toggleQuantumSpeed = toggleQuantumSpeed;

      function toggleSuperSpeed() {
        if (!demo || game.phase === "done") return;
        if (!superSpeed) {
          savedDemoSpeed = demoSpeed;
          savedAudioEnabled = audioEnabled;
          superSpeed = true;
          quantumMode = false;
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
        if (!demoPaused) {
          if (demoMode === "multiplayer-real") scheduleRealDemoTurn();
          else scheduleDemo(450);
        }
        updateAudioToggle();
        updateDemoControls();
      }

      function exitGuidedDemo() {
        newGame(2, 1);
      }
