# Deep Audit: Term Continuation System — Part 1

**Date:** 2026-03-15
**Auditor:** Claude (automated deep audit)
**Scope:** Data model, run creation, parent response
**Branch:** `claude/audit-term-continuation-L8oAJ`

---

## SECTION 1: DATA MODEL

### 1A. Tables and Columns

#### Table: `term_continuation_runs`

| Column | Type | Nullable | Default | FK Reference |
|---|---|---|---|---|
| `id` | uuid | NOT NULL | `gen_random_uuid()` | PK |
| `org_id` | uuid | NOT NULL | — | `organisations(id) ON DELETE CASCADE` |
| `current_term_id` | uuid | NOT NULL | — | `terms(id) ON DELETE CASCADE` (amended by migration 20260303182000) |
| `next_term_id` | uuid | NOT NULL | — | `terms(id) ON DELETE CASCADE` (amended by migration 20260303182000) |
| `notice_deadline` | date | NOT NULL | — | — |
| `reminder_schedule` | integer[] | YES | `'{7,14}'` | — |
| `assumed_continuing` | boolean | YES | `true` | — |
| `status` | text | NOT NULL | `'draft'` | — (CHECK constraint) |
| `sent_at` | timestamptz | YES | — | — |
| `deadline_passed_at` | timestamptz | YES | — | — |
| `completed_at` | timestamptz | YES | — | — |
| `summary` | jsonb | NOT NULL | `'{}'::jsonb` | — |
| `created_by` | uuid | NOT NULL | — | **No FK declared** |
| `created_at` | timestamptz | NOT NULL | `now()` | — |
| `updated_at` | timestamptz | NOT NULL | `now()` | — |

#### Table: `term_continuation_responses`

| Column | Type | Nullable | Default | FK Reference |
|---|---|---|---|---|
| `id` | uuid | NOT NULL | `gen_random_uuid()` | PK |
| `org_id` | uuid | NOT NULL | — | `organisations(id) ON DELETE CASCADE` |
| `run_id` | uuid | NOT NULL | — | `term_continuation_runs(id) ON DELETE CASCADE` |
| `student_id` | uuid | NOT NULL | — | `students(id) ON DELETE CASCADE` |
| `guardian_id` | uuid | NOT NULL | — | `guardians(id) ON DELETE CASCADE` |
| `lesson_summary` | jsonb | NOT NULL | `'[]'::jsonb` | — |
| `response` | text | NOT NULL | `'pending'` | — (CHECK constraint) |
| `response_at` | timestamptz | YES | — | — |
| `response_method` | text | YES | — | — |
| `response_token` | text | NOT NULL | `encode(gen_random_bytes(32), 'hex')` | UNIQUE |
| `withdrawal_reason` | text | YES | — | — |
| `withdrawal_notes` | text | YES | — | — |
| `is_processed` | boolean | YES | `false` | — |
| `processed_at` | timestamptz | YES | — | — |
| `term_adjustment_id` | uuid | YES | — | `term_adjustments(id)` — **No ON DELETE behaviour specified (defaults to NO ACTION)** |
| `next_term_invoice_id` | uuid | YES | — | `invoices(id)` — **No ON DELETE behaviour specified (defaults to NO ACTION)** |
| `initial_sent_at` | timestamptz | YES | — | — |
| `reminder_1_sent_at` | timestamptz | YES | — | — |
| `reminder_2_sent_at` | timestamptz | YES | — | — |
| `reminder_count` | integer | YES | `0` | — |
| `next_term_fee_minor` | integer | YES | — | — |
| `created_at` | timestamptz | NOT NULL | `now()` | — |
| `updated_at` | timestamptz | NOT NULL | `now()` | — |

#### Columns added to `organisations`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `continuation_notice_weeks` | integer | YES | `3` |
| `continuation_assumed_continuing` | boolean | YES | `true` |
| `continuation_reminder_days` | integer[] | YES | `'{7,14}'` |

---

### 1B. Relationship Graph

```
organisations (1)
  └──< term_continuation_runs (N)     [org_id → organisations.id]
         ├── current_term_id → terms.id
         ├── next_term_id    → terms.id
         └──< term_continuation_responses (N) [run_id → runs.id]
                ├── student_id  → students.id
                ├── guardian_id → guardians.id
                ├── term_adjustment_id → term_adjustments.id (optional)
                └── next_term_invoice_id → invoices.id (optional)
```

Key relationships:
- **Run → Org**: Many runs per org.
- **Run → Term pair**: Each run links a current and next term.
- **Response → Run**: Many responses per run (one per student).
- **Response → Student**: One response per student per run (UNIQUE index).
- **Response → Guardian**: One guardian (primary payer) per response.

---

### 1C. Indexes

#### `term_continuation_runs`

| Index Name | Columns | Type | Notes |
|---|---|---|---|
| `idx_tcr_org_status` | `(org_id, status)` | B-tree | Covers main listing query |
| `idx_tcr_next_term` | `(next_term_id)` | B-tree | FK lookup |
| `idx_tcr_unique_term_pair` | `(org_id, current_term_id, next_term_id)` | B-tree UNIQUE | Prevents duplicate runs |

#### `term_continuation_responses`

| Index Name | Columns | Type | Notes |
|---|---|---|---|
| `idx_tcr_response_unique` | `(run_id, student_id)` | B-tree UNIQUE | One response per student per run |
| `idx_tcr_response_run_status` | `(run_id, response)` | B-tree | Filter responses by status |
| `idx_tcr_response_guardian` | `(guardian_id, response) WHERE response='pending'` | Partial B-tree | Fast pending-for-guardian lookup |
| `idx_tcr_response_student` | `(student_id)` | B-tree | FK lookup |
| `idx_tcr_response_token` | `(response_token)` | B-tree | Token-based lookup for email links |

**Assessment:** Index coverage is solid. The `response_token` column has both a UNIQUE constraint (from `text UNIQUE NOT NULL`) and an explicit index — the UNIQUE constraint already creates an implicit unique index, so `idx_tcr_response_token` is **redundant** but harmless. Missing: no index on `org_id` alone for responses table, but `org_id` is always combined with `run_id` in queries so this is acceptable.

---

### 1D. RLS Policies

#### `term_continuation_runs`

| Policy | Operation | Condition |
|---|---|---|
| "Org members can view continuation runs" | SELECT | `is_org_member(auth.uid(), org_id)` |
| "Org admins can create continuation runs" | INSERT | `is_org_admin(auth.uid(), org_id)` |
| "Org admins can update continuation runs" | UPDATE | `is_org_admin(auth.uid(), org_id)` |
| "Org admins can delete continuation runs" | DELETE | `is_org_admin(auth.uid(), org_id)` |

**Observations:**
- `org_id` is enforced on every policy. Good.
- Teachers (who are org members) CAN see continuation runs (SELECT). This is reasonable — they may need visibility into which students are continuing.
- Parents are NOT org members, so they cannot see runs directly. They access data via the response table. Correct.

#### `term_continuation_responses`

| Policy | Operation | Condition |
|---|---|---|
| "Org members can view continuation responses" | SELECT | `is_org_member(auth.uid(), org_id)` |
| "Org admins can manage continuation responses" | ALL | `is_org_admin(auth.uid(), org_id)` |
| "Parents can view their own continuation responses" | SELECT | `guardian_id IN (SELECT id FROM guardians WHERE user_id = auth.uid())` |
| "Parents can update their own continuation response" | UPDATE | USING: `guardian_id IN (...)` + WITH CHECK: same + `response IN ('continuing', 'withdrawing')` |

### [1D.1] MEDIUM — Parent RLS policy does not scope by org_id
**File:** `supabase/migrations/20260228100000_term_continuation.sql:107-117`
**Issue:** The parent SELECT and UPDATE policies filter only on `guardian_id IN (SELECT id FROM guardians WHERE user_id = auth.uid())` but do NOT include `org_id` in the WHERE clause. If a parent is a guardian in multiple organisations, they could see/update responses across all orgs.
**Trace:** Lines 107-117 — no `AND org_id = ...` in the parent policies. The guardians subquery itself doesn't filter by org either.
**Impact:** A parent guardian in Org A could see responses from Org B if they're a guardian in both. Low probability in practice but violates principle of least privilege.
**Fix:** Add `AND org_id IN (SELECT org_id FROM guardians WHERE user_id = auth.uid())` or scope the guardian subquery by org. However, since a parent needs to see responses across orgs they belong to, this may be intentional. Clarify intent and at minimum document the behaviour.

### [1D.2] LOW — Teacher can see all continuation responses
**File:** `supabase/migrations/20260228100000_term_continuation.sql:99-101`
**Issue:** Any org member (including teachers) can see ALL continuation responses, including guardian names, emails, withdrawal reasons, and financial details. This is sensitive data.
**Trace:** Line 99-101 — `is_org_member` policy on SELECT for responses.
**Impact:** A teacher could see which families are withdrawing and why, including financial reasons. This may be intentional for small music schools but could violate privacy expectations.
**Fix:** Consider whether teachers need response-level visibility, or if they only need to know which of their own students are continuing. Could restrict to `is_org_admin` or add a teacher-specific policy scoped to their students.

### [1D.3] INFO — Admin "FOR ALL" policy overlaps with member SELECT
**File:** `supabase/migrations/20260228100000_term_continuation.sql:103-105`
**Issue:** The `FOR ALL` admin policy overlaps with the org-member SELECT policy. Not a bug (PostgreSQL RLS is permissive by default — any matching policy grants access), but redundant for SELECT.
**Trace:** Admin already satisfies `is_org_member`, so the member SELECT policy grants them access too.
**Impact:** None — cosmetic.
**Fix:** No action needed.

---

### 1E. FK Cascade Behaviour

#### Student deleted mid-continuation
- `term_continuation_responses.student_id → students(id) ON DELETE CASCADE`
- **Effect:** Response row is deleted. If the run is in progress, the summary becomes stale because `recalcSummary` reads from responses. The student disappears from the run without any explicit "withdrawn" record.
- **Severity:** MEDIUM — silent data loss. The admin loses visibility into what happened to that student's continuation response.

#### Guardian deleted mid-continuation
- `term_continuation_responses.guardian_id → guardians(id) ON DELETE CASCADE`
- **Effect:** Same as student deletion — response row vanishes silently.
- **Severity:** MEDIUM — if the guardian is soft-deleted (has `deleted_at`), the cascade doesn't fire. But a hard delete would remove the response.

#### Term deleted after run created
- Original migration: `term_continuation_runs.current_term_id → terms(id)` with **NO CASCADE** (default NO ACTION).
- Migration 20260303182000 changed both FKs to `ON DELETE CASCADE`.
- **Effect:** Deleting a term now cascades and deletes all continuation runs referencing it, which cascades further and deletes all responses.
- **Severity:** HIGH — deleting a term (perhaps by mistake) silently wipes all continuation data for any run involving that term. This is destructive.

### [1E.1] HIGH — Term deletion cascades destroy continuation history
**File:** `supabase/migrations/20260303182000_term_continuation_fk_cascade.sql:4-12`
**Issue:** Both `current_term_id` and `next_term_id` FKs now use `ON DELETE CASCADE`. Deleting a term destroys all continuation runs and responses that reference it.
**Trace:** Migration explicitly changes both FKs to CASCADE.
**Impact:** Accidental term deletion permanently destroys audit trail of which students continued/withdrew. No soft-delete protection.
**Fix:** Use `ON DELETE RESTRICT` instead — prevent term deletion if continuation runs reference it. Or add a soft-delete mechanism for terms. CASCADE was added to fix FK violation errors, but RESTRICT with proper UX ("Cannot delete this term — it's used in a continuation run") is safer.

### [1E.2] MEDIUM — Student/guardian hard-delete silently removes responses
**File:** `supabase/migrations/20260228100000_term_continuation.sql:60-61`
**Issue:** CASCADE on student_id and guardian_id means hard-deleting a student or guardian removes their continuation response with no audit trail.
**Trace:** Lines 60-61 — both use ON DELETE CASCADE.
**Impact:** If app uses soft-delete for students/guardians (likely, given `deleted_at` check in guardian query), this is low risk. But if a hard delete ever occurs, data is lost.
**Fix:** Verify that the application NEVER hard-deletes students or guardians. If hard-delete is possible, switch to `ON DELETE SET NULL` or `RESTRICT`.

---

### 1F. Status Enums

#### Run status (CHECK constraint):
```sql
CHECK (status IN ('draft', 'sent', 'reminding', 'deadline_passed', 'completed'))
```
- Enforced at DB level via CHECK constraint. Good.
- Matches TypeScript type `ContinuationRunStatus` in `useTermContinuation.ts:12-17`.

#### Response status (CHECK constraint):
```sql
CHECK (response IN ('pending', 'continuing', 'withdrawing', 'assumed_continuing', 'no_response'))
```
- Enforced at DB level via CHECK constraint. Good.
- Matches TypeScript type `ContinuationResponseType` in `useTermContinuation.ts:19-24`.

**No enum type used** — inline CHECK constraints. This is acceptable for a small set of values but means the values are duplicated in SQL and TypeScript. Any change requires updating both.

---

### 1G. Database Triggers and Functions

1. **`set_tcr_updated_at`** — BEFORE UPDATE trigger on `term_continuation_runs`, calls `update_updated_at_column()` (shared utility function).
2. **`set_tcr_response_updated_at`** — BEFORE UPDATE trigger on `term_continuation_responses`, calls `update_updated_at_column()`.

No other triggers or database functions specific to continuation.

**Realtime** (migration 20260303191000):
- `term_continuation_responses` and `leads` tables added to `supabase_realtime` publication.
- This enables Supabase Realtime subscriptions for live updates on responses.

### [1G.1] LOW — No trigger to auto-recalculate run summary
**File:** `supabase/migrations/20260228100000_term_continuation.sql`
**Issue:** The `summary` jsonb field on `term_continuation_runs` is recalculated manually by edge functions (`recalcSummary`). There is no database trigger to keep it in sync. If a response is updated via direct SQL or RLS-bypassing admin action, the summary becomes stale.
**Trace:** `recalcSummary` is called explicitly in `create-continuation-run/index.ts:546` and `continuation-respond/index.ts:234,363`. The `useRespondToContinuation` hook at `useTermContinuation.ts:467-478` does a direct DB update without recalculating summary.
**Impact:** Admin manual overrides via the `useRespondToContinuation` hook don't update the run summary. The dashboard could show incorrect counts.
**Fix:** Either add a DB trigger on `term_continuation_responses` INSERT/UPDATE/DELETE that recalculates the parent run's summary, or call `recalcSummary` from the admin override mutation.

---

## SECTION 2: RUN CREATION

### 2A. Edge Function Parameters and Authorization

**Parameters accepted** (`ContinuationRunRequest`):
```typescript
{
  action: "create" | "send" | "send_reminders" | "process_deadline";
  org_id: string;
  current_term_id?: string;   // create
  next_term_id?: string;       // create
  notice_deadline?: string;    // create
  assumed_continuing?: boolean; // create
  reminder_schedule?: number[]; // create
  run_id?: string;             // send / send_reminders / process_deadline
}
```

**Authorization flow** (`create-continuation-run/index.ts:144-193`):
1. Requires `Authorization: Bearer <jwt>` header (line 146).
2. Validates JWT via `userClient.auth.getUser()` (line 158-162).
3. Rate-limits by user ID (line 169-175).
4. Checks `org_memberships` for `role IN ('owner', 'admin')` with `status = 'active'` (line 178-185).

**Org_id verification:** The edge function trusts the `org_id` from the request body but validates membership. The `adminClient` (service role) is used for all DB operations, bypassing RLS. The membership check ensures the user is admin/owner of the specified org.

### [2A.1] LOW — org_id not validated against terms
**File:** `supabase/functions/create-continuation-run/index.ts:247-263`
**Issue:** Terms are queried with `.eq("org_id", orgId)` (lines 251, 258), so cross-org term injection is prevented. Good.
**Trace:** Both term queries include org_id filter.
**Impact:** None — properly secured.
**Fix:** N/A.

---

### 2B. Student Inclusion Criteria

**Primary path** (`handleCreate`, line 291-312):
- Queries `lesson_participants` joined with `lessons` and `recurrence_rules`.
- Filters: `org_id = orgId`, `recurrence_id IS NOT NULL`, `status != 'cancelled'`, `start_at` within current term date range.
- Further filtered to `students.status = 'active'` and `deleted_at IS NULL` (line 358-360).

**Inclusion:** Only students who:
1. Have at least one recurring lesson (has a `recurrence_id`) in the current term.
2. Are `status = 'active'` and not soft-deleted.
3. Have a primary payer guardian linked via `student_guardians.is_primary_payer = true`.

### [2B.1] MEDIUM — Student added mid-term with lessons may be included
**File:** `supabase/functions/create-continuation-run/index.ts:291-312`
**Issue:** Any student with a recurring lesson in the current term date range is included. A student who joins mid-term (even one lesson before the run is created) will be included. This may or may not be desired.
**Trace:** Query filters by `start_at` within term dates — no check on when the student enrolled.
**Impact:** New students who just started might get a continuation notice for their first partial term. Low severity — probably desired behaviour.
**Fix:** Document this as expected behaviour. If not desired, add a minimum lesson count filter.

### [2B.2] LOW — Closure dates only filter "applies_to_all_locations"
**File:** `supabase/functions/create-continuation-run/index.ts:414-426`
**Issue:** Location-specific closure dates are fetched but only `applies_to_all_locations = true` dates are used. If a student's lesson is at a specific location that has a closure, the lesson count for next term will be overstated.
**Trace:** Line 423 — `if (cd.applies_to_all_locations)` filters out location-specific closures.
**Impact:** Fee estimates could be slightly too high for students at locations with specific closures.
**Fix:** Cross-reference lesson location with closure dates. Requires knowing which location each recurrence is at.

---

### 2C. Duplicate Run Prevention

**Database level:** Unique index `idx_tcr_unique_term_pair` on `(org_id, current_term_id, next_term_id)`.

**Application level** (`create-continuation-run/index.ts:274-288`):
- Checks for existing non-completed runs for the same term pair.
- Returns 409 Conflict if found.

### [2C.1] LOW — Race condition on double-click
**File:** `supabase/functions/create-continuation-run/index.ts:274-288`
**Issue:** The check-then-insert pattern has a TOCTOU race condition. Two simultaneous requests could both pass the check and attempt to insert. However, the UNIQUE index `idx_tcr_unique_term_pair` would catch the second insert and throw an error.
**Trace:** Lines 274-288 check, then line 429-443 inserts. No transaction wrapping both.
**Impact:** The second request would get an unhandled DB unique violation error (caught by the generic catch at line 217, returning "An internal error occurred"). The user would see a generic error but no duplicate would be created.
**Fix:** The unique index protects data integrity. Could improve UX by catching the unique violation error specifically and returning a friendlier message. Also, the frontend disables the button during `createRun.isPending` (line 290-293 of wizard), providing client-side protection.

### [2C.2] INFO — Completed runs don't block new runs for same term pair
**File:** `supabase/functions/create-continuation-run/index.ts:280`
**Issue:** The duplicate check uses `.neq("status", "completed")`. A completed run does NOT block creating a new run for the same term pair. But the unique index on `(org_id, current_term_id, next_term_id)` would block it at the DB level.
**Trace:** Line 280 filters out completed runs, but the unique index doesn't consider status.
**Impact:** After a run completes, attempting to create another for the same term pair would fail with a DB unique violation (generic error). The app check passes but the DB rejects.
**Fix:** Either remove the completed filter from the app check (reject all duplicates) or make the unique index partial (`WHERE status != 'completed'`). The current state is a confusing mismatch.

---

### 2D. Lead Generation Per Student

#### Guardian linking:
- Queries `student_guardians` with `is_primary_payer = true` (line 372-373).
- Only ONE guardian per student is selected (the primary payer).
- If multiple guardians are primary payers, the first one returned by the query is used (Map.set overwrites).

#### Student with no guardian:

### [2D.1] MEDIUM — Student without primary payer guardian is silently skipped
**File:** `supabase/functions/create-continuation-run/index.ts:456-457`
**Issue:** Line 457: `if (!student || !guardian) continue;` — students without a primary payer guardian are silently skipped. No response row is created and no warning is surfaced to the admin.
**Trace:** The preview returned to the frontend simply omits these students. The admin sees a lower student count but no explanation.
**Impact:** Students without a primary payer guardian are invisible in the continuation process. They won't get a notice and won't be re-enrolled or withdrawn. The admin may not realize they're missing.
**Fix:** Track skipped students and return them in the response as a `skipped` array with reason. Show in the wizard preview UI.

#### Initial status:
- All leads start as `response: 'pending'` (line 520).

#### Current schedule:
- `lesson_summary` JSONB captures recurrence_id, day, time, teacher, instrument, duration, rate, and lesson count for next term.
- This is a snapshot at creation time — not a live reference.

---

### 2E. Notifications

#### Initial notification:
- Triggered by the `send` action (separate from `create`).
- Two-step process: wizard creates run (draft), then sends (draft → sent).
- Email sent via Resend API (`create-continuation-run/index.ts:1049-1063`).
- Grouped by guardian — one email per guardian with all their children listed.

#### Email failure handling:
- If Resend API fails, the response rows are NOT updated with `initial_sent_at`.
- The run status is still changed to `sent` (line 1109-1112), even if some/all emails failed.
- Failed sends are returned in the `failed` array (line 1114).

### [2E.1] MEDIUM — Run marked as "sent" even when all emails fail
**File:** `supabase/functions/create-continuation-run/index.ts:1108-1112`
**Issue:** The run status is unconditionally set to `sent` after the send loop, regardless of how many emails actually succeeded.
**Trace:** Line 1108-1112 — no check on `sentCount` vs total.
**Impact:** If all emails fail (e.g., Resend API is down), the run shows as "sent" but no one was notified. The admin sees the failure count in the result, but if they don't notice, the run appears active with no actual notifications.
**Fix:** Only transition to "sent" if at least one email succeeded. If all fail, keep as "draft" or add a new status like "send_failed".

### [2E.2] LOW — Email content hardcodes £ symbol
**File:** `supabase/functions/create-continuation-run/index.ts:987`
**Issue:** Line 987 uses `&pound;` HTML entity for currency symbol. This is hardcoded to British pounds.
**Trace:** `&pound;${(l.rate_minor * l.lessons_next_term / 100).toFixed(2)}`
**Impact:** Orgs using other currencies (USD, EUR, AUD) would see £ in their emails.
**Fix:** Use the org's `currency_code` to determine the currency symbol dynamically.

#### Response links:
- Token-based: `${FRONTEND_URL}/respond/continuation?token=${resp.response_token}&action=continuing` (line 995-996).
- Token is a 32-byte random hex string (64 chars) — cryptographically secure, unguessable.
- No explicit expiry on tokens — they work until the run status changes.

### [2E.3] LOW — Response tokens never expire
**File:** `supabase/migrations/20260228100000_term_continuation.sql:67`
**Issue:** `response_token` has no TTL or expiry timestamp. The token remains valid indefinitely as long as the response is "pending" and the run is in "sent"/"reminding" status.
**Trace:** Token lookup in `continuation-respond/index.ts:165-169` has no expiry check. Run status check (line 192-204) provides implicit expiry when the run moves to "deadline_passed".
**Impact:** Low — the run status check acts as an implicit expiry mechanism. After `process_deadline` is called, the run moves to "deadline_passed" and the token link returns an error.
**Fix:** Acceptable as-is given the implicit run-status guard. Could add an explicit `token_expires_at` column for defense-in-depth.

---

### 2F. Edge Cases

#### `next_term_id` doesn't exist yet:
- The wizard UI filters `nextTermOptions` to terms after the current term (line 107-109 of ContinuationRunWizard.tsx). If no next term exists, the dropdown is empty and the Preview button is disabled.
- The edge function validates both terms exist (line 261) and returns 404 if not.
- **Handled correctly.**

#### No active students:
- Edge function returns 400 with message "No active students with recurring lessons found in the current term" (line 347-351).
- **Handled correctly.** An empty run is never created.

#### Student added mid-term:
- See [2B.1] — included if they have a recurring lesson in the term date range.

#### Edge function timeout:
### [2F.1] MEDIUM — Sequential email sending with no batching
**File:** `supabase/functions/create-continuation-run/index.ts:962-1106`
**Issue:** Emails are sent sequentially in a for-loop, one per guardian. Each email requires a Resend API call (network round trip). For 100 students across 80 families, this could take 40-80 seconds. Supabase Edge Functions have a default timeout of 60 seconds (can be configured up to 150s).
**Trace:** Lines 962-1106 — `for (const [guardianId, guardianResponses] of byGuardian)` with `await fetch(...)` inside.
**Impact:** Large schools could hit the edge function timeout, resulting in partial sends with no clear record of which guardians were actually emailed.
**Fix:** Implement batch sending (Resend supports batch API), or use a queue-based approach where emails are enqueued and processed by a background worker. At minimum, catch timeout errors gracefully.

#### Atomicity:
### [2F.2] MEDIUM — Create action is not atomic
**File:** `supabase/functions/create-continuation-run/index.ts:429-546`
**Issue:** The run is inserted first (line 429-443), then response rows are bulk-inserted (line 538-543). If the response insert fails, the run exists with no responses. The summary would show 0 students.
**Trace:** Run insert at 429, response insert at 538 — separate operations, no transaction wrapping.
**Impact:** A partial failure leaves an orphaned run in "draft" status with no responses. Admin would need to delete it manually.
**Fix:** Wrap run creation and response insertion in a database transaction, or use a stored procedure. Alternatively, detect orphaned draft runs and clean them up.

### [2F.3] LOW — Fallback query path has code duplication
**File:** `supabase/functions/create-continuation-run/index.ts:574-861`
**Issue:** `handleCreateFallback` duplicates nearly all logic from `handleCreate` (300+ lines). If a bug is fixed in one path, the other may be missed.
**Trace:** Lines 574-861 mirror 229-571 with slightly different query patterns.
**Impact:** Maintenance burden. Bugs could be fixed in one path but not the other.
**Fix:** Extract shared logic into helper functions. The fallback exists because Supabase's nested join syntax can fail — consider whether the fallback is still needed and if so, share the business logic.

---

## SECTION 3: PARENT RESPONSE

### 3A. Response Options

**Options:** `continuing` or `withdrawing` only. No "modify" option.

**Confirming (`continuing`):**
- Only updates the response status to `continuing`. No lessons or invoices are created automatically at response time.
- Processing happens later via `useBulkProcessContinuation` (useTermContinuation.ts:497-691), which extends recurrence rules into the next term.

**Declining (`withdrawing`):**
- Updates response to `withdrawing` with optional `withdrawal_reason` and `withdrawal_notes`.
- No immediate action on lessons. Processing happens later via bulk processing, which calls `process-term-adjustment` edge function.

**Modifying:**
- Not supported. No ability to change day/time/teacher/frequency.
- If a parent wants to change their schedule, they must communicate outside the system.

### [3A.1] LOW — No "modify" response option
**File:** `supabase/functions/continuation-respond/index.ts:94`
**Issue:** Only "continuing" and "withdrawing" are valid responses. There's no way for a parent to say "I want to continue but change my day/time".
**Trace:** Line 94 — `if (!["continuing", "withdrawing"].includes(body.response))`.
**Impact:** Parents who want to modify their schedule must communicate separately. This is a common scenario (e.g., "We want to continue but move from Tuesday to Wednesday").
**Fix:** Consider adding a "continuing_with_changes" response option with a notes field, or handle this as a separate workflow.

---

### 3B. Authentication

#### Two flows:

1. **Token-based** (email link): No JWT needed. Token is looked up in DB. Uses service-role client.
2. **Portal-based** (authenticated parent): Requires JWT. Guardian ID resolved from `user_id`.

#### Token security:
- 32 random bytes = 256 bits of entropy. Cryptographically secure.
- Rate-limited by token value (line 159).
- Not forgeable.

#### Idempotency:

### [3B.1] INFO — Idempotent but non-reversible
**File:** `supabase/functions/continuation-respond/index.ts:179-189, 317-325`
**Issue:** Both flows check if `respRow.response !== "pending"` and return `already_responded` with the current response. This prevents double-submission. However, the parent cannot change their response after submitting.
**Trace:** Lines 179-189 (token flow) and 317-325 (portal flow) — return current response if not pending.
**Impact:** A parent who accidentally clicks "Continue" cannot switch to "Withdraw" (or vice versa) through the self-service portal. They must contact the admin.
**Fix:** This is likely intentional to prevent flip-flopping. Document it clearly in the UI. The admin override (ContinuationResponseDetail.tsx:217-252) allows admins to change responses.

#### Deadline enforcement:

### [3B.2] MEDIUM — No server-side deadline enforcement for responses
**File:** `supabase/functions/continuation-respond/index.ts:192-204, 329-341`
**Issue:** The edge function checks that the run status is `sent` or `reminding` but does NOT check if the current date is past the `notice_deadline`. A parent could respond after the deadline if the admin hasn't yet clicked "Process Deadline".
**Trace:** Lines 192-204 (token flow) and 329-341 (portal flow) — only check run.status, not date.
**Impact:** The deadline is advisory until the admin manually processes it. If the admin is slow to process, parents can respond late. This might be intentional (graceful deadline) or a gap.
**Fix:** Add a date check: `if (new Date() > new Date(run.notice_deadline))` return "deadline has passed". Or document that the deadline is soft until the admin processes it.

---

### 3C. Status Transitions

#### Response status transitions:

```
                              ┌─────── continuing
                              │
 pending ─── (parent responds) ├─────── withdrawing
                              │
                              │ (admin overrides)
                              ├─────── continuing
                              └─────── withdrawing

 pending ─── (deadline processed, assumed_continuing=true)  → assumed_continuing
 pending ─── (deadline processed, assumed_continuing=false) → no_response
```

#### Run status transitions:

```
 draft ──(send)──→ sent ──(send_reminders)──→ reminding ──(process_deadline)──→ deadline_passed ──(bulk process)──→ completed
```

#### Can confirmed revert?

### [3C.1] MEDIUM — Admin can override any pending response but not non-pending
**File:** `src/components/continuation/ContinuationResponseDetail.tsx:217`
**Issue:** The admin override UI only shows when `response.response === 'pending'` (line 217). Once a parent has responded (continuing/withdrawing), the admin cannot override via the detail panel.
**Trace:** Line 217 — conditional render of admin override section.
**Impact:** If a parent accidentally responds, the admin has no UI to fix it. They'd need to directly update the DB.
**Fix:** Allow admin override for all statuses, not just pending. Add appropriate warnings ("This parent already responded — are you sure?").

### [3C.2] INFO — useRespondToContinuation allows any status transition
**File:** `src/hooks/useTermContinuation.ts:467-478`
**Issue:** The `useRespondToContinuation` hook (used for admin overrides) sends a direct DB update with no status transition validation. The RLS WITH CHECK constraint limits parents to `continuing`/`withdrawing`, but admin uses RLS-level `is_org_admin` FOR ALL policy which has no status restriction.
**Trace:** Lines 467-478 — `supabase.from('term_continuation_responses').update(...)` with no CHECK on valid transitions.
**Impact:** Admin could set response to `assumed_continuing` or `no_response` manually, bypassing intended flow. Low risk since only admins can do this.
**Fix:** Add WITH CHECK constraint on admin policy to limit response values, or validate in the mutation.

#### What triggers "expired"?
- There is no "expired" status. The closest is `deadline_passed` on the run.
- `process_deadline` action must be manually triggered by admin (no cron).
- When triggered, pending responses become `assumed_continuing` or `no_response` depending on the `assumed_continuing` flag.

### [3C.3] MEDIUM — No automatic deadline processing (no cron)
**File:** `supabase/functions/create-continuation-run/index.ts:1293-1366`
**Issue:** The `process_deadline` action must be manually triggered by the admin. There is no cron job or scheduled function to auto-process when the deadline date passes.
**Trace:** `handleProcessDeadline` is only invoked via the edge function with `action: 'process_deadline'`.
**Impact:** If the admin forgets to process the deadline, the run stays in "sent"/"reminding" status indefinitely. Parents can continue responding past the deadline. The system relies entirely on the admin remembering to click the button.
**Fix:** Add a Supabase pg_cron job or Edge Function scheduled task that runs daily and auto-processes any runs past their deadline.

---

### 3D. Portal View

#### Parent sees previous terms' runs?
- `useParentContinuationPending` (useTermContinuation.ts:228-271) filters by `response = 'pending'` and then further filters to runs where `status IN ['sent', 'reminding']`.
- Parents only see pending responses for active runs. They do NOT see historical runs or past responses.
- **No history view** for parents.

#### Sees other parents' responses?
- RLS policy filters by `guardian_id IN (SELECT id FROM guardians WHERE user_id = auth.uid())`.
- A parent can only see their own guardian's responses.
- **Properly isolated.**

#### Filtered by guardian_id?
- Yes, via the guardian lookup in `useParentContinuationPending` (line 238-244) and in the edge function's portal flow (line 283-298).

#### Multiple children — one response per child?
- Yes. The unique index `idx_tcr_response_unique` on `(run_id, student_id)` ensures one response per student per run.
- In the portal UI (`PortalContinuationList`), each pending response is rendered as a separate card.
- A parent with 3 children sees 3 cards and responds to each independently.

### [3D.1] LOW — Token flow doesn't show lesson details
**File:** `src/pages/portal/PortalContinuation.tsx:202-237`
**Issue:** The `TokenResponse` component shows generic "Please confirm whether your child will be continuing music lessons next term" with no student name, lesson details, or fee information. The email has all these details, but the landing page doesn't.
**Trace:** Lines 202-237 — the TokenResponse component doesn't fetch any data about the response. It just shows Continue/Withdraw buttons.
**Impact:** A parent clicking the email link sees a generic page. If they have multiple children, they don't know which child this link is for without looking back at the email.
**Fix:** On the token landing page, fetch the response details (student name, lessons, fees) before showing the form. The `continuation-respond` edge function could add a "lookup" action, or the token response could be fetched read-only first.

### [3D.2] LOW — Shared withdrawal state across children in portal
**File:** `src/pages/portal/PortalContinuation.tsx:249-251`
**Issue:** `withdrawalReason` and `withdrawalNotes` state is shared across all children (single `useState` at component level). If a parent is withdrawing Child A and then opens the withdraw form for Child B, the reason/notes from Child A are pre-filled.
**Trace:** Lines 249-251 — single state for withdrawal form, line 293 resets after submit.
**Impact:** Minor UX annoyance. If the parent submits for Child A then opens for Child B, the state IS reset at line 293. But if they open B without submitting A first, the old values carry over.
**Fix:** Move withdrawal state into a per-student map or reset when `withdrawingStudentId` changes.

---

## FINDINGS SUMMARY

| ID | Severity | Title |
|---|---|---|
| 1D.1 | MEDIUM | Parent RLS policy does not scope by org_id |
| 1D.2 | LOW | Teacher can see all continuation responses |
| 1E.1 | HIGH | Term deletion cascades destroy continuation history |
| 1E.2 | MEDIUM | Student/guardian hard-delete silently removes responses |
| 1G.1 | LOW | No trigger to auto-recalculate run summary |
| 2B.1 | MEDIUM | Student added mid-term with lessons may be included |
| 2B.2 | LOW | Closure dates only filter "applies_to_all_locations" |
| 2C.1 | LOW | Race condition on double-click (mitigated by unique index) |
| 2C.2 | INFO | Completed runs block new runs due to unique index mismatch |
| 2D.1 | MEDIUM | Student without primary payer guardian is silently skipped |
| 2E.1 | MEDIUM | Run marked as "sent" even when all emails fail |
| 2E.2 | LOW | Email content hardcodes £ symbol |
| 2E.3 | LOW | Response tokens never expire |
| 2F.1 | MEDIUM | Sequential email sending with no batching |
| 2F.2 | MEDIUM | Create action is not atomic |
| 2F.3 | LOW | Fallback query path has code duplication |
| 3A.1 | LOW | No "modify" response option |
| 3B.1 | INFO | Idempotent but non-reversible responses |
| 3B.2 | MEDIUM | No server-side deadline enforcement for responses |
| 3C.1 | MEDIUM | Admin can only override pending responses via UI |
| 3C.2 | INFO | useRespondToContinuation allows any status transition |
| 3C.3 | MEDIUM | No automatic deadline processing (no cron) |
| 3D.1 | LOW | Token flow doesn't show lesson details |
| 3D.2 | LOW | Shared withdrawal state across children in portal |

**Counts:** 1 HIGH, 9 MEDIUM, 10 LOW, 4 INFO = 24 total findings

---

## FEATURE COMPLETENESS RATING

### NEEDS-WORK

**Rationale:**

The Term Continuation system has a solid foundation — the data model is well-structured with appropriate indexes and CHECK constraints, the two-table design (runs + responses) cleanly separates concerns, and the multi-action edge function covers the full lifecycle (create → send → remind → process deadline).

However, several issues prevent a PRODUCTION-READY rating:

1. **The HIGH-severity cascade issue (1E.1)** means a single term deletion could wipe all continuation history. This is a data safety risk that must be addressed before production use.

2. **No automatic deadline processing (3C.3)** means the system relies entirely on admin diligence. A forgotten deadline leaves the system in limbo.

3. **Silent skipping of students without guardians (2D.1)** and **run marked "sent" when emails fail (2E.1)** create situations where the admin may not realize something is wrong.

4. **Summary staleness (1G.1)** when admins override responses means dashboard numbers can be wrong.

5. **Sequential email sending (2F.1)** will hit timeout limits for larger schools.

The core workflow works for small-to-medium music schools (< 50 students), but the system needs the HIGH fix and several MEDIUM fixes before it's reliable at scale or in hands-off operation.
