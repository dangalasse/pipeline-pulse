# Pipeline Pulse

[![CI](https://github.com/dangalasse/pipeline-pulse/actions/workflows/ci.yml/badge.svg)](https://github.com/dangalasse/pipeline-pulse/actions/workflows/ci.yml)
[![Deploy](https://github.com/dangalasse/pipeline-pulse/actions/workflows/deploy.yml/badge.svg)](https://github.com/dangalasse/pipeline-pulse/actions/workflows/deploy.yml)

**Live meta-dashboard** for a full GitHub Actions → Cloudflare Workers conveyor belt.

| Surface | URL |
|---------|-----|
| Production | https://pipeline.galasse.dev |
| Staging | https://pipeline-pulse-staging.dantonguerragalasse.workers.dev |
| Actions | https://github.com/dangalasse/pipeline-pulse/actions |
| Portfolio | https://portfolio.galasse.dev |

The home page shows the **git SHA**, **environment**, **build time**, and **workflow run** that shipped the build — proof the pipeline is real, not a screenshot.

## Conveyor belt

```mermaid
flowchart TD
  push[push_or_PR] --> lint[lint_and_typecheck]
  lint --> test[unit_tests]
  test --> build[build_artifact]
  build --> previewJob[PR_preview_Workers]
  build --> staging[deploy_staging]
  staging --> smoke[smoke_healthcheck]
  smoke --> prodGate[production_environment_gate]
  prodGate --> prod[deploy_production]
  prod --> notify[commit_status_and_badge]
```

| Workflow | Trigger | What it does |
|----------|---------|--------------|
| `ci.yml` | PR + push `main` | Biome, typecheck, Vitest, Vite build |
| `preview.yml` | PR | Deploy `pipeline-pulse-preview` Worker + comment URL |
| `deploy.yml` | push `main` | Staging + smoke `/api/health` |
| `deploy.yml` | tag `v*` | Production (GitHub Environment `production`) + smoke |

## Stack

- **Vite + React 19** — meta-dashboard UI
- **Hono** on **Cloudflare Workers** — `/api/health`, `/api/deploy-meta`
- **Workers static assets** — SPA from `dist/`
- **Biome** + **Vitest** + **Wrangler**

## Local development

```bash
npm ci
npm run dev          # Vite UI only
npm test
npm run lint
npm run build
npx wrangler dev     # Worker + assets (needs Cloudflare auth)
```

Build-time env (also injected by Actions):

- `VITE_GIT_SHA`
- `VITE_DEPLOY_ENV`
- `VITE_BUILD_TIME`
- `VITE_GITHUB_RUN_URL`

## Secrets & environments

GitHub repository secrets:

- `CLOUDFLARE_API_TOKEN` — Workers edit + account read
- `CLOUDFLARE_ACCOUNT_ID`

GitHub Environments: `staging`, `production` (protect production with required reviewers if desired).

Optional environment variables:

- `STAGING_URL`
- `PRODUCTION_URL` (default `https://pipeline.galasse.dev`)

## Promote to production

```bash
git tag v1.0.0
git push origin v1.0.0
```

## Why this repo exists

Portfolio proof for **SRE / DevOps**: a readable Actions tab, PR previews, staging smoke, and a protected production gate — hosted on the edge, not SSH to a box.
