# STATUS — Path Y full-app audit sweep

| Field | Value |
|---|---|
| Phase | B — Systematic Audit (In Progress) |
| Active batch | (none — batch 02 complete at s41 commit; s42 to begin batch 03-calendar-core) |
| Last session | s41 (2026-05-12) |
| Next session must | Begin Phase B / batch 03-calendar-core (audit-only). Read this STATUS.md first, then `PLAN.md` §5 batch 03 description, then `CENSUS.md` §11 entries tagged 03. Note: PI-11, PI-13, PI-14, PI-15 are batch 03 + 04 + 19 cross-references already flagged. |
| Total findings (active) | 88 (16 PI active after PI-08 elevation + 36 batch-01 + 36 batch-02) — PI cohort retains PI-08 as historical entry (17 total PI ledger) tagged RESOLVED |
| By severity | 16 critical / 21 high / 19 medium / 32 low. Total 88 active findings. |
| Closed | 0 |
| Banner | **AUDIT IN PROGRESS — DO NOT FIX YET** |

**Note:** this file supersedes the stale top-level [`STATUS.md`](../../STATUS.md) (last updated 2026-05-02, Area 2F). Do not read top-level `STATUS.md` for current Path Y state.

---

## 1. Phase tracker

| Phase | Status | Notes |
|---|---|---|
| A — Census + Plan | **Complete** (s39 commit `1d4eaf4`) | `PLAN.md`, `CENSUS.md`, `STATUS.md` created. 17 PI findings captured. 21-batch list locked. `LESSONLOOP_V2_PLAN.md` brought into repo. |
| B — Systematic Audit | **In Progress** (s40: batch 01 complete; s41: batch 02 complete) | Batch 01 (36 findings: 3C/4H/10M/19L) + batch 02 (36 findings: 5C/10H/8M/13L). Audit-only mode (no code touched outside `audit/sweep/` and `HANDOVER.md`). |
| C — Fix Sprints | Pending | Sprints defined at start of phase. Gated on Phase B complete + Jamie authorisation. Banner can drop once Phase C begins. |
| D — Cohesion Sweep | Pending | Batch 20 journeys (J01–J13) walked end-to-end on staging. |
| E — Lauren Shadow Term | Pending | 12-week term per V2 plan §8. Starts ~2 weeks after Track A PR1 lands. |
| F — LoopAssist remediation completion | Pending (may be subsumed) | Per s41 correction: LoopAssist (batch 17) is fully IN-SWEEP for Phase B; remediation lands in Phase C alongside other classes. A distinct Phase F may not be necessary — decision deferred until Phase B closes. |

---

## 2. Batch tracker

21 batches per `PLAN.md` §5. All Pending entering Phase B. "PI seeds" counts how many pre-investigation findings (§5) are tagged to this batch — those seeds become real `F-NN-NNN` findings when re-verified in their target batch during Phase B.

| Batch ID | Name | Status | Assigned session | Findings (Critical/High/Medium/Low) | PI seeds | Notes / key surfacings |
|---|---|---|---|---|---|---|
| 01 | auth-sessions-rls | **Complete** | s40 (2026-05-11) | 3 / 4 / 10 / 19 | 0 | 2 new criticals discovered (F-01-001 parent-portal lesson-notes RPC broken via parameter mismatch; F-01-003 SECDEF parameter spoofing — undo_student_import). 6 legacy findings re-verified hold-as-fixed (1 deferred to batch 15). RLS layer materially healthy (270 policies on 6 helpers, all CLEAN — Phase C RLS sprint scope narrows to hardening, not rebuild). 9 cross-cutting class patterns drafted for batch 19. 3 findings withdrawn (F1d, F5e, F2d). |
| 02 | org-management | **Complete** | s41 (2026-05-12) | 5 / 10 / 8 / 13 | 1 (PI-08 → F-02-005 elevation) | 5 Critical findings incl. HEADLINE F-02-002 `get_students_for_org` (anon cross-tenant child-PII exfiltration; GDPR Art 9 + Art 33; ICO-notifiable under Lauren shadow volume). PI-08 RESOLVED — elevated HIGH→CRITICAL via F-02-005 (`record_stripe_payment` no caller-context validation). 13 positive architectural patterns documented (§7 of findings doc). 9 cross-cutting carries drafted for batch 19. Phase 1 TS-bypass-cast cluster subsumed by Phase 7A 30-site class (final ledger: 5C/10H/8M/13L = 36). |
| 03 | calendar-core | Pending | — | 0 / 0 / 0 / 0 | 3 (PI-11, PI-14, PI-15) | — |
| 04 | lessons-scheduling-deep | Pending | — | 0 / 0 / 0 / 0 | 1 (PI-11) | — |
| 05 | billing-invoicing | Pending | — | 0 / 0 / 0 / 0 | 4 (PI-02, PI-03, PI-04, PI-15) | — |
| 06 | payments-stripe-connect | Pending | — | 0 / 0 / 0 / 0 | 4 (PI-05, PI-06, PI-07, PI-08) | — |
| 07 | payment-plans-installments | Pending | — | 0 / 0 / 0 / 0 | 0 | — |
| 08 | attendance-credits-waitlists | Pending | — | 0 / 0 / 0 / 0 | 1 (PI-17) | — |
| 09 | term-continuation | Pending | — | 0 / 0 / 0 / 0 | 1 (PI-13) | — |
| 10 | reports-analytics-payroll | Pending | — | 0 / 0 / 0 / 0 | 1 (PI-01) | — |
| 11 | parent-portal | Pending | — | 0 / 0 / 0 / 0 | 1 (PI-05) | — |
| 12 | messages-notifications | Pending | — | 0 / 0 / 0 / 0 | 0 | — |
| 13 | practice-resources | Pending | — | 0 / 0 / 0 / 0 | 0 | — |
| 14 | bookings-leads-enrolment | Pending | — | 0 / 0 / 0 / 0 | 0 | — |
| 15 | calendar-sync-zoom-xero | Pending | — | 0 / 0 / 0 / 0 | 1 (PI-10) | (s40 deferred: re-verify legacy `2026-05-07-calendar-oauth-callback-verify-jwt-missing`) |
| 16 | subscription-tiers | Pending | — | 0 / 0 / 0 / 0 | 0 | — |
| 17 | loopassist | Pending | — | 0 / 0 / 0 / 0 | 2 (PI-12, PI-16) | Full LoopAssist surface IN-SWEEP for Phase B per s41 discipline correction (PLAN.md §3 rule 3). Prior "shelved" framing removed. |
| 18 | settings-tabs | Pending | — | 0 / 0 / 0 / 0 | 1 (PI-10) | — |
| 19 | cross-cutting | Pending | — | 0 / 0 / 0 / 0 | 4 (PI-03, PI-09, PI-13, PI-17) | (s40 inbound: 9 class patterns from batch 01 — see `audit/sweep/findings/01-auth-sessions-rls.md` cross-cutting section) |
| 20 | ux-flows | Pending | — | 0 / 0 / 0 / 0 | 0 | — |
| 21 | marketing-surface | Pending | — | 0 / 0 / 0 / 0 | 0 | — |

Total PI-seed tag count: 24 (one PI may seed multiple batches; e.g. PI-11 seeds both 03 and 04). Unique PI findings: 17 (see §5).

---

## 3. Sprint tracker

Sprints defined at start of Phase C, not earlier. Phase B does not pre-bucket findings into sprints — the catalogue produced in Phase B is the source, and Phase C reads it to define sprints once the picture is complete.

| Sprint ID | Theme | Status | Findings included | Authorised by | Closed |
|---|---|---|---|---|---|
| _(empty)_ | _(empty)_ | _(empty)_ | _(empty)_ | _(empty)_ | _(empty)_ |

---

## 4. Session log

| Session | Date | Phase | Scope summary | EXIT outcome | Commit hashes |
|---|---|---|---|---|---|
| s41 | 2026-05-12 | B | Phase B batch 02 audit (org-management). 10 phases + Phase 7.5 escalation executed: HEAD verify + PI re-verify; 6 org pages walk; 5 edge fns + complete_onboarding RPC; useCan/role/OrgContext walk (188 sites enumerated, +33 vs V2 plan baseline); org state anomalies (2 E2E-fixture artefacts confirmed); SECDEF `_user_id`-class body audit (28 fns enumerated via 18-naming-variant regex sweep — 24 FAIL / 3 PASS / 1 already-recorded); 4 org-management triggers + audit-log integrity sweep; TS-bypass-cast prevalence sweep (30 sites, 21 files); vestigial-parameter sweep (2 hits incl. F-02-032); **org-context spoofing class sample-first audit (15-fn sample, 53% FAIL → escalation rubric fired → Phase 7.5 full-class audit of remaining 43 fns)**; auth-schema-crossing sweep; legacy findings re-verification (17 PIs + 36 F-01-* + 3 withdrawals). Produced `audit/sweep/findings/02-org-management.md` (2005 lines, 36 findings: 5C/10H/8M/13L). **5 Critical findings incl. HEADLINE F-02-002 `get_students_for_org` anonymous cross-tenant child-PII exfiltration (GDPR Art 9 + Art 33; ICO-notifiable under Lauren shadow volume).** PI-08 RESOLVED — elevated HIGH→CRITICAL as F-02-005 (`record_stripe_payment` no caller-context validation; far broader than original `_org_id` mismatch framing). **DISCIPLINE CORRECTION:** LoopAssist (batch 17) un-shelved per AUDIT SCOPE COMPLETENESS principle now in PLAN.md §3 rule 3 — ONLY Zoom remains deferred from Phase B (external Zoom authorization/verification pending; sub-surface deferral within batches 15/18/21, not whole-batch). PI-12 and PI-16 re-tagged IN-SWEEP under batch 17 ownership; severities retained. 13 positive architectural patterns documented across §7. 9 cross-cutting carries + 1 TODO refactor target drafted for batch 19. Grand active total: 88 findings (16C/21H/19M/32L) — PI-08 single-counted as F-02-005, PI cohort retains 17 historical entry with RESOLVED tag. | Phase B batch 02 complete. Banner remains AUDIT IN PROGRESS — DO NOT FIX YET. Phase 10 doc edits applied: PLAN/CENSUS/STATUS/HANDOVER aligned with discipline correction. | (set at Phase 10 commit) |
| s40 | 2026-05-11 | B | Phase B batch 01 audit (auth-sessions-rls). 10 phases executed: HEAD verify + pre-investigation re-verify; auth pages walk (8 pages); auth edge functions (6 fns: account-delete, profile-ensure, invite-accept, invite-get, gdpr-delete, gdpr-export); session/JWT/AuthContext trace; route guards; RLS coverage sweep (93 tables — 88 policied + 5 zero-policy); SECDEF audit (7 unpinned + 6 high-amplification helpers + 4 non-public-pinned variance drill); 6 legacy findings re-verified. Produced `audit/sweep/findings/01-auth-sessions-rls.md` (709 lines, 36 findings: 3C/4H/10M/19L). **2 NEW criticals surfaced via audit:** F-01-001 (parent-portal lesson-notes RPC parameter mismatch — silent broken feature) and F-01-003 (undo_student_import SECDEF parameter-spoofing — authenticated-bypass cascade deletion). 3 findings withdrawn (F1d, F5e, F2d) — drift framings resolved as intentional patterns. All 6 legacy findings hold-as-fixed (1 deferred to batch 15). 9 cross-cutting class patterns drafted for batch 19 (incl. CI-script deliverable + TS-bypass-cast audit + parameter-spoofing codemod). RLS layer materially healthy: 270 policies on 6 helpers all CLEAN. | Phase B batch 01 complete. Banner remains AUDIT IN PROGRESS — DO NOT FIX YET. | (set at s41 commit) |
| s39 | 2026-05-11 | A | Path Y audit foundations: scaffolded `audit/sweep/`; produced `PLAN.md` (10 sections, 21-batch list with batch 21-marketing-surface added during session), `CENSUS.md` (1300+ lines, every feature batch-tagged, 13 journeys seeded), `STATUS.md` (this file); captured 17 pre-investigation findings; brought `LESSONLOOP_V2_PLAN.md` into repo; appended s39 entry to `HANDOVER.md`; baseline drift recorded (prompt-expected HEAD `e30bb32`; actual `c9a5c1f` accepted as new baseline). | Phase A complete. PLAN/CENSUS/STATUS scaffolds + LESSONLOOP_V2_PLAN.md committed. 17 PI findings captured. | `1d4eaf4` |

---

## 5. Pre-investigation evidence — to be batched in Phase B

17 findings verified during s38 via live Supabase MCP queries and code inspection. **Not** to be re-investigated in s39, **not** to be fixed in s39, **not** to be documented in `audit/sweep/findings/` until re-verified inside their target batch in Phase B. They live here as evidence; each one becomes a real `F-NN-NNN` finding when picked up by its assigned batch, at which point the PI ID maps to the F ID and the row updates.

### 5.1 Billing / Invoicing (10)

| ID | Severity | One-liner | Evidence | Target batch | Status | Re-verification session |
|---|---|---|---|---|---|---|
| PI-01 | Critical | Payroll mixes major+minor units; percentage teachers see 100× owed | `src/hooks/usePayroll.ts:213` percentage case computes in MINOR (`lessonRateMinor * payRateValue / 100`); lines 205/207 per_lesson/hourly cases use MAJOR (`pay_rate_value` direct); both summed into `totalGrossOwed` and rendered with `fmtCurrency()` as MAJOR | 10-reports-analytics-payroll | Awaiting batch | TBD |
| PI-02 | Critical | `invoice_status` enum has `'outstanding'` value not handled anywhere | Enum permits it (verified `pg_type`/`pg_enum`); 16 rows currently `status='outstanding'` (all shadow); `get_invoice_stats` filters only `('sent','overdue')`; `enforce_invoice_status_transition` has no rule for it; LoopAssist `search_invoices` ignores; overdue cron ignores | 05-billing-invoicing | Awaiting batch | TBD |
| PI-03 | Critical | 72 invoices have `paid_minor` ≠ sum(payments) − sum(refunds) | 71 in Lauren shadow studio + 1 in E2E Test Academy; seed scripts insert payments without calling `recalculate_invoice_paid` | 05-billing-invoicing + 19-cross-cutting-data-integrity | Awaiting batch | TBD |
| PI-04 | Critical | `recalculate_invoice_paid` attempts draft→paid transition; trigger rejects → silent fail | `recalculate_invoice_paid` body unconditionally sets `'paid'` when `_net_paid >= total_minor`; `enforce_invoice_status_transition` rejects draft→paid | 05-billing-invoicing | Awaiting batch | TBD |
| PI-05 | Critical | `overpayment_minor` column populated by Stripe path but ZERO UI surfaces | grep `src/` for `overpayment_minor`: only in DB types and one help article; no component renders the value | 06-payments-stripe-connect + 11-parent-portal | Awaiting batch | TBD |
| PI-06 | High | `invoice-overdue-check` silently swallows trigger-rejection errors on plan-enabled draft invoices | `supabase/functions/invoice-overdue-check/index.ts:103-108` — destructures `data` without checking error from `.update(...).in("status",["draft","sent"])`; the trigger raises on draft→overdue → half-state | 06-payments-stripe-connect | Awaiting batch | TBD |
| PI-07 | High | `payment_intent.payment_failed` webhook only logs, no notification or surface | `supabase/functions/stripe-webhook/index.ts:299-304` — case body has only `console.error`; no notification insert, no surface in app | 06-payments-stripe-connect | Awaiting batch | TBD |
| PI-08 | High → **CRITICAL** | `record_stripe_payment` accepts `_org_id` parameter but never verifies it matches invoice org | RPC body verified — no `IF _invoice.org_id != _org_id THEN RAISE` check; Phase 7C body re-audit revealed no caller-context check at all | 06-payments-stripe-connect → **02-org-management** | **RESOLVED — re-classified as F-02-005 CRITICAL in batch 02 Phase 7C. Severity elevated HIGH → CRITICAL on body re-audit (real defect is no caller-context validation at all, not just `_org_id` mismatch). Primary ownership transferred from batch 06 to batch 02.** | s41 |
| PI-09 | High | 7+ migration files reference pre-s36 `rate_amount` column; live functions use `rate_amount_minor` | Verified via `pg_proc` regex — current live functions OK, but migration replay/rollback would break | 19-cross-cutting-data-integrity | Awaiting batch | TBD |
| PI-10 | High | Settings → Accounting tab queries `xero_connections` + `xero_entity_mappings` via anon client; tables have RLS enabled with zero policies → always returns 0 rows | `src/components/settings/AccountingTab.tsx:111,145,370,384` use shared `supabase` (anon); verified RLS on with no policies for these tables | 18-settings-tabs + 15-calendar-sync-zoom-xero | Awaiting batch | TBD |

### 5.2 Lessons / Scheduling (7)

| ID | Severity | One-liner | Evidence | Target batch | Status | Re-verification session |
|---|---|---|---|---|---|---|
| PI-11 | Critical | `check_lesson_conflicts` DB trigger enforces only 2 of 7 promised conflict checks | Trigger body confirmed (teacher + room overlap only); student double-booking, closure dates, teacher availability, time-off, travel buffer, busy blocks are app-layer only | 03-calendar-core + 04-lessons-scheduling-deep | Awaiting batch | TBD |
| PI-12 | Critical | LoopAssist `executeRescheduleLessons` bypasses ALL 7 conflict checks | `supabase/functions/looopassist-execute/index.ts` — bare `UPDATE lessons SET start_at, end_at`; DB trigger catches teacher/room only | 17-loopassist | Awaiting batch (IN-SWEEP per s41 discipline correction) | TBD |
| PI-13 | Critical | `process-term-adjustment/index.ts:720` parses `new_time` with `setUTCHours()` — no `fromZonedTime` | Day-change creates lessons at wrong UTC offset relative to calendar UI's `fromZonedTime` pattern; consistent within same DST period only | 09-term-continuation + 19-cross-cutting-timezones | Awaiting batch | TBD |
| PI-14 | High | Cancel-this-and-future cascade is fire-and-forget (recurrence cap, invoice check, parent notify) without transaction | `src/components/calendar/LessonDetailPanel.tsx:265-326` — `.then()` chain, no try/catch, no rollback | 03-calendar-core | Awaiting batch | TBD |
| PI-15 | High | No automatic credit-note generation for paid-then-cancelled lessons | Toast warns but system doesn't generate; cancel cascade only flags via toast | 03-calendar-core + 05-billing-invoicing | Awaiting batch | TBD |
| PI-16 | High | `bulk_complete_lessons` (LoopAssist) marks lessons completed regardless of attendance state | Bulk handler filters `eq("status","scheduled")` only; no participant attendance check | 17-loopassist | Awaiting batch (IN-SWEEP per s41 discipline correction) | TBD |
| PI-17 | Medium | `credit-expiry` cron uses UTC date for `expires_at` comparison; non-UTC orgs off by ±12h | `supabase/functions/credit-expiry/index.ts` — `new Date().toISOString()` baseline | 08-attendance-credits-waitlists + 19-cross-cutting-timezones | Awaiting batch | TBD |

### 5.3 Severity tally

| Severity | Count | IDs |
|---|---|---|
| Critical | 8 | PI-01, PI-02, PI-03, PI-04, PI-05, PI-11, PI-12, PI-13 |
| High | 7 | PI-06, PI-07, PI-09, PI-10, PI-14, PI-15, PI-16 |
| Medium | 1 | PI-17 |
| Low | 0 | — |
| **PI active total** | **16** | (PI-08 RESOLVED to F-02-005 CRITICAL in batch 02; historical entry retained at 17-row count for traceability) |

Per s41 discipline correction (PLAN.md §3 rule 3 — AUDIT SCOPE COMPLETENESS): prior "deferred-shelved" framing on PI-12 / PI-16 is removed; both are full Phase B scope under batch 17 ownership. Severities retained (PI-12 CRITICAL, PI-16 HIGH).

### 5.4 Additional s38 context (not findings; recorded for batch reference)

- **CHECK constraint hotfix applied via Supabase MCP** during s38 (`ai_action_proposals_status_check` extended to include `'executing'`); migration file exists at `supabase/migrations/20260523100000_ai_action_proposals_add_executing_status.sql`. The 17 historical zombie 'proposed' proposals across 6+ orgs since 2026-03-04 remain — schedule a one-off cleanup in Phase C.
- **William Lewis UUID hallucination** (LoopAssist proposal `b2155883-3c1a-43ed-a08e-329f5e66d6be`) — real William Lewis ID is `2b021243-bd7c-4e78-9001-6576d38ed3da`. Pure model fabrication. Belongs in batch 17 (LoopAssist) — IN-SWEEP per s41 correction. The underlying pattern (tools returning entity NAMES without UUIDs) affects 4 of 12 LoopAssist tools: `get_at_risk_students`, `get_attendance_summary`, `search_lessons` student mentions, `get_term_adjustments` student references.
- **Shadow studio data shape gap**: `payer_guardian_id` null on all 90 shadow invoices; `payer_student_id` set; minor-student emails null; handler can't resolve. Affects shadow-mode testing but not real production usage. Batch 19 captures.

---

## 6. Glossary

- **Path Y** — The decision (s38) to audit the entire LessonLoop application before resuming feature work, rather than reducing launch scope. Drives the work organised by this document. See `PLAN.md` §1.
- **Batch** — A scoped audit unit covering one feature area. 21 batches defined in `PLAN.md` §5. Each batch produces one findings file (`audit/sweep/findings/NN-batch.md`) when Phase B opens it.
- **Finding** — A defect, gap, or risk surfaced by audit. Format `F-{batch:02}-{seq:03}`, e.g. `F-05-007`. Has exactly one severity (Critical / High / Medium / Low) and exactly one batch. Immutable after batch closes.
- **Pre-investigation finding (PI-NN)** — A finding captured in s38 prior to Phase B opening. Lives in §5 of this file until re-verified in its target batch, at which point it becomes a real `F-NN-NNN` finding and the PI→F mapping is recorded.
- **Sprint** — A grouped fix workstream defined at the start of Phase C. Format `S-{seq:02}-{kebab-name}`, e.g. `S-01-money-convention`. Sprints are NOT defined during Phase B.
- **Severity** — Each finding has exactly one severity:
  - **Critical** — financial loss, data loss, security exposure, marketed feature fundamentally broken, or first-encounter trust erosion.
  - **High** — feature works but degraded, surprising, or unsupported; silent failure modes; missing UI for tracked DB state.
  - **Medium** — cosmetic but visible inconsistency; timezone-edge issues; non-critical race conditions; minor UX dead-ends.
  - **Low** — code-hygiene drift; stale comments; minor docstring inconsistency; legacy artefacts.
- **Gate** — A transition point between phases that requires explicit Jamie approval. E.g. Phase B → Phase C gate requires `findings/00-summary.md` reviewed and Phase C explicitly authorised.
- **EXIT condition** — The bar a session or phase must meet before reporting completion. Defined per-phase in `PLAN.md` §2 and per-session in the originating prompt.
- **Banner** — The literal text `AUDIT IN PROGRESS — DO NOT FIX YET` that appears in this file's front matter whenever Phase < C. Load-bearing: anyone reading STATUS.md sees the banner before reading anything else.
- **Hibernate list** — Features explicitly removed from audit scope. Per Jamie's s39 decision, this list is empty for Path Y. See `CENSUS.md` §12.
- **Journey (J-NN)** — A cohesion-level audit unit in batch 20-ux-flows. Traverses surfaces from multiple feature batches. 13 journeys seeded in s39; new journeys discovered in Phase B append as J14+ without renumbering. See `CENSUS.md` §11.B.
