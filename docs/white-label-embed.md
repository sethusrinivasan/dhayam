# White-label Dhayam Embed Design

**Tracking issue:** [#10 — Design white-label script-tag embed integration](https://github.com/sethusrinivasan/dhayam/issues/10)

This document defines the v1 integration for portals that want to host Dhayam inside their own branded experience. It is a one-script installation with an isolated game surface, validated branding, responsive sizing, and the existing game modes.

The design is modeled for portals such as [Puter](https://puter.com/) and its [Checkers app](https://puter.com/app/checkers): the host owns the page shell and product identity, while Dhayam owns the board, rules, game state, and multiplayer protocol.

## Design choice: loader plus iframe

The integration should use a versioned loader that creates an iframe:

```html
<script
  src="https://dhayam.cancun.workers.dev/embed/v1/embed.js"
  data-container="#dhayam-game"
  data-mode="solo"
  data-theme="classic"
  data-brand-name="Puter"
  data-brand-logo="https://puter.com/favicon.ico"
  data-height="760">
</script>
```

The iframe boundary is intentional:

- Dhayam CSS cannot collide with host CSS.
- Dhayam JavaScript globals cannot collide with host applications.
- The game can be upgraded independently through `/embed/v1/`.
- The host can apply its own navigation, account, and product chrome.
- CSP and origin checks can be applied to the embedded surface.

Direct DOM injection is not recommended. It would be smaller initially, but would create a long-term compatibility and security burden for every integration partner.

## Host integration API

The first release should support one small configuration object and a few read-only lifecycle events. Do not start with a general command bus. A smaller API is easier to document, test, secure, and keep compatible.

The loader should support both a one-script form and an explicit mount form.

### One-script form

```html
<div id="dhayam-game"></div>
<script
  src="https://dhayam.cancun.workers.dev/embed/v1/embed.js"
  data-container="#dhayam-game"
  data-mode="solo"
  data-theme="classic"
  data-brand-name="Puter"
  data-height="760">
</script>
```

### JavaScript mount form

```html
<div id="dhayam-game"></div>
<script src="https://dhayam.cancun.workers.dev/embed/v1/embed.js"></script>
<script>
  DhayamEmbed.mount("#dhayam-game", {
    mode: "solo",
    theme: "classic",
    height: 760,
    brand: {
      name: "Puter",
      logoUrl: "https://puter.com/favicon.ico",
      primaryColor: "#6d28d9",
      accentColor: "#f59e0b"
    },
    onReady(event) {
      console.log("Dhayam ready", event);
    },
    onGameOver(event) {
      console.log("Winner", event.winner);
    }
  });
</script>
```

The loader is shipped at `/embed/v1/embed.js`. The `/embed` iframe route currently starts the existing solo game shell; multiplayer room joining and richer host commands remain future compatible extensions.

## Initial configuration

The first version should accept only options needed to render and join a game:

| Option | Values | Purpose |
|---|---|---|
| `mode` | `solo`, `local`, `multiplayer`, `spectator` | Selects the initial experience |
| `theme` | `classic`, `dark`, `high-contrast` | Selects constrained visual tokens |
| `height` | pixels or `auto` | Sets the initial iframe height |
| `roomCode` | validated room identifier | Joins or observes a multiplayer room |
| `brand` | validated name, logo, and color tokens | Applies partner co-branding |

Brand configuration must use validated tokens. Partners should not be able to inject arbitrary CSS, HTML, JavaScript, or inline event handlers.

## Small `postMessage` protocol

The loader and iframe should communicate with a small, versioned message protocol. Every message should include `source: "dhayam-embed"` and a protocol version. The first release needs configuration, resize, lifecycle, and error messages only.

Host-to-iframe example:

```json
{
  "source": "dhayam-embed",
  "version": 1,
  "type": "CONFIGURE",
  "config": {
    "mode": "solo",
    "theme": "classic",
    "brand": {
      "name": "Puter",
      "primaryColor": "#6d28d9"
    }
  }
}
```

Iframe-to-host events:

```json
{
  "source": "dhayam-embed",
  "version": 1,
  "type": "GAME_OVER",
  "winner": "Maya",
  "roomCode": null
}
```

Initial event types:

- `READY`
- `RESIZE`
- `GAME_STARTED`
- `TURN_CHANGED`
- `GAME_OVER`
- `ROOM_JOINED`
- `ERROR`

Commands such as `NEW_GAME`, `JOIN_ROOM`, and `LEAVE_ROOM` should be added only when a real partner needs them. The host can reload or remount the iframe for the initial release. Avoid adding a command surface that duplicates the game’s own controls.

The iframe must verify `event.origin` and the expected `event.source` before accepting commands. The parent origin should be passed through configuration only after the loader has established the actual parent origin; security decisions must never rely solely on a user-controlled data attribute.

## Responsive behavior

The iframe should publish its required height:

```json
{
  "source": "dhayam-embed",
  "version": 1,
  "type": "RESIZE",
  "height": 812
}
```

The loader can update the iframe height within bounded minimum and maximum values. The embedded client must still work when resizing is unavailable, and it must preserve keyboard access, reduced-motion behavior, visible focus, and screen-reader labels.

## Security and privacy

The embed should preserve the existing security posture:

- Use HTTPS and WSS only.
- Validate and escape partner-provided names and labels.
- Keep room tokens and game authority in the Cloudflare backend; never put secrets in `data-*` attributes.
- Restrict `postMessage` handling to the recorded parent origin.
- Set `Content-Security-Policy: frame-ancestors` for approved partner origins where an allowlist is required.
- Keep the main site’s framing policy separate from the embed route.
- Retain payload limits, WebSocket join throttling, token checks, and server-side turn validation.
- Do not add analytics or partner tracking by default.
- Document that browser audits are explainable logs, not tamper-proof proof of fair play.

Partner-specific origin allowlisting should be an operational configuration, not a bypass in the client.

## Multiplayer and branding boundaries

The partner portal owns the surrounding experience. Dhayam remains responsible for:

- rules and legal moves;
- dice generation and bonus-chain behavior;
- authoritative Durable Object room state;
- WebSocket synchronization;
- reconnection and abandoned-seat handling;
- game audit events.

The partner should receive lifecycle events and summary results, not direct write access to the authoritative game state. This prevents a branded host page from accidentally bypassing turn validation.

## Versioning and rollout

Use immutable major versions:

```text
/embed/v1/embed.js
/embed/v1/index.html
/embed/v2/embed.js
```

Bug fixes may be released behind the same major version, but message schemas and configuration behavior should remain backward compatible. A future version should be opt-in rather than silently replacing an integration.

The implementation should be tested through:

1. loader installation in a minimal host page;
2. Puter-style host page with custom branding;
3. desktop, tablet, and mobile iframe sizes;
4. blocked or invalid origin messages;
5. resize and lifecycle events;
6. solo and multiplayer room flows;
7. staging E2E validation before production promotion.

## Implementation status

1. Shipped `/embed` and `/embed/v1/embed.js` with the iframe boundary.
2. Shipped validated `data-*` branding, constrained themes, and responsive resizing.
3. Shipped `READY`, `RESIZE`, `GAME_STARTED`, and `GAME_OVER` lifecycle messages.
4. Shipped parent-origin and iframe-source validation plus route-specific framing headers.
5. Added a headless Chrome script-tag integration test and the Puter-style sample.
6. Track multiplayer room configuration and additional commands as follow-up work under issue #10.

## Readable implementation rules

The embed should be implemented in the same style as the rest of the project: small functions, explicit data flow, and comments that help a human understand the reason for a decision.

- Prefer named functions such as `readEmbedConfig`, `createGameFrame`, `sendEmbedEvent`, and `resizeFrame`.
- Keep validation close to the data boundary. Return a clear error or a safe documented default; do not silently accept malformed branding.
- Use early returns for invalid messages and keep the normal path visually obvious.
- Keep the message switch explicit. Do not hide protocol behavior behind a generic dispatcher or metaprogramming.
- Comment why an origin check, size limit, or fallback exists. Do not comment what the next line plainly does.
- Keep the loader independent from game rules. It should create the frame, pass configuration, resize it, and relay lifecycle events.
- Keep the iframe responsible for rendering and game behavior. It should not know how the partner page is structured.
- Prefer straightforward code over abstractions that save a few lines but require a design document to understand.

This follows the readability philosophy associated with SQLite and PostgreSQL: clear names, stable control flow, local reasoning, and comments that preserve design intent. The goal is code that can be maintained by a new contributor without reverse-engineering a framework.

All implementation work should reference [issue #10](https://github.com/sethusrinivasan/dhayam/issues/10).
