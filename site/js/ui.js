/**
 * ui.js - DOM Board Rendering & Visual Synchronization
 *
 * Renders the 7x7 grid cells, active tokens with numbered badges, animated SVG path flows,
 * player cards, accessible piece-selection dropdowns, and interactive roll chips.
 */
"use strict";

      let animationRenderPending = false;

      function renderAnimationStep() {
        const isFastDemo =
          typeof demo !== "undefined" &&
          demo &&
          typeof demoSpeed !== "undefined" &&
          demoSpeed >= 32;
        if (!isFastDemo) {
          render();
          return;
        }
        if (animationRenderPending) return;
        animationRenderPending = true;
        const flush = () => {
          animationRenderPending = false;
          render();
        };
        if (typeof requestAnimationFrame === "function") {
          requestAnimationFrame(flush);
        } else {
          setTimeout(flush, 16);
        }
      }

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
                const pieceMoves = pieces
                  .map((piece) => ({
                    piece,
                    move: legal.get(piece.id) || opts.find((option) => option.piece.id === piece.id),
                  }))
                  .filter(({ move }) => move);
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
                t.dataset.pieceIds = pieces.map((piece) => piece.id).join(",");
                t.style.background = p.color;
                if (pieces.some((piece) => piece.id === movingPieceId)) {
                  const cellSize = Math.min(el.clientWidth, el.clientHeight);
                  if (cellSize > 0) {
                    t.style.setProperty("--moving-token-size", cellSize + "px");
                  }
                }
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
                if (pieces.some((piece) => piece.id === movingPieceId)) {
                  if (movingStepRemaining > 0) {
                    const countdown = document.createElement("span");
                    countdown.className = "move-countdown";
                    countdown.textContent = String(movingStepRemaining);
                    countdown.setAttribute("aria-label", "Steps remaining: " + movingStepRemaining);
                    t.appendChild(countdown);
                  } else {
                    t.classList.add("destination-reached");
                  }
                }

                if (pieceMoves.length > 1 && isCurrentPlayer && game.phase === "move") {
                  const hintList = document.createElement("span");
                  hintList.className = "piece-route-hints";
                  for (const { piece, move } of pieceMoves) {
                    const pieceNumber = p.pieces.indexOf(piece) + 1;
                    const currentSquare = node(p, piece);
                    const nextProgress = piece.progress < 0 ? 0 : piece.progress + 1;
                    const nextSquare = ROUTES[p.seat][Math.min(nextProgress, 43)];
                    const targetSquare = ROUTES[p.seat][move.test.progress];
                    const routeName = move.test.progress >= 25 ? "inner" : "outer";
                    const arrow =
                      currentSquare === targetSquare && routeName === "inner"
                        ? "↘"
                        : nextSquare === targetSquare
                          ? "→"
                          : "↗";
                    const hint = document.createElement("button");
                    hint.type = "button";
                    hint.className = "piece-route-hint";
                    hint.textContent = "#" + pieceNumber + " " + arrow + " " + routeName;
                    hint.title =
                      "Move piece #" +
                      pieceNumber +
                      " toward the " +
                      routeName +
                      " track";
                    hint.onclick = (event) => {
                      event.stopPropagation();
                      if (multiplayer.active && !isMyTurn()) return;
                      selectedPieceId = piece.id;
                      if ($("moveChoice")) $("moveChoice").value = piece.id;
                      apply(move, "piece-route-choice");
                    };
                    hint.addEventListener("mouseenter", () => {
                      if (game && game.phase === "move") updateMovePreviews(piece.id);
                    });
                    hint.addEventListener("mouseleave", () => {
                      if (game && game.phase === "move") updateMovePreviews(selectedPieceId);
                    });
                    hintList.appendChild(hint);
                  }
                  el.appendChild(hintList);
                }

                // Direct piece click or touch: immediately initiate "move selected piece" action
                if (isCurrentPlayer && !demo && !active().computer && !moving) {
                  t.style.cursor = "pointer";
                  const hasAmbiguousMove = pieceMoves.length > 1;
                  t.title = hasAmbiguousMove
                    ? "Choose which piece to move below the stack"
                    : "Click to move piece " + pieceNumbers.join(", ");
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

                    if (pieceMoves.length > 1) {
                      $("statusText").textContent =
                        "Choose a numbered piece below the stack.";
                      return;
                    }

                    let moveOpt = pieceMoves[0]?.move;
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
                  t.addEventListener("mouseenter", () => {
                    if (game && game.phase === "move") {
                      updateMovePreviews(pieces[0]?.id);
                    }
                  });
                  t.addEventListener("mouseleave", () => {
                    if (game && game.phase === "move") {
                      updateMovePreviews(selectedPieceId);
                    }
                  });
                }

                holder.appendChild(t);
              }
              el.appendChild(holder);
            }
            const isClickableTurn = !demo && (multiplayer.active ? isMyTurn() : !active().computer) && !moving;
            if (isClickableTurn) {
              el.onclick = () => {
                // 1. Direct Click on Destination Square (Interactive Move Destination)
                if (el._previewMove && !el.classList.contains("source-selected")) {
                  if (typeof FlightRecorder !== "undefined") {
                    FlightRecorder.record("DESTINATION_CELL_CLICKED", {
                      sq,
                      pieceId: el._previewMove.piece.id,
                      targetProgress: el._previewMove.test.progress,
                    });
                  }
                  apply(el._previewMove, "destination-cell-click");
                  return;
                }

                // 2. Click on Origin or Entry Square
                if (can) {
                  const currentGroup = occupied.filter((item) => item.p === active());
                  const currentMoves = currentGroup
                    .map((item) => legal.get(item.piece.id) || opts.find((option) => option.piece.id === item.piece.id))
                    .filter(Boolean);
                  if (currentMoves.length > 1) {
                    $("statusText").textContent =
                      "Choose a numbered piece below the stack.";
                    return;
                  }
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
                }
              };
              el.addEventListener("keydown", (e) => {
                if ((e.key === "Enter" || e.key === " ") && (can || el._previewMove)) {
                  e.preventDefault();
                  el.click();
                }
              });
            }
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
              (p.persona ? ' <span class="persona-tag" style="background:' + (p.persona.color || p.color) + '22;border:1px solid ' + (p.persona.color || p.color) + '66;color:' + (p.persona.color || p.color) + ';font-size:0.75rem;padding:2px 6px;border-radius:10px;margin-left:4px;" title="' + escapeHtml(p.persona.bio || '') + '">' + escapeHtml(typeof getLanguage === "function" && getLanguage() === "ta" && p.persona.titleTa ? p.persona.titleTa : p.persona.title) + '</span>' : "") +
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
              (p.captured ? (typeof t === "function" ? t("capture_earned") : "⚔️ Capture earned (+50)") : (typeof t === "function" ? t("capture_needed") : "Capture needed")) +
              (p.bonusPoints ? " · ⭐ " + p.bonusPoints + " " + (typeof t === "function" ? t("bonus_unit") : "bonus") : "") +
              '</div><div class="piecestatus"><span><b>' +
              (typeof t === "function" ? t("waiting") : "Waiting") +
              ':</b> ' +
              waiting +
              "</span><span><b>" +
              (typeof t === "function" ? t("on_board") : "On board") +
              ':</b> ' +
              onBoard +
              "</span><span><b>" +
              (typeof t === "function" ? t("home") : "Home") +
              ':</b> ' +
              home +
              "</span></div></div>" +
              (active() === p && game.phase !== "done"
                ? '<div class="turn">● ' + (typeof t === "function" ? t("turn_badge") : "Turn") + '</div>'
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
          card.addEventListener("mouseenter", () => {
            if (game && game.phase === "move") {
              const entryMove = entry || anyEntryOpt;
              if (entryMove) updateMovePreviews(entryMove.piece.id);
            }
          });
          card.addEventListener("mouseleave", () => {
            if (game && game.phase === "move") {
              updateMovePreviews(selectedPieceId);
            }
          });
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
            ""
          : game.players.length +
            " players · Local pass-and-play";
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
              ? (typeof t === "function" ? t("action_opening_entry") : "＋ Opening entry allowance")
              : (typeof t === "function" ? t("action_enter_roll_chip") : "＋ Enter a piece");
            enter.onclick = () => apply(entry, "entry-button");
            enter.addEventListener("mouseenter", () => {
              if (game && game.phase === "move") updateMovePreviews(entry.piece.id);
            });
            enter.addEventListener("mouseleave", () => {
              if (game && game.phase === "move") updateMovePreviews(selectedPieceId);
            });
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
              b.addEventListener("mouseenter", () => {
                if (game && game.phase === "move") updateMovePreviews(selectedPieceId, i);
              });
              b.addEventListener("mouseleave", () => {
                if (game && game.phase === "move") updateMovePreviews(selectedPieceId, selectedRoll);
              });
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
              b.addEventListener("mouseenter", () => {
                if (game && game.phase === "move") updateMovePreviews(selectedPieceId, -1);
              });
              b.addEventListener("mouseleave", () => {
                if (game && game.phase === "move") updateMovePreviews(selectedPieceId, selectedRoll);
              });
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
            moveChoiceEl.oninput = (event) => {
              updateMovePreviews(event.target.value);
            };
          }
        }

        // 1. Move Selected Piece Button (#moveBtn)
        const moveBtn = $("moveBtn");
        if (moveBtn) {
          moveBtn.hidden = false;
          if (moving) {
            moveBtn.textContent = typeof t === "function" ? t("action_moving") : "Moving…";
            moveBtn.disabled = true;
            moveBtn.onclick = null;
          } else if (canMove && targetMove) {
            moveBtn.textContent = targetMove.piece.progress < 0
              ? (typeof t === "function" ? t("action_enter_piece") : "✨ Enter Piece")
              : (typeof t === "function" ? t("action_move_selected") : "Move selected piece");
            moveBtn.disabled = false;
            moveBtn.onclick = () => {
              if (canMove && targetMove && !moving) {
                apply(targetMove, "move-button");
              }
            };
          } else {
            moveBtn.textContent = typeof t === "function" ? t("action_move_selected") : "Move selected piece";
            moveBtn.disabled = true;
            moveBtn.onclick = null;
          }
        }

        // 2. Roll Dice Button (#actionBtn)
        const actionBtn = $("actionBtn");
        if (actionBtn) {
          if (game.phase === "done") {
            actionBtn.textContent = typeof t === "function" ? t("action_new_match") : "🏆 New match";
            actionBtn.title = "Start a new match (Shortcut: Space, R, or N)";
            actionBtn.disabled = false;
            actionBtn.classList.remove("disabled");
            actionBtn.onclick = () => newGame(game.players.length, game.computerCount);
          } else if (demo) {
            actionBtn.textContent = "Demo playing…";
            actionBtn.title = "Demo playing";
            actionBtn.disabled = true;
            actionBtn.classList.add("disabled");
            actionBtn.onclick = null;
          } else if (multiplayer.active && !isMyTurn()) {
            actionBtn.textContent = typeof t === "function" ? t("action_waiting_for", { name: p.name }) : "Waiting for " + p.name + "…";
            actionBtn.title = "Waiting for remote player";
            actionBtn.disabled = true;
            actionBtn.classList.add("disabled");
            actionBtn.onclick = null;
          } else if (p.computer) {
            actionBtn.textContent = rolling
              ? (typeof t === "function" ? t("action_rolling") : p.name + " rolling…")
              : moving
                ? (typeof t === "function" ? t("action_moving") : p.name + " moving…")
                : (typeof t === "function" ? t("action_thinking", { name: p.name }) : p.name + " is thinking…");
            actionBtn.title = p.name + " turn";
            actionBtn.disabled = true;
            actionBtn.classList.add("disabled");
            actionBtn.onclick = null;
          } else if (rolling) {
            actionBtn.textContent = typeof t === "function" ? t("action_rolling") : "🎲 Rolling…";
            actionBtn.title = "Rolling dice…";
            actionBtn.disabled = true;
            actionBtn.classList.add("disabled");
            actionBtn.onclick = null;
          } else if (moving) {
            actionBtn.textContent = typeof t === "function" ? t("action_moving") : "Moving…";
            actionBtn.title = "Moving piece…";
            actionBtn.disabled = true;
            actionBtn.classList.add("disabled");
            actionBtn.onclick = null;
          } else if (game.phase === "move") {
            if (targetMove) {
              actionBtn.textContent = targetMove.piece.progress < 0
                ? (typeof t === "function" ? t("action_enter_piece") : "✨ Enter Piece")
                : (typeof t === "function" ? t("action_move_selected") : "👉 Move Selected Piece");
              actionBtn.title = "Move piece (Shortcut: Enter or M, or press 1-6)";
              actionBtn.disabled = false;
              actionBtn.classList.remove("disabled");
              actionBtn.onclick = () => {
                if (targetMove && !moving) {
                  apply(targetMove, "action-button-move");
                }
              };
            } else if (opts.length === 0) {
              actionBtn.textContent = typeof t === "function" ? t("action_pass_turn") : "Pass turn";
              actionBtn.title = "Pass turn (Shortcut: Space or Enter)";
              actionBtn.disabled = false;
              actionBtn.classList.remove("disabled");
              actionBtn.onclick = () => passRemainingRolls();
            } else {
              actionBtn.textContent = typeof t === "function" ? t("action_move_selected") : "👉 Move Piece";
              actionBtn.title = "Move piece (Shortcut: Enter or M, or press 1-6)";
              actionBtn.disabled = false;
              actionBtn.classList.remove("disabled");
              actionBtn.onclick = () => {
                const first = opts[0];
                if (first && !moving) apply(first, "action-button-fallback");
              };
            }
          } else if (game.phase === "roll") {
            actionBtn.textContent = typeof t === "function"
              ? (game.history.length > 0 ? t("action_roll_bonus") : t("action_roll_dice"))
              : (game.history.length > 0 ? "🎲 Roll Dice (Bonus throw!)" : "🎲 Roll Dice");
            actionBtn.title = "Roll the dice (Shortcut: Space or R)";
            actionBtn.disabled = false;
            actionBtn.classList.remove("disabled");
            actionBtn.onclick = () => {
              if (canRoll) roll();
            };
          } else {
            actionBtn.textContent = typeof t === "function" ? t("action_roll_dice") : "🎲 Roll Dice";
            actionBtn.title = "Roll dice";
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
          passBtn.textContent = typeof t === "function" ? t("action_pass") : "Pass";
          passBtn.onclick = () => {
            if (canPass) passRemainingRolls();
          };
        }

        // 4. Withdraw Buttons (#withdrawBtn & #menuWithdrawBtn)
        const withdrawBtn = $("withdrawBtn");
        const menuWithdrawBtn = $("menuWithdrawBtn");
        const isSignedIn = typeof DhayamAuth !== "undefined" && Boolean(DhayamAuth.getCurrentUser());
        const canWithdraw = isSignedIn && game && game.phase !== "done" && !demo;

        if (withdrawBtn) {
          withdrawBtn.hidden = !canWithdraw;
          if (canWithdraw) {
            withdrawBtn.textContent = typeof t === "function" ? t("action_withdraw") : "\ud83c\udff3\ufe0f Withdraw (-100 pts)";
            withdrawBtn.onclick = () => {
              if (typeof requestWithdrawal === "function") requestWithdrawal();
            };
          }
        }
        if (menuWithdrawBtn) {
          menuWithdrawBtn.hidden = !canWithdraw;
          if (canWithdraw) {
            menuWithdrawBtn.textContent = typeof t === "function" ? t("action_withdraw") : "\ud83c\udff3\ufe0f Withdraw (-100 pts)";
            menuWithdrawBtn.onclick = () => {
              if (typeof requestWithdrawal === "function") requestWithdrawal();
            };
          }
        }

        $("statusTitle").textContent =
          game.phase === "done"
            ? "🏆 " + (typeof t === "function" ? t("winner_title", { name: winner.name }) : winner.name + " wins!")
            : p.avatar + " " + (typeof t === "function" ? t("turn_title", { name: p.name }) : p.name + "’s turn");
        if ($("statusText")) {
          const isWaitingPeer = multiplayer.active && !isHumanTurn;
          $("statusText").textContent =
            game.phase === "done"
              ? (typeof t === "function"
                  ? t("status_winner_detail", { name: winner.name })
                  : winner.name + " brought all six pieces to the center. The game is complete.")
              : isWaitingPeer
                ? (typeof t === "function"
                    ? t("status_waiting_peer", { name: p.name, action: game.phase === "roll" ? t("status_roll_dice") : t("status_make_move") })
                    : "Waiting for " + p.name + " to " + (game.phase === "roll" ? "roll dice" : "make a move") + "…")
                : game.phase === "roll"
                  ? (typeof t === "function"
                      ? (game.history.length ? t("status_roll_prompt_bonus") : t("status_roll_prompt_normal"))
                      : "Roll the Dayakattai dice" +
                        (game.history.length
                          ? " · bonus throw! Follow the glowing route around the board."
                          : " · Follow the glowing route around the board."))
                  : openingEntryRequired
                    ? (typeof t === "function"
                        ? t("status_opening_entry")
                        : "Use this player’s first-round entry allowance to put a piece on the board.")
                    : (typeof t === "function"
                        ? t("status_choose_roll", {
                            avatar: p.avatar,
                            count: chosen.length,
                            plural: chosen.length === 1 ? " is" : "s are",
                          })
                        : "Choose a roll, then tap a gold-outlined " +
                          p.avatar +
                          " piece. " +
                          chosen.length +
                          " move" +
                          (chosen.length === 1 ? " is" : "s are") +
                          " available.");
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
              ? (typeof t === "function" ? t("dhayam_bonus_badge") : "✨ Dhayam! · Bonus throw")
              : isBonus
                ? (typeof t === "function" ? t("bonus_throw", { val }) : "✨ Bonus throw (" + val + ")")
                : isChainEnded
                  ? (typeof t === "function" ? t("bonus_chain_complete") : "Bonus chain complete")
                  : (typeof t === "function" ? t("normal_roll") : "Normal roll");

            diceHintEl.className = "lastroll-container";
            diceHintEl.innerHTML =
              '<div class="lastroll-header">' + (typeof t === "function" ? t("last_roll") : "Last Roll") + '</div>' +
              '<div class="lastroll-main">' +
              '<span class="lastroll-number">' + val + "</span>" +
              (isDhayam ? '<span class="lastroll-name">' + (typeof t === "function" ? t("dhayam") : "Dhayam") + '</span>' : "") +
              "</div>" +
              '<div class="' + badgeClass + '">' + badgeText + "</div>";
          } else {
            diceHintEl.className = "lastroll-container";
            diceHintEl.innerHTML =
              '<div class="lastroll-helper-init">' + (typeof t === "function" ? t("dice_helper_init") : "Two traditional dice · Click dice to roll.<br>Roll 1, 5, 6, or 12 for a bonus throw.") + '</div>';
          }
        }
        const canRollDice = canRoll;
        const diceEl = document.querySelector(".dice");
        if (diceEl) {
          diceEl.classList.toggle("rollable", canRollDice);
          diceEl.setAttribute("aria-label", canRollDice ? "Dice — Click to roll" : "Dice");
          if (canRollDice) {
            diceEl.title = typeof t === "function" ? t("dice_click_to_roll") : "Click to roll dice";
            diceEl.setAttribute("tabindex", "0");
          } else if (game.phase === "move") {
            diceEl.title = typeof t === "function" ? t("dice_already_rolled_title") : "Dice already rolled — Select a piece to move";
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
        updateMovePreviews();
        if (typeof updateTurnThinkingTimer === "function") {
          updateTurnThinkingTimer();
        }
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
       * Spectacular Game-Ending Victory Celebration
       * Launches Web Audio conch fanfare, full-screen canvas confetti & fireworks,
       * persona-driven gender-aligned voice praise, and glowing golden trophy modal.
       */
      function triggerSpectacularVictory(winner) {
        if (!winner) return;

        // 1. Procedural conch shell (Shankha) & brass fanfare sound
        if (typeof playVictoryFanfare === "function") {
          playVictoryFanfare();
        }

        // 2. Full-screen celebratory canvas confetti & fireworks
        if (typeof launchConfettiCelebration === "function") {
          launchConfettiCelebration(7000);
        }

        // 3. Spoken congratulation
        const isTamil = typeof getLanguage === "function" && getLanguage() === "ta";
        const opponent = game && game.players ? game.players.find((p) => p !== winner && p.computer) : null;
        let speechText = "";

        if (winner.name === "You" && opponent && opponent.persona) {
          speechText = isTamil
            ? "\u0b85\u0bb0\u0bc1\u0bae\u0bc8\u0baf\u0bbe\u0ba9 \u0b86\u0b9f\u0bcd\u0b9f\u0bae\u0bcd! \u0ba8\u0bc0\u0b99\u0bcd\u0b95\u0bb3\u0bcd \u0ba4\u0bbe\u0baf\u0bae\u0bcd \u0b86\u0b9f\u0bcd\u0b9f\u0ba4\u0bcd\u0ba4\u0bbf\u0ba9\u0bcd \u0bae\u0bbe\u0baa\u0bc6\u0bb0\u0bc1\u0bae\u0bcd \u0bb5\u0bc6\u0bb1\u0bcd\u0bb1\u0bbf\u0baf\u0bbe\u0bb3\u0bb0\u0bcd!"
            : "Magnificent game! You outmaneuvered my pieces and mastered the sacred Dayakattai. All hail the champion!";
          if (typeof speakGame === "function") {
            speakGame(speechText, { player: opponent });
          }
        } else if (winner.persona) {
          speechText = isTamil
            ? winner.name + " \u0bb5\u0bc6\u0bb1\u0bcd\u0bb1\u0bbf \u0baa\u0bc6\u0bb1\u0bcd\u0bb1\u0bbe\u0bb0\u0bcd! \u0ba4\u0bbe\u0baf\u0bae\u0bcd \u0b86\u0b9f\u0bcd\u0b9f\u0ba4\u0bcd\u0ba4\u0bbf\u0ba9\u0bcd \u0bae\u0bbe\u0baa\u0bc6\u0bb0\u0bc1\u0bae\u0bcd \u0bb5\u0bc6\u0bb1\u0bcd\u0bb1\u0bbf\u0baf\u0bbe\u0bb3\u0bb0\u0bcd!"
            : "A glorious victory! The spirits of Dayakattai favored " + winner.name + "'s strategy today!";
          if (typeof speakGame === "function") {
            speakGame(speechText, { player: winner });
          }
        }

        // 4. Modal presentation with match battle statistics
        const winnerScore = calculatePlayerScore(winner);
        const turnsCount = game ? game.turn : 1;
        const totalBonus = winner.bonusPoints || 0;
        const safeEscaper = typeof escapeHtml === "function" ? escapeHtml : (s) => String(s);

        const titleText = isTamil
          ? "👑 " + safeEscaper(winner.name) + " \u0bb5\u0bc6\u0bb1\u0bcd\u0bb1\u0bbf \u0bb5\u0bbe\u0b95\u0bc8 \u0b9a\u0bc2\u0b9f\u0bbf\u0ba9\u0bbe\u0bb0\u0bcd! 👑"
          : "👑 All Hail " + safeEscaper(winner.name) + " — Champion of Dhayam! 👑";

        const modalHtml =
          '<div class="victory-celebration-panel" style="text-align:center;padding:12px 6px;">' +
            '<div class="victory-trophy-glow" style="font-size:3.5rem;animation:pulse 1.8s infinite;margin-bottom:8px;">🪔</div>' +
            '<div class="avatar victory-champion-avatar" style="width:72px;height:72px;line-height:72px;font-size:2.4rem;margin:0 auto 12px;background:' + (winner.color || "#d97706") + ';box-shadow:0 0 24px ' + (winner.color || "#d97706") + '88;border-radius:50%;">' +
              winner.avatar +
            '</div>' +
            '<p style="font-size:1.05rem;color:#fde68a;font-weight:700;margin:4px 0 16px;">' +
              (isTamil ? "\u0baa\u0bb0\u0bae\u0baa\u0ba4\u0ba4\u0bcd\u0ba4\u0bbf\u0ba9\u0bcd \u0b86\u0bb1\u0bc1 \u0b95\u0bbe\u0baf\u0bcd\u0b95\u0bb3\u0bc8\u0baf\u0bc1\u0bae\u0bcd \u0ba8\u0bbf\u0bb2\u0bc8\u0ba8\u0bbe\u0b9f\u0bcd\u0b9f\u0bbf\u0baf \u0bb5\u0bc6\u0bb1\u0bcd\u0bb1\u0bbf\u0ba4\u0bcd \u0ba4\u0bbf\u0bb2\u0b95\u0bae\u0bcd!" : "Master of the Sacred 4-Dice Board of Dayakattai") +
            '</p>' +
            '<div class="victory-stats-grid" style="display:grid;grid-template-columns:repeat(2, 1fr);gap:10px;max-width:360px;margin:0 auto 16px;text-align:left;">' +
              '<div style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);padding:8px 12px;border-radius:8px;">' +
                '<span style="font-size:0.75rem;color:#94a3b8;display:block;">' + (isTamil ? "\u0bae\u0bca\u0ba4\u0bcd\u0ba4 \u0baa\u0bc1\u0bb3\u0bcd\u0bb3\u0bbf\u0b95\u0bb3\u0bcd" : "Final Score") + '</span>' +
                '<strong style="font-size:1.25rem;color:#f59e0b;">' + winnerScore + ' <span style="font-size:0.8rem;">pts</span></strong>' +
              '</div>' +
              '<div style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);padding:8px 12px;border-radius:8px;">' +
                '<span style="font-size:0.75rem;color:#94a3b8;display:block;">' + (isTamil ? "\u0b86\u0b9f\u0bcd\u0b9f\u0b9a\u0bcd \u0b9a\u0bc1\u0bb1\u0bcd\u0bb1\u0bc1\u0b95\u0bb3\u0bcd" : "Turns Played") + '</span>' +
                '<strong style="font-size:1.25rem;color:#38bdf8;">' + turnsCount + '</strong>' +
              '</div>' +
              '<div style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);padding:8px 12px;border-radius:8px;">' +
                '<span style="font-size:0.75rem;color:#94a3b8;display:block;">' + (isTamil ? "\u0bb5\u0bc6\u0b9f\u0bcd\u0b9f\u0bc1 \u0ba8\u0bbf\u0bb2\u0bc8" : "Capture Earned") + '</span>' +
                '<strong style="font-size:1.1rem;color:#4ade80;">' + (winner.captured ? "⚔️ Yes (+50)" : "None") + '</strong>' +
              '</div>' +
              '<div style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);padding:8px 12px;border-radius:8px;">' +
                '<span style="font-size:0.75rem;color:#94a3b8;display:block;">' + (isTamil ? "\u0baa\u0bcb\u0ba9\u0bb8\u0bcd \u0baa\u0bc1\u0bb3\u0bcd\u0bb3\u0bbf\u0b95\u0bb3\u0bcd" : "Bonus Points") + '</span>' +
                '<strong style="font-size:1.25rem;color:#e879f9;">+' + totalBonus + '</strong>' +
              '</div>' +
            '</div>' +
          '</div>';

        if (typeof showModal === "function") {
          showModal(
            titleText,
            modalHtml,
            isTamil ? "\u0bae\u0bc0\u0ba3\u0bcd\u0b9f\u0bc1\u0bae\u0bcd \u0b86\u0b9f\u0bc1" : "⚔️ Play Rematch",
            () => {
              if (typeof stopCelebration === "function") stopCelebration();
              if (typeof newGame === "function") newGame(game ? game.players.length : 2, game ? game.computerCount : 1);
            }
          );
        }

        // Record win in persistent datastore or prompt guest claim
        if (typeof DhayamAuth !== "undefined" && typeof DhayamAuth.onGameWin === "function") {
          DhayamAuth.onGameWin(winner, winnerScore, winner.captured ? 1 : 0);
        }
      }
      window.triggerSpectacularVictory = triggerSpectacularVictory;

      function updateMovePreviews(overridePieceId, overrideRollIndex) {
        if (typeof document === "undefined" || typeof document.querySelectorAll !== "function") return;

        // Clear previous destination and source highlights
        const prevCells = document.querySelectorAll(
          ".cell.target-destination, .cell.source-selected, .cell.possible-destination",
        );
        prevCells.forEach((c) => {
          c.classList.remove(
            "target-destination",
            "target-capture",
            "target-sanctuary",
            "target-goal",
            "target-normal",
            "source-selected",
            "possible-destination",
          );
          delete c._previewMove;
          const badge = c.querySelector(".destination-badge");
          if (badge) badge.remove();
          if (c._origAriaLabel) {
            c.setAttribute("aria-label", c._origAriaLabel);
            delete c._origAriaLabel;
          }
        });

        if (!game || game.phase !== "move" || moving) return;

        const p = active();
        if (!p) return;
        const isHumanTurn =
          !demo && (multiplayer.active ? isMyTurn() : !p.computer);
        if (!isHumanTurn && !demo) return;

        const opts = typeof options === "function" ? options() : [];
        if (!opts.length) return;

        const rollIdx =
          typeof overrideRollIndex === "number"
            ? overrideRollIndex
            : selectedRoll;

        // 1. Identify the focused piece ID
        let pieceId = overridePieceId || selectedPieceId;
        if (!pieceId) {
          const defaultOpt =
            opts.find((o) =>
              rollIdx === -1
                ? o.indices.length === game.pool.length
                : o.indices.length === 1 && o.indices[0] === rollIdx,
            ) || opts[0];
          pieceId = defaultOpt?.piece?.id;
        }

        // 2. Mark secondary possible destinations across all other candidate moves
        opts.forEach((opt) => {
          if (opt.piece.id !== pieceId) {
            const otherSq = ROUTES[p.seat][opt.test.progress];
            const otherCell = document.querySelector(`.cell[data-sq="${otherSq}"]`);
            if (otherCell && !otherCell.classList.contains("possible-destination")) {
              otherCell.classList.add("possible-destination");
            }
          }
        });

        // 3. Mark the source origin cell for the primary focused piece
        if (pieceId) {
          const piece = p.pieces.find((q) => q.id === pieceId);
          if (piece) {
            const originSq = node(p, piece) || START[p.seat];
            const originCell = document.querySelector(`.cell[data-sq="${originSq}"]`);
            if (originCell) originCell.classList.add("source-selected");
          }
        }

        // 4. Find candidate moves for this focused piece
        let candidateMoves = opts.filter((o) => o.piece.id === pieceId);
        if (rollIdx !== undefined && rollIdx !== null) {
          const matchingRollMoves = candidateMoves.filter((o) =>
            rollIdx === -1
              ? o.indices.length === game.pool.length
              : o.indices.length === 1 && o.indices[0] === rollIdx,
          );
          if (matchingRollMoves.length > 0) {
            candidateMoves = matchingRollMoves;
          }
        }

        // 5. Render tactical highlights and badges on destination cells
        for (const move of candidateMoves) {
          const destSq = ROUTES[p.seat][move.test.progress];
          const cellEl = document.querySelector(`.cell[data-sq="${destSq}"]`);
          if (!cellEl) continue;

          cellEl.classList.add("target-destination");
          cellEl._previewMove = move;
          if (!cellEl._origAriaLabel) {
            cellEl._origAriaLabel = cellEl.getAttribute("aria-label") || destSq;
          }

          const badge = document.createElement("span");
          badge.className = "destination-badge";
          badge.setAttribute("aria-hidden", "true");

          const pieceNumber = p.pieces.indexOf(move.piece) + 1;
          let tacticalDesc = "";

          if (move.test.progress === 43 || destSq === "D4") {
            cellEl.classList.add("target-goal");
            badge.classList.add("badge-goal");
            const label = typeof t === "function" ? t("badge_goal") : "GOAL";
            badge.innerHTML =
              '<span class="dest-icon">🎯</span><span class="dest-label">' + label + '</span>';
            tacticalDesc = `Center goal milestone for piece #${pieceNumber}`;
          } else if (move.test.targets && move.test.targets.length > 0) {
            cellEl.classList.add("target-capture");
            badge.classList.add("badge-capture");
            const victim = move.test.targets[0].other;
            const victimAvatar = victim?.avatar ? `${victim.avatar} ` : "";
            const label = typeof t === "function" ? t("badge_capture") : "CAPTURE";
            badge.innerHTML = `<span class="dest-icon">⚔️</span><span class="dest-label">${victimAvatar}${label}</span>`;
            tacticalDesc = `Capture ${victim?.name || "opponent"} with piece #${pieceNumber}`;
          } else if (move.piece.progress < 0) {
            cellEl.classList.add("target-normal");
            badge.classList.add("badge-normal");
            const label = typeof t === "function" ? t("badge_enter") : "ENTER";
            badge.innerHTML =
              '<span class="dest-icon">✨</span><span class="dest-label">' + label + '</span>';
            tacticalDesc = `Enter piece #${pieceNumber} onto starting square ${destSq}`;
          } else if (SAFE.has(destSq)) {
            cellEl.classList.add("target-sanctuary");
            badge.classList.add("badge-sanctuary");
            const label = typeof t === "function" ? t("badge_sanctuary") : "SAFE";
            badge.innerHTML =
              '<span class="dest-icon">🛡️</span><span class="dest-label">' + label + '</span>';
            tacticalDesc = `Safe sanctuary for piece #${pieceNumber}`;
          } else {
            cellEl.classList.add("target-normal");
            badge.classList.add("badge-normal");
            const sumVal = move.values.reduce((sum, v) => sum + v, 0);
            badge.innerHTML = `<span class="dest-icon">➔</span><span class="dest-label">+${sumVal}</span>`;
            tacticalDesc = `Advance piece #${pieceNumber} ${sumVal} squares to ${destSq}`;
          }

          cellEl.appendChild(badge);
          cellEl.setAttribute(
            "aria-label",
            `${cellEl._origAriaLabel}, move destination: ${tacticalDesc}`,
          );
        }
      }
      window.updateMovePreviews = updateMovePreviews;

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
        }, 3800);
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

            const animDuration = (typeof demo !== "undefined" && demo) ? scaledDemoDelay(1450) : 1450;
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
        banner.textContent = typeof t === "function" ? t("toast_dice_rolled") : "👉 Dice rolled! Pick a piece to move.";
        banner.classList.add("visible");
        if (banner._warnTimer) clearTimeout(banner._warnTimer);
        banner._warnTimer = setTimeout(() => banner.classList.remove("visible"), 2600);

        // 5. Explicit status prompt
        const statusEl = document.getElementById("statusText");
        if (statusEl) {
          statusEl.innerHTML = typeof t === "function"
            ? t("warn_already_rolled_html")
            : '<strong style="color:#ffa94d;">⚠️ Dice already rolled!</strong> Tap a piece on the board or click "Move selected piece".';
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
