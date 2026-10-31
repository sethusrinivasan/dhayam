# Dhayam Cloudflare Deployment & Frugal Edge Hosting Guide

This guide describes how to deploy Dhayam to **Cloudflare** with frugal resource consumption while preserving **100% of the game on GitHub Pages**.

---

## 1. Architecture: GitHub Pages + Cloudflare

```
┌────────────────────────────────────────────────────────────┐
│                1. GitHub Pages (Primary Web)               │
│   https://sethusrinivasan.github.io/dhayam/                │
│   - Free static site hosting                               │
│   - WebRTC P2P multiplayer (camera QR codes + room codes)  │
│   - 3D dice physics, themes, audio, zero backend servers   │
└─────────────────────────────┬──────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────┐
│        2. Cloudflare Global Edge (Frugal Dual Host)        │
│   https://dhayam.workers.dev (or custom domain)            │
│   - Global CDN static asset delivery (`[assets]` binding)   │
│   - Remote Streamable HTTP MCP Endpoint at `/mcp`          │
│   - Health monitor at `/health`                            │
│   - 100% Free Tier (100,000 requests/day, 0ms cold start)  │
└────────────────────────────────────────────────────────────┘
```

Both environments share the exact same game files and pure rules engine without any code duplication.

---

## 2. Resource Frugality Guarantee

| Metric | Cloudflare Free Tier Allocation | Dhayam Worker Usage | Utilization |
|---|---|---|---|
| **Monthly Cost** | $0.00 / month | **$0.00** | 100% Free |
| **Daily Requests** | 100,000 requests / day | ~100 – 5,000 / day | < 5% |
| **CPU Time per Request** | 10 ms (Standard limit) | **< 0.3 ms** | < 3% |
| **Bundle Size** | 1,000 KB (1 MB max) | **14.2 KB** | ~1.4% |
| **External Dependencies** | — | **0 npm packages** | Pure standard JS |

---

## 3. Deployment Methods

### Method A: 1-Command Wrangler CLI Deployment (Fastest)

Run directly from the repository root:

```bash
# 1. Log in to Cloudflare (one-time)
npx wrangler login

# 2. Deploy static site + MCP endpoint in seconds
npx wrangler deploy
```

Wrangler uses the included [`wrangler.toml`](file:///home/home/github/dhayam/wrangler.toml):
- Serves `./site` on Cloudflare's Edge CDN.
- Mounts [`cloudflare/worker.js`](file:///home/home/github/dhayam/cloudflare/worker.js) for `/mcp` and `/health`.

---

### Method B: Automated GitHub Actions CI/CD

An automated workflow is included in [`.github/workflows/cloudflare.yml`](file:///home/home/github/dhayam/.github/workflows/cloudflare.yml).

1. In your GitHub repository, go to **Settings > Secrets and variables > Actions**.
2. Add two repository secrets:
   - `CLOUDFLARE_API_TOKEN`: Your Cloudflare API Token (with *Workers:Edit* permissions).
   - `CLOUDFLARE_ACCOUNT_ID`: Your Cloudflare Account ID (found on your dashboard).
3. Every push to `main` will automatically deploy:
   - The static site to **GitHub Pages** (via `pages.yml`).
   - The edge site and remote MCP endpoint to **Cloudflare** (via `cloudflare.yml`).

*(If secrets are not configured, the Cloudflare action skips gracefully without failing).*

---

### Method C: Cloudflare Pages Git Integration

1. On the [Cloudflare Dashboard](https://dash.cloudflare.com/), navigate to **Compute (Workers) > Pages > Connect to Git**.
2. Select your `dhayam` repository.
3. Configuration:
   - **Build command**: *(leave empty)*
   - **Build output directory**: `site`
4. Click **Save and Deploy**.

The included [`functions/mcp.js`](file:///home/home/github/dhayam/functions/mcp.js) automatically enables the `/mcp` edge endpoint at `https://<your-project>.pages.dev/mcp`.

---

## 4. Connecting AI Clients to Remote Cloudflare MCP

Any remote AI assistant (Antigravity, Claude Desktop, Cursor) can now connect to Dhayam over **Streamable HTTP** without needing Python or local processes:

```json
{
  "mcpServers": {
    "dhayam-remote": {
      "url": "https://dhayam.workers.dev/mcp"
    }
  }
}
```

### Endpoints:
- `GET /`: Serves the interactive game (or redirects to GitHub Pages).
- `GET /health`: Uptime status (`{"status":"healthy","service":"dhayam-mcp"}`).
- `GET /mcp`: Human-readable protocol and tool discovery info.
- `POST /mcp`: JSON-RPC 2.0 Streamable HTTP endpoint for AI tool execution.
