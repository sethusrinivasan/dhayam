# ✺ Dhayam (தாயக்கட்டை)

[![Cloudflare Edge](https://img.shields.io/badge/Cloudflare-Live%20Edge%20App-f38020?logo=cloudflare&logoColor=white)](https://dhayam.cancun.workers.dev)
[![Play Dhayam](https://img.shields.io/badge/GitHub%20Pages-Live%20Mirror-d88a3e?logo=githubpages&logoColor=white)](https://sethusrinivasan.github.io/dhayam/)
[![Tests](https://github.com/sethusrinivasan/dhayam/actions/workflows/test.yml/badge.svg)](https://github.com/sethusrinivasan/dhayam/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-8a2be2)](LICENSE)

An authentic, modern web rendition of **Dhayam** (also known as *Dayakattai* or *Dhayam*), the ancient Tamil roll-and-move strategy board game. Built for cross-device real-time multiplayer, pass-and-play family tabletop, or solo play against intelligent computer AI.

Experience 3D Dayakattai cuboidal brass dice physics, synchronized real-time multi-user gameplay, synthesized voice commentary, smooth animated piece stepping, dynamic QR code instant-join, and an exportable tamper-evident match audit log.

🎮 **Play Live on Cloudflare Edge:** [https://dhayam.cancun.workers.dev](https://dhayam.cancun.workers.dev)  
🌐 **GitHub Pages Mirror:** [https://sethusrinivasan.github.io/dhayam/](https://sethusrinivasan.github.io/dhayam/)  
🤖 **MCP Streamable HTTP Endpoint:** `https://dhayam.cancun.workers.dev/mcp`

---

## 📸 Screenshots

### Tabletop Desktop View
![Dhayam Tabletop Desktop View](docs/screenshots/board-view.png)
*Authentic 7×7 board with flowing rotational SVG circuit, 3D Dayakattai brass dice, real-time multiplayer status, and live family table.*

### Responsive Mobile & Tablet View
![Dhayam Mobile View](docs/screenshots/mobile-view.png)
*Touch-optimized interface with dynamic QR code scanning, single-tap dice rolling, and floating reaction banter.*

---

## ✨ Features at a Glance

* **⚡ Real-Time Online Multiplayer**: Powered by Cloudflare Durable Objects with WebSocket Hibernation. Sub-50ms global latency with automatic session recovery upon tab reload.
* **🎲 Synchronized 3D Dice Physics**: Two long cuboidal brass dice tumble and bounce across every connected player's screen simultaneously in real-time 3D CSS.
* **♟️ Smooth Animated Pawn Movement**: Watch opponent pawns step square-by-square along the golden circuit with custom capture flash animations.
* **📱 Dynamic QR Code Instant-Join**: Host generates a crisp SVG QR code on laptop or TV; friends scan with their phone camera to auto-join and pick an unassigned player slot.
* **💬 Floating Reaction Banter**: Tap quick emojis (🎉, 👏, 🔥, 😂, 🎲, 😱) to send animated floating reactions across the board in real time.
* **🤖 Smart Solo AI**: Play offline or practice solo against 1 to 3 heuristic computer opponents with adjustable delay and voice persona hints.
* **🎙️ Voice Commentary**: Natural browser speech synthesis calls out rolls (*"Dhayam!"*, *"Pannirandu!"*), captures (*"Vettu!"*), and milestones.
* **📋 Flight Recorder & Audit Log**: Comprehensive, exportable cryptographic event log capturing every roll, seed, move, capture, pass, and board state snapshot.

---

## 📜 How to Play Dhayam

Dhayam is a strategic race between 2 to 4 players across a 7×7 grid of 44 positions.

1. **The Dice (*Dayakattai*)**: Two long 4-sided dice roll values 0, 1, 2, or 3.
   - Double zero ($0+0$) counts as **12** (*Pannirandu*).
   - Rolling **1 (*Dhayam*)**, **5**, **6**, or **12** awards an extra bonus roll in a chain.
2. **Entering the Board**: All 6 pieces per player begin in reserve. A roll of **1 (*Dhayam*)** is required to bring a pawn out of reserve and onto your home gate (`A4`, `D7`, `G4`, `D1`).
3. **Safe Sanctuaries (*Malai* / ✿)**: The 8 floral squares are protected sanctuaries. Opponents on safe squares co-exist peacefully and cannot be captured.
4. **Captures (*Vettu*)**: Landing on an unprotected opponent pawn on an unsafe square captures it, sending it back to reserve. **Earning at least one capture is mandatory to unlock the inner circuit!**
5. **Inner Track & Lotus Center (*Pazham* / ✺)**: Once a player achieves a capture, their pieces turn into the inner ring and approach the sacred center square **D4**.
6. **Winning the Game**: Pawns must reach the center **D4** by exact roll count. The first player to bring all 6 pawns home wins!

---

## 🏛️ Architecture & Separation of Concerns

Dhayam is designed with a **clean, zero-dependency, modular web architecture**:

```
dhayam/
├── cloudflare/
│   └── worker.js                  # Cloudflare Edge Worker + DhayamRoom Durable Object + MCP Endpoint
├── site/                          # Pure vanilla web application (0ms cold start, <30KB gzipped)
│   ├── index.html                 # Semantic HTML markup with accessible ARIA labels
│   ├── board-definition-v1-candidate.json # Formal 7x7 board graph geometry specification
│   ├── css/                       # Modular stylesheets
│   │   ├── base.css               # Typography, design tokens, and CSS variables
│   │   ├── board.css              # 7x7 grid, cell states, tokens, path flow SVG
│   │   ├── dice.css               # 3D cuboidal dice transforms, faces, and rolling physics
│   │   ├── controls.css           # Turn status bar, action buttons, pool chips
│   │   ├── panels.css             # Family table, player cards, avatars, metadata
│   │   ├── modals.css             # Splash screen, room lobby, seat picker dialogs
│   │   ├── multiplayer.css        # QR code box, live connection dots, floating reactions
│   │   ├── themes.css             # High-contrast, festive, and traditional board themes
│   │   └── responsive.css         # Tablet (860px), mobile (520px), and reduced-motion
│   └── js/                        # Focused single-responsibility JavaScript modules
│       ├── config.js              # Board geometry constants, 44-step circuit rotation
│       ├── state.js               # Global match state, player accessors, text sanitizers
│       ├── audio.js               # Browser SpeechSynthesis commentary and voice persona hints
│       ├── dice.js                # Cryptographic unbiased random dice & 3D CSS tumbling
│       ├── audit.js               # Event recorder, board snapshots, and clipboard export
│       ├── engine.js              # Move candidate validation, safe squares, and capture rules
│       ├── turn.js                # Synchronized turn lifecycle, animated stepping, AI scheduler
│       ├── ui.js                  # DOM renderer (cells, numbered tokens, chips, dropdowns)
│       ├── demo.js                # Guided interactive demo controller
│       ├── qrcode.min.js          # Client-side standalone SVG QR generator
│       ├── peerjs.min.js          # WebRTC P2P fallback library
│       ├── multiplayer.js         # Cloudflare DO WebSocket client + P2P fallback engine
│       └── app.js                 # Modal managers, player editor, keyboard nav, bootstrap
├── src/
│   └── game.ts                    # Immutable TypeScript rules engine (for headless verification)
├── test/
│   └── game.test.ts               # Unit test suite for game rules and invariants
└── wrangler.toml                  # Cloudflare Workers + Static Assets + Durable Objects configuration
```

### 💡 Is React Used in This Project?
**No. React is intentionally not used.**  
Dhayam is built with lightweight, zero-dependency vanilla web standards (HTML5, modular CSS3 3D transforms, ES Modules, and TypeScript rules engine). This delivers:
* **Instant 0ms initial load** (<30KB total bundle size over CDN).
* **60fps hardware-accelerated 3D dice physics** without virtual DOM overhead or reconciliation pauses.
* **Zero npm runtime dependencies** for security, simplicity, and lifelong longevity.

---

## ☁️ Frugal Cloudflare Hosting Architecture

Dhayam leverages **Cloudflare's Free Tier** for maximum performance and reliability at **$0 cost**:

| Resource | Cloudflare Free Allowance | Dhayam Usage |
|---|---|---|
| **Workers Static Assets** | 100,000 requests / day | Serves the frontend game globally across 300+ Edge CDN data centers with 0ms cold starts. |
| **Durable Objects (SQLite)** | 100,000 requests / day, 5 GB storage | Manages authoritative multiplayer room state, seat allocation, and match history with SQLite persistence. |
| **WebSocket Hibernation** | 13,000 GB-seconds / day | Maintains open real-time WebSocket connections to all players. Automatically hibernates in memory when idle, consuming **0 compute duration** while players think! |
| **Model Context Protocol (MCP)** | Included in Workers | Exposes standard Streamable HTTP MCP tools (`/mcp`) so AI coding agents can inspect board state, roll dice, and play moves. |

---

## ⚡ Quick Start

### 1. Launch Locally (Zero Dependencies)
Run with Python's built-in HTTP server:
```sh
./start.sh
# or: ./scripts/start.sh
```
Open `http://localhost:8000/` in your browser.

### 2. Run Local Cloudflare Worker Dev Server
```sh
npx wrangler dev
```
Open `http://localhost:8787/` to test Cloudflare Durable Objects and WebSockets locally.

### 3. Run Automated Tests
```sh
npm test              # Runs 13 rules-engine unit tests (via tsx)
./test.sh             # Full suite: DOM checks, headless Chrome rendering, CSS/JS integrity
```

### 4. Debug in VS Code
Open the repository folder in VS Code, run `npm install`, and press **F5**.
The default configuration, **Dhayam: Debug browser game**, starts the local
static server and opens the game with browser breakpoints enabled. Set
breakpoints in `site/js/` and use **F10** or **F11** to step through the code.

To debug the TypeScript rules engine, choose **Dhayam: Debug rules tests** in
the Run and Debug configuration menu, then set breakpoints in `src/game.ts` or
`test/game.test.ts`.

### 5. Deploy to Cloudflare
```sh
npx wrangler deploy
```

---

## 📄 License

Distributed under the [MIT License](LICENSE).
