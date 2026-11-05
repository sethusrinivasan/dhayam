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

### Milestone 5: 8-Player Scaling, Quantum Speed (32×–128×) & Full 32-Player Support
* **What was built**: Expanded game capacity from 2–4 players up to 8 concurrent players (`P0` through `P7`) with dedicated avatars and color identities. Added Quantum Mode running at 32× speed (configurable up to 128× via slider) with commentary automatically muted for rapid demo simulations. Extended to 16 and 32 players: `MIN_PLAYERS = 2`, `MAX_PLAYERS = 32` are authoritative constants in `src/game.ts`; `THEMES` expanded to 32 entries; Durable Object engine lifted to 32-player cap; E2E freshness gate validates 8/16/32-player `newGame` calls.
* **Key Challenge**: At 128× speed, local execution attempts actions faster than network latency. THEMES and avatar arrays previously hard-capped at 8 entries.
* **Fix**: Applied a minimum WAN network pacing floor (160ms) for Cloudflare DO requests. Expanded THEMES to 32 unique named players with distinct avatars and colors, all arrays now wrap safely with modulo indexing.

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
  3. **Build Provenance**: Added authoritative build metadata (`BUILD_INFO` v0.4.0, Build #2) displayed at the bottom of the page footer (`#buildNumberBadge` and `#buildUpdatedTimestamp`) with ISO timestamp.

### Milestone 9: Interactive Move Destination Preview & Tactical Highlights
* **What was built**:
  1. **Dynamic Destination Previews**: During the `move` phase, hovering over or selecting a movable piece on the board, hovering over the reserve player card, or hovering over dice pool chips actively illuminates prospective landing squares on the board (`.cell.target-destination`).
  2. **Origin & Destination Spatial Relationship**: The origin square of the moving piece is marked with a distinctive dashed amber halo (`.source-selected`), providing an unmistakable "From Here ➔ To There" visual trajectory.
  3. **Tactical Badges & Visual Classification**: Each landing square displays real-time tactical indicators:
     - 🎯 **Goal Milestone**: `.target-goal` with radiant golden glow and `🎯 GOAL` badge when landing on center `D4`.
     - ⚔️ **Capture Threat**: `.target-capture` with pulsing crimson halo, `⚔️ CAPTURE` badge, and victim player avatar preview.
     - 🛡️ **Sanctuary Haven**: `.target-sanctuary` with emerald border and `🛡️ SAFE` badge on traditional sanctuary squares.
     - ✨ **Board Entry**: `.target-normal` with `✨ ENTER` badge on starting squares when entering pieces from reserve.
     - ➔ **Standard Advance**: Clear step distance badge (e.g. `➔ +5`) showing projected displacement.
  4. **Direct Cell Execution**: Players can click directly on any highlighted destination square (in addition to the piece itself) to execute the move (`destination-cell-click`), improving ergonomics across mobile touchscreens and desktop mice.
  5. **Accessibility & Reduced Motion**: Dynamic `aria-label` updates on target cells communicate tactical landing details to screen readers, while `@media (prefers-reduced-motion: reduce)` automatically suppresses infinite animations in favor of high-contrast solid borders.

### Milestone 10: Authentic Bilingual Tamil & English Localization (i18n)
* **What was built**:
  1. **Default English Experience**: Game cleanly initializes in English by default across fresh browser sessions, retaining familiar terminology and navigation without unexpected language shifts.
  2. **Dedicated User Toggle**: Preference is persisted to `localStorage["dhayam_lang"]` and recorded in Flight Recorder (`LANGUAGE_CHANGED`).
  3. **Authentic Cultural Vocabulary (Tamil)**:
     - Tactical Badges: `🎯 பரமபதம்` (Goal), `⚔️ வெட்டு` (Capture), `🛡️ மலை` (Sanctuary Haven), `✨ களம் புகu` (Board Entry).
     - Action Controls: `🎲 தாயக்கட்டையை உருட்டு` (Roll Dice), `👉 காயை நகர்த்து` (Move Selected Piece), `✨ களம் புகு` (Enter Piece), `முறையை விடு` (Pass Turn), `🏆 புதிய ஆட்டம்` (New Match).
     - Live Match Status: `Alex-ன் முறை` (Player's turn), `கடைசி உருட்டல்` (Last Roll), `தாயக்கட்டை` (Dhayam), `கூடுதல் வாய்ப்பு` (Bonus throw), `காத்திருப்பவை` (Waiting pieces), `களத்தில்` (On board), `பரமபதத்தில்` (Home).
  4. **Tamil Voice Synthesis & Speech Commentary**:
     - Speech engine automatically sets `speech.lang = "ta-IN"` when Tamil is active and searches available browser voices for native Tamil TTS engines (`ta-IN`, `ta`, or containing "tamil").
     - Fully localized spoken announcements for rolls, bonus chains, piece entries, tactical captures, goal milestones, and match victory.
  5. **Zero Disk Unescaped Character Integrity**: All Tamil strings within `site/js/` are cleanly encoded using standard Unicode escape sequences (`\u0Bxx`), strictly adhering to codebase static integrity tests and preventing charset corruption across diverse host platforms.

### Milestone 11: Human-like Commentary, Audio Sanitization & Game Settings Integration
* **What was built**:
  1. **Game Settings Language Selection**: Moved language selection from top navigation bar into the centralized Game Settings modal (`openSettingsModal`), providing a clean UI dropdown with automatic preview and persistence.
  2. **Elimination of Rhetoric Prompts**: Replaced robotic, repetitive `"choose a legal move"` phrasing with context-aware, human-like prompts:
     - Detects tactical opportunities: inner-track entry, opponent captures, sanctuary havens, center goal milestones, or forward route advancement.
     - Conversational phrases like *"Strike an opponent or secure your position"*, *"Advance your piece towards the center"*, or *"Enter a new piece onto the board"*.
  3. **Audio Sanitization**: Stripped emojis (`🎉`, `🏆`, `✨`, `⚔️`) and parenthetical score annotations `(+1 bonus point)` from speech synthesis text, preventing the speech synthesizer from reciting punctuation or raw Unicode descriptions aloud.
  4. **Robust Tamil Audio & Tanglish Fallback**:
     - Checked system voice availability via `hasTamilVoice()`.
     - Avoided forcing English voices to read Tamil script (preventing distorted, garbled audio on systems lacking Tamil voice packs).
     - Added natural spoken number words (*தாயம்*, *ஐந்து*, *ஆறு*, *பன்னிரண்டு*) and clean phonetic Tanglish fallback when native Tamil speech synthesizer is unavailable.

---

## 3. Verification & CI/CD Pipeline
| Gate | Mechanism | Purpose |
| :--- | :--- | :--- |
| **Unit & Rules Tests** | `npm test` (97 tests) | Verifies immutable rules authority, MCP endpoints, bonus scoring, move destination previews, bilingual i18n switching, speech sanitization, guidance logic, and regression guards |
| **Deployment Gate** | `npx wrangler deploy --env staging` | Compiles Worker and deploys static assets with zero secret leakage |
| **Automated E2E Gate** | `node scripts/e2e-live-check.js` | Headless Chrome verifies 49 cells, 8 players, Quantum 32×, 128× speed slider, Game Timer, Build badge, and live dice click |

---
*Maintained under [docs/](file:///home/home/github/dhayam/docs/) for complete project provenance.*
