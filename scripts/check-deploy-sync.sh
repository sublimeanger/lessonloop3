#!/usr/bin/env bash
# scripts/check-deploy-sync.sh
#
# Compare local git HEAD vs Netlify's published commit + GitHub Pages
# integration health, then trigger a manual rebuild if the app server
# (Netlify) is more than 1 commit behind.
#
# Why this exists (s27): GitHub → Netlify auto-deploy integration has
# been observed to break silently — pushes land on origin/main, GitHub
# shows the commits, but Netlify's deploy log shows zero new builds
# attempted. The s26 50-commit-backlog clearance was a one-off manual
# trigger; this script makes the regression detectable + fixable.
#
# Requires:
#   - NETLIFY_AUTH_TOKEN exported (Netlify API)
#   - gh auth (read repo check-runs)
#   - Run from inside /tmp/lessonloop3-deploy (or any clone of
#     sublimeanger/lessonloop3 on main).
#
# Usage:
#   scripts/check-deploy-sync.sh           # report only
#   scripts/check-deploy-sync.sh --rebuild # trigger Netlify rebuild on drift

set -euo pipefail

SITE_ID="26c144a4-dce1-4791-b1f1-381db285bc4e"
REPO="sublimeanger/lessonloop3"

if [[ -z "${NETLIFY_AUTH_TOKEN:-}" ]]; then
  echo "ERROR: NETLIFY_AUTH_TOKEN not set" >&2
  exit 2
fi

# Local + remote HEAD
git fetch origin --quiet
LOCAL_HEAD=$(git rev-parse HEAD)
REMOTE_HEAD=$(git rev-parse origin/main)

if [[ "$LOCAL_HEAD" != "$REMOTE_HEAD" ]]; then
  echo "  LOCAL=${LOCAL_HEAD:0:8}  REMOTE=${REMOTE_HEAD:0:8}  (local differs from origin/main)"
fi

# Netlify published commit
NL_RESP=$(curl -sH "Authorization: Bearer $NETLIFY_AUTH_TOKEN" \
  "https://api.netlify.com/api/v1/sites/$SITE_ID")
NL_COMMIT=$(echo "$NL_RESP" | python3 -c \
  'import sys,json;d=json.load(sys.stdin);print((d.get("published_deploy") or {}).get("commit_ref","none"))')
NL_STATE=$(echo "$NL_RESP" | python3 -c \
  'import sys,json;d=json.load(sys.stdin);print((d.get("published_deploy") or {}).get("state","none"))')

# Cloudflare Pages check-run on remote HEAD
CF_STATUS=$(gh api "repos/$REPO/commits/$REMOTE_HEAD/check-runs" 2>/dev/null \
  | python3 -c '
import sys,json
d=json.load(sys.stdin)
cf=[c for c in d.get("check_runs",[]) if c.get("app",{}).get("slug")=="cloudflare-workers-and-pages" and c.get("name")=="Cloudflare Pages"]
print(cf[0].get("conclusion","unknown") if cf else "no-check-run")
')

echo "===== Deploy sync check ====="
echo "  origin/main      ${REMOTE_HEAD:0:8}"
echo "  Netlify pub      ${NL_COMMIT:0:8}  state=$NL_STATE"
echo "  CF Pages status  $CF_STATUS"
echo ""

DRIFT_COMMITS=$(git rev-list --count "$NL_COMMIT..$REMOTE_HEAD" 2>/dev/null || echo "unknown")
echo "  Netlify is $DRIFT_COMMITS commit(s) behind origin/main"

if [[ "$DRIFT_COMMITS" -gt 1 ]] 2>/dev/null; then
  echo "  ⚠️  DRIFT DETECTED — GitHub→Netlify integration likely broken"
  if [[ "${1:-}" == "--rebuild" ]]; then
    echo "  → Triggering rebuild via Netlify API"
    curl -s -X POST -H "Authorization: Bearer $NETLIFY_AUTH_TOKEN" \
      "https://api.netlify.com/api/v1/sites/$SITE_ID/builds" \
      -H "Content-Type: application/json" -d '{}' \
      | python3 -m json.tool | head -10
  else
    echo "  → Re-run with --rebuild to trigger Netlify rebuild"
    echo "  → Long-term fix: reinstall Netlify GitHub App on the repo"
  fi
  exit 1
fi

if [[ "$CF_STATUS" != "success" ]]; then
  echo "  ⚠️  Cloudflare Pages status is '$CF_STATUS' — marketing site may not be current"
  exit 1
fi

echo "  ✓ All deploy targets in sync"
exit 0
