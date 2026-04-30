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

**Conclusion (interim):** Phase 2 invariants run clean against current code-path
output (I1, I3, I4, I6, I7, I8, I9, I10, I11, I12 = 0 rows). I2 and I5 each
surface pre-existing drift in demo / pre-prod orgs only. Phase 1 walk **HALTED
at Halt condition (a)** — multiple critical test-data shapes (refunds,
disputes, recurring templates, auto-pay attempts, default payment methods) are
absent from every org in the database and cannot be set up via the staff UI in
<10 minutes (most require Stripe webhook events or direct Stripe-side actions).
Awaiting Jamie's decision on seeding strategy before Phase 1 begins.

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

## Findings (interim — Phase 2 only)

| ID | Severity | Surface | Description | Reproduction | Type |
|---|---|---|---|---|---|
| CW-F1 | **MED** | Demo data (Premier Music Education Agency, Harmony Music Academy) | 12 invoices marked `status='paid'` with `paid_minor=0` and **zero payments** attached — created 2026-01-29 by a seed path that bypassed `record_manual_payment` / payment recalc. No current code path can produce this shape (verified: every payment-mutating RPC routes through `recalculate_invoice_paid`). Cosmetic in production (no real org affected) but pollutes invariant baselines. | `SELECT id,total_minor,paid_minor FROM invoices WHERE status='paid' AND paid_minor < total_minor;` returns 12 demo-org rows | New-class issue (legacy seed drift, not regression of an audit-claimed fix) |
| CW-F2 | **HIGH** | Schema invariant — `invoices` table | 7 rows violate the payer-XOR invariant. 5 in "Jamie McKaye's Teaching Agency" (own org used for hands-on testing) have **both** `payer_guardian_id` and `payer_student_id` set; 2 in "E2E Test Academy" have **neither** set. Any RPC that branches on payer-type (e.g. `get_parent_dashboard_data` from Batch 2E, the `record_manual_payment` payer-routing) will give nondeterministic results for the 5 dual-payer rows and will silently skip the 2 unowned rows. No DB-level CHECK constraint is enforcing the XOR. | `SELECT id, payer_guardian_id, payer_student_id FROM invoices WHERE (payer_guardian_id IS NOT NULL AND payer_student_id IS NOT NULL) OR (payer_guardian_id IS NULL AND payer_student_id IS NULL);` | New-class issue — schema invariant not enforced. Both Jamie's org and E2E Test Academy are pre-prod surfaces, but a CHECK constraint would prevent recurrence everywhere. |

---

## Phase 1 — Per-journey results

**Status: NOT STARTED. Halted at Halt condition (a).** See below.

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

## Severity rollup (interim)

- HIGH: 1 (CW-F2)
- MED: 1 (CW-F1)
- LOW: 0

## Recommendation (interim)

Phase 2 results are mildly reassuring: every dynamic, code-path-derived
invariant (I1, I3, I4, I6–I12) holds at zero rows. The two failures (I2, I5)
are static drift not currently re-introducible by the deployed code paths.
CW-F2 (the payer-XOR violation) is the only finding that warrants near-term
action — adding a `CHECK (num_nonnulls(payer_guardian_id, payer_student_id) = 1)`
constraint to `invoices` would prevent recurrence everywhere and should be a
small migration in the next batch. CW-F1 is best handled by a one-off
demo-data backfill (set `paid_minor = total_minor` on the 12 affected rows or
demote them to `status='sent'`).

The Area 1 closure cannot be **fully** verified until Phase 1 completes — the
behavioural walks of J4 (refunds), J5 (disputes), J9 (recurring), and J10
(auto-pay) all need test data that doesn't currently exist DB-wide. Until then
the audit's claim that Area 1 is closed rests on code review + cron logs +
the per-batch verifications already done, not on an end-to-end behavioural
repro.

---

## Session log

- **2026-04-29 — Session 1 (Lovable):** Read brief, established anchor-org
  candidates, ran Phase 0 inventory, ran Phase 2 invariants (12/12 with two
  query corrections — `partially_paid` not in enum; `auto_pay_attempts.outcome`
  not `status`). Documented CW-F1, CW-F2. Halted at condition (a) before
  Phase 1 began. Next session resumes once Jamie picks a seeding strategy.
