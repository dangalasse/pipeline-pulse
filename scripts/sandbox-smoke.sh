#!/usr/bin/env bash
# WHY: live-demo Staging/Production stand-ins smoke the preview Worker only —
# never staging.pipeview or production.
set -euo pipefail

MODE="${1:?usage: sandbox-smoke.sh staging|production}"
URL="${PREVIEW_URL:-https://pipeline-pulse-preview.dantonguerragalasse.workers.dev}"

assert_no_secret_keys() {
  python3 - "$1" <<'PY'
import json, re, sys

secret = re.compile(
    r"^(token|secret|password|authorization|api[_-]?key|private[_-]?key|access[_-]?key)$",
    re.I,
)

def walk(value, depth=0):
    if depth > 8 or value is None:
        return
    if isinstance(value, list):
        for item in value:
            walk(item, depth + 1)
        return
    if isinstance(value, dict):
        for key, nested in value.items():
            if secret.match(str(key)):
                sys.exit(f"secret-like key: {key}")
            walk(nested, depth + 1)

with open(sys.argv[1], encoding="utf-8") as handle:
    walk(json.load(handle))
PY
}

headers=$(curl -sI "$URL/lab")
echo "$headers" | grep -qi 'x-content-type-options: nosniff'
echo "$headers" | grep -qi 'referrer-policy: strict-origin-when-cross-origin'
echo "$headers" | grep -qi 'permissions-policy:'
echo "$headers" | grep -qi 'content-security-policy:'

curl -fsS "$URL/api/health" > /tmp/pv-health.json
python3 - <<'PY'
import json, sys
with open("/tmp/pv-health.json", encoding="utf-8") as handle:
    data = json.load(handle)
if data.get("ok") is not True:
    sys.exit(f"health not ok: {data!r}")
env = data.get("env")
if env in ("staging", "production"):
    sys.exit(f"refused: smoke hit real {env}")
if env != "preview":
    sys.exit(f"expected preview env, got {env!r}")
PY
assert_no_secret_keys /tmp/pv-health.json

code=$(curl -sS "$URL/.env" -o /tmp/pv-env.json -w "%{http_code}")
echo "$code" | grep -Eq "404"
python3 - <<'PY'
import json, sys
with open("/tmp/pv-env.json", encoding="utf-8") as handle:
    data = json.load(handle)
if data.get("ok") is not False:
    sys.exit(f"honeypot must be ok:false: {data!r}")
if any(str(k).lower() in ("token", "secret", "password") for k in data):
    sys.exit(f"honeypot leaked credential key: {data!r}")
PY

if [ "$MODE" = "production" ]; then
  curl -fsS "$URL/api/lab-object" > /tmp/pv-lab.json
  python3 - <<'PY'
import hashlib, json, sys
with open("/tmp/pv-lab.json", encoding="utf-8") as handle:
    data = json.load(handle)
source = data.get("source")
if not isinstance(source, str) or not source.strip():
    sys.exit(f"missing source: {list(data)}")
if "hue" in data or "shape" in data:
    sys.exit(f"legacy knobs leaked: {list(data)}")
sha = hashlib.sha256(source.encode()).hexdigest()[:16]
if data.get("sourceSha") != sha:
    sys.exit(f"sourceSha mismatch: {data.get('sourceSha')} != {sha}")
if data.get("env") in ("staging", "production"):
    sys.exit(f"lab-object on real {data.get('env')}")
PY
  assert_no_secret_keys /tmp/pv-lab.json

  curl -fsS "$URL/api/demo-config" > /tmp/pv-cfg.json
  python3 - <<'PY'
import json, sys
with open("/tmp/pv-cfg.json", encoding="utf-8") as handle:
    data = json.load(handle)
if not isinstance(data.get("gateReady"), bool):
    sys.exit(f"gateReady must be bool: {data!r}")
if data.get("dispatchReady") is not False:
    sys.exit("preview Worker must not dispatch (dispatchReady must be false)")
if any(
    str(k).lower() in ("token", "secret", "password", "authorization")
    for k in data
):
    sys.exit(f"demo-config leaked credential key: {data!r}")
PY
fi

echo "sandbox-smoke $MODE ok against preview"
