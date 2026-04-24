# Recurring Billing — Design Document

**Status:** Draft v1 · 24 April 2026
**Author:** Jamie McKaye (with Claude Opus 4.7)
**Context:** Journey 9 Phase 0. The existing `recurring_invoice_templates` surface is architectural vaporware — UI promises scheduled invoicing; no scheduler, generator, or child schema exists. This doc designs the full subsystem before any build begins.

---

## 0. Principles

Before schema, the rules the system must obey:

1. **No silent failure.** If a template generates nothing or generates wrong data, operator sees it. Dashboard surface + audit_log + optional email.
2. **Idempotent.** A scheduler retry, a webhook retry, an operator "re-run today" must never double-invoice.
3. **Atomic per invoice.** A single student's invoice either fully generates or doesn't exist. Partial invoices (some items, missing others) must not persist.
4. **Transparent at source.** Every generated invoice has `generated_from_template_id` and `template_run_id` so operators can trace back: "which template run produced this invoice?"
5. **Reversible.** An operator who sees a bad batch can void all invoices from a single template run in one action.
6. **Respects existing invariants.** All generated invoices go through `create_invoice_with_items` (or an equivalent hardened path) — no bypassing credit eligibility, payment plan guards, RLS, audit logging. The generator is a caller, not a replacement.
7. **Delivered-mode must be rock-solid.** It's the common case for UK music academies (bill in arrears for lessons taught). Correctness here is non-negotiable.

---

## 1. Domain model

A **recurring invoice template** describes a billing pattern that runs on a schedule and produces invoices for a defined set of recipients. It is configured once and run repeatedly.

### Core concepts

- **Template**: top-level config. Name, frequency, billing mode, auto-send, next run date, active flag.
- **Template recipients**: a defined list of students the template bills for. Operator curates the list; not all-students-in-org. (Decision 3(b) locked.)
- **Template items**: for upfront and hybrid modes, the line items to add to every generated invoice. (Items come from lesson data for delivered-mode.)
- **Template run**: a single execution of the template. Has a run date, outcome, count of invoices produced, and is the provenance anchor for every invoice generated in that run.
- **Generated invoice**: a normal `invoices` row produced by a template run. Carries `generated_from_template_id` and `generated_from_run_id` foreign keys.

### Billing mode — hybrid per-template (Decision 1(c) + 2(c))

Each template has a `billing_mode` enum: `delivered`, `upfront`, `hybrid`.

- **Delivered**: bill for lessons that happened since the last run. Operator configures which attendance statuses count (attended always; optionally late-cancel, no-show). One line item per lesson, dated.
- **Upfront**: bill for lessons scheduled in the upcoming period (or a flat fee per student, operator's choice via `upfront_source`). For lesson-driven upfront, use lessons scheduled in `[next_run_date, next_run_date + frequency)`.
- **Hybrid**: template has items (flat fees like "term enrolment £25") AND generates lesson line items from delivered-mode logic. Both paths run, merged into one invoice per recipient.

Operator sets:
- `delivered_statuses text[]` — defaults to `['attended']`, can include `late_cancel_student`, `no_show`.
- `upfront_source text` — `'scheduled_lessons'` or `'flat_fee'`. Flat fee uses template items only.

### Recipient model (Decision 3(b))

Templates have an explicit recipient list: `recurring_template_recipients` table. Operator adds students individually or in bulk (e.g. "all active students with rate card X"). Recipients are editable at any time; changes affect the next run, not already-generated invoices.

A recipient inherits the student's normal payer resolution (primary guardian → student-payer fallback). Template does not override payer.

A recipient can be temporarily paused on this template (e.g. "student on break until January") via `is_active` flag on the recipient row. Pausing excludes them from the next run without removing them from the template.

### Item granularity (Decision 4(a))

One line item per lesson. Description format: `"{lesson_type} — {teacher_first_name} — {lesson_date}"`. For flat template items: operator-supplied description and amount.

For delivered-mode with multiple lessons same day, each lesson is a separate line item. Aggregated display is a reporting concern, not a data-model concern.

### Failure tolerance (Decision 5(a))

Per-invoice isolation. If generating student A's invoice fails (no rate card, missing payer, DB error), that student is skipped with an error row in `template_run_errors`. The rest of the batch proceeds. `last_run_status` is `'partial'` or `'failed'` based on success ratio. Operator sees a dashboard card listing per-student errors; audit_log records each skip.

---

## 2. Schema

### `recurring_invoice_templates` (existing table, extended)

Current columns: `id, org_id, name, frequency, billing_mode, auto_send, next_run_date, last_run_at, last_run_status, last_run_invoice_count, active, created_by, created_at, updated_at`.

Extensions needed:

```sql
ALTER TABLE recurring_invoice_templates
  ADD COLUMN IF NOT EXISTS delivered_statuses text[] NOT NULL DEFAULT '{attended}',
  ADD COLUMN IF NOT EXISTS upfront_source text CHECK (upfront_source IN ('scheduled_lessons', 'flat_fee')),
  ADD COLUMN IF NOT EXISTS currency_code text,  -- inherited from org at create, editable
  ADD COLUMN IF NOT EXISTS tax_mode text NOT NULL DEFAULT 'inherit' CHECK (tax_mode IN ('inherit', 'exempt', 'standard')),
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS last_run_id uuid;  -- FK added after runs table exists

-- Amend frequency check to align with code (currently accepts 'weekly', 'monthly', 'termly')
-- Amend billing_mode check to include 'hybrid'
ALTER TABLE recurring_invoice_templates
  DROP CONSTRAINT IF EXISTS recurring_invoice_templates_billing_mode_check,
  ADD CONSTRAINT recurring_invoice_templates_billing_mode_check
    CHECK (billing_mode IN ('delivered', 'upfront', 'hybrid'));
```

**J9-F2 cleanup**: the duplicate CREATE TABLE in migration `20260225001655` (with `billing_mode DEFAULT 'per_lesson'`) created a policy drift. The hardened migration must:
- Drop the `Finance team can manage recurring templates` policy if both exist, canonicalise to `Staff can manage templates` (the 224 policy) — or flip, finance-team is probably the right gate for production use. **Decision point: which role tier?** My vote: finance team + admin, not all staff. Teachers shouldn't configure recurring billing. Align with `is_org_finance_team`.
- Reconcile the `billing_mode` column semantics (the 224 CHECK wins; `per_lesson` never existed meaningfully).

### `recurring_template_recipients` (new)

```sql
CREATE TABLE recurring_template_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES recurring_invoice_templates(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT true,
  added_at timestamptz NOT NULL DEFAULT now(),
  added_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  paused_reason text,
  UNIQUE (template_id, student_id)
);

CREATE INDEX idx_rtr_template_active ON recurring_template_recipients (template_id) WHERE is_active;
CREATE INDEX idx_rtr_student ON recurring_template_recipients (student_id);

ALTER TABLE recurring_template_recipients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Finance team manages recipients" ON recurring_template_recipients
  FOR ALL USING (is_org_finance_team(auth.uid(), org_id))
  WITH CHECK (is_org_finance_team(auth.uid(), org_id));
```

### `recurring_template_items` (new)

Optional — only used by hybrid and flat-fee-upfront modes. For pure delivered-mode and pure scheduled-lessons-upfront, this table is unused for that template.

```sql
CREATE TABLE recurring_template_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES recurring_invoice_templates(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  description text NOT NULL,
  amount_minor integer NOT NULL CHECK (amount_minor > 0),
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  tax_code text,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_rti_template ON recurring_template_items (template_id, order_index);

ALTER TABLE recurring_template_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Finance team manages items" ON recurring_template_items
  FOR ALL USING (is_org_finance_team(auth.uid(), org_id))
  WITH CHECK (is_org_finance_team(auth.uid(), org_id));
```

### `recurring_template_runs` (new)

Each execution of a template. This is the provenance anchor.

```sql
CREATE TABLE recurring_template_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES recurring_invoice_templates(id) ON DELETE RESTRICT,
  org_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  run_date date NOT NULL,  -- the next_run_date at time of execution
  period_start date NOT NULL,  -- covers which lessons/period
  period_end date NOT NULL,
  triggered_by text NOT NULL CHECK (triggered_by IN ('scheduler', 'manual', 'retry')),
  triggered_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  outcome text CHECK (outcome IN ('completed', 'partial', 'failed', 'running')) DEFAULT 'running',
  recipients_total integer NOT NULL DEFAULT 0,
  invoices_generated integer NOT NULL DEFAULT 0,
  recipients_skipped integer NOT NULL DEFAULT 0,
  error_summary text,
  audit_metadata jsonb
);

CREATE INDEX idx_rtr_runs_template ON recurring_template_runs (template_id, started_at DESC);
CREATE INDEX idx_rtr_runs_org_recent ON recurring_template_runs (org_id, started_at DESC);

ALTER TABLE recurring_template_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Finance team views runs" ON recurring_template_runs
  FOR SELECT USING (is_org_finance_team(auth.uid(), org_id));
CREATE POLICY "Service role writes runs" ON recurring_template_runs
  FOR ALL USING (auth.uid() IS NULL) WITH CHECK (auth.uid() IS NULL);
```

### `recurring_template_run_errors` (new)

Per-recipient errors in a run.

```sql
CREATE TABLE recurring_template_run_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES recurring_template_runs(id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES recurring_invoice_templates(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  error_code text NOT NULL,  -- e.g. 'no_rate_card', 'no_payer', 'no_lessons_in_period', 'db_error'
  error_message text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_rtre_run ON recurring_template_run_errors (run_id);
CREATE INDEX idx_rtre_org_recent ON recurring_template_run_errors (org_id, occurred_at DESC);

ALTER TABLE recurring_template_run_errors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Finance team views errors" ON recurring_template_run_errors
  FOR SELECT USING (is_org_finance_team(auth.uid(), org_id));
CREATE POLICY "Service role writes errors" ON recurring_template_run_errors
  FOR ALL USING (auth.uid() IS NULL) WITH CHECK (auth.uid() IS NULL);
```

### `invoices` table extensions

```sql
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS generated_from_template_id uuid
    REFERENCES recurring_invoice_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS generated_from_run_id uuid
    REFERENCES recurring_template_runs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_from_template ON invoices (generated_from_template_id) WHERE generated_from_template_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_from_run ON invoices (generated_from_run_id) WHERE generated_from_run_id IS NOT NULL;
```

---

## 3. Generator RPC

`generate_invoices_from_template(_template_id uuid, _triggered_by text DEFAULT 'manual')` — produces a template run and a batch of invoices.

### Signature

```sql
CREATE OR REPLACE FUNCTION public.generate_invoices_from_template(
  _template_id uuid,
  _triggered_by text DEFAULT 'manual'  -- 'scheduler' | 'manual' | 'retry'
)
RETURNS json  -- { run_id, invoices_generated, recipients_skipped, outcome }
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public';
```

### Algorithm

1. **Guard.** Auth check: service-role OR `is_org_finance_team(auth.uid(), _template.org_id)`. Return error if not authorised.
2. **Lock template row FOR UPDATE.** Prevents concurrent runs of the same template (scheduler + manual retry racing).
3. **Load template.** Fail if `active = false` OR `next_run_date > CURRENT_DATE + 1` (not due yet, unless `_triggered_by='manual'` which allows run-now).
4. **Compute period.** Based on frequency and next_run_date:
   - Weekly: `[next_run_date - 7 days, next_run_date)`
   - Monthly: `[next_run_date - 1 month, next_run_date)`
   - Termly: requires term_id link — resolve via `terms` table, use the term ending most recently before `next_run_date`.
   - For upfront: `[next_run_date, next_run_date + frequency)`
5. **Insert run row** with `outcome='running'`.
6. **Fetch active recipients.** `SELECT student_id FROM recurring_template_recipients WHERE template_id = _template_id AND is_active = true`.
7. **Per-recipient loop:**
   - Resolve payer (primary guardian, fallback to student-payer).
   - If payer unresolvable: insert error row `('no_payer', ...)`, skip.
   - Build line items:
     - **Delivered-mode**: query lessons in period where `student_id IN lesson_participants` AND `attendance_status = ANY(_template.delivered_statuses)` AND not already invoiced (cross-check `invoice_items.lesson_id`). Build one item per lesson at lesson's rate.
     - **Upfront flat**: copy items from `recurring_template_items`.
     - **Upfront scheduled**: query lessons scheduled in upcoming period, one item per scheduled lesson.
     - **Hybrid**: both sets, merged.
   - If zero items produced: insert error row `('no_lessons_in_period' or 'no_items_configured', ...)`, skip. Don't create empty invoices.
   - Call `create_invoice_with_items(...)` with:
     - payer_guardian_id or payer_student_id
     - items
     - currency_code from template
     - tax_mode from template
     - invoice_number: generated via normal path
     - `generated_from_template_id = _template_id`
     - `generated_from_run_id = _run_id`
     - due_date: operator-configurable offset from run_date (e.g. "net 14 days"). Add to template schema.
     - Credits applied: respect existing `create_invoice_with_items` auto-apply logic if student has available credits. Operator-configurable per-template via `apply_credits_automatically boolean`.
   - If `auto_send = true`: call the send pipeline (Resend via `send-invoice` edge fn or equivalent). Status transitions to `sent`. Failure to send emails the operator but does not roll back the invoice (invoice is already valid data).
   - Increment `invoices_generated` counter.
8. **Advance next_run_date** on template by one frequency unit.
9. **Update run row**: `outcome` = `'completed'` (all recipients succeeded), `'partial'` (some errors but some invoices), `'failed'` (zero invoices produced). Set `completed_at`.
10. **Update template**: `last_run_id`, `last_run_at`, `last_run_status`, `last_run_invoice_count`.
11. **Write audit_log** entry `'template_run_completed'` with summary.
12. **Return** run summary JSON.

### Rollback semantics

The outer function is a single transaction. If a DB error occurs mid-loop (not a per-recipient "expected" error like no_payer, but a genuine failure), the whole run rolls back. `create_invoice_with_items` already locks and is atomic; if its internal call fails, that transaction level rolls back, but the per-recipient failure is caught in the loop and logged as an error row — the outer loop continues.

To achieve per-recipient error isolation with per-invoice atomicity: each recipient's invoice creation happens inside a savepoint. Savepoint rollback on failure, error logged, loop continues.

```sql
FOR _recipient IN SELECT ... LOOP
  BEGIN
    SAVEPOINT before_recipient;
    -- build items, call create_invoice_with_items, handle auto-send
    -- on success, continue
  EXCEPTION WHEN OTHERS THEN
    ROLLBACK TO SAVEPOINT before_recipient;
    INSERT INTO recurring_template_run_errors (...) VALUES (...);
    _recipients_skipped := _recipients_skipped + 1;
  END;
END LOOP;
```

### Idempotency

**Duplicate protection 1: template run date guard.** If template's `next_run_date` is already in the future (i.e. a run advanced it), reject with `already_run` error unless `_triggered_by = 'retry'`. Scheduler should never cause a double-advance.

**Duplicate protection 2: lesson already invoiced.** In delivered-mode, lessons that already appear in an `invoice_items.lesson_id` from a prior invoice (any status except `voided`) are excluded. If the prior invoice was voided, its items' lesson_ids are available again.

**Duplicate protection 3: manual re-run.** Operator clicks "Run now" on a template whose next_run_date is today: allowed. Clicks again same day: the second run's delivered-mode query returns zero lessons (all already invoiced), zero items produced, error `no_lessons_in_period` logged for each recipient. Safe.

### Audit surface

Every generator call writes:
- One `recurring_template_runs` row
- Zero or more `recurring_template_run_errors` rows
- One `audit_log` entry per generated invoice (already handled by `create_invoice_with_items`)
- One `audit_log` entry at the end summarising the run

---

## 4. Scheduler edge function

`supabase/functions/recurring-billing-scheduler/index.ts`. Runs on a cron schedule. Batches templates due today.

### Schedule

`0 4 * * *` UTC — daily at 04:00 UTC. Rationale: after `credit-expiry` (02:00), before operator workday starts in UK. Gives operators a morning to review generated invoices before parents see them (if auto-send).

### Algorithm

1. Fetch active templates where `next_run_date <= CURRENT_DATE`. Order by `org_id, next_run_date` for locality.
2. For each template, call `generate_invoices_from_template(_template_id, 'scheduler')` via Supabase RPC.
3. Collect results: `{ template_id, run_id, outcome, invoices, errors }`.
4. Log summary to console and (for visibility) write an `audit_log` entry with the batch summary at org level.
5. If any template's outcome is `'failed'` or `'partial'` with significant errors, fire `send-recurring-billing-alert` to org owners (operator notification edge fn).

### Failure isolation

If one template's `generate_invoices_from_template` RPC throws (not just returns errors — throws), catch and continue to next template. Log the throw to `audit_log` with action `'template_run_threw'`. The scheduler's job is to keep going; individual template failures don't block the batch.

### Retry semantics

Scheduler does NOT auto-retry. If a template's run produces errors, operator intervention is required (fix the underlying issue, click "Retry run" in UI). Automatic retry on a failed template would compound the original problem.

---

## 5. Auto-send behaviour

When template's `auto_send = true`:
- Generator creates invoice via `create_invoice_with_items` with initial status `draft`.
- Immediately after creation, generator calls the send-invoice edge fn (or the internal `send_invoice` RPC if that's the preferred path).
- On send success: invoice transitions to `sent`, parent email fires.
- On send failure: invoice stays `draft`, error logged to `recurring_template_run_errors` with code `send_failed`, generator continues (the invoice row is intact; an operator can retry the send from InvoiceDetail).

When `auto_send = false`:
- Generator creates invoice in `draft` status.
- Operator reviews the batch in a new "Recent recurring runs" dashboard surface (see §7).
- Operator sends invoices manually via normal send flow.

---

## 6. Edge cases

### Student leaves mid-cycle

Recipient flagged `is_active = false` by operator. Next run excludes them. Already-generated invoices are not rolled back — they cover the period up to the leave.

If a student's `deleted_at` is set on the base `students` table: template scheduler must also skip them. Check student row existence + `deleted_at IS NULL` per-recipient.

### Rate card change mid-cycle

Delivered-mode uses the rate_card that applied at the time of each lesson (via lesson's own rate_card_id if stored, or current student's rate_card at lookup time — design decision: **store rate at lesson level when lesson is created, use stored rate at invoice generation**). This means a rate change today doesn't retroactively change yesterday's lesson's billable amount.

Upfront-mode uses current rate_card at run time. A rate change today applies to tomorrow's upfront invoice.

### Credit handling

By default: `create_invoice_with_items` auto-applies available credits for the payer's students at invoice-create time. For recurring invoices, same behaviour applies.

Template has `apply_credits_automatically boolean DEFAULT true`. Operator can disable per-template (e.g. upfront tuition template opts out; delivered-mode arrears template opts in).

If credit is applied and invoice is later voided (e.g. operator caught a bad batch), credit is restored via `void_invoice` — already handled.

### Student without primary payer

Recipient has student_id but no active primary-payer guardian AND student has no direct payer email. Error row: `no_payer`. Recipient skipped. Operator fixes payer linkage, clicks "Retry" on run.

### Org currency change

Template stores `currency_code` at create time. If org currency changes, template's currency is preserved (it's a snapshot). Operator can edit template's currency explicitly.

### VAT / tax change

Template stores `tax_mode` (inherit / exempt / standard). At invoice generation, resolves to current org VAT rate if `inherit`. Historical invoices keep their resolved rate.

### Term boundaries (termly mode)

Termly requires a link to `terms` table. Template has optional `term_id` OR uses org's current term at run time. Period covers the ending term's dates. If no current term is defined: error at run time, `no_active_term`.

### Concurrent manual + scheduler runs

`FOR UPDATE` lock on the template row serialises them. First to acquire wins, second blocks until first completes. Second sees advanced `next_run_date` and rejects with `already_run`.

### Generator mid-run server crash

DB transaction rolls back; run row doesn't persist; template's `next_run_date` unadvanced. Next scheduler run tries again from scratch. Safe.

### Student with zero lessons in period (delivered-mode)

Error row: `no_lessons_in_period`. Skipped. No invoice created. This is the expected behaviour — you shouldn't bill a student £0 for a period they had no lessons.

### Voided invoice's lessons freed for re-invoicing

`void_invoice` sets `voided_at` on the invoice. Lessons previously attached via `invoice_items.lesson_id` become available again for a new invoice. Delivered-mode generator's "not already invoiced" check excludes voided invoices.

### Duplicate lesson payment path

If a lesson appears in both a recurring invoice AND a manual billing-run invoice: whichever invoice is created first wins (locked). The other path should see the lesson as already invoiced and skip. Defence: `invoice_items.lesson_id` has a partial unique index `WHERE invoice.voided_at IS NULL` — enforce at DB level.

---

## 7. Operator UX

### Invoices → Recurring Billing tab

Currently mounted. Needs expansion:

1. **Template list** (existing). Each card shows: name, frequency, billing mode, auto-send flag, next run date, last run status, active toggle.
2. **Template detail page** (new). Click a template to see:
   - Configuration (name, frequency, mode, auto-send, next run)
   - Recipients management (add / remove / pause individual students, bulk add by rate card)
   - Items (for hybrid/flat modes)
   - Recent runs (last 20) with per-run outcome + click to run detail
   - "Run now" button (for testing or operator-initiated generation)
3. **Run detail page** (new). Shows:
   - Summary (date, outcome, invoices generated, recipients skipped)
   - List of generated invoices (click through to invoice detail)
   - List of errors with student name, error code, message
   - "Void entire run" action (with confirm modal — voids all invoices from this run via `void_invoice`)
   - "Retry skipped recipients" action (new generator call limited to previously-failed recipients)
4. **Recent runs dashboard card** (new). Top-of-Invoices-page card: "Last recurring run: Nov 1 — 32 invoices generated, 1 skipped (view details)."
5. **Run failure alert** (new). Persistent banner on Invoices page when any template's last run had `outcome = 'failed'` or significant skip count, until operator dismisses.

### Notification emails

- `send-recurring-billing-alert` edge fn: notifies org owners when a scheduler run produces failures/partials. Same pattern as dispute/refund notifications.
- Single daily summary if multiple templates run — one email per org per day, not per template.

---

## 8. Migration path for existing template rows

Lauren's test academy and any demo data may have `recurring_invoice_templates` rows. These rows are inert — no child data, no runs.

Options:
- (a) Leave them. On first real build deploy, they exist but have zero recipients/items, so scheduler will attempt runs, error `no_recipients`, mark last_run_status='failed'. Operator sees them, either configures or deletes.
- (b) Migration deactivates them all (`active = false`) so scheduler ignores. Operator re-activates after configuring properly.
- (c) Migration deletes them with a note.

**Recommendation: (b).** No data loss, explicit re-activation required. Operator sees "Paused" badge, knows to configure.

Migration file:
```sql
UPDATE recurring_invoice_templates
SET active = false,
    notes = COALESCE(notes || ' | ', '') || 'Auto-paused 24 April 2026 — recurring billing feature rebuilt; please reconfigure recipients and items before resuming.'
WHERE active = true;
```

---

## 9. Failure modes / ops

### What happens when

| Failure | System behaviour |
|---|---|
| Scheduler edge fn throws | Cron logs the throw; next day retries from same `next_run_date`; templates don't advance. Operator sees "no run today" in UI. |
| Generator RPC errors on one template | Scheduler logs, continues to next template. |
| Generator errors on one recipient | Logged to `recurring_template_run_errors`; loop continues. |
| Generated invoice has wrong amount | Operator catches in review, voids invoice via normal UI (credits restored automatically); re-runs manually after fixing underlying rate. |
| Auto-send email fails for one invoice | Invoice stays draft, error logged, operator re-sends from InvoiceDetail. |
| Full batch shouldn't have run (e.g. org on pause) | Operator clicks "Pause all templates" (or sets each to active=false). Scheduler skips them next run. Current-day invoices voided in bulk via "Void entire run". |
| Operator bulk voids a run | All invoices voided via void_invoice; credits restored; parent notified per existing void notification. |

### Operator recovery drill

1. Bad batch generated. Operator sees failure banner.
2. Opens run detail, reviews invoices.
3. Clicks "Void entire run". Confirm modal explains cascading void.
4. All invoices voided. Credits restored. Parents receive void notifications (existing flow).
5. Operator fixes underlying issue (e.g. wrong rate on a recipient's rate card).
6. Clicks "Retry run" — generator re-runs with today as the run date; lessons previously invoiced (in voided invoices) are now available again.

### Known limits

- No partial-void (void some recipients but keep others). Operator must void individually from invoice detail if cherry-picking.
- No scheduled future edit ("apply this rate change from Nov 1"). Operator edits rate cards at the moment the change applies.
- No cross-template coordination ("don't generate if this other template already did"). Not needed if recipient lists are disjoint.

---

## 10. Phase plan

Design validated → build split into four phases:

### Phase 1: Schema foundation (Week 1, ~4 commits)
- Migration: extend `recurring_invoice_templates` with new columns, reconcile J9-F2 policy drift.
- Migration: `recurring_template_recipients` table + RLS.
- Migration: `recurring_template_items` table + RLS.
- Migration: `recurring_template_runs` + `recurring_template_run_errors` tables + RLS.
- Migration: `invoices.generated_from_template_id` + `generated_from_run_id` columns.
- Migration: lesson_id partial unique index for duplicate-invoice defence.
- Migration: auto-pause existing rows (§8(b)).
- Docs: update POLISH_NOTES with J9 Phase 1 scope.

### Phase 2: Generator RPC (Week 1-2, ~3 commits)
- Migration: `generate_invoices_from_template` RPC with full savepoint-per-recipient isolation.
- Unit walks: delivered-mode, upfront-flat, upfront-scheduled, hybrid. Cover all edge cases from §6.
- Migration: `cancel_template_run` RPC (bulk void of all invoices in a run).
- Frontend: "Run now" button wired to generator RPC.

### Phase 3: Scheduler + notifications (Week 2, ~3 commits)
- Edge fn: `recurring-billing-scheduler`.
- Cron schedule: `0 4 * * *` UTC.
- Edge fn: `send-recurring-billing-alert` (operator notification on failures/partials).
- Audit_log wiring at scheduler level.

### Phase 4: Operator UX (Week 2-3, ~4 commits)
- Template detail page with recipients + items management.
- Run detail page with void/retry actions.
- Recent runs dashboard card.
- Failure banner on Invoices page.
- Recipient bulk-add UI (by rate card, by tag).

### Phase 5: Close-out (Week 3, ~1 commit)
- Docs: full user-facing docs in `/docs/recurring-billing.md` (operator-facing).
- Roadmap: mark Journey 9 CLOSED.
- Scope-decisions log: record all phase decisions.

Total estimate: ~15 commits across 3 weeks of focused attention. Comparable to J5 disputes in scope.

### What gets shipped vs what gets filed

Ships in Phase 1-5:
- All four billing modes (delivered, upfront-scheduled, upfront-flat, hybrid)
- Full recipient management
- Scheduler + auto-send
- Operator recovery (void run, retry recipients)
- Audit + notification surfaces

Filed for post-launch:
- Cross-template coordination
- Partial-void / cherry-pick within a run
- Scheduled future rate/item edits
- Multi-currency per-recipient overrides
- Analytics surface for "which templates generate the most revenue" etc.

---

## 11. Open questions — need Jamie's input before Phase 1 starts

1. **Role gate.** `is_org_finance_team` (owner + admin + finance) or wider? My vote: finance team.
2. **Termly mode requires `terms` table link.** Does the `terms` table exist? If yes, template takes `term_id`. If no, termly-mode ships in Phase 2 or later — weekly/monthly only for v1.
3. **Rate card storage at lesson level.** Is rate stored on the lesson row at creation, or resolved at billing time? Correct answer for idempotent historical billing: stored at lesson. If not currently stored, needs a separate migration before Phase 2.
4. **Send-invoice edge fn.** Does a reusable `send-invoice` edge fn already exist? If yes, generator calls it for auto-send. If no, add to Phase 3 scope.
5. **Tax mode semantics.** Is `tax_mode = 'inherit'` a real thing in the org model, or do invoices just copy org VAT? My draft assumes inherit-at-generation-time. Confirm.
6. **Due date offset.** Templates need `due_date_offset_days` (e.g. "net 14 days"). Add to template schema. Default value: 14? 30? Org-level default inherited?
7. **Currency resolution.** Template snapshots currency at create. Org-level currency change doesn't cascade. Acceptable?
8. **Lesson invoicing defence — the partial unique index.** Does this conflict with anything existing? The proposal: `UNIQUE (lesson_id) WHERE NOT EXISTS (... join invoices on voided_at)`. Needs a trigger not an index since Postgres partial indexes can't join. Design alternative: check in `create_invoice_with_items` (already locks lessons) augmented with "reject if any non-voided invoice already has this lesson". Confirm current state of this check.
9. **Scheduler observability.** Does Track 0.7 (manual cron trigger button) cover this, or does recurring need its own "run now" operator path separate from the generic cron trigger?
10. **Demo data.** Any recurring templates in demo seed? If so, demo seed needs updating to include recipients/items.

---

## Review checklist

Before committing this doc:
- [ ] Jamie has reviewed all §10 open questions and answered them
- [ ] Phase plan granularity acceptable
- [ ] Edge case list (§6) complete — anything missing from your 19 years of UK music academy experience?
- [ ] Role gate decision made
- [ ] Any concerns about existing data in production (Lauren's test academy mainly)

Once checklist is clear, doc gets committed to `docs/RECURRING_BILLING_DESIGN.md` and Phase 1 briefing follows.
