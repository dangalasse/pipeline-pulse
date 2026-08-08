# Pipeline Pulse

[![CI](https://github.com/dangalasse/pipeline-pulse/actions/workflows/ci.yml/badge.svg)](https://github.com/dangalasse/pipeline-pulse/actions/workflows/ci.yml)
[![Deploy](https://github.com/dangalasse/pipeline-pulse/actions/workflows/deploy.yml/badge.svg)](https://github.com/dangalasse/pipeline-pulse/actions/workflows/deploy.yml)

**Live meta-dashboard** for a full GitHub Actions → Cloudflare Workers conveyor belt.

| Surface | URL |
|---------|-----|
| Production | https://pipeline.galasse.dev |
| Staging | https://staging.pipeline.galasse.dev |
| Actions | https://github.com/dangalasse/pipeline-pulse/actions |
| Portfolio | https://portfolio.galasse.dev |

The home page shows the **git SHA**, **environment**, **build time**, and **workflow run** that shipped the build — proof the pipeline is real, not a screenshot.

## Features

- **Bilingual UI** — PT-BR (default) / ENG-US via `localStorage` + `?lang=` (same pattern as [edge-labs](https://edge.galasse.dev))
- **n8n-style pipeline canvas** — Push → CI → Test → AI Review → Preview → Staging → Prod with animated edges; click a node for workflow YAML
- **Run live demo** — Turnstile → HMAC ticket → KV quotas, then `workflow_dispatch` of `live-demo.yml` (lint / typecheck / security audit / test / build only, **no deploy**). Opening the page shows the last real run (public GitHub read).
- **AI review on failure** — same Demo Gate (`edge.analyze` quota); Worker proxies to Edge Labs with short-lived service auth

## Demo Gate (abuse by contract)

| Action | Gate |
|--------|------|
| View last run | open (repo público) |
| Dispatch demo | Turnstile + ticket + **1/IP/15min**, **8/day** + `GITHUB_TOKEN` secret behind gate |
| AI review | Turnstile + ticket under `edge.analyze` quota |

Secrets: `TURNSTILE_SECRET`, `DEMO_TICKET_SECRET`, optional `GITHUB_TOKEN` (fine-grained `actions:write`). Site key is public (`TURNSTILE_SITE_KEY`).

## Conveyor belt

```mermaid
flowchart LR
  push[Push] --> ci[CI]
  ci --> security[Security]
  security --> test[Test]
  test --> ai[AI_Review]
  ai --> preview[Preview]
  preview --> staging[Staging]
  staging --> prod[Prod]
```

| Workflow | Trigger | What it does |
|----------|---------|--------------|
| `ci.yml` | PR + push `main` | Biome, typecheck, Vitest, Vite build |
| `live-demo.yml` | `workflow_dispatch` (+ UI button) | CI → Security (`npm audit --omit=dev`) → Test → AI Review → Build — **no deploy** |
| `preview.yml` | PR | Deploy `pipeline-pulse-preview` Worker + comment URL |
| `deploy.yml` | push `main` | Staging + smoke `/api/health` (requires `CLOUDFLARE_API_TOKEN`) |
| `deploy.yml` | tag `v*` | Production (GitHub Environment `production`) + smoke |

## Stack

- **Vite + React 19** — meta-dashboard UI
- **Hono** on **Cloudflare Workers** — `/api/health`, `/api/deploy-meta`, `/api/demo-run`, `/api/demo-ai-review`
- **Workers static assets** — SPA from `dist/`
- **Biome** + **Vitest** + **Wrangler**
- **Terraform stubs** — `infra/terraform/` (Cloudflare Workers routes)

## Local development

```bash
npm ci
npm run dev          # Vite UI only (API needs wrangler)
npm test
npm run lint
npm run typecheck
npm run build
npx wrangler dev     # Worker + assets (needs Cloudflare auth)
```

Build-time env (also injected by Actions):

- `VITE_GIT_SHA`
- `VITE_DEPLOY_ENV`
- `VITE_BUILD_TIME`
- `VITE_GITHUB_RUN_URL` — concrete Actions run URL (`…/actions/runs/${{ github.run_id }}`)

## Secrets & environments

### Cloudflare deploy (GitHub Actions)

Required for staging (`push` to `main`) and production (`tag v*`):

```bash
# Cloudflare dashboard → My Profile → API Tokens → Create Token
# Template: "Edit Cloudflare Workers" (account scoped)
gh secret set CLOUDFLARE_API_TOKEN -R dangalasse/pipeline-pulse
gh variable set CLOUDFLARE_ACCOUNT_ID -R dangalasse/pipeline-pulse -b 'YOUR_ACCOUNT_ID'
gh variable set STAGING_URL -R dangalasse/pipeline-pulse -b 'https://staging.pipeline.galasse.dev'
gh variable set PRODUCTION_URL -R dangalasse/pipeline-pulse -b 'https://pipeline.galasse.dev'
```

Without `CLOUDFLARE_API_TOKEN`, `deploy.yml` **fails the gate** (no silent skip).

GitHub Environments: `staging`, `production` (optional required reviewers on production).

### Live demo (`GITHUB_TOKEN` on the Worker)

The **Run live demo** button calls `POST /api/demo-run`, which dispatches `live-demo.yml` via the GitHub REST API. Without a token the API returns **503** with a clear message.

Prefer a **classic** PAT with `repo` (or `public_repo` + `workflow`) — fine-grained tokens often return HTTP 500 on `workflow_dispatch`.

```bash
# Production Worker
npx wrangler secret put GITHUB_TOKEN
# paste token when prompted

# Staging (optional)
npx wrangler secret put GITHUB_TOKEN --env staging
```

Or via the Cloudflare dashboard: Workers → `pipeline-pulse` → Settings → Variables → Encrypt `GITHUB_TOKEN`.

Dispatch quotas: Demo Gate KV (**1/IP/15min**, **8/day**), not an in-memory Worker limit.

## Promote to production

```bash
git tag v1.0.0
git push origin v1.0.0
```

## Why this repo exists

Portfolio proof for **SRE / DevOps**: a readable Actions tab, PR previews, staging smoke, and a protected production gate — hosted on the edge, not SSH to a box.

<!-- demo PR for Actions history 2026-08-05 -->
