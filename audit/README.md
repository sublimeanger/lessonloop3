# `/audit/` — production readiness sweep

This directory is the **single source of truth** for whether LessonLoop is launch-ready and what's blocking it.

## Open this file first if…

| You're trying to… | Open |
|---|---|
| Know if we can launch publicly | `00-launch-readiness.md` |
| Know what features have been audited / what still needs auditing | `MASTER.md` |
| Look up a known bug or how it was fixed | `findings/` |
| Review the last in-flight feature audit | `active/2026-04-area-2-parent-portal.md` |
| Look at historical context (Phase 7 migration, billing closure, mega audit) | `archive/` |

## Daily flow

```
> /sweep
```

This Claude Code slash command picks the next P0 ❓ row from `MASTER.md`, runs the standard audit template, logs findings, updates the row, commits.

Optional override: `/sweep <area-or-feature>` to target a specific row (e.g. `/sweep calendar`).

## Standard audit template (what `/sweep` runs per feature)

1. **Smoke** — does the feature load without console errors? does the route resolve?
2. **Functional** — happy path with a real test user. Does it produce expected result?
3. **Edge** — what breaks? empty state, max items, network failure, race condition.
4. **RLS** — does a user from another org see anything they shouldn't? does a parent see staff-only data?
5. **Sentry** — search Sentry for last 7d issues touching this feature
6. **Mobile** — if the feature is exercised on iOS/Android Capacitor, smoke on device
7. **Note + commit** — update `MASTER.md` row, append finding doc if any, commit

## Weekly Sentry digest

Cron runs every Monday — pulls Sentry top issues from the last 7 days into `audit/reports/<date>.md`. Reviewed at start of week to set priority.

## Cross-reference

- Per-feature inventory: `MASTER.md`
- Launch blockers + day-of-launch checklist: `00-launch-readiness.md`
- Open findings (bugs that need fixing): `findings/` files with `Status: open` in their frontmatter
- Closed findings: `findings/` files with `Status: fixed` (kept as historical reference)
- Active in-flight feature audits: `active/`
- Archived audits/migrations/Q1 docs: `archive/`
