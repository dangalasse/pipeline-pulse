terraform {
  required_version = ">= 1.5"

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
  }
}

provider "cloudflare" {
  # Set CLOUDFLARE_API_TOKEN in the environment.
}

variable "account_id" {
  type        = string
  description = "Cloudflare account ID"
}

variable "zone_id" {
  type        = string
  description = "Cloudflare zone ID for galasse.dev"
}

variable "production_hostname" {
  type    = string
  default = "pipeview.galasse.dev"
}

variable "staging_hostname" {
  type    = string
  default = "staging.pipeview.galasse.dev"
}

# Worker script is deployed via wrangler in CI — this stub documents the route binding.
resource "cloudflare_workers_route" "production" {
  zone_id     = var.zone_id
  pattern     = "${var.production_hostname}/*"
  script_name = "pipeline-pulse"
}

resource "cloudflare_workers_route" "staging" {
  zone_id     = var.zone_id
  pattern     = "${var.staging_hostname}/*"
  script_name = "pipeline-pulse-staging"
}

output "production_route" {
  value = cloudflare_workers_route.production.pattern
}

output "staging_route" {
  value = cloudflare_workers_route.staging.pattern
}
