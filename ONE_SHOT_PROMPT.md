# One-shot implementation prompt

You are maintaining **Dhayam**, a static Dayakattai-inspired board game hosted from `site/`. Complete the requested change end to end: inspect the existing behavior, make the smallest coherent implementation, keep the browser UI and `src/game.ts` rules engine aligned, add or update meaningful tests, run `npm test` and `npm run test:coverage`, and update concise documentation.

Priorities, in order:

1. Rule correctness and fair, player-neutral random behavior.
2. Clear, accessible interaction on phone, tablet, and laptop screens.
3. Visible state transitions: numbered pieces, movement, captures, winner declaration, and audit trail.
4. Static hosting compatibility: no backend, accounts, analytics, or hidden network dependency unless explicitly requested.
5. Human-readable code, comments for non-obvious algorithms, and no unrelated refactors.

Use `AGENTS.md` for repository guidance and `docs/` for architecture, decisions, threats, and the test plan. The game audit is for future fairness and stuck-game analysis, so preserve its fields and add relevant fields for new mechanics.
