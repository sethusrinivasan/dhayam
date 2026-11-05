# ✺ Dhayam (தாயக்கட்டை)

[![Play live](https://img.shields.io/badge/Play%20live-Cloudflare-f38020?logo=cloudflare&logoColor=white)](https://dhayam.cancun.workers.dev)
[![GitHub Pages mirror](https://img.shields.io/badge/GitHub%20Pages-mirror-d88a3e?logo=githubpages&logoColor=white)](https://sethusrinivasan.github.io/dhayam/)
[![Tests](https://img.shields.io/badge/tests-82%20passing-brightgreen.svg)](https://github.com/sethusrinivasan/dhayam/actions)
[![License](https://img.shields.io/badge/license-MIT-8a2be2)](LICENSE)

An open-source web version of **Dhayam**, a Tamil race-and-capture board game. Play locally, against the computer, or online through Cloudflare Durable Objects and WebSockets.

The browser client is a static, zero-runtime-dependency application. The authoritative TypeScript engine also powers the Cloudflare backend and MCP tools used for state inspection, move evaluation, and automated matches.

## Features

- 7×7 board, 44-position rotational routes, six pieces per player
- Traditional dice values, bonus rolls, captures, safe squares, inner track, and exact-finish winning
- Solo, pass-and-play, and synchronized online matches for **2–32 players**
- 14 dynamic themes with festival aesthetics, custom tokens, and motifs (Diwali, Pongal, Dasara, Holi, Eid, Christmas, Hanukkah, Halloween, Heritage Wood, Royal Bronze, Midnight Nebula, Wall Street, and US Elections)
- Cryptographic dice randomness with optional user-supplied roll secret salt
- White-label single-script embed integration (`/embed/v1/embed.js`) for partner sites
- Reconnection grace period, automatic retry, turn auto-pass, and WebSocket join rate limiting
- Accessible responsive UI, full keyboard controls (Space/R to roll, M/Enter to move, 1–6 for piece selection, N for solo match, Esc/X to exit), optional hands-free voice command recognition, animated 3D brass dice, piece destination highlights, voice commentary, scoring, and ordered audit events
- Full MCP catalog for legal moves, summaries, audit logs, tactical evaluation, AI turns, and headless simulations

## How to Play & Controls

Dhayam supports three interchangeable ways to play: **Mouse/Touch**, **Keyboard-Only**, and **Hands-Free Voice Commands**.

### Game Rules
1. **Roll Dice**: Roll two brass Dayakattai dice. Rolls of **1, 5, 6, or 12** yield bonus throws.
2. **Enter Pieces**: Roll a **1** to enter a pawn from reserve onto your home entrance square (first round features an entry allowance on any roll).
3. **Capture**: Land on an opponent's lone piece on an unsafe square to capture it back to reserve. Squares marked with floral motifs are **safe squares** where pieces cannot be captured.
4. **Inner Circuit**: A player must complete at least one capture before entering the inner circuit toward the center goal.
5. **Exact Finish**: Guide all six pieces into the central destination by exact roll count to win.

### Alternate Ways to Play

#### ⌨️ Keyboard-Only Navigation
Play the entire game without touching a mouse:

| Key | Action | Description |
|---|---|---|
| <kbd>Space</kbd> or <kbd>R</kbd> | **Roll Dice** | Primary action during roll phase |
| <kbd>M</kbd> or <kbd>Enter</kbd> | **Move Piece** | Moves active piece or enters board during move phase |
| <kbd>1</kbd> – <kbd>6</kbd> | **Move Specific Piece** | Directly moves piece number 1 through 6 |
| <kbd>N</kbd> | **New Solo Game** | Starts a new match vs computer (`2 players, 1 AI`) |
| <kbd>Esc</kbd> or <kbd>X</kbd> | **Exit Game / Dismiss** | Closes active modal, exits demo, or prompts to exit match |
| <kbd>V</kbd> | **Toggle Voice Commands** | Turns voice recognition on or off |
| <kbd>?</kbd> or <kbd>H</kbd> | **Shortcuts Help** | Opens controls and shortcuts reference dialog |

*Note: Keyboard shortcuts automatically yield when typing inside text inputs, textareas, or select dropdowns.*

#### 🎤 Optional Hands-Free Voice Commands
Control matches entirely with your voice via the Web Speech API:
1. Click the **🎤 Voice: Off** button in the header or press <kbd>V</kbd>.
2. Your browser prompts for **microphone permission** (strictly opt-in; no audio is captured when disabled).
3. Speak commands clearly into your microphone:
   - **"Roll"** / **"Roll dice"** / **"Throw dice"** — Rolls the Dayakattai dice
   - **"Move"** / **"Enter piece"** — Steps the highest-priority piece or enters the board
   - **"Move piece [1-6]"** (e.g. *"Move piece 2"*) — Directly steps the numbered piece
   - **"New game"** / **"Solo game"** / **"Play computer"** — Starts a new solo match vs computer
   - **"Pass"** / **"Skip"** — Passes turn when no legal moves remain
   - **"Exit"** / **"Quit"** — Exits current match or closes dialogs
   - **"Help"** / **"Shortcuts"** — Opens the controls modal
4. A floating HUD toast confirms recognized commands on screen. Echo cancellation ensures computer voice commentary never triggers self-commands.

## Run locally

```sh
npm install
npm test
npm run test:coverage
python3 -m http.server 8000 --directory site
```

Open <http://localhost:8000>. To run the Cloudflare worker locally:

```sh
npx wrangler dev
```

## Project map

| Path | Purpose |
|---|---|
| `src/game.ts` | Immutable rules engine and game state |
| `site/` | Static browser UI |
| `cloudflare/worker.js` | Durable Object multiplayer backend and MCP endpoint |
| `mcp/server.py` | Local MCP adapter |
| `test/` | Engine, browser, multiplayer, and MCP regression tests |

More detail is in [Architecture](docs/architecture.md), [Development workflow](docs/development-workflow.md), [Test plan](docs/test-plan.md), [Cloudflare deployment](docs/cloudflare-deployment.md), [MCP guide](docs/mcp-evaluation.md), [White-label embed design](docs/white-label-embed.md), and the [Project roadmap](PROJECTS.md).

## Contributors and acknowledgements

Built by **Sethu Srinivasan** with assistance from **Kiro**, **OpenAI Codex**, **Google Gemini/Antigravity**, and **Claude Sonnet 4.6 (Thinking)**. Kiro contributed fixes during the November 1, 2026 development session. See [AI-assisted development acknowledgements](docs/ai-tools.md) for scope and runtime notes.

Distributed under the [MIT License](LICENSE).
