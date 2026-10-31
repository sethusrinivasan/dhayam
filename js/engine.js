/**
 * engine.js - Rules Engine, Move Validation & Candidate Evaluation
 *
 * Enforces reserve piece entry on 1 (Dhayam), safe square coexistence, single-opponent
 * capture on unsafe squares, multi-occupancy blocking, and exact-count goal finish.
 */
"use strict";

      function openingEntryAvailable(p, piece, values) {
        // A roll of 1 is always the normal way to enter.  Fair dice make a 1
        // only 12.5% likely, so an opening can otherwise leave most players
        // waiting in reserve. Each player receives one first-round allowance,
        // which makes the launch lively without changing dice probabilities.
        return (
          game.turn <= game.players.length &&
          !game.openingEntryPlayers.includes(p.id) &&
          piece.progress === -1 &&
          values.length === 1
        );
      }
      function moveCandidate(p, piece, values) {
        // Validate each roll in order. This matters when combined rolls capture
        // midway through a move and thereby unlock the protected inner track.
        const openingEntry =
          values[0] !== 1 && openingEntryAvailable(p, piece, values);
        let pos = piece.progress,
          captured = p.captured,
          targets = [];
        for (const value of values) {
          if (pos === 43) return null;
          if (pos === -1) {
            if (value !== 1 && !openingEntry) return null;
            pos = 0;
          } else {
            const next = pos + value;
            if (next > 43) return null;
            if (next >= 25 && !captured) return null;
            pos = next;
          }
          const sq = ROUTES[p.seat][pos];
          const enemies = game.players
            .filter((other) => other !== p)
            .flatMap((other) =>
              other.pieces
                .filter(
                  (q) =>
                    q.progress >= 0 && q.progress < 43 && node(other, q) === sq,
                )
                .map((q) => ({ other, q })),
            );
          if (!SAFE.has(sq) && sq !== "D4") {
            if (enemies.length > 1) return null;
            if (enemies.length === 1) {
              captured = true;
              targets.push(enemies[0]);
            }
          }
        }
        return { progress: pos, captured, targets, openingEntry };
      }
      function options() {
        if (!game || game.phase !== "move") return [];
        const p = active(),
          result = [];
        const subsets = [];
        for (let i = 0; i < game.pool.length; i++)
          subsets.push({ indices: [i], values: [game.pool[i]] });
        if (game.pool.length > 1 && game.pool.length <= 12)
          subsets.push({
            indices: game.pool.map((_, i) => i),
            values: [...game.pool],
          });
        for (const piece of p.pieces)
          for (const s of subsets) {
            const test = moveCandidate(p, piece, s.values);
            if (test)
              result.push({
                piece,
                indices: s.indices,
                values: s.values,
                test,
              });
          }
        return result;
      }
      const DICE_OUTCOMES = [
        { a: 0, b: 1, value: 1 },
        { a: 1, b: 0, value: 1 },
        { a: 0, b: 2, value: 2 },
        { a: 1, b: 1, value: 2 },
        { a: 2, b: 0, value: 2 },
        { a: 0, b: 3, value: 3 },
        { a: 1, b: 2, value: 3 },
        { a: 2, b: 1, value: 3 },
        { a: 3, b: 0, value: 3 },
        { a: 1, b: 3, value: 4 },
        { a: 2, b: 2, value: 4 },
        { a: 3, b: 1, value: 4 },
        { a: 2, b: 3, value: 5 },
        { a: 3, b: 2, value: 5 },
        { a: 3, b: 3, value: 6 },
        { a: 0, b: 0, value: 12 },
      ];
      function hasActionInThisRound() {
        // A round is one turn per player. The live audit is the source of
        // truth, making each pacing decision visible in the exported log.
        const roundStart = game.turn - game.players.length + 1;
        return audit.events.some(
          (event) => event.type === "MOVE" && event.turn >= roundStart,
        );
      }
      function pacingAssistRoll() {
        // Normal dice stay fair. Only on the final turn of an otherwise empty
        // round is one legal face outcome selected, and that intervention is
        // recorded before the roll for later fairness analysis.
        const isRoundCloser = game.turn % game.players.length === 0;
        if (
          !isRoundCloser ||
          hasActionInThisRound() ||
          game.turn <= game.players.length ||
          game.pacingAssistTurn === game.turn
        ) return null;
        const player = active();
        const useful = DICE_OUTCOMES.filter((outcome) =>
          player.pieces.some((piece) =>
            moveCandidate(player, piece, [outcome.value]),
          ),
        );
        if (!useful.length) return null;
        const selected = useful[Math.floor(randomUnit() * useful.length)];
        recordAudit("PACING_ASSIST", {
          reason: "NO_ACTION_IN_ROUND",
          eligibleOutcomes: useful.map((outcome) => outcome.value),
          selectedValue: selected.value,
        });
        game.pacingAssistTurn = game.turn;
        return { ...selected, pacingAssist: true };
      }

      function bestAutomaticMove() {
        // Computer players prefer finishing, then capturing, entering a piece,
        // combining rolls, and finally the move with the greatest progress.
        const moves = options();
        return (
          moves.sort((a, b) => {
            const score = (m) =>
              (m.test.progress === 43 ? 100000 : 0) +
              (m.test.targets.length ? 50000 : 0) +
              (m.piece.progress < 0 ? 8000 : 0) +
              (m.indices.length > 1 ? 1000 : 0) +
              m.test.progress;
            return score(b) - score(a);
          })[0] || null
        );
      }
