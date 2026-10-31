# Dhayam MCP (Model Context Protocol) Architectural Evaluation & Integration Guide

## Executive Summary

**Can Dhayam functionality be exposed via the Model Context Protocol (MCP) while still being hosted as the same static game on GitHub Pages?**

**YES, seamlessly.** GitHub Pages and MCP operate at different layers of the software architecture and complement each other without friction:

1. **GitHub Pages** remains 100% static, fast, serverless, and free to host (`https://sethusrinivasan.github.io/dhayam/`), providing the rich visual UI, 3D dice physics, themes, audio commentary, and browser-to-browser WebRTC multiplayer.
2. **MCP (Model Context Protocol)** exposes the underlying rules engine, board state, dice mechanics, move analysis, and game generation as AI-callable tools to models like Antigravity, Claude, and Cursor.
3. **No server hosting costs are introduced**: The MCP server runs locally over `stdio` via Python/Node or connects directly to the GitHub Pages client via serverless WebRTC data channels.

---

## 1. Architectural Options Evaluated

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          1. GitHub Pages (Static Web)                           │
│     - Static HTML/CSS/JS (https://sethusrinivasan.github.io/dhayam/)             │
│     - 3D Dice Physics & Realistic Bounces                                       │
│     - Board Themes (Halloween, Heritage Wood, Royal Bronze, Midnight Nebula)    │
│     - P2P Real-time WebRTC Multiplayer (PeerJS Room Codes & QR Codes)           │
└───────────────────────┬─────────────────────────────────┬───────────────────────┘
                        │                                 │
                        ▼ (Option A: Stdio MCP)           ▼ (Option B: WebRTC Bridge)
┌───────────────────────────────────────┐   ┌─────────────────────────────────────┐
│ 2. Local MCP Server (mcp/server.py)  │   │ 3. AI Peer Agent in Live Web Match  │
│ - Zero dependencies (Python 3 stdlib) │   │ - Connects via WebRTC Room Code     │
│ - JSON-RPC 2.0 over stdin / stdout    │   │ - Plays moves in user's browser     │
│ - Instant sub-millisecond execution   │   │ - No backend server needed          │
└───────────────────────────────────────┘   └─────────────────────────────────────┘
```

### Option A: Dual-Surface Architecture (Recommended & Implemented)
* **How it works**:
  - The static web client is deployed to GitHub Pages.
  - The repository bundles `mcp/server.py`, a zero-dependency Python 3 standard-library MCP server.
  - Any MCP-compliant client (Antigravity, Claude Desktop, Cursor) runs `mcp/server.py` as a local subprocess over `stdio`.
* **Key Benefits**:
  - Zero deployment overhead: no cloud servers, databases, or API keys needed.
  - Offline-first: works without an internet connection.
  - Exposes 8 full tools (`dhayam_new_game`, `dhayam_roll_dice`, `dhayam_get_legal_moves`, `dhayam_move_piece`, `dhayam_get_state`, `dhayam_pass`, `dhayam_get_audit_log`, `dhayam_get_share_url`).
  - Tools can generate deep links back to GitHub Pages so users can view the game in their browser anytime.

### Option B: WebRTC Bridge Architecture (Live Interactive Human vs AI)
* **How it works**:
  - Dhayam already features WebRTC PeerJS multiplayer (`dhayam-v1-XXXXX` room codes and live QR codes).
  - The MCP server can include a tool `dhayam_join_room(room_code)`.
  - When the user tells the AI *"Play against me on room K9M4P"*, the MCP server connects over WebRTC directly to the user's browser running on GitHub Pages.
  - The AI agent rolls dice and moves pieces, and the user sees them animate in real time on their phone, tablet, or laptop.
* **Key Benefits**:
  - Brings AI gameplay directly into the browser without modifying the static GitHub Pages deployment.

### Option C: Remote Streamable HTTP MCP (Cloudflare Worker)
* **How it works**:
  - Deploy the pure JavaScript rules engine (`src/game.ts`) as a Cloudflare Worker or Deno Deploy function responding to `POST /mcp`.
* **Trade-off**: Requires deploying and maintaining a third-party serverless service outside GitHub Pages.

---

## 2. Implemented Tools Reference (`mcp/server.py`)

The included MCP server implements the following tools:

| Tool Name | Parameters | Purpose |
|---|---|---|
| `dhayam_new_game` | `player_names?: string[]` | Initializes a new match (2 to 4 players). |
| `dhayam_get_state` | *none* | Returns the board state, player positions, current turn, and active pool. |
| `dhayam_roll_dice` | *none* | Rolls the traditional Dayakattai dice with cryptographic randomness (handles bonuses). |
| `dhayam_get_legal_moves`| *none* | Computes all legal piece moves, destinations, and capture opportunities. |
| `dhayam_move_piece` | `piece_id: string`, `dice_values?: int[]` | Applies a piece move, handles captures, board entries, and win conditions. |
| `dhayam_pass` | *none* | Passes remaining rolls to transition turn. |
| `dhayam_get_audit_log` | *none* | Fetches the tamper-evident audit history of all game actions. |
| `dhayam_get_share_url` | `base_url?: string` | Returns the GitHub Pages URL to launch or inspect the game in a web browser. |

---

## 3. Configuration Instructions

### For Antigravity (AGY CLI / IDE)
Add the server to your `~/.gemini/config/mcp_config.json` or project `.agents/mcp_config.json`:

```json
{
  "mcpServers": {
    "dhayam": {
      "command": "python3",
      "args": ["/home/home/github/dhayam/mcp/server.py"]
    }
  }
}
```

### For Claude Desktop
Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "dhayam": {
      "command": "python3",
      "args": ["<PATH_TO_DHAYAM>/mcp/server.py"]
    }
  }
}
```

---

## 4. Conclusion & Recommendation

Exposing Dhayam via MCP is **fully viable and already functional**. The Dual-Surface Architecture preserves Dhayam's identity as a fast, accessible, static web game hosted for free on GitHub Pages, while simultaneously turning it into a first-class AI gaming platform for autonomous agents and conversational pair programming.
