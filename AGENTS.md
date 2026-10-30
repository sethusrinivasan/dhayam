# Dhayam agent guide

## Purpose

Dhayam is a static, Dayakattai-inspired local board game. Preserve its core qualities: understandable turns, visible piece state, fair dice values, and an audit that helps identify fairness or stuck-game issues.

## Fast path

```sh
npm test
npm run test:coverage
python3 -m http.server 8000 --directory site
```

The game UI is in `site/index.html`. The tested, immutable rules engine is in `src/game.ts`. Unit tests are in `test/game.test.ts`.

## Change guidelines

- Treat `src/game.ts` as the rule authority. When changing a rule, update it and its tests first; keep browser behavior aligned while the UI is migrated to consume the engine directly.
- Keep the game deployable as static files. Do not add accounts, telemetry, or a server unless the task explicitly requires them.
- Use `crypto.getRandomValues` for normal dice randomness. Do not make dice outcomes player-specific.
- Preserve the audit’s ordered events, piece numbers, player names, moves, captures, passes, winner, and bonus-chain fields.
- Keep each game action understandable on screen: square-by-square movement, explicit capture feedback, and a clear winner stop condition.
- Maintain accessible labels, keyboard interaction, responsive layouts, and reduced-motion support.
- Escape any organizer-provided player name before inserting it into HTML.

## Verification

Run `npm test` for every rules change. Run `npm run test:coverage` when changing rules or test coverage. For UI changes, also perform the browser acceptance checks in [docs/test-plan.md](docs/test-plan.md).

## Documentation

Keep `README.md` brief. Put durable technical detail in `docs/` and update it when a design, risk, test procedure, or AI-assisted development disclosure changes.
