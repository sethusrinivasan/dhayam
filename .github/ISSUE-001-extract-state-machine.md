# Extract Dhayam Game Logic as a State Machine

**Goal**: Refactor the core game rules (currently in `src/game.ts` and the various UI helpers) into an explicit deterministic state‑machine. This will improve testability, auditability, and make future extensions (e.g., new speed presets, 16/32‑player matches, multiplayer sync) easier to manage.

---

## Motivation
- Centralize all rule logic in a single, declarative model.
- Enable exhaustive transition testing.
- Provide a clean hook for `recordAudit` to log `{from, event, to}`.
- Facilitate visual documentation (Mermaid diagram, XState visualizer).
- Simplify multiplayer state synchronization – peers only need to broadcast events.

---

## Scope
1. **Define state diagram** (high‑level and detailed sub‑states) and commit a Mermaid diagram in `docs/architecture.md`.
2. **Choose implementation approach** – either a lightweight reducer (TypeScript) or a library such as **XState**.
3. **Map existing functions** (`engine.isLegalMove`, `engine.applyMove`, `engine.checkWin`, etc.) to pure transition functions.
4. **Replace UI event dispatches** (`rollBtn.onclick`, `moveBtn.onclick`, …) with `machine.send(event)` calls.
5. **Integrate audit hook** after each transition.
6. **Update test suite** to cover all state transitions.
7. **Document migration steps** in `docs/migration-to-state-machine.md`.

---

## Acceptance Criteria
- All game rules are encapsulated in a single state‑machine module (e.g., `src/stateMachine.ts`).
- Existing UI functions compile without TypeScript errors after being switched to the machine.
- `npm test` passes with 100 % transition coverage.
- A Mermaid diagram in `docs/architecture.md` visualizes the machine and stays up‑to‑date.
- The issue is linked from the project board (e.g., “Backlog → Ready”).

---

## Dependencies
- Optional: `xstate` npm package (if chosen). Otherwise, no new runtime dependency.
- Existing `recordAudit` remains untouched but will be called from the machine’s actions.

---

## Estimated Effort
- **Research & design**: 4 h
- **Implementation**: 8 h
- **Testing & documentation**: 4 h
- **Review & integration**: 2 h

_Total: ~18 hours (≈ 2 working days)_

---

## References
- Current rule implementation: `src/game.ts`
- UI event handling: `site/js/ui.js`, `site/js/app.js`
- Existing audit: `site/js/recorder.js`
- Example state‑machine implementation: XState docs (https://xstate.js.org/docs/)

---

**Label(s)**: `enhancement`, `refactor`, `state-machine`

---

*Created via Antigravity on 2026‑10‑31.*