# AI‑Driven Demo Mode Feature Plan

## Goal
Enable **Demo mode** to run automatically with AI agents controlling each player. Users can:
1. Supply API tokens for popular AI providers (OpenAI, Anthropic, Google Gemini, etc.).
2. Choose the number of players (2–8, with future support for 16/32).
3. Assign an AI model to each player (different models per player are allowed).
4. Watch the game play itself, optionally recording the audit trail.

## High‑Level Requirements
| Category | Requirement |
|----------|--------------|
| **Configuration UI** | Settings panel to add/edit AI provider tokens, select model (e.g., `gpt‑4o`, `claude‑3‑opus`, `gemini‑1.5‑pro`). |
| **Player‑AI Mapping** | Dropdown per player to pick a model/token combination. |
| **Auto‑Run Engine** | When Demo mode starts, the engine calls the selected AI model for each turn to decide moves. |
| **Rate‑Limit & Cost Guardrails** | Show estimated token usage per game, allow max‑cost limit, and optional “dry‑run” mode that only logs decisions. |
| **Fallback** | If an AI call fails, fallback to simple heuristic (random legal move) to keep the demo alive. |
| **Security** | Tokens stored only in `localStorage` (or optionally in a short‑lived session cookie). Never commit to repo. |
| **Extensibility** | Architecture should support plug‑in providers via a common interface (`callModel(prompt, options)`). |
| **Testing** | Unit tests for the AI wrapper, integration tests with mock providers, and end‑to‑end Cypress tests validating auto‑play. |
| **Documentation** | Update README with usage instructions, token safety warnings, and examples. |

## Detailed Work Breakdown
### 1. Architecture & Core API (1 week)
- Define **AIProvider** interface (`name`, `token`, `callModel`).
- Implement adapters for **OpenAI**, **Anthropic**, **Google Gemini** (thin wrappers around their REST endpoints).
- Add a **registry** to store active providers (`window.aiProviders`).
- Extend `demo.js` with a new function `runAIAutoDemo(config)` that loops through turns, invoking the appropriate provider for the current player.

### 2. UI – Settings & Token Management (1 week)
- New **“AI Settings”** tab in the existing Settings panel.
- Form fields: Provider selector, Token input (masked), Model selector (populated from provider’s model list).
- Store config in `localStorage.dhayamAIConfig` (encrypted with a simple reversible obfuscation – optional). 
- Add validation (non‑empty token, supported model).

### 3. Player‑AI Assignment UI (1 week)
- In Demo mode UI, show a **player roster** list with a dropdown per player to select an AI config.
- Allow “Human” option to keep a player under manual control.
- Auto‑populate with first provider as default.

### 4. Auto‑Run Engine Integration (2 weeks)
- Refactor existing demo loop to call `await getAIMove(playerId, gameState)`.
- `getAIMove` builds a prompt describing the current board, legal moves, and previous actions.
- Implement **prompt templates** for each provider (token‑limit aware). 
- Respect **speed factor** setting: delay between AI calls based on selected demo speed.
- Add **cost estimation** UI (show token count & estimated USD cost). 
- Implement **fallback heuristic** (random legal move) on API error/timeout.

### 5. Rate‑Limit & Safety Controls (1 week)
- Enforce per‑game max‑token ceiling (configurable, default 10 k). 
- Offer a **“dry‑run”** toggle: generate prompts and mock responses without calling the provider (use static decision tree). 
- Show a warning modal before first AI call reminding users to keep tokens secure.

### 6. Testing & CI (1 week)
- **Unit tests** for each provider wrapper (mock HTTP). 
- **Integration tests** simulating a full demo with mocked AI responses. 
- **Cypress** tests covering UI flows: adding a token, selecting AI for players, starting auto‑demo, handling failures.
- Add coverage threshold to CI (`npm run test:coverage`).

### 7. Documentation & Release (3 days)
- Update `README.md` with a new **“AI‑Driven Demo Mode”** section. 
- Add a `docs/ai-demo.md` file describing token handling, cost estimates, and example prompts. 
- Release notes entry: “Demo mode can now be powered by AI agents (OpenAI, Anthropic, Gemini).”

### 8. Post‑Release Monitoring (1 week)
- Add a lightweight telemetry event (`recordAudit('ai_demo_start')`) to track usage (opt‑out via settings). 
- Monitor error rates from provider calls; iterate on fallback heuristics.

## UX Flow (User Story)
1. User opens Settings → **AI Settings**.
2. Adds a token for OpenAI (`sk‑…`).
3. Selects model `gpt‑4o`.
4. Returns to Demo mode, sees a **Player‑AI Assignment** list.
5. Assigns the OpenAI provider to Player 1, another provider to Player 2.
6. Clicks **Start Auto Demo**.
7. The game runs automatically; a banner shows estimated token usage and cost.
8. User can pause, stop, or switch any player to “Human”.

## Risks & Mitigations
| Risk | Impact | Mitigation |
|------|--------|-----------|
| Token leakage | Security breach | Store only client‑side, never commit; mask input; show warning. |
| High API cost | Unexpected charges | Cost estimator UI, max‑token guard, dry‑run mode. |
| Provider downtime | Demo stalls | Fallback to heuristic, exponential back‑off retries. |
| Latency >30 s per turn | Poor UX | Allow user to set a **max response time**; use faster models if needed. |

## Milestones (8 weeks total)
- **Week 1** – Architecture & provider wrappers.
- **Week 2** – UI for token entry.
- **Week 3** – Player‑AI assignment UI.
- **Weeks 4‑5** – Auto‑run engine & prompt templates.
- **Week 6** – Rate‑limit, cost UI, fallback.
- **Week 7** – Testing (unit + Cypress).
- **Week 8** – Docs, release, monitoring.

## Labels & Tracking
- **Labels**: `ai-demo`, `enhancement`, `security`.
- **GitHub Project**: Add as a feature in the “AI Enhancements” column.
- **Related Issues**: This epic will be split into smaller tickets (e.g., `#15 – Provider adapters`, `#16 – AI Settings UI`).

---

*Created via Antigravity on 2026‑10‑31.*
