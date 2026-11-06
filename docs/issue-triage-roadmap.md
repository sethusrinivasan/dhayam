# Dhayam Issue Triage & Prioritization Roadmap

This document captures the prioritized engineering roadmap across all open issues in the Dhayam repository (`sethusrinivasan/dhayam`).

---

## 1. Prioritization Framework

Issues are classified using a 4-tier impact-vs-effort framework:

- 🔴 **P0 (Immediate Next Impact / Critical Path)**: Direct player emotional resonance, eliminates core monotony, and establishes baseline multi-device layout integrity.
- 🟠 **P1 (High Impact / Core Expansion)**: Essential accessibility (offline-first PWA) and multiplayer spectator streaming.
- 🟡 **P2 (Medium Impact / Feature Depth)**: Innovative interaction modes (webcam gesture controls), traditional rule variants, and matchmaking.
- ⚪ **P3 (Lower Impact / Backlog)**: Edge-case stress benchmarks, non-essential account sign-ins, and secondary regional language expansions.

---

## 2. Issue Priority & Triage Matrix

| Priority | Issue # | Title | Category | Strategic Impact |
|---|---|---|---|---|
| 🔴 **P0** | **#14** | [Dynamic Personas, Localized IP Naming, Gender-Aligned Voice & Spectacular Win Celebration](https://github.com/sethusrinivasan/dhayam/issues/14) | AI, Audio & UX | **Highest immediate impact**. Retires boring "Leo" with 10 diverse female & male personas (Kavitha, Ananya, Murugan, Kavin), matches TTS voice gender, suggests authentic regional names, and adds a celebratory conch fanfare + confetti victory experience. |
| 🔴 **P0** | **#15** | [Solo Mode vs Computer UX Audit & Multi-Device Responsive Layout Verification](https://github.com/sethusrinivasan/dhayam/issues/15) | Responsive Layout | **Core quality baseline**. Ensures zero vertical scrolling during active play and validates 48px tap targets across mobile, tablets, laptops, and foldables. |
| 🟠 **P1** | **#12** | [Offline PWA Mode: Zero-connectivity gameplay with automatic background refresh & sync](https://github.com/sethusrinivasan/dhayam/issues/12) | PWA & Offline | **High accessibility**. Enables 100% offline gameplay, home screen install, and non-destructive background service worker refresh upon reconnecting. |
| 🟠 **P1** | **#16** | [Multiplayer Spectator Mode: Join ongoing games via QR code with live spectator counter](https://github.com/sethusrinivasan/dhayam/issues/16) | Multiplayer & Realtime | **Audience engagement**. Allows watch parties, classroom games, and instant QR scan to spectate with a live board counter. |
| 🟡 **P2** | **#13** | [Camera Hand Gesture Tracking: Touchless game controls via webcam gesture recognition](https://github.com/sethusrinivasan/dhayam/issues/13) | Accessibility & AI Vision | Optional touchless control mode using device webcam with 100% on-device privacy. |
| 🟡 **P2** | **#5** | [Gameplay: Regional Traditional Rule Variants (2v2 Team Play & Entry Customization)](https://github.com/sethusrinivasan/dhayam/issues/5) | Rules Engine | Traditional regional variants including partner 2v2 play and customized opening entries. |
| 🟡 **P2** | **#2** | [Multiplayer: Public Room Discovery & Instant Matchmaking Lobby](https://github.com/sethusrinivasan/dhayam/issues/2) | Multiplayer | Public lobby list for quick open room discovery. |
| 🟡 **P2** | **#9** | [OAuth Sign-In (Google & GitHub) & Frugal Cloudflare D1 Leaderboard](https://github.com/sethusrinivasan/dhayam/issues/9) | Auth & Storage | Persistent player profiles, Google & GitHub OAuth 2.0 PKCE, zero-cost Cloudflare D1 SQL store, top 10 leaderboard, and global user rank. [Design Doc](oauth-leaderboard-design.md). |
| ⚪ **P3** | **#4** | [i18n & Localization: Support Hindi, Telugu, Kannada](https://github.com/sethusrinivasan/dhayam/issues/4) | Localization | Expansion to secondary Indian languages (English and Tamil are already fully shipped). |
| ⚪ **P3** | **#11** | [Investigate 32-player 128x stress rendering and Linux GPU crash diagnostics](https://github.com/sethusrinivasan/dhayam/issues/11) | Performance / Benchmarking | Extreme benchmark testing for 32-player quantum stress scenarios. |

---

## 3. Recommended Next Implementation Step

### 👉 **Next Impactful Work: Issue #14 (`Dynamic Personas, Localized IP Naming, Gender-Aligned Voice & Spectacular Win Celebration`)**

**Why this is the highest impact choice right now:**
1. **Immediate Player Delight**: Every player starting a game currently faces the static, generic computer opponent "Leo". Replacing "Leo" with an authentic roster of female & male opponents (e.g. *Kavitha, Ananya, Murugan, Kavin*) with distinct heuristic playstyles instantly breathes life into the game.
2. **Audio Immersion**: Aligning Web Speech API commentary with the opponent persona's gender and personality creates an interactive, human-like pair play experience.
3. **Emotional Climax (Win Celebration)**: After fighting through 30–40 turns of tactical dice hopping, winning currently feels abrupt. Introducing a grand conch shell fanfare, full-screen canvas confetti & fireworks, and personalized spoken accolades delivers a memorable celebratory payoff.
4. **Natural Follow-up**: Working on #14 directly complements #15 (Solo Mode layout audit), allowing the persona cards, victory celebration, and responsive layout to be refined together seamlessly.
