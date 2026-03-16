# Audit: Feature 16 — Term Continuation

**Date:** 2026-03-16
**Auditor:** Claude Code (Opus 4.6)
**Handoff Status:** NEEDS-WORK — "core flow works, extend doesn't create lessons (TODO+warning added)"

---

## 1. Files Audited

### Database Migrations
| File | Purpose |
|------|---------|
| `supabase/migrations/20260228100000_term_continuation.sql` | Core tables: `term_continuation_runs`, `term_continuation_responses`, org settings columns |
| `supabase/migrations/20260303140000_term_overlap_trigger.sql` | Term overlap prevention trigger |
| `supabase/migrations/20260303182000_term_continuation_fk_cascade.sql` | FK CASCADE on term references (superseded) |
| `supabase/migrations/20260303191000_realtime_continuation_leads.sql` | Realtime publication for responses table |
| `supabase/migrations/20260315200200_fix_continuation_run_fk_set_null.sql` | FIX 4: CASCADE → SET NULL on term FKs |
| `supabase/migrations/20260315200500_fix_parent_rls_continuation_org_scope.sql` | FIX 1D.1: Parent RLS org scoping |
| `supabase/migrations/20260315200600_fix_continuation_run_status_enum.sql` | FIX 2E.1: Add 'failed' and 'partial' status |

### Edge Functions
| File | Purpose |
|------|---------|
| `supabase/functions/create-continuation-run/index.ts` | Create, send, remind, process_deadline actions (~460 lines) |
| `supabase/functions/continuation-respond/index.ts` | Token-based + portal-based parent response (~394 lines) |

### Frontend — Hooks
| File | Purpose |
|------|---------|
| `src/hooks/useTermContinuation.ts` | All queries & mutations for continuation (953 lines) |

### Frontend — Pages
| File | Purpose |
|------|---------|
| `src/pages/Continuation.tsx` | Admin continuation dashboard (765 lines) |
| `src/pages/portal/PortalContinuation.tsx` | Parent portal continuation page (496 lines) |

### Frontend — Components
| File | Purpose |
|------|---------|
| `src/components/continuation/ContinuationRunWizard.tsx` | Multi-step wizard for creating runs |
| `src/components/continuation/ContinuationResponseDetail.tsx` | Detail sheet for individual responses |
| `src/components/dashboard/ContinuationWidget.tsx` | Dashboard widget showing active run |
| `src/components/settings/ContinuationSettingsTab.tsx` | Org-level continuation defaults |

---

## 2. Schema

### `term_continuation_runs`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK, default gen_random_uuid() | |
| org_id | uuid | NOT NULL, FK → organisations(id) CASCADE | Multi-tenant scope |
| current_term_id | uuid | FK → terms(id) SET NULL | Nullable (post-FIX 4) |
| next_term_id | uuid | FK → terms(id) SET NULL | Nullable (post-FIX 4) |
| notice_deadline | date | NOT NULL | Response deadline |
| reminder_schedule | integer[] | DEFAULT '{7,14}' | Days after send for reminders |
| assumed_continuing | boolean | DEFAULT true | T&C assumption for non-responders |
| status | text | NOT NULL, CHECK constraint | draft/sent/partial/failed/reminding/deadline_passed/completed |
| sent_at | timestamptz | | When notifications were sent |
| deadline_passed_at | timestamptz | | When deadline was processed |
| completed_at | timestamptz | | When all responses processed |
| summary | jsonb | NOT NULL DEFAULT '{}' | Cached counts |
| created_by | uuid | NOT NULL | Admin who created |
| created_at/updated_at | timestamptz | auto | |

**Indexes:**
- `idx_tcr_org_status` — (org_id, status)
- `idx_tcr_next_term` — (next_term_id)
- `idx_tcr_unique_term_pair` — UNIQUE (org_id, current_term_id, next_term_id)

### `term_continuation_responses`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK | |
| org_id | uuid | NOT NULL, FK → organisations CASCADE | |
| run_id | uuid | NOT NULL, FK → term_continuation_runs CASCADE | |
| student_id | uuid | NOT NULL, FK → students CASCADE | |
| guardian_id | uuid | NOT NULL, FK → guardians CASCADE | |
| lesson_summary | jsonb | NOT NULL DEFAULT '[]' | Snapshot of lessons/fees at run creation |
| response | text | NOT NULL DEFAULT 'pending' | pending/continuing/withdrawing/assumed_continuing/no_response |
| response_at | timestamptz | | |
| response_method | text | | email_link/portal/admin_manual/auto_deadline |
| response_token | text | UNIQUE NOT NULL, auto-generated | 32-byte hex token |
| withdrawal_reason | text | | Reason code |
| withdrawal_notes | text | | Free text |
| is_processed | boolean | DEFAULT false | Whether extension/withdrawal was applied |
| processed_at | timestamptz | | |
| term_adjustment_id | uuid | FK → term_adjustments | For withdrawals |
| next_term_invoice_id | uuid | FK → invoices | Unused currently |
| initial_sent_at | timestamptz | | |
| reminder_1_sent_at | timestamptz | | |
| reminder_2_sent_at | timestamptz | | |
| reminder_count | integer | DEFAULT 0 | |
| next_term_fee_minor | integer | | Pre-calculated fee in minor units |

**Indexes:**
- UNIQUE (run_id, student_id) — one response per student per run
- (run_id, response) — status filtering
- (guardian_id, response) WHERE pending — parent lookup
- (student_id) — student lookup
- (response_token) — token lookup

### `terms` table (relevant columns)

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| org_id | uuid | FK → organisations |
| name | text | e.g. "Spring 2026" |
| start_date | date | |
| end_date | date | |
| created_at | timestamptz | |
| created_by | uuid | |

**Overlap trigger:** `check_term_overlap()` prevents overlapping date ranges within the same org using `daterange && daterange`.

### Organisation settings columns (added by continuation migration)
- `continuation_notice_weeks` integer DEFAULT 3
- `continuation_assumed_continuing` boolean DEFAULT true
- `continuation_reminder_days` integer[] DEFAULT '{7,14}'

---

## 3. Continuation Status Lifecycle

```
                    ┌──────────┐
                    │  DRAFT   │ ← admin creates run
                    └────┬─────┘
                         │ admin clicks "Send Notifications"
                    ┌────▼─────┐
              ┌─────│   SENT   │──────┐
              │     └────┬─────┘      │
              │          │            │ all emails fail
              │    reminders sent     │
              │     ┌────▼─────┐  ┌──▼──────┐
              │     │REMINDING │  │ FAILED   │
              │     └────┬─────┘  └──────────┘
              │          │          some fail
              │          │        ┌──────────┐
              │          │        │ PARTIAL  │
              │          │        └────┬─────┘
              └──────────┼─────────────┘
                         │ deadline passes (manual or cron)
                   ┌─────▼──────────┐
                   │DEADLINE_PASSED  │ ← pending → assumed_continuing or no_response
                   └─────┬──────────┘
                         │ admin processes (extend confirmed / process withdrawals)
                   ┌─────▼──────────┐
                   │  COMPLETED     │
                   └────────────────┘
```

### Response status lifecycle per student:
```
pending ──┬── parent responds "continuing" ──→ continuing
          ├── parent responds "withdrawing" ──→ withdrawing
          ├── admin manual override ──→ continuing/withdrawing
          └── deadline passes ──→ assumed_continuing (if flag on)
                               ──→ no_response (if flag off)
```

---

## 4. Parent Response Flow Trace

### Flow A: Email Link (Token-based, unauthenticated)
1. Admin creates run → edge function `create-continuation-run` (action=create)
2. Admin sends notifications → edge function (action=send)
3. Resend sends HTML email with two CTAs:
   - "Confirm Continuing" → `app.lessonloop.net/respond/continuation?token=XXX&action=continuing`
   - "Withdraw" → `app.lessonloop.net/respond/continuation?token=XXX&action=withdrawing`
4. Parent clicks link → `PortalContinuation.tsx` renders `TokenResponse` component
5. Parent submits → `supabase.functions.invoke('continuation-respond', { token, response })`
6. Edge function validates token, checks deadline, updates response, recalculates summary
7. Returns success with student name and term name

### Flow B: Portal (Authenticated parent)
1. Parent logs into portal → `PortalContinuation.tsx` renders `PortalContinuationList`
2. Hook `useParentContinuationPending()` fetches pending responses for this guardian+org
3. Parent clicks "Continue" or "Withdraw" → `useParentRespondToContinuation()` mutation
4. Calls edge function `continuation-respond` with `run_id` + `student_id` (no token)
5. Edge function verifies auth, finds guardian, checks deadline, updates response

### Flow C: Admin Manual Override
1. Admin clicks response row → `ContinuationResponseDetail` sheet opens
2. Admin selects override status → `useRespondToContinuation()` mutation
3. Direct Supabase update to `term_continuation_responses` (no edge function)
4. Method recorded as `admin_manual`

---

## 5. Term Extension Assessment

### What Works
- **Continuation run creation:** Correctly identifies students with recurring lessons in the current term, calculates next-term fees using rate cards, accounts for closure dates, groups by guardian
- **Notification emails:** Well-structured HTML emails with per-child CTAs, escape-html on all user content, Resend API integration, message logging
- **Parent response:** Both token-based and portal-based flows work, with server-side deadline enforcement
- **Deadline processing:** Both manual (admin button) and cron-compatible paths
- **Withdrawal processing:** Uses `process-term-adjustment` edge function (preview → confirm pattern), creates credit notes
- **Summary recalculation:** Automatic after every response change
- **Reminders:** Tracked per-response with reminder_count

### What's Missing (CRITICAL)

**LESSON CREATION ON ACCEPT — NOT IMPLEMENTED**

The `useBulkProcessContinuation` mutation (lines 538-583 in `useTermContinuation.ts`) extends the recurrence rule `end_date` but does **NOT generate actual lesson rows**. The code contains:

```typescript
// TODO(FIX-3): Extending recurrence end_date does NOT generate actual
// lesson records for the new term. The calendar relies on materialised
// lesson rows in the `lessons` table. An admin must verify that lessons
// appear in the calendar for the new term and use the Bulk Slot Generator
// if they are missing.
```

**Impact:** After a parent accepts and the admin processes confirmed students:
1. The `recurrence_rules.end_date` is extended ✓
2. No new `lessons` rows are created ✗
3. The calendar will NOT show lessons for the next term ✗
4. The admin must manually use the Bulk Slot Generator ✗

This is the **primary blocker** identified in the handoff. The workaround (manual Bulk Slot Generator) exists but requires admin intervention and is error-prone.

**What should happen:** After extending the recurrence end_date, the system should call an RPC or edge function that materialises lesson rows for the new date range, similar to what the Bulk Slot Generator does.

---

## 6. Findings Table

| ID | Severity | Description | File(s) | Recommended Fix |
|----|----------|-------------|---------|-----------------|
| TC-1 | **CRITICAL** | Extending confirmed students does NOT create lesson rows. Only updates `recurrence_rules.end_date`. Calendar will be empty for next term. | `src/hooks/useTermContinuation.ts:577` | Implement server-side lesson materialisation on accept. Call an RPC that generates lesson rows from the recurrence rule for the next term date range. |
| TC-2 | **HIGH** | `useUpdateContinuationResponse` references wrong table name `continuation_responses` instead of `term_continuation_responses`. Will silently fail on every call. | `src/hooks/useTermContinuation.ts:932` | Change `'continuation_responses' as any` to `'term_continuation_responses' as any` |
| TC-3 | **HIGH** | `ContinuationWidget` realtime subscription targets wrong table `continuation_responses` instead of `term_continuation_responses`. Widget will never get realtime updates. | `src/components/dashboard/ContinuationWidget.tsx:33` | Change table name to `term_continuation_responses` |
| TC-4 | **HIGH** | Inline response override dropdown in `Continuation.tsx` uses `useUpdateContinuationResponse` (broken, see TC-2). Admin cannot change status via inline dropdown. | `src/pages/Continuation.tsx:578` | Fix underlying hook (TC-2), or use `useRespondToContinuation` instead |
| TC-5 | **MEDIUM** | `continuation-respond` edge function: response update does not check `.error` return from Supabase update. Silent failure if RLS blocks or constraint fails. | `supabase/functions/continuation-respond/index.ts:218-226` | Add error checking: `const { error } = await client...update(...)` and return error response if failed |
| TC-6 | **MEDIUM** | `continuation-respond` edge function: `recalcSummary` does not check update error. Summary can silently become stale. | `supabase/functions/continuation-respond/index.ts:36-77` | Check error on both select and update in recalcSummary |
| TC-7 | **MEDIUM** | No admin notification on decline/withdrawal. When a parent withdraws, the admin learns about it only by checking the dashboard. | Multiple | Send a push notification or in-app alert to org admins when a parent withdraws. |
| TC-8 | **MEDIUM** | `ContinuationRunStatus` type in hook doesn't include 'failed' and 'partial' from FIX 2E.1. TypeScript won't match DB values. | `src/hooks/useTermContinuation.ts:12-17` | Add `'failed' | 'partial'` to the union type |
| TC-9 | **MEDIUM** | `ContinuationWidget` invalidates `['continuation']` query key which doesn't match any actual query. Should be `['continuation-runs']`. | `src/components/dashboard/ContinuationWidget.tsx:36` | Change to `['continuation-runs']` |
| TC-10 | **MEDIUM** | Parent can't change mind after responding. Once response != 'pending', both token and portal flows return "already responded". No way to change from continuing to withdrawing or vice versa. | `continuation-respond/index.ts:179,326` | Consider allowing re-response before deadline, or require admin intervention (document this as intentional if desired) |
| TC-11 | **MEDIUM** | Bulk process runs on frontend client, N+1 queries per response per lesson. For 50 students × 2 lessons, that's 100+ sequential Supabase calls. Timeout risk. | `src/hooks/useTermContinuation.ts:538-651` | Move bulk processing to an edge function for atomicity, performance, and server-side error handling |
| TC-12 | **LOW** | `useDeleteContinuationRun` manually deletes responses then run, but run has `ON DELETE CASCADE` for responses. Double delete is redundant (harmless but wasteful). | `src/hooks/useTermContinuation.ts:882-886` | Remove the explicit response delete — CASCADE handles it |
| TC-13 | **LOW** | `handleSend` uses hardcoded currency symbol lookup (`£`, `$`, `€`). Should use `formatCurrencyMinor` or a complete symbol map. | `supabase/functions/create-continuation-run/index.ts` (line ~938) | Use proper currency formatting or extend the symbol map |
| TC-14 | **LOW** | `ContinuationResponseDetail` only shows admin override for `pending` responses (line 217). After deadline processing, `assumed_continuing` and `no_response` entries can't be overridden from the detail sheet. | `src/components/continuation/ContinuationResponseDetail.tsx:217` | Extend override to `assumed_continuing` and `no_response` statuses as well |
| TC-15 | **LOW** | `next_term_invoice_id` column on responses is defined but never populated. Dead column. | `20260228100000_term_continuation.sql:73` | Either implement invoice linking during billing run creation, or remove the column |
| TC-16 | **LOW** | Closure dates in run creation only consider `applies_to_all_locations`. Location-specific closures for lessons at specific locations are ignored. | `create-continuation-run/index.ts` (line ~441) | Join lesson location and match against location-specific closure dates |
| TC-17 | **LOW** | Token-based flow (`TokenResponse` component) doesn't pre-fetch response details (student name, term, fee). Parent sees generic text until they click a button. | `src/pages/portal/PortalContinuation.tsx:51-62` | Fetch response details via token lookup before presenting the form |
| TC-18 | **INFO** | Cron job for deadline processing is documented in comments but no evidence of it being configured in Supabase. Manual deadline processing works as fallback. | `create-continuation-run/index.ts:137-143` | Configure Supabase cron or pg_cron to call process_deadline daily |

---

## 7. RLS Policy Matrix

### `term_continuation_runs`

| Operation | Policy | Role | Condition |
|-----------|--------|------|-----------|
| SELECT | "Org members can view continuation runs" | All org members | `is_org_member(auth.uid(), org_id)` |
| INSERT | "Org admins can create continuation runs" | Owner, Admin | `is_org_admin(auth.uid(), org_id)` |
| UPDATE | "Org admins can update continuation runs" | Owner, Admin | `is_org_admin(auth.uid(), org_id)` |
| DELETE | "Org admins can delete continuation runs" | Owner, Admin | `is_org_admin(auth.uid(), org_id)` |

**Assessment:** Correct. Teachers can view but not modify. Parents don't need direct access to runs. Finance role gets read via `is_org_member`.

### `term_continuation_responses`

| Operation | Policy | Role | Condition |
|-----------|--------|------|-----------|
| SELECT | "Org members can view continuation responses" | All org members | `is_org_member(auth.uid(), org_id)` |
| ALL | "Org admins can manage continuation responses" | Owner, Admin | `is_org_admin(auth.uid(), org_id)` |
| SELECT | "Parents see own responses" (FIX 1D.1) | Parents | `guardian_id IN (student_guardians via user_id) AND org_id matches run's org` |
| UPDATE | "Parents can update their own continuation response" | Parents | `guardian_id match + response IN ('continuing', 'withdrawing')` |

**Assessment:**
- Parent SELECT policy was fixed (FIX 1D.1) to scope by org_id via join to `student_guardians` — **VERIFIED CORRECT**
- Parent UPDATE restricts to valid response values — good
- The original parent SELECT policy (`guardian_id IN (SELECT id FROM guardians WHERE user_id = ...)`) is still present alongside the new one. Both will apply (OR logic). The old one is **not dropped** in the fix migration — but the new one is more restrictive. The old policy allows cross-org viewing. **This is a security issue** — the old policy should have been dropped.

**CORRECTION on RLS:** Re-reading the fix migration:
```sql
DROP POLICY IF EXISTS "Parents can view their own continuation responses"
  ON public.term_continuation_responses;
```
The old policy IS dropped. **VERIFIED CORRECT.** However, the parent UPDATE policy still uses the old pattern (`guardian_id IN (SELECT id FROM guardians WHERE user_id = auth.uid())`), which is **not org-scoped**. A parent could theoretically update responses across orgs if they share a guardian record.

---

## 8. Handoff Fix Verification Checklist

| Handoff Fix | Status | Evidence |
|-------------|--------|----------|
| FK CASCADE → SET NULL for term deletion | **VERIFIED** | Migration `20260315200200` changes both `current_term_id` and `next_term_id` to `ON DELETE SET NULL`, drops NOT NULL constraints |
| Atomic RPC for accept/decline | **PARTIAL** | Edge function `continuation-respond` handles both flows, but it's not truly atomic (multiple sequential updates without transaction). However, the update is a single row update which is effectively atomic at the DB level. |
| Server-side deadline enforcement | **VERIFIED** | Both `handleTokenResponse` and `handlePortalResponse` check `new Date(run.notice_deadline) < new Date()` before allowing response |
| Parent RLS org scoping | **VERIFIED** | Migration `20260315200500` replaces the unscoped parent SELECT policy with one that joins through `student_guardians` and validates `org_id` matches the run |
| Run status enum includes failed/partial | **VERIFIED** | Migration `20260315200600` adds 'failed' and 'partial' to the CHECK constraint |
| Extend doesn't create lessons (TODO+warning) | **VERIFIED — STILL UNRESOLVED** | TODO comment at line 577 in `useTermContinuation.ts`. Warning toast shown to admin after processing. |
| Realtime widget | **BROKEN** | Widget subscribes to wrong table name `continuation_responses` instead of `term_continuation_responses` (TC-3) |
| Manual status override | **WORKS (partial)** | Detail sheet allows override for `pending` responses. Inline dropdown in table uses broken hook (TC-2, TC-4) |
| Admin notification on decline | **NOT IMPLEMENTED** | No push notification or email to admin when parent withdraws (TC-7) |
| CSV export | **VERIFIED** | Export button in Continuation.tsx generates CSV with student/guardian/status/date/notes |
| Enrolment waitlist expiry for both types | **NOT IN SCOPE** | This is a waitlist feature, not continuation. Not found in continuation code. |
| Max credits per term enforcement | **NOT IN SCOPE** | This is a billing feature. Continuation doesn't interact with credit limits. |

---

## 9. Edge Cases Analysis

| Scenario | Handled? | Details |
|----------|----------|---------|
| Student in multiple lessons | **YES** | `lesson_summary` array holds multiple lessons per response. One response per student per run (UNIQUE index). Fees are summed across all lessons. |
| Student withdrawn before continuation run | **YES** | Only `status = 'active'` students are included in run creation |
| Parent with multiple children | **YES** | One response per student. Portal shows all pending responses. Email groups children per guardian. |
| Continuation run for overlapping terms | **PREVENTED** | Server-side validation checks `nextTerm.start_date > currentTerm.end_date` |
| Two continuation runs for same term pair | **PREVENTED** | UNIQUE index `idx_tcr_unique_term_pair` on (org_id, current_term_id, next_term_id), plus edge function checks for existing non-completed runs |
| No parents respond by deadline | **YES** | `process_deadline` marks all pending as `assumed_continuing` or `no_response` based on org setting |
| Both parents of same student respond | **N/A** | Only primary payer guardian gets a response row. Second parent has no token/response entry. |
| Student has no guardian | **YES** | Skipped during run creation, reported in `skipped_students` array |
| Guardian has no email | **YES** | Included in preview with "no email" badge, tracked in `failed` array during send |
| Term deleted after run created | **YES** | FK SET NULL preserves the run with null term_id. UI shows "Current Term" / "Next Term" fallback text. |
| Deadline comparison timezone | **ISSUE** | Deadline is compared using `new Date(run.notice_deadline) < new Date()` — this compares midnight UTC vs server time. For UK orgs, a deadline of "2026-03-16" would expire at midnight UTC, not midnight London time. |

---

## 10. Verdict

### NOT READY FOR PRODUCTION

**Blocking Issues (must fix before launch):**

1. **TC-1 (CRITICAL):** Lesson creation on accept is completely unimplemented. The core promise of "continuation" — that accepting continues lessons into the next term — doesn't work end-to-end. Admins must manually use the Bulk Slot Generator, which is fragile and undiscoverable.

2. **TC-2 + TC-4 (HIGH):** The inline response override uses a broken hook targeting the wrong table. Admin overrides from the response table silently fail.

3. **TC-3 (HIGH):** Dashboard widget realtime is broken — wrong table name means it never updates.

**Should fix before launch:**

4. **TC-5/TC-6 (MEDIUM):** Edge function response updates don't check errors — can silently fail.
5. **TC-8 (MEDIUM):** TypeScript status type doesn't match DB enum — 'failed' and 'partial' statuses will cause type mismatches.
6. **TC-11 (MEDIUM):** Bulk processing runs N+1 queries on the client. Should be a server-side edge function for reliability.

**Can defer to post-beta:**

7. TC-7: Admin decline notifications
8. TC-10: Parent re-response before deadline
9. TC-13-18: Minor improvements

### Summary

The continuation feature has a well-designed schema, good email integration, and solid parent response flows. However, the **critical gap** — automatically creating lessons when parents confirm — means the feature doesn't deliver on its core value proposition. The two broken table references (TC-2, TC-3) are simple fixes but prevent admin overrides and realtime updates from working. Fix TC-1, TC-2, TC-3, and TC-8 to reach production-ready status.
