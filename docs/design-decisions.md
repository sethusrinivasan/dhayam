# Design Decisions

| Decision | Why |
|---|---|
| **Zero Runtime Dependencies** | Vanilla HTML5, modular CSS3, and ES Modules guarantee instant 0ms initial load (<30KB gzipped) and lifelong durability without framework deprecations or npm supply-chain risks. |
| **`crypto.getRandomValues` Dice** | Unbiased browser and Cloudflare Edge CSPRNG guarantees fair Dayakattai dice outcomes. |
| **Dual-Surface Architecture** | 100% static client hosting on GitHub Pages and Cloudflare Static Assets paired with a frugal Cloudflare Durable Object for sub-50ms real-time WebSockets and SQLite room state. |
| **Frugal Free-Tier Cloudflare Hosting** | WebSocket Hibernation keeps multi-user connections open across 300+ Edge locations with **zero compute cost** while players think. |
| **Progressive Proportional Track Lighting** | Visual polish: Pawns glow brighter as they enter the second inner square (5×5 ring), pulse with radiance at the third inner approach cross, and shine with maximum golden brilliance at the central goal. |
| **Slow Capture Flight Animation** | Captured pawns smoothly arc from their board cell back to the victim's card in the Family Table with a bounce pulse, making captures visually obvious to all viewers. |
| **Audio Interruption Protection** | Speech synthesis delays computer turns until active audio commentary completes naturally, preventing abrupt speech cut-offs. |
| **Autonomous MCP Game Engine** | Pure engine tools (`dhayam_play_ai_turn`, `dhayam_simulate_ai_match`, `dhayam_evaluate_moves`, `dhayam_simulate_online_match`) allow AI agents and developer workflows to simulate computer-to-computer matches programmatically. |
| **Local Match Player Customization** | Organizers can rename players and choose avatars without requiring accounts or logins. |
| **Tamper-Evident Flight Recorder** | In-memory and exportable event audit captures all rolls, moves, captures, and audio lifecycle events for diagnostics. |
| **White-Label Embed Boundary** | The v1 third-party integration uses a versioned script loader and isolated iframe, keeping partner branding separate from Dhayam UI and rules. Tracked in [issue #10](https://github.com/sethusrinivasan/dhayam/issues/10). |
