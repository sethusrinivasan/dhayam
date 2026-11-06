# Dhayam Engineering Scrum Board

**Current Cycle**: Sprint 1 (Active)  
**Sprint Goal**: Modernize player identity, AI opponent variety, gender-aligned voice commentary, and implement a spectacular festive victory celebration.

---

## 1. Scrum Board Overview

```
+-------------------------------------------------------------------------------------------------------------------+
|  BACKLOG (44 pts)          |  TODO (5 pts)             |  IN-PROGRESS (5 pts)      |  DONE (Sprint 0 / Shipped)   |
+-------------------------------------------------------------------------------------------------------------------+
|  #15 (5 pts) Layout Audit  |  (Ready for Sprint 1)     |  #14 (5 pts) Dynamic      |  #7 (8 pts) Tamil i18n       |
|  #12 (8 pts) Offline PWA   |                           |  Personas, Naming, Voice  |  #8 (5 pts) AI Guided Demo   |
|  #16 (5 pts) Spectator QR  |                           |  & Win Celebration        |  #6 (8 pts) State Machine    |
|  #13 (8 pts) Hand Gestures |                           |                           |  #10 (3 pts) White-label Embed|
|  #5  (5 pts) Rule Variants |                           |                           |  #3 (5 pts) Reconnect Retries|
|  #2  (3 pts) Public Lobby  |                           |                           |                              |
|  #4  (3 pts) Regional i18n |                           |                           |                              |
|  #11 (5 pts) 32p Stress    |                           |                           |                              |
|  #9  (5 pts) OAuth Login   |                           |                           |                              |
+-------------------------------------------------------------------------------------------------------------------+
```

---

## 2. Active Sprint (Sprint 1)

| Issue | Title | Points | Assignee | Status | Acceptance Criteria / Subtasks |
|---|---|---|---|---|---|
| **[#14](https://github.com/sethusrinivasan/dhayam/issues/14)** | **Dynamic Personas, Localized IP Naming, Gender-Aligned Voice & Spectacular Win Celebration** | **5** | `@copilot` | 🟢 **DONE (Ready for Review)** | • ✅ Retiring "Leo" with 10 female & male personas<br>• ✅ Integrating persona heuristic strategy weights<br>• ✅ Localized IP/timezone naming suggester<br>• ✅ Gender-aligned Web Speech API voice selection<br>• ✅ Web Audio conch fanfare & canvas confetti celebration |

---

## 3. Product Backlog & Story Point Estimation

Total Backlog: **44 Story Points**

| Priority | Issue | Title | Points | Complexity Justification |
|---|---|---|---|---|
| 🔴 **P0** | **[#15](https://github.com/sethusrinivasan/dhayam/issues/15)** | Solo Mode vs Computer UX Audit & Multi-Device Responsive Layout Verification | **5** | Multi-viewport testing matrix (7 resolutions), zero vertical scrolling verification, tap target audit. |
| 🟠 **P1** | **[#12](https://github.com/sethusrinivasan/dhayam/issues/12)** | Offline PWA Mode: Zero-connectivity gameplay with automatic background refresh & sync | **8** | Service Worker App Shell caching, web manifest, network sensor, non-destructive background updates. |
| 🟠 **P1** | **[#16](https://github.com/sethusrinivasan/dhayam/issues/16)** | Multiplayer Spectator Mode: Join ongoing games via QR code with live spectator counter | **5** | Durable Object spectator connection tagging, real-time counter broadcast, SVG QR modal, read-only HUD. |
| 🟡 **P2** | **[#13](https://github.com/sethusrinivasan/dhayam/issues/13)** | Camera Hand Gesture Tracking: Touchless game controls via webcam gesture recognition | **8** | WebRTC getUserMedia, on-device gesture classifier, PIP HUD overlay, hardware LED safety teardown. |
| 🟡 **P2** | **[#5](https://github.com/sethusrinivasan/dhayam/issues/5)** | Gameplay: Regional Traditional Rule Variants (2v2 Team Play & Entry Customization) | **5** | State machine expansion for partner routing, team sanctuary rules, and entry rule toggles. |
| 🟡 **P2** | **[#2](https://github.com/sethusrinivasan/dhayam/issues/2)** | Multiplayer: Public Room Discovery & Instant Matchmaking Lobby | **3** | Durable Object room indexing and public lobby list UI. |
| ⚪ **P3** | **[#4](https://github.com/sethusrinivasan/dhayam/issues/4)** | i18n & Localization: Support Hindi, Telugu, Kannada | **3** | String catalog expansions and voice locale mapping beyond English & Tamil. |
| ⚪ **P3** | **[#11](https://github.com/sethusrinivasan/dhayam/issues/11)** | Investigate 32-player 128x stress rendering and Linux GPU crash diagnostics | **5** | Headless Chrome stress benchmarking and WebGL/Canvas allocation limits. |
| ⚪ **P3** | **[#9](https://github.com/sethusrinivasan/dhayam/issues/9)** | Add OAuth Sign‑In Support (Google & GitHub) | **5** | OAuth 2.0 PKCE client flow, user profile badge, optional cloud sync. |

---

## 4. Completed Work (Shipped in Sprint 0)

| Issue | Title | Points | Shipped Commit / Deliverable |
|---|---|---|---|
| **#7** | Full Tamil Localization & Internationalization Plan | **8** | Shipped in `8d6353f`, `988cb3a`, `9e441ab` |
| **#8** | AI‑Driven Demo Mode Feature Plan | **5** | Shipped in `site/js/demo.js` |
| **#6** | Extract Dhayam Game Logic as a State Machine | **8** | Shipped in `src/game.ts` & `site/js/engine.js` |
| **#10** | Design white-label script-tag embed integration | **3** | Shipped in `site/embed/` & `docs/white-label-embed.md` |
| **#3** | Multiplayer: Disconnect Reconnection Grace Period | **5** | Shipped in `site/js/multiplayer.js` |
