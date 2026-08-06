# Pipeline Pulse — Terraform (Cloudflare stubs)

Minimal Terraform for **Workers route bindings**. The Worker script itself is deployed by **Wrangler** in GitHub Actions (`deploy.yml` / `preview.yml`).

## What this manages

| Resource | Purpose |
|----------|---------|
| `cloudflare_workers_route.production` | `pipeline.galasse.dev/*` → `pipeline-pulse` |
| `cloudflare_workers_route.staging` | `staging.pipeline.galasse.dev/*` → `pipeline-pulse-staging` |

## Prerequisites

- [Terraform](https://www.terraform.io/downloads) >= 1.5
- Cloudflare API token with **Workers Routes** + **Workers Scripts** read (and edit if you apply routes here)
- Account ID and zone ID for `galasse.dev`

## Usage

```bash
cd infra/terraform
export CLOUDFLARE_API_TOKEN="…"

terraform init
terraform plan \
  -var="account_id=YOUR_ACCOUNT_ID" \
  -var="zone_id=YOUR_ZONE_ID"

# Apply only when you intentionally manage routes via Terraform
# terraform apply -var="account_id=…" -var="zone_id=…"
```

## Notes

- **Wrangler remains the source of truth** for script deploys and `[vars]` / secrets (`GITHUB_TOKEN` for live demo).
- Routes may already exist in the Cloudflare dashboard; import before apply if needed:
  `terraform import cloudflare_workers_route.production ZONE_ID/pipeline.galasse.dev/*`
- Custom domains can also be set in `wrangler.toml` — keep Terraform and Wrangler in sync to avoid drift.
