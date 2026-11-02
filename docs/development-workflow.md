# Development, Test, Debug, Staging & Deployment Workflow

> **White-label embed:** The script-tag/iframe integration is tracked in [issue #10](https://github.com/sethusrinivasan/dhayam/issues/10). Its contract, partner branding rules, runtime loader, and Puter sample are documented in [white-label-embed.md](white-label-embed.md).

This guide details the complete development lifecycle for **Dhayam**, from local authoring and test verification to black box debugging with Flight Recorder, automated staging gates, and manual approval promotion to production.

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│ 1. Local Dev    │  ──▶  │ 2. Test Suite   │  ──▶  │ 3. Debugging    │
│  Static & Pure  │       │  npm test (57+) │       │  Flight Recorder│
└─────────────────┘       └─────────────────┘       └─────────────────┘
                                                             │
                                                             ▼
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│ 6. Production   │  ◀──  │ 5. Approval Gate│  ◀──  │ 4. Staging Edge │
│  Cloudflare/Pages       │  Manual Review  │       │  Automated Gate │
└─────────────────┘       └─────────────────┘       └─────────────────┘
```

---

## 1. Local Development Flow

Dhayam is intentionally architected as a static, serverless game with zero required build steps for the frontend:

- **Immutable Rules Engine**: [`src/game.ts`](file:///home/home/github/dhayam/src/game.ts) is the mathematical and rule authority.
- **Frontend Presentation**: [`site/index.html`](file:///home/home/github/dhayam/site/index.html) and [`site/js/`](file:///home/home/github/dhayam/site/js/) provide modular browser UI, CSS animations, 3D CSS dice, themes, and audio.
- **Edge Backend & MCP**: [`cloudflare/worker.js`](file:///home/home/github/dhayam/cloudflare/worker.js) implements Cloudflare Durable Objects with WebSocket Hibernation and Streamable MCP tools.

### Running Locally

To serve the frontend locally:

```bash
python3 -m http.server 8000 --directory site
```

Open `http://localhost:8000` in your browser.

---

## 2. Testing Flow

Dhayam enforces automated test gates covering logic, syntax integrity, security checks, and headless Chrome verification:

```bash
# Run the complete test suite
npm test

# Run tests with experimental coverage
npm run test:coverage
```

### What `npm test` Validates (68+ automated checks):
1. **Frontend Syntax & Link Integrity**:
   - All `site/js/*.js` files parse cleanly in Node vm with zero syntax errors.
   - All script and stylesheet tags in `site/index.html` resolve to existing, non-empty files.
   - Unicode/Tamil text escaping checks prior to full i18n release.
2. **Headless Chrome E2E Integrity**:
   - Spawns headless Chrome with Chrome DevTools Protocol (CDP).
   - Loads `site/index.html` with zero console exceptions (`Runtime.exceptionThrown`).
   - Verifies 49/49 board cells, player tokens, and roll action interactivity.
3. **Pure Rules Engine (`src/game.ts`)**:
   - Seat arrangements (2–32 players), 44-position symmetrical routes, opening entry allowances.
   - 16-player two-rotation and 32-player eight-rotation seating, `MIN_PLAYERS`/`MAX_PLAYERS` exports.
   - Dice mappings (`0,0` ➔ 12), roll pool deduction, legal moves, single vs combined moves.
   - Safe square sanctuaries vs unsafe square single-capture and multi-piece block rules.
4. **Cloudflare Worker & Model Context Protocol (MCP)**:
   - GET `/health` endpoint liveness.
   - GET `/mcp` and OPTIONS `/mcp` CORS discovery.
   - POST `/mcp` JSON-RPC handshake, `tools/list`, `resources/list`, and tools execution (`play_ai_turn`, `evaluate_moves`, `simulate_ai_match`).
5. **Multiplayer & State Synchronization**:
   - Durable Object state buffering, seat assignment, token authentication.
   - Room-wide `SYNC_STATE` broadcast on error recovery.
   - Real online demo watchdog timeout and turn stall recovery.

---

## 3. Debugging Flow & Black Box Flight Recorder

When debugging an issue—especially in multiplayer or automated demo modes across different browsers and network environments—Dhayam provides a **Black Box Flight Recorder** in [`site/js/recorder.js`](file:///home/home/github/dhayam/site/js/recorder.js).

### Diagnostic Black Box Features:
- **Game Initialization Parameters (`gameInitConfig`)**:
  Permanently records the game configuration at startup, ensuring that even if the circular buffer wraps around, the parameters are never lost:
  - `mode`: (`"solo"`, `"local"`, `"multiplayer-cf-host"`, `"multiplayer-cf-guest"`, `"demo-real-cloudflare"`, `"demo-classic"`, etc.)
  - `playerCount`: Total player seats (e.g. 2, 4)
  - `computerCount`: Number of bot players
  - `roomCode`: Cloudflare DO or P2P room identifier (e.g. `"CF4420"`)
  - `cfHost`: Edge hostname (e.g. `"dhayam-staging.cancun.workers.dev"`)
  - `transport`: (`"cf_ws"`, `"webrtc_p2p"`, `"local"`)
  - `seat`: Player's assigned seat index
  - `players`: Array of player metadata (names, seats, avatars, colors)
  - `rulesVariant`: Game rules variant applied
  - `theme`, `audio`, `timestamp`, `url`
- **Real-Time Circular Event Buffer (400 events)**:
  - Global user clicks (`USER_CLICK`) with DOM target, text, coordinates, bounding box.
  - Keyboard interactions (`USER_KEY`).
  - Dice roll actions and values (`ROLL_INITIATED`, `ROLL_COMPLETED`, `val`, `dice`).
  - Move selections and executions (`MOVE_APPLIED`, `pieceId`, `values`, `targetProgress`).
  - WebSocket lifecycle (`DEMO_WS_OPEN`, `DEMO_WS_RECV`, `DEMO_WS_SEND`, `DEMO_WS_ERROR`, `DEMO_WS_CLOSE`).
  - Watchdog interventions (`DEMO_WATCHDOG_TRIGGER`).
  - Uncaught exceptions (`ERROR`, `UNHANDLED_REJECTION`).
- **One-Click Clipboard Export**:
  - Click the **🛫** button on the top menu bar to copy the full diagnostic JSON bundle directly to your clipboard.
  - Paste into bug reports or analysis prompts for instantaneous root-cause diagnosis.

### Host-side freeze and crash collection

The browser recorder cannot observe a compositor, GPU-driver, kernel, or desktop-session
failure after the browser stops responding. Immediately after recovery, collect host evidence
with:

```sh
SINCE='2026-11-02 08:55:00' UNTIL='2026-11-02 10:06:00' \
  ./scripts/collect-postmortem.sh
```

Omit `SINCE` and `UNTIL` to collect the last 15 minutes. The collector writes text files under
`/tmp/dhayam-postmortem-*` and deliberately excludes browser profiles, cookies, game data, and
binary crash dumps. Attach its text files together with the copied Flight Recorder JSON.

For a complete postmortem, record the workload before reproducing it: player count, demo speed,
quantum/super-speed state, browser version, display session (Wayland/X11), GPU driver, and the
approximate incident time. Inspect `journal_incident.txt`, `crash-reports.txt`, and `gpu.txt`
first. A Chrome GPU-process crash followed by `gnome-shell` or `nouveau` faults is an
operating-system graphics incident, not evidence that the rules engine deadlocked.

### Turn Watchdog & Deadlock Prevention:
In real online demos or multiplayer sessions where edge network packets may be lost or delayed:
- Every action sent to the edge arms a 6-second safety watchdog (`demoWatchdogTimer`).
- If no state sync response is received within 6 seconds, the watchdog triggers `DEMO_WATCHDOG_TRIGGER`, queries `GET_STATE` from the Cloudflare Durable Object, and reschedules the turn.
- The game engine never deadlocks or freezes indefinitely.

---

## 4. Staging Environment & Automated Gate

All changes committed to the `main` branch immediately deploy to the **Staging Environment**:

- **Staging URL**: `https://dhayam-staging.cancun.workers.dev`
- **Automated Staging Gate (`validate-staging`)**:
  Before any code can reach production, GitHub Actions runs the automated validation gate:
  1. Executes full `npm test` (unit rules, syntax, and MCP tests).
  2. Runs headless Chrome E2E check against the live staging URL:
     - Root URL returns HTTP 200 and `<title>Dhayam</title>`.
     - `/health` returns HTTP 200 `healthy`.
     - `/mcp` service discovery endpoint returns valid JSON-RPC schema.
     - 49/49 board cells rendered into DOM.
     - Zero runtime JavaScript exceptions.
     - Action button roll interaction responds cleanly.

If the staging validation gate fails for any reason, the pipeline terminates immediately and production is left untouched.

---

## 5. Production Promotion Gate & Deployment Flow

Dhayam employs a **4-job deployment pipeline** defined in [`.github/workflows/cloudflare.yml`](file:///home/home/github/dhayam/.github/workflows/cloudflare.yml):

```
Push to main
     │
     ▼
┌───────────────────────────┐
│ 1. deploy-staging         │   wrangler deploy --env staging
│    🚧 Staging Deploy     │   → dhayam-staging.cancun.workers.dev
└─────────────┬─────────────┘
              │
              ▼
┌───────────────────────────┐
│ 2. validate-staging       │   npm test  +  Live Staging E2E Gate
│    🧪 Automated Gate      │   ↳ HTTP 200, zero exceptions, roll test
└─────────────┬─────────────┘
              │ PASSED
              ▼
┌───────────────────────────┐
│ 3. deploy-production      │   ⏸ Production environment review gate
│    👤 Human Review        │   ↳ Staging URL, diff link, test evidence
└─────────────┬─────────────┘
              │ APPROVED
              ▼
┌───────────────────────────┐
│ 4. deploy-production      │   wrangler deploy (production)
│    🚀 Production Deploy   │   → dhayam.cancun.workers.dev
└─────────────┬─────────────┘
              │
              ▼
┌───────────────────────────┐
│ 5. smoke-production       │   Live Production Smoke Test
│    💨 Final Smoke Check   │   ↳ HTTP 200 & /health verified
└───────────────────────────┘
```

### Reviewer Promotion Steps:
1. When a pull request merges into `main`, Jobs 1 and 2 run automatically.
2. In the GitHub Actions tab, Job 3 **deploy-production** pauses at the `production` environment review gate.
3. The reviewer opens the staging URL: `https://dhayam-staging.cancun.workers.dev`.
4. The reviewer validates the UI, plays a turn or runs the demo, and inspects the Flight Recorder.
5. In GitHub Actions, click **Review deployments** ➔ select **production** ➔ click **Approve and deploy**.
6. Job 3 deploys to production `https://dhayam.cancun.workers.dev`, and Job 4 performs the final smoke check.

### Emergency Bypass:
In rare emergencies where staging edge infrastructure is temporarily unreachable, maintainers can run `workflow_dispatch` with `skip_approval: true` to deploy directly to production.

---

## 6. URLs & Mirrors

| Target | URL | Role |
|---|---|---|
| **Staging** | `https://dhayam-staging.cancun.workers.dev` | Edge staging preview & E2E gate testing |
| **Production** | `https://dhayam.cancun.workers.dev` | Live production edge site & MCP server |
| **GitHub Pages** | `https://sethusrinivasan.github.io/dhayam/` | Static mirror & serverless P2P WebRTC host |
