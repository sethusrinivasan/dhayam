/**
 * app.js - Application Initialization, Modals & Event Bindings
 *
 * Manages modal dialogs (new game, player rename, rules guide), splash welcome screen,
 * keyboard accessibility shortcuts, and initial match bootstrap.
 */
"use strict";

      /**
       * Formats elapsed seconds into MM:SS or HH:MM:SS with second-level granularity.
       * @param {number} totalSeconds - Total integer seconds elapsed.
       * @returns {string} Formatted MM:SS or HH:MM:SS string.
       */
      function formatGameTimer(totalSeconds) {
        const sec = Math.max(0, Math.floor(totalSeconds));
        const hours = Math.floor(sec / 3600);
        const mins = Math.floor((sec % 3600) / 60);
        const secs = sec % 60;
        const mm = String(mins).padStart(2, "0");
        const ss = String(secs).padStart(2, "0");
        if (hours > 0) {
          const hh = String(hours).padStart(2, "0");
          return `${hh}:${mm}:${ss}`;
        }
        return `${mm}:${ss}`;
      }

      /**
       * Updates the liveliness timer pill every 30 seconds.
       * Provides second-level granularity for checking browser page & script liveliness,
       * flashes a pulse highlight to confirm event-loop responsiveness,
       * and appends a HEARTBEAT diagnostic event to FlightRecorder.
       */
      function updateGameTimer() {
        const el = $("gameTimer");
        if (!el) return;
        const elapsedSec = Math.floor((Date.now() - gameStartTime) / 1000);
        const formatted = formatGameTimer(elapsedSec);
        el.textContent = "⏱️ " + formatted;
        el.setAttribute("aria-label", "Game liveliness timer: " + formatted + " elapsed");

        // Visual heartbeat pulse confirming JavaScript event-loop liveliness
        el.classList.remove("pulse");
        void el.offsetWidth;
        el.classList.add("pulse");
        setTimeout(() => {
          if (el) el.classList.remove("pulse");
        }, 800);

        if (typeof FlightRecorder !== "undefined" && typeof FlightRecorder.record === "function") {
          FlightRecorder.record("HEARTBEAT", {
            elapsedSeconds: elapsedSec,
            formatted,
            turn: game ? game.turn : null,
            phase: game ? game.phase : null,
            current: game ? game.current : null,
            demo: Boolean(demo),
            multiplayer: Boolean(multiplayer && multiplayer.active),
          });
        }
      }

      /**
       * Resets the game liveliness timer when a new match begins or on page load.
       */
      function resetGameTimer() {
        gameStartTime = Date.now();
        const el = $("gameTimer");
        if (el) {
          el.textContent = "⏱️ 00:00";
          el.setAttribute("aria-label", "Game liveliness timer: 00:00 elapsed");
          el.classList.remove("pulse");
        }
        if (gameTimerInterval) {
          clearInterval(gameTimerInterval);
        }
        gameTimerInterval = setInterval(updateGameTimer, GAME_TIMER_INTERVAL_MS);
      }

      function newGame(count = 2, computerCount = 1, piecesCount = 6) {
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
        if (typeof resetTurnThinkingTimer === "function") resetTurnThinkingTimer();
        const _maxP = typeof MAX_PLAYERS !== "undefined" ? MAX_PLAYERS : 32;
        const _minP = typeof MIN_PLAYERS !== "undefined" ? MIN_PLAYERS : 2;
        if (count < _minP || count > _maxP)
          throw new RangeError("Dhayam supports " + _minP + " to " + _maxP + " total players");
        const pieceTotal = Math.max(1, Math.min(6, parseInt(piecesCount || 6, 10)));
        const BASE_SEATS = ["N", "E", "S", "W"];
        const seats =
          count === 2
            ? ["N", "S"]
            : count === 3
              ? ["N", "E", "S"]
              : Array.from({ length: count }, (_, i) => BASE_SEATS[i % BASE_SEATS.length]);
        const chosenPersonaNames = [];
        game = {
          players: seats.map((seat, i) => {
            const theme = THEMES[i % THEMES.length];
            const isComputer = i > 0 && i <= computerCount;
            let persona = null;
            let pName = theme.name;
            let pAvatar = theme.avatar;
            let pColor = theme.color;

            if (isComputer && typeof getRandomComputerPersona === "function") {
              persona = getRandomComputerPersona(chosenPersonaNames);
              if (persona) {
                pName = persona.name;
                pAvatar = persona.avatar;
                pColor = persona.color;
                chosenPersonaNames.push(persona.name);
              }
            } else if (i === 0 && computerCount) {
              pName = "You";
            }

            return {
              id: "P" + i,
              name: pName,
              avatar: pAvatar,
              color: pColor,
              computer: isComputer,
              persona,
              seat,
              captured: false,
              rank: null,
              bonusPoints: 0,
              pieces: Array.from({ length: pieceTotal }, (_, j) => ({
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
          if (typeof FlightRecorder.recordGameStart === "function") {
            FlightRecorder.recordGameStart({
              mode: computerCount ? "solo" : "local",
              playerCount: count,
              computerCount,
              roomCode: null,
              transport: "local",
              seat: 0,
              players: game.players.map((p) => ({
                id: p.id,
                name: p.name,
                avatar: p.avatar,
                color: p.color,
                computer: p.computer,
                seat: p.seat,
              })),
              theme: document.body ? document.body.getAttribute("data-theme") || "diwali" : "diwali",
              rulesVariant: "Dhayam 7x7 house variant; first-round entry allowances",
            });
          } else {
            FlightRecorder.record("GAME_START", {
              playerCount: count,
              computerCount,
              mode: computerCount ? "solo" : "local",
            });
          }
        }
        selectedRoll = 0;
        selectedPieceId = null;
        resetGameTimer();
        render();
      }

      function showModal(title, html, actionLabel, action) {
        $("modalTitle").textContent = title;
        $("modalContent").innerHTML = html;
        $("modalConfirm").textContent = actionLabel;
        $("modalConfirm").style.display = "";
        modalAction = action;
        $("modalback").classList.add("open");
      }
      function closeModal() {
        $("modalback").classList.remove("open");
        $("modalConfirm").style.display = "";
        $("modalCancel").textContent = "Close";
      }

      function requestWithdrawal() {
        const isSignedIn = typeof DhayamAuth !== "undefined" && Boolean(DhayamAuth.getCurrentUser());
        if (!isSignedIn) {
          const isTamil = typeof getLanguage === "function" && getLanguage() === "ta";
          showModal(
            isTamil ? "\u0bb5\u0bbf\u0bb2\u0b95\u0bb2\u0bcd \u0b95\u0b9f\u0bcd\u0b9f\u0bc1\u0baa\u0bcd\u0baa\u0bbe\u0b9f\u0bc1" : "Withdrawal Restricted",
            "<p style='text-align:center;'>" +
              (isTamil
                ? "\u0b89\u0bb3\u0bcd\u0ba8\u0bc1\u0bb4\u0bc8\u0ba8\u0bcd\u0ba4 \u0bb5\u0bc0\u0bb0\u0bb0\u0bcd\u0b95\u0bb3\u0bcd \u0bae\u0b9f\u0bcd\u0b9f\u0bc1\u0bae\u0bc7 \u0baa\u0bc1\u0bb3\u0bcd\u0bb3\u0bbf\u0b95\u0bcd \u0b95\u0bc1\u0bb1\u0bc8\u0baa\u0bcd\u0baa\u0bc1\u0b9f\u0ba9\u0bcd \u0bb5\u0bbf\u0bb2\u0b95 \u0bae\u0bc1\u0b9f\u0bbf\u0baf\u0bc1\u0bae\u0bcd. \u0b89\u0b99\u0bcd\u0b95\u0bb3\u0bcd \u0baa\u0ba4\u0bbf\u0bb5\u0bc1\u0b95\u0bb3\u0bc8 \u0b87\u0ba3\u0bc8\u0b95\u0bcd\u0b95 \u0ba4\u0baf\u0bb5\u0bc1\u0b9a\u0bc6\u0baf\u0bcd\u0ba4\u0bc1 \u0b89\u0bb3\u0bcd\u0ba8\u0bc1\u0bb4\u0bc8\u0baf\u0bb5\u0bc1\u0bae\u0bcd."
                : "Only signed-in players can withdraw with profile score reduction. Please sign in to link your game records and standings.") +
              "</p>",
            isTamil ? "\u0b89\u0bb3\u0bcd\u0ba8\u0bc1\u0bb4\u0bc8\u0b95" : "Sign In",
            () => {
              if (typeof DhayamAuth !== "undefined") DhayamAuth.openAuthModal();
            }
          );
          return;
        }

        if (!game || game.phase === "done" || (typeof demo !== "undefined" && demo)) return;

        const isTamil = typeof getLanguage === "function" && getLanguage() === "ta";
        const currentStats = (typeof DhayamAuth !== "undefined" && DhayamAuth.getCurrentStats()) ? DhayamAuth.getCurrentStats() : null;
        const currentScore = currentStats ? (currentStats.total_score || 0) : 0;
        const newScore = currentScore - 100;

        const titleText = isTamil
          ? "\ud83c\udff3\ufe0f \u0baa\u0bcb\u0b9f\u0bcd\u0b9f\u0bbf\u0baf\u0bbf\u0bb2\u0bbf\u0bb0\u0bc1\u0ba8\u0bcd\u0ba4\u0bc1 \u0bb5\u0bbf\u0bb2\u0b95 \u0bb5\u0bc7\u0ba3\u0bcd\u0b9f\u0bc1\u0bae\u0bbe?"
          : "🏳️ Withdraw from Match?";
        const confirmLabel = isTamil
          ? "\u0bb5\u0bbf\u0bb2\u0b95\u0bb2\u0bc8 \u0b89\u0bb1\u0bc1\u0ba4\u0bbf \u0b9a\u0bc6\u0baf\u0bcd (-100 \u0baa\u0bc1\u0bb3\u0bcd\u0bb3\u0bbf\u0b95\u0bb3\u0bcd)"
          : "Confirm Withdrawal (-100 pts)";

        const modalHtml =
          '<div class="withdraw-confirm-panel" style="text-align:center;padding:12px 6px;">' +
            '<div style="font-size:3rem;margin-bottom:8px;">🏳️</div>' +
            '<p style="font-size:1.05rem;color:#fde68a;font-weight:700;margin-bottom:12px;">' +
              (isTamil
                ? "\u0baa\u0bcb\u0b9f\u0bcd\u0b9f\u0bbf\u0baf\u0bbf\u0bb2\u0bbf\u0bb0\u0bc1\u0ba8\u0bcd\u0ba4\u0bc1 \u0bb5\u0bbf\u0bb2\u0b95 \u0b89\u0bb1\u0bc1\u0ba4\u0bbf\u0baf\u0bbe\u0b95 \u0bb5\u0bbf\u0bb0\u0bc1\u0bae\u0bcd\u0baa\u0bc1\u0b95\u0bbf\u0bb1\u0bc0\u0bb0\u0bcd\u0b95\u0bb3\u0bbe?"
                : "Are you sure you want to forfeit this game?") +
            '</p>' +
            '<div style="background:rgba(239,68,68,0.15);border:1px solid #ef444488;border-radius:8px;padding:12px;margin:0 auto 16px;max-width:340px;text-align:left;">' +
              '<div style="color:#f87171;font-weight:700;font-size:14px;margin-bottom:4px;">⚠️ Profile Penalty: -100 Points</div>' +
              '<div style="font-size:12px;color:#fca5a5;line-height:1.4;">' +
                (isTamil
                  ? "\u0baa\u0bcb\u0b9f\u0bcd\u0b9f\u0bbf\u0baf\u0bc8 \u0b95\u0bc8\u0bb5\u0bbf\u0b9f\u0bcd\u0b9f\u0bbe\u0bb2\u0bcd \u0b89\u0b99\u0bcd\u0b95\u0bb3\u0bcd \u0baa\u0ba4\u0bbf\u0bb5\u0bbf\u0bb2\u0bbf\u0bb0\u0bc1\u0ba8\u0bcd\u0ba4\u0bc1 100 \u0baa\u0bc1\u0bb3\u0bcd\u0bb3\u0bbf\u0b95\u0bb3\u0bcd \u0b95\u0bc1\u0bb1\u0bc8\u0b95\u0bcd\u0b95\u0baa\u0bcd\u0baa\u0b9f\u0bc1\u0bae\u0bcd (-100 \u0baa\u0bc1\u0bb3\u0bcd\u0bb3\u0bbf\u0b95\u0bb3\u0bcd)."
                  : "Withdrawing will end this match immediately and deduct <strong>100 points</strong> from your profile score and leaderboard standing.") +
              '</div>' +
              '<div style="margin-top:10px;padding-top:8px;border-top:1px solid rgba(239,68,68,0.3);font-size:12px;color:#e2e8f0;display:flex;justify-content:space-between;">' +
                '<span>Current Score: <strong>' + currentScore + ' pts</strong></span>' +
                '<span>New Score: <strong style="color:#f87171;">' + newScore + ' pts</strong></span>' +
              '</div>' +
            '</div>' +
          '</div>';

        showModal(
          titleText,
          modalHtml,
          confirmLabel,
          () => {
            executeWithdrawal();
          }
        );
      }

      function executeWithdrawal() {
        if (!game || game.phase === "done") return;

        if (typeof resetTurnThinkingTimer === "function") resetTurnThinkingTimer();
        if (rollTimer) clearTimeout(rollTimer);
        if (computerTimer) clearTimeout(computerTimer);
        rollTimer = null;
        computerTimer = null;
        rolling = false;
        moving = false;

        const isTamil = typeof getLanguage === "function" && getLanguage() === "ta";

        // Audit & telemetry
        recordAudit("PLAYER_WITHDREW", {
          player: game?.players?.[0]?.name || "You",
          penalty: -100,
          turn: game ? game.turn : 1
        });
        if (typeof FlightRecorder !== "undefined" && typeof FlightRecorder.record === "function") {
          FlightRecorder.record("PLAYER_WITHDREW", { penalty: -100, turn: game ? game.turn : 1 });
        }

        game.phase = "done";

        if (typeof DhayamAuth !== "undefined" && typeof DhayamAuth.onGameWithdrawal === "function") {
          DhayamAuth.onGameWithdrawal();
        }

        render();

        setTimeout(() => {
          const updatedScore = (typeof DhayamAuth !== "undefined" && DhayamAuth.getCurrentStats())
            ? (DhayamAuth.getCurrentStats().total_score || 0)
            : 0;

          showModal(
            isTamil ? "\ud83c\udff3\ufe0f \u0baa\u0bcb\u0b9f\u0bcd\u0b9f\u0bbf \u0b95\u0bc8\u0bb5\u0bbf\u0b9f\u0baa\u0bcd\u0baa\u0b9f\u0bcd\u0b9f\u0ba4\u0bc1" : "🏳️ Match Forfeited",
            '<div style="text-align:center;padding:12px 6px;">' +
              '<div style="font-size:3rem;margin-bottom:8px;">🏳️</div>' +
              '<p style="font-size:1.1rem;color:#fca5a5;font-weight:700;">' +
                (isTamil ? "\u0ba8\u0bc0\u0b99\u0bcd\u0b95\u0bb3\u0bcd \u0baa\u0bcb\u0b9f\u0bcd\u0b9f\u0bbf\u0baf\u0bbf\u0bb2\u0bbf\u0bb0\u0bc1\u0ba8\u0bcd\u0ba4\u0bc1 \u0bb5\u0bbf\u0bb2\u0b95\u0bbf\u0ba9\u0bc0\u0bb0\u0bcd\u0b95\u0bb3\u0bcd." : "You withdrew from the match.") +
              '</p>' +
              '<p style="color:#e2e8f0;font-size:14px;margin-top:6px;">' +
                (isTamil
                  ? "100 \u0baa\u0bc1\u0bb3\u0bcd\u0bb3\u0bbf\u0b95\u0bb3\u0bcd \u0b95\u0bc1\u0bb1\u0bc8\u0b95\u0bcd\u0b95\u0baa\u0bcd\u0baa\u0b9f\u0bcd\u0b9f\u0ba9. \u0ba4\u0bb1\u0bcd\u0baa\u0bcb\u0ba4\u0bc8\u0baf \u0baa\u0bc1\u0bb3\u0bcd\u0bb3\u0bbf: "
                  : "A <strong>-100 point penalty</strong> has been applied to your profile.<br>Updated Score: ") +
                '<strong>' + updatedScore + ' pts</strong>' +
              '</p>' +
            '</div>',
            isTamil ? "\u0baa\u0bc1\u0ba4\u0bbf\u0baf \u0b86\u0b9f\u0bcd\u0b9f\u0bae\u0bcd" : "⚔️ Start New Match",
            () => {
              if (typeof newGame === "function") newGame(game ? game.players.length : 2, game ? game.computerCount : 1);
            }
          );
        }, 150);
      }
      window.requestWithdrawal = requestWithdrawal;
      window.executeWithdrawal = executeWithdrawal;
      function openShareModal() {
        let shareUrl = window.location.href.split("#")[0];
        if (!shareUrl.startsWith("http://") && !shareUrl.startsWith("https://") || shareUrl.includes("localhost") || shareUrl.includes("127.0.0.1")) {
          shareUrl = "https://sethusrinivasan.github.io/dhayam/";
        }
        const shareTitle = "🪔 Dhayam — Ancient Tamil Board Game";
        const shareCaption = "🎲 Roll the brass dice. Strike rivals and race to victory in Dhayam — the ancient Tamil strategy game!";
        const shareText = `${shareCaption}\nPlay now: ${shareUrl}`;
        const shareMessage = shareText;
        const encodedText = encodeURIComponent(shareCaption);
        const encodedMessage = encodeURIComponent(shareMessage);
        const encodedUrl = encodeURIComponent(shareUrl);
        const preview = escapeHtml(`${shareTitle}\n\n${shareText}`);

        showModal(
          "Share Dhayam",
          '<div class="share-modal-content">' +
            '<p class="share-intro">Preview the message and choose where to share it.</p>' +
            '<div class="share-preview" aria-label="Share preview">' +
              '<img class="share-preview-image" src="assets/preview.png" alt="Dhayam ancient Tamil board game" />' +
              '<strong>' + escapeHtml(shareTitle) + '</strong>' +
              '<p>' + escapeHtml(shareText).replace(/\n/g, "<br>") + '</p>' +
            '</div>' +
            '<div class="share-actions" aria-label="Social sharing options">' +
              '<button type="button" class="btn share-action share-whatsapp" data-share-url="https://wa.me/?text=' + encodedMessage + '">💬 WhatsApp</button>' +
              '<button type="button" class="btn share-action share-facebook" data-share-url="https://www.facebook.com/sharer/sharer.php?u=' + encodedUrl + '">📘 Facebook</button>' +
              '<button type="button" class="btn share-action share-x" data-share-url="https://twitter.com/intent/tweet?text=' + encodedText + '&url=' + encodedUrl + '">𝕏 Twitter / X</button>' +
              '<button type="button" class="btn share-action share-instagram" id="shareInstagramBtn">📷 Instagram</button>' +
            '</div>' +
            '<div class="share-secondary-actions">' +
              '<button type="button" class="btn secondary" id="nativeShareBtn">📤 Share from device</button>' +
              '<button type="button" class="btn secondary" id="copyShareTextBtn">📋 Copy text</button>' +
              '<button type="button" class="btn secondary" id="shareFeedbackBtn">💬 Send feedback</button>' +
            '</div>' +
            '<p class="share-note" id="shareFeedback" aria-live="polite">Instagram does not support prefilled web posts, so its button copies the preview and opens Instagram.</p>' +
            '<textarea class="share-copy-source" aria-hidden="true" tabindex="-1">' + preview + '</textarea>' +
          '</div>',
          "Close",
          () => {},
        );
        $("modalConfirm").style.display = "none";
        $("modalCancel").textContent = "Done";

        const feedback = $("shareFeedback");
        const setFeedback = (message) => {
          if (feedback) feedback.textContent = message;
        };
        const copyShareText = async (message = shareMessage) => {
          try {
            await navigator.clipboard.writeText(message);
          } catch {
            const source = $("shareCopyTextBtn");
            const textarea = document.createElement("textarea");
            textarea.value = message;
            textarea.style.position = "fixed";
            textarea.style.opacity = "0";
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand("copy");
            textarea.remove();
            void source;
          }
          setFeedback("✓ Share text copied to your clipboard.");
        };
        document.querySelectorAll("[data-share-url]").forEach((button) => {
          button.onclick = () => {
            window.open(button.dataset.shareUrl, "_blank", "noopener,noreferrer");
          };
        });
        $("shareInstagramBtn").onclick = async () => {
          await copyShareText();
          window.open("https://www.instagram.com/", "_blank", "noopener,noreferrer");
        };
        $("copyShareTextBtn").onclick = () => copyShareText();
        const shareFeedbackBtn = $("shareFeedbackBtn");
        if (shareFeedbackBtn) {
          shareFeedbackBtn.onclick = () => {
            $("modalCancel")?.click();
            if (window.DhayamAuth && typeof window.DhayamAuth.openFeedbackModal === "function") {
              window.DhayamAuth.openFeedbackModal();
            }
          };
        }
        $("nativeShareBtn").onclick = async () => {
          if (!navigator.share) {
            setFeedback("Device sharing is unavailable here. Use a social button or copy the text.");
            return;
          }
          try {
            await navigator.share({ title: shareTitle, text: shareText, url: shareUrl });
            setFeedback("✓ Share sheet opened.");
          } catch (error) {
            if (error?.name !== "AbortError") {
              setFeedback("Device sharing was unavailable. Use a social button or copy the text.");
            }
          }
        };
      }
      function openSettingsModal() {
        const themeOptions = [
          { id: "diwali", name: "🪔 Diwali", desc: "Festival lights, marigold gold & rangoli color" },
          { id: "halloween", name: "🎃 Halloween", desc: "Spooky pumpkin night & haunted board" },
          { id: "christmas", name: "🎄 Christmas", desc: "Evergreen, winter lights & festive red" },
          { id: "hanukkah", name: "🕎 Hanukkah", desc: "Blue, silver & menorah candlelight" },
          { id: "wood", name: "🪵 Heritage Wood", desc: "Warm teak wood & temple gold" },
          { id: "bronze", name: "🏛️ Royal Bronze", desc: "Ancient stone courtyard & polished copper" },
          { id: "nebula", name: "🌌 Midnight Nebula", desc: "Deep cosmic indigo & starlight" },
          { id: "newyear", name: "🎆 New Year", desc: "Midnight fireworks, neon & celebration" },
          { id: "pongal", name: "🌾 Pongal", desc: "Harvest sun, sugarcane & Tamil kolam color" },
          { id: "dasara", name: "🏵️ Dasara", desc: "Mysuru gold, marigolds & victory colors" },
          { id: "holi", name: "🎨 Holi", desc: "Spring colors, joy & playful powder" },
          { id: "eid", name: "🌙 Eid", desc: "Crescent moon, emerald & lantern light" },
          { id: "wallstreet", name: "📈 Wall Street", desc: "Ticker green, market gold & trading floor energy" },
          { id: "elections", name: "🗳️ US Elections", desc: "Civic blue, campaign red & ballot-day gold" },
        ];

        const themeChoices = themeOptions
          .map(
            (t) =>
              '<option value="' +
              t.id +
              '"' +
              (currentTheme === t.id ? " selected" : "") +
              ">" +
              t.name +
              " — " +
              t.desc +
              "</option>",
          )
          .join("");

        const fields = game.players
          .map(
            (player, index) =>
              '<div class="settings-player">' +
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

        const curLang = typeof getLanguage === "function" ? getLanguage() : "en";
        const content =
          '<div class="settings-modal-content">' +
          '<section class="settings-section">' +
          '<h3 class="settings-heading">🌐 Language / \u0bae\u0bca\u0bb4\u0bbf</h3>' +
          '<label class="settings-theme-label" for="settingsLanguage">Game language and voice commentary</label>' +
          '<select id="settingsLanguage" class="settings-theme-select">' +
          '<option value="en"' + (curLang === "en" ? " selected" : "") + '>English (English audio & interface)</option>' +
          '<option value="ta"' + (curLang === "ta" ? " selected" : "") + '>\u0ba4\u0bae\u0bbf\u0bb4\u0bcd (Tamil audio & interface)</option>' +
          '</select>' +
          '</section>' +
          '<section class="settings-section">' +
          '<h3 class="settings-heading">🎨 Board theme</h3>' +
          '<label class="settings-theme-label" for="settingsTheme">Choose a board theme</label>' +
          '<select id="settingsTheme" class="settings-theme-select">' +
          themeChoices +
          '</select>' +
          '</section>' +
          '<section class="settings-section">' +
          '<h3 class="settings-heading">🔐 Roll secret</h3>' +
          '<p class="settings-help">Optional, hidden from the audit, and mixed into cryptographic randomness without changing dice odds.</p>' +
          '<label class="settings-theme-label" for="rollSecret">Secret text (up to 8 characters)</label>' +
          '<input id="rollSecret" type="password" maxlength="8" autocomplete="off" value="' +
          escapeHtml(typeof rollSecret === "string" ? rollSecret : "") +
          '" />' +
          '</section>' +
          '<section class="settings-section">' +
          '<h3 class="settings-heading">👥 Player names</h3>' +
          '<p class="settings-help">Names appear in the match, commentary, and audit.</p>' +
          '<div class="settings-player-grid">' +
          fields +
          '</div>' +
          '</section>' +
          '<section class="settings-section settings-tools">' +
          '<h3 class="settings-heading">Tools</h3>' +
          '<div class="settings-tool-row">' +
          '<div><strong>🔊 Voice commentary</strong><span>Spoken rolls, moves, and captures</span></div>' +
          '<button type="button" class="pill" id="settingsAudioBtn">' +
          (audioEnabled ? "🔊 Enabled" : "🔇 Muted") +
          '</button>' +
          '</div>' +
          '<div class="settings-tool-grid">' +
          '<button type="button" class="btn secondary settings-tool" id="settingsFlightRecorderBtn">🛫 Copy diagnostics (' +
          (typeof FlightRecorder !== "undefined" ? FlightRecorder.getEventCount() : 0) +
          ' events)</button>' +
          '<button type="button" class="btn secondary settings-tool" id="settingsCopyAuditBtn">📋 Copy game audit</button>' +
          '<button type="button" class="btn secondary settings-tool settings-danger" id="settingsResetBtn">↺ Reset match</button>' +
          '</div>' +
          '<p id="settingsFlightFeedback" class="settings-feedback"></p>' +
          '<p id="settingsAuditFeedback" class="settings-feedback"></p>' +
          '</section>';

        showModal("⚙️ Match Settings", content, "Save Settings", () => {
          const langSelect = $("settingsLanguage");
          if (langSelect && typeof setLanguage === "function" && langSelect.value !== getLanguage()) {
            setLanguage(langSelect.value);
          }
          const secretInput = $("rollSecret");
          if (secretInput && typeof setRollSecret === "function") {
            setRollSecret(secretInput.value);
          }
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
          const langSelect = $("settingsLanguage");
          if (langSelect && typeof setLanguage === "function") {
            langSelect.onchange = () => {
              setLanguage(langSelect.value);
            };
          }
          const themeSelect = $("settingsTheme");
          if (themeSelect) {
            themeSelect.onchange = () => {
              if (typeof applyTheme === "function") {
                applyTheme(themeSelect.value);
              }
            };
          }
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
      if ($("demoQuantumSpeed")) $("demoQuantumSpeed").onclick = toggleQuantumSpeed;
      if ($("demoSuperSpeed")) $("demoSuperSpeed").onclick = toggleSuperSpeed;
      $("demoSpeed").oninput = (event) => {
        const val = Number(event.target.value);
        demoSpeed = Math.max(0.5, Math.min(val, typeof MAX_DEMO_SPEED !== "undefined" ? MAX_DEMO_SPEED : 128));
        if (demoSpeed >= 32) {
          quantumMode = true;
          superSpeed = false;
          if (audioEnabled) {
            savedAudioEnabled = audioEnabled;
            audioEnabled = false;
          }
          if ("speechSynthesis" in window) speechSynthesis.cancel();
          if (demoSpeechTimer) {
            clearTimeout(demoSpeechTimer);
            demoSpeechTimer = null;
          }
          demoWaitingForSpeech = false;
        } else {
          quantumMode = false;
          superSpeed = demoSpeed === SUPER_DEMO_SPEED;
        }
        updateDemoControls();
        updateAudioToggle();
        if (demoTimer && !demoPaused) {
          clearTimeout(demoTimer);
          demoTimer = null;
          if (typeof demoMode !== "undefined" && demoMode === "multiplayer-real") {
            scheduleRealDemoTurn();
          } else {
            scheduleDemo(demoNextDelay);
          }
        }
      };
      if ($("demoAudioToggle")) $("demoAudioToggle").onclick = toggleAudio;
      if ($("langToggle") && typeof toggleLanguage === "function") {
        $("langToggle").onclick = toggleLanguage;
      }
      if ($("audioToggle")) $("audioToggle").onclick = toggleAudio;
      if ($("voiceToggle") && typeof toggleVoiceCommands === "function") {
        $("voiceToggle").onclick = toggleVoiceCommands;
      }
      if ($("keyboardHelpBtn") && typeof showKeyboardHelpModal === "function") {
        $("keyboardHelpBtn").onclick = showKeyboardHelpModal;
      }
      if ($("flightRecorderTopBtn") && typeof FlightRecorder !== "undefined") {
        $("flightRecorderTopBtn").onclick = () => FlightRecorder.copy();
      }
      if ($("copyGameSummaryBtn")) $("copyGameSummaryBtn").onclick = copyGameSummary;
      if ($("copyTurnDetailsBtn")) $("copyTurnDetailsBtn").onclick = copyTurnDetails;
      if ($("shareBtn")) {
        $("shareBtn").addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          openShareModal();
          const menu = $("shareBtn").closest("details");
          if (menu) menu.removeAttribute("open");
        });
      }
      const actionMenu = document.querySelector(".action-menu");
      if (actionMenu) {
        actionMenu.addEventListener("click", (event) => {
          if (event.target.closest(".menu-item")) {
            actionMenu.removeAttribute("open");
          }
        });
      }
      if ($("settingsBtn")) $("settingsBtn").onclick = openSettingsModal;
      if ($("withdrawBtn")) $("withdrawBtn").onclick = requestWithdrawal;
      if ($("menuWithdrawBtn")) $("menuWithdrawBtn").onclick = requestWithdrawal;
      if ($("copyAuditBtn")) $("copyAuditBtn").onclick = copyGameAudit;
      if ($("editPlayersBtn")) $("editPlayersBtn").onclick = openSettingsModal;
      $("demoRestart").onclick = restartGuidedDemo;
      $("demoExit").onclick = exitGuidedDemo;
      const demoPiecesSelect = $("demoPiecesSelect");
      if (demoPiecesSelect) {
        demoPiecesSelect.onchange = () => {
          const val = parseInt(demoPiecesSelect.value, 10) || 6;
          if (typeof setDemoPiecesCount === "function") setDemoPiecesCount(val);
          if (typeof restartGuidedDemo === "function") restartGuidedDemo();
        };
      }
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
                '<option value="solo" selected>🤖 Solo vs Computer</option>' +
                '<option value="online">🌐 Online Multiplayer (P2P Room + QR Code)</option>' +
                '<option value="local">👥 Local Pass & Play</option>' +
              '</select>' +

              '<div id="ngOnlineHelp" class="ng-help-box" style="display:none;">' +
                '<p style="margin:0;font-size:0.84rem;color:#f3dfc6;">' +
                  'Generates a unique <strong>Game Code & QR Code</strong>. Opponents scan the QR code to <strong>auto-join and pick an unassigned player</strong>!' +
                '</p>' +
              '</div>' +

              '<label for="ngPlayers">Total Players</label>' +
              '<select id="ngPlayers">' +
                '<option value="2" selected>2 Players</option>' +
                '<option value="3">3 Players</option>' +
                '<option value="4">4 Players</option>' +
                '<option value="5">5 Players</option>' +
                '<option value="6">6 Players</option>' +
                '<option value="7">7 Players</option>' +
                '<option value="8">8 Players</option>' +
              '</select>' +

              '<div id="ngSoloOpts" style="display:block;">' +
                '<label for="ngAiCount">Computer Opponents</label>' +
                '<select id="ngAiCount">' +
                  '<option value="1" selected>1 Computer</option>' +
                  '<option value="2">2 Computers</option>' +
                  '<option value="3">3 Computers</option>' +
                  '<option value="4">4 Computers</option>' +
                  '<option value="5">5 Computers</option>' +
                  '<option value="6">6 Computers</option>' +
                  '<option value="7">7 Computers</option>' +
                '</select>' +
              '</div>' +

              '<div class="ng-actions" style="margin-top:16px;">' +
                '<button type="button" class="btn primary" id="btnConfirmStart" style="width:100%;padding:11px;font-size:0.95rem;font-weight:700;">' +
                  '🤖 Start Solo Match' +
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
          const playersSelect = $("ngPlayers");
          const aiCountSelect = $("ngAiCount");
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

          if (playersSelect && aiCountSelect) {
            playersSelect.onchange = () => {
              const p = Number(playersSelect.value);
              if (modeSelect?.value === "solo") {
                aiCountSelect.value = String(Math.max(1, p - 1));
              }
            };
            aiCountSelect.onchange = () => {
              const ai = Number(aiCountSelect.value);
              if (modeSelect?.value === "solo") {
                playersSelect.value = String(ai + 1);
              }
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
              const mode = modeSelect?.value || "solo";
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
          "How to Play Dhayam",
          '<div style="text-align:left;display:flex;flex-direction:column;gap:14px;">' +
            '<section style="border-bottom:1px solid #ffffff1a;padding-bottom:12px;">' +
              '<h4 style="margin:0 0 6px;color:#fcd34d;font-size:0.95rem;">📜 Game Rules</h4>' +
              '<p style="margin:4px 0;font-size:0.84rem;color:#f3dfc6;line-height:1.45;"><strong>1.</strong> Roll two traditional brass dice. Rolls of <strong>1</strong>, <strong>5</strong>, <strong>6</strong>, or <strong>12</strong> grant another throw.</p>' +
              '<p style="margin:4px 0;font-size:0.84rem;color:#f3dfc6;line-height:1.45;"><strong>2.</strong> Roll a <strong>1</strong> to enter a piece from reserve. On the first round, all players have an entry allowance to enter on any roll.</p>' +
              '<p style="margin:4px 0;font-size:0.84rem;color:#f3dfc6;line-height:1.45;"><strong>3.</strong> Land on an unprotected opponent to <strong>capture</strong> them back to reserve. Floral squares are <strong>safe</strong>.</p>' +
              '<p style="margin:4px 0;font-size:0.84rem;color:#f3dfc6;line-height:1.45;"><strong>4.</strong> Capture at least once to unlock entry into the inward circuit.</p>' +
              '<p style="margin:4px 0;font-size:0.84rem;color:#f3dfc6;line-height:1.45;"><strong>5.</strong> Guide all 6 pieces into the central destination by exact roll to win!</p>' +
            '</section>' +
            '<section style="border-bottom:1px solid #ffffff1a;padding-bottom:12px;">' +
              '<h4 style="margin:0 0 6px;color:#fcd34d;font-size:0.95rem;">⌨️ Keyboard Controls (Play Without Mouse)</h4>' +
              '<p style="margin:0 0 8px;font-size:0.82rem;color:#d8c4ab;">You can play entire matches without touching the mouse:</p>' +
              '<table class="shortcuts-table" style="width:100%;border-collapse:collapse;font-size:0.82rem;">' +
                '<tbody>' +
                  '<tr><td style="padding:4px 0;width:40%;"><strong>Space</strong> or <strong>R</strong></td><td style="color:#ffe0a3;">Roll Dice / Primary Action</td></tr>' +
                  '<tr><td style="padding:4px 0;"><strong>M</strong> or <strong>Enter</strong></td><td style="color:#ffe0a3;">Move / Enter Piece</td></tr>' +
                  '<tr><td style="padding:4px 0;"><strong>1</strong> – <strong>6</strong></td><td style="color:#ffe0a3;">Move Specific Piece Number</td></tr>' +
                  '<tr><td style="padding:4px 0;"><strong>N</strong></td><td style="color:#ffe0a3;">Start New Solo Game vs Computer</td></tr>' +
                  '<tr><td style="padding:4px 0;"><strong>Esc</strong> or <strong>X</strong></td><td style="color:#ffe0a3;">Exit Match / Dismiss Dialog</td></tr>' +
                  '<tr><td style="padding:4px 0;"><strong>V</strong></td><td style="color:#ffe0a3;">Toggle Voice Commands</td></tr>' +
                '</tbody>' +
              '</table>' +
            '</section>' +
            '<section>' +
              '<h4 style="margin:0 0 6px;color:#fcd34d;font-size:0.95rem;">🎤 Optional Voice Commands (Hands-Free)</h4>' +
              '<p style="margin:0 0 8px;font-size:0.82rem;color:#d8c4ab;">Click <strong>🎤 Voice: Off</strong> in the header or press <kbd>V</kbd> to enable microphone listening. Speak commands clearly:</p>' +
              '<ul style="margin:4px 0 0 18px;font-size:0.82rem;color:#ffe0a3;line-height:1.5;">' +
                '<li><em>"Roll"</em> or <em>"Roll dice"</em> — Rolls the Dayakattai dice</li>' +
                '<li><em>"Move"</em> or <em>"Move piece [1-6]"</em> — Moves active or specific piece</li>' +
                '<li><em>"New game"</em> or <em>"Solo game"</em> — Starts new match vs computer</li>' +
                '<li><em>"Pass"</em> — Passes turn when no moves are possible</li>' +
                '<li><em>"Exit"</em> or <em>"Quit"</em> — Exits match or dialog</li>' +
              '</ul>' +
            '</section>' +
          '</div>',
          "Got it",
          () => {},
        );
      $("demoBtn").onclick = () => {
        let selectedMode = "multiplayer-real";
        let selectedCount = 2;
        let selectedPieces = (typeof getDemoPiecesCount === "function") ? getDemoPiecesCount() : 6;

        const content =
          '<div style="display:flex;flex-direction:column;gap:10px;text-align:left;">' +
            '<p style="margin:0 0 2px;font-size:0.86rem;color:#f2dec5;">Choose an interactive demo experience:</p>' +
            '<div class="demo-card selected" id="cardDemoReal" role="button" tabindex="0" style="cursor:pointer;padding:11px 13px;border-radius:10px;border:2px solid #f59e0b;background:#f59e0b1a;transition:all 0.2s ease;">' +
              '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px;">' +
                '<div style="display:flex;align-items:center;gap:7px;">' +
                  '<span style="font-size:1.25rem;">🌐</span>' +
                  '<strong style="font-size:0.92rem;color:#fcd34d;">Live Online Match</strong>' +
                '</div>' +
                '<span style="background:#f59e0b;color:#180b05;font-weight:700;font-size:0.65rem;padding:2px 7px;border-radius:10px;text-transform:uppercase;letter-spacing:0.5px;">Online Game</span>' +
              '</div>' +
              '<p style="margin:0 0 8px;font-size:0.8rem;color:#f2dec5;line-height:1.35;">' +
                'Connects to a live online game arena with real-time server rolls via global arbitrator, instant QR share link, and multi-device sync across phones and computers.' +
              '</p>' +
              '<div style="display:flex;align-items:center;gap:8px;font-size:0.8rem;color:#e2cbb2;" id="demoRealPcountRow">' +
                '<span>Simulate:</span>' +
                '<div style="display:flex;gap:5px;flex-wrap:wrap;">' +
                  '<button type="button" class="pill demo-pcount-btn real-pcount selected" data-count="2" style="padding:2px 9px;font-size:0.78rem;font-weight:700;border-color:#f59e0b;background:#f59e0b44;color:#fff;">2 Players</button>' +
                  '<button type="button" class="pill demo-pcount-btn real-pcount" data-count="3" style="padding:2px 9px;font-size:0.78rem;font-weight:700;border-color:#7a4623;background:transparent;color:#f2dec5;">3 Players</button>' +
                  '<button type="button" class="pill demo-pcount-btn real-pcount" data-count="4" style="padding:2px 9px;font-size:0.78rem;font-weight:700;border-color:#7a4623;background:transparent;color:#f2dec5;">4 Players</button>' +
                  '<button type="button" class="pill demo-pcount-btn real-pcount" data-count="6" style="padding:2px 9px;font-size:0.78rem;font-weight:700;border-color:#7a4623;background:transparent;color:#f2dec5;">6 Players</button>' +
                  '<button type="button" class="pill demo-pcount-btn real-pcount" data-count="8" style="padding:2px 9px;font-size:0.78rem;font-weight:700;border-color:#7a4623;background:transparent;color:#f2dec5;">8 Players</button>' +
                  '<button type="button" class="pill demo-pcount-btn real-pcount" data-count="16" style="padding:2px 9px;font-size:0.78rem;font-weight:700;border-color:#7a4623;background:transparent;color:#f2dec5;">16 Players</button>' +
                  '<button type="button" class="pill demo-pcount-btn real-pcount" data-count="32" style="padding:2px 9px;font-size:0.78rem;font-weight:700;border-color:#7a4623;background:transparent;color:#f2dec5;">32 Players</button>' +
                '</div>' +
              '</div>' +
            '</div>' +
            '<div class="demo-card" id="cardDemoMp" role="button" tabindex="0" style="cursor:pointer;padding:11px 13px;border-radius:10px;border:1px solid #7a4623;background:#27140b66;transition:all 0.2s ease;">' +
              '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px;">' +
                '<div style="display:flex;align-items:center;gap:7px;">' +
                  '<span style="font-size:1.25rem;">⚡</span>' +
                  '<strong style="font-size:0.92rem;color:#fff1db;">Local Game Simulation</strong>' +
                '</div>' +
                '<span style="border:1px solid #a87d4d;color:#cdbda8;font-size:0.65rem;padding:2px 6px;border-radius:10px;">Local Game</span>' +
              '</div>' +
              '<p style="margin:0 0 8px;font-size:0.8rem;color:#cdbda8;line-height:1.35;">' +
                'Local device simulation of room CF88, virtual phone joins, 3D dice physics, and live floating emoji banter without requiring internet connection.' +
              '</p>' +
              '<div style="display:flex;align-items:center;gap:8px;font-size:0.8rem;color:#e2cbb2;" id="demoSimPcountRow">' +
                '<span>Simulate:</span>' +
                '<div style="display:flex;gap:5px;flex-wrap:wrap;">' +
                  '<button type="button" class="pill demo-pcount-btn sim-pcount selected" data-count="2" style="padding:2px 9px;font-size:0.78rem;font-weight:700;border-color:#f59e0b;background:#f59e0b44;color:#fff;">2 Players</button>' +
                  '<button type="button" class="pill demo-pcount-btn sim-pcount" data-count="3" style="padding:2px 9px;font-size:0.78rem;font-weight:700;border-color:#7a4623;background:transparent;color:#f2dec5;">3 Players</button>' +
                  '<button type="button" class="pill demo-pcount-btn sim-pcount" data-count="4" style="padding:2px 9px;font-size:0.78rem;font-weight:700;border-color:#7a4623;background:transparent;color:#f2dec5;">4 Players</button>' +
                  '<button type="button" class="pill demo-pcount-btn sim-pcount" data-count="6" style="padding:2px 9px;font-size:0.78rem;font-weight:700;border-color:#7a4623;background:transparent;color:#f2dec5;">6 Players</button>' +
                  '<button type="button" class="pill demo-pcount-btn sim-pcount" data-count="8" style="padding:2px 9px;font-size:0.78rem;font-weight:700;border-color:#7a4623;background:transparent;color:#f2dec5;">8 Players</button>' +
                  '<button type="button" class="pill demo-pcount-btn sim-pcount" data-count="16" style="padding:2px 9px;font-size:0.78rem;font-weight:700;border-color:#7a4623;background:transparent;color:#f2dec5;">16 Players</button>' +
                  '<button type="button" class="pill demo-pcount-btn sim-pcount" data-count="32" style="padding:2px 9px;font-size:0.78rem;font-weight:700;border-color:#7a4623;background:transparent;color:#f2dec5;">32 Players</button>' +
                '</div>' +
              '</div>' +
            '</div>' +
            '<div class="demo-card" id="cardDemoClassic" role="button" tabindex="0" style="cursor:pointer;padding:11px 13px;border-radius:10px;border:1px solid #7a4623;background:#27140b66;transition:all 0.2s ease;">' +
              '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px;">' +
                '<div style="display:flex;align-items:center;gap:7px;">' +
                  '<span style="font-size:1.25rem;">📖</span>' +
                  '<strong style="font-size:0.92rem;color:#fff1db;">Classic Rules Walkthrough</strong>' +
                '</div>' +
                '<span style="border:1px solid #a87d4d;color:#cdbda8;font-size:0.65rem;padding:2px 6px;border-radius:10px;">Local Game</span>' +
              '</div>' +
              '<p style="margin:0;font-size:0.8rem;color:#cdbda8;line-height:1.35;">' +
                'Traditional 2-player walkthrough explaining piece entry on roll of 1, bonus rolls, board circuits, and safe floral squares.' +
              '</p>' +
            '</div>' +
            '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:#1e1109;border:1px solid #7a4623;border-radius:10px;margin-top:2px;">' +
              '<span style="font-size:0.84rem;color:#f2dec5;font-weight:700;">Pieces per player:</span>' +
              '<div style="display:flex;gap:6px;" id="demoPiecesGroup">' +
                '<button type="button" class="pill demo-piece-btn" data-pieces="1" style="padding:3px 10px;font-size:0.78rem;font-weight:700;cursor:pointer;">1 Piece (Fast)</button>' +
                '<button type="button" class="pill demo-piece-btn selected" data-pieces="6" style="padding:3px 10px;font-size:0.78rem;font-weight:700;cursor:pointer;border-color:#f59e0b;background:#f59e0b44;color:#fff;">6 Pieces (Standard)</button>' +
              '</div>' +
            '</div>' +
          '</div>';

        showModal(
          "✦ Select Demo Experience",
          content,
          "Start demo",
          () => startGuidedDemo(selectedMode, selectedCount, selectedPieces),
        );

        setTimeout(() => {
          const cardReal = $("cardDemoReal");
          const cardMp = $("cardDemoMp");
          const cardClassic = $("cardDemoClassic");
          const realBtns = document.querySelectorAll(".real-pcount");
          const simBtns = document.querySelectorAll(".sim-pcount");
          const pieceBtns = document.querySelectorAll(".demo-piece-btn");

          function updateCardSelection() {
            [cardReal, cardMp, cardClassic].forEach((card) => {
              if (card) {
                card.style.borderColor = "#7a4623";
                card.style.background = "#27140b66";
              }
            });
            if (selectedMode === "multiplayer-real" && cardReal) {
              cardReal.style.borderColor = "#f59e0b";
              cardReal.style.background = "#f59e0b1a";
            } else if (selectedMode === "multiplayer" && cardMp) {
              cardMp.style.borderColor = "#f59e0b";
              cardMp.style.background = "#f59e0b1a";
            } else if (selectedMode === "classic" && cardClassic) {
              cardClassic.style.borderColor = "#f59e0b";
              cardClassic.style.background = "#f59e0b1a";
            }
          }

          if (cardReal) {
            cardReal.onclick = (e) => {
              if (e.target.closest(".demo-pcount-btn")) return;
              selectedMode = "multiplayer-real";
              updateCardSelection();
            };
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

          function setupCountGroup(btns, mode) {
            btns.forEach((btn) => {
              btn.onclick = (e) => {
                e.stopPropagation();
                selectedMode = mode;
                selectedCount = parseInt(btn.dataset.count, 10) || 2;
                updateCardSelection();
                btns.forEach((b) => {
                  const isCur = b === btn;
                  b.style.borderColor = isCur ? "#f59e0b" : "#7a4623";
                  b.style.background = isCur ? "#f59e0b44" : "transparent";
                  b.style.color = isCur ? "#fff" : "#f2dec5";
                });
              };
            });
          }

          setupCountGroup(realBtns, "multiplayer-real");
          setupCountGroup(simBtns, "multiplayer");

          pieceBtns.forEach((btn) => {
            const pCount = parseInt(btn.dataset.pieces, 10) || 6;
            const isCur = pCount === selectedPieces;
            btn.style.borderColor = isCur ? "#f59e0b" : "#7a4623";
            btn.style.background = isCur ? "#f59e0b44" : "transparent";
            btn.style.color = isCur ? "#fff" : "#f2dec5";

            btn.onclick = (e) => {
              e.stopPropagation();
              selectedPieces = pCount;
              if (typeof setDemoPiecesCount === "function") setDemoPiecesCount(selectedPieces);
              pieceBtns.forEach((b) => {
                const match = (parseInt(b.dataset.pieces, 10) || 6) === selectedPieces;
                b.style.borderColor = match ? "#f59e0b" : "#7a4623";
                b.style.background = match ? "#f59e0b44" : "transparent";
                b.style.color = match ? "#fff" : "#f2dec5";
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

      function updateFooterBuildInfo() {
        if (typeof BUILD_INFO !== "undefined") {
          const badge = $("buildNumberBadge");
          const ts = $("buildUpdatedTimestamp");
          if (badge) badge.textContent = `Build #${BUILD_INFO.build} (v${BUILD_INFO.version})`;
          if (ts) ts.textContent = `Updated: ${BUILD_INFO.timestamp}`;
        }
      }
      updateFooterBuildInfo();

      refreshVoices();
      if ("speechSynthesis" in window)
        speechSynthesis.addEventListener("voiceschanged", refreshVoices);
      newGame(2, 1);
      if (typeof DhayamEmbedHost !== "undefined") {
        DhayamEmbedHost.gameStarted({ mode: "solo", playerCount: 2 });
      }
      if (typeof initMultiplayerFromUrl === "function") {
        initMultiplayerFromUrl();
      }
      if (typeof setupKeyboardNavigation === "function") {
        setupKeyboardNavigation();
      }
