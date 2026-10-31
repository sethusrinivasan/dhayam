# 📋 Dhayam Project Board & Feature Roadmap

This document outlines the active roadmap, feature gaps, and milestones needed to elevate Dhayam into a globally accessible, polished, and authentic multiplayer board game.

---

## 🎯 High-Priority Focus Areas

### 1. Multiplayer Gaps ([Issue #2](https://github.com/sethusrinivasan/dhayam/issues/2) & [Issue #3](https://github.com/sethusrinivasan/dhayam/issues/3))
* [ ] **Public Matchmaking & Room Lobby ([#2](https://github.com/sethusrinivasan/dhayam/issues/2))**:
  - Allow hosts to mark rooms as "Public" or "Private".
  - Provide a live lobby browser displaying active waiting rooms.
  - "Quick Match" one-click button pairing two random online players.
* [ ] **Network Reconnection Grace Period ([#3](https://github.com/sethusrinivasan/dhayam/issues/3))**:
  - 60-second grace window when mobile devices switch networks (Wi-Fi ↔ 5G) or lock screen.
  - Visual amber pulse badge indicating `Player is reconnecting...`.
  - Automatic Host Migration if the room host leaves mid-match.
* [ ] **Spectator Mode & Live Emote Cheers**:
  - Dedicated spectator seat type allowing friends to watch live matches in real time.
  - Animated crowd reactions (clapping, cheers) visible to playing participants.

---

### 2. Multi-Language (i18n) & Cultural Localization ([Issue #4](https://github.com/sethusrinivasan/dhayam/issues/4))
Dhayam (தாயக்கட்டை) has deep roots in Tamil Nadu and South Asia (played as Pagade in Karnataka, Pachisi in North India). Full native localization is required to make it truly authentic.

* [ ] **Tamil (தமிழ்) Full Localization**:
  - Authentic cultural terminology:
    - Dice rolls: தாயம் (1), இரண்டு (2), மூன்று (3), நான்கு (4), ஐந்து (5), ஆறு (6), பன்னிரண்டு (12).
    - Game events: வெட்டு (Capture), மலை (Sanctuary / Safe square), பழம் (Home finish), தாயக்கட்டை (Brass dice).
  - Voice commentary using native Tamil browser SpeechSynthesis voice (`ta-IN`).
* [ ] **South Asian Language Pack (Hindi, Telugu, Kannada)**:
  - Hindi (हिन्दी) — Pachisi terminology.
  - Telugu (తెలుగు) — Dhayam / Pagada terminology.
  - Kannada (ಕನ್ನಡ) — Pagade terminology.
* [ ] **Language Selector Dropdown**:
  - Header pill icon (`🌐 Language`) allowing seamless language switching without game reload.
  - Modular JSON translation dictionaries in `site/i18n/`.

---

### 3. Gameplay Customization & Regional Variants ([Issue #5](https://github.com/sethusrinivasan/dhayam/issues/5))
* [ ] **Rule Preset Selector**:
  - **Traditional Tamil Classic**: Only roll 1 (*Dhayam*) enters pieces; strict 1 pawn per start cell.
  - **Family House Variant (Current)**: Turn 1 opening allowance, 1 to enter thereafter.
  - **Speed Dhayam**: 4 pawns per player; rolls 1 and 5 both permit board entry.
* [ ] **2v2 Team Play Mode**:
  - North & South team up against East & West.
  - Teammates share safe squares peacefully without collisions.
  - Match is won when both team members bring all pawns to the center goal.

---

## 📊 Milestone Status

| Milestone | Status | Key Deliverables |
|---|---|---|
| **v1.0: Core Board & Local Play** | ✅ Complete | 7×7 board, 3D brass dice, SVG circuit, local pass-and-play, sound effects. |
| **v1.1: Cloudflare Edge Multiplayer** | ✅ Complete | Durable Objects, WebSocket Hibernation, QR code join, SQLite persistence. |
| **v1.2: Solo AI & Progressive Lighting** | ✅ Complete | Solo vs Computer heuristic AI, progressive track brightness, capture flight animation, scoring table. |
| **v1.3: Autonomous MCP Engine** | ✅ Complete | `dhayam_play_ai_turn`, `dhayam_simulate_ai_match`, `dhayam_evaluate_moves`. |
| **v2.0: Public Matchmaking & Lobbies** | 🟡 Planned ([#2](https://github.com/sethusrinivasan/dhayam/issues/2), [#3](https://github.com/sethusrinivasan/dhayam/issues/3)) | Public room directory, Quick Match, 60s disconnect grace period, host migration. |
| **v2.1: Tamil & South Asian i18n** | 🟡 Planned ([#4](https://github.com/sethusrinivasan/dhayam/issues/4)) | Tamil, Hindi, Telugu, Kannada UI translations and native voice synthesis. |
| **v2.2: 2v2 Teams & Regional Rules** | 🟡 Planned ([#5](https://github.com/sethusrinivasan/dhayam/issues/5)) | 2v2 partnership matches and rule presets. |
