#!/usr/bin/env python3
"""Assert this live-demo run already completed the conveyor jobs before Production."""
from __future__ import annotations

import json
import os
import sys
import urllib.request

REQUIRED = ("CI", "Security", "Test", "AI Review", "Preview", "Staging")
REPO = os.environ["GITHUB_REPOSITORY"]
RUN_ID = os.environ["GITHUB_RUN_ID"]
TOKEN = os.environ["GITHUB_TOKEN"]

req = urllib.request.Request(
    f"https://api.github.com/repos/{REPO}/actions/runs/{RUN_ID}/jobs?per_page=30",
    headers={
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "pipeview-live-demo",
        "Authorization": f"Bearer {TOKEN}",
    },
)
with urllib.request.urlopen(req, timeout=30) as res:
    payload = json.load(res)

jobs = payload.get("jobs") or []
by_name = {job.get("name"): job for job in jobs}
missing = [name for name in REQUIRED if name not in by_name]
if missing:
    sys.exit(f"missing jobs in this run: {missing}")

for name in REQUIRED:
    job = by_name[name]
    conclusion = job.get("conclusion")
    status = job.get("status")
    if conclusion != "success":
        sys.exit(
            f"job {name} not successful (status={status} conclusion={conclusion})"
        )

print("live-demo job chain ok")
