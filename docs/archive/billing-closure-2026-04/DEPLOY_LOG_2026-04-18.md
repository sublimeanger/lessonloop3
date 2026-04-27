# LessonLoop audit deploy — 18 April 2026

**Status:** Complete server-side. UI smoke tests deferred.

**Applied:**
- 7 migrations (6 audit + 1 prereq payments.installment_id)
- 7 edge functions redeployed
- Frontend merged to main

**Verified:**
- A3 server-side: PASS (trigger + RPC inspection)
- A4 server-side: PASS
- A5 server-side: PASS (RPC + trigger dual guard)
- A6 server-side: PASS (invoice-level math correct)
- Xero OAuth: scope live, connection table schema synced

**Outstanding (post-deploy):**
- UI smoke tests A3/A4+A6/A5 manual click-through
- Xero OAuth round-trip manual test
- Section 10 walked scenarios (8 scenarios, manual)
- B28: void_invoice billing_run_id clear (logged)
- Tracked-12: 6 legacy payment rows review (logged)

**Key learning:** schema_migrations table is not authoritative for Lovable-managed Supabase projects. See LOVABLE_CLAUDE_DIVISION.md "Migration tracking" section.

**Session 2 next:** Beat 1 (C12 four-nation, C11 bank holidays, C42 HMRC numbering, C24 cron suppression).
