---
description: Pull a weekly Sentry digest of LessonLoop issues into audit/reports/, commit, push.
---

You are running the LessonLoop weekly Sentry digest.

## Setup

- `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_REGION_URL` are baked into `~/.claude/settings.json` and available to Bash.
- The Sentry MCP is also available locally for richer queries.

## Steps

1. **Get today's date.** `date -u +%Y-%m-%d`. Call this `<DATE>`.

2. **Pull two issue lists from Sentry.** Use the Sentry MCP `search_issues`:
   - First: `query='firstSeen:-7d' sort='freq' limit=20` — new issues this week, by frequency
   - Second: `query='is:unresolved level:error' sort='user' limit=10` — top high-impact unresolved by user count
   
   Use `organizationSlug='lessonloop' projectSlugOrId='javascript-react' regionUrl='https://de.sentry.io'`.

3. **For each top issue (max 10 per section), capture:**
   - Title
   - Level (error / warning / info)
   - Count (event count)
   - User count
   - First seen / Last seen
   - One-line stack-trace excerpt or message
   - 🔴 marker if user count > 10 OR if the issue affects a P0 feature (cross-reference `audit/MASTER.md`)

4. **Write the digest** to `audit/reports/<DATE>.md` using this format:

```markdown
# Sentry weekly digest — <DATE>

## Top issues (last 7d, by frequency)

| Title | Level | Count | Users | First seen | Last seen | Notes |
|---|---|---|---|---|---|---|
| <one row per issue, max 10> |

## High-impact unresolved (by user count)

| Title | Level | Users | Stack hint | Status |
|---|---|---|---|---|
| <one row per issue, max 10> |

## Recommendations

- **Top 3 to fix this week:** prioritised by user impact + criticality
- **Patterns:** any cluster of issues that share a root cause (e.g. "all 5 errors are in the calendar drag handler") → propose a finding doc
- **Cross-references:** if an issue maps to an open `audit/findings/` doc, link it
- **Trend:** comparing to last week (if a previous report exists), call out any new patterns

## Health snapshot

- Total events 7d: <num>
- Total unique issues 7d: <num>
- Unresolved P0-area issues: <num>
- Compared to previous report: <delta or "first run">
```

5. **Update `audit/MASTER.md` summary line** if helpful — change the "Sentry events 7d: TBD" line to reflect actual current count, plus refresh per-row Sentry activity for any rows where new issues arrived.

6. **Commit + push:**
   ```bash
   git add audit/reports/<DATE>.md audit/MASTER.md
   git commit -m "sentry: weekly digest <DATE>"
   git push origin main
   ```

7. **Halt + summarise.** Tell the user:
   - Path to the new digest file
   - Top 3 issues + recommended action
   - Whether anything looks like a launch blocker
   - Commit hash

## Cadence

Type `/sentry-digest` once a week. Suggested: Monday morning. (We tried scheduling a remote agent for this; the cloud-connector path is currently blocked by a sync issue between Anthropic's connector registry and OAuth-installed connectors. Manual invocation works around that and keeps the trigger in your hands.)

## Quick reference — direct Sentry curl (alternative to MCP)

If the MCP is flaky:

```bash
# List issues
curl -s -H "Authorization: Bearer $SENTRY_AUTH_TOKEN" \
  "https://de.sentry.io/api/0/projects/lessonloop/javascript-react/issues/?statsPeriod=7d&sort=freq&limit=20"

# Get a single issue with full event detail
curl -s -H "Authorization: Bearer $SENTRY_AUTH_TOKEN" \
  "https://de.sentry.io/api/0/issues/<ISSUE_ID>/"

# Resolve an issue
curl -s -X PUT -H "Authorization: Bearer $SENTRY_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  "https://de.sentry.io/api/0/issues/<ISSUE_ID>/" \
  -d '{"status": "resolved"}'
```

Begin.
