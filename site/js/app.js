/**
 * app.js - Application Initialization, Modals & Event Bindings
 *
 * Manages modal dialogs (new game, player rename, rules guide), splash welcome screen,
 * keyboard accessibility shortcuts, and initial match bootstrap.
 */
"use strict";

      function newGame(count = 4, computerCount = 0) {
        stopDemo();
        if (rollTimer) clearTimeout(rollTimer);
        if (computerTimer) clearTimeout(computerTimer);
        rollTimer = null;
        computerTimer = null;
        rolling = false;
        moving = false;
        movingPieceId = null;
        capturedPieceIds = [];
        capturedPlayerIds = [];
        if (count < 2 || count > 6)
          throw new RangeError("Dhayam supports 2 to 6 total players");
        const seats =
          count === 2
            ? ["N", "S"]
            : count === 3
              ? ["N", "E", "S"]
              : Array.from({ length: count }, (_, i) => SEATS[i % 4]);
        game = {
          players: seats.map((seat, i) => {
            const theme = THEMES[i];
            return {
              id: "P" + i,
              name: computerCount ? (i === 0 ? "You" : theme.name) : theme.name,
              avatar: theme.avatar,
              color: theme.color,
              computer: i > 0 && i <= computerCount,
              seat,
              captured: false,
              rank: null,
              pieces: Array.from({ length: 6 }, (_, j) => ({
                id: "P" + i + "-" + j,
                progress: -1,
              })),
            };
          }),
          current: 0,
          phase: "roll",
          pool: [],
          history: [],
          last: null,
          turn: 1,
          finished: 0,
          computerCount,
          paused: false,
          // Each player may use one first-round entry allowance. The turn
          // marker prevents an adaptive assist from repeating after a bonus.
          openingEntryPlayers: [],
          pacingAssistTurn: null,
        };
        audit = createAudit(computerCount ? "solo" : "local");
        recordAudit("GAME_START", {
          playerCount: count,
          computerCount,
          rules: "Heritage 7x7 house variant; first-round entry allowances",
        });
        selectedRoll = 0;
        selectedPieceId = null;
        render();
      }

      function showModal(title, html, actionLabel, action) {
        $("modalTitle").textContent = title;
        $("modalContent").innerHTML = html;
        $("modalConfirm").textContent = actionLabel;
        modalAction = action;
        $("modalback").classList.add("open");
      }
      function closeModal() {
        $("modalback").classList.remove("open");
      }
      function openPlayerEditor() {
        const fields = game.players
          .map(
            (player, index) =>
              '<label for="playerName' +
              index +
              '">' +
              player.avatar +
              " Player " +
              (index + 1) +
              '</label><input id="playerName' +
              index +
              '" maxlength="18" value="' +
              escapeHtml(player.name) +
              '">',
          )
          .join("");
        showModal(
          "Rename players",
          "<p>Names apply to this match, commentary, and its game audit.</p>" +
            fields,
          "Save names",
          () => {
            game.players.forEach((player, index) => {
              player.name = cleanPlayerName(
                $("playerName" + index).value,
                player.name,
              );
            });
            recordAudit("PLAYER_NAMES_UPDATED", {
              players: game.players.map((player) => ({
                playerId: player.id,
                playerName: player.name,
              })),
            });
            render();
          },
        );
      }
      const SPLASH_COOKIE = "dhayam_intro_seen";
      function splashWasDismissed() {
        return document.cookie
          .split("; ")
          .some((cookie) => cookie === SPLASH_COOKIE + "=1");
      }
      function closeSplash() {
        if ($("hideSplash").checked)
          document.cookie =
            SPLASH_COOKIE + "=1; Max-Age=31536000; Path=/; SameSite=Lax";
        $("splashback").classList.remove("open");
      }
      $("demoPause").onclick = toggleDemoPause;
      $("demoSuperSpeed").onclick = toggleSuperSpeed;
      $("demoSpeed").oninput = (event) => {
        demoSpeed = Number(event.target.value);
        updateDemoControls();
        if (demoTimer && !demoPaused) {
          clearTimeout(demoTimer);
          demoTimer = null;
          scheduleDemo(demoNextDelay);
        }

      };
      $("demoAudioToggle").onclick = toggleAudio;
      $("audioToggle").onclick = toggleAudio;
      $("copyAuditBtn").onclick = copyGameAudit;
      $("editPlayersBtn").onclick = openPlayerEditor;
      $("demoRestart").onclick = restartGuidedDemo;
      $("demoExit").onclick = exitGuidedDemo;
      $("splashStart").onclick = closeSplash;
      $("modalCancel").onclick = closeModal;
      $("modalConfirm").onclick = () => {
        if (modalAction) modalAction();
        closeModal();
      };
      $("modalback").addEventListener("click", (e) => {
        if (e.target === $("modalback")) closeModal();
      });
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeModal();
      });
      $("newBtn").onclick = () =>
        showModal(
          "Start a new game",
          '<label for="gameMode">Game type</label><select id="gameMode"><option value="solo" selected>Solo vs computers</option><option value="local">Local pass-and-play</option></select><p><strong>Solo:</strong> You play manually. Computer turns roll and move automatically with a natural pause.</p><label for="computerCount">Computer opponents</label><select id="computerCount"><option value="1">1 computer</option><option value="2" selected>2 computers</option><option value="3">3 computers</option><option value="4">4 computers</option><option value="5">5 computers</option></select><div class="divider"></div><label for="localCount">Local players</label><select id="localCount"><option value="2">2 people</option><option value="3">3 people</option><option value="4">4 people</option></select>',
          "Start game",
          () => {
            if ($("gameMode").value === "local")
              newGame(Number($("localCount").value));
            else {
              const computers = Number($("computerCount").value);
              newGame(computers + 1, computers);
            }
          },
        );
      $("resetBtn").onclick = () =>
        showModal(
          "Reset the match?",
          "<p>This clears the current game and its audit. Copy the game audit first if you want to keep it for analysis.</p>",
          "Reset match",
          () => newGame(game.players.length, game.computerCount),
        );
      $("guideBtn").onclick = () =>
        showModal(
          "How to play",
          "<p><strong>1.</strong> Roll two traditional dice. Rolls of 1, 5, 6, or 12 grant another throw.</p><p><strong>2.</strong> Roll a 1 to enter a piece from reserve. During the first round, every player may use any one roll to enter a piece, so the board becomes active immediately.</p><p><strong>3.</strong> The game uses its live audit to keep rounds active. If a whole round would have no move, its final roll is selected from playable outcomes and marked in the audit.</p><p><strong>4.</strong> Land on an unprotected opponent to capture. Floral squares are safe.</p><p><strong>5.</strong> Capture at least once to enter the inward track. Finish all six pieces by exact count.</p>",
          "Got it",
          () => {},
        );
      $("demoBtn").onclick = () =>
        showModal(
          "Automatic guided demo",
          "<p>Watch a complete two-player match play automatically. The opening explains entry and capture, then the game keeps rolling and moving until one player finishes all six pieces and wins.</p><p>The match stops as soon as the winner is declared. You can pause, resume, or restart at any time.</p>",
          "Start demo",
          startGuidedDemo,
        );
      refreshVoices();
      if ("speechSynthesis" in window)
        speechSynthesis.addEventListener("voiceschanged", refreshVoices);
      newGame(4);
      if (!splashWasDismissed()) $("splashback").classList.add("open");
