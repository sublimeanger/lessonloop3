# Project slash commands

| Command | What it does |
|---|---|
| `/sweep [area]` | Run one production-readiness audit pass on the next (or specified) feature in `audit/MASTER.md`. Updates state, files findings, commits. |
| `/sentry-digest` | Pull a weekly digest of Sentry issues into `audit/reports/<date>.md`. Suggested cadence: Monday morning. |

See individual `<command>.md` files for the full prompt that executes when invoked.
