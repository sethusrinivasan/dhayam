# Architecture

```mermaid
flowchart TD
  subgraph Client["Client (Browser / Mobile / TV)"]
    UI["Vanilla Web UI (site/index.html)"]
    State["In-Memory Game State"]
    Rules["Rules Engine (site/js/engine.js)"]
    Visuals["3D Dice Tumbling & 7x7 Circuit Animations"]
    Audio["Avatar Speech Synthesis & Effects"]
    MultiplayerClient["Multiplayer Client (site/js/multiplayer.js)"]
  end

  subgraph CloudflareEdge["Cloudflare Global Edge CDN"]
    EdgeWorker["Cloudflare Worker (cloudflare/worker.js)"]
    DO["DhayamRoom Durable Object (SQLite + WebSocket Hibernation)"]
    MCP["Streamable HTTP MCP Endpoint (/mcp)"]
    Assets["Edge Static Assets CDN ([assets])"]
  end

  subgraph AI["AI Coding Agents & External Tools"]
    Agents["Antigravity / Claude / Cursor via JSON-RPC 2.0"]
  end

  UI --> State
  State --> Rules
  Rules --> Visuals
  State --> Audio
  MultiplayerClient <-->|WebSocket| DO
  EdgeWorker --> DO
  Assets --> UI
  Agents <-->|Streamable HTTP POST| MCP
  MCP --> EdgeWorker
```

The application uses a zero-dependency, dual-surface architecture:
1. **Frontend App:** Pure vanilla HTML5, modular CSS3 (3D cuboidal dice physics), and ES Modules. Delivered globally via Cloudflare Edge Static Assets and mirrored on GitHub Pages.
2. **Multiplayer Backend:** Cloudflare Durable Objects with WebSocket Hibernation and SQLite persistence for state synchronization, room codes, and QR code joining at $0 cost on Cloudflare Free Tier.
3. **MCP Endpoint:** Exposed at `/mcp` for Model Context Protocol JSON-RPC tool calls, allowing AI agents to inspect board states, roll dice, and play moves.
4. **Verification & Invariant Engine:** `src/game.ts` contains an immutable TypeScript rules engine used by unit and regression test suites.

## Runtime Boundaries

- **Single Player / Local Pass-and-Play:** Self-contained in the browser tab with zero network traffic.
- **Online Multiplayer:** Orchestrated authoritatively by Cloudflare Durable Objects (`DhayamRoom`) with instant reconnects via session storage tokens.
- **MCP Server:** Streamable HTTP JSON-RPC endpoint on Cloudflare Edge at `https://dhayam.cancun.workers.dev/mcp`.
- **Primary Live URL:** `https://dhayam.cancun.workers.dev`
- **GitHub Pages Mirror:** `https://sethusrinivasan.github.io/dhayam/`
