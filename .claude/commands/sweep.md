---
description: Run one production-readiness audit pass on the next P0 untested feature in audit/MASTER.md
---

You are running one iteration of the production-readiness sweep. The user is working solo and has limited time per session — be methodical, concise, and decisive. Don't bikeshed.

## Your inputs

- The user's optional argument: `$ARGUMENTS` — if non-empty, this is a specific feature, area, or row identifier they want audited (e.g. "calendar", "Stripe checkout", "send-bulk-message"). If empty, pick the next row yourself.
- `audit/MASTER.md` — the feature inventory + state tracker
- `audit/findings/` — known bugs (cause + fix per file)
- `audit/00-launch-readiness.md` — pre-launch blockers

## What to do, in order

### 1. Pick the row

If `$ARGUMENTS` is non-empty, find the matching row in `audit/MASTER.md`. If multiple match, pick the most P0 one and tell the user which.

If `$ARGUMENTS` is empty, pick the **highest-priority untested or broken** row from `audit/MASTER.md`:
- First preference: P0 with state ❓
- Second preference: P0 with state 🔴
- Third preference: P0 with state 🟡
- Fourth preference: P1 with state ❓ (only if all P0s done)

Briefly tell the user which row you picked and why (one sentence).

### 2. Pull Sentry events for the area (last 7 days)

Use the Sentry MCP `search_issues` with `organizationSlug='lessonloop'`, `projectSlugOrId='javascript-react'`, `regionUrl='https://de.sentry.io'`, query like `firstSeen:-7d <feature-area-keyword>` to find any real-world issues touching this feature. Note these in your audit notes — they're the highest-confidence signals of what's actually broken.

### 3. Run the standard audit template

For the picked row, work through these checks in order. Stop at the first one that fails P0 — fix that before continuing OR escalate to user if non-trivial.

**a) Smoke**
- For a frontend route: `curl -sI https://app.lessonloop.net<route>` returns 200; check the page loads in browser if user-driven.
- For an edge function: confirm `supabase/functions/<slug>/` exists and is in the deployed list. Use the Supabase MCP `list_edge_functions` to confirm status=ACTIVE.
- For a cron: check `cron.job` table via `execute_sql` — confirm `active=true` and recent `cron.job_run_details` show success.

**b) Functional**
- For a frontend route: ask the user to do a 1-minute browser test if it's interactive UI; otherwise read the source to confirm it does what its name says.
- For an edge function: spot-check the source for the right auth pattern (verify_jwt setting, role checks), the right env vars, and that any DB writes have `{ error }` capture.
- For a cron: check the source for retry / dedupe logic; check `cron.job_run_details` for any failures in last 7 days.

**c) Edge cases**
Read the source. Look specifically for:
- What happens with empty input / null / undefined
- Race conditions on concurrent calls (any `INSERT` that should be `INSERT … ON CONFLICT` or `FOR UPDATE SKIP LOCKED`)
- Idempotency on retry (especially Stripe / Xero / Zoom / Calendar sync — these have a known idempotency anti-pattern, see `audit/findings/2026-05-07-calendar-sync-lesson-idempotency.md`)
- Money math: any float arithmetic on minor units? Should be integer.
- Timezone: any `new Date()` without explicit timezone?

**d) RLS check (if the feature touches the DB from the frontend)**
- Check that the relevant table has RLS enabled and policies that scope by `org_id` and/or role.
- Spot-check: if a parent user could query this table directly, would they see only their own children's data?
- Look for `USING (true)` or `WITH CHECK (true)` policies — these are usually wrong.

**e) Mobile (if the feature is exercised on iOS/Android)**
- Check `src/lib/platform.ts` use — does the code branch on `platform.isNative`?
- Any direct redirects via `window.location.href = …` won't work in Capacitor in-app browser — needs the deep-link callback pattern.

**f) Sentry follow-up**
- For each Sentry issue found in step 2, decide: fix now, file as a finding, or accept-as-noise.

### 4. Update audit/MASTER.md

Find the row, update:
- **State:** ✅ if all checks pass, 🟡 if minor issues filed but not blockers, 🔴 if a hard bug found, ❓ if you couldn't audit (explain why)
- **Last audited:** today's date (YYYY-MM-DD)
- **Notes:** very short — link to finding doc if one was filed, or say "all checks green"

### 5. File findings (if any)

For each non-trivial bug or risk discovered, write a file at `audit/findings/<YYYY-MM-DD>-<short-slug>.md` using this exact template:

```markdown
# <Title — concise>

**Severity:** critical | high | medium | low
**Status:** fixed | open | mitigated | deferred
**Area:** auth | billing | calendar | xero | zoom | onboarding | webhooks | …
**Discovered:** <date>
**Fixed:** <date or —>
**Fixed in:** <commit hash or —>
**Affected components:** <comma-separated paths>

## Symptom
One sentence: what was broken from the user's POV.

## Root cause
2-4 sentences.

## Fix
2-4 sentences. Code-level if useful.

## Verification
Bullet list of how we confirmed.

## Lessons / follow-ups
Optional.
```

Don't fix critical bugs silently — surface them to the user with severity + recommended fix before touching code.

### 6. Commit

Stage the modified `audit/MASTER.md` + any new `audit/findings/*.md` + any source code changes you made for trivial fixes. Commit with message:

```
audit(<area>): sweep <feature-name>

<one-line summary of state change + key findings>

Findings: <file paths if any>
```

Then push. Don't leave the repo dirty between sessions.

### 7. Halt + summarise

Tell the user:
- What was audited
- What state it's in now (✅/🟡/🔴/❓)
- Any critical findings + their severity
- The commit hash
- Suggest the next row to sweep (the one that would be picked if `/sweep` were called again with no arg)

## Rules of engagement

- **Don't** add tests "to be safe" without first confirming the row needs them. Test coverage isn't the goal — knowing whether the feature works is.
- **Don't** dispatch sub-agents unless the scope is genuinely too large for foreground (e.g. auditing 8+ related edge functions in one go).
- **Don't** spend time on cosmetic issues (small typos, formatting) unless they cause real bugs.
- **Do** use the Sentry MCP, Supabase MCP `execute_sql`, and Context7 for library questions — don't guess.
- **Do** treat findings discovered during the sweep as durable artefacts — they'll be referenced months later.

## Quick reference — common Sentry queries

```
firstSeen:-7d                                # New issues in last 7 days
is:unresolved level:error                    # All unresolved errors
firstSeen:-7d <area-keyword>                 # New issues in area (e.g. "stripe", "calendar", "auth")
```

## Quick reference — common Supabase queries

```sql
-- Active crons
SELECT jobname, schedule, active FROM cron.job ORDER BY jobname;

-- Recent cron failures
SELECT job_pid, runid, status, return_message, start_time
FROM cron.job_run_details
WHERE status != 'succeeded' AND start_time > now() - interval '7 days'
ORDER BY start_time DESC;

-- RLS policies on a table
SELECT polname, polcmd, polroles::regrole[], pg_get_expr(polqual, polrelid) AS qual
FROM pg_policy
WHERE polrelid = 'public.<TABLE>'::regclass;
```

Begin.
