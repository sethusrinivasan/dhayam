# ✺ Dhayam — Game Submission & Reflection

This document contains the official submission responses, project reflections, and technical highlights for the **Dhayam** game submission.

---

## 🎮 Project Links & Metadata

- **Game Name:** Dhayam (தாயக்கட்டை)
- **Live Cloudflare Edge Game:** [https://dhayam.cancun.workers.dev](https://dhayam.cancun.workers.dev)
- **GitHub Repository:** [https://github.com/sethusrinivasan/dhayam](https://github.com/sethusrinivasan/dhayam)
- **GitHub Pages Live Mirror:** [https://sethusrinivasan.github.io/dhayam/](https://sethusrinivasan.github.io/dhayam/)
- **Streamable HTTP MCP Endpoint:** [https://dhayam.cancun.workers.dev/mcp](https://dhayam.cancun.workers.dev/mcp)
- **Tech Stack:** Vanilla HTML5, Modular CSS3 (3D perspective transforms), ES Modules, TypeScript rules engine, Cloudflare Workers & Durable Objects (with WebSocket Hibernation & SQLite edge persistence). Zero external runtime dependencies.

---

## 📝 Submission Questions & Answers

### 1. Briefly describe the game you made.

> **Dhayam** is an authentic, cross-platform digital revival of *Dayakattai*, an ancient Tamil roll-and-move strategy board game that predates and inspired games like Pachisi, Chaupar, and Ludo. 
>
> Designed for 2 to 4 players, the game can be played via real-time online multiplayer, local tabletop pass-and-play, or solo against intelligent computer AI. Players roll two traditional cuboidal brass dice to enter pawns on a *Dhayam* (1), race along a 44-position rotational circuit, seek shelter in floral safe squares (*Malai*), execute captures (*Vettu*) to unlock the inner ring, and guide all six pieces to the sacred lotus center (*D4*). 
>
> The digital edition features realistic 3D cuboidal brass dice physics, synchronized real-time multi-user play over Cloudflare Edge WebSockets, dynamic QR code camera joining, synthesized voice commentary, heuristic solo AI, and an exportable cryptographic audit log.

---

### 2. What did you find challenging?

> 1. **Accurate Asymmetric Geometry & Invariants**: Dhayam's board uses a 7×7 grid where every player starts at a different cardinal compass point (`N`, `E`, `S`, `W`) and follows an identical 44-step circuit rotated 90 degrees. Pieces transition from an outer perimeter loop to an inner circuit only after securing at least one capture. Formulating this into an immutable mathematical graph with exact roll-count termination while keeping rules strictly testable in headless Node.js was a rigorous challenge.
> 2. **Multi-User Real-Time Synchronization Without Framework Bloat**: Guaranteeing that 3D dice rolls and square-by-square pawn animations execute simultaneously across heterogeneous devices (desktops, iPhones, Android tablets) without relying on heavy frontend frameworks or high-latency servers. We solved this by pairing vanilla client modules with Cloudflare Durable Objects using WebSocket Hibernation, synchronized event dispatch (`ROLL_START`, `MOVE_START`), and session tokens for instant reload recovery.

---

### 3. What was fun?

> 1. **Crafting the 3D Cuboidal Dayakattai Physics**: Unlike standard 6-sided cubic dice, Dayakattai uses long rectangular prism brass dice that roll values 0, 1, 2, or 3 (with double-zero counting as 12, *Pannirandu*). Designing the 3D CSS tumbling physics, realistic bounce damping, and matching Tamil sound callouts (*"Dhayam!"*, *"Pannirandu!"*) brought the cultural tabletop feel to life.
> 2. **Mobile QR Code Auto-Join & Live Emoji Banter**: Testing instant phone camera QR code auto-joining and tapping floating emoji reactions (🎉, 👏, 🔥, 😂, 🎲, 😱) during close captures brought back the lively banter of playing the game with family on the veranda floor.

---

### 4. What did you learn?

> 1. **Cloudflare Durable Objects & WebSocket Hibernation**: Learned how to architect a zero-idle-cost real-time multiplayer backend on Cloudflare Workers Free Tier. Hibernating WebSockets allows holding open player connections indefinitely across Cloudflare's global edge network without accumulating compute billing until an action message arrives.
> 2. **Zero-Dependency Vanilla Web Power**: Modern web standards (CSS Grid/Transforms, ES Modules, Web Speech API, WebSockets) can deliver a lighter (<30KB total bundle), faster (0ms cold start), and more maintainable game than typical heavy single-page application frameworks like React or Vue.

---

### 5. What are your next steps for adding more to it?

> 1. **Ranked Matchmaking & Public Lobbies**: Expanding from private 5-character room codes into a public lobby system with quick-match queueing, spectator mode, and Elo leaderboards.
> 2. **Haptic Feedback & Spatial Audio**: Adding native Web Vibration API pulses when dice bounce or captures occur on mobile devices, plus authentic brass dice sound samples recorded from vintage sets.
> 3. **Autonomous AI Tournaments via MCP**: Connecting autonomous LLM agents to the `/mcp` endpoint to compete in multi-agent Dhayam strategy tournaments with automated real-time commentary.
