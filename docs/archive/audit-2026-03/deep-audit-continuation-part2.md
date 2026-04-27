# Deep Audit — Continuation Admin & Make-Up Credits

**Auditor:** Claude
**Date:** 2026-03-15
**Scope:** Sections 4–6 (Continuation Admin View, Make-Up Credits Data Model, Credit Lifecycle)
**Method:** Full source read of every file listed below; cross-referenced migrations chronologically.

---

## Files Audited

### Section 4 — Continuation Admin View
- `src/pages/Continuation.tsx` (514 lines)
- `src/components/dashboard/ContinuationWidget.tsx` (91 lines)
- `src/components/settings/ContinuationSettingsTab.tsx` (192 lines)
- `src/hooks/useTermContinuation.ts` (734 lines)
- `src/pages/Dashboard.tsx` (relevant sections)

### Section 5 — Make-Up Credits Data Model
- `supabase/migrations/20260124020340_*.sql` — make_up_credits table creation
- `supabase/migrations/20260124114407_*.sql` — credit_applied_minor on invoices
- `supabase/migrations/20260222163838_*.sql` — absence_reason enum, make_up_policies
- `supabase/migrations/20260222164345_*.sql` — make_up_waitlist table
- `supabase/migrations/20260222164414_*.sql` — releases_slot, on_slot_released
- `supabase/migrations/20260222164435_*.sql` — create_invoice_with_items (first version)
- `supabase/migrations/20260222164503_*.sql` — find_waitlist_matches
- `supabase/migrations/20260222164529_*.sql` — on_slot_released trigger
- `supabase/migrations/20260222171214_*.sql` — releases_slot on make_up_policies + policy-driven on_slot_released
- `supabase/migrations/20260222171458_*.sql` — notification_preferences: email_makeup_offers
- `supabase/migrations/20260222211008_*.sql` — auto_add_to_waitlist trigger
- `supabase/migrations/20260222211619_*.sql` — auto_issue_credit_on_absence trigger (v1)
- `supabase/migrations/20260222233455_*.sql` — redeem_make_up_credit function (v1)
- `supabase/migrations/20260222233741_*.sql` — find_waitlist_matches with capacity check
- `supabase/migrations/20260222233816_*.sql` — void_invoice restores credits
- `supabase/migrations/20260222234029_*.sql` — auto_issue_credit v2 (expiry_weeks)
- `supabase/migrations/20260222234154_*.sql` — confirm_makeup_booking function
- `supabase/migrations/20260222234306_*.sql` — audit logging on redeem/confirm/void
- `supabase/migrations/20260223004118_*.sql` — expired_at column, create_invoice_with_items v2
- `supabase/migrations/20260223004626_*.sql` — max_credits_per_term, credit_expiry_days
- `supabase/migrations/20260223004826_*.sql` — timezone-aware auto_issue + auto_waitlist
- `supabase/migrations/20260223005049_*.sql` — available_credits view
- `supabase/functions/credit-expiry/index.ts` (60 lines)
- `supabase/functions/credit-expiry-warning/index.ts` (209 lines)

### Section 6 — Credit Lifecycle
- `src/hooks/useMakeUpCredits.ts` (257 lines)
- `src/hooks/useAvailableCredits.ts` (101 lines)
- `src/hooks/useParentCredits.ts` (72 lines)
- `src/components/students/MakeUpCreditsPanel.tsx` (221 lines)
- `src/components/students/IssueCreditModal.tsx` (159 lines)
- `src/components/students/CreditBalanceBadge.tsx` (30 lines)

---

# SECTION 4: CONTINUATION — ADMIN VIEW

## 4A. Dashboard Widget

### [4A.1] LOW — Widget visible to all non-teacher/non-parent roles, including solo teachers
**File:** `src/pages/Dashboard.tsx:183-184` and `src/pages/Dashboard.tsx:282-283`
**Issue:** `ContinuationWidget` is rendered inside both `SoloTeacherDashboard` and `AcademyDashboard`. Solo teachers see continuation data even though they are the sole operator and continuation may not be relevant. The `TeacherDashboard` (academy teachers) correctly does NOT show the widget.
**Trace:** `Dashboard.tsx:108-116` routes to `TeacherDashboard` for academy teachers, `SoloTeacherDashboard` for solo, `AcademyDashboard` for admin. Both SoloTeacher and Academy include `<ContinuationWidget />`.
**Impact:** Minor UX confusion for solo teachers. Not a security issue — RLS filters by org_id.
**Fix:** Consider hiding widget for solo teachers if the org has no terms configured, or making it conditional on `isAcademyOrAgency`.

### [4A.2] INFO — Stats shown are derived from run.summary, not real-time database counts
**File:** `src/components/dashboard/ContinuationWidget.tsx:29-34`
**Issue:** Stats (confirmed, pending, withdrawing) come from `activeRun.summary` which is a JSONB column on `term_continuation_runs`. This is set when the run is created or processed but may become stale if a parent responds between refreshes. However, the `useContinuationResponses` hook has realtime subscriptions that invalidate queries on changes, and the run summary is also recalculated server-side during key operations.
**Trace:** Widget reads `summary` as a `Record<string, number>`. The summary field is updated by the edge function `create-continuation-run` during create/send/process_deadline actions.
**Impact:** If summary updates lag behind actual responses, dashboard counts may be temporarily inaccurate. Mitigated by realtime invalidation in `useTermContinuation.ts:173-197`.
**Fix:** Consider adding a `useContinuationRun` query in the widget for more frequent refresh, or rely on the realtime subscription (currently only active on the Continuation page, not the Dashboard).

### [4A.3] MEDIUM — No realtime subscription on Dashboard widget
**File:** `src/components/dashboard/ContinuationWidget.tsx:15`
**Issue:** The widget calls `useContinuationRuns()` which does NOT have a realtime subscription. Only `useContinuationResponses()` (used on the Continuation page) subscribes to postgres_changes. When a parent responds, the dashboard widget won't update until the next query refetch.
**Trace:** `useTermContinuation.ts:112-136` — `useContinuationRuns` has `staleTime: STALE_SEMI_STABLE` but no `useEffect` subscription. Compare with `useContinuationResponses` at line 173 which has a channel subscription.
**Impact:** Admin sees stale data on dashboard; must navigate to Continuation page or refresh.
**Fix:** Add a realtime channel subscription in `useContinuationRuns` or in the widget itself, invalidating on `term_continuation_runs` changes.

## 4B. Main Page (Continuation.tsx)

### [4B.1] INFO — Admin sees all leads with statuses — WORKING
**File:** `src/pages/Continuation.tsx:86-91`
**Issue:** None. The page fetches all responses for the selected run via `useContinuationResponses()`, joining student and guardian data. Responses include: pending, continuing, withdrawing, assumed_continuing, no_response.
**Trace:** Filter dropdown at line 370-383 allows filtering by response type. Table at 388-466 displays all fields.

### [4B.2] INFO — Filter by status — WORKING
**File:** `src/pages/Continuation.tsx:77,110-115,370-383`
**Issue:** None. `responseFilter` state drives both the Supabase query filter (server-side) AND a client-side search filter on student/guardian name.
**Trace:** Server filter via `useContinuationResponses(runToShow?.id, filter)` at line 87-91.

### [4B.3] MEDIUM — No manual status override capability
**File:** `src/pages/Continuation.tsx` (entire file)
**Issue:** There is NO UI to manually change a student's response (e.g., changing "pending" to "continuing" or "withdrawing"). The `useRespondToContinuation` hook exists in `useTermContinuation.ts:453-495` and supports `response_method: 'admin_manual'`, but the `ContinuationResponseDetail` component would need to expose this. Without seeing that component's full code, the hook is wired but the UI may not expose it.
**Trace:** `useRespondToContinuation` updates `term_continuation_responses` with `response_method: 'admin_manual'`. The Continuation page passes `selectedResponse` to `ContinuationResponseDetail` but the detail component is not fully audited here.
**Impact:** If the detail modal lacks override controls, admin cannot correct a parent's response or mark a non-responder manually.
**Fix:** Ensure `ContinuationResponseDetail` includes a dropdown or buttons to change response status.

### [4B.4] INFO — Re-send reminders to non-responders — WORKING
**File:** `src/pages/Continuation.tsx:197-210`
**Issue:** None. "Send Reminders" button is shown when run status is 'sent' or 'reminding'. Calls `useSendContinuationReminders` which invokes the `create-continuation-run` edge function with `action: 'send_reminders'`.
**Trace:** Button disabled while pending. Only visible for active runs.

### [4B.5] HIGH — No export data functionality
**File:** `src/pages/Continuation.tsx` (entire file)
**Issue:** There is NO export button or CSV download capability. An academy with 200+ students has no way to export continuation responses for board reporting, external communication, or backup.
**Trace:** Searched entire file — no export, download, or CSV functionality.
**Impact:** Admin must manually copy data or screenshot the table. No audit trail export.
**Fix:** Add CSV export button that serialises `filteredResponses` with student name, guardian, fee, response, date, reminder count.

### [4B.6] HIGH — No delete run capability
**File:** `src/pages/Continuation.tsx` (entire file), `src/hooks/useTermContinuation.ts` (entire file)
**Issue:** There is NO way to delete a continuation run. If a run is created by mistake (wrong term, wrong deadline), the only option is to let it complete or manually modify the database.
**Trace:** No delete mutation in `useTermContinuation.ts`. No delete button in UI.
**Impact:** Accidental runs with incorrect settings permanently pollute the system. Notifications may be sent to parents from a draft run before admin can correct it (though draft status exists, the "send" action is irreversible).
**Fix:** Add `useDeleteContinuationRun` mutation (only for 'draft' status) and a delete button on the run header.

### [4B.7] MEDIUM — No edit run after creation
**File:** `src/pages/Continuation.tsx`, `src/hooks/useTermContinuation.ts`
**Issue:** Once a run is created, there is NO way to edit the deadline, reminder schedule, or assumed_continuing flag. These are set during the wizard and become immutable.
**Trace:** No update mutation for run fields in `useTermContinuation.ts`.
**Impact:** Admin must create a new run if they made a mistake, but cannot delete the old one (4B.6).
**Fix:** Add edit capability for runs in 'draft' or 'sent' status (before deadline passes).

## 4C. Settings (ContinuationSettingsTab)

### [4C.1] MEDIUM — Settings use `(supabase as any)` — bypasses type safety
**File:** `src/components/settings/ContinuationSettingsTab.tsx:61-68,83-86`
**Issue:** The settings tab uses `(supabase as any)` to update `organisations` with fields `continuation_notice_weeks`, `continuation_assumed_continuing`, `continuation_reminder_days`. These columns may not exist in the generated Supabase types, indicating they were added without regenerating types.
**Trace:** `(currentOrg as any)?.continuation_notice_weeks` at lines 17-25 also casts to `any`.
**Impact:** No compile-time safety. If column names change or are removed, the code silently fails.
**Fix:** Regenerate Supabase types to include continuation settings columns.

### [4C.2] MEDIUM — Switch immediately saves without save button
**File:** `src/components/settings/ContinuationSettingsTab.tsx:79-95`
**Issue:** `handleAssumedContinuingChange` fires an immediate database update when the switch is toggled, bypassing the "Save Changes" button flow. The notice_weeks and reminder_days require clicking "Save Changes", but the assumed_continuing toggle does not. This creates an inconsistent save UX.
**Trace:** Switch `onCheckedChange` calls `handleAssumedContinuingChange` which directly updates the database. Meanwhile, `hasChanges` at line 43-47 tracks all three fields for the save button.
**Impact:** Toggling the switch saves immediately, but if the user then modifies notice_weeks and clicks "Save", it re-saves assumed_continuing again (harmless but inconsistent). If the switch save fails, it rolls back locally but the save button may show stale state.
**Fix:** Either make all fields save immediately (remove save button) or make the switch follow the same save pattern.

### [4C.3] INFO — Settings are per-org, not per-term
**File:** `src/components/settings/ContinuationSettingsTab.tsx:63-67`
**Issue:** Settings update the `organisations` table directly. They apply globally to the org and can be overridden per-run in the wizard. This is stated in the description: "These can be overridden when creating individual runs."
**Trace:** No per-term continuation settings table exists.
**Impact:** Acceptable design. Per-term overrides happen at run creation time.

### [4C.4] LOW — No custom message template setting
**File:** `src/components/settings/ContinuationSettingsTab.tsx` (entire file)
**Issue:** The settings tab has no field for custom notification message templates. The email content is presumably hardcoded in the `create-continuation-run` edge function.
**Trace:** Only notice_weeks, assumed_continuing, and reminder_days are configurable.
**Impact:** All academies receive the same email template. No branding or personalisation beyond org name.
**Fix:** Add a `continuation_email_template` text field or rich text editor in settings.

## 4D. Continuation → Lesson Creation

### [4D.1] CRITICAL — "Extend Confirmed" only extends recurrence end_date — does NOT create lessons
**File:** `src/hooks/useTermContinuation.ts:536-555`
**Issue:** When admin clicks "Extend Confirmed", the code iterates over `lesson_summary` items and for each `recurrence_id`, it extends the `recurrence_rules.end_date` to `next_term_end_date`. This does NOT create any new lesson rows. It assumes that a separate recurrence expansion mechanism (e.g., a trigger or cron job) will generate lessons from the recurrence rule.

**If no such expansion mechanism runs automatically, no lessons are created for the new term.**

**Trace:**
1. `handleBulkProcess('confirmed')` → `useBulkProcessContinuation` (line 497)
2. For `['continuing', 'assumed_continuing']` responses: iterates `lesson_summary` (line 539)
3. Checks `recurrence_rules.end_date < next_term_end_date` (line 550)
4. Updates `recurrence_rules.end_date = next_term_end_date` (line 552-554)
5. No call to any lesson generation function, edge function, or RPC

**Impact:** **Confirmed students may have NO lessons in the new term.** The calendar would be empty for the new term unless a recurrence expansion runs. If lessons are generated lazily (on calendar view), this might work, but if they need to exist for invoicing and attendance, this is a critical gap.
**Fix:** After extending recurrence end_date, call a `generate_recurring_lessons` function that creates lesson rows for the new term period. Alternatively, confirm that the calendar system lazily generates lessons from recurrence rules.

### [4D.2] HIGH — No teacher availability or location conflict check
**File:** `src/hooks/useTermContinuation.ts:536-555`
**Issue:** When extending recurrence into the new term, there is NO check for:
- Teacher availability in the new term (teacher may have changed availability)
- Location availability (room may be booked by another class)
- Time conflicts with other lessons the teacher already has
**Trace:** The code simply extends `end_date` on the recurrence rule. No conflict detection query.
**Impact:** Double-booked teachers, overbooked rooms. Admin discovers conflicts only when viewing the calendar.
**Fix:** Before extending, query for conflicts: check `lessons` table for overlapping `start_at`/`end_at` with same teacher_id or location_id in the new term date range.

### [4D.3] HIGH — No preview before lesson creation
**File:** `src/pages/Continuation.tsx:328-354`, `src/hooks/useTermContinuation.ts:497-691`
**Issue:** The "Extend Confirmed" and "Process Withdrawals" buttons execute immediately with no preview dialog. Admin cannot see which recurrences will be extended, what lessons will be created, or what conflicts exist before committing.
**Trace:** `handleBulkProcess('confirmed')` directly calls `bulkProcess.mutateAsync(...)`. No confirmation modal, no preview step.
**Impact:** Irreversible bulk operation with no undo. If recurrence extension creates unexpected lessons, admin must manually clean up.
**Fix:** Add a preview step showing: list of students being extended, their recurrences, any detected conflicts, and expected lesson count. Require confirmation.

### [4D.4] MEDIUM — Withdrawal processing silently swallows errors
**File:** `src/hooks/useTermContinuation.ts:564-607`
**Issue:** For each withdrawal, the code calls `process-term-adjustment` edge function twice (preview then confirm). If the preview fails (`prevError || previewResult?.error`), it silently `continue`s to the next lesson. If the confirm fails, it catches and continues. No error is surfaced to the admin.
**Trace:** `try { ... } catch { // Continue processing other lessons for this response }` at line 604.
**Impact:** A student marked as "withdrawing" may have some lessons cancelled and others not, with no indication to the admin. Partial withdrawals with no error reporting.
**Fix:** Collect errors per student/lesson and display a summary after processing (e.g., "3 withdrawals processed, 1 failed: [student name] — [error]").

### [4D.5] MEDIUM — Bulk process runs sequentially per student — no transaction boundary
**File:** `src/hooks/useTermContinuation.ts:536-624`
**Issue:** The bulk process loop iterates responses one at a time, making individual Supabase calls for each recurrence and each student. If the browser tab closes or network drops midway, some students will be processed and others not, with `is_processed` flags in an inconsistent state.
**Trace:** The loop at line 536 processes responses sequentially. Each response is marked `is_processed: true` individually at line 615-620. No transaction wrapper.
**Impact:** Partial processing state. Some students extended, others not. Run may be stuck in a partially-processed state that's hard to resume.
**Fix:** Move bulk processing to a server-side edge function that runs in a single transaction. The client should call one endpoint and wait for completion.

---

# SECTION 5: MAKE-UP CREDITS — DATA MODEL

## 5A. Tables

### Table: `make_up_credits`
**Migration:** `20260124020340_*.sql`

| Column | Type | Nullable | Default | FK |
|--------|------|----------|---------|-----|
| id | uuid | NOT NULL | gen_random_uuid() | PK |
| org_id | uuid | NOT NULL | — | organisations(id) CASCADE |
| student_id | uuid | NOT NULL | — | students(id) CASCADE |
| issued_for_lesson_id | uuid | YES | — | lessons(id) SET NULL |
| issued_at | timestamptz | NOT NULL | now() | — |
| expires_at | timestamptz | YES | — | — |
| expired_at | timestamptz | YES | — | — (added in 20260223004118) |
| redeemed_at | timestamptz | YES | — | — |
| redeemed_lesson_id | uuid | YES | — | lessons(id) SET NULL |
| applied_to_invoice_id | uuid | YES | — | — (NO FK! see 5A.1) |
| credit_value_minor | integer | NOT NULL | 0 | — |
| notes | text | YES | — | — |
| created_by | uuid | YES | — | auth.users(id) |
| created_at | timestamptz | NOT NULL | now() | — |
| updated_at | timestamptz | NOT NULL | now() | — |

### Table: `make_up_policies`
**Migration:** `20260222163838_*.sql`, updated `20260222171214_*.sql`

| Column | Type | Nullable | Default | FK |
|--------|------|----------|---------|-----|
| id | uuid | NOT NULL | gen_random_uuid() | PK |
| org_id | uuid | NOT NULL | — | organisations(id) CASCADE |
| absence_reason | absence_reason (enum) | NOT NULL | — | — |
| eligibility | text | NOT NULL | 'not_eligible' | CHECK: automatic, waitlist, admin_discretion, not_eligible |
| description | text | YES | — | — |
| releases_slot | boolean | NOT NULL | false | — (added in 20260222171214) |
| UNIQUE(org_id, absence_reason) |

### Table: `make_up_waitlist`
**Migration:** `20260222164345_*.sql`

| Column | Type | Nullable | Default | FK |
|--------|------|----------|---------|-----|
| id | uuid | NOT NULL | gen_random_uuid() | PK |
| org_id | uuid | NOT NULL | — | organisations(id) CASCADE |
| student_id | uuid | NOT NULL | — | students(id) CASCADE |
| guardian_id | uuid | YES | — | guardians(id) SET NULL |
| missed_lesson_id | uuid | NOT NULL | — | lessons(id) CASCADE |
| missed_lesson_date | date | NOT NULL | — | — |
| absence_reason | absence_reason | NOT NULL | — | — |
| attendance_record_id | uuid | YES | — | attendance_records(id) |
| teacher_id | uuid | YES | — | teachers(id) |
| lesson_duration_minutes | integer | NOT NULL | — | — |
| lesson_title | text | NOT NULL | — | — |
| location_id | uuid | YES | — | locations(id) |
| status | text | NOT NULL | 'waiting' | CHECK: waiting, matched, offered, accepted, declined, booked, expired, cancelled |
| matched_lesson_id | uuid | YES | — | lessons(id) |
| matched_at | timestamptz | YES | — | — |
| offered_at | timestamptz | YES | — | — |
| responded_at | timestamptz | YES | — | — |
| booked_lesson_id | uuid | YES | — | lessons(id) |
| credit_id | uuid | YES | — | make_up_credits(id) |
| preferred_days | text[] | YES | — | — |
| preferred_time_earliest | time | YES | — | — |
| preferred_time_latest | time | YES | — | — |
| notes | text | YES | — | — |
| expires_at | timestamptz | YES | — | — |
| created_at | timestamptz | YES | now() | — |
| updated_at | timestamptz | YES | now() | — |

### View: `available_credits`
**Migration:** `20260223005049_*.sql`

```sql
SELECT *,
  CASE
    WHEN redeemed_at IS NOT NULL THEN 'redeemed'
    WHEN expired_at IS NOT NULL THEN 'expired'
    WHEN expires_at IS NOT NULL AND expires_at < NOW() THEN 'expired'
    ELSE 'available'
  END AS credit_status
FROM make_up_credits;
```
- `security_invoker = on` — RLS follows base table policies.

### Org-level settings (on `organisations` table):
- `cancellation_notice_hours` integer NOT NULL DEFAULT 24
- `make_up_waitlist_expiry_weeks` integer DEFAULT 8
- `max_credits_per_term` integer DEFAULT NULL (uncapped by default)
- `credit_expiry_days` integer DEFAULT 90
- `continuation_notice_weeks`, `continuation_assumed_continuing`, `continuation_reminder_days`

## 5B. Relationship Graph

```
organisations ──┬── make_up_credits ──── lessons (issued_for, redeemed)
                │         │
                │         ├── students
                │         ├── auth.users (created_by)
                │         └── invoices (applied_to_invoice_id — NO FK!)
                │
                ├── make_up_policies ── absence_reason enum
                │
                ├── make_up_waitlist ──┬── students
                │                     ├── guardians
                │                     ├── lessons (missed, matched, booked)
                │                     ├── attendance_records
                │                     ├── teachers
                │                     ├── locations
                │                     └── make_up_credits (credit_id)
                │
                └── invoices ── credit_applied_minor
```

## 5C. Findings

### [5A.1] MEDIUM — applied_to_invoice_id has NO foreign key constraint
**File:** `supabase/migrations/20260124020340_*.sql` (original schema), `20260222234306_*.sql` (later updates)
**Issue:** `make_up_credits.applied_to_invoice_id` is used by `create_invoice_with_items` and `void_invoice` to track which invoice a credit was applied to. However, there is NO `REFERENCES invoices(id)` constraint on this column. It was likely added in a later migration via direct UPDATE rather than ALTER TABLE ADD COLUMN with FK.
**Trace:** The column is not in the original CREATE TABLE. It first appears being SET in `create_invoice_with_items` (20260222164435). Searching for `ALTER TABLE.*applied_to_invoice_id` yields no migration adding it with a FK.
**Impact:** Orphaned references possible if invoice is hard-deleted. `void_invoice` uses `WHERE applied_to_invoice_id = _invoice_id` which would fail silently if the ID is invalid.
**Fix:** `ALTER TABLE make_up_credits ADD CONSTRAINT fk_credits_invoice FOREIGN KEY (applied_to_invoice_id) REFERENCES invoices(id) ON DELETE SET NULL;`

### [5A.2] LOW — No `status` enum column on make_up_credits — status is derived
**File:** `supabase/migrations/20260223005049_*.sql`
**Issue:** The `available_credits` view computes `credit_status` from multiple nullable timestamp columns (`redeemed_at`, `expired_at`, `expires_at`). There is no `status` column or CHECK constraint on the base table. This means the same credit could theoretically have BOTH `redeemed_at` AND `expired_at` set.
**Trace:** `available_credits` view priority: redeemed_at → expired_at → expires_at < NOW() → 'available'. The `redeem_make_up_credit` function checks `expired_at IS NOT NULL` before allowing redemption, but there's no DB constraint preventing both being set.
**Impact:** If a cron job expires a credit at the exact moment it's being redeemed (before the `FOR UPDATE` lock is acquired), both timestamps could be set. The `FOR UPDATE` lock in `redeem_make_up_credit` mitigates this for the RPC path, but direct table updates (e.g., admin manually updating) could create invalid states.
**Fix:** Add a CHECK constraint: `CHECK (NOT (redeemed_at IS NOT NULL AND expired_at IS NOT NULL))`.

## 5D. RLS Policies

### make_up_credits

| Operation | Policy | Who |
|-----------|--------|-----|
| SELECT | "Users can view make_up_credits in their org" | Any active org member |
| INSERT | "Admins can insert make_up_credits in their org" | owner, admin, teacher |
| UPDATE | "Admins can update make_up_credits in their org" | owner, admin |
| DELETE | "Admins can delete make_up_credits in their org" | owner, admin |

### [5D.1] MEDIUM — Teachers can INSERT credits but cannot UPDATE or DELETE them
**File:** `supabase/migrations/20260124020340_*.sql:36-43`
**Issue:** The INSERT policy includes `role IN ('owner', 'admin', 'teacher')` but UPDATE and DELETE are `role IN ('owner', 'admin')` only. A teacher can issue a credit (via the UI's "Issue Credit" button) but cannot correct or delete it if they made a mistake (wrong amount, wrong student).
**Trace:** INSERT policy at line 37-44 vs UPDATE policy at line 46-54.
**Impact:** Teacher issues a £50 credit instead of £5, must ask admin to fix it.
**Fix:** Either remove teacher from INSERT policy (require admin to issue) or add teacher to UPDATE/DELETE with restrictions (e.g., only credits they created within 24 hours).

### [5D.2] MEDIUM — Parents can see ALL credits in their org via SELECT policy
**File:** `supabase/migrations/20260124020340_*.sql:26-34`
**Issue:** The SELECT policy checks `org_id IN (SELECT org_id FROM org_memberships WHERE user_id = auth.uid() AND status = 'active')`. Parents are org members with role 'parent'. This means a parent can see ALL make_up_credits for ALL students in the org, not just their own children's.
**Trace:** The RLS policy does not filter by `student_id` for parents. It relies on the client-side query to filter by guardian's linked students (e.g., `useParentCredits` at line 46-48 filters by student IDs). But a parent could use the Supabase client directly or modify the app to query all credits.
**Impact:** Privacy violation — Parent A can see credit details (values, lessons, notes) for Parent B's children.
**Fix:** Add a parent-specific SELECT policy: `USING (student_id IN (SELECT sg.student_id FROM student_guardians sg JOIN guardians g ON g.id = sg.guardian_id WHERE g.user_id = auth.uid()))` and restrict the general SELECT to staff roles only.

### make_up_policies

| Operation | Policy | Who |
|-----------|--------|-----|
| SELECT | "Org members can view make_up policies" | Any active org member |
| ALL | "Org admins can manage make_up policies" | `is_org_admin()` |

### [5D.3] LOW — Parents can view make_up_policies
**File:** `supabase/migrations/20260222163838_*.sql:34-38`
**Issue:** Any org member (including parents) can view the absence reason → eligibility mapping. This reveals the academy's internal policy on which absences qualify for credits.
**Trace:** SELECT policy uses `org_memberships` with no role filter.
**Impact:** Minor information disclosure. Parent could learn that "holiday" = not_eligible, potentially causing complaints. Low severity.

### make_up_waitlist

| Operation | Policy | Who |
|-----------|--------|-----|
| SELECT (staff) | "Org members can view waitlist" | Any active org member |
| ALL | "Org admins can manage waitlist" | `is_org_admin()` |
| SELECT (parent) | "Parents can view their children waitlist" | Guardian's own entries |

### [5D.4] MEDIUM — Waitlist SELECT also visible to ALL org members (same as credits)
**File:** `supabase/migrations/20260222164345_*.sql:42-43`
**Issue:** Same problem as 5D.2. Any org member can SELECT all waitlist entries for the org. A parent can see other students' waitlist entries, including their names, absence reasons, missed lessons, and preferred times.
**Trace:** "Org members can view waitlist" policy uses `org_memberships` without role filter.
**Impact:** Privacy violation — Parent can see other families' attendance and absence details.
**Fix:** Restrict to staff roles and rely on the parent-specific policy for parents.

## 5E. Status Enums & CHECK Constraints

### make_up_credits — NO status column
- Status is derived from timestamps in the `available_credits` view
- Possible states: `available`, `redeemed`, `expired`
- No `voided` status exists (see 6E findings)

### make_up_waitlist — status column with CHECK
```sql
CHECK (status IN ('waiting','matched','offered','accepted','declined','booked','expired','cancelled'))
```
- 8 possible states with proper CHECK constraint
- State machine transitions enforced in application code (triggers and RPC functions), not at DB level

### make_up_policies — eligibility column with CHECK
```sql
CHECK (eligibility IN ('automatic', 'waitlist', 'admin_discretion', 'not_eligible'))
```

## 5F. Expiry Mechanism

### [5F.1] HIGH — Credit expiry cron has NO schedule defined anywhere
**File:** `supabase/functions/credit-expiry/index.ts`, all migration files
**Issue:** The `credit-expiry` edge function exists and works correctly (marks credits as expired where `expires_at < now()` and `redeemed_at IS NULL` and `expired_at IS NULL`). However, there is NO pg_cron schedule, NO Supabase cron configuration, and NO deployment manifest that schedules this function to run.
**Trace:** Searched all migrations for `credit-expir` or `credit_expir` cron schedules — none found. The `20260222155854` migration enables `pg_cron` but doesn't schedule this function. The function uses `validateCronAuth` suggesting it expects to be called by Supabase's cron scheduler, but no schedule is configured in code.
**Impact:** **Credits may NEVER expire.** The `expires_at` timestamp will pass but `expired_at` will never be set. The `available_credits` view will still mark them as expired (line 9: `WHEN expires_at IS NOT NULL AND expires_at < NOW() THEN 'expired'`), but the `expired_at` column will remain NULL. This creates a discrepancy between the view's status and the actual column values.
**Fix:** Add cron schedule via Supabase Dashboard or migration: schedule `credit-expiry` function to run daily (e.g., `0 2 * * *`).

### [5F.2] MEDIUM — Credit expiry warning is hardcoded to 3 days
**File:** `supabase/functions/credit-expiry-warning/index.ts:22`
**Issue:** The warning window is hardcoded: `const threeDaysFromNow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)`. This is not configurable per org.
**Trace:** Line 22. No org setting for warning days.
**Impact:** Academies cannot customize when parents receive expiry warnings. 3 days may be too short for booking a make-up lesson.
**Fix:** Add `credit_expiry_warning_days` to organisations table and read it per-org in the function.

### [5F.3] LOW — Credit expiry runs at UTC midnight, not org timezone
**File:** `supabase/functions/credit-expiry/index.ts:14`
**Issue:** `const now = new Date().toISOString()` — uses UTC. The auto-issue function (20260223004826) carefully sets `expires_at` at end-of-day in the academy's timezone, but the expiry cron compares against UTC `now()`. A credit set to expire at `2026-03-15 23:59:59 Europe/London` (= `2026-03-15 23:59:59 UTC` in winter, `2026-03-15 22:59:59 UTC` in summer) would be checked against UTC time.
**Trace:** Auto-issue sets expiry: `(_local_date + '23:59:59') AT TIME ZONE tz` which converts to UTC. The expiry function uses `.lt("expires_at", now)` where `now` is UTC. This actually works correctly because both are in UTC after timezone conversion.
**Impact:** Actually correct for the comparison, but the expiry function itself runs at a fixed UTC time (determined by cron schedule). Students in UTC+12 timezones could have credits expire "mid-day" from their perspective.
**Fix:** Minor. Consider documenting that cron should run at a time that covers most org timezones.

### [5F.4] INFO — Warning function deduplicates via message_log — GOOD
**File:** `supabase/functions/credit-expiry-warning/index.ts:54-61`
**Issue:** None. The function checks `message_log` for already-sent warnings with `message_type: 'credit_expiry_warning'` and `related_id: credit.id`, preventing duplicate warnings on repeated runs.

### [5F.5] INFO — Expiry function also expires linked waitlist entries — GOOD
**File:** `supabase/functions/credit-expiry/index.ts:39-53`
**Issue:** None. When credits are expired, the function also updates `make_up_waitlist` entries linked to those credits, setting `status = 'expired'` for entries in `waiting` status.

---

# SECTION 6: CREDIT LIFECYCLE

## 6A. Credit Creation

### [6A.1] INFO — Manual credit creation by admin — WORKING
**File:** `src/components/students/IssueCreditModal.tsx:58-74`, `src/hooks/useMakeUpCredits.ts:96-124`
**Issue:** None. Admin can issue a credit with arbitrary amount, expiry, and notes. The `createCredit` mutation inserts into `make_up_credits` with `created_by: user.id`.

### [6A.2] INFO — Auto credit on "teacher_cancelled" absence — WORKING
**File:** `supabase/migrations/20260222211619_*.sql` (v1), final version in `20260223004826_*.sql`
**Issue:** None. The `auto_issue_credit_on_absence` trigger fires on attendance_records INSERT/UPDATE. When `absence_reason_category` matches a policy with `eligibility = 'automatic'` (default: only `teacher_cancelled`), a credit is issued.

### [6A.3] MEDIUM — Auto credit value may be zero if no invoice item exists
**File:** `supabase/migrations/20260223004826_*.sql:86-90`
**Issue:** Credit value is derived from `invoice_items.unit_price_minor` for the lesson. If the lesson hasn't been invoiced yet (e.g., cancellation before billing run), the query returns NULL and `COALESCE` falls back to 0. The latest version (line 90) adds `IF COALESCE(_credit_value, 0) <= 0 THEN RETURN NEW; END IF;` — which means NO credit is issued if there's no invoice item.
**Trace:** This is intentional — no credit for un-invoiced lessons. But if billing is delayed and the teacher cancels, the student gets no credit even though they should.
**Impact:** Students may miss credits if billing hasn't occurred before the cancellation. The credit_cap_reached audit log is created, but there's no log for "no invoice item found, skipping credit".
**Fix:** Consider issuing a zero-value credit with a note "awaiting billing" or use the lesson's recurrence rate as a fallback value.

### [6A.4] INFO — Idempotency check present — GOOD
**File:** `supabase/migrations/20260223004826_*.sql:83-84`
**Issue:** None. `IF EXISTS (SELECT 1 FROM make_up_credits WHERE student_id = NEW.student_id AND issued_for_lesson_id = NEW.lesson_id) THEN RETURN NEW; END IF;` prevents duplicate credits for the same lesson.

### [6A.5] INFO — Ad-hoc credit without source lesson — SUPPORTED
**File:** `src/hooks/useMakeUpCredits.ts:38-44`, `src/components/students/IssueCreditModal.tsx:63`
**Issue:** None. `issued_for_lesson_id` is optional in `CreateCreditInput`. The modal passes `defaultLessonId` which may be undefined.

### [6A.6] INFO — Credit value is in pence (minor units) — CORRECT
**File:** `src/components/students/IssueCreditModal.tsx:59`
**Issue:** None. `Math.round(parseFloat(amount) * 100)` converts user input (pounds) to minor units (pence).

### [6A.7] LOW — Per-term credit cap uses calendar quarter, not org's actual term
**File:** `supabase/migrations/20260223004626_*.sql:46`
**Issue:** `_term_start := date_trunc('quarter', CURRENT_DATE)::date;` uses calendar quarter boundaries (Jan, Apr, Jul, Oct) to count credits "per term". Academies may have terms that don't align with calendar quarters (e.g., Sep-Dec, Jan-Apr, May-Jul).
**Trace:** `max_credits_per_term` setting name suggests it's per-academy-term, but the implementation uses calendar quarters.
**Impact:** A student could be capped or uncapped incorrectly at term boundaries that don't match the academy's schedule.
**Fix:** Look up the student's current term from the `terms` table and use its `start_date` instead of `date_trunc('quarter')`.

## 6B. Balance Calculation

### [6B.1] INFO — Balance is real-time calculated, not pre-computed
**File:** `src/hooks/useMakeUpCredits.ts:86-93`
**Issue:** `availableCredits` is filtered client-side from the full credits list: `!redeemed_at && !expired_at && !applied_to_invoice_id && (!expires_at || expires_at > now())`. `totalAvailableValue` is a `reduce()` sum.
**Trace:** No pre-computed `balance` column exists on any table. This matches the `available_credits` view logic on the server.
**Impact:** Correct but requires fetching ALL credits for a student to calculate balance. For students with many historical credits, this could be slow.

### [6B.2] INFO — Negative balance not possible
**File:** `src/hooks/useMakeUpCredits.ts:86-93`, `supabase/migrations/20260222233455_*.sql` (redeem function)
**Issue:** None. Credits are either available or not. Redemption is atomic via `redeem_make_up_credit` RPC which checks availability before marking as redeemed. The `create_invoice_with_items` function uses `GREATEST(0, subtotal + tax - credit_offset)` ensuring invoice total never goes negative.

### [6B.3] INFO — Race condition on credit redemption — MITIGATED
**File:** `supabase/migrations/20260223004118_*.sql:20-24`
**Issue:** The `redeem_make_up_credit` function uses `SELECT ... FOR UPDATE` to lock the credit row before checking availability and updating. This prevents two concurrent sessions from redeeming the same credit.
**Trace:** Line 20: `SELECT * INTO _credit FROM make_up_credits WHERE id = _credit_id AND org_id = _org_id FOR UPDATE;`. The second session will block until the first completes, then find `redeemed_at IS NOT NULL` and raise an exception.
**Impact:** Properly handled. No double-spend possible via the RPC path.

### [6B.4] MEDIUM — Race condition on invoice credit application — MITIGATED but fragile
**File:** `supabase/migrations/20260223004118_*.sql:91-98`
**Issue:** `create_invoice_with_items` also uses `FOR UPDATE` when locking credit rows for invoice application. This is correct. However, the credit SUM is calculated BEFORE the lock in the original version (20260222164435), which could allow a TOCTOU race.
**Trace:** In the final version (20260223004118, line 91-98), `SELECT COUNT(*), SUM(credit_value_minor) ... FOR UPDATE` locks AND sums atomically. This is correct.
**Impact:** Properly handled in the final version.

## 6C. Credit Usage — Redemption

### [6C.1] INFO — Two redemption paths exist
**File:** `supabase/migrations/20260222233455_*.sql`, `20260223004118_*.sql`
**Issue:** Credits can be redeemed via:
1. `redeem_make_up_credit` RPC — marks `redeemed_at` and `redeemed_lesson_id`. Used for make-up lesson bookings.
2. `create_invoice_with_items` RPC — marks `redeemed_at` and `applied_to_invoice_id`. Used for invoice credit application.
Both paths are atomic with `FOR UPDATE` locks.

### [6C.2] HIGH — No partial credit support
**File:** `supabase/migrations/20260223004118_*.sql:90-103,137-146`
**Issue:** When credits are applied to an invoice, the FULL credit value is deducted. If a £30 credit is applied to a £25 invoice, `_credit_offset` = £30 and `_total_minor = GREATEST(0, 25 + tax - 30) = 0`. The remaining £5 is lost — the credit is fully consumed (redeemed_at set) even though only £25 was needed.
**Trace:** Line 105: `_total_minor := GREATEST(0, _subtotal + _tax_minor - _credit_offset)`. If credit > total, total becomes 0 but the excess is not refunded or retained. Line 137-146: `UPDATE make_up_credits SET redeemed_at = NOW()` marks ALL applied credits as fully redeemed.
**Impact:** Students lose money when credit value exceeds invoice amount. A £100 credit on a £10 lesson results in £90 lost.
**Fix:** Either:
1. Split the credit: create a new credit row for the remainder (£5)
2. Partially redeem: add `amount_redeemed_minor` column and only consume what's needed
3. Warn admin when credit exceeds invoice and prevent application

### [6C.3] INFO — Multiple credits can be combined for one invoice — WORKING
**File:** `supabase/migrations/20260223004118_*.sql:90-103`
**Issue:** None. `_credit_ids uuid[]` parameter accepts an array. The SUM is calculated across all provided credit IDs.

### [6C.4] LOW — Redeemed credit notes overwritten
**File:** `supabase/migrations/20260222164435_*.sql:119`
**Issue:** When credits are applied to an invoice, `notes` is overwritten: `notes = 'Applied to invoice_id:' || _invoice_id`. The original note (e.g., "Auto-issued: teacher cancellation") is lost.
**Trace:** Later version (20260223004118, line 141) uses `notes = 'Applied to invoice ' || _invoice.invoice_number`. Same issue.
**Impact:** Historical context of why the credit was issued is destroyed.
**Fix:** Append instead of overwrite: `notes = COALESCE(notes, '') || ' | Applied to invoice ' || _invoice.invoice_number`.

## 6D. Credit Expiry

### [6D.1] INFO — Only "active" credits are expired — CORRECT
**File:** `supabase/functions/credit-expiry/index.ts:17-24`
**Issue:** None. The expiry function checks `.is("redeemed_at", null).is("expired_at", null)` — only un-redeemed and not-already-expired credits are processed.

### [6D.2] HIGH — Credit on waitlist (student waiting for match) still expires
**File:** `supabase/functions/credit-expiry/index.ts:39-53`
**Issue:** The expiry function expires credits and then expires linked waitlist entries. However, the waitlist entry links to the credit via `credit_id`. If a student is actively on the waitlist waiting for a make-up slot and their credit expires, BOTH the credit AND the waitlist entry are expired.
**Trace:** Lines 39-53: `UPDATE make_up_waitlist SET status = 'expired' WHERE credit_id IN (expired_credit_ids) AND status = 'waiting'`.
**Impact:** Students lose their place on the waitlist when their credit expires. They'd need to be re-issued a credit and re-added to the waitlist. This may be intentional policy, but there's no admin notification when this happens.
**Fix:** Consider either: (a) extending credit expiry while a student has an active waitlist entry, (b) notifying admin when a waitlisted credit is about to expire, or (c) documenting this as intentional policy.

### [6D.3] INFO — Atomic expiry — YES
**File:** `supabase/functions/credit-expiry/index.ts:17-24`
**Issue:** The UPDATE is a single statement affecting all qualifying rows atomically. The subsequent waitlist expiry is a separate statement but acceptable since waitlist expiry is a consequence, not a prerequisite.

## 6E. Credit Voiding

### [6E.1] HIGH — No credit voiding mechanism exists
**File:** All make_up_credits related files
**Issue:** There is NO `void` status, NO `voided_at` timestamp, and NO void function for credits. The only options are:
1. DELETE the credit (via `deleteCredit` mutation in `useMakeUpCredits.ts:150-168`) — this is a hard delete, destroying audit trail
2. Wait for expiry

**Trace:**
- No `voided_at` column in schema
- `MakeUpCreditsPanel.tsx:165-174` shows a trash icon that calls `deleteCredit` — a hard DELETE
- `getCreditStatus` at line 30-41 has no "voided" status
- No `void_credit` RPC function exists

**Impact:**
- Admin cannot void a credit without destroying it entirely
- No audit trail of voided credits
- If a credit was issued in error, the only option is deletion, which means reporting will be inaccurate (credit was never "issued")

**Fix:** Add `voided_at timestamptz`, `voided_by uuid`, `void_reason text` columns. Create a `void_credit` RPC function. Update the `available_credits` view to include 'voided' status. Replace the DELETE button with a "Void" action.

### [6E.2] MEDIUM — Deleting a credit with linked waitlist entry leaves orphan
**File:** `src/hooks/useMakeUpCredits.ts:150-168`
**Issue:** `deleteCredit` does a hard DELETE on `make_up_credits`. If the credit has a linked `make_up_waitlist` entry (via `credit_id` FK), the FK is a simple reference (no CASCADE). The waitlist entry will have a dangling `credit_id` pointing to a deleted row.
**Trace:** `make_up_waitlist.credit_id` references `make_up_credits(id)` — but the FK constraint doesn't specify ON DELETE behavior, so it defaults to RESTRICT. This means the DELETE will actually FAIL if there's a linked waitlist entry.
**Impact:** Admin cannot delete credits that have waitlist entries — the delete will throw a foreign key violation error. The UI doesn't handle this gracefully.
**Fix:** Either CASCADE the delete to cancel the waitlist entry, or prevent deletion of credits with active waitlist entries and show a clear error message.

### [6E.3] INFO — Un-void not applicable
Since voiding doesn't exist (6E.1), un-void is also not applicable. If void is added, un-void should also be considered.

---

# SUMMARY OF FINDINGS BY SEVERITY

## CRITICAL (1)
| ID | Title |
|----|-------|
| 4D.1 | "Extend Confirmed" only extends recurrence end_date — may not create actual lessons |

## HIGH (7)
| ID | Title |
|----|-------|
| 4B.5 | No export data functionality |
| 4B.6 | No delete run capability |
| 4D.2 | No teacher availability or location conflict check when extending |
| 4D.3 | No preview before bulk lesson creation/extension |
| 5F.1 | Credit expiry cron has NO schedule defined anywhere |
| 6C.2 | No partial credit support — excess credit value is lost |
| 6D.2 | Credit on waitlist still expires, losing student's place |
| 6E.1 | No credit voiding mechanism — only hard delete exists |

## MEDIUM (11)
| ID | Title |
|----|-------|
| 4A.3 | No realtime subscription on Dashboard widget |
| 4B.3 | No manual status override capability from admin UI |
| 4B.7 | No edit run after creation |
| 4C.1 | Settings use `(supabase as any)` — no type safety |
| 4C.2 | Switch immediately saves without save button (inconsistent UX) |
| 4D.4 | Withdrawal processing silently swallows errors |
| 4D.5 | Bulk process runs sequentially with no transaction boundary |
| 5A.1 | applied_to_invoice_id has NO foreign key constraint |
| 5D.1 | Teachers can INSERT credits but cannot UPDATE/DELETE |
| 5D.2 | Parents can see ALL credits in org via broad SELECT RLS |
| 5D.4 | Waitlist SELECT visible to ALL org members (privacy) |
| 5F.2 | Credit expiry warning hardcoded to 3 days |
| 6A.3 | Auto credit value may be zero if lesson not yet invoiced |
| 6B.4 | Race condition on invoice credit application (mitigated in final version) |
| 6C.4 | Redeemed credit notes overwritten — original context lost |
| 6E.2 | Deleting credit with linked waitlist fails silently |

## LOW (5)
| ID | Title |
|----|-------|
| 4A.1 | Widget visible to solo teachers |
| 4C.4 | No custom message template setting |
| 5A.2 | No status enum — status derived from timestamps (no constraint against invalid combos) |
| 5D.3 | Parents can view make_up_policies |
| 5F.3 | Expiry runs at UTC, not org timezone |
| 6A.7 | Per-term credit cap uses calendar quarter, not org's actual term |

## INFO (12)
| ID | Title |
|----|-------|
| 4A.2 | Stats from run.summary, not real-time counts |
| 4B.1 | Admin sees all leads with statuses — working |
| 4B.2 | Filter by status — working |
| 4B.4 | Re-send reminders — working |
| 4C.3 | Settings are per-org, not per-term (acceptable) |
| 5F.4 | Warning deduplicates via message_log — good |
| 5F.5 | Expiry also expires linked waitlist — good |
| 6A.4 | Idempotency check present — good |
| 6A.5 | Ad-hoc credit without source lesson — supported |
| 6A.6 | Credit value in pence — correct |
| 6B.1 | Balance is real-time, not cached |
| 6B.2 | Negative balance not possible |
| 6B.3 | Race condition on redemption — properly mitigated with FOR UPDATE |
| 6C.1 | Two redemption paths (lesson + invoice) — both atomic |
| 6C.3 | Multiple credits combined — working |
| 6D.1 | Only active credits expired — correct |
| 6D.3 | Atomic expiry — yes |
| 6E.3 | Un-void not applicable |
