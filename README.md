# Dhayam

Dhayam is a browser board game for local pass-and-play or one human against 1–5 computer opponents.

Play the browser version at <https://sethusrinivasan.github.io/dhayam/>.

## Rules engine

The first production-oriented milestone is a dependency-free TypeScript rules engine in `src/game.ts`. It covers seating, rotational routes, Dayakattai values, entry, ordered roll allocation, the capture prerequisite, safe squares, captures, and exact finishing. The engine uses immutable move application so it can later support an authoritative multiplayer event service.

Run the tests with Node 22.18 or newer:

```sh
npm test
```

The static browser prototype is published from `site/` through GitHub Pages while its UI is migrated to the tested engine.

## Implementation notes

- The north-facing 44-position route is rotated for each seat, so every player follows the same movement algorithm from a different starting point.
- Move validation applies stored rolls in order. It checks entry, exact finishing, the capture prerequisite, safe squares, and captures after each value.
- The browser animates movement by advancing the piece state one square every 650 milliseconds, then commits captures and turn changes at the destination. Guided-demo viewers can scale the complete pace from 0.5× to 2×.
- Computer players score legal moves by finish, capture, board entry, combined-roll use, and distance. A short delay after narration keeps automated play readable.
- The guided demo plans bonus-roll sequences that end with a non-bonus value, waits for spoken commentary to finish, and continues until a player wins or the viewer pauses it.
- The first player to move all six pieces to the center wins. The game announces that player and stops immediately; no later turns are played.
- Commentary alternates available feminine and masculine browser voices by player. The game audit can be copied as plain text and includes dice distributions by player, every move and capture, passes, rankings, timestamps, and compact board snapshots for fairness and stuck-game analysis.
