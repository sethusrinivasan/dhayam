# ⚡ Multiplayer Architecture

Dhayam provides real-time cross-device multiplayer powered by **Cloudflare Workers Durable Objects** with WebSocket Hibernation and embedded SQLite storage.

---

## Technical Highlights

1. **Sub-50ms Global Latency**: WebSocket connections terminate at the nearest Cloudflare Edge data center (300+ PoPs worldwide).
2. **WebSocket Hibernation**: Connections hibernate in memory with **zero CPU consumption** while players deliberate on their moves.
3. **SQLite Authoritative Room State**: Every room maintains authoritative state in SQLite, preventing desynchronization.
4. **Instant QR Code Joining**: Mobile devices join instantly by scanning the SVG QR code generated on the host screen.
5. **Session Token Recovery**: If a mobile player locks their screen or switches tabs, the UUID token in `sessionStorage` automatically reclaims their seat upon reconnect.
