# OWASP Security Analysis & Threat Evaluation

Comprehensive application security review of **Dhayam** across both deployment surfaces:
1. **Frontend Client** (GitHub Pages / Cloudflare Static Assets)
2. **Cloudflare Edge Worker & Durable Objects** (`cloudflare/worker.js`, `/mcp`, WebSockets, SQLite)

Evaluated against the **OWASP Top 10:2021** and **OWASP API Security Top 10**.

---

## Executive Summary & Security Scorecard

| Category | OWASP Vulnerability | Risk Rating | Status | Notes |
|---|---|---|---|---|
| **A01:2021** | Broken Access Control | **LOW** | ✅ Enforced | Authoritative server-side turn validation; players cannot move opponent pawns or act out-of-turn. |
| **A02:2021** | Cryptographic Failures | **LOW** | ✅ Strong | Cryptographic CSPRNG (`crypto.getRandomValues`) for dice; UUIDv4 session tokens; HTTPS/WSS enforced. |
| **A03:2021** | Injection (XSS & SQLi) | **MEDIUM** | ⚠️ Addressed | Parameterized SQLite queries in Durable Objects; `escapeHtml()` applied to player names & banter. |
| **A04:2021** | Insecure Design & Rate Limiting | **MEDIUM** | ⚠️ Needs Hardening | Room codes are 4 characters (brute-forceable); no per-IP connection throttling on WebSocket handshakes. |
| **A05:2021** | Security Misconfiguration | **LOW** | ⚠️ Addressed | Wildcard CORS (`*`) on `/mcp` (intended for public AI agent tool calls); CSP headers recommended. |
| **A06:2021** | Vulnerable & Outdated Components | **LOW** | ✅ Clean | **Zero runtime npm dependencies**; only client libraries are standalone `qrcode.min.js` & `peerjs.min.js`. |
| **A07:2021** | Identification & Auth Failures | **LOW** | ✅ Good | Ephemeral player tokens stored in browser `sessionStorage`; no credentials, passwords, or PII collected. |
| **A08:2021** | Software & Data Integrity Failures | **LOW** | ✅ Verified | CI/CD test automation enforces 48 regression tests before Edge deployment. |
| **A09:2021** | Security Logging & Monitoring | **LOW** | ✅ Implemented | FlightRecorder tracks client lifecycle events; Cloudflare Workers logs track edge exceptions. |
| **A10:2021** | Server-Side Request Forgery (SSRF) | **LOW** | ✅ Immune | The worker performs no outbound HTTP requests to user-supplied targets. |

---

## Detailed Vulnerability Audit & Prioritized Action Plan

### Priority 1 (High / Medium): Input Sanitization & XSS Defense (OWASP A03)
* **Risk**: Player names entered in the seat picker or room lobby are reflected in DOM nodes (`#players`, capture splash badges, voice commentary, chat reactions).
* **Audit Finding**: `site/js/ui.js` contains a robust `escapeHtml(str)` utility (`& -> &amp;`, `< -> &lt;`, `> -> &gt;`, `" -> &quot;`, `' -> &#39;`).
* **Fix & Verification**:
  1. Enforce a 15-character maximum length clamp on all player names server-side in `cloudflare/worker.js` line 702: `name.trim().slice(0, 15)`.
  2. Strip HTML control characters before synthesis in `SpeechSynthesisUtterance`.
  3. Ensure all template strings in `site/js/ui.js` invoke `escapeHtml()` on `player.name`.

### Priority 2 (Medium): WebSocket Connection Rate Limiting & Room Code Entropy (OWASP A04)
* **Risk**: 4-character uppercase alphanumeric room codes (e.g. `CF88`) offer $36^4 \approx 1.68 \times 10^6$ combinations. An automated script could scan active rooms.
* **Audit Finding**: Currently, room codes are not rate-limited on creation or brute-force joining attempts.
* **Remediation**:
  1. Increase room code generation from 4 to 6 characters (e.g. `DH-K9M4P`) offering $36^6 \approx 2.17 \times 10^9$ entropy for public matches.
  2. Implement an in-memory rate limiter per IP address in Cloudflare Worker (max 10 room creations per minute per IP).
  3. Cap WebSocket message payload size to 4KB to prevent memory exhaustion attacks.

### Priority 3 (Medium): Content Security Policy (CSP) & Security Headers (OWASP A05)
* **Risk**: Static frontend hosted on GitHub Pages or Cloudflare could be vulnerable to rogue script execution if third-party CDNs are compromised.
* **Remediation**:
  Serve a strict Content Security Policy (CSP) in `_headers` / Cloudflare:
  ```http
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' wss: https://*.workers.dev; font-src 'self' data:; object-src 'none'; frame-ancestors 'none';
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: microphone=(), camera=(), geolocation=()
  ```

### Priority 4 (Low): SQLite Durable Object State Cleanup & Expiry
* **Risk**: Abandoned multiplayer room states could accumulate in SQLite storage indefinitely.
* **Remediation**:
  Implement an alarm in `DhayamRoom`:
  - Set a 24-hour expiration alarm via `this.ctx.storage.setAlarm(Date.now() + 86400000)`.
  - When the alarm triggers, delete stale rooms if no active WebSockets remain.

---

## Action Plan & Roadmap Summary

| Action Item | Severity | Effort | Target Milestone |
|---|---|---|---|
| **Enforce Strict Name Sanitization & Length Clamping** | P1 | Low | v1.1.0 |
| **Increase Room Code Entropy to 6 Characters** | P2 | Low | v1.1.0 |
| **Add CSP & Security Headers (`_headers`)** | P2 | Low | v1.1.0 |
| **Implement WebSocket Rate Limiting & 4KB Max Payload** | P2 | Medium | v1.2.0 |
| **Durable Object Room Expiry Alarms (24h TTL)** | P3 | Low | v1.2.0 |
