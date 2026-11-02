# User Authentication & Profile Feature Plan

## Goal
Provide users with the ability to **sign‑in** using **Google** or **GitHub** OAuth, create a persistent profile (alias, avatar, score), and use that profile when joining a game. This foundation will later enable leaderboards, points tracking, and social features.

## High‑Level Requirements
| Category | Requirement |
|----------|--------------|
| **OAuth Integration** | Google and GitHub sign‑in flows using Cloudflare Workers (or a minimal backend) – no custom server needed beyond the existing worker. |
| **Profile Storage** | Persist user data (OAuth provider ID, alias, avatar, scores) in a **Workers KV** namespace (`USER_PROFILE`). |
| **Alias Rules** | Alias must be **≤ 8 characters**, alphanumeric, no profanity, and must not conflict with reserved words. |
| **Avatar Selection** | Pre‑defined set of avatar icons (SVG/PNG) selectable in the profile UI. |
| **Score Tracking** | Increment a `score` integer on win, decrement on loss, store per‑user. |
| **Frontend UI** | - Sign‑in button(s) on the landing page.
- Profile modal showing alias, avatar, and current score.
- Join‑game dialog offering **“Play as Guest”** or **“Play with Profile”**.
- Ability to change alias/avatar from the Settings panel.
| **Security & Privacy** | Tokens never stored client‑side; only the OAuth **access token** (short‑lived) is exchanged for a **signed JWT** issued by the worker. JWT stored in a secure HttpOnly cookie. |
| **Validation** | Alias validation on both client and server (regex, length, profanity filter). |
| **Extensibility** | Abstract `AuthProvider` interface so additional providers can be added later. |
| **Leaderboard Hook** | Expose an endpoint `/leaderboard` returning top N users by score – future work but must be considered in data schema. |

---

## Detailed Work Breakdown
### 1. Backend – Cloudflare Workers Enhancements (2 weeks)
- **Create KV namespace** `USER_PROFILE` via `wrangler.toml`.
- **AuthProvider interface**:
  ```ts
  interface AuthProvider { name: string; authorizeUrl: string; tokenUrl: string; clientId: string; clientSecret: string; getProfile(accessToken): Promise<{id:string, email:string, name:string}>; }
  ```
- **Implement Google & GitHub adapters** using their OAuth2 endpoints.
- **OAuth flow**:
  1. User clicks "Sign in with X" → redirect to `/auth/start?provider=X` (worker) → generate `state` nonce, store in KV.
  2. Provider redirects back to `/auth/callback?code=…&state=…`.
  3. Worker exchanges `code` for `access_token`.
  4. Retrieve user profile, create/find a record in `USER_PROFILE` KV (`provider|id`).
  5. Issue a **signed JWT** (HS256) containing `sub`, `provider`, `exp`.
  6. Set HttpOnly cookie `dhayam_jwt`. Respond with a redirect back to the app.
- **Profile API** (`GET /api/profile`, `POST /api/profile`):
  - GET returns alias, avatar URL, score.
  - POST validates alias (≤8 chars, regex `^[a-zA-Z0-9]+$`, profanity‑filter via a simple blocklist) and avatar selection, then updates KV.
- **Score update endpoint** (`POST /api/score`): increment/decrement based on game outcome, only callable by authenticated JWT.
- **Leaderboard stub** (`GET /api/leaderboard?limit=10`). Returns an array of `{alias, avatar, score}` sorted descending.
- **Add unit tests** for token exchange, JWT verification, KV CRUD.

### 2. Front‑end – UI Integration (2 weeks)
- **Sign‑in buttons** on `index.html` (Google and GitHub icons). Use `window.location.href = '/auth/start?provider=google'`.
- **Profile modal** (`site/js/profile.js`):
  - Load profile via `/api/profile` (fetch with credentials). 
  - Show current alias, avatar, score.
  - Input for alias (max 8 chars), avatar picker (grid of pre‑loaded icons).
  - Save button → POST to `/api/profile`.
- **Join‑Game dialog** update:
  - Radio option: *Play as Guest* or *Play with Profile*.
  - If profile chosen, ensure JWT cookie exists; otherwise prompt to sign‑in.
- **Settings panel** – add “Profile” tab with same UI for editing alias/avatar.
- **Score display** – show score next to player name during a match (if profile present).
- **Error handling** – show user‑friendly messages for alias validation failures.
- **Responsive design** – make modal mobile‑friendly.

### 3. Validation & Moderation (1 week)
- **Alias validation** (client + server):
  - Regex: `^[a-zA-Z0-9]{1,8}$`.
  - Profanity blocklist (JSON array of banned words). 
  - Reserved words list (`admin`, `system`, etc.).
- **Rate limiting** for auth callbacks (prevent brute‑force).
- **Cookie security** – `Secure`, `SameSite=Strict`, `HttpOnly`.

### 4. Testing (1 week)
- **Unit tests** for provider adapters (mock HTTP responses). 
- **Integration tests** using a local Workers emulator (`wrangler dev`).
- **Cypress** end‑to‑end tests:
  - Sign‑in flow with mock OAuth server.
  - Alias change validation.
  - Score increment after a win.
  - Leaderboard endpoint returns sorted list.

### 5. Documentation & Release (3 days)
- Update `README.md` with **“Sign‑in & Profile”** section and usage instructions.
- Add `docs/auth.md` describing OAuth flow, data schema, and how to obtain client IDs/Secrets.
- Release notes entry: “Added Google/GitHub sign‑in, persistent profiles, and score tracking.”

### 6. Post‑Release Monitoring (1 week)
- Log auth events (`recordAudit('auth_success')`, `auth_failure`).
- Track number of active profiles and average game count per user.
- Gather feedback on alias policy and adjust blocklist as needed.

---

## UX Flow (User Story)
1. **Landing page** – user sees “Play as Guest” and two sign‑in buttons.
2. Click **Google** → OAuth consent screen → redirected back; a profile is created with a default avatar and autogenerated alias (e.g., `user1234`).
3. User opens **Profile** tab, changes alias to `தமிழ்1` (validated, ≤8 chars) and selects a custom avatar.\n4. When **joining a game**, they select “Play with Profile”. The game shows their alias and avatar next to their pieces and updates their score on win/loss.
5. **Leaderboard** can later be accessed from the main menu, showing top scores.

---

## Risks & Mitigations
| Risk | Impact | Mitigation |
|------|--------|-----------|
| OAuth mis‑configuration | Users cannot sign in | Provide clear docs for setting `CLIENT_ID`/`CLIENT_SECRET`; CI checks environment variables. |
| Token leakage | Security breach | Store only short‑lived JWT in HttpOnly cookie; never expose provider tokens to the client. |
| Profanity / illegal alias | Legal/brand risk | Enforce blocklist + length limit; manual admin review for flagged names. |
| KV quota exhaustion | Service degradation | Use per‑user key naming; enforce size limits; monitor KV usage. |
| Cross‑origin attacks | Session hijacking | Use SameSite=Strict cookies; CSRF token on POST endpoints. |

---

## Milestones (7 weeks total)
| Week | Deliverable |
|------|-------------|
| 1‑2 | Cloudflare Worker auth providers, KV schema, JWT issuance. |
| 3‑4 | Front‑end sign‑in buttons, profile modal, join‑game integration. |
| 5   | Validation (alias rules, rate limiting), security hardening. |
| 6   | Testing (unit, integration, Cypress) and CI integration. |
| 7   | Documentation, release notes, monitoring setup. |

---

## Labels & Tracking
- **Labels**: `auth`, `enhancement`, `security`.
- **Project Board**: Add to the “User Features” column.
- **Related Issues**: This epic will be broken into smaller tickets (e.g., `#18 – OAuth worker`, `#19 – Profile UI`, `#20 – Alias validation`).

---

*Created via Antigravity on 2026‑10‑31.*
