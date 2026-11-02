# Staging & Production Promotion Process

> White-label embed implementation work must reference [issue #10](https://github.com/sethusrinivasan/dhayam/issues/10) and add loader, iframe, origin-policy, and partner integration checks to the staging gate before production promotion.

## URLs

| Environment | URL | Purpose |
|------------|-----|---------|
| **Staging** | `https://dhayam-staging.cancun.workers.dev` | All changes land here first |
| **Production** | `https://dhayam.cancun.workers.dev` | Only promoted-through-gate changes |
| **GitHub Pages** | `https://sethusrinivasan.github.io/dhayam/` | Mirror / backup |

---

## CI Pipeline: Staging → Gate → Production

Every push to `main` triggers the **five-job pipeline** in [`.github/workflows/cloudflare.yml`](../.github/workflows/cloudflare.yml):

```
Push to main
     │
     ▼
┌─────────────────┐
│ 1. deploy-staging │   wrangler deploy --env staging
│   🚧 Staging     │   → dhayam-staging.cancun.workers.dev
└────────┬─────────┘
         │ success
         ▼
┌──────────────────────┐
│ 2. validate-staging  │   npm test  +  E2E headless Chrome
│   🧪 Staging Gate    │   ↳ HTTP 200 on root / /health / /mcp
└────────┬─────────────┘   ↳ 49/49 board cells, 0 JS exceptions
         │ staging PASSED  ↳ Roll dice interaction verified
         ▼                 ↳ 8/16/32-player newGame verified
┌─────────────────────┐
│ 3. await-approval   │   ⏸ Manual reviewer tests staging live
│   👤 Human Gate     │   → GitHub Environments approval UI
└────────┬────────────┘
         │ approved
         ▼
┌─────────────────────┐
│ 4. deploy-production│   wrangler deploy (production)
│   🚀 Production     │   → dhayam.cancun.workers.dev
└────────┬────────────┘
         │ success
         ▼
┌──────────────────────┐
│ 5. smoke-production  │   E2E liveness check against prod URL
│   💨 Smoke Check     │
└──────────────────────┘
```

> [!IMPORTANT]
> **Production is never touched if the staging E2E gate fails.** A failed `validate-staging` job causes `deploy-production` to be skipped automatically via GitHub Actions `needs:` dependency.

---

## What the E2E Gate Checks

Against staging before production promotion:

| Check | Criteria |
|-------|----------|
| HTTP Root | `200 OK` + `<title>Dhayam</title>` in response body |
| `/health` | `200 OK` + `healthy` in response body |
| `/mcp` discovery | `200 OK` + `Dhayam MCP` in response body |
| Zero JS exceptions | Chrome CDP `Runtime.exceptionThrown` = 0 |
| Board rendered | 49/49 `.cell` elements in DOM |
| Players rendered | ≥ 2 `.player` cards in DOM |
| Action button | `#actionBtn` enabled, not hidden |
| Dice roll | `actionBtn.click()` → dice change state, no error |
| 8-player support | `newGame(8, 0)` → 8 players created without error |
| 16-player support | `newGame(16, 0)` → 16 players created without error |
| 32-player support | `newGame(32, 0)` → 32 players created without error |

---

## Manually Forcing Production (Emergency)

In rare cases (e.g., staging URL temporarily down but production is known good) you can bypass the gate via `workflow_dispatch` in GitHub Actions:

1. Go to **Actions → Deploy to Cloudflare (Staging → Production Gate)**
2. Click **Run workflow**
3. Set **"Force deploy directly to production"** = `true`
4. Click **Run workflow**

> [!CAUTION]
> Use `force_production` only if staging is temporarily unavailable (e.g. a Durable Object migration error on staging) and you are certain the code is safe. It bypasses all E2E validation.

---

## Periodic Health Monitoring

[`.github/workflows/liveness-and-e2e.yml`](../.github/workflows/liveness-and-e2e.yml) runs every 6 hours and checks **both staging and production**, alerting the team if either drifts or degrades.

---

## Local Development

For comprehensive details on local setup, tests, and debugging with Flight Recorder, see the [Development, Test, Debug, Staging & Deployment Workflow](development-workflow.md).

To deploy only to staging from your local machine:

```bash
npx wrangler deploy --env staging
```

To run the staging E2E check locally:

```bash
E2E_SKIP_GITHUB_PAGES=true CLOUDFLARE_URL=https://dhayam-staging.cancun.workers.dev node scripts/e2e-live-check.js
```

To deploy to production directly (requires valid `CLOUDFLARE_API_TOKEN`):

```bash
npx wrangler deploy
```
