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
        if (opts.length > 0) {
          const hasChosen = opts.some((o) =>
            selectedRoll === -1
              ? o.indices.length === game.pool.length
              : o.indices.length === 1 && o.indices[0] === selectedRoll,
          );
          if (!hasChosen) {
            const firstOpt = opts[0];
            selectedRoll = firstOpt.indices.length === 1 ? firstOpt.indices[0] : -1;
            selectedPieceId = firstOpt.piece.id;
          }
        }
        const chosen = opts.filter((o) =>
          selectedRoll === -1
            ? o.indices.length === game.pool.length
            : o.indices.length === 1 && o.indices[0] === selectedRoll,
        );
        const anyEntryOpt = opts.find((o) => o.piece.progress === -1);
        const entry = chosen.find((o) => o.piece.progress === -1) || anyEntryOpt || null;
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
            el.dataset.sq = sq;
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
            const canEntry = Boolean((entry || anyEntryOpt) && sq === START[active().seat]);
            const canMoveOccupied = occupied.some(
              (o) => o.p === active() && opts.some((opt) => opt.piece.id === o.piece.id),
            );
            const can = occupied.some((o) => legal.has(o.piece.id)) || canMoveOccupied || canEntry;
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
                const isCurrentPlayer = p === active();
                const hasAnyMove = pieces.some((piece) => opts.some((o) => o.piece.id === piece.id));
                const selectable = isCurrentPlayer && (hasAnyMove || pieces.some((piece) => legal.has(piece.id)));
                const t = document.createElement("span");
                const isCrowded = pieces.length >= 2;
                const maxProgress = Math.max(...pieces.map((piece) => piece.progress));
                let tierClass = "";
                if (maxProgress === 43) {
                  tierClass = " tier-center";
                } else if (maxProgress === 42) {
                  tierClass = " tier-inner3";
                } else if (maxProgress >= 25 && maxProgress <= 41) {
                  tierClass = " tier-inner2";
                }

                t.className =
                  "token" +
                  (isCurrentPlayer ? " current" : "") +
                  (pieces.some((piece) => piece.id === movingPieceId)
                    ? " moving"
                    : "") +
                  (pieces.some((piece) => capturedPieceIds.includes(piece.id))
                    ? " captured"
                    : "") +
                  (selectable ? " selectable" : "") +
                  (isCrowded ? " crowded" : "") +
                  tierClass;
                t.style.background = p.color;
                t.innerHTML = '<span class="tokenemoji">' + p.avatar + "</span>";
                const pieceNumbers = pieces.map(
                  (piece) => p.pieces.indexOf(piece) + 1,
                );
                t.setAttribute(
                  "aria-label",
                  p.name + ", piece " + pieceNumbers.join(", piece "),
                );
                const ids = document.createElement("span");
                ids.className = "tokenids";
                ids.textContent = pieces.length >= 4
                  ? "×" + pieces.length
                  : pieceNumbers.join("·");
                if (isCrowded) {
                  ids.title = "Stacked pieces: #" + pieceNumbers.join(", #");
                }
                t.appendChild(ids);

                // Direct piece click or touch: immediately initiate "move selected piece" action
                if (isCurrentPlayer && !demo && !active().computer && !moving) {
                  t.style.cursor = "pointer";
                  t.title = "Click to move piece " + pieceNumbers.join(", ");
                  t.setAttribute("role", "button");
                  t.setAttribute("tabindex", "0");
                  const onPieceTouch = (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    if (multiplayer.active && !isMyTurn()) return;
                    if (game.phase === "roll") {
                      $("statusText").textContent =
                        "Roll the dice first to see legal moves.";
                      const diceEl = document.querySelector(".dice");
                      if (diceEl)
                        diceEl.scrollIntoView({
                          behavior: "smooth",
                          block: "nearest",
                        });
                      return;
                    }
                    if (game.phase !== "move") return;

                    let moveOpt = pieces
                      .map((piece) => legal.get(piece.id))
                      .find(Boolean);
                    if (!moveOpt) {
                      const anyOpt = opts.find((o) =>
                        pieces.some((piece) => piece.id === o.piece.id),
                      );
                      if (anyOpt) {
                        selectedRoll =
                          anyOpt.indices.length === 1 ? anyOpt.indices[0] : -1;
                        moveOpt = anyOpt;
                      }
                    }

                    if (moveOpt) {
                      selectedPieceId = moveOpt.piece.id;
                      if ($("moveChoice")) $("moveChoice").value = moveOpt.piece.id;
                      if (typeof FlightRecorder !== "undefined") {
                        FlightRecorder.record("PIECE_CLICK_INITIATE_MOVE", {
                          pieceId: moveOpt.piece.id,
                          square: sq,
                          values: moveOpt.values,
                        });
                      }
                      apply(moveOpt, "piece-click");
                    } else {
                      const pNum = p.pieces.indexOf(pieces[0]) + 1;
                      $("statusText").textContent =
                        p.name +
                        "’s piece #" +
                        pNum +
                        " cannot move with the current dice rolls.";
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
            const isClickableTurn = !demo && (multiplayer.active ? isMyTurn() : !active().computer) && !moving;
            if (can && isClickableTurn)
              el.onclick = () => {
                let o = occupied
                  .map((x) => legal.get(x.piece.id))
                  .find(Boolean) || (canEntry ? (entry || anyEntryOpt) : null);
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
        // Dynamic Leaderboard Sorting: High score users move up to the top of the table
        const sortedPlayers = [...game.players]
          .map((p, idx) => ({
            player: p,
            score: calculatePlayerScore(p),
            finishedCount: p.pieces.filter((q) => q.progress === 43).length,
            originalIndex: idx,
          }))
          .sort((a, b) => {
            // 1. Finished/winner rank first
            if (a.player.rank && b.player.rank) return a.player.rank - b.player.rank;
            if (a.player.rank) return -1;
            if (b.player.rank) return 1;
            // 2. Higher score descending
            if (b.score !== a.score) return b.score - a.score;
            // 3. Finished pieces count descending
            if (b.finishedCount !== a.finishedCount) return b.finishedCount - a.finishedCount;
            // 4. Stable tiebreaker: original seat order
            return a.originalIndex - b.originalIndex;
          });

        // The top 1st user on the leaderboard gets the yellow star
        const topLeaderId = sortedPlayers.length > 0 ? sortedPlayers[0].player.id : null;

        $("players").innerHTML = sortedPlayers
          .map(({ player: p, score, finishedCount }) => {
            const isLeader = p.id === topLeaderId;
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

            const boardProgressTotal = p.pieces.reduce(
              (sum, q) => sum + (q.progress === 43 ? 43 : q.progress >= 0 ? q.progress + 1 : 0),
              0,
            );
            const progressPct = Math.min(100, Math.round((boardProgressTotal / 258) * 100));
            const isCurrentActive = active() === p && game.phase !== "done";
            const canCardEnter = Boolean(isCurrentActive && (entry || anyEntryOpt) && !demo && !p.computer && !moving);
            return (
              '<div class="player ' +
              (isCurrentActive ? "active" : "") +
              (isLeader ? " is-leader" : "") +
              (canCardEnter ? " can-enter" : "") +
              (capturedPlayerIds.includes(p.id) ? " captureloss" : "") +
              '" data-player-id="' +
              p.id +
              '"' +
              (canCardEnter
                ? ' data-can-enter="true" role="button" tabindex="0" title="Click to enter piece from reserve onto the board"'
                : "") +
              '><div class="avatar" aria-hidden="true" style="background:' +
              p.color +
              '">' +
              p.avatar +
              '</div><div style="flex:1;min-width:0;"><div class="pname-row"><span class="pname">' +
              escapeHtml(p.name) +
              (p.rank ? " · #" + p.rank : "") +
              (isLeader ? ' <span class="leader-star" role="img" aria-label="1st place match leader" title="⭐ Match Leader (1st Place)">⭐</span>' : "") +
              '</span><span class="pscore-badge" title="Player score: ' +
              score +
              ' points based on board advancement, captures (+50), home finishes (+100)' +
              (p.bonusPoints ? ', and ' + p.bonusPoints + ' bonus points' : '') +
              '"><span class="pscore-val">' +
              score +
              '</span> <span class="pscore-unit">pts</span></span></div><div class="pscore-track" title="' +
              progressPct +
              '% board completion"><div class="pscore-fill" style="width:' +
              progressPct +
              '%;background:' +
              p.color +
              ';"></div></div><div class="pmeta">' +
              finishedCount +
              "/6 home · " +
              (p.captured ? "⚔️ Capture earned (+50)" : "Capture needed") +
              (p.bonusPoints ? " · ⭐ " + p.bonusPoints + " bonus" : "") +
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
            const entryMove = entry || anyEntryOpt;
            if (entryMove && !moving) {
              if (typeof FlightRecorder !== "undefined") {
                FlightRecorder.record("PLAYER_CARD_ENTER_CLICKED", { playerId: active().id });
              }
              apply(entryMove, "family-table-entry");
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
          p = active(),
          winner = game.players.find((player) => player.rank === 1),
          isHumanTurn = !demo && (multiplayer.active ? isMyTurn() : !p.computer),
          canRoll = game.phase === "roll" && !rolling && !moving && isHumanTurn && game.phase !== "done",
          targetMove = (selectedPieceId ? legal.get(selectedPieceId) : null) || moveChoices[0] || entry || opts[0] || null,
          canMove = game.phase === "move" && Boolean(targetMove) && !rolling && !moving && isHumanTurn;

        if (!moveChoices.some((move) => move.piece.id === selectedPieceId))
          selectedPieceId = targetMove?.piece?.id ?? null;

        // Move Choice Dropdown (#moveChoice)
        const moveChoiceEl = $("moveChoice");
        if (moveChoiceEl) {
          const showDropdown = game.phase === "move" && moveChoices.length > 1 && isHumanTurn;
          moveChoiceEl.hidden = !showDropdown;
          if (showDropdown) {
            moveChoiceEl.innerHTML = moveChoices
              .map((move) => {
                const from = node(p, move.piece) || "reserve",
                  destination = ROUTES[p.seat][move.test.progress];
                return (
                  '<option value="' +
                  move.piece.id +
                  '"' +
                  (move.piece.id === selectedPieceId ? " selected" : "") +
                  ">Piece " +
                  (p.pieces.indexOf(move.piece) + 1) +
                  ": " +
                  from +
                  " → " +
                  destination +
                  "</option>"
                );
              })
              .join("");
            moveChoiceEl.onchange = (event) => {
              selectedPieceId = event.target.value;
              render();
            };
          }
        }

        // 1. Move Selected Piece Button (#moveBtn)
        const moveBtn = $("moveBtn");
        if (moveBtn) {
          moveBtn.hidden = false;
          if (moving) {
            moveBtn.textContent = "Moving…";
            moveBtn.disabled = true;
            moveBtn.onclick = null;
          } else if (canMove && targetMove) {
            moveBtn.textContent = targetMove.piece.progress < 0
              ? "✨ Enter Piece"
              : "Move selected piece";
            moveBtn.disabled = false;
            moveBtn.onclick = () => {
              if (canMove && targetMove && !moving) {
                apply(targetMove, "move-button");
              }
            };
          } else {
            moveBtn.textContent = "Move selected piece";
            moveBtn.disabled = true;
            moveBtn.onclick = null;
          }
        }

        // 2. Roll Dice Button (#actionBtn)
        const actionBtn = $("actionBtn");
        if (actionBtn) {
          if (game.phase === "done") {
            actionBtn.textContent = "🏆 New match";
            actionBtn.disabled = false;
            actionBtn.classList.remove("disabled");
            actionBtn.onclick = () => newGame(game.players.length, game.computerCount);
          } else if (demo) {
            actionBtn.textContent = "Demo playing…";
            actionBtn.disabled = true;
            actionBtn.classList.add("disabled");
            actionBtn.onclick = null;
          } else if (multiplayer.active && !isMyTurn()) {
            actionBtn.textContent = "Waiting for " + p.name + "…";
            actionBtn.disabled = true;
            actionBtn.classList.add("disabled");
            actionBtn.onclick = null;
          } else if (p.computer) {
            actionBtn.textContent = rolling
              ? p.name + " rolling…"
              : moving
                ? p.name + " moving…"
                : p.name + " is thinking…";
            actionBtn.disabled = true;
            actionBtn.classList.add("disabled");
            actionBtn.onclick = null;
          } else if (rolling) {
            actionBtn.textContent = "🎲 Rolling…";
            actionBtn.disabled = true;
            actionBtn.classList.add("disabled");
            actionBtn.onclick = null;
          } else if (moving) {
            actionBtn.textContent = "Moving…";
            actionBtn.disabled = true;
            actionBtn.classList.add("disabled");
            actionBtn.onclick = null;
          } else if (game.phase === "move") {
            if (targetMove) {
              actionBtn.textContent = targetMove.piece.progress < 0
                ? "✨ Enter Piece"
                : "👉 Move Selected Piece";
              actionBtn.disabled = false;
              actionBtn.classList.remove("disabled");
              actionBtn.onclick = () => {
                if (targetMove && !moving) {
                  apply(targetMove, "action-button-move");
                }
              };
            } else if (opts.length === 0) {
              actionBtn.textContent = "Pass turn";
              actionBtn.disabled = false;
              actionBtn.classList.remove("disabled");
              actionBtn.onclick = () => passRemainingRolls();
            } else {
              actionBtn.textContent = "👉 Move Piece";
              actionBtn.disabled = false;
              actionBtn.classList.remove("disabled");
              actionBtn.onclick = () => {
                const first = opts[0];
                if (first && !moving) apply(first, "action-button-fallback");
              };
            }
          } else if (game.phase === "roll") {
            actionBtn.textContent = game.history.length > 0
              ? "🎲 Roll Dice (Bonus throw!)"
              : "🎲 Roll Dice";
            actionBtn.disabled = false;
            actionBtn.classList.remove("disabled");
            actionBtn.onclick = () => {
              if (canRoll) roll();
            };
          } else {
            actionBtn.textContent = "🎲 Roll Dice";
            actionBtn.disabled = true;
            actionBtn.classList.add("disabled");
            actionBtn.onclick = null;
          }
        }

        const openingEntryRequired = opts.some(
          (move) => move.test.openingEntry,
        );

        // 3. Pass Button (#passBtn)
        const passBtn = $("passBtn");
        if (passBtn) {
          const canPass = game.phase === "move" && isHumanTurn && !openingEntryRequired && !moving && !rolling;
          passBtn.hidden = game.phase !== "move" || !isHumanTurn || openingEntryRequired;
          passBtn.disabled = !canPass;
          passBtn.onclick = () => {
            if (canPass) passRemainingRolls();
          };
        }

        $("statusTitle").textContent =
          game.phase === "done"
            ? "🏆 " + winner.name + " wins!"
            : p.avatar + " " + p.name + "’s turn";
        if ($("statusText")) {
          const isWaitingPeer = multiplayer.active && !isHumanTurn;
          $("statusText").textContent =
            game.phase === "done"
              ? winner.name + " brought all six pieces to the center. The game is complete."
              : isWaitingPeer
                ? "Waiting for " + p.name + " to " + (game.phase === "roll" ? "roll dice" : "make a move") + "…"
                : game.phase === "roll"
                  ? "Roll the Dayakattai dice" +
                    (game.history.length
                      ? " · bonus throw! Follow the glowing route around the board."
                      : " · Follow the glowing route around the board.")
                  : openingEntryRequired
                    ? "Use this player’s first-round entry allowance to put a piece on the board."
                    : "Choose a roll, then tap a gold-outlined " +
                      p.avatar +
                      " piece. " +
                      chosen.length +
                      " move" +
                      (chosen.length === 1 ? " is" : "s are") +
                      " available.";
        }
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
        const canRollDice = canRoll;
        const diceEl = document.querySelector(".dice");
        if (diceEl) {
          diceEl.classList.toggle("rollable", canRollDice);
          diceEl.setAttribute("aria-label", canRollDice ? "Dice — Click to roll" : "Dice");
          if (canRollDice) {
            diceEl.title = "Click to roll dice";
            diceEl.setAttribute("tabindex", "0");
          } else if (game.phase === "move") {
            diceEl.title = "Dice already rolled — Select a piece to move";
            diceEl.setAttribute("tabindex", "0");
          } else {
            diceEl.removeAttribute("title");
            diceEl.removeAttribute("tabindex");
          }

          diceEl.onclick = () => {
            if (game.phase === "move" && isHumanTurn && !moving) {
              warnDiceAlreadyRolled();
            } else if (canRollDice) {
              roll();
            }
          };

          diceEl.onkeydown = (e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              diceEl.click();
            }
          };
        }

        updateAudioToggle();
        scheduleComputerIfNeeded();
      }

      function calculatePlayerScore(p) {
        if (!p || !Array.isArray(p.pieces)) return 0;
        let score = 0;
        for (const piece of p.pieces) {
          if (piece.progress === 43) {
            score += 100;
          } else if (piece.progress >= 0) {
            score += piece.progress + 1;
          }
        }
        if (p.captured) score += 50;
        if (p.rank === 1) score += 200;
        if (p.bonusPoints) score += p.bonusPoints;
        return score;
      }
      window.calculatePlayerScore = calculatePlayerScore;

      /**
       * Celebratory goal splash when a coin reaches the sacred center (D4 / Goal).
       * Congratulates the player, highlights the avatar, and confirms the +1 bonus point.
       */
      function showGoalSplash(square = "D4", playerName = "Player", avatar = "✨") {
        const board = $("board");
        if (!board) return;
        const splash = document.createElement("div");
        splash.className = "goal-splash";
        splash.innerHTML =
          '<div class="goal-splash-title"><span>🎯</span><span>Center Reached!</span></div>' +
          '<div class="goal-splash-detail">🎉 Congratulations ' + escapeHtml(playerName) + '! ' + avatar + ' reached the sacred center!</div>' +
          '<div class="goal-splash-bonus">⭐ +1 Bonus Point Awarded!</div>';

        let sqEl = null;
        if (square) {
          sqEl = board.querySelector('.cell[data-sq="' + square + '"]');
        }
        if (sqEl) {
          const rect = sqEl.getBoundingClientRect();
          const boardRect = board.getBoundingClientRect();
          splash.style.left = (rect.left - boardRect.left + rect.width / 2) + "px";
          splash.style.top = (rect.top - boardRect.top + rect.height / 2) + "px";
        } else {
          splash.classList.add("centered");
        }
        board.appendChild(splash);
        if (typeof playTone === "function") {
          playTone(659.25, 0.2, "triangle");
          setTimeout(() => playTone(880.0, 0.3, "triangle"), 150);
        }
        setTimeout(() => {
          if (splash.parentNode) splash.parentNode.removeChild(splash);
        }, 2900);
      }
      window.showGoalSplash = showGoalSplash;

      function showCaptureSplash(square, detailText = "") {
        const board = $("board");
        if (!board) return;
        const splash = document.createElement("div");
        splash.className = "capture-splash";
        splash.innerHTML =
          '<div class="capture-splash-title"><span class="capture-splash-icon">⚔️</span><span class="capture-splash-text">Captured!</span></div>' +
          (detailText ? '<div class="capture-splash-detail">' + escapeHtml(detailText) + '</div>' : "");
        
        let sqEl = null;
        if (square) {
          sqEl = board.querySelector('.cell[data-sq="' + square + '"]');
        }
        if (sqEl) {
          const rect = sqEl.getBoundingClientRect();
          const boardRect = board.getBoundingClientRect();
          splash.style.left = (rect.left - boardRect.left + rect.width / 2) + "px";
          splash.style.top = (rect.top - boardRect.top + rect.height / 2) + "px";
        } else {
          splash.classList.add("centered");
        }
        board.appendChild(splash);
        if (typeof playTone === "function") {
          playTone(587.33, 0.16, "triangle");
        }
        setTimeout(() => {
          if (splash.parentNode) splash.parentNode.removeChild(splash);
        }, 2400);
      }
      window.showCaptureSplash = showCaptureSplash;

      async function animateCapturedPiecesToTable(square, targets) {
        if (!square || !targets || !targets.length) return;
        const board = $("board");
        if (!board) return;
        const sqEl = board.querySelector('.cell[data-sq="' + square + '"]');
        if (!sqEl) return;
        const startRect = sqEl.getBoundingClientRect();

        const animations = targets.map((target) => {
          return new Promise((resolve) => {
            const victim = target.other || (target.playerId ? game.players.find((p) => p.id === target.playerId) : null);
            if (!victim) {
              resolve();
              return;
            }
            const playerCard = document.querySelector('.player[data-player-id="' + victim.id + '"]') ||
              document.querySelectorAll(".player")[game.players.indexOf(victim)];
            
            const targetRect = playerCard ? playerCard.getBoundingClientRect() : null;

            const flyer = document.createElement("div");
            flyer.className = "captured-flying-piece";
            const size = Math.max(26, Math.min(38, Math.round(startRect.width * 0.72)));
            flyer.style.width = size + "px";
            flyer.style.height = size + "px";
            flyer.style.background = victim.color || "#e74c3c";
            flyer.innerHTML = '<span style="font-size:1.15rem;line-height:1;">' + (victim.avatar || "🔴") + '</span>';

            const startX = startRect.left + startRect.width / 2 - size / 2;
            const startY = startRect.top + startRect.height / 2 - size / 2;
            flyer.style.left = startX + "px";
            flyer.style.top = startY + "px";
            flyer.style.opacity = "1";
            flyer.style.transform = "scale(1.15)";

            document.body.appendChild(flyer);

            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                if (targetRect) {
                  const destX = targetRect.left + 24;
                  const destY = targetRect.top + targetRect.height / 2 - size / 2;
                  flyer.style.transform = "translate(" + (destX - startX) + "px, " + (destY - startY) + "px) scale(0.85)";
                } else {
                  flyer.style.transform = "translate(0px, 80px) scale(0.6)";
                }
                flyer.style.opacity = "0.9";
              });
            });

            const animDuration = (typeof demo !== "undefined" && demo) ? scaledDemoDelay(950) : 950;
            setTimeout(() => {
              if (flyer.parentNode) flyer.parentNode.removeChild(flyer);
              if (playerCard) {
                playerCard.classList.remove("reserve-bounce");
                void playerCard.offsetWidth;
                playerCard.classList.add("reserve-bounce");
                setTimeout(() => playerCard.classList.remove("reserve-bounce"), 500);
              }
              resolve();
            }, animDuration);
          });
        });

        await Promise.all(animations);
      }
      window.animateCapturedPiecesToTable = animateCapturedPiecesToTable;

      function warnDiceAlreadyRolled() {
        const diceEl = document.querySelector(".dice");
        if (!diceEl) return;

        // 1. Horizontal shake vibration on the dice
        diceEl.classList.remove("dice-shake-warn");
        void diceEl.offsetWidth;
        diceEl.classList.add("dice-shake-warn");
        setTimeout(() => diceEl.classList.remove("dice-shake-warn"), 550);

        // 2. Pulse attention on the Move Selected Piece button
        const moveBtn = document.getElementById("moveBtn");
        if (moveBtn) {
          moveBtn.classList.remove("pulse-attention");
          void moveBtn.offsetWidth;
          moveBtn.classList.add("pulse-attention");
          setTimeout(() => moveBtn.classList.remove("pulse-attention"), 1500);
        }

        // 3. Highlight legal cells on the board
        const legalCells = document.querySelectorAll(".cell.legal");
        legalCells.forEach((c) => {
          c.classList.add("cell-highlight-attention");
          setTimeout(() => c.classList.remove("cell-highlight-attention"), 1500);
        });

        // 4. Floating visual toast directly over the dice
        let banner = document.getElementById("diceWarnBanner");
        if (!banner) {
          banner = document.createElement("div");
          banner.id = "diceWarnBanner";
          banner.className = "dice-warn-banner";
          diceEl.appendChild(banner);
        }
        banner.textContent = "👉 Dice rolled! Pick a piece to move.";
        banner.classList.add("visible");
        if (banner._warnTimer) clearTimeout(banner._warnTimer);
        banner._warnTimer = setTimeout(() => banner.classList.remove("visible"), 2600);

        // 5. Explicit status prompt
        const statusEl = document.getElementById("statusText");
        if (statusEl) {
          statusEl.innerHTML =
            '<strong style="color:#ffa94d;">⚠️ Dice already rolled!</strong> Tap a piece on the board or click "Move selected piece".';
        }

        // 6. Audio cue if enabled
        if (typeof playTone === "function") {
          playTone(320, 0.12, "sine");
        }

        if (typeof FlightRecorder !== "undefined") {
          FlightRecorder.record("DICE_CLICK_DURING_MOVE_PHASE_WARNED", {
            phase: game ? game.phase : "unknown",
            pool: game ? [...game.pool] : [],
          });
        }
      }
      const DEMO_STEPS = [
        () => {
          const p1 = (game && game.players && game.players[0]) || { name: "Maya", avatar: "🎃" };
          return demoScene(
            p1.name + " starts. Each player has six pieces waiting off the board.",
            () => {
              game.current = 0;
              game.turn = 1;
              game.phase = "roll";
              game.pool = [];
              game.history = [];
              game.last = null;
            },
          );
        },
        () => {
          const p1 = (game && game.players && game.players[0]) || { name: "Maya", avatar: "🎃" };
          return demoScene(
            p1.name + " rolls a 1. A roll of 1 can bring a piece onto the starting square and also earns a bonus roll.",
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
          );
        },
        () => {
          const p1 = (game && game.players && game.players[0]) || { name: "Maya", avatar: "🎃" };
          const avName1 = (typeof getPlayerAvatarSpeechName === "function")
            ? getPlayerAvatarSpeechName(p1)
            : "piece";
          return demoScene(
            "The " + avName1 + " enters on its colored starting square.",
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
        () => {
          const p1 = (game && game.players && game.players[0]) || { name: "Maya", avatar: "🎃" };
          const avName1 = (typeof getPlayerAvatarSpeechName === "function")
            ? getPlayerAvatarSpeechName(p1)
            : "piece";
          return demoScene(
            "The " + avName1 + " moves two spaces along the glowing route. " + p1.name + "’s turn is over.",
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
          );
        },
        () => {
          const p2 = (game && game.players && game.players[1]) || { name: "Player 2", avatar: "👻" };
          return demoScene(
            "Now it is " + p2.name + "’s turn. The highlighted player card always shows whose turn it is.",
            () => {},
          );
        },
        () => {
          const p2 = (game && game.players && game.players[1]) || { name: "Player 2", avatar: "👻" };
          const avName2 = (typeof getPlayerAvatarSpeechName === "function")
            ? getPlayerAvatarSpeechName(p2)
            : "piece";
          return demoScene(
            p2.name + " rolls a 1, so the " + avName2 + " can enter the board.",
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
          );
        },
        () => {
          const p2 = (game && game.players && game.players[1]) || { name: "Player 2", avatar: "👻" };
          const avName2 = (typeof getPlayerAvatarSpeechName === "function")
            ? getPlayerAvatarSpeechName(p2)
            : "piece";
          return demoScene(
            "The " + avName2 + " enters on " + p2.name + "’s colored starting square.",
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
          );
        },
        () => {
          const p1 = (game && game.players && game.players[0]) || { name: "Maya", avatar: "🎃" };
          const p2 = (game && game.players && game.players[1]) || { name: "Player 2", avatar: "👻" };
          const avName2 = (typeof getPlayerAvatarSpeechName === "function")
            ? getPlayerAvatarSpeechName(p2)
            : "piece";
          return demoScene(
            "Capture example: " + p1.name + " rolls 1 while " + p2.name + "’s " + avName2 + " is one space ahead on an unprotected square.",
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
          );
        },
        () => {
          const p1 = (game && game.players && game.players[0]) || { name: "Maya", avatar: "🎃" };
          const p2 = (game && game.players && game.players[1]) || { name: "Player 2", avatar: "👻" };
          const avName1 = (typeof getPlayerAvatarSpeechName === "function")
            ? getPlayerAvatarSpeechName(p1)
            : "piece";
          const avName2 = (typeof getPlayerAvatarSpeechName === "function")
            ? getPlayerAvatarSpeechName(p2)
            : "piece";
          return demoScene(
            "The " + avName1 + " lands on the " + avName2 + "! " + p2.name + "’s piece returns to reserve, and " + p1.name + " earns the capture needed to enter the inner track.",
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
          );
        },
        () => {
          const p2 = (game && game.players && game.players[1]) || { name: "Player 2", avatar: "👻" };
          return demoScene(
            p2.name + " also completes a capture. Both players can now follow the inner route, so the automatic match will continue until one player finishes all six pieces and wins, or you interrupt it.",
            () => {
              game.players[1].captured = true;
              game.current = 0;
              game.pool = [];
              game.history = [];
              game.phase = "roll";
            },
          );
        },
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
