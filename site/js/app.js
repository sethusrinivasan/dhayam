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
      $("newBtn").onclick = () => {
        const modalHtml =
          '<label for="gameMode">Game type</label>' +
          '<select id="gameMode">' +
          '<option value="solo" selected>Solo vs computers</option>' +
          '<option value="local">Local pass-and-play</option>' +
          '<option value="online-host">🌐 Host online match (P2P)</option>' +
          '<option value="online-join">🔗 Join online match</option>' +
          '</select>' +
          '<div id="modeSoloSection">' +
          '<p><strong>Solo:</strong> You play manually. Computer turns roll and move automatically with a natural pause.</p>' +
          '<label for="computerCount">Computer opponents</label>' +
          '<select id="computerCount"><option value="1">1 computer</option><option value="2" selected>2 computers</option><option value="3">3 computers</option><option value="4">4 computers</option><option value="5">5 computers</option></select>' +
          '</div>' +
          '<div id="modeLocalSection" style="display:none;">' +
          '<label for="localCount">Local players</label>' +
          '<select id="localCount"><option value="2" selected>2 people</option><option value="3">3 people</option><option value="4">4 people</option></select>' +
          '</div>' +
          '<div id="modeHostSection" style="display:none;">' +
          '<p><strong>Host Online:</strong> Creates a WebRTC room. Opponents can join using a 5-letter room code or by scanning a QR code with their phone.</p>' +
          '<label for="onlineCount">Total players</label>' +
          '<select id="onlineCount"><option value="2" selected>2 players</option><option value="3">3 players</option><option value="4">4 players</option></select>' +
          '</div>' +
          '<div id="modeJoinSection" style="display:none;">' +
          '<label for="roomCodeInput">5-Character Room Code</label>' +
          '<input id="roomCodeInput" maxlength="6" placeholder="e.g. H7X2M" style="text-transform:uppercase;font-family:monospace;letter-spacing:2px;font-size:1.1rem;text-align:center;" />' +
          '</div>';

        showModal("Start a new game", modalHtml, "Start match", () => {
          const mode = $("gameMode").value;
          if (mode === "online-host") {
            hostOnlineGame(Number($("onlineCount").value));
          } else if (mode === "online-join") {
            joinOnlineGame($("roomCodeInput").value);
          } else if (mode === "local") {
            leaveMultiplayer();
            newGame(Number($("localCount").value));
          } else {
            leaveMultiplayer();
            const computers = Number($("computerCount").value);
            newGame(computers + 1, computers);
          }
        });

        setTimeout(() => {
          const select = $("gameMode");
          if (!select) return;
          select.onchange = () => {
            const val = select.value;
            $("modeSoloSection").style.display = val === "solo" ? "block" : "none";
            $("modeLocalSection").style.display = val === "local" ? "block" : "none";
            $("modeHostSection").style.display = val === "online-host" ? "block" : "none";
            $("modeJoinSection").style.display = val === "online-join" ? "block" : "none";
          };
        }, 30);
      };
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
      function showQrModal() {
        const url = "https://sethusrinivasan.github.io/dhayam/";
        const content =
          '<div style="text-align:center;display:flex;flex-direction:column;align-items:center;gap:12px;padding:6px 0;">' +
          '<p style="margin:0;font-size:0.95rem;color:#f2dec5;">Scan this QR code with your phone or tablet camera to open and play Dhayam instantly.</p>' +
          '<div style="background:#fff;padding:12px;border-radius:12px;box-shadow:0 6px 18px rgba(0,0,0,0.5);display:inline-block;">' +
          '<img src="assets/qr-dhayam.svg" alt="Dhayam Game QR Code" style="width:180px;height:180px;display:block;" />' +
          '</div>' +
          '<div style="display:flex;gap:8px;align-items:center;justify-content:center;width:100%;max-width:380px;">' +
          '<input type="text" readonly value="' +
          url +
          '" id="qrUrlInput" style="flex:1;padding:6px 10px;font-size:0.85rem;border-radius:6px;border:1px solid #7a4623;background:#27140b;color:#fae4c8;font-family:monospace;text-align:center;" />' +
          '<button id="copyQrLinkBtn" class="pill" style="white-space:nowrap;padding:6px 12px;font-weight:700;">Copy link</button>' +
          '</div>' +
          '<p id="copyQrFeedback" style="margin:0;font-size:0.82rem;color:#a3e635;min-height:1.2em;"></p>' +
          '</div>';
        showModal("📱 Scan & Play on Mobile", content, "Done", () => {});
        setTimeout(() => {
          const copyBtn = $("copyQrLinkBtn");
          const input = $("qrUrlInput");
          const feedback = $("copyQrFeedback");
          if (copyBtn && input) {
            copyBtn.onclick = () => {
              input.select();
              const done = () => {
                if (feedback) feedback.textContent = "✓ Link copied to clipboard!";
                setTimeout(() => {
                  if (feedback) feedback.textContent = "";
                }, 2500);
              };
              if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(url).then(done).catch(() => {
                  document.execCommand("copy");
                  done();
                });
              } else {
                document.execCommand("copy");
                done();
              }
            };
          }
        }, 40);
      }
      if ($("qrBtn")) $("qrBtn").onclick = showQrModal;
      if ($("boardQrBadge")) $("boardQrBadge").onclick = showQrModal;

      function handleDiceRollClick() {
        if (
          game &&
          game.phase === "roll" &&
          !rolling &&
          !moving &&
          !demo &&
          !active().computer
        ) {
          roll();
        }
      }
      const diceContainer = document.querySelector(".dice");
      if (diceContainer) {
        diceContainer.addEventListener("click", handleDiceRollClick);
        diceContainer.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleDiceRollClick();
          }
        });
      }

      refreshVoices();
      if ("speechSynthesis" in window)
        speechSynthesis.addEventListener("voiceschanged", refreshVoices);
      newGame(4);
      if (typeof initMultiplayerFromUrl === "function") {
        initMultiplayerFromUrl();
      }
