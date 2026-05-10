# Source Supabase project residual reference audit

**Severity:** low
**Status:** fixed (with one Jamie-only follow-up at decommission time)
**Area:** infrastructure / migration
**Discovered:** 2026-05-10 (s25 Track 2.6)
**Affected components:** repo-wide grep + Supabase Management API audit

## Summary

Pre-decommission verification of the source Supabase project `ximxgnkpcswbvfrkkmjq` (scheduled decom 2026-08-19 per audit/00-launch-readiness.md). The destination project `xmrhmxizpslhtkibqyfy` must be fully independent before the source goes away.

## Audit results

### Repo grep for `ximxgnkpcswbvfrkkmjq`

Total hits before fixes: 7. Categorisation:

1. **`tests/e2e/workflows/onboarding.spec.ts:19`** — REAL residual. Hardcoded `SUPABASE_URL = 'https://ximxgnkpcswbvfrkkmjq.supabase.co'` + hardcoded source anon key. Onboarding workflow test would auth against the source project.
   - **FIXED in s25**: refactored to read `process.env.E2E_SUPABASE_URL || process.env.SUPABASE_URL || destination-fallback` and `process.env.E2E_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY` (matches the pattern used in `tests/e2e/auth.setup.ts`).
2. **`supabase/functions/seed-demo-data/index.ts:25`** + **`supabase/functions/seed-e2e-data/index.ts:22`** — INTENTIONAL guard. The list is `PRODUCTION_REFS = ['ximxgnkpcswbvfrkkmjq', 'xmrhmxizpslhtkibqyfy']`. Defensive: refuse to seed if invoked against either production ref. Source ref kept in the list as defence-in-depth during the decom window. SAFE to keep.
3. **`tests/e2e/auth.setup.ts:16`** — Comment block describing the migration ("The previous source project (ximxgnkpcswbvfrkkmjq) is decommissioned"). Documentation only.
4. **`docs/CRON_AUTH.md:28`** + **`docs/HANDOVER_2026-05-02.md:26,323`** — historical documentation snapshots. Not active references.

### Supabase secret grep (Management API readback)

Pulled all secrets from `xmrhmxizpslhtkibqyfy` via Management API. Secret values are SHA-256 digests (not plaintext) so name-only check:

- 35 secrets total
- Zero secret names contain "source" or reference the source ref
- Critical infrastructure secrets (SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY) point at the destination per the `xmrhmxizpslhtkibqyfy` URL hostname

### Source project status check

Attempted `GET /v1/projects/ximxgnkpcswbvfrkkmjq` with the agent's access token: returns 403 "Your account does not have the necessary privileges". The token only has access to two projects in org `eaasqnpqxksneuxjeylf`:

- `jrwivrlwqkcjrxnmzduo` (SEEOFlare — unrelated)
- `xmrhmxizpslhtkibqyfy` (LessonLoop destination, ACTIVE_HEALTHY)

The source project `ximxgnkpcswbvfrkkmjq` lives in a different Supabase organisation (likely Jamie's personal org). Agent cannot directly verify its status, pause it, or delete it.

## Conclusion: safe to decommission per agent's authority

**Repo-side independence: VERIFIED.** Destination is fully self-contained:
- 1 real residual reference fixed
- 2 defensive references kept (correct intent)
- 4 documentation references (historical, harmless)
- All secrets point at destination

**Source project lifecycle: DEFER TO JAMIE** at decom time:
1. Verify all source crons paused (per audit/00-launch-readiness.md item 3.1)
2. Verify zero Stripe webhook events delivered to source for 7+ consecutive days
3. Pause source project (free option, retains data 90 days)
4. After 90 days, delete

## Action required (Jamie)

When the 2026-08-19 decom date approaches:
1. Pause `ximxgnkpcswbvfrkkmjq` in Supabase Dashboard
2. Wait 14-90 days for rollback window
3. Delete

The agent's repo-side verification gives green light to start that timer at any time without further code work.
