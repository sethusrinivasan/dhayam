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
          rules: "Dhayam 7x7 house variant; first-round entry allowances",
        });
        if (typeof FlightRecorder !== "undefined") {
          FlightRecorder.record("GAME_START", {
            playerCount: count,
            computerCount,
            mode: computerCount ? "solo" : "local",
          });
        }
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
      function openSettingsModal() {
        const themeOptions = [
          { id: "halloween", name: "🎃 Halloween (Default)", desc: "Spooky pumpkin night & haunted board" },
          { id: "wood", name: "🪵 Heritage Wood", desc: "Warm teak wood & temple gold" },
          { id: "bronze", name: "🏛️ Royal Bronze", desc: "Ancient stone courtyard & polished copper" },
          { id: "nebula", name: "🌌 Midnight Nebula", desc: "Deep cosmic indigo & starlight" },
        ];

        const themeButtons = themeOptions
          .map(
            (t) =>
              '<button type="button" class="btn secondary theme-choice-btn" data-theme-id="' +
              t.id +
              '" style="width:100%;text-align:left;margin-bottom:6px;padding:8px 12px;' +
              (currentTheme === t.id ? "border-color:#f59e0b;background:#f59e0b2a;box-shadow:0 0 8px #f59e0b44;" : "") +
              '">' +
              '<div style="font-weight:700;font-size:0.88rem;color:#fff1db;">' +
              t.name +
              (currentTheme === t.id ? " ✓ Active" : "") +
              "</div>" +
              '<div style="font-size:0.75rem;color:#cdbda8;">' +
              t.desc +
              "</div>" +
              "</button>",
          )
          .join("");

        const fields = game.players
          .map(
            (player, index) =>
              '<div style="margin-bottom:8px;">' +
              '<label for="playerName' +
              index +
              '" style="display:flex;align-items:center;gap:6px;font-size:0.85rem;color:#f3dfc6;margin-bottom:3px;">' +
              '<span style="background:' +
              player.color +
              ';border-radius:4px;width:18px;height:18px;display:inline-grid;place-items:center;font-size:11px;">' +
              player.avatar +
              "</span>" +
              "Player " +
              (index + 1) +
              " (" +
              escapeHtml(player.name) +
              ")" +
              "</label>" +
              '<input id="playerName' +
              index +
              '" maxlength="18" value="' +
              escapeHtml(player.name) +
              '" style="width:100%;box-sizing:border-box;" />' +
              "</div>",
          )
          .join("");

        const content =
          '<div class="settings-modal-content">' +
          '<h3 style="margin:0 0 6px 0;font-size:0.95rem;color:#ffe6ba;">🎨 Board Theme</h3>' +
          '<p style="font-size:0.8rem;color:#cdbda8;margin:0 0 8px 0;">Switch visual aesthetic. Halloween is the default theme.</p>' +
          themeButtons +
          '<div class="divider" style="margin:12px 0;"></div>' +
          '<h3 style="margin:0 0 6px 0;font-size:0.95rem;color:#ffe6ba;">👥 Player Names</h3>' +
          '<p style="font-size:0.8rem;color:#cdbda8;margin:0 0 8px 0;">Names appear in the match, spoken turns, and the game audit transcript.</p>' +
          fields +
          '<div class="divider" style="margin:12px 0;"></div>' +
          '<h3 style="margin:0 0 6px 0;font-size:0.95rem;color:#ffe6ba;">🔊 Voice Commentary</h3>' +
          '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin:8px 0;">' +
          '<div>' +
          '<strong style="font-size:0.88rem;color:#fff1db;">Spoken Moves & Captures</strong>' +
          '<p style="margin:2px 0 0;font-size:0.78rem;color:#cdbda8;">Speaks rolls, legal moves, and captures aloud.</p>' +
          '</div>' +
          '<button type="button" class="pill" id="settingsAudioBtn" style="padding:6px 12px;font-weight:700;">' +
          (audioEnabled ? "🔊 Enabled" : "🔇 Muted") +
          '</button>' +
          '</div>' +
          '<div class="divider" style="margin:12px 0;"></div>' +
          '<h3 style="margin:0 0 6px 0;font-size:0.95rem;color:#ffe6ba;">🛫 Flight Recorder & Debug Log</h3>' +
          '<p style="font-size:0.78rem;color:#cdbda8;margin:0 0 8px 0;">Captures chronological user clicks, state transitions, touch inputs, timing, and errors. One-click copy for diagnostics.</p>' +
          '<button type="button" class="btn secondary full" id="settingsFlightRecorderBtn" style="width:100%;border-color:#f59e0b88;color:#fcd34d;">🛫 Copy Flight Recorder Data (' +
          (typeof FlightRecorder !== "undefined" ? FlightRecorder.getEventCount() : 0) +
          ' events)</button>' +
          '<p id="settingsFlightFeedback" style="margin:4px 0 0;font-size:0.82rem;color:#a3e635;min-height:1.2em;"></p>' +
          '<div class="divider" style="margin:12px 0;"></div>' +
          '<h3 style="margin:0 0 6px 0;font-size:0.95rem;color:#ffe6ba;">📋 Match Audit & Export</h3>' +
          '<p style="font-size:0.78rem;color:#cdbda8;margin:0 0 8px 0;">Copy the full timestamped JSON audit recording every roll, capture, and state.</p>' +
          '<button type="button" class="btn secondary full" id="settingsCopyAuditBtn" style="width:100%;">📋 Copy Game Audit JSON</button>' +
          '<p id="settingsAuditFeedback" style="margin:4px 0 0;font-size:0.82rem;color:#a3e635;min-height:1.2em;"></p>' +
          '<div class="divider" style="margin:12px 0;"></div>' +
          '<h3 style="margin:0 0 6px 0;font-size:0.95rem;color:#ffe6ba;">↺ Reset Match</h3>' +
          '<button type="button" class="btn secondary full" id="settingsResetBtn" style="width:100%;border-color:#b9434288;color:#ffb3b3;">↺ Reset Current Match</button>' +
          '</div>';

        showModal("⚙️ Match Settings", content, "Save Settings", () => {
          game.players.forEach((player, index) => {
            const input = $("playerName" + index);
            if (input) {
              player.name = cleanPlayerName(input.value, player.name);
            }
          });
          recordAudit("PLAYER_NAMES_UPDATED", {
            players: game.players.map((player) => ({
              playerId: player.id,
              playerName: player.name,
            })),
          });
          render();
        });

        setTimeout(() => {
          const themeBtns = document.querySelectorAll(".theme-choice-btn");
          themeBtns.forEach((btn) => {
            btn.onclick = () => {
              const tid = btn.getAttribute("data-theme-id");
              if (tid && typeof applyTheme === "function") {
                applyTheme(tid);
                themeBtns.forEach((b) => {
                  const bId = b.getAttribute("data-theme-id");
                  const isActive = bId === tid;
                  b.style.borderColor = isActive ? "#f59e0b" : "";
                  b.style.background = isActive ? "#f59e0b2a" : "";
                  b.style.boxShadow = isActive ? "0 0 8px #f59e0b44" : "";
                  const titleDiv = b.querySelector("div:first-child");
                  if (titleDiv) {
                    const opt = themeOptions.find((o) => o.id === bId);
                    if (opt) {
                      titleDiv.textContent = opt.name + (isActive ? " ✓ Active" : "");
                    }
                  }
                });
              }
            };
          });
          const flightBtn = $("settingsFlightRecorderBtn");
          const flightFeedback = $("settingsFlightFeedback");
          if (flightBtn && typeof FlightRecorder !== "undefined") {
            flightBtn.onclick = () => {
              FlightRecorder.copy(flightFeedback);
            };
          }
          const audioBtn = $("settingsAudioBtn");
          if (audioBtn) {
            audioBtn.onclick = () => {
              toggleAudio();
              audioBtn.textContent = audioEnabled ? "🔊 Enabled" : "🔇 Muted";
            };
          }
          const copyBtn = $("settingsCopyAuditBtn");
          const feedback = $("settingsAuditFeedback");
          if (copyBtn) {
            copyBtn.onclick = () => {
              copyGameAudit(feedback);
            };
          }
          const resetBtn = $("settingsResetBtn");
          if (resetBtn) {
            resetBtn.onclick = () => {
              closeModal();
              showModal(
                "Reset Match?",
                "<p>This clears the current match state and begins a fresh board. Copy your audit first if needed.</p>",
                "Confirm Reset",
                () => newGame(game.players.length, game.computerCount),
              );
            };
          }
        }, 40);
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
      if ($("demoAudioToggle")) $("demoAudioToggle").onclick = toggleAudio;
      if ($("audioToggle")) $("audioToggle").onclick = toggleAudio;
      if ($("flightRecorderTopBtn") && typeof FlightRecorder !== "undefined") {
        $("flightRecorderTopBtn").onclick = () => FlightRecorder.copy();
      }
      if ($("settingsBtn")) $("settingsBtn").onclick = openSettingsModal;
      if ($("copyAuditBtn")) $("copyAuditBtn").onclick = copyGameAudit;
      if ($("editPlayersBtn")) $("editPlayersBtn").onclick = openSettingsModal;
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
          '<div class="new-game-modal">' +
            '<div class="ng-tabs">' +
              '<button type="button" class="ng-tab active" id="tabStartGame">🎮 Start New Game</button>' +
              '<button type="button" class="ng-tab" id="tabJoinGame">🔗 Join Multiplayer Game</button>' +
            '</div>' +

            '<!-- Start New Game Pane -->' +
            '<div class="ng-pane" id="paneStartGame">' +
              '<label for="ngMode">Game Mode</label>' +
              '<select id="ngMode">' +
                '<option value="online" selected>🌐 Online Multiplayer (P2P Room + QR Code)</option>' +
                '<option value="solo">🤖 Solo vs Computer</option>' +
                '<option value="local">👥 Local Pass & Play</option>' +
              '</select>' +

              '<div id="ngOnlineHelp" class="ng-help-box">' +
                '<p style="margin:0;font-size:0.84rem;color:#f3dfc6;">' +
                  'Generates a unique <strong>Game Code & QR Code</strong>. Opponents scan the QR code to <strong>auto-join and pick an unassigned player</strong>!' +
                '</p>' +
              '</div>' +

              '<label for="ngPlayers">Total Players</label>' +
              '<select id="ngPlayers">' +
                '<option value="2" selected>2 Players</option>' +
                '<option value="3">3 Players</option>' +
                '<option value="4">4 Players</option>' +
              '</select>' +

              '<div id="ngSoloOpts" style="display:none;">' +
                '<label for="ngAiCount">Computer Opponents</label>' +
                '<select id="ngAiCount">' +
                  '<option value="1">1 Computer</option>' +
                  '<option value="2">2 Computers</option>' +
                  '<option value="3" selected>3 Computers</option>' +
                '</select>' +
              '</div>' +

              '<div class="ng-actions" style="margin-top:16px;">' +
                '<button type="button" class="btn primary" id="btnConfirmStart" style="width:100%;padding:11px;font-size:0.95rem;font-weight:700;">' +
                  '✨ Start Game & Get QR Code' +
                '</button>' +
              '</div>' +
            '</div>' +

            '<!-- Join Existing Game Pane -->' +
            '<div class="ng-pane" id="paneJoinGame" style="display:none;">' +
              '<p style="margin:0 0 12px;font-size:0.86rem;color:#e8d1b8;">' +
                'Enter the 5-character Game Code shared by your host to join their match:' +
              '</p>' +
              '<label for="ngJoinCode">5-Character Game Code</label>' +
              '<input id="ngJoinCode" maxlength="8" placeholder="e.g. H7X2M" style="text-transform:uppercase;font-family:monospace;letter-spacing:3px;font-size:1.3rem;text-align:center;padding:10px;" />' +
              '<div class="ng-actions" style="margin-top:16px;">' +
                '<button type="button" class="btn primary" id="btnConfirmJoin" style="width:100%;padding:11px;font-size:0.95rem;font-weight:700;">' +
                  '🔗 Connect & Pick Player' +
                '</button>' +
              '</div>' +
            '</div>' +
          '</div>';

        showModal("Dhayam Match Setup", modalHtml, "Cancel", () => {});

        setTimeout(() => {
          const tabStart = $("tabStartGame");
          const tabJoin = $("tabJoinGame");
          const paneStart = $("paneStartGame");
          const paneJoin = $("paneJoinGame");
          const modeSelect = $("ngMode");
          const soloOpts = $("ngSoloOpts");
          const onlineHelp = $("ngOnlineHelp");
          const btnStart = $("btnConfirmStart");
          const btnJoin = $("btnConfirmJoin");

          if (tabStart && tabJoin) {
            tabStart.onclick = () => {
              tabStart.classList.add("active");
              tabJoin.classList.remove("active");
              paneStart.style.display = "block";
              paneJoin.style.display = "none";
            };
            tabJoin.onclick = () => {
              tabJoin.classList.add("active");
              tabStart.classList.remove("active");
              paneJoin.style.display = "block";
              paneStart.style.display = "none";
              $("ngJoinCode")?.focus();
            };
          }

          if (modeSelect) {
            modeSelect.onchange = () => {
              const val = modeSelect.value;
              if (onlineHelp) onlineHelp.style.display = val === "online" ? "block" : "none";
              if (soloOpts) soloOpts.style.display = val === "solo" ? "block" : "none";
              if (btnStart) {
                btnStart.textContent =
                  val === "online"
                    ? "✨ Start Game & Get QR Code"
                    : val === "solo"
                      ? "🤖 Start Solo Match"
                      : "👥 Start Local Match";
              }
            };
          }

          if (btnStart) {
            btnStart.onclick = () => {
              const mode = modeSelect?.value || "online";
              const players = Number($("ngPlayers")?.value || 2);
              closeModal();
              if (mode === "online") {
                hostOnlineGame(players);
              } else if (mode === "solo") {
                leaveMultiplayer();
                const aiCount = Number($("ngAiCount")?.value || 1);
                newGame(aiCount + 1, aiCount);
              } else {
                leaveMultiplayer();
                newGame(players, 0);
              }
            };
          }

          if (btnJoin) {
            btnJoin.onclick = () => {
              const code = ($("ngJoinCode")?.value || "").trim();
              if (!code) {
                $("ngJoinCode")?.focus();
                return;
              }
              closeModal();
              joinOnlineGame(code);
            };
          }
        }, 40);
      };
      if ($("resetBtn")) {
        $("resetBtn").onclick = () =>
          showModal(
            "Reset the match?",
            "<p>This clears the current game and its audit. Copy the game audit first if you want to keep it for analysis.</p>",
            "Reset match",
            () => newGame(game.players.length, game.computerCount),
          );
      }
      $("guideBtn").onclick = () =>
        showModal(
          "How to play",
          "<p><strong>1.</strong> Roll two traditional dice. Rolls of 1, 5, 6, or 12 grant another throw.</p><p><strong>2.</strong> Roll a 1 to enter a piece from reserve. During the first round, every player may use any one roll to enter a piece, so the board becomes active immediately.</p><p><strong>3.</strong> The game uses its live audit to keep rounds active. If a whole round would have no move, its final roll is selected from playable outcomes and marked in the audit.</p><p><strong>4.</strong> Land on an unprotected opponent to capture. Floral squares are safe.</p><p><strong>5.</strong> Capture at least once to enter the inward track. Finish all six pieces by exact count.</p>",
          "Got it",
          () => {},
        );
      $("demoBtn").onclick = () => {
        let selectedMode = "multiplayer";
        let selectedCount = 2;

        const content =
          '<div style="display:flex;flex-direction:column;gap:12px;text-align:left;">' +
            '<p style="margin:0 0 4px;font-size:0.88rem;color:#f2dec5;">Choose an interactive guided experience:</p>' +
            '<div class="demo-card selected" id="cardDemoMp" role="button" tabindex="0" style="cursor:pointer;padding:12px 14px;border-radius:10px;border:2px solid #f59e0b;background:#f59e0b1a;transition:all 0.2s ease;">' +
              '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">' +
                '<div style="display:flex;align-items:center;gap:8px;">' +
                  '<span style="font-size:1.3rem;">🌐</span>' +
                  '<strong style="font-size:0.95rem;color:#fcd34d;">Online Multiplayer Simulation</strong>' +
                '</div>' +
                '<span style="background:#f59e0b;color:#180b05;font-weight:700;font-size:0.68rem;padding:2px 8px;border-radius:10px;text-transform:uppercase;letter-spacing:0.5px;">Recommended</span>' +
              '</div>' +
              '<p style="margin:0 0 10px;font-size:0.82rem;color:#f2dec5;line-height:1.4;">' +
                'Simulate a live online match powered by Cloudflare Durable Objects + WebSockets. Watch simulated players join via mobile QR code, synchronize 3D dice rolls across devices, and send live floating emoji banter.' +
              '</p>' +
              '<div style="display:flex;align-items:center;gap:10px;font-size:0.82rem;color:#e2cbb2;" id="demoPcountRow">' +
                '<span>Simulate:</span>' +
                '<div style="display:flex;gap:6px;" id="demoPlayerCountGroup">' +
                  '<button type="button" class="pill demo-pcount-btn" data-count="2" style="padding:3px 10px;font-size:0.8rem;font-weight:700;border-color:#f59e0b;background:#f59e0b44;color:#fff;">2 Players</button>' +
                  '<button type="button" class="pill demo-pcount-btn" data-count="3" style="padding:3px 10px;font-size:0.8rem;font-weight:700;border-color:#7a4623;background:transparent;color:#f2dec5;">3 Players</button>' +
                  '<button type="button" class="pill demo-pcount-btn" data-count="4" style="padding:3px 10px;font-size:0.8rem;font-weight:700;border-color:#7a4623;background:transparent;color:#f2dec5;">4 Players</button>' +
                '</div>' +
              '</div>' +
            '</div>' +
            '<div class="demo-card" id="cardDemoClassic" role="button" tabindex="0" style="cursor:pointer;padding:12px 14px;border-radius:10px;border:1px solid #7a4623;background:#27140b66;transition:all 0.2s ease;">' +
              '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">' +
                '<div style="display:flex;align-items:center;gap:8px;">' +
                  '<span style="font-size:1.3rem;">📖</span>' +
                  '<strong style="font-size:0.95rem;color:#fff1db;">Classic Rules Tutorial</strong>' +
                '</div>' +
                '<span style="border:1px solid #a87d4d;color:#cdbda8;font-size:0.68rem;padding:2px 6px;border-radius:10px;">Tabletop</span>' +
              '</div>' +
              '<p style="margin:0;font-size:0.82rem;color:#cdbda8;line-height:1.4;">' +
                'Traditional 2-player walkthrough explaining piece entry on roll of 1, bonus rolls, board progression, and safe floral squares before auto-playing to victory.' +
              '</p>' +
            '</div>' +
          '</div>';

        showModal(
          "✦ Select Guided Demo",
          content,
          "Start demo",
          () => startGuidedDemo(selectedMode, selectedCount),
        );

        setTimeout(() => {
          const cardMp = $("cardDemoMp");
          const cardClassic = $("cardDemoClassic");
          const countBtns = document.querySelectorAll(".demo-pcount-btn");

          function updateCardSelection() {
            if (selectedMode === "multiplayer") {
              if (cardMp) {
                cardMp.style.borderColor = "#f59e0b";
                cardMp.style.background = "#f59e0b1a";
              }
              if (cardClassic) {
                cardClassic.style.borderColor = "#7a4623";
                cardClassic.style.background = "#27140b66";
              }
            } else {
              if (cardClassic) {
                cardClassic.style.borderColor = "#f59e0b";
                cardClassic.style.background = "#f59e0b1a";
              }
              if (cardMp) {
                cardMp.style.borderColor = "#7a4623";
                cardMp.style.background = "#27140b66";
              }
            }
          }

          if (cardMp) {
            cardMp.onclick = (e) => {
              if (e.target.closest(".demo-pcount-btn")) return;
              selectedMode = "multiplayer";
              updateCardSelection();
            };
          }

          if (cardClassic) {
            cardClassic.onclick = () => {
              selectedMode = "classic";
              updateCardSelection();
            };
          }

          countBtns.forEach((btn) => {
            btn.onclick = (e) => {
              e.stopPropagation();
              selectedMode = "multiplayer";
              selectedCount = parseInt(btn.dataset.count, 10) || 2;
              updateCardSelection();
              countBtns.forEach((b) => {
                const isCur = b === btn;
                b.style.borderColor = isCur ? "#f59e0b" : "#7a4623";
                b.style.background = isCur ? "#f59e0b44" : "transparent";
                b.style.color = isCur ? "#fff" : "#f2dec5";
              });
            };
          });
        }, 40);
      };
      function showQrModal() {
        const url = (typeof multiplayer !== "undefined" && multiplayer.active && multiplayer.roomCode)
          ? getRoomInviteUrl(multiplayer.roomCode)
          : (window.location.origin && window.location.origin !== "null"
              ? window.location.origin + window.location.pathname
              : "https://sethusrinivasan.github.io/dhayam/");

        const qrHtml = typeof generateQrSvg === "function"
          ? generateQrSvg(url, 4, 4)
          : '<img src="assets/qr-dhayam.svg" alt="Dhayam Game QR Code" style="width:180px;height:180px;display:block;" />';

        const content =
          '<div style="text-align:center;display:flex;flex-direction:column;align-items:center;gap:12px;padding:6px 0;">' +
          '<p style="margin:0;font-size:0.95rem;color:#f2dec5;">Scan this QR code with your phone or tablet camera to open and play Dhayam instantly.</p>' +
          '<div style="background:#fff;padding:12px;border-radius:12px;box-shadow:0 6px 18px rgba(0,0,0,0.5);display:inline-block;">' +
          qrHtml +
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
