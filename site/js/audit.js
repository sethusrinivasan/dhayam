/**
 * audit.js - Game Audit Logging & Export
 *
 * Tracks every roll, piece move, capture, pass, and full board state snapshot
 * for transparent fairness verification and stuck-game post-mortems.
 */
"use strict";

      function createAudit(mode) {
        const startedAt = new Date();
        return {
          version: 1,
          id:
            startedAt.toISOString().replace(/[-:.TZ]/g, "") +
            "-" +
            Math.random().toString(36).slice(2, 8),
          startedAt: startedAt.toISOString(),
          startedMs: Date.now(),
          mode,
          events: [],
        };
      }
      function auditBoardState() {
        return game.players
          .map(
            (player) =>
              player.id +
              "[" +
              player.pieces.map((piece) => piece.progress).join(",") +
              "]" +
              (player.captured ? ":capture" : "") +
              (player.rank ? ":rank" + player.rank : ""),
          )
          .join(" ");
      }
      function recordAudit(type, details = {}) {
        if (!audit || !game) return;
        const player = game.players[game.current];
        audit.events.push({
          sequence: audit.events.length + 1,
          elapsedMs: Date.now() - audit.startedMs,
          turn: game.turn,
          playerId: player?.id ?? null,
          playerName: player?.name ?? null,
          phase: game.phase,
          pool: [...game.pool],
          type,
          details,
          board: auditBoardState(),
        });
      }
      function auditText() {
        const rolls = audit.events.filter((event) => event.type === "ROLL"),
          moves = audit.events.filter((event) => event.type === "MOVE"),
          passes = audit.events.filter((event) => event.type === "PASS"),
          pacingAssists = audit.events.filter(
            (event) => event.type === "PACING_ASSIST",
          ),
          distribution = {},
          playerRolls = Object.fromEntries(
            game.players.map((player) => [player.id, {}]),
          );
        let consecutiveNoLegal = 0,
          longestNoLegal = 0;
        for (const event of audit.events) {
          if (event.type === "ROLL") {
            const value = event.details.value;
            distribution[value] = (distribution[value] || 0) + 1;
            const counts = playerRolls[event.playerId];
            if (counts) counts[value] = (counts[value] || 0) + 1;
          }
          if (
            event.type === "PASS" &&
            event.details.reason === "NO_LEGAL_MOVE"
          ) {
            consecutiveNoLegal++;
            longestNoLegal = Math.max(longestNoLegal, consecutiveNoLegal);
          } else if (event.type === "MOVE") consecutiveNoLegal = 0;
        }
        const lines = [
          "DHAYAM GAME AUDIT v" + audit.version,
          "Game ID: " + audit.id,
          "Started: " + audit.startedAt,
          "Exported: " + new Date().toISOString(),
          "Mode: " + audit.mode,
          "Status: " + game.phase,
          "Rules: Heritage 7x7 house variant; first-round entry allowances; exact finish; capture required for inner track",
          "Players: " +
            game.players
              .map(
                (player) =>
                  player.id +
                  "=" +
                  player.name +
                  " (" +
                  (player.computer ? "computer" : "human") +
                  ", seat " +
                  player.seat +
                  ")",
              )
              .join("; "),
          "",
          "SUMMARY",
          "Turns started: " + game.turn,
          "Rolls: " + rolls.length,
          "Roll distribution: " +
            Object.entries(distribution)
              .sort((a, b) => Number(a[0]) - Number(b[0]))
              .map(([value, count]) => value + "=" + count)
              .join(", "),
          "Rolls by player:",
          ...game.players.map((player) => {
            const counts = playerRolls[player.id],
              total = Object.values(counts).reduce(
                (sum, count) => sum + count,
                0,
              );
            return (
              "  " +
              player.name +
              ": total=" +
              total +
              "; " +
              Object.entries(counts)
                .sort((a, b) => Number(a[0]) - Number(b[0]))
                .map(([value, count]) => value + "=" + count)
                .join(", ")
            );
          }),
          "Moves: " + moves.length,
          "Adaptive pacing assists: " + pacingAssists.length,
          "Captures: " +
            moves.reduce(
              (total, event) => total + event.details.captures.length,
              0,
            ),
          "Passes: " + passes.length,
          "No-legal-move passes: " +
            passes.filter((event) => event.details.reason === "NO_LEGAL_MOVE")
              .length,
          "Longest consecutive no-legal-move sequence: " + longestNoLegal,
          "Rankings: " +
            game.players
              .filter((player) => player.rank)
              .sort((a, b) => a.rank - b.rank)
              .map((player) => player.rank + ". " + player.name)
              .join(", "),
          "",
          "EVENT LOG",
        ];
        for (const event of audit.events) {
          lines.push(
            "#" +
              event.sequence +
              " +" +
              (event.elapsedMs / 1000).toFixed(1) +
              "s | turn " +
              event.turn +
              " | " +
              (event.playerName || "system") +
              " | " +
              event.type +
              " | " +
              JSON.stringify(event.details) +
              " | pool=[" +
              event.pool.join(",") +
              "] | state=" +
              event.board,
          );
        }
        return lines.join("\n");
      }
      async function copyGameAudit(feedbackEl = null) {
        const text = auditText();
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          const area = document.createElement("textarea");
          area.value = text;
          area.style.position = "fixed";
          area.style.opacity = "0";
          document.body.appendChild(area);
          area.select();
          document.execCommand("copy");
          area.remove();
        }
        const button = $("copyAuditBtn");
        if (button) button.textContent = "✓ Audit copied";
        if ($("auditHint")) {
          $("auditHint").textContent =
            audit.events.length + " timestamped events copied as plain text.";
        }
        if (feedbackEl) {
          feedbackEl.textContent = "✓ " + audit.events.length + " audit events copied to clipboard!";
          setTimeout(() => { feedbackEl.textContent = ""; }, 2500);
        }
        if (button) setTimeout(() => (button.textContent = "📋 Copy game audit"), 2200);
      }
