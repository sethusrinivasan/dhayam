/**
 * ui.js - DOM Board Rendering & Visual Synchronization
 *
 * Renders the 7x7 grid cells, active tokens with numbered badges, animated SVG path flows,
 * player cards, accessible piece-selection dropdowns, and interactive roll chips.
 */
"use strict";

      function render() {
        if (!game) return;
        const opts = options();
        const chosen = opts.filter((o) =>
          selectedRoll === -1
            ? o.indices.length === game.pool.length
            : o.indices.length === 1 && o.indices[0] === selectedRoll,
        );
        const entry = chosen.find((o) => o.piece.progress === -1);
        const legal = new Map();
        for (const o of chosen) {
          if (!legal.has(o.piece.id)) legal.set(o.piece.id, o);
        }
        $("board").innerHTML = "";
        for (const row of "ABCDEFG")
          for (let col = 1; col <= 7; col++) {
            const sq = row + col,
              el = document.createElement("button");
            el.type = "button";
            el.className =
              "cell" +
              (SAFE.has(sq) ? " safe" : "") +
              (sq === "D4" ? " goal" : "") +
              (INNER.includes(sq) ? " inner" : "");
            for (const seat of SEATS)
              if (START[seat] === sq) el.classList.add("start" + seat);
            const occupied = game.players.flatMap((p) =>
              p.pieces
                .filter((piece) => node(p, piece) === sq)
                .map((piece) => ({ p, piece })),
            );
            const canEntry = Boolean(entry && sq === START[active().seat]);
            const can = occupied.some((o) => legal.has(o.piece.id)) || canEntry;
            if (can) el.classList.add("legal");
            el.setAttribute(
              "aria-label",
              sq +
                (SAFE.has(sq) ? ", safe square" : "") +
                (occupied.length ? ", " + occupied.length + " pieces" : "") +
                (canEntry ? ", enter piece here" : ""),
            );
            const goalMotif =
              (typeof THEME_DEFINITIONS !== "undefined" &&
                THEME_DEFINITIONS[currentTheme]?.goalMotif) ||
              "✺";
            const safeMotif =
              (typeof THEME_DEFINITIONS !== "undefined" &&
                THEME_DEFINITIONS[currentTheme]?.safeMotif) ||
              "✿";
            el.innerHTML =
              sq === "D4"
                ? '<span class="motif">' + goalMotif + "</span>"
                : SAFE.has(sq)
                  ? '<span class="motif">' + safeMotif + "</span>"
                  : "";
            if (occupied.length) {
              // Group a player's stacked pieces under one large avatar. The
              // suffix lists the exact piece numbers sharing this square.
              const holder = document.createElement("span"),
                groups = game.players
                  .map((p) => ({
                    p,
                    pieces: occupied
                      .filter((item) => item.p === p)
                      .map((item) => item.piece),
                  }))
                  .filter((group) => group.pieces.length);
              holder.className = "tokens count-" + Math.min(groups.length, 4);
              for (const { p, pieces } of groups) {
                const selectable = pieces.some((piece) => legal.has(piece.id)),
                  t = document.createElement("span");
                t.className =
                  "token" +
                  (p === active() ? " current" : "") +
                  (pieces.some((piece) => piece.id === movingPieceId)
                    ? " moving"
                    : "") +
                  (pieces.some((piece) => capturedPieceIds.includes(piece.id))
                    ? " captured"
                    : "") +
                  (selectable ? " selectable" : "");
                t.style.background = p.color;
                t.innerHTML = '<span class="tokenemoji">' + p.avatar + '</span>';
                const pieceNumbers = pieces.map(
                  (piece) => p.pieces.indexOf(piece) + 1,
                );
                t.setAttribute(
                  "aria-label",
                  p.name + ", piece " + pieceNumbers.join(", piece "),
                );
                const ids = document.createElement("span");
                ids.className = "tokenids";
                ids.textContent = pieceNumbers.join("·");
                t.appendChild(ids);

                // Direct piece click or touch to move selected token
                if (selectable && !demo && !active().computer && !moving) {
                  t.style.cursor = "pointer";
                  t.title = "Click or tap to move piece " + pieceNumbers.join(", ");
                  t.setAttribute("role", "button");
                  t.setAttribute("tabindex", "0");
                  const onPieceTouch = (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    let moveOpt = pieces.map((piece) => legal.get(piece.id)).find(Boolean);
                    if (!moveOpt) {
                      const anyOpt = opts.find((o) => pieces.some((p) => p.id === o.piece.id));
                      if (anyOpt) {
                        selectedRoll = anyOpt.indices.length === 1 ? anyOpt.indices[0] : -1;
                        selectedPieceId = anyOpt.piece.id;
                        moveOpt = anyOpt;
                      }
                    }
                    if (moveOpt) {
                      selectedPieceId = moveOpt.piece.id;
                      if (typeof FlightRecorder !== "undefined") {
                        FlightRecorder.record("PIECE_CLICKED", { pieceId: moveOpt.piece.id, source: "token" });
                      }
                      apply(moveOpt, "token-touch");
                    }
                  };
                  t.onclick = onPieceTouch;
                  t.addEventListener("keydown", (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      onPieceTouch(e);
                    }
                  });
                }

                holder.appendChild(t);
              }
              el.appendChild(holder);
            }
            if (can && !demo && !active().computer && !moving)
              el.onclick = () => {
                let o = occupied
                  .map((x) => legal.get(x.piece.id))
                  .find(Boolean) || (canEntry ? entry : null);
                if (!o) {
                  const anyOccupiedOpt = opts.find((opt) =>
                    occupied.some((x) => x.piece.id === opt.piece.id)
                  );
                  if (anyOccupiedOpt) {
                    selectedRoll = anyOccupiedOpt.indices.length === 1 ? anyOccupiedOpt.indices[0] : -1;
                    selectedPieceId = anyOccupiedOpt.piece.id;
                    o = anyOccupiedOpt;
                  }
                }
                if (o) {
                  if (typeof FlightRecorder !== "undefined") {
                    FlightRecorder.record("BOARD_CELL_CLICKED", { sq, pieceId: o.piece.id });
                  }
                  apply(o, canEntry ? "start-entry" : "board");
                }
              };
            el.addEventListener("keydown", (e) => {
              if ((e.key === "Enter" || e.key === " ") && can) {
                e.preventDefault();
                el.click();
              }
            });
            $("board").appendChild(el);
          }
        $("players").innerHTML = game.players
          .map((p) => {
            const numbersFor = (test) => {
                const numbers = p.pieces
                  .map((piece, index) => (test(piece) ? index + 1 : null))
                  .filter(Boolean);
                return numbers.length
                  ? numbers.map((number) => "#" + number).join(", ")
                  : "—";
              },
              waiting = numbersFor((piece) => piece.progress < 0),
              onBoard = numbersFor(
                (piece) => piece.progress >= 0 && piece.progress < 43,
              ),
              home = numbersFor((piece) => piece.progress === 43);
            const isCurrentActive = active() === p && game.phase !== "done";
            const canCardEnter = Boolean(isCurrentActive && entry && !demo && !p.computer && !moving);
            return (
              '<div class="player ' +
              (isCurrentActive ? "active" : "") +
              (canCardEnter ? " can-enter" : "") +
              (capturedPlayerIds.includes(p.id) ? " captureloss" : "") +
              '"' +
              (canCardEnter
                ? ' data-can-enter="true" role="button" tabindex="0" title="Click to enter piece from reserve onto the board"'
                : "") +
              '><div class="avatar" aria-hidden="true" style="background:' +
              p.color +
              '">' +
              p.avatar +
              '</div><div style="flex:1"><div class="pname">' +
              escapeHtml(p.name) +
              (p.rank ? " · #" + p.rank : "") +
              '</div><div class="pmeta">' +
              p.pieces.filter((q) => q.progress === 43).length +
              "/6 finished · " +
              (p.captured ? "capture earned" : "capture needed") +
              '</div><div class="piecestatus"><span><b>Waiting:</b> ' +
              waiting +
              "</span><span><b>On board:</b> " +
              onBoard +
              "</span><span><b>Home:</b> " +
              home +
              "</span></div></div>" +
              (active() === p && game.phase !== "done"
                ? '<div class="turn">● Turn</div>'
                : "") +
              "</div>"
            );
          })
          .join("");
        const enterCards = $("players").querySelectorAll(".player[data-can-enter='true']");
        enterCards.forEach((card) => {
          card.onclick = () => {
            if (entry && !moving) {
              if (typeof FlightRecorder !== "undefined") {
                FlightRecorder.record("PLAYER_CARD_ENTER_CLICKED", { playerId: active().id });
              }
              apply(entry, "family-table-entry");
            }
          };
          card.onkeydown = (e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              card.click();
            }
          };
        });
        $("playerLegend").innerHTML =
          '<span class="legendplayers" aria-label="Player color and avatar legend">' +
          game.players
            .map(
              (player) =>
                '<span class="legendplayer" style="background:' +
                player.color +
                '" title="' +
                escapeHtml(player.name) +
                '">' +
                player.avatar +
                "</span>",
            )
            .join("") +
          "</span> Player colors";
        $("gameInfo").textContent = game.computerCount
          ? "1 human · " +
            game.computerCount +
            " computer" +
            (game.computerCount === 1 ? "" : "s") +
            " · House variant"
          : game.players.length +
            " players · Local pass-and-play · House variant";
        setDieFace(
          "dieA",
          game.last ? game.last.a : 0,
          game.last ? "First die: " + game.last.a : "First die not rolled",
        );
        setDieFace(
          "dieB",
          game.last ? game.last.b : 0,
          game.last ? "Second die: " + game.last.b : "Second die not rolled",
        );
        if (!moving) {
          $("rollChips").innerHTML = "";
          if (entry) {
            const enter = document.createElement("button");
            enter.className = "chip selected";
            enter.textContent = entry.test.openingEntry
              ? "＋ Opening entry allowance"
              : "＋ Enter a piece";
            enter.onclick = () => apply(entry, "entry-button");
            enter.disabled = demo || active().computer || moving;
            $("rollChips").appendChild(enter);
          }
          if (game.phase === "move") {
            game.pool.forEach((v, i) => {
              const b = document.createElement("button");
              b.className = "chip" + (selectedRoll === i ? " selected" : "");
              b.textContent = v;
              b.setAttribute("aria-label", "Use roll " + v);
              b.onclick = () => {
                selectedRoll = i;
                selectedPieceId = null;
                render();
              };
              b.disabled = demo || active().computer || moving;
              $("rollChips").appendChild(b);
            });
            if (game.pool.length > 1) {
              const b = document.createElement("button");
              b.className = "chip" + (selectedRoll === -1 ? " selected" : "");
              b.textContent = "Combine all";
              b.onclick = () => {
                selectedRoll = -1;
                selectedPieceId = null;
                render();
              };
              b.disabled = demo || active().computer || moving;
              $("rollChips").appendChild(b);
            }
          }
        }
        const moveChoices = [...legal.values()],
          canUseMoveButton =
            game.phase === "move" &&
            moveChoices.length > 0 &&
            !demo &&
            !active().computer;
        if (!moveChoices.some((move) => move.piece.id === selectedPieceId))
          selectedPieceId = moveChoices[0]?.piece.id ?? null;
        $("moveChoice").innerHTML = moveChoices
          .map((move) => {
            const from = node(active(), move.piece) || "reserve",
              destination = ROUTES[active().seat][move.test.progress];
            return (
              '<option value="' +
              move.piece.id +
              '"' +
              (move.piece.id === selectedPieceId ? " selected" : "") +
              ">Piece " +
              (active().pieces.indexOf(move.piece) + 1) +
              ": " +
              from +
              " → " +
              destination +
              "</option>"
            );
          })
          .join("");
        $("moveChoice").hidden = !canUseMoveButton;
        $("moveChoice").onchange = (event) => {
          selectedPieceId = event.target.value;
        };
        $("moveBtn").hidden = !canUseMoveButton;
        $("moveBtn").disabled = moving || rolling;
        $("moveBtn").onclick = () =>
          apply(legal.get(selectedPieceId), "move-button");
        const p = active(),
          winner = game.players.find((player) => player.rank === 1);
        $("statusTitle").textContent =
          game.phase === "done"
            ? "🏆 " + winner.name + " wins!"
            : p.avatar + " " + p.name + "’s turn";
        const openingEntryRequired = opts.some(
          (move) => move.test.openingEntry,
        );
        $("statusText").textContent =
          game.phase === "roll"
            ? "Roll the Dayakattai" +
              (game.history.length
                ? " · bonus throw! Follow the glowing route around the board."
                : " · Follow the glowing route around the board.")
            : game.phase === "move"
              ? openingEntryRequired
                ? "Use this player’s first-round entry allowance to put a piece on the board."
                : "Choose a roll, then tap a gold-outlined " +
                  p.avatar +
                  " piece. " +
                  chosen.length +
                  " move" +
                  (chosen.length === 1 ? " is" : "s are") +
                  " available."
              : winner.name +
                " brought all six pieces to the center. The game is complete.";
        $("actionBtn").textContent =
          game.phase === "roll"
            ? "🎲 Roll Dice"
            : game.phase === "move"
              ? openingEntryRequired && entry
                ? "Enter Piece onto Board"
                : canUseMoveButton && (legal.get(selectedPieceId) || moveChoices[0])
                  ? "Move selected piece"
                  : "Pass remaining rolls"
              : "New match";
        $("actionBtn").onclick = () => {
          if (game.phase === "roll") {
            roll();
          } else if (game.phase === "move") {
            if (openingEntryRequired && entry) {
              apply(entry, "action-btn-entry");
            } else if (canUseMoveButton && (legal.get(selectedPieceId) || moveChoices[0])) {
              apply(legal.get(selectedPieceId) || moveChoices[0], "action-btn-move");
            } else {
              passRemainingRolls();
            }
          } else {
            newGame(game.players.length);
          }
        };
        $("actionBtn").disabled =
          demo ||
          rolling ||
          moving ||
          p.computer;
        if (game.phase === "done") $("actionBtn").textContent = "Game complete";
        else if (demo) $("actionBtn").textContent = "Demo playing…";
        else if (rolling) $("actionBtn").textContent = "Rolling…";
        else if (moving) $("actionBtn").textContent = "Moving…";
        else if (p.computer)
          $("actionBtn").textContent = p.name + " is thinking…";
        const diceHintEl = $("diceHint");
        if (diceHintEl) {
          if (game.last) {
            const val = game.last.value;
            const isDhayam = val === 1;
            const isBonus = Boolean(game.last.bonus);
            const isChainEnded = Boolean(game.last.specialRoll && !game.last.bonus);
            const badgeClass = isBonus ? "lastroll-status bonus" : "lastroll-status";
            const badgeText = isDhayam
              ? "✨ Dhayam! · Bonus throw"
              : isBonus
                ? "✨ Bonus throw (" + val + ")"
                : isChainEnded
                  ? "Bonus chain complete"
                  : "Normal roll";

            diceHintEl.className = "lastroll-container";
            diceHintEl.innerHTML =
              '<div class="lastroll-header">Last Roll</div>' +
              '<div class="lastroll-main">' +
              '<span class="lastroll-number">' + val + "</span>" +
              (isDhayam ? '<span class="lastroll-name">Dhayam</span>' : "") +
              "</div>" +
              '<div class="' + badgeClass + '">' + badgeText + "</div>";
          } else {
            diceHintEl.className = "lastroll-container";
            diceHintEl.innerHTML =
              '<div class="lastroll-helper-init">Two traditional dice · Click dice to roll.<br>Roll 1, 5, 6, or 12 for a bonus throw.</div>';
          }
        }
        const canRollDice = game.phase === "roll" && !rolling && !moving && !demo && !p.computer;
        const diceEl = document.querySelector(".dice");
        if (diceEl) {
          diceEl.classList.toggle("rollable", canRollDice);
          diceEl.setAttribute("aria-label", canRollDice ? "Dice — Click to roll" : "Dice");
          if (canRollDice) {
            diceEl.title = "Click to roll dice";
            diceEl.setAttribute("tabindex", "0");
          } else {
            diceEl.removeAttribute("title");
            diceEl.removeAttribute("tabindex");
          }
        }
        updateAudioToggle();
        scheduleComputerIfNeeded();
      }
      const DEMO_STEPS = [
        () =>
          demoScene(
            "Maya starts. Each player has six pieces waiting off the board.",
            () => {
              game.current = 0;
              game.turn = 1;
              game.phase = "roll";
              game.pool = [];
              game.history = [];
              game.last = null;
            },
          ),
        () =>
          demoScene(
            "Maya rolls a 1. A roll of 1 can bring a piece onto the starting square and also earns a bonus roll.",
            () => {
              game.last = {
                a: 0,
                b: 1,
                value: 1,
                bonus: true,
                specialRoll: true,
              };
              game.pool = [1];
              game.history = [1];
              game.phase = "move";
            },
          ),
        () =>
          demoScene(
            "The elephant enters on its colored starting square.",
            async () => {
              await animateScriptedPiece(
                game.players[0],
                game.players[0].pieces[0],
                0,
              );
              game.pool = [];
              game.phase = "roll";
            },
          ),
        () =>
          demoScene(
            "The bonus roll is 2. The gold outline shows which piece can move.",
            () => {
              game.last = {
                a: 0,
                b: 2,
                value: 2,
                bonus: false,
                specialRoll: false,
              };
              game.pool = [2];
              game.history = [1, 2];
              game.phase = "move";
            },
          ),
        () =>
          demoScene(
            "The elephant moves two spaces along the glowing route. Maya’s turn is over.",
            async () => {
              await animateScriptedPiece(
                game.players[0],
                game.players[0].pieces[0],
                2,
              );
              game.pool = [];
              game.history = [];
              game.current = 1;
              game.turn = 2;
              game.phase = "roll";
            },
          ),
        () =>
          demoScene(
            "Now it is Leo’s turn. The highlighted player card always shows whose turn it is.",
            () => {},
          ),
        () =>
          demoScene("Leo rolls a 1, so the tiger can enter the board.", () => {
            game.last = {
              a: 0,
              b: 1,
              value: 1,
              bonus: true,
              specialRoll: true,
            };
            game.pool = [1];
            game.history = [1];
            game.phase = "move";
          }),
        () =>
          demoScene(
            "The tiger enters on Leo’s colored starting square.",
            async () => {
              await animateScriptedPiece(
                game.players[1],
                game.players[1].pieces[0],
                0,
              );
              game.pool = [];
              game.history = [];
              game.phase = "roll";
            },
          ),
        () =>
          demoScene(
            "Capture example: Maya rolls 1 while Leo’s tiger is one space ahead on an unprotected square.",
            () => {
              game.current = 0;
              game.turn = 3;
              game.players[0].pieces[0].progress = 0;
              game.players[1].pieces[0].progress = 13;
              game.last = {
                a: 0,
                b: 1,
                value: 1,
                bonus: false,
                specialRoll: true,
              };
              game.pool = [1];
              game.history = [1];
              game.phase = "move";
            },
          ),
        () =>
          demoScene(
            "The elephant lands on the tiger. Leo’s piece returns to reserve, and Maya earns the capture needed to enter the inner track.",
            async () => {
              await animateScriptedPiece(
                game.players[0],
                game.players[0].pieces[0],
                1,
              );
              game.players[0].captured = true;
              game.players[1].pieces[0].progress = -1;
              game.pool = [];
              game.history = [];
              game.phase = "roll";
            },
          ),
        () =>
          demoScene(
            "Leo also completes a capture. Both players can now follow the inner route, so the automatic match will continue until one player finishes all six pieces and wins, or you interrupt it.",
            () => {
              game.players[1].captured = true;
              game.current = 0;
              game.pool = [];
              game.history = [];
              game.phase = "roll";
            },
          ),
      ];
      const DEMO_FACES = {
        1: [0, 1],
        2: [0, 2],
        3: [0, 3],
        4: [1, 3],
        5: [2, 3],
        6: [3, 3],
        12: [0, 0],
      };
