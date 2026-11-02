# ✺ Dhayam (தாயக்கட்டை)

[![Play live](https://img.shields.io/badge/Play%20live-Cloudflare-f38020?logo=cloudflare&logoColor=white)](https://dhayam.cancun.workers.dev)
[![GitHub Pages mirror](https://img.shields.io/badge/GitHub%20Pages-mirror-d88a3e?logo=githubpages&logoColor=white)](https://sethusrinivasan.github.io/dhayam/)
[![Tests](https://img.shields.io/badge/tests-72%20passing-brightgreen.svg)](https://github.com/sethusrinivasan/dhayam/actions)
[![License](https://img.shields.io/badge/license-MIT-8a2be2)](LICENSE)

An open-source web version of **Dhayam**, a Tamil race-and-capture board game. Play locally, against the computer, or online through Cloudflare Durable Objects and WebSockets.

The browser client is a static, zero-runtime-dependency application. The authoritative TypeScript engine also powers the Cloudflare backend and MCP tools used for state inspection, move evaluation, and automated matches.

## Features

- 7×7 board, 44-position rotational routes, six pieces per player
- Traditional dice values, bonus rolls, captures, safe squares, inner track, and exact-finish winning
- Solo, pass-and-play, and synchronized online matches for **2–32 players**
- Reconnection grace period, automatic retry, turn auto-pass, and WebSocket join rate limiting
- Accessible responsive UI, animated dice and pieces, voice commentary, scoring, and ordered audit events
- MCP endpoints for legal moves, state, audit logs, AI turns, and match simulation

## Run locally

```sh
npm install
npm test
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
