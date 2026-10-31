# 📜 Dhayam: Project Milestones, Architecture & RCA Journey

A succinct, one-page executive summary documenting how Dhayam was conceived, engineered, diagnosed, and hardened step-by-step into a production-grade edge multiplayer game.

---

## 1. Genesis & Philosophy
* **Goal**: Build an authentic, accessible web implementation of the ancient Tamil board game **Dhayam** (தாயக்கட்டை) playable across mobile, tablet, and desktop without accounts or runtime servers.
* **Core Tenets**: Zero external UI dependencies, 100% static hosting on Cloudflare & GitHub Pages, cryptographic randomness (`crypto.getRandomValues`), accessible DOM labels, and an immutable rules authority.

---

## 2. Chronological Milestones & Problem-Solving Journey

### Milestone 1: Immutable Rules Engine & Local Board
* **What was built**: Authored `src/game.ts` as the single source of truth for Dayakattai rules (44-square symmetric track, first-round entry allowances, safe sanctuaries `A4/D7/G4/D1/B2/B6/F2/F6`, capture prerequisite for inner track, exact rolls to finish).
* **Key Challenge**: Dice outcomes in traditional Dhayam feature bonus turns on rolls of 1, 5, 6, and 12. Multiple bonus rolls accumulate into a single pool before pawns are moved.
* **Fix**: Implemented deterministic pool accumulation and backtracking move validators; validated with strict unit tests (`npm test`).

### Milestone 2: 3D Rolling Physics & Responsive Tabletop UI
* **What was built**: Pure CSS 3D cuboidal brass dice tumbling with random torque, SVG circuit overlay, floating reactions, theme picker (🎃 Halloween, 🪵 Wood, 🏛️ Bronze, 🌌 Nebula), and speech commentary.
* **Key Challenge**: Turn deadlocks caused by unhandled roll animations or player desyncs.
* **Fix**: Implemented `try-finally` lifecycle guards on `rolling` and `moving` state flags with fallback recovery in `turn.js`.

### Milestone 3: Real-Time Edge Multiplayer (Cloudflare Durable Objects)
* **What was built**: Room creation (`cloudflare/worker.js`) via Cloudflare Workers Durable Objects with WebSocket Hibernation, seat claiming, and reconnection tokens. P2P fallback via WebRTC PeerJS.
* **Key Challenge**: Reconnected players or concurrent browser tabs desynchronizing on dropped action frames.
* **Fix**: Authoritative server-side state broadcasts (`SYNC_STATE`) after every roll, move, pass, or rejection.

### Milestone 4: Diagnostic Black Box (Flight Recorder)
* **What was built**: Circular in-memory event buffer (`site/js/recorder.js`) capturing the last 400 system, DOM click, keyboard, WebSocket, and game transitions with 1-click clipboard export (`🛫`).
* **Why it matters**: Allowed instant zero-setup post-mortem debugging of edge network issues directly from live users.

### Milestone 5: 8-Player Scaling & Quantum Speed (32×–128×)
* **What was built**: Expanded game capacity from 2–4 players up to 8 concurrent players (`P0` through `P7`) with dedicated avatars and color identities. Added Quantum Mode running at 32× speed (configurable up to 128× via slider) with commentary automatically muted for rapid demo simulations.
* **Key Challenge**: At 128× speed, local execution attempts actions faster than network latency.
* **Fix**: Applied a minimum WAN network pacing floor (160ms) for Cloudflare DO requests to allow SQLite persistence and 8-way fan-out to settle cleanly.

### Milestone 6: Turn 22 Freeze RCA & Complete Resilience Overhaul
* **The Incident**: User flight recorder revealed an 8-player live Cloudflare demo stalled indefinitely at Turn 22 with Noah holding a bonus roll of `12` (`pool: [12]`, `phase: "roll"`).
* **Root Cause Analysis (RCA)**:
  1. *The Watchdog Killer*: `handleRealDemoWsMessage` unconditionally cleared `demoWatchdogTimer` upon receiving *any* message. At `+00:26.763`, a 20s keepalive `PONG` arrived from Cloudflare, clearing the watchdog timer without scheduling a new turn.
  2. *Single Socket Ping*: Only seat 0 sent keepalive PINGs, risking idle drops on seats 1–7.
* **Structured Fix**:
  1. **PONG Short-Circuit**: `if (data.type === "PONG") return;` — transport keepalives never touch turn timers.
  2. **Selective Disarmament**: Only authoritative state updates (`INIT`, `SYNC_STATE`, `ERROR`) clear the watchdog.
  3. **Multi-Socket Keepalive**: PING broadcasts across all active guest WebSockets.
  4. **Autonomous Periodic Stall Detector**: Self-healing loop checking liveliness every 3 seconds; if idle > 5s, it queries `GET_STATE` and re-kicks the turn runner.

### Milestone 7: 30-Second Liveliness Game Timer
* **What was built**: Monospace top-navigation timer (`#gameTimer`) displaying match duration with second-level accuracy (`⏱️ MM:SS`).
* **How it works**: Updates every 30 seconds with a visual heartbeat pulse highlight, confirms JavaScript event loop liveliness, and appends `HEARTBEAT` diagnostics to Flight Recorder.

### Milestone 8: Goal Congratulations, Coin Entry Bonus Scoring & Build Metadata
* **What was built**:
  1. **Coin Enters Board Bonus**: When a player moves a piece from reserve onto the board, they are awarded +1 bonus point (`player.bonusPoints`), logged in Flight Recorder, and celebrated via toast and floating star emote.
  2. **Center Goal Congratulations & Bonus**: When a coin reaches the sacred center (progress 43 / `D4`), an animated celebration splash (`.goal-splash`) congratulates the player, awards +1 bonus point, triggers multi-emoji fireworks (`🎯`, `🏆`, `🎉`), and announces the milestone via commentary.
  3. **Build Provenance**: Added authoritative build metadata (`BUILD_INFO` v0.2.0, Build #43) displayed at the bottom of the page footer (`#buildNumberBadge` and `#buildUpdatedTimestamp`) with ISO timestamp.

---

## 3. Verification & CI/CD Pipeline
| Gate | Mechanism | Purpose |
| :--- | :--- | :--- |
| **Unit & Rules Tests** | `npm test` (66 tests) | Verifies immutable rules authority, MCP endpoints, bonus scoring, and regression guards |
| **Deployment Gate** | `npx wrangler deploy --env staging` | Compiles Worker and deploys static assets with zero secret leakage |
| **Automated E2E Gate** | `node scripts/e2e-live-check.js` | Headless Chrome verifies 49 cells, 8 players, Quantum 32×, 128× speed slider, Game Timer, Build badge, and live dice click |

---
*Maintained under [docs/](file:///home/home/github/dhayam/docs/) for complete project provenance.*
