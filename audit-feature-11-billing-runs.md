# Audit — Feature 11: Billing Runs

**Auditor:** Claude Code (Opus 4.6)
**Date:** 2026-03-15
**Verdict:** **NOT READY** — 5 HIGH, 4 MEDIUM, 3 LOW findings

---

## 1. Files Audited

| Category | File |
|----------|------|
| Edge Function | `supabase/functions/create-billing-run/index.ts` |
| Edge Function | `supabase/functions/stripe-billing-history/index.ts` |
| Shared Utility | `supabase/functions/_shared/rate-limit.ts` |
| Migration (schema) | `supabase/migrations/20260119234233_…_billing_tables.sql` |
| Migration (terms) | `supabase/migrations/20260209170759_…_terms.sql` |
| Migration (status enum) | `supabase/migrations/20260221004418_…_processing_partial.sql` |
| Migration (dedup index) | `supabase/migrations/20260220012039_…_no_duplicate.sql` |
| Migration (verify dedup) | `supabase/migrations/20260315200600_verify_billing_run_duplicate_constraint.sql` |
| Migration (RLS overhaul) | `supabase/migrations/20260120215839_…_updated_rls.sql` |
| Migration (helper fns) | `supabase/migrations/20260120215727_…_security_helpers.sql` |
| Migration (rate_minor) | `supabase/migrations/20260315220001_add_rate_minor_to_lesson_participants.sql` |
| Migration (check constraints) | `supabase/migrations/20260315220005_invoice_items_check_constraints.sql` |
| Migration (credit note fix) | `supabase/migrations/20260315220007_fix_invoice_items_check_credit_notes.sql` |
| Migration (void invoice) | `supabase/migrations/20260315220002_void_invoice_clear_billing_markers.sql` |
| Migration (recalculate paid) | `supabase/migrations/20260315200500_atomic_recalculate_invoice_paid.sql` |
| Migration (invoice numbers) | `supabase/migrations/20260224150000_invoice_branding_and_custom_numbers.sql` |
| Migration (unbilled RPC) | `supabase/migrations/20260220005744_…_get_unbilled_lesson_ids.sql` |
| Migration (open slot) | `supabase/migrations/20260305173228_…_is_open_slot.sql` |
| Migration (open slot trigger) | `supabase/migrations/20260315100200_fix_clear_open_slot_on_participant.sql` |
| Migration (is_invoice_payer) | `supabase/migrations/20260119235724_…_parent_portal.sql` |
| Hook | `src/hooks/useBillingRuns.ts` |
| Hook | `src/hooks/useRateCards.ts` |
| Hook | `src/hooks/useInvoices.ts` (useUnbilledLessons) |
| Component | `src/components/invoices/BillingRunWizard.tsx` |
| Component | `src/components/settings/TermManagementCard.tsx` |
| Test | `src/test/billing/InvoiceCalculations.test.ts` |
| Test | `src/test/performance/BillingScale.test.ts` |
| Types | `src/integrations/supabase/types.ts` |

---

## 2. create-billing-run Edge Function — Complete Flow

```
┌─────────────────────────────────────────────────────────┐
│  1. CORS preflight (OPTIONS)                             │
├─────────────────────────────────────────────────────────┤
│  2. Auth: Extract Bearer token → getUser()               │
│     ✗ → 401 Unauthorized                                │
├─────────────────────────────────────────────────────────┤
│  3. Rate limit: checkRateLimit(userId, "billing-run")    │
│     Config: 3 req / 5 min per user (edge fn code)        │
│     BUT shared config says 10 req / 60 min ⚠️            │
│     ✗ → 429 Too Many Requests                           │
├─────────────────────────────────────────────────────────┤
│  4. Auth: Verify org membership (owner/admin/finance)    │
│     Uses service role client → bypasses RLS              │
│     ✗ → 403 Not authorised                              │
├─────────────────────────────────────────────────────────┤
│  5. Route: action="create" → handleCreate()              │
│          action="retry"  → handleRetry()                │
├─────────────────────────────────────────────────────────┤
│                    handleCreate()                        │
├─────────────────────────────────────────────────────────┤
│  6. Validate fallback_rate_minor (1..100000)             │
│     ✗ 0 or negative → 400                               │
│     ⚠️ No validation on start_date/end_date format       │
├─────────────────────────────────────────────────────────┤
│  7. Fetch org settings (VAT, currency, timezone)         │
│     ✗ → 404                                             │
├─────────────────────────────────────────────────────────┤
│  8. INSERT billing_runs (status='processing')            │
│     Dedup: partial unique index (org_id, start_date,     │
│            end_date) WHERE status != 'failed'            │
│     ✗ 23505 → 409 "already exists"                      │
├─────────────────────────────────────────────────────────┤
│  9. executeBillingLogic()                                │
│     a. Fetch rate_cards for org                          │
│     b. Fetch lessons in date range:                      │
│        - org_id match                                    │
│        - status: 'completed' (delivered)                 │
│               or 'scheduled'+'completed' (upfront)       │
│        - NOT is_open_slot                                │
│        - start_at >= startDate AND <= endDate            │
│     c. Fetch already-billed (lesson_id, student_id)      │
│        from invoice_items                                │
│     d. Fetch attendance_records (batch 500)              │
│     e. Group by payer:                                   │
│        - Active students only                            │
│        - Skip already-billed pairs                       │
│        - Skip cancelled_by_teacher                       │
│        - Find primary_payer guardian or student           │
│        - Skip if no payer → track reason                 │
│        - Dedup by (lesson_id, student_id) per payer      │
│     f. Rate resolution per lesson/student:               │
│        snapshotRate → rateCard → fallback                │
│     g. Calculate invoice totals with VAT                 │
│     h. Batch insert invoices                             │
│     i. Batch insert invoice_items                        │
│     j. Orphan cleanup on items failure                   │
├─────────────────────────────────────────────────────────┤
│  10. Update billing_runs status:                         │
│      0 failures → 'completed'                            │
│      some failures → 'partial'                           │
│      all failures → 'failed'                             │
├─────────────────────────────────────────────────────────┤
│  11. Return { id, status, summary }                      │
└─────────────────────────────────────────────────────────┘
```

---

## 3. Rate Resolution Chain

| Priority | Source | Field | When Used |
|----------|--------|-------|-----------|
| 1 (highest) | `lesson_participants` | `rate_minor` | Snapshotted at lesson creation; preferred if > 0 |
| 2 | `rate_cards` | Exact duration match | When snapshot is NULL or 0 |
| 3 | `rate_cards` | Default card (`is_default=true`) | When no exact duration match |
| 4 | `rate_cards` | First card (`rateCards[0]`) | When no default exists |
| 5 (lowest) | Request body | `fallback_rate_minor` | When no rate cards exist at all |

**Default fallback:** £30.00 (3000 minor units) — hardcoded if `fallback_rate_minor` not provided.

---

## 4. Findings

| ID | Severity | Description | File(s) | Recommended Fix |
|----|----------|-------------|---------|-----------------|
| BIL-H1 | **HIGH** | **No start_date/end_date validation.** The edge function does not validate that `start_date` and `end_date` are present, are valid date strings, or that `end_date >= start_date`. Invalid dates would cause silent DB errors or empty results. The non-null assertion `body.start_date!` at line 205 will not catch undefined — it passes `undefined` to the SQL query. | `create-billing-run/index.ts:205-206` | Add explicit validation: required, ISO date format, end >= start, reasonable range (not > 1 year). |
| BIL-H2 | **HIGH** | **No billing_run_id FK on invoices.** There is no `billing_run_id` column on the `invoices` table linking invoices back to the billing run that created them. This means: (1) deleting a billing run cannot cascade-delete its invoices, (2) there's no way to query which invoices belong to a run except via the `summary.invoiceIds` JSONB array, (3) the "delete run" feature cannot be safely implemented. The billing run stores `invoiceIds` in a JSONB summary field — fragile and non-relational. | `invoices` table schema | Add `billing_run_id uuid REFERENCES billing_runs(id) ON DELETE SET NULL` to invoices. Populate during billing run creation. |
| BIL-H3 | **HIGH** | **No "delete billing run" feature exists.** There is no edge function, RPC, or client-side hook to delete a billing run and its associated invoices. The RLS policy allows admin DELETE on `billing_runs`, but deleting a billing run row alone would orphan all its invoices (no FK cascade). The only reference is in `TermManagementCard.tsx` which warns about losing term references, but there is no actual delete billing run UI. | N/A | Implement a `delete_billing_run` RPC that: (1) checks no paid invoices exist, (2) deletes invoice_items via cascade, (3) deletes invoices, (4) deletes the billing_run row. Or add billing_run_id FK with ON DELETE CASCADE. |
| BIL-H4 | **HIGH** | **`get_unbilled_lesson_ids` RPC has no auth check.** This SECURITY DEFINER function accepts any `_org_id` and returns lesson IDs without verifying the caller has access to that org. Any authenticated user can enumerate lesson IDs for any org. | `20260220005744_…_get_unbilled_lesson_ids.sql` | Add `IF NOT is_org_finance_team(auth.uid(), _org_id) THEN RAISE EXCEPTION 'Not authorised'; END IF;` at the start. |
| BIL-H5 | **HIGH** | **Rate limit config mismatch.** The edge function passes `{ maxRequests: 3, windowMinutes: 5 }` inline (line 82-83), but the shared rate-limit config declares `"billing-run": { maxRequests: 10, windowMinutes: 60 }`. The inline config wins (it's passed explicitly), so the actual limit is 3/5min — more restrictive than documented. This is not a security issue but a maintenance/documentation bug that could cause confusion. | `create-billing-run/index.ts:82`, `_shared/rate-limit.ts:27` | Align: either use the shared config (remove inline override) or update the shared config to match. |
| BIL-M1 | **MEDIUM** | **`get_unbilled_lesson_ids` dedup is per-lesson, not per-(lesson, student).** The RPC checks `NOT EXISTS (SELECT 1 FROM invoice_items ii WHERE ii.linked_lesson_id = l.id)` — this excludes a lesson entirely if ANY student has been billed for it. In a group lesson with 5 students where 3 have been billed, the lesson would be excluded from unbilled results, and the remaining 2 students would never be billed. The edge function itself correctly does per-(lesson, student) dedup, but the preview RPC gives incorrect counts. | `20260220005744_…_get_unbilled_lesson_ids.sql` | Rewrite to `NOT EXISTS (SELECT 1 FROM invoice_items ii WHERE ii.linked_lesson_id = l.id AND ii.student_id = lp.student_id)` joined with `lesson_participants`. Or remove this RPC and do all filtering in the edge function. |
| BIL-M2 | **MEDIUM** | **No NOT NULL constraint on billing_runs.start_date/end_date at edge function level.** While the DB columns are `NOT NULL`, the TypeScript interface marks them optional (`start_date?: string`). If the client omits them, `undefined` flows to the INSERT, which will fail with a DB error — but the error message won't be user-friendly. | `create-billing-run/index.ts:15-16` | Validate required fields before DB insert: `if (!body.start_date || !body.end_date) return 400`. |
| BIL-M3 | **MEDIUM** | **Concurrent billing runs for overlapping (not identical) periods are not prevented.** The dedup constraint is on exact `(org_id, start_date, end_date)`. Running Jan 1-31 and Jan 15-Feb 15 would create overlapping invoices for lessons in the overlap window. The per-(lesson, student) dedup in `invoice_items` prevents double-billing, but creates confusing billing run records. | `20260220012039_…_no_duplicate.sql`, `create-billing-run/index.ts` | Document as intentional, or add an overlap check query before insert. |
| BIL-M4 | **MEDIUM** | **No transaction wrapping — partial failure state.** The billing run creates the run row, then inserts invoices, then inserts items as separate operations. If the function crashes between invoice insert and item insert, orphan invoices with no items exist. The orphan cleanup only handles the case where ALL items fail to insert (batch insert error), not partial crashes/timeouts. Supabase edge functions have a 60s timeout — large billing runs could hit this. | `create-billing-run/index.ts:200-262` | For large orgs, consider: (1) wrapping in a DB-level function/transaction, or (2) adding a cleanup cron that deletes invoices with 0 items, or (3) paginating lessons and processing in smaller batches. |
| BIL-L1 | **LOW** | **Invoice number sequence race condition (theoretical).** The `generate_invoice_number` function uses `INSERT … ON CONFLICT DO NOTHING` then `UPDATE … RETURNING`. Two concurrent transactions could both read the same current_number before incrementing. However, the `UPDATE` acquires a row lock, so this is actually safe in PostgreSQL — the second UPDATE will block until the first commits. Not a real bug, but worth documenting. | `20260224150000_invoice_branding_and_custom_numbers.sql` | No action needed — PostgreSQL row locking handles this correctly. |
| BIL-L2 | **LOW** | **Billing run preview vs actual results may differ.** The wizard preview uses `useUnbilledLessons` (which calls `get_unbilled_lesson_ids` — the flawed per-lesson dedup), while the actual billing run does its own per-(lesson, student) dedup. Preview counts may not match actual results. | `BillingRunWizard.tsx`, `useInvoices.ts` | Fix `get_unbilled_lesson_ids` per BIL-M1, or add a disclaimer to the preview. |
| BIL-L3 | **LOW** | **`run_type` not validated against enum.** The edge function accepts any string for `run_type` (line 173: `body.run_type || "manual"`), but the DB enum is `('monthly', 'term', 'custom')`. Passing `"manual"` would fail at DB level. The client always sends valid values, but the edge function should validate. | `create-billing-run/index.ts:173` | Validate `run_type` is one of the allowed enum values, or default to `'custom'` instead of `'manual'`. |

---

## 5. Financial Accuracy Assessment

| Check | Status | Notes |
|-------|--------|-------|
| Amounts in minor units (pence/cents) | **PASS** | All columns are `_minor` integers. No floating point. |
| Rounding | **PASS** | VAT uses `Math.round()` on integer arithmetic. No precision loss. |
| Invoice totals = subtotal + tax | **PASS** | Calculated as `subtotal + Math.round(subtotal * vatRate/100)`. |
| Line item amounts = qty × unit_price | **PASS** | `amount_minor = lessonRates[j]`, quantity always 1. |
| No negative amounts on regular invoices | **PASS** | Trigger `check_invoice_item_amounts()` prevents negative on non-credit-note items. `chk_invoice_items_positive_quantity` CHECK ensures quantity > 0. |
| Dedup prevents double-billing | **PASS** | Edge function checks `(lesson_id, student_id)` pairs from `invoice_items`. |
| Rate snapshot used correctly | **PASS** | `snapshotRate` from `lesson_participants.rate_minor` preferred over live rate cards. |
| Fallback rate validated | **PASS** | Must be > 0 and ≤ 100000. |
| Currency consistent | **PASS** | Uses `org.currency_code` for all invoices in a run. |
| VAT calculation correct | **PASS** | Applied on subtotal, not per-item. Documented in code comment. |

**Overall financial accuracy: GOOD** — Integer arithmetic throughout, proper rounding, no floating point exposure.

---

## 6. RLS Policy Matrix

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| `billing_runs` | Finance team (owner/admin/finance) | Finance team | Finance team | Admin only (owner/admin) |
| `invoices` | Finance team OR parent (own invoices via `is_invoice_payer`) | Finance team | Finance team | Admin only |
| `invoice_items` | Finance team OR parent (own items via `is_invoice_payer`) | Finance team | Finance team | Finance team |
| `payments` | Finance team OR parent (own payments) | Finance team | Finance team | Admin only |
| `rate_cards` | Finance team | Admin only | Admin only | Admin only |

**Notes:**
- Teachers **cannot** see billing runs, invoices, or rate cards. Correct.
- Parents can only see their own invoices (via `is_invoice_payer`). Correct.
- The edge function uses service role (bypasses RLS) for all data operations. This is necessary because billing runs span all students/lessons.
- `is_org_finance_team` = owner + admin + finance roles. Correct.
- DELETE on `invoice_items` allows finance team (not just admin). This is slightly more permissive than other DELETE policies but reasonable for line item management.

---

## 7. Edge Case Coverage Matrix

| Edge Case | Handled? | How |
|-----------|----------|-----|
| No lessons in billing period | **YES** | Returns empty results, 0 invoices. Run status = 'completed' with 0 invoices. |
| Student with no rate configured | **YES** | Falls through rate chain to fallback rate (£30 default). |
| Group lesson with 10 students | **YES** | Each student billed independently via per-(lesson, student) dedup. Each gets their own invoice item. |
| Billing run spanning month boundary | **YES** | Uses `start_at >= startDate AND start_at <= endDate` — works across months. |
| Student withdrawn mid-period | **YES** | Only `status = 'active'` students are billed (line 471). |
| Lesson cancelled mid-period | **YES** | Only `completed` (or `scheduled` for upfront) lessons included. `cancelled_by_teacher` attendance skipped. |
| Rate changed mid-period | **YES** | `lesson_participants.rate_minor` snapshot preserves original rate. |
| Two runs for same period | **YES** | Partial unique index prevents duplicate runs (same org + dates). Returns 409. |
| Two runs for overlapping periods | **PARTIAL** | Not prevented at DB level, but per-(lesson, student) dedup in `invoice_items` prevents double-billing. See BIL-M3. |
| Concurrent billing runs (two admins) | **PARTIAL** | The unique index will cause one to fail with 23505. But if dates differ slightly, both proceed. Rate limit (3/5min) provides some protection. |
| Open slot lessons | **YES** | Filtered out: `.or('is_open_slot.is.null,is_open_slot.eq.false')` |
| Student with no guardian and no email | **YES** | Skipped with reason `'no_primary_payer'`, tracked in summary. |
| Voided invoices — re-billing | **YES** | `void_invoice()` nulls `linked_lesson_id` on items, allowing lessons to be re-billed. |
| Very large billing run (100+ invoices) | **RISK** | No pagination/batching of invoice inserts. Could hit Supabase edge function 60s timeout. See BIL-M4. |

---

## 8. Timezone Assessment

| Operation | Timezone Handling | Status |
|-----------|-------------------|--------|
| Lesson date filtering | Uses raw `start_at` (timestamptz) compared against `startDate`/`endDate` strings | **CONCERN** — if `startDate` is `'2026-01-01'`, Supabase casts it to midnight UTC, not org timezone. A 23:30 London lesson on Dec 31 (stored as 23:30 UTC in winter) would be included in January's run. |
| Due date calculation | Uses `toLocaleDateString('en-CA', { timeZone: tz })` to get today in org TZ, adds 14 days | **PASS** — correctly timezone-aware. |
| Billing run period display | Stored as `date` type (timezone-neutral) | **PASS** |

**Note:** The lesson date boundary issue is a pre-existing concern across the platform (the lesson `start_at` is timestamptz, but billing dates are plain dates). For UK timezone (UTC+0 in winter, UTC+1 in summer), the impact is minimal — at most 1 hour of boundary discrepancy during BST. This is documented in claude.md as a known pattern.

---

## 9. Security Assessment

| Check | Status | Notes |
|-------|--------|-------|
| Auth header validation | **PASS** | Bearer token extracted, `getUser()` called. |
| Role check (owner/admin/finance) | **PASS** | Membership checked via service role client. |
| Rate limiting | **PASS** | 3 requests per 5 minutes per user. Fails closed. |
| org_id spoofing | **PASS** | Membership verified against `body.org_id`. |
| Financial amount tampering | **PASS** | `fallback_rate_minor` validated (1-100000). Rates come from DB, not client. |
| Service role key exposure | **PASS** | Used server-side only, not exposed to client. |
| SQL injection | **PASS** | All queries use Supabase client (parameterized). |
| `get_unbilled_lesson_ids` auth | **FAIL** | No auth check — see BIL-H4. |
| `generate_invoice_number` | **PASS** | SECURITY DEFINER with `SET search_path`. |
| `void_invoice` | **PASS** | Checks `is_org_finance_team`. Prevents voiding paid invoices. |
| `recalculate_invoice_paid` | **PASS** | SECURITY DEFINER. Uses `FOR UPDATE` lock. |

---

## 10. Verdict

### **NOT READY** for production

**5 HIGH severity findings must be resolved:**

1. **BIL-H1:** No date validation on billing run creation — could cause silent failures or DB errors.
2. **BIL-H2:** No `billing_run_id` FK on invoices — makes run management/deletion impossible.
3. **BIL-H3:** No delete billing run feature — users cannot clean up bad runs.
4. **BIL-H4:** `get_unbilled_lesson_ids` RPC has no auth check — cross-org data leak.
5. **BIL-H5:** Rate limit config mismatch — maintenance issue (not blocking, but should be aligned).

**Recommended fix priority:**
1. BIL-H4 (security — immediate)
2. BIL-H1 (data integrity — immediate)
3. BIL-H5 (cleanup — quick)
4. BIL-H2 + BIL-H3 (architectural — before billing goes live)
5. BIL-M1 (preview accuracy — before billing goes live)
6. BIL-M3, BIL-M4 (operational — can be post-launch with monitoring)

**What's done well:**
- Financial calculations are integer-based throughout — no floating point risk
- Rate snapshot system prevents retroactive billing changes
- Per-(lesson, student) dedup is correctly implemented in the edge function
- Orphan cleanup handles the batch-failure case
- RLS policies are properly scoped (finance team for billing, admin for destructive ops)
- VAT calculation uses `Math.round()` — no penny-rounding errors
- Open slots correctly excluded
- Cancelled-by-teacher lessons correctly excluded
- Skipped students tracked with reasons
- Retry mechanism for failed payers
- Void invoice correctly clears billing markers for re-billing
