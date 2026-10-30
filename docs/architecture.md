# Architecture

```mermaid
flowchart LR
  Input[Player input / guided demo / CPU] --> UI[Static browser UI\nsite/index.html]
  UI --> State[In-memory game state]
  State --> Rules[Move evaluation\nroutes, entry, capture, finish]
  Rules --> Visuals[Board, piece, and capture animations]
  Rules --> Audit[Plaintext game audit]
  Audit --> Clipboard[User-initiated clipboard export]
  State --> Speech[Optional browser speech]
  Dice[crypto.getRandomValues] --> UI

  Engine[src/game.ts\nimmutable rules engine] --> UnitTests[test/game.test.ts]
  Site[site/] --> Pages[GitHub Pages workflow]
```

The browser UI is intentionally self-contained, so the game can run from static hosting without a backend. It currently contains UI-oriented rule handling. `src/game.ts` contains the dependency-free, immutable TypeScript rule engine used by the Node tests.

The migration direction is for the browser UI to consume `src/game.ts` directly. Until that is complete, rule changes must update both implementations and keep their behavior aligned.

## Runtime boundaries

- Game state exists only in the current browser tab.
- Browser APIs provide dice entropy, optional speech, and user-initiated clipboard export.
- The audit is plaintext and local until a player chooses to copy it.
- GitHub Pages serves the static `site/` directory; it is not a game server.
