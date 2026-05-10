# Netlify auto-deploy integration broken — pushes silently not building

**Severity:** P1 (would block shadow-term-day frontend hotfixes — currently masked because s26+s27 changes are all server-side)
**Status:** OPEN (mitigation in place; root-cause repair is Jamie-level)
**First reproduced:** 2026-05-10 (s27)
**Initial cleanup:** 2026-05-10 s26 (50-commit-backlog clearance — turned out to be a one-off manual trigger, not a real fix)

## Symptom

After session 25 (commit `e2eafad`, deployed 2026-05-10T17:35:24Z), four further commits landed on `origin/main`:

| Commit | Time (UTC) | Description |
| ------ | ---------- | ----------- |
| 5a65792 | 17:38 | fix(invite-get) UUID guard |
| 1981e32 | 17:47 | s26 verifications + collapse defensive tags |
| 3fe20a8 | 17:53 | Sentry wrap +11 fns |
| 2d02032 | 18:00 | s26 handover summary |

Netlify's deploy history shows **zero new builds attempted** after `e2eafad` — not queued, not failed, not skipped. Just silence.

In contrast, GitHub check-runs on `2d02032` show:
- ✓ Cloudflare Pages (deployed marketing site successfully)
- ✓ GitHub Actions E2E
- ✗ GitHub Actions Build & Test (failure — separate concern)

So GitHub IS notifying integrations of pushes. Netlify is just not subscribed any more.

## Root cause (best diagnosis)

Repository inspection:
- `GET /repos/sublimeanger/lessonloop3/hooks` → `[]` (no webhooks)
- `GET /sites/<id>/build_hooks` → `[]` (no build hooks pre-s27)
- `repos/sublimeanger/lessonloop3/keys` shows a Netlify deploy key (`netlify-lessonloop-app-20260508`), `last_used: 2026-05-07T23:40:11Z` — last used 3 days before s27
- Netlify build_settings: `installation_id: null` (no GitHub App installation linked)
- `manual_deploy: false` on all historical deploys — they WERE auto-triggered when integration was healthy

The Netlify GitHub App that was responsible for receiving push notifications and triggering builds appears to have been uninstalled, expired, or otherwise unlinked from this repository between 2026-05-07 23:40 and 2026-05-10 17:35. The single 17:35:24 build that did go through (`e2eafad`) was almost certainly a manual API trigger from s26's "clear 50-commit backlog" step.

## Was anything bad shipped to users?

**No customer impact.** All s26 commits modified `supabase/functions/`, `audit/`, `tests/`, or `HANDOVER.md`. None changed the React app. Edge functions deploy via Supabase Management API independently of Netlify. So:
- Supabase edge fns are current (verified)
- Cloudflare Pages marketing is current (verified)
- Netlify app frontend served `e2eafad` (s25 frontend) → no s26 frontend changes existed to ship → no drift in user-visible behavior

But if Jamie had merged a frontend hotfix at any point during s26, it would have silently failed to ship.

## Mitigation (s27)

1. **Created a persistent build hook** for manual rebuilds:
   - id `6a00ced887eb236b680b1df4`
   - title `shadow-term-emergency-redeploy`
   - branch `main`
   - URL stored in Netlify dashboard (not committed here — webhook URLs are bearer credentials)
2. **Triggered a manual rebuild** to ship s26 commits (`2d02032`) to Netlify production.
3. **Wrote `scripts/check-deploy-sync.sh`** — compares git HEAD vs Netlify published commit vs Cloudflare Pages check-run, exits non-zero on drift, accepts `--rebuild` to trigger a manual build via the API. Run it any time during shadow term.

## What Jamie needs to do

**Repair the GitHub App link.** Steps (from Netlify side):

1. Log into Netlify dashboard → Sites → lessonloop-app → Site configuration → Build & deploy → Continuous deployment
2. Under "Build settings", check the linked repo status. If it says "Connection lost" or similar, click "Link repository" / "Reconnect"
3. Authorize Netlify GitHub App for `sublimeanger/lessonloop3` repository
4. Push a trivial commit (or use the new build hook) and verify a build appears in Netlify automatically — `scripts/check-deploy-sync.sh` should exit 0

Alternative if the GitHub App route is broken: add a repo-level webhook pointing to the Netlify ingestion URL. Last-resort if integrations remain broken: use `scripts/check-deploy-sync.sh --rebuild` at end of each session.

## Verification (run any time)

```bash
NETLIFY_AUTH_TOKEN=$NETLIFY_AUTH_TOKEN \
  ./scripts/check-deploy-sync.sh
```

Expected when healthy: `✓ All deploy targets in sync` and exit 0.

## Status

OPEN — mitigation in place, root cause requires Jamie to reconnect Netlify GitHub App. Reassess at start of s28.
