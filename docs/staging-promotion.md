# Staging & Production Promotion Process

## URLs

| Environment | URL | Purpose |
|------------|-----|---------|
| **Staging** | `https://dhayam-staging.cancun.workers.dev` | All changes land here first |
| **Production** | `https://dhayam.cancun.workers.dev` | Only promoted-through-gate changes |
| **GitHub Pages** | `https://sethusrinivasan.github.io/dhayam/` | Mirror / backup |

---

## CI Pipeline: Staging → Gate → Production

Every push to `main` triggers the **four-job pipeline** in [`.github/workflows/cloudflare.yml`](../.github/workflows/cloudflare.yml):

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
         ▼
┌─────────────────────┐
│ 3. deploy-production│   wrangler deploy (production)
│   🚀 Production     │   → dhayam.cancun.workers.dev
└────────┬────────────┘
         │ success
         ▼
┌──────────────────────┐
│ 4. smoke-production  │   E2E liveness check against prod URL
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
