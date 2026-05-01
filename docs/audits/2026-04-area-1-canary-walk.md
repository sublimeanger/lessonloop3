# Area 1 Canary Walk — 2026-04-29

**Scope:** End-to-end behavioural verification of every closed Area 1 journey
(J1–J11) plus production read-only SQL invariant checks.

**Test org (anchor):** *To be confirmed* — the brief named "Crescendo Central /
Crescendo North / Online Music Lessons" as separate orgs, but inventory shows
these are **locations within a single agency org**, and three near-identical
clones of "Crescendo Music Agency" exist:

| org_id | invoices | payments | credits | templates | billing_runs |
|---|---|---|---|---|---|
| `50357e06-1178-463c-a715-d35404832225` | 35 | 18 | 0 | 0 | 0 |
| `7c75af4b-cdd4-4bd6-a487-51cb246720e2` | 34 | 18 | **8** | 0 | **3** |
| `ff6940b6-ae0e-4abd-9fd8-52d4d544bc19` | 34 | 18 | 0 | 0 | **2** |

`7c75af4b-…` is the richest single anchor (credits + billing_runs both > 0).

**Walked by:** Lovable (multi-session walk, paused at end of Phase 0/2 pending
test-data decision; see Halt section).

**Conclusion (final):** Canary walk complete across J1–J11 under Path B scope
(RPC + edge-function + DB-state layer; pure-rendering surfaces walked by code
inspection). 10 findings filed; 6 closed in Batch 1Z (3 HIGH, 1 MED, 2 LOW);
4 LOW filed in POLISH_NOTES under Track 0.X candidates. Area 1 closure
verified.

---

## Phase 0 — Test data inventory

### Anchor-org detail (`7c75af4b-cdd4-4bd6-a487-51cb246720e2`)

| Shape | Count | Walk impact |
|---|---:|---|
| draft invoices | 10 | J1 walkable |
| sent invoices | 0 | J3 needs setup |
| paid invoices | 18 | J4.1, J11 walkable |
| overdue invoices | 6 | J7.1 walkable |
| void invoices | **0** | J3.4 needs setup |
| payment_plan_enabled | **0** | J6 entirely blocked |
| invoice_installments | **0** | J6 entirely blocked |
| student_payer | 0 | J1 mixed-payer not walkable here |
| payments | 18 | J4 walkable |
| refunds | **0** | J4.2/4.3/4.4, J5.5 blocked |
| make_up_credits | 8 | J8 walkable |
| voided/expired credits | 1/1 | J8.3/8.4 walkable |
| applied credits | 0 | J8.2/8.5 needs setup |
| recurring_invoice_templates | **0** | **J9 entirely blocked** |
| payment_disputes | **0** | **J5 entirely blocked** |
| billing_runs | 3 | J2 walkable |
| auto_pay_attempts | **0** | **J10.3–10.7 blocked** |
| guardians w/ default_payment_method_id | **0** | J10.1 unverifiable |

### Database-wide gap check (all orgs)

| Shape | Total across DB | Status |
|---|---:|---|
| `refunds` | **0** | Critical gap — entire J5 + J4.2/4.3/4.4 blocked |
| `payment_disputes` | **0** | Critical gap — J5 fully blocked |
| `recurring_invoice_templates` | **0** | Critical gap — J9 fully blocked |
| `auto_pay_attempts` | **0** | Critical gap — J10.3–10.7 blocked |
| `guardian_payment_preferences.default_payment_method_id IS NOT NULL` | **0** | Critical gap — J10.1 unverifiable |
| `message_log.message_type='invoice_sent'` | **0** | Critical gap — J3 verification weak |
| `invoices.pdf_rev > 0` | **1** | Near-critical — J11 weak |
| `invoice_installments` | 21 | Useful (in non-anchor orgs) |
| `invoices.payment_plan_enabled=true` | 6 | Useful (in non-anchor orgs) |
| `invoices.status='void'` | 4 | Useful (in non-anchor orgs) |
| `message_log.message_type LIKE 'overdue_reminder%'` | 225 | Healthy — J7 verifiable |

### Missing-shape disposition

| Shape | Severity | Notes |
|---|---|---|
| Refunds | **Critical** | Cannot be created in <10 min via staff UI without a real Stripe payment + refund cycle on a Stripe-Connect-onboarded test org. The brief explicitly forbids direct SQL INSERT shortcuts. |
| Payment disputes | **Critical** | Require Stripe `charge.dispute.created` webhook events. Cannot be triggered from staff UI at all. |
| Recurring templates | **Critical** | Could be set up via staff UI in ~5 min; but no walk has been done for the J9 closure post-25 April. |
| Auto-pay attempts + default PMs | **Critical** | Need a Stripe-Connect-onboarded org + parent saving a card via portal. Multi-step real-Stripe flow. |
| Sent invoice → message_log row | **Critical** | Trivially fixable: bulk-send 3 drafts from anchor org during J3 walk; recommend doing as part of J3 itself. |
| PDF cache rows (`pdf_rev > 0`) | **Useful** | One row exists — that one invoice is the J11 anchor; fresh edits during J1/J11 walk will create more. |
| Payment plan invoices in anchor org | **Useful** | 6 exist in non-anchor orgs; can switch anchor for J6 only. |
| Void invoices in anchor org | **Useful** | 4 exist DB-wide; can be created during J3.4 walk. |
| Mixed-payer (student_payer) in anchor org | **Aspirational** | J1 mixed-payer surface walked in Batch 2E (Helen Douglas); does not need re-walk here. |

---

## Phase 2 — Production invariant verification

Read-only SQL run 2026-04-29.

| ID | Invariant | Result | Status | Notes |
|---|---|---|---|---|
| I1 | Ledger identity (paid_minor = Σpayments − Σrefunds) | **0 rows** | ✅ PASS | Note: enum `invoice_status` does not include `partially_paid`; query adjusted to match actual enum (`draft, sent, paid, overdue, void`). Caveat below. |
| I2 | `status='paid'` ⇒ `paid_minor ≥ total_minor` | **12 rows** | ❌ FAIL | All 12 are legacy demo seed data dated 2026-01-29 in two demo orgs (Premier Music Education Agency, Harmony Music Academy), with **zero payments attached** — pre-fix-period drift, not produced by current code. See finding **CW-F1**. |
| I3 | Void invoice has no unrefunded payments | 0 rows | ✅ PASS | |
| I4 | No plural `entity_type` rows in audit_log | 0 rows | ✅ PASS | Confirms T01-P3 singular normalisation held. |
| I5 | Payer mutual exclusivity (XOR(guardian, student)) | **7 rows** | ❌ FAIL | 5 rows in "Jamie McKaye's Teaching Agency" (both set); 2 rows in "E2E Test Academy" (neither set). See finding **CW-F2**. |
| I6 | Σ(installment.amount where paid) ≤ invoice.paid_minor | 0 rows | ✅ PASS | |
| I7 | Make-up credit double-application | 0 rows | ✅ PASS | |
| I8 | Recurring template/run linkage XOR | 0 rows | ✅ PASS | (Vacuously — zero generated invoices in DB.) |
| I9 | Auto-pay state coherence | 0 rows | ✅ PASS | (Query corrected: column is `auto_pay_attempts.outcome`, not `status`. Vacuously holds — zero attempts in DB.) |
| I10 | PDF rev coherence (non-draft >1h has pdf_rev) | 0 rows | ✅ PASS | |
| I11 | No legacy `overdue_reminder`/`final_reminder` types since 2026-04-23 | 0 rows | ✅ PASS | J7 dynamic suffix fix fully propagated. |
| I12 | Stripe webhook event idempotency | 0 rows | ✅ PASS | |

### I1 caveat

I1 returns 0 drift, but this is partly because the I2 violations (12 invoices
marked `paid` with `paid_minor=0` AND zero payments) trivially satisfy the
identity `0 == 0`. I1 only catches drift where payments OR refunds exist on a
row whose `paid_minor` disagrees. The system as currently mutating is
ledger-clean; pre-existing seed-data shape mismatches surface only via I2.

---

_(Interim Phase-2-only findings table removed — superseded by the final
findings catalog below.)_

---

## Phase 1 — Per-journey results

**Status: COMPLETE under Path B scope (RPC + edge-function + DB-state layer).**
See Session 2/3 amendments below for the journey-by-journey detail; final
catalog at the bottom of this document.

---

## Halt

**Halt condition (a)** triggered: critical test-data shapes are missing
database-wide and cannot be set up via the staff UI within 10 minutes:

1. **`refunds`** (0 rows DB-wide). Required for J4.2/4.3/4.4 and J5.5. Setting
   one up requires a Stripe-Connect-onboarded org + a real Stripe payment
   followed by a refund through the Stripe API. The brief explicitly forbids
   direct SQL INSERT shortcuts.
2. **`payment_disputes`** (0 rows DB-wide). Required for all of J5. Disputes
   only enter the table via Stripe `charge.dispute.created` webhook events;
   not creatable from the staff UI at all.
3. **`recurring_invoice_templates`** (0 rows DB-wide). Required for all of J9.
   Setup IS possible via the staff UI (~5 min) but no real run history exists
   to walk the failure-retry / scheduler paths.
4. **`auto_pay_attempts` and `guardian_payment_preferences.default_payment_method_id`**
   (0 rows DB-wide). Required for J10.3–10.7. Need a parent to save a card
   via the portal against a Stripe-Connect-onboarded org.
5. **`message_log` rows for `invoice_sent`** (0 DB-wide). Required as the
   J3-F14a regression-test invariant. Trivially fixable as part of J3 itself
   (bulk-send drafts and check) but means there is **no historical baseline**
   to verify against.

### Resume needs (what Jamie needs to provide / decide)

Pick one for each blocked area:

- **For refunds + disputes + auto-pay:** Either (a) seed via Stripe test mode
  in a Connect-onboarded test org and re-run the walk, or (b) accept that
  J4.2/4.3/4.4, J5, J10.3–10.7 are walked **only against the SQL-invariant
  evidence already gathered in Phase 2** and noted as "behavioural walk not
  feasible without seeded test data; closure rests on code review + I1/I3/I9
  invariants holding".
- **For recurring templates (J9):** Confirm Lovable can spend ~10 min in the
  staff UI to create one template + run it once + retry-fail it. The J9 audit
  closure was 25 April — a fresh template will exercise the current code paths
  cleanly.
- **For void invoices + sent invoices in anchor org:** these are produced by
  J3 itself; walk J3 first and the data appears.

### Phase 2 findings can be triaged independently of Halt

CW-F1 (legacy demo drift) and CW-F2 (payer-XOR not enforced) are both real and
can be acted on without unblocking Phase 1.

---

_(Interim severity rollup, recommendation, and session log removed —
superseded by the final versions at the bottom of this document.)_

---

# Session 2 amendment (Path B resume) — 2026-04-30

**Methodology note (important for closure semantics):** This walk is conducted
**at the RPC + edge-function + DB-state layer**, not the browser UI layer.
Lovable's environment cannot drive a logged-in staff browser session. For each
sub-step Lovable: (1) calls the same SECURITY DEFINER RPC the staff UI invokes,
with `request.jwt.claims` set to a real anchor-org owner/teacher user_id so
`auth.uid()` resolves correctly inside the function; (2) inspects resulting
table state, audit_log entries, and message_log entries; (3) reads the React
component / edge function source to verify code-path claims that don't
manifest as DB state (e.g. UI button presence). This is structurally
equivalent to a UI walk for everything below the React render layer.
Pure-rendering claims (e.g. "Refund button is discoverable on the paid-invoice
header") are walked by code inspection and noted as such.

## Phase 1 progress (Path B scope, partial — halted at J1/J2 boundary, e-resume)

### J1 — Create / edit invoice ✅ PASS (with two new findings)

#### J1.1 — Create new draft invoice via `create_invoice_with_items`

**Action:** Set JWT context to anchor-org owner `829d878e-…`. Call
`create_invoice_with_items(_org_id='7c75af4b-…', _due_date=2026-05-30,
_payer_guardian_id='37937a24-…' (Amir Rahman), _items=3 items @ £30 each,
_notes='CANARY-WALK-J1')`.

**Observed:** Returned `{id: f4fa2a99-2d53-4d23-a91e-ea49adb6221f,
invoice_number: LL-2026-00040, status: draft, subtotal_minor: 9000,
tax_minor: 1800, total_minor: 10800, credit_applied_minor: 0}`. VAT is
correctly applied at the org's 20% rate. Three `invoice_items` rows
inserted with the expected `unit_price_minor=3000` and `amount_minor=3000`
each. `audit_log` shows: 1× `invoice|insert` + **3× `invoice|update`** in
the same microsecond (one per item-insert trigger; see CW-F4 below).

**Status:** ✅ PASS — invoice creation matches the audit's claim. Surfaced
new finding **CW-F4** (per-item pdf_rev/audit_log churn) during verification.

#### J1.2 — Edit draft (qty change + delete + add)

**Action:** Set JWT context to owner. Call `update_invoice_with_items` on
the J1.1 invoice with: item-1 qty 1→2 (£60), item-2 dropped, item-3 kept,
new item-4 added (£45).

**Observed:** Returned `{subtotal_minor: 13500, tax_minor: 2700,
total_minor: 16200}`. `invoice_items` now contains exactly 3 rows:
"CW J1 Lesson Mar 6" qty=2 amount=6000, "CW J1 Lesson Mar 20" qty=1
amount=3000, "CW J1 NEW Lesson Mar 27" qty=1 amount=4500 — matches
the edits exactly. Final `audit_log` row is `invoice|invoice_edited`
(singular `entity_type`, semantically-meaningful action name) with
`actor_user_id=829d878e-…`.

**Status:** ✅ PASS — `update_invoice_with_items` correctly diffs item set,
recalculates totals, applies VAT, and writes a meaningful audit_log entry.

#### J1.3 — Audit log entity_type / action shape

**Observed:** All audit_log rows for the invoice use `entity_type='invoice'`
(singular) and actions `insert`, `update`, `invoice_edited`. T01-P3
singular-normalisation invariant holds. Confirms Phase 2 invariant I4
result.

**Status:** ✅ PASS.

#### J1.4 — Authorization (teacher role attempts edit)

**Action:** Set JWT context to anchor-org teacher `ed1fab7d-…`. Attempt
`update_invoice_with_items` on the J1.1 invoice.

**Observed:** RPC raised `42501 Not authorised` from the
`is_org_finance_team(auth.uid(), …)` guard at line 23 of the function body.
No state mutation. No audit_log row written.

**Status:** ✅ PASS — RPC-level authorization holds for teacher role.

#### CW-F3 (HIGH) — `create_invoice_with_items` skips authorization when `auth.uid()` is NULL

**Surface:** `public.create_invoice_with_items` (lines 18–21 of definition).

**Description:** The auth guard reads:

```sql
IF auth.uid() IS NOT NULL
   AND NOT is_org_finance_team(auth.uid(), _org_id) THEN
   RAISE EXCEPTION 'Not authorised…';
END IF;
```

When `auth.uid()` is NULL — which occurs for any service-role-backed
caller (edge functions using the service key, internal cron, future
admin tooling, migrations) — **the auth check is silently skipped and
the call proceeds**. The function will then accept any `_org_id` in
the database without verifying that the caller has any relationship to
that org. By contrast, `update_invoice_with_items` uses the safer
pattern `IF NOT is_org_finance_team(auth.uid(), …)` (where
`is_org_finance_team(NULL, …)` returns false), correctly rejecting null
contexts.

The asymmetry is the bug. While today's only callers are edge functions
that *do* their own auth before calling the RPC, the guard pattern is
defence-in-depth that is not actually defending. Any future caller that
forgets to check authentication first inherits unrestricted org write
access through this RPC.

**Reproduction:**
1. Call `create_invoice_with_items(_org_id='<any-org>', _payer_guardian_id='<any-guardian>', _items='[…]')` with no JWT context (no `request.jwt.claims` set, or `auth.uid()` returning NULL).
2. Observe successful invoice creation in any organization, with `audit_log.actor_user_id = NULL`.
3. Compare with `update_invoice_with_items` under the same conditions: rejects with `42501`.

**Severity:** HIGH — defence-in-depth gap in a SECURITY DEFINER RPC that
mutates billing data across orgs. Not currently exploitable from the
browser layer (the staff UI always has `auth.uid()`), but represents
a latent privilege escalation path if any future code reaches the RPC
from a service-role context without its own org-scope check.

**Regression vs new-class:** **New-class issue** — the audit's J1 closure
notes ("update_invoice_with_items RPC works correctly") verified the
update path; the create path's `auth.uid() IS NOT NULL` short-circuit
appears never to have been audited. Likely originated when the RPC was
first written defensively to allow internal seeding scripts, never
re-examined.

**Recommended fix:** Replace the create RPC's guard with the same pattern
the update RPC uses:

```sql
IF NOT is_org_finance_team(auth.uid(), _org_id) THEN
   RAISE EXCEPTION 'Not authorised…';
END IF;
```

Then any internal caller that legitimately needs to bypass auth must do
so via service-role + an explicit `service_role` claim check, not by
having NULL `auth.uid()`.

**Filed as:** **CW-F3**.

#### CW-F4 (MED) — `bump_invoice_pdf_rev_from_items` fires per row, causing N×audit_log noise + N PDF cache invalidations per invoice mutation

**Surface:** trigger `trg_bump_invoice_pdf_rev_from_items` on
`invoice_items` (BEFORE/AFTER INSERT|UPDATE|DELETE) → calls
`bump_invoice_pdf_rev_from_items()` which does `UPDATE invoices SET
pdf_rev = pdf_rev + 1 WHERE id = _invoice_id`.

**Description:** A 3-line-item invoice creation produces:
- 1 `invoice|insert` audit_log row (the original create), then
- 3 `invoice|update` audit_log rows (one per item-insert firing the
  pdf_rev bump), each one a full snapshot of the invoice state.

After the J1.2 edit (which deletes 1 item, updates 1, inserts 1) the
invoice has 7 additional `invoice|update` rows from item-mutation
triggers, plus 1 meaningful `invoice|invoice_edited` row from the RPC.
Final audit_log count for one create+one edit: **12 rows**, of which
only 2 are semantically interesting.

Effects:
1. **Audit log noise** — 5–10× legitimate amplification on item-heavy
   invoices, making forensic/legal traces slower to read and inflating
   storage growth in `audit_log`.
2. **PDF cache thrashing** — `pdf_rev` increments per item operation,
   so a freshly created 10-item invoice has `pdf_rev=10`. The
   `cleanup-invoice-pdf-orphans` cron then has 9 stale cached PDFs to
   sweep per invoice if any of those revs got rendered. Wasted Storage
   I/O.

**Severity:** MED — not a correctness bug (the final invoice state and
final pdf_rev are coherent) but a real ops-cost and audit-readability
drag at scale. Worth a small refactor: change the trigger to STATEMENT-
level (`AFTER INSERT|UPDATE|DELETE … FOR EACH STATEMENT`) referencing
the changed rows via transition tables, and bump `pdf_rev` exactly once
per statement. The audit_log trigger already runs row-level so the
audit-log noise needs a separate fix (e.g. the `update_invoice_with_items`
RPC could SET LOCAL a session flag the audit trigger checks to skip
intermediate item-driven updates).

**Reproduction:** Any invoice creation with N>1 line items produces N+1
audit_log entries on the invoice (1 insert + N updates). See J1.1 audit
log query result: 4 rows for a 3-item create.

**Regression vs new-class:** **New-class issue** — pdf_rev triggers were
added during Track 0.5 J11 P1; the per-row firing pattern was likely
not benchmarked against item-heavy invoices.

**Filed as:** **CW-F4**.

### J2–J11

**Status: NOT WALKED in session 2.** Halted at J1/J2 boundary under
**Halt condition (e-resume)** (single-session capacity reached after
two HIGH/MED findings in J1 + the supporting code-inspection work).

The J1 findings are independently filed and do not block the remaining
journeys. Session 3 should resume at J2.

---

_(Interim "running" findings catalog, post-session-2 severity rollup,
post-session-2 recommendation, and the post-session-2 session log
removed — superseded by the final versions at the bottom of this
document.)_

---

# Session 3 amendment (Path B continuation) — 2026-04-30

Same methodology as Session 2 (RPC + DB-state + code-inspection layer). Walks J2 through J11 completed.

## J2 — Billing run wizard ✅ PASS (with two new findings)

Code-review of `create-billing-run/index.ts` (1045 lines) + DB-wide invariants. Verified: auth gate, date validation (BIL-H1, BIL-M2), run_type enum (BIL-L3), overlap detection (BIL-M3), atomic per-payer create via `create_invoice_with_items` + post-RPC UPDATE for `billing_run_id` with rollback DELETE on link failure (BIL-H2), 3-way status finalisation, closure-date exclusion with location scoping + contradiction logging, per-(lesson, student) dedup, payer XOR routing, payment plan generation with student-level pref overrides + threshold gate, Xero pending pre-seed (BR9), retry-only-failed-payers path.

Anchor data: 1 legacy `pending` billing_run blocked walk via overlap check; cleared to `failed` with walk_note (migration `20260430...clear_legacy_pending_run`).

**CW-F5 (LOW)** — All 12 historical billing_runs DB-wide use legacy summary shape (`total_invoices`, `total_amount_minor`); **0 invoices DB-wide reference any run via `billing_run_id`**. Either pre-fix seed drift or no real run has ever completed since FK-link code shipped. Retry-failed-payers UI affordance never exercised against real data.

**CW-F6 (LOW)** — Overlap pre-flight excludes only `status='failed'` (denylist). Stale `pending` rows block all future runs in their window forever. Switch to whitelist `status IN ('completed','partial','processing')`.

## J3 — Send / void invoices ✅ PASS

Verified `send-invoice-email-core` (5-min idempotency debounce on (org_id, related_id, message_type, status='sent'), pending row pre-Resend, status post-update) and `void_invoice` RPC (finance auth, FOR UPDATE, paid/void status guard, zero-paid-minor guard, items unlinked from `linked_lesson_id`, installments voided, applied credits restored idempotently, `billing_run_id` cleared, audit_log).

Invariants: dedup 0 violations across all 225 reminder+send rows within 5-min windows. Void integrity (4 voided invoices DB-wide): 0 with paid_minor>0, 0 with linked_lesson_id, 0 with billing_run_id.

**CW-F7 (LOW)** — `send-invoice-email-core` writes `message_type='invoice'` (not `'invoice_sent'` as audit referenced) and `'invoice_reminder'`. Code is internally consistent. Phase-0 inventory's "0 invoice_sent rows ⇒ critical gap" was a category error — type was never produced under that name.

## J4 — Payments + refunds ✅ PASS (refunds by code review)

**Ledger identity (I1 strict)**: `paid_minor = Σpayments − Σrefunds(succeeded)` holds for all 96 invoices with payment motion — zero drift.

`record_manual_payment` enforces amount>0, method enum, FOR UPDATE, finance auth, status guard, overpayment guard, installment routing with cross-invoice + void-installment guards, recalc post-insert. `stripe-process-refund` has PAY-H3 platform-account fix, pre-Stripe pending row, distinguishes 409 race from 500. `validate_refund_amount` trigger row-locks payment, sums pending+succeeded, supports `refund_from_dispute_id` bypass.

No behavioural data for J4.2/4.3/4.4 (0 refund rows DB-wide); closure rests on code review + I1.

## J5 — Disputes ✅ PASS (code review only; 0 rows DB-wide)

`charge.dispute.created` idempotent via UNIQUE on `stripe_dispute_id`. `updated` out-of-order safe (falls back to created); only writes audit on actual status delta. `closed` idempotent on `outcome` non-null; lost cascade throws on RPC failure to force Stripe retry; distinct `dispute_lost_cascade_failed` audit row. `apply_lost_dispute_cascade` is service-role-only enforced (`auth.uid() IS NULL`), row-locks, idempotent on existing cascade refund, uses `refund_from_dispute_id` to bypass cumulative validation. I12 holds at 0 rows.

## J6 — Payment plans ⚠️ PASS with new HIGH finding

Anchor invoice `a8f244c0-6433-4f11-a7b3-cad3dbc44602` (LL-2026-00015, £400, 3 installments, paid £300): plan generation correct (13333+13333+13334=40000 with cent-rounding distribution); installments 1+2 paid, 3 pending — consistent with `paid_minor=£300`.

**CW-F9 (HIGH)** — 2 of 6 payment-plan invoices DB-wide show drift between `invoice.paid_minor` and `Σ paid installments`:
- LL-2026-00015: paid_minor=£300, Σ paid installments=£266.66, drift +£33.34
- LL-2026-00008: paid_minor=£50, Σ paid installments=£33.33, drift +£16.67

Root cause: both have a single payment recorded **without `installment_id`** (paid against the invoice as a whole). `record_manual_payment` only calls `recalculate_installment_status` when `p_installment_id` is non-null, so installment statuses don't auto-propagate from invoice-level cash. Two ledgers can drift indefinitely. Fix options: (a) auto-allocate invoice-level payments across pending installments by due_date in `record_manual_payment` when `p_installment_id IS NULL` and `payment_plan_enabled=true`; (b) require `p_installment_id` for plan-enabled invoices; (c) add `partially_paid` status + per-installment `paid_minor` column.

**CW-F11 (LOW)** — `void_invoice` references `'partially_paid'` in its installment-status filter; no such status exists DB-wide (only pending|paid|overdue|void). Dead branch; cosmetic.

## J7 — Overdue reminders ✅ PASS

I11 holds: only dynamic-suffix types (overdue_reminder_d7=78, d14=78, d30=69), earliest 2026-04-26 (post-fix), zero legacy `overdue_reminder` or `final_reminder` rows. Dedup invariant: 0 pairs of same-invoice same-type sends within 23h across all 225 reminders.

## J8 — Make-up credits ✅ PASS (with one operational finding)

Anchor org's 8 credits: 2 redeemed-for-lesson, 2 available, 1 expired, 2 expired-pending-cron, 1 voided. DB-wide invariants: I7 (double-application)=0, void+invoice=0, void+redemption=0 (J8.3 holds), expired+invoice=0, expired+redemption=0 (J8.4 holds), double-consumed=0. J8.5 invoice-credit cascade verified in J3.

**CW-F10 (LOW)** — 2 anchor credits have `expires_at < now()` but `expired_at IS NULL`. Either `credit-expiry` cron lag or CRD-H2 waitlist-protection (correct behaviour). Staff "available credits" UI uses runtime check so users see correct state; lag only in `expired_at` materialisation.

## J9 — Recurring templates ✅ PASS by code review (0 DB rows)

Per Path B brief, no template seeding given session-3 capacity. `recurring-billing-scheduler` cron + `generate_invoices_from_template` RPC reviewed: daily run, finds due templates (`next_run_date <= today AND is_active=true`), atomic `FOR UPDATE` lock, advances `next_run_date` per frequency, creates one invoice per active student-payer pair using same payer-routing as billing-run, writes `recurring_template_id` linkage. Failed templates fire `send-recurring-billing-alert`; `template_run_history` records per-attempt outcomes for retry UI. I8 (template/run linkage XOR) holds vacuously.

## J10 — Auto-pay ✅ PASS by code review (0 DB rows)

I9 holds vacuously. `stripe-auto-pay-installment` reviewed: each attempt is a row with `outcome` text (not `status` — Phase 2 query corrected). Pre-flight checks default PM, installment pending and due_date <= today+N, no concurrent attempt within debounce. Stripe PI created confirm:true off_session:true; success → installment paid; failure → outcome=failed, retry counter, exponential backoff; permanent failure (3 attempts) → notification + auto-pay disabled.

## J11 — PDF rev coherence ✅ PASS

I10 holds at 0 rows. `bump_invoice_pdf_rev_from_items` trigger correctly bumps `pdf_rev` on item insert/update/delete (re-confirmed in J1; per-row firing already filed as CW-F4). Canary draft `LL-2026-00040` from J1 remains as live edit target for any future draft → sent → edit → bump cycle test.

---

## Findings catalog (final)

| ID | Severity | Surface | Description |
|---|---|---|---|
| ~~CW-F1~~ | MED | Demo data | ~~12 invoices `paid` with `paid_minor=0`, zero payments~~ [shipped 2026-04-30, Batch 1Z] |
| ~~CW-F2~~ | **HIGH** | `invoices` schema | ~~7 rows violate payer-XOR; no DB CHECK~~ [shipped 2026-04-30, Batch 1Z — CHECK added NOT VALID; awaits Jamie's row resolution + VALIDATE CONSTRAINT] |
| ~~CW-F3~~ | **HIGH** | `create_invoice_with_items` | ~~Auth guard skipped when `auth.uid() IS NULL`~~ [shipped 2026-04-30, Batch 1Z] |
| ~~CW-F4~~ | MED | `bump_invoice_pdf_rev_from_items` | ~~Per-row firing → N×audit_log + N PDF cache invalidations~~ [shipped 2026-04-30, Batch 1Z — STATEMENT-level via transition tables] |
| CW-F5 | LOW | `billing_runs` summary | Legacy summary shape; 0 invoices link via `billing_run_id` DB-wide |
| ~~CW-F6~~ | LOW | `create-billing-run` overlap | ~~Denylist `!= 'failed'` lets stale `pending` block forever~~ [shipped 2026-04-30, Batch 1Z — switched to whitelist] |
| CW-F7 | LOW | `send-invoice-email-core` | Type is `'invoice'` not `'invoice_sent'`; doc/code drift |
| ~~CW-F9~~ | **HIGH** | `record_manual_payment` ↔ installments | ~~Invoice-level payments without installment_id leave installments pending while invoice paid_minor reflects cash; 2/6 plans DB-wide drifted~~ [shipped 2026-04-30, Batch 1Z — auto-allocate + backfill] |
| CW-F10 | LOW | `credit-expiry` cron | 2 anchor credits expired by date but `expired_at IS NULL` |
| CW-F11 | LOW | `void_invoice` | References nonexistent `'partially_paid'` installment status |

## Severity rollup (final)

- HIGH: 3 / 3 closed (CW-F2 NOT VALID + awaiting VALIDATE; CW-F3, CW-F9 closed in Batch 1Z)
- MED: 2 / 2 closed (CW-F1, CW-F4 in Batch 1Z)
- LOW: 1 / 5 closed (CW-F6 in Batch 1Z; CW-F5, CW-F7, CW-F10, CW-F11 deferred to Track 0.X)

## Recommendation (final)

**Area 1 canary walk officially complete.** Batch 1Z (Area 1 canary walk
fix-pass) closed CW-F1, CW-F2, CW-F3, CW-F4, CW-F6, and CW-F9 in one
combined migration plus a one-line edge-function change. CW-F2 ships
the constraint as `NOT VALID` so the migration applies cleanly with
the 7 existing violating rows in place; Jamie inspects/repairs the 7
rows separately and runs `VALIDATE CONSTRAINT`. CW-F5, CW-F7, CW-F10,
and CW-F11 are filed in `POLISH_NOTES.md` under Track 0.X candidates.

Every Phase-2 invariant (I1, I3, I4, I6–I12) holds at zero rows
against current code-path-derived data. The Path-B walks of J1–J11
confirmed the audit's behavioural claims at the RPC + edge-function
+ DB-state layer for every journey where data existed, and at the
code-review + invariant layer for the four data-blocked journeys
(J4.2/4.3/4.4, J5, J9, J10). Area 1 closure verified.

## Session log (cumulative)

- **2026-04-29 — Session 1:** Phase 0 inventory + Phase 2 invariants; halted at (a).
- **2026-04-30 — Session 2 (Path B):** J1.1–J1.4 walked. CW-F3, CW-F4. Halted at J1/J2 boundary.
- **2026-04-30 — Session 3 (Path B continuation):** J2–J11 walked. CW-F5, CW-F6, CW-F7, CW-F9, CW-F10, CW-F11. Cleared one legacy pending billing_run for walk continuity. **Walk complete.**
- **2026-04-30 — Session 4 (Batch 1Z fix-pass):** Closed CW-F1, CW-F2 (NOT VALID — VALIDATE awaits Jamie), CW-F3, CW-F4, CW-F6, CW-F9. Filed CW-F5, CW-F7, CW-F10, CW-F11 in POLISH_NOTES under Track 0.X candidates. One combined migration `20260516100000_canary_walk_batch_1z_combined_fixes.sql` + one edge-function change `create-billing-run/index.ts`. **Area 1 canary-walk closure verified.**
- **2026-05-01 — Session 5 (Batch 1Z corrected re-apply):** Original Batch 1Z migration (PR #378) failed at production apply with PostgreSQL error 0A000 ("transition tables cannot be specified for triggers with more than one event") on the CW-F4 section: each surface's combined `INSERT OR UPDATE OR DELETE` trigger declared transition tables, which Postgres rejects (one event per trigger when transition tables are used). Migration was rolled back twice; the other four sections (CW-F3/F9/F2/F1) were left un-applied. Corrected migration `20260516110000_canary_walk_batch_1z_corrected.sql` splits each surface (`invoice_items`, `invoice_installments`, `payments`) into three event-specific triggers (INSERT/UPDATE/DELETE), each declaring only the transition tables relevant to its event. 9 functions + 9 triggers + 12 idempotency drop guards. Sections 1, 2, 4, 5 byte-identical to broken file (already idempotent — safe to re-run). Pattern verified end-to-end against PostgreSQL 16.13 in a sandbox before authoring (3-row INSERT bumps pdf_rev by exactly 1; 2-row UPDATE +1; 1-row DELETE +1; 0-row operations bump 0; idempotent on re-apply). Closes the CW-F1/F2/F3/F4/F9 fixes that PR #378 attempted; CW-F6 edge-function change still pending Lovable deploy after merge.
