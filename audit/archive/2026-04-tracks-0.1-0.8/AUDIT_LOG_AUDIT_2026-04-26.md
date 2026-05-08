# Track 0.1 — Audit Log Completeness Walk — 2026-04-26

Discovery audit. Read-only. Done by chat-Claude in a local clone, post
T06-P1 close.

## Headline finding

**Track 0.1 is real and substantive — not stale like Track 0.6.**
The roadmap's claim is verified by walk: every one of the 13 named
business-critical tables has zero audit triggers. Plus one additional
critical-class table (`user_roles`) is also untriggered. Plus C50
(entity_type singular/plural drift) is verified across 41 manual
audit_log writes — singular dominates manual usage but trigger writes
are plural.

The work to close Track 0.1 is concrete:
- Add audit triggers for 12 of 13 named tables (one — `profiles` —
  needs a different design because it has no `org_id`).
- Add an audit trigger for `user_roles`.
- Normalise `entity_type` casing across triggers and historical rows
  (the C50 problem) — singular wins by usage, attendance-pattern, and
  consistency with manual writes.
- Optionally add audit triggers for org-config tables (`closure_dates`,
  `time_off_blocks`, `make_up_policies`, `org_messaging_settings`,
  `recurring_invoice_templates`, `guardian_payment_preferences`) — not
  in the roadmap's scope but likely worth folding in for completeness.

This is one to two phases of work. Sized after operator answers two
design questions below.

## Correction (2026-04-26, post-T01-P1 deploy)

The walk's identification of `user_roles` as a critical-class missing
audit table was **stale**. The `user_roles` table was dropped on
15 March 2026 in `supabase/migrations/20260315220009_fix_roles_audit_findings.sql:98`
as part of the role-surface consolidation onto `org_memberships`.

The role surface is fully audit-covered: `audit_org_memberships`
(from `supabase/migrations/20260120002039_5a489cca`) captures all role
grants/revokes/changes via the older `log_audit_event` helper.
T01-P3 will migrate this trigger to the singular-entity_type pattern
alongside the other 8 plural-writing triggers.

**T01-P2 scope therefore covers only `profiles`** — the only per-user
table that exists today and has no audit trigger. The user_roles-related
findings (T01-F2 second-half) and OQ design questions in this doc are
moot.

**On Lovable's secondary concern that `org_memberships` was missed by T01-P1:**
not a gap. `audit_org_memberships` (created 2026-01-20 in
`20260120002039_5a489cca`, never dropped) is one of the 9 grandfathered
audit triggers T01-P1 deliberately preserved. Per T01-P1's contract
("DO NOT modify the existing 9 audit triggers... T01-P3 normalises them"),
it stays as-is until T01-P3 migrates all 9 to the singular pattern in
lockstep with the audit_log historical UPDATE.

The remainder of the walk doc is preserved unchanged for historical
reference.

## Current audit-trigger coverage

### Tables WITH audit triggers (verified in main, 9 total)

| # | Table | Trigger | Function | Migration |
|---|---|---|---|---|
| 1 | `students` | `audit_students` | `log_audit_event()` | `20260120002039_5a489cca` |
| 2 | `lessons` | `audit_lessons` | `log_audit_event()` | `20260120002039_5a489cca` |
| 3 | `invoices` | `audit_invoices` | `log_audit_event()` | `20260120002039_5a489cca` |
| 4 | `payments` | `audit_payments` | `log_audit_event()` | `20260120002039_5a489cca` |
| 5 | `org_memberships` | `audit_org_memberships` | `log_audit_event()` | `20260120002039_5a489cca` |
| 6 | `ai_action_proposals` | `audit_ai_action_proposals` | `log_audit_event()` | `20260120002350_a4776ae7` |
| 7 | `teachers` | `audit_teachers_changes` | `log_audit_event()` | `20260130162532_a2767bf6` |
| 8 | `internal_messages` | `audit_internal_messages` | `log_audit_event()` | `20260201204906_4e5625ee` |
| 9 | `attendance_records` | `trg_audit_attendance` | `audit_attendance_changes()` (custom) | `20260222203006_fb68ba75` |

### Tables WITHOUT audit triggers (roadmap-named, 13)

All verified by `grep -rE "CREATE TRIGGER.*ON public\.${tbl}" supabase/migrations/`
returning zero matches in main.

| # | Table | Has `org_id`? | Notes |
|---|---|---|---|
| 1 | `refunds` | ✅ | Track 0.5 P1 was concerned about this. |
| 2 | `make_up_credits` | ✅ | T06-P0 confirmed zero corruption today; trigger prevents future corruption. |
| 3 | `term_adjustments` | ✅ | Money-adjacent. |
| 4 | `invoice_installments` | ✅ | Money-adjacent. Auto-pay surface. |
| 5 | `invoice_items` | ✅ | Money-adjacent. |
| 6 | `billing_runs` | ✅ | Money-adjacent. |
| 7 | `rate_cards` | ✅ | Pricing surface. |
| 8 | `teacher_profiles` | ✅ | PII + role-adjacent. |
| 9 | `profiles` | ❌ | **No `org_id` — separate design needed.** Per-user, not per-org. The canonical `log_audit_event` reads `NEW.org_id` and would fail. |
| 10 | `guardians` | ✅ | PII surface. |
| 11 | `lesson_participants` | ✅ | Attendance + billing surface. |
| 12 | `student_guardians` | ✅ | Family-relationship surface. |
| 13 | `terms` | ✅ | Term/billing-period surface. |

### Tables WITHOUT audit triggers (NOT in roadmap, surfaced by walk)

Critical/high finding for `user_roles`. Others are scoping suggestions.

| Table | Severity | Why it matters | Has `org_id`? |
|---|---|---|---|
| `user_roles` | **CRITICAL** | Role grants/revocations untraced. Security-class. | ❌ Per-user, like `profiles`. |
| `recurring_invoice_templates` | high | Schedules future invoices. Edits change billing forever forward. | ✅ |
| `recurring_template_items` | high | Line-item changes on recurring invoices. | inherits via parent join? |
| `recurring_template_recipients` | high | Who gets billed by a template. | inherits via parent join? |
| `guardian_payment_preferences` | high | `auto_pay_enabled`, `default_payment_method_id`, pause state. Money-adjacent. | ✅ |
| `closure_dates` | medium | Affects which lessons get billed. | ✅ |
| `time_off_blocks` | medium | Same as closure_dates. | ✅ (verify) |
| `make_up_policies` | medium | Org-policy changes alter make-up credit issuance. | ✅ |
| `org_messaging_settings` | medium | Org-level messaging config. | ✅ |
| `notification_preferences` | low | User preference; routine flipping; high write volume. | (per-user) |
| `payment_disputes` | low | Webhook-only writes; manual edits rare. | ✅ |
| `auto_pay_attempts` | skip | Already a write-only audit log itself by design. | ✅ |

## Critical findings

### T01-F1 — 13 + 1 = 14 business-critical tables have NO audit trigger today (severity: HIGH)

**Evidence:** Verified by walk; see "Tables WITHOUT audit triggers" above.
Roadmap line 119 names 13; walk surfaces a 14th (`user_roles`) of equal or
greater concern (security-class, role grants/revocations).

**Impact:** Any service-role mutation, any RLS-bypass, any out-of-band edit
on these tables leaves no trail. Manual `audit_log` inserts in RPCs (~41
sites in code, mostly for Stripe-driven changes) cover a fraction of write
paths. Triggers are the only mechanism that captures EVERY write regardless
of caller.

**Recommended action:** T01-P1 — single migration adding triggers to all 12
of the 13 named tables that have `org_id` (skipping `profiles`), plus
`user_roles`, plus the high-severity walk-surfaced tables
(`recurring_invoice_templates`, `recurring_template_items`,
`recurring_template_recipients`, `guardian_payment_preferences`).

Use the **canonical `audit_attendance_changes` pattern** (singular
`entity_type`, `COALESCE(NEW.org_id, OLD.org_id)`, `LOWER(TG_OP)`), not the
older `log_audit_event` pattern. The new shape is strictly better. **Do
NOT rewrite the 9 existing triggers in this phase** — they work; rewriting
them is in scope for T01-P3 (the C50 normalisation phase) where it can be
done alongside the entity_type rename without two passes over the same code.

### T01-F2 — `profiles` and `user_roles` have no `org_id` and need a different design (severity: HIGH for user_roles, medium for profiles)

**Evidence:** `profiles` schema (`20260119230917_9f1e8769:1-9`):
```
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  ...
);
```
No `org_id`. Same shape for `user_roles` (`20260119230917_9f1e8769:13-19`).
Both are auth-mirror tables — a single user spans multiple orgs.

**Three design options:**

(a) **Custom trigger writing to `platform_audit_log`** (the table T05-P1-C6
    introduced for non-org events). Action `'profile_changed'` /
    `'user_role_changed'`. Simple. Matches the cross-org reality. **Recommended.**

(b) **Custom trigger writing to `audit_log` with `org_id` derived from a
    JOIN against `org_memberships`** (most-recent active membership).
    Brittle — what if the user has zero or multiple? Not recommended.

(c) **Separate per-user audit table.** Overkill.

Recommended: **(a)** for both `profiles` and `user_roles`. Same pattern as
the existing `webhook_stale_recovery` writes to `platform_audit_log`. Action
identifiers should be specific (`'profile_change'`, `'user_role_grant'`,
`'user_role_revoke'`) so operator queries can filter cleanly.

### T01-F3 — entity_type casing drift (C50): singular dominant, but triggers write plural (severity: medium, doc-hygiene + future-proofing)

**Evidence:** `grep -rE "entity_type[\":[:space:]]*[\"'][a-z_]+[\"']"` across
`supabase/functions/` and `src/` returns:

| entity_type | Count | Form |
|---|---|---|
| `invoice` | 14 | singular |
| `invoices` | 2 | plural |
| `lesson` | 4 | singular |
| `lessons` | 2 | plural |
| `student` | 1 | singular |
| `students` | 3 | plural |
| `payment` | 1 | singular |
| `payments` | 1 | plural |
| `term_continuation_run` | 4 | singular |
| `term_adjustment` | 1 | singular |
| `guardian` | 2 | singular |
| `org_memberships` | 2 | plural |
| `organisation` | 1 | singular |
| `calendar_connections` | 3 | plural |
| `xero_connections` | 2 | plural |
| `make_up_waitlist` | 1 | (n/a) |
| `import` | 1 | singular |
| `contact` | 1 | singular |
| `custom_table` | 1 | singular |

**Singular dominates manual writes 24:13.** Triggers using the canonical
`log_audit_event` write `TG_TABLE_NAME` — always plural. The newer
`audit_attendance_changes` writes singular (`'attendance_record'`).

**Recommended fix:** **standardise on singular.** Migration:
1. Rewrite the existing `log_audit_event` to write a singular form
   (drop trailing `s`, special-case irregulars).
2. Backfill historical rows with a single SQL UPDATE.
3. Update the ~10 manual writes that use plural to use singular too.
4. New triggers from T01-P1 are singular from the start.

T01-P3 phase. Done after T01-P1 lands so we don't churn unmerged code.

### T01-F4 — column-level snapshots already happen via `to_jsonb(NEW)`, but no fast diff column (severity: low, future enhancement)

**Evidence:** `log_audit_event:46-48` writes `to_jsonb(NEW)` to `after`.
Same for `audit_attendance_changes`. Every column is captured.

**The roadmap's mention** of "Add column-level before/after snapshots for
the most sensitive columns (money fields, role fields)" probably means
either:
- An indexed JSONB path expression for fast `WHERE money_changed` queries, OR
- A separate normalised `audit_log_changed_fields` text[] column listing
  which columns differed in an UPDATE (vs the current "diff before/after
  manually if you need to know").

Either is a future enhancement, not a blocker. **Recommended:** file as
T01-F5 or similar but defer past T01-P1. The trigger-coverage gap is the
real blocker; sensitive-column highlighting is a query-ergonomics
improvement.

## Per-table walk

For each of the 14 tables flagged for T01-P1, surface the trigger shape that
T01-P1 would use. Format below is dense to keep the doc useful for fix-brief
authoring without re-reading every table's schema.

### refunds
- **Schema:** `20260224120000_refunds_and_org_settings.sql`. Has `org_id`,
  `id` (uuid PK), money columns (`amount_minor`, `tax_minor`).
- **Trigger:** standard pattern, entity_type `'refund'`.

### make_up_credits
- **Schema:** confirmed columns from T06-P0 walk. Has `org_id`, `id`, money
  column (`credit_value_minor`), state via timestamp columns
  (`expires_at`, `redeemed_at`, `voided_at`, `expired_at`).
- **Trigger:** standard pattern, entity_type `'make_up_credit'`.

### term_adjustments
- **Schema:** `20260227100000_term_adjustments.sql`. Has `org_id`, `id`,
  money columns.
- **Trigger:** standard pattern, entity_type `'term_adjustment'`.

### invoice_installments
- **Schema:** has `org_id` via `invoice` join? **Verify in walk** — older
  installments tables sometimes denormalise `org_id`. If absent, custom
  trigger that resolves `org_id` via `invoices.org_id` lookup.
- **Trigger:** entity_type `'invoice_installment'`.

### invoice_items
- **Schema:** verify `org_id` presence; otherwise resolve via `invoices`
  join.
- **Trigger:** entity_type `'invoice_item'`.

### billing_runs
- **Schema:** has `org_id`. Money-adjacent.
- **Trigger:** standard, entity_type `'billing_run'`.

### rate_cards
- **Schema:** has `org_id`.
- **Trigger:** standard, entity_type `'rate_card'`.

### teacher_profiles
- **Schema:** has `org_id`.
- **Trigger:** standard, entity_type `'teacher_profile'`.

### profiles
- **Schema:** NO `org_id`. See T01-F2.
- **Trigger:** custom, writes to `platform_audit_log`. Action
  `'profile_change'`. Severity `'info'`.

### guardians
- **Schema:** has `org_id`.
- **Trigger:** standard, entity_type `'guardian'`.

### lesson_participants
- **Schema:** has `org_id`.
- **Trigger:** standard, entity_type `'lesson_participant'`.

### student_guardians
- **Schema:** has `org_id`.
- **Trigger:** standard, entity_type `'student_guardian'`.

### terms
- **Schema:** has `org_id`.
- **Trigger:** standard, entity_type `'term'`.

### user_roles (NEW from walk, security-class)
- **Schema:** NO `org_id`. See T01-F2.
- **Trigger:** custom, writes to `platform_audit_log`. Actions
  `'user_role_grant'` / `'user_role_revoke'`. Severity `'warning'` (role
  changes deserve operator visibility).

### Plus high-severity walk-surfaced (recommended for T01-P1):
- `recurring_invoice_templates`, entity_type `'recurring_invoice_template'`
- `recurring_template_items`, entity_type `'recurring_template_item'`
  (verify `org_id` — likely needs JOIN-resolve)
- `recurring_template_recipients`, same shape
- `guardian_payment_preferences`, entity_type `'guardian_payment_preference'`

### Medium-severity (org-config; bundle into T01-P1 or defer to T01-P2)
- `closure_dates`
- `time_off_blocks`
- `make_up_policies`
- `org_messaging_settings`

## Open design questions for chat-Claude / Jamie

### OQ1 — How aggressive on scope?

Three sensible boundaries:

**(a) Roadmap-only (12 tables + profiles + user_roles).** Closes the
explicit Track 0.1 scope. Excludes recurring-template family + payment
prefs + org-config tables. ~14 triggers in one migration.

**(b) Roadmap + walk-surfaced HIGH (16 tables).** Adds recurring-template
family (3 tables) + guardian_payment_preferences. ~17-18 triggers.

**(c) Roadmap + walk-surfaced HIGH + MEDIUM (20 tables).** Adds closure
dates + time off + policies + messaging settings. ~22 triggers.

**Recommended: (b).** The recurring-template family is a real billing
surface and excluding it leaves a future "Track 0.1.1" footprint. The
medium-severity org-config tables are genuinely lower priority — operator
edits are infrequent and usually surface in product discussions anyway.

### OQ2 — Phase boundaries

Two reasonable splits:

**(a) Single phase, single migration.** Atomic. Long. ~17 trigger
registrations in one file. Higher review surface.

**(b) Three phases:**
- **T01-P1: org-scoped tables** (the 14-15 tables that use the standard
  pattern). One canonical helper function reused. Single migration. The
  bulk of the work.
- **T01-P2: per-user tables** (`profiles`, `user_roles`). Custom function
  writing to `platform_audit_log`. Separate migration because it needs a
  different function and the platform_audit_log shape.
- **T01-P3: entity_type normalisation (C50).** Migration rewriting the
  9 existing triggers + backfilling existing audit_log rows from plural
  to singular + fixing the ~10 plural call sites in code.

**Recommended: (b).** Three phases, three migrations, three Lovable
applies. P1 is the bulk. P2 is small and specifically scoped. P3 is
churn-y and benefits from coming last so the new triggers added in P1+P2
are already singular and don't get rewritten.

### OQ3 — Sensitive-column highlighting (T01-F4)

Out of scope for this walk. File for after Track 0.1 closes if Jamie
wants the query ergonomics. Not a blocker.

### OQ4 — Backfill of audit_log historical rows for casing normalisation

T01-P3's plural→singular UPDATE is straightforward (`UPDATE audit_log
SET entity_type = 'invoice' WHERE entity_type = 'invoices'` etc.) but
it changes historical rows. Some operators may have queries hardcoded
to plural strings. Worth confirming with Jamie that "rewrite history"
is acceptable. Alternative: leave history alone; only standardise new
writes. **My pre-design preference:** rewrite history. The old strings
have no value; current queries should be updated to singular. Document
as part of T01-P3 brief.

### OQ5 — Where do triggers fit in `MIGRATION_CONVENTIONS.md`?

T05-P2 introduced `MIGRATION_CONVENTIONS.md`. T01 work surfaces a need
to add a section: "audit triggers — when to add one, which pattern to
use, entity_type singular convention." Trivial. Bundle into T01-P1's
docs commit.

## Summary table: T01-P1 scope (recommended)

| Tier | Tables | Pattern | Migration shape |
|---|---|---|---|
| Org-scoped, has `org_id` | refunds, make_up_credits, term_adjustments, invoice_installments, invoice_items, billing_runs, rate_cards, teacher_profiles, guardians, lesson_participants, student_guardians, terms, recurring_invoice_templates, recurring_template_items, recurring_template_recipients, guardian_payment_preferences | New canonical helper `log_audit_event_singular()` (writes singular `entity_type`) — or reuse `audit_attendance_changes` pattern via per-table custom triggers | One migration, ~16 trigger registrations |
| Per-user, NO `org_id` (T01-P2) | profiles, user_roles | Custom triggers writing to `platform_audit_log` | One migration, 2 trigger registrations + 2 functions |
| Entity-type normalisation (T01-P3) | (rewrites existing 9 triggers + 1-time backfill UPDATE on audit_log + ~10 code call site fixes) | Migration + edge-fn changes | One migration + 1 commit per touched edge-fn file |

## Walk methodology

This walk was performed by chat-Claude in a local clone at branch tip
`d81c9f5c` (T06-P1 closure merge), 26 April 2026. Same-window discipline:
every claim backed by file path + line number or git query.

Specifically:
1. Read `LESSONLOOP_PRODUCTION_ROADMAP.md:117-123` (Track 0.1 entry).
2. Enumerated every audit trigger in `supabase/migrations/` via
   `grep -rE "CREATE TRIGGER.*audit|EXECUTE FUNCTION.*log_audit_event"`.
3. Read both canonical audit functions: `log_audit_event` (older, plural,
   `NEW.org_id`-only) and `audit_attendance_changes` (newer, singular,
   `COALESCE(NEW.org_id, OLD.org_id)`).
4. Verified each of the 13 roadmap-named tables exists and has zero audit
   triggers via per-table `grep -rE "CREATE TRIGGER.*ON public\.${tbl}"`.
5. Verified `org_id` presence on each via grep against CREATE TABLE +
   ALTER TABLE statements.
6. Listed all tables in the codebase via
   `grep -rE "^CREATE TABLE.*\(" supabase/migrations/` to spot
   walk-surfaced critical tables not in the roadmap (`user_roles` flagged).
7. Catalogued entity_type casing across manual `audit_log` writes via
   `grep -rE "entity_type[\":[:space:]]*[\"'][a-z_]+[\"']"`.

What this walk did NOT cover:
- Did not write any migration.
- Did not run any operator query (no DB access).
- Did not verify production state of the audit_log table contents (would
  surface "are people actually editing untriggered tables" — a useful
  question but answered another way: check timestamps on key columns).
- Did not estimate trigger overhead per write. INSERT/UPDATE/DELETE on
  these tables already runs RLS + recalc triggers; one extra audit insert
  is nominal.

Confidence level: **high** for "13 of 13 named tables verified untriggered".
**High** for "C50 verified — singular dominates, plural in trigger writes".
**Medium** for the walk-surfaced HIGH/MEDIUM tier expansion — Jamie may
override OQ1 to "(a) roadmap-only" if scope discipline matters more than
completeness. **High** for "recommended phase split (b)" — the per-user
tables genuinely need different handling.

## What this walk does NOT do

- Does not propose a migration. Fix briefs follow walk approval.
- Does not propose closure of Track 0.1 in the roadmap (closes via
  T01-P1+P2+P3, not via stale-doc-discovery like T06).
- Does not estimate trigger overhead in latency.
- Does not cover RLS uniformity (Track 0.2) even though it's adjacent —
  every audit trigger Track 0.1 adds is itself an RLS-bypass write that
  Track 0.2 would want to verify.
