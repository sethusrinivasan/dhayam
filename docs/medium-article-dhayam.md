# Building Dhayam: An Ancient Tamil Game for Humans and AI

*How a zero-runtime-dependency browser game became an edge-hosted multiplayer system without giving up understandable rules, low operating cost, or safe deployment.*

[Dhayam (தாயக்கட்டை)](https://dhayam.cancun.workers.dev/) is a traditional Tamil race-and-capture board game. This project began with a straightforward goal: make the game playable on a phone, tablet, or desktop without accounts, installation, or a permanent application server.

The interesting engineering problem was not rendering a board. It was preserving a clear rules model while supporting animation, computer players, multiplayer synchronization, diagnostics, and safe production deployment. The result is a static browser client, a side-effect-contained TypeScript rules engine, a Cloudflare Durable Object multiplayer backend, and a small MCP interface for inspection and simulation.

## The design constraints

The project was shaped by a few deliberate constraints:

- The game should load as a static site and remain usable without a server.
- Rules should be deterministic and testable outside the browser.
- Dice should use cryptographically secure randomness rather than player-specific or predictable outcomes.
- Every turn should be understandable to a human watching the screen.
- Multiplayer failures should recover without silently creating divergent boards.
- Production deployment should be gated by both automated checks and human review.
- The project should remain inexpensive enough to run on a free edge tier.

These constraints led to a deliberately modest stack: semantic HTML, modular CSS, vanilla ES modules, TypeScript for the headless rules authority, Cloudflare Workers and Durable Objects for online play, and Python's standard library for the local MCP adapter.

## Frugality as a design requirement

Cost was treated as an engineering constraint, not an afterthought. The browser application has no framework runtime, no application database for local play, no accounts, no analytics, and no paid AI API in the normal game loop. Static assets are small, dependencies are minimal, and the hosted multiplayer state is kept in Cloudflare Durable Objects with WebSocket Hibernation so idle players do not require continuously running compute.

At the project's current scale, the estimated application hosting cost is **$0 per month** on Cloudflare's documented free allowances, with GitHub Pages providing a free static mirror. The repository's deployment documentation estimates roughly 100–5,000 requests per day, a 14.2 KB worker bundle, and no runtime npm packages. That estimate assumes usage remains within the free tier and excludes optional costs such as domain registration, paid CI minutes, higher traffic, or future quota overages. The design goal is not merely “cheap hosting”; it is keeping the recurring cost predictable while preserving a production-style staging and approval pipeline.

## White-label integration for partner portals

The shipped v1 integration, tracked in [issue #10](https://github.com/sethusrinivasan/dhayam/issues/10), uses one versioned script tag that creates an isolated iframe. A partner keeps its own navigation, branding, and product shell, while Dhayam owns the rules, board UI, multiplayer synchronization, and audit lifecycle. This is safer than injecting Dhayam’s CSS and JavaScript directly into a partner page because it prevents style collisions and gives the embed a stable version boundary.

The implementation includes validated brand tokens, responsive `postMessage` resize events, lifecycle callbacks, explicit parent-origin checks, and CSP `frame-ancestors` controls. A [Puter-style integration sample](https://github.com/sethusrinivasan/dhayam/blob/main/docs/examples/puter-dhayam-embed.html) is included, modeled on the [Puter Checkers app](https://puter.com/app/checkers). The contract is documented in the [white-label embed design](https://github.com/sethusrinivasan/dhayam/blob/main/docs/white-label-embed.md).

## Design patterns used deliberately

The project uses a few recognizable patterns, but not every good separation of code needs a pattern name:

- **Finite-state machine / State pattern:** Game phases (`roll`, `move`, and `done`) and turn transitions constrain which actions are valid. The implementation uses explicit state fields and guards rather than a hierarchy of state classes, so this is a state-machine implementation with a State-pattern influence, not a textbook object-oriented State-pattern implementation. See [State pattern](https://en.wikipedia.org/wiki/State_pattern) and [finite-state machine](https://en.wikipedia.org/wiki/Finite-state_machine).
- **Strategy pattern:** AI move selection accepts `balanced`, `aggressive`, or `cautious` policies at runtime. The caller stays the same while the scoring weights change, matching the intent of the [Strategy pattern](https://en.wikipedia.org/wiki/Strategy_pattern).
- **Observer / publish-subscribe:** A Durable Object broadcasts authoritative updates to multiple WebSocket clients, and each client reacts to messages such as `SYNC_STATE`, `PRESENCE`, and `SEAT_ABANDONED`. This is a distributed form of the notification idea described by the [Observer pattern](https://en.wikipedia.org/wiki/Observer_pattern), with broadcast semantics related to [publish–subscribe](https://en.wikipedia.org/wiki/Publish%E2%80%93subscribe_pattern).
- **Adapter boundary:** The local stdio MCP server and the hosted Streamable HTTP MCP endpoint expose the same game-tool concepts through different transports. They are adapter-like integration layers around the game model, consistent with the purpose of the [Adapter pattern](https://en.wikipedia.org/wiki/Adapter_pattern), although they are not identical class-based GoF examples.

The deployment pipeline, watchdog, retry loop, and audit log are architectural mechanisms rather than claims of additional Gang of Four patterns.

## One rules engine, several front ends

The most important architectural decision was to make [`src/game.ts`](https://github.com/sethusrinivasan/dhayam/blob/main/src/game.ts) the headless, testable authority for game state and legal moves.

The engine models players, pieces, the active turn, the phase (`roll`, `move`, or `done`), the pending dice pool, captures, and finishing order. It exposes operations such as:

- creating a game for 2–32 players;
- mapping two Dayakattai faces to a move value, including double-zero as 12;
- generating the four rotationally equivalent routes;
- evaluating legal moves from a dice pool;
- applying a validated move;
- enforcing safe squares, capture prerequisites, and exact finishing rolls.

The board has a 44-position route. Instead of storing four independent routes, the engine stores one north-facing route and rotates coordinates for the other seats. This keeps the geometry symmetric and removes an entire class of copy-and-edit errors.

Move evaluation is intentionally more than arithmetic. A move can consume several values from a bonus chain, and an earlier step can capture an opponent and unlock the inner track for a later step in the same move. The engine therefore evaluates values sequentially against a temporary position before producing a move object. The client can animate the result square by square, while the server can verify the same result without trusting client coordinates.

The browser has a presentation-oriented engine for animation and computer play, while the Cloudflare worker has its own JavaScript engine for authoritative online execution. They implement the same rules model but do not share one runtime module. The distinction matters: `src/game.ts` is the tested reference, while the worker still requires its own regression coverage. This separation makes it possible to improve the UI without quietly changing the rules.

## Why vanilla browser code?

React or another large UI framework would have been a reasonable default, but it was not the right tradeoff here. The board is a fixed 7×7 layout, the visual state is highly explicit, and the project benefits from direct control over timing:

- CSS 3D transforms drive the brass dice animation.
- Pawns move one square at a time so captures and route progress remain visible.
- Small ES modules separate state, rendering, audio, turns, multiplayer, diagnostics, and configuration.
- There is no framework runtime, reconciliation loop, or client-side build requirement for the static site.

This makes the application easy to host on GitHub Pages as a mirror and on Cloudflare as the edge deployment. It also keeps the failure surface small: when a browser bug occurs, it can usually be traced to a specific state transition or DOM operation rather than a framework lifecycle.

## Multiplayer: authoritative state at the edge

Online rooms run in a Cloudflare Durable Object implemented in [`cloudflare/worker.js`](https://github.com/sethusrinivasan/dhayam/blob/main/cloudflare/worker.js). The object owns the authoritative game state, seat claims, reconnection tokens, audit history, and connected WebSockets. SQLite persistence inside the object keeps the room state available across object hibernation.

The client sends intent—roll, move, pass, or seat claim—not an arbitrary replacement state. The Durable Object checks the sender's seat token, verifies turn ownership, applies the operation through its authoritative JavaScript engine, persists the result, and broadcasts a `SYNC_STATE` message. Clients can animate the event, but the synchronized state remains authoritative.

WebSocket Hibernation is a particularly good fit for a board game. Players spend much more time thinking than sending messages, so the room can keep connections open without continuously consuming compute while idle.

The project also retains a WebRTC/P2P path for static hosting scenarios. That gives the GitHub Pages mirror a useful multiplayer mode while Cloudflare supplies centralized state, MCP access, and a globally distributed deployment.

## The bugs that changed the design

The most valuable work was not the first implementation. It was the failure analysis.

### Animation state deadlocks

Several early failures left the UI in a permanent “rolling” or “moving” state after an exception or an unexpected network response. The visible symptom was a disabled action button and a game that appeared frozen. The fixes are documented in the [multiplayer deadlock and state-normalization commit](https://github.com/sethusrinivasan/dhayam/commit/c92f5eb08f84a97c71f2746b22707e1ab3ce1204), the [solo move-deadlock fix](https://github.com/sethusrinivasan/dhayam/commit/b38a545dfd3aebdc73a81c11f7ad4c0ed9aa87d7), and the [UI deadlock and audit-state fix](https://github.com/sethusrinivasan/dhayam/commit/c071bed3dbc9ad635b672d2e6700a99c7e1123d6).

The fix was structural rather than a longer timeout: state flags are cleared in `try...finally` paths, error messages reset transient animation state, and remote state can be buffered while a local dice or movement animation is still running. This preserves readable animation without allowing presentation timing to become the source of truth.

### Turn 22 and the watchdog that trusted the wrong message

The hardest incident was an eight-player live demo that stopped at turn 22 with a bonus roll still pending. Flight Recorder data showed that a keepalive `PONG` had arrived from Cloudflare and cleared the same watchdog timer used to detect a stalled turn. The timer was not re-armed, so the demo stopped waiting for an authoritative state transition that never came.

The [Turn 22 freeze fix](https://github.com/sethusrinivasan/dhayam/commit/c29b0e4d2d1dbdb883da3236dd9c448aa868bf4d) had four parts:

1. Transport keepalives are short-circuited and cannot affect turn timers.
2. Only authoritative messages such as `INIT`, `SYNC_STATE`, and `ERROR` disarm the action watchdog.
3. Keepalive traffic is sent across all active sockets rather than relying on one seat.
4. An autonomous stall detector periodically checks liveliness, requests fresh state, and re-kicks the turn runner when necessary.

This was a useful distinction: network liveness and game liveness are related, but they are not the same signal.

### Reconnection and abandoned seats

A dropped mobile connection should not immediately destroy a player's seat. The [reconnection and rate-limiting change](https://github.com/sethusrinivasan/dhayam/commit/39dd5f6a08aa3e36ea0729bb1fdf2c3e7e30ab1b) makes the Durable Object record `disconnectedAt` and give the player a 60-second grace period. A reconnect with the matching token silently restores the seat. If the grace period expires, the seat is released, the player's active turn is auto-passed when necessary, and remaining clients receive a `SEAT_ABANDONED` event.

The browser complements this with bounded exponential retry—2, 4, and 8 seconds—before showing a connection-lost state. Intentional leave operations cancel the retry loop so a user cannot accidentally reconnect after leaving a room.

### Scaling beyond the original seating model

The first implementation assumed a small four-seat game. The engine now supports 2–32 players by repeating the four rotational seat orientations while preserving route and rule symmetry. This required expanding names, avatars, colors, and server-side arrays, then adding freshness checks for 8-, 16-, and 32-player initialization.

The [32-player scaling change](https://github.com/sethusrinivasan/dhayam/commit/3e794e0cc4ded5f93946c4cdde4ac9602c8ca47d) made those limits explicit. `MIN_PLAYERS` and `MAX_PLAYERS` are exported engine constants, rather than scattered literals that can drift between the UI, worker, and tests.

## Diagnostics are part of the product

Multiplayer bugs are difficult to reproduce from a screenshot. Dhayam includes a client-side Flight Recorder: a bounded circular buffer of recent clicks, key events, rolls, moves, WebSocket messages, watchdog actions, errors, and state transitions.

The recorder also preserves game initialization metadata such as mode, player count, transport, room code, seat, and rules variant. A user can export the diagnostic bundle to the clipboard and attach it to a bug report without installing developer tooling.

The game audit is separate from the Flight Recorder. It records ordered rolls, bonus-chain decisions, piece numbers, player names, moves, captures, passes, winner events, and board snapshots. This makes a match explainable, while the threat model is explicit that a browser-generated audit is not cryptographic proof of fair play.

## Deployment safety: staging before production

The deployment design treats production promotion as a pipeline, not a single `wrangler deploy` command.

Every change first deploys to a Cloudflare staging worker. The staging gate then runs the full automated suite and a live headless-browser check covering:

- HTTP health and MCP discovery;
- all 49 board cells;
- zero browser runtime exceptions;
- player rendering and dice interaction;
- 8-, 16-, and 32-player initialization.

Only after staging passes does a GitHub Environment approval become available. A reviewer can open the staging URL, play a turn, inspect the UI, and review diagnostics before approving production. The production job runs only after that approval, followed by a production smoke check.

This sequence protects against two different failure classes: unit tests catch logic regressions, while live staging checks catch packaging, routing, asset, browser, and edge deployment mistakes. A scheduled liveness workflow checks both environments independently.

The worker also applies defensive limits at the edge: payload size caps, WebSocket frame limits, token checks for room actions, explicit CORS and security headers, parameterized SQLite statements, and a per-IP WebSocket join rate limiter. The rate limiter is intentionally lightweight and in-memory; it is a hot-path abuse control, not an identity system.

## MCP as a verification surface

The same game model is exposed through Model Context Protocol tools. The local adapter and Cloudflare worker provide corresponding tool surfaces over different transports. An MCP client can create a game, roll dice, inspect state and audit events, request legal moves, evaluate candidate moves, play an AI turn, or simulate a match.

This is useful for more than demonstrations. It provides a structured, machine-readable surface for checking the rules engine and exercising edge cases without driving the browser. The MCP tools are deliberately scoped to game operations; they do not provide shell, filesystem, or arbitrary outbound network access.

### Running an AI-versus-AI match with Copilot CLI

The Cloudflare deployment makes this usable from an MCP-aware client without checking out the repository or running the Python adapter. In Copilot CLI, open `/mcp`, add a remote Streamable HTTP server pointing to:

```text
https://dhayam.cancun.workers.dev/mcp
```

Then a prompt such as the following is enough to drive a computer-to-computer match:

```text
Use the Dhayam MCP server to create a two-player match named Kiro and Copilot.
Run an AI-versus-AI game with balanced strategy, report the winner and key
captures, and include the audit summary.
```

Copilot can use `dhayam_simulate_ai_match` for a headless simulation. For a visible match, use `dhayam_simulate_online_match` with a room code and a turn count; the Cloudflare worker advances AI turns in the Durable Object room while browser spectators watch the dice, movement, and synchronization over WebSockets. The same endpoint also supports lower-level experiments: `dhayam_new_game`, `dhayam_play_ai_turn`, `dhayam_get_state`, `dhayam_evaluate_moves`, and `dhayam_get_audit_log`.

This is different from the repository’s local [`mcp/server.py`](https://github.com/sethusrinivasan/dhayam/blob/main/mcp/server.py): the local server is a zero-dependency stdio adapter, while the hosted endpoint gives Copilot CLI a remote, shareable edge service. In both cases, the AI is choosing and executing game actions through typed tools; it is not inventing board state or bypassing the rules engine. This workflow was exercised locally with Copilot CLI during the November 2, 2026 development session.

## Current state and lessons

The current release is v0.3.2/build 52. The test suite contains 72 passing checks spanning frontend integrity, headless browser behavior, rules, multiplayer regressions, Cloudflare endpoints, and MCP workflows.

The project’s main lesson is that “small” applications still need explicit boundaries. The browser owns presentation, the rules engine owns legality, the Durable Object owns online authority, the audit explains what happened, and the deployment pipeline controls what reaches users. Keeping those responsibilities separate made it possible to add multiplayer resilience and 32-player support without turning every UI change into a rules change.

The game itself does not call an external AI service during normal play; AI and MCP are development, simulation, and optional computer-play surfaces.

## Further reading

- [Architecture and technical design](https://github.com/sethusrinivasan/dhayam/blob/main/docs/architecture.md)
- [Development, testing, and deployment workflow](https://github.com/sethusrinivasan/dhayam/blob/main/docs/development-workflow.md)
- [Staging and production promotion](https://github.com/sethusrinivasan/dhayam/blob/main/docs/staging-promotion.md)
- [Threat model and privacy](https://github.com/sethusrinivasan/dhayam/blob/main/docs/threat-model.md)
- [Test plan](https://github.com/sethusrinivasan/dhayam/blob/main/docs/test-plan.md)
- [AI-assisted development acknowledgement](https://github.com/sethusrinivasan/dhayam/blob/main/docs/ai-tools.md)
