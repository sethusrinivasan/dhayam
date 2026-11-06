# Multiplayer Spectator Mode & Live Board Counter Design

**Tracking issue:** [#16 — Multiplayer Spectator Mode: Join ongoing games via QR code with live spectator counter](https://github.com/sethusrinivasan/dhayam/issues/16)

This document defines the architectural design, WebSocket protocol additions, QR code sharing flow, and UI specifications for enabling spectators to join any ongoing Dhayam match in real-time, with a live spectator count visible directly on the game board.

---

## 1. Objectives & Principles

1. **Instant QR Join**: Any player or host can open a "Spectator QR" modal during an active match. Anyone scanning the code with a smartphone camera instantly joins as a read-only spectator without needing an account or app installation.
2. **Live Spectator Counter**: A discrete, high-visibility counter (e.g. `👁️ 4 Watching`) is rendered on the game board, updating in real-time as spectators join or leave.
3. **Read-Only Non-Disruptive HUD**: Spectators see the identical 3D brass dice rolls, coin animations, tactical badges, and audio commentary, but cannot roll dice or move pieces.
4. **Interactive Audience Reactions**: Spectators can send celebratory floating reactions (🎉, 👏, 🔥, 🪔, 😱) to cheer on players, subject to a client-side and server-side rate limiter.
5. **Durable Object Scalability**: Built on Cloudflare Durable Objects WebSocket hibernation with sub-50ms broadcast latency and zero polling overhead.

---

## 2. Architecture & Real-Time Flow

```mermaid
sequenceDiagram
  autonumber
  actor Host as Match Player (Host)
  actor Spectator as Audience Member
  participant ClientUI as Spectator Web Browser
  participant DO as Cloudflare DhayamRoom DO
  participant HostUI as Player Game Board

  Host->>HostUI: Clicks '👁️ Spectate QR' in top bar
  HostUI->>HostUI: Generates SVG QR code: ?room=ROOM123&spectate=1
  Spectator->>ClientUI: Scans QR code with phone camera
  ClientUI->>DO: WebSocket Connect: /api/room/ROOM123/ws?role=spectator
  DO->>DO: Track connection as Spectator; spectatorCount++
  
  par Live Counter Broadcast
    DO->>HostUI: Broadcast SPECTATOR_UPDATE { count: 1 }
    HostUI->>HostUI: Update Board Badge: '👁️ 1 Watching'
  and Initial Game State Sync
    DO->>ClientUI: SYNC_STATE { game, audit, seats, spectatorCount: 1 }
    ClientUI->>ClientUI: Render 7x7 board in Read-Only Spectator HUD
  end

  Note over HostUI,ClientUI: Host rolls dice or moves coin
  HostUI->>DO: ROLL_DICE or MOVE_PIECE
  DO->>ClientUI: Broadcast SYNC_STATE with animated roll / move
  ClientUI->>ClientUI: Plays 3D dice tumble and coin hop sound locally

  opt Spectator Reaction
    ClientUI->>DO: SEND_REACTION { emoji: '🔥' }
    DO->>HostUI: Broadcast REACTION { emoji: '🔥', sender: 'Spectator' }
    HostUI->>HostUI: Float 🔥 particle up the screen
  end

  Spectator->>ClientUI: Closes browser tab
  DO->>DO: webSocketClose; spectatorCount--
  DO->>HostUI: Broadcast SPECTATOR_UPDATE { count: 0 }
  HostUI->>HostUI: Update Board Badge: hidden or '👁️ 0'
```

---

## 3. Protocol & Durable Object Enhancements (`cloudflare/worker.js`)

### 3.1 Connection Tagging & Counter Calculation
The `DhayamRoom` Durable Object uses WebSocket attachment tagging:

```javascript
// On WebSocket connection:
const role = url.searchParams.get("role") === "spectator" ? "spectator" : "player";
server.serializeAttachment({ role, connectedAt: Date.now() });

// Calculating live spectator count:
getSpectatorCount() {
  let count = 0;
  for (const ws of this.ctx.getWebSockets()) {
    try {
      const att = ws.deserializeAttachment();
      if (att && att.role === "spectator") {
        count++;
      }
    } catch (e) {}
  }
  return count;
}
```

### 3.2 Protocol Messages
1. **`SPECTATOR_UPDATE`**:
   ```json
   {
     "type": "SPECTATOR_UPDATE",
     "spectatorCount": 3,
     "timestamp": 1730856000000
   }
   ```
2. **Payload Enrichment**:
   - Include `spectatorCount` inside existing `SYNC_STATE` and `ROOM_UPDATE` payloads.

---

## 4. UI & Game Board Specifications

### 4.1 Spectator Counter Badge (`site/css/panels.css` & `controls.css`)
- **Placement**: Integrated into the top navigation bar or turn indicator bar.
- **Visual Design**:
  - Compact glassmorphism pill: `[👁️ 3 Spectators]` or `[🔴 LIVE 5]`.
  - Subtle pulsating dot indicator (`box-shadow: 0 0 6px rgba(46, 204, 113, 0.8)`).
  - Accessible label: `aria-label="3 spectators currently watching"` with live region `aria-live="polite"`.
- **Zero-Spectator State**:
  - Displays `👁️ Share QR` when count is 0; clicking immediately opens the QR code dialog.

### 4.2 Spectator QR Modal
- Header: *"Invite Spectators to Watch Live"*.
- Body:
  - High-contrast SVG QR code generated with `qrcode.min.js`.
  - Copyable short link: `https://dhayam.cancun.workers.dev/?room=XYZ&spectate=1`.
  - Subtitle: *"Anyone can scan with their phone camera to watch the match in real time"*.
  - Live preview of spectator count inside the modal.

### 4.3 Spectator HUD Experience
When `role === 'spectator'`:
- Action buttons (`Roll Dice`, `Pass Turn`, coin selection) are disabled with a friendly banner:
  - *"👀 You are watching match [ROOM] as a spectator. Cheer for the players below!"*
- Floating reaction tray positioned at the bottom of the board:
  - Quick-tap emojis: `[ 🎉 ] [ 👏 ] [ 🔥 ] [ 🪔 ] [ 😱 ]`.
  - Tapping sends reaction with client-side throttle (max 1 reaction per 1.5 seconds per spectator).

---

## 5. Security & Threat Considerations

- **Denial of Service / Connection Floods**:
  - Cap maximum concurrent spectators per Durable Object room at 256.
  - Return HTTP 429 / WebSocket close `1008 Policy Violation` if room spectator limit is reached.
- **Rate Limiting Reactions**:
  - Enforce max 2 reaction messages per second per WebSocket to prevent particle flood griefing on players' screens.
- **Privacy & Secret Rolls**:
  - Spectators only receive authoritative public state. No uncommitted rolls or hidden secrets are leaked.

---

## 6. Acceptance Criteria

- [ ] Top bar displays dynamic spectator badge (`👁️ X Spectators`) during multiplayer matches.
- [ ] Clicking "Spectate QR" opens modal with scannable SVG QR code and copyable URL.
- [ ] Scanning QR code opens Dhayam directly in read-only spectator mode.
- [ ] Spectator count updates in real-time across all connected clients upon join/leave.
- [ ] Spectators see live dice tumble, coin hops, tactical badges, and audio in sync with players.
- [ ] Spectators can send floating emoji reactions that render across all player screens.
- [ ] Max spectator limit and reaction rate limiting enforced.
- [ ] Unit tests in `test/multiplayer_regression.test.ts` verify spectator connection lifecycle.
