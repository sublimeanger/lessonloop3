# Batch 10 — Reports / Analytics / Payroll

**Session**: s49
**Date**: 2026-05-15
**HEAD pin**: `<s49 Phase 10 commit SHA>`
**Status**: CLOSED
**Findings allocated**: 8 (1C / 1H / 1M / 5L)

---

## §1 Batch overview

### 1.1 Surface enumeration (CENSUS row 1220 + Phase 0 §5 + Phase 4 §4-§5 confirmations)

CENSUS row 1220 attribution: **9 routes / 9 pages / 0 edge fns / 2 RPCs / 0 triggers / 0 cron / 0 tables / 5 hooks**.

Owning-surface inventory:

| Surface class | Count | Anchors |
|---|---|---|
| Routes (CENSUS §1.4 lines 70-78 + 158) | 9 | `/reports`, `/reports/payroll`, `/reports/revenue`, `/reports/outstanding`, `/reports/lessons`, `/reports/cancellations`, `/reports/attendance`, `/reports/utilisation`, `/reports/teacher-performance` |
| Pages (CENSUS §2.2 line 157 + §2.4 lines 181-188) | 9 | `Reports.tsx` (hub) + `reports/{Revenue,Outstanding,Payroll,LessonsDelivered,Cancellations,Utilisation,AttendanceReport,TeacherPerformance}.tsx` |
| Edge functions | 0 | confirmed Phase 2 §1 + §2; batch-10 RPCs FE-only invoked |
| SECDEF RPCs (CENSUS §4.8 lines 592-593) | 2 | `get_revenue_report`, `get_teachers_with_pay` |
| Triggers | 0 | batch-10 owns no triggers; consumes audit_* triggers across 7 in-scope tables (POSITIVE Phase 1 §4.1) |
| Cron jobs | 0 | Phase 2 §5 confirmed: 26 active cron jobs, ZERO batch-10 surface matches |
| Tables | 0 | batch-10 owns no tables; consumes invoices/lessons/payments/etc. tables (closed-batch immutable) |
| Hooks (CENSUS §11.A row-10 + §10.A lines 1036/1074/1150-1152) | 5 | `useAttendanceReport`, `usePaymentAnalytics`, `useReports` (5 multi-exports), `usePayroll`, `useTeacherPerformance` |

**Cat C edits (8 scoped for Phase 10)**:
- `ai_interaction_metrics` → batch-17 row (writer-owned per Phase 1 §3 reviewing-Claude adjudication)
- Dashboard widgets owning batch-10: DashboardHero + FinanceDashboard + PaymentAnalyticsCard (3 new analytics-owning widgets per Phase 4 §4)
- Shared reports primitives batch-10: DateRangeFilter + ReportPagination + ReportSkeleton + SortableTableHead (4 collocation-implied entries per Phase 4 §5)

### 1.2 Batch close metadata

- **Session**: s49 (2026-05-15)
- **Prior session**: s48 closed batch-09 term-continuation at HEAD `a49b658b` (10 findings: 1C/4H/1M/4L)
- **HEAD pin (s49 close)**: `<s49 Phase 10 commit SHA>` (literal placeholder per drift #25; SHA recorded externally)
- **Phase timeline**: 10 phases executed (0-10); see §11 audit-method appendix for per-phase summary

### 1.3 Finding count + severity histogram

**8 findings / 1C / 1H / 1M / 5L**:
- F-10-001 CRITICAL · F-10-002 HIGH · F-10-005 MEDIUM
- F-10-003 / F-10-004 / F-10-006 / F-10-007 / F-10-008 LOW

### 1.4 Session phase summary (input to §11 audit-method)

| Phase | Tasks | Output highlight |
|---|---|---|
| 0 | Baseline + drift #27 ratification + read-first ingestion | HEAD verified `a49b658b`; tally 134/18C/40H/25M/51L confirmed; cohort 6 (2C/3H/1M/0L); drift #27 ratified Cat 1 26→27; cumulative methodology 28→29 |
| 1 | DB surface deep dive — 2 batch-10 RPC bodies + ai_interaction_metrics + triggers + CHECK constraints + pay_rate_value distribution + views + helpers | invoice_stats_mv cluster surfaced (F-10-002 seed); divide-by-zero auth gate surfaced (POS-4 + F-10-003 seed); pay_rate_value units inference (F-10-001 strong hypothesis); CC-19 #11 cohort growth +3 negatives (F-10-004 seed) |
| 2 | Edge function enumeration + invoice_stats_mv lifecycle + pg_cron + Sub-D baseline | 0 batch-10 edge fns confirmed; 0 cross-batch consumers; invoice_stats_mv stale-by-design + post-pg_cron-enablement inaction; 26 cron jobs no batch-10 matches |
| 3 | Frontend payroll deep dive — F-10-001 PI-01 verification | F-10-001 CRITICAL CONFIRMED end-to-end 100× falsification trace; 5 surfaces; Pattern #38 candidate evidence (TeacherLink/QuickView POSITIVE; usePayroll.ts:213 NEGATIVE) |
| 4 | Frontend reports deep dive — 8 pages + 4 hooks + 16 dashboard widgets + 4 shared primitives | F-10-005 + F-10-006 + F-10-007 surfaced; class-pattern observations across 3 owning + 13 consumer widgets; tier-gating flag-presence at Reports.tsx:104; methodology drift #28 surfaced (Cat 3 CC-origin) |
| 5 | Severity adjudication + S-03 6-dim rubric + Utilisation full-read sweep | F-10-001 CRITICAL same-bracket confirmation; F-10-002 HIGH event #13 via class-precedent reassessment (D4 NO regulatory + D3 PARTIAL payload); F-10-005 MEDIUM; F-10-003/004/006/007 LOW; S-13 NEW seed F-10-007 surfaced via Utilisation sweep-completeness closure |
| 6 | Class-pattern cohort cross-reference (33 placed + 3 candidates + 1 NEG flag) + CC-19 #1 EXECUTE-grant verification | CC-19 #1 +2 batch-10 anchors via DB-verified `has_function_privilege()` query (get_revenue_report + get_teachers_with_pay both anon EXECUTE = true despite body-gate); Pattern #27 NEGATIVE-instance at AttendanceReport.tsx:59-73 enumerated; methodology drift #28 ratified |
| 7 | F-10-008 formal allocation + CC-19 carry update + drift #29 ratification | F-10-008 LOW cohort 2 anchors allocated per F-09-002 class-precedent; drift #29 Cat 1 RC-origin ratified; cumulative methodology 30→31 |
| 8 | Pattern catalog ratification proposals (3 promotions + 3 sub-class introductions + 1 observation) | Pattern #38 RATIFIED; #37 + #39 DEFERRED batch-19; POS-4 + NOT-VALID + Orphan MV sub-classes RATIFIED; RLS-canonical-FE-cosmetic recorded as observation only |
| 9 | This findings doc | (this section) |
| 10 | Doc edits + commit + handover snapshot (Phase 10 pending) | STATUS.md / HANDOVER.md / PLAN.md / CENSUS.md edits per §10b mandate |

---

## §2 PI map

### 2.1 PI-01 closure

**PI-01 CRITICAL** (payroll percentage 100× error; carried s38 → s48) → **F-10-001 CRITICAL closure** (same-bracket confirmation; NOT event).

Pre-tag was CRITICAL single-bracket-committed since s38 launch. Phase 3 verification at HEAD confirmed via end-to-end trace at [usePayroll.ts:213](src/hooks/usePayroll.ts:213) (5 surfaces; magnitude factors a/b/c enumerated §3). Adjudication type per handover §18: same-bracket confirmation does NOT increment event counter.

### 2.2 PI register transition

| Pre-s49 PI cohort | Post-s49 PI cohort |
|---|---|
| **6 active+partial** (2C / 3H / 1M / 0L) | **5 active+partial** (1C / 3H / 1M / 0L) |
| PI-01 CRITICAL (batch-10) | (PI-01 CLOSED at s49) |
| PI-12 CRITICAL (batch-17) | PI-12 CRITICAL (batch-17) |
| PI-09 HIGH (batch-19) | PI-09 HIGH (batch-19) |
| PI-10 HIGH (batch-15+18) | PI-10 HIGH (batch-15+18) |
| PI-16 HIGH (batch-17) | PI-16 HIGH (batch-17) |
| PI-17 MEDIUM (batch-08+19 partial) | PI-17 MEDIUM (batch-08+19 partial) |

### 2.3 Event-counter implication

S-03 reassessment is the event-counter driver this session (event #13 F-10-002 HIGH via class-precedent reassessment; F-08-003 mechanism shape). PI-01 closure is NOT event #13.

**Cumulative severity-adjustment events post-s49**: **13** (12 pre-s49 + 1 event #13).

---

## §3 Finding inventory (8 findings)

### 3.1 F-10-001 CRITICAL — Payroll percentage 100× falsification (PI-01 closure)

| Field | Value |
|---|---|
| **ID** | F-10-001 |
| **Severity** | CRITICAL |
| **Class** | financial-falsification (PI-01 closure; same-bracket confirmation) |
| **Anchor** | [usePayroll.ts:213](src/hooks/usePayroll.ts:213) — `calculatedPay = Math.round(lessonRateMinor * teacherInfo.payRateValue / 100);` |
| **Class-precedent** | F-02-005 + F-07-003 + F-09-001 anchor stack + PLAN.md §4 "first-encounter trust erosion" criterion |
| **Surfaces (5)** | (1) usePayroll.ts:213 (root unit-mixing); (2) [Payroll.tsx:164](src/pages/reports/Payroll.tsx:164) Total Gross Owed card via fmtCurrency; (3) [Payroll.tsx:278](src/pages/reports/Payroll.tsx:278) per-teacher Gross Owed via fmtCurrency; (4) [Payroll.tsx:316](src/pages/reports/Payroll.tsx:316) per-lesson Pay column via fmtCurrency; (5) [usePayroll.ts:277](src/hooks/usePayroll.ts:277) + [L283](src/hooks/usePayroll.ts:283) CSV export (`teacher.grossOwed.toFixed(2)` + `data.totalGrossOwed.toFixed(2)` under header `Gross Owed (£)`) |
| **Magnitude factors** | (a) UI fully selectable at HEAD ([Teachers.tsx:107-117](src/pages/Teachers.tsx:107)) — no feature flag, no tier gate beyond admin role; (b) ZERO percentage teachers in DB pre-launch (Phase 1 §5 distribution: 4 per_lesson + 1 hourly + 92 NULL; 0 percentage); (c) high-detectability + high-confidence-misuse class (visible at per-teacher + aggregate + CSV with method-label adjacent at Payroll.tsx:257). Magnitude (b) MODULATES not SHIFT bracket per s47 F-08-001 magnitude-not-bracket precedent. |
| **End-to-end trace** | Teacher with `pay_rate_type='percentage'`, `pay_rate_value=40`, lesson with `lesson_participants.rate_minor=1500` (£15): `calculatedPay = Math.round(1500 × 40 / 100) = 600` MINOR → grossOwed = 600 → totalGrossOwed = 600 → fmtCurrency(600) → **"£600.00"** ← SHOULD BE "£6.00". 100× falsified. |
| **Class-consistency POSITIVE** | [TeacherLink.tsx:213](src/components/shared/TeacherLink.tsx:213) + [TeacherQuickView.tsx:215](src/components/teachers/TeacherQuickView.tsx:215) (batch-02 closed) correctly handle MAJOR→MINOR via explicit `* 100` before formatCurrencyMinor; usePayroll.ts hook does NOT. Pattern #38 candidate evidence (RATIFIED Phase 8). |
| **Remediation class** | Unit-mixing fix at usePayroll.ts:213. Two viable approaches: (a) convert `pay_rate_value` MAJOR to MINOR before multiply (`payRateValueMinor = payRateValue * 100`); OR (b) convert `lessonRateMinor` MINOR to MAJOR before multiply (`lessonRateMajor = lessonRateMinor / 100`). Both align downstream consumers (fmtCurrency MAJOR-expecting). |
| **Bracket driver** | Same-bracket confirmation; NOT a severity-adjustment event |

### 3.2 F-10-002 HIGH — `invoice_stats_mv` cross-tenant aggregate-financial disclosure (event #13)

| Field | Value |
|---|---|
| **ID** | F-10-002 |
| **Severity** | HIGH (event #13 via class-precedent reassessment from CRITICAL default-expectation via F-02-002 anchor) |
| **Class** | information-disclosure cross-tenant aggregate-financial (sub-class kin to F-05-007 storage-path enumeration HIGH) |
| **Anchor** | DB-verified `invoice_stats_mv` materialized view; [migrations/20260312000000_invoice_stats_materialised_view.sql:9](supabase/migrations/20260312000000_invoice_stats_materialised_view.sql:9) |
| **Class-precedent** | F-02-002 CRITICAL anchor reassessed via 6-dim divergence: 2 MATCH (D1 cross-tenant + D2 anon-reachable) + 2 PARTIAL (D3 payload sensitivity aggregate-not-row-level + D5 trust-erosion partial) + 1 NO (D4 regulatory scope: no GDPR Art 9/33) + 1 NEUTRAL (D6 composition). F-05-007 HIGH information-disclosure precedent supports bracket placement between F-02-002 and F-09-003. |
| **5-dimension evidence** | (1) DB-verified `anon=SELECT TRUE` on `invoice_stats_mv` (Postgres MVs lack RLS by design; Phase 1 §4.3); (2) Stale-by-design — migration line 28-33 refresh schedule COMMENTED OUT ("Uncomment when pg_cron is available"); (3) pg_cron NOW ENABLED at HEAD (v1.6.4 active per Phase 2 §5) but `refresh-invoice-stats` cron job NEVER SCHEDULED — post-blocker-resolution inaction class-shape; (4) Status-enum inclusion of 'outstanding' (line 12 of MV body resurrects dead-end status per F-05-003 closure); (5) Zero consumers triple-verified (Phase 1 §4.3 + Phase 2 §4 + Phase 4 §11) — no FE refs, no edge fn refs. |
| **Magnitude factors** | (a) zero real DB rows pre-launch; (b) zero code consumers triple-confirmed; both MODULATE not SHIFT bracket per class-consistency precedent. |
| **4-element magnitude rubric** (Phase 5 §13 Q4 reusable refinement) | (i) aggregate-not-row-level (vs F-02-002 row-level); (ii) commercial-not-regulated (vs F-02-002 GDPR Art 9); (iii) zero-real-rows (pre-launch context); (iv) zero-consumers (triple-verified). |
| **Driver type** | class-precedent reassessment (F-08-003 event #11 mechanism shape; PI-09 anchor reassessment kinship) |
| **Sub-class under CC-19 #15** | "Orphan MV with anon-SELECT + stale-by-design" — Phase 8 sub-class introduction RATIFIED (3rd sub-shape under CC-19 #15 dead-code SECDEF + orphan trigger fns; class-distinct from F-06-006/F-07-005 zero-binding sub-shape and dead-code SECDEF RPC sub-shape) |
| **Remediation class** | DROP MATERIALIZED VIEW invoice_stats_mv (preferred — dead code); OR REVOKE SELECT FROM anon + REFRESH-schedule activation if MV is meant to be live |
| **Bracket driver** | event #13 — class-precedent reassessment |

### 3.3 F-10-003 LOW — `get_revenue_report` divide-by-zero auth gate + consumer-side raw error propagation

| Field | Value |
|---|---|
| **ID** | F-10-003 |
| **Severity** | LOW |
| **Class** | auth-gate UX class observation (POS-4 sub-class introduction RATIFIED Phase 8) |
| **Anchors (3)** | (1) [get_revenue_report:13](supabase/migrations) SQL body div-by-zero auth gate `SELECT 1 / (CASE WHEN is_org_finance_team(auth.uid(), _org_id) THEN 1 ELSE 0 END);` (batch-10-OWNED, NOT closed-batch immutable); (2) [useReports.ts:71](src/hooks/useReports.ts:71) `if (error) throw error;` — raw error propagation without auth-detection; (3) [Revenue.tsx:88](src/pages/reports/Revenue.tsx:88) `description={error.message}` — displays raw "division by zero" SQL error message to operator instead of "Access denied" |
| **Class-precedent** | POS-4 sub-class introduction Phase 8 — no direct anchor in batches 01-09; auth-gate-UX class family enumerated with 3 other sub-shapes (RAISE / soft-fail / return-null) for class-distinct contrast |
| **Magnitude factors** | UX-only; auth correctness preserved; no data exposure; operator sees confusing message instead of "Access denied" |
| **Sub-class POS-4 discriminating rule** | SECDEF SQL fn implements auth gate via SELECT 1/(CASE WHEN auth THEN 1 ELSE 0 END); raises raw 'division by zero' SQL error on auth-denied rather than RAISE EXCEPTION with auth-specific message. Operator-debugging-friction class. |
| **Remediation class** | Replace div-by-zero with `RAISE EXCEPTION 'Access denied'` in get_revenue_report body + FE error-class detection at useReports.ts:71 (translate to user-friendly "Access denied" before throwing) |
| **Bracket driver** | LOW per operator-debugging-friction class; NOT security exposure, NOT financial-falsification, NOT silent-failure-mode |

### 3.4 F-10-004 LOW — CC-19 #11 schema-column-constraint cohort (teachers.pay_rate_*)

| Field | Value |
|---|---|
| **ID** | F-10-004 |
| **Severity** | LOW |
| **Class** | CC-19 #11 schema-column-constraint cohort (cohort 11 → 14 entries post-s49: 12 negative + 2 positive) |
| **Anchors (3)** | (1) `teachers.pay_rate_value` no positive CHECK constraint (DB-verified Phase 1 §4.2); (2) `teachers.pay_rate_value` no `[0,100]` range CHECK for `percentage` type (DB-verified Phase 1 §4.2); (3) `teachers_pay_rate_type_check` **NOT VALID** (DB-verified `convalidated=false`; definition: `CHECK (((pay_rate_type IS NULL) OR (pay_rate_type = ANY (ARRAY['per_lesson'::pay_rate_type, 'hourly'::pay_rate_type, 'percentage'::pay_rate_type]))))`; pre-existing rows unscanned at constraint add) |
| **Class-precedent** | F-09-012 LOW (4-column CHECK cohort) + F-07-006/007 LOW (amount_minor positive CHECK) + F-05-010 LOW (check_invoice_item_amounts invariant gap) — all LOW class CAPS-at-LOW per CC-19 #11 cohort precedent |
| **Magnitude factors** | Pre-launch zero exercise paths; defence-in-depth code-hygiene class |
| **Sub-class NOT-VALID variant introduction (Phase 8 RATIFIED)** | CC-19 #11 cohort sub-shape inventory grows from 2 → 3 sub-shapes: (i) "absent" (no constraint, no enforcement); (ii) "present-validated" (constraint + all rows scanned); (iii) **"present-NOT-VALID" (NEW)** — constraint present + new-row enforcement + pre-existing rows unscanned (false-confidence-at-HEAD class). Anchor (3) above is the NOT-VALID sub-shape instance. |
| **Remediation class** | `ALTER TABLE teachers ADD CONSTRAINT chk_pay_rate_value_positive CHECK (pay_rate_value IS NULL OR pay_rate_value > 0)` + `ALTER TABLE teachers ADD CONSTRAINT chk_pay_rate_percentage_range CHECK (pay_rate_type <> 'percentage' OR (pay_rate_value >= 0 AND pay_rate_value <= 100))` + `ALTER TABLE teachers VALIDATE CONSTRAINT teachers_pay_rate_type_check` |
| **Bracket driver** | LOW per class-precedent CC-19 #11 cohort |

### 3.5 F-10-005 MEDIUM — FE-direct subtraction-without-clamp on outstanding aggregation (cohort 2 anchors)

| Field | Value |
|---|---|
| **ID** | F-10-005 |
| **Severity** | MEDIUM |
| **Class** | FE-direct aggregate cosmetic-but-visible cohort (NEW class shape; batch-19 carry per Phase 6 §10 Q4 + reviewing-Claude Phase 7 §(4) endorsement) |
| **Anchors (cohort 2)** | (1) [useReports.ts:207](src/hooks/useReports.ts:207) `const remainingMinor = inv.total_minor - (inv.paid_minor || 0);` — no zero-clamp; propagates to [Outstanding.tsx:135](src/pages/reports/Outstanding.tsx:135) Total Outstanding card + [Outstanding.tsx:150](src/pages/reports/Outstanding.tsx:150) Total Overdue card via fmtCurrency; (2) [usePaymentAnalytics.ts:89-92](src/hooks/usePaymentAnalytics.ts:89) `outstandingMinor = outstandingInvoices.reduce((sum, inv) => sum + ((inv.total_minor || 0) - (inv.paid_minor || 0)), 0);` — same shape; propagates to [PaymentAnalyticsCard.tsx:75](src/components/dashboard/PaymentAnalyticsCard.tsx:75) via formatCurrencyMinor |
| **Class-precedent** | PI-17 MEDIUM anchor (cosmetic-but-visible inconsistency rubric) + F-04-005 MEDIUM (audit-trigger gap content-recoverable mitigation); F-09-009 cohort framing precedent for 2-anchor allocation |
| **Magnitude factors** | (a) F-06-005 closed-batch overpayment_minor populator path exists in production code (overpayment data could exist post-launch); (b) pre-launch zero overpaid invoices = "available but unused" magnitude factor; (c) Outstanding.tsx headline visibility is HIGH (operator looking at receivables would notice negative immediately); (d) trigger gated on overpayment edge case (rare not first-encounter) |
| **Bracket driver** | MEDIUM per PI-17 anchor (cosmetic-but-visible); headline-visibility class-shape over trigger-rarity magnitude per reviewing-Claude Phase 5 §(2) confirmation |
| **Remediation class** | Add `Math.max(0, ...)` clamp at both subtraction sites |

### 3.6 F-10-006 LOW — Consumer-of-RPC defensive-clamp absence on get_invoice_stats return

| Field | Value |
|---|---|
| **ID** | F-10-006 |
| **Severity** | LOW |
| **Class** | consumer-of-RPC defensive-clamp absence (defence-in-depth class; batch-19 carry per Phase 6 §10 Q4) |
| **Anchor** | [useReports.ts:628](src/hooks/useReports.ts:628) `const outstandingAmount = (invoiceStats?.total_outstanding ?? 0) / 100;` — `?? 0` handles null/undefined but NOT negative; if upstream RPC (get_invoice_stats body, batch-05 closed-immutable) returns negative `total_outstanding` (overpayment edge case per F-06-005), it propagates through to [FinanceDashboard.tsx:88](src/components/dashboard/FinanceDashboard.tsx:88) display |
| **Class-precedent** | F-09-002 LOW (anon+PUBLIC EXECUTE despite body-gate; hygiene class) + F-05-009 LOW (RecurringRunDetail inline + vestigial PII select) |
| **Magnitude factors** | RPC body batch-05 closed-immutable is root cause; FE consumer is defence-in-depth; FinanceDashboard.tsx:88 displays outstandingAmount → would show "-£NN" if RPC returns negative; [DashboardHero.tsx:281](src/components/dashboard/DashboardHero.tsx:281) conditionally guarded `if (outstandingAmount > 0)` (line 279) — doesn't show negative |
| **Retain-split from F-10-005** | Class-shape distinction: F-10-006 = consumer-of-RPC trust pattern (problem upstream); F-10-005 = FE-direct compute (FE owns the compute). Different remediation surfaces. Class-cohort precedent F-09-009 + F-09-012 + F-08-005 single-locus shapes prefer split over mixing compute-loci. F-09-008/F-09-010 retain-split precedent endorsed Phase 5 §6. |
| **Remediation class** | Add `Math.max(0, ...)` defensive clamp at useReports.ts:628 |
| **Bracket driver** | LOW per F-09-002 hygiene class precedent |

### 3.7 F-10-007 LOW — `Utilisation.tsx` lesson-cap silent truncation

| Field | Value |
|---|---|
| **ID** | F-10-007 |
| **Severity** | LOW |
| **Class** | partial-result visibility (intra-batch class-consistency drift; batch-19 carry per Phase 6 §10 Q4) |
| **Anchor** | [Utilisation.tsx:90](src/pages/reports/Utilisation.tsx:90) `await lessonsQuery.limit(10000);` — NO subsequent warning emit if `lessons.length === 10000` |
| **Class-precedent** | Sibling-hooks-have-warning precedent within batch-10: useLessonsDeliveredReport at [useReports.ts:307-309](src/hooks/useReports.ts:307) + useCancellationReport at [useReports.ts:459-461](src/hooks/useReports.ts:459) BOTH add `warnings.push(...)` when results >= 10000; F-09-010 LOW UI-side partial-failure visibility (retain-split kin) |
| **Magnitude factors** | Magic-cap 10000 lessons in single date range is unusual for Lauren-target small/medium music studios (~300 lessons/day for a month required to trigger); large agencies could hit it |
| **Surfaced via** | Phase 5 §1 sweep-completeness closure (Utilisation full-read mandate per §9 rule 8) — NEW seed S-13 from Phase 5 |
| **Remediation class** | Add `if (lessons.length >= 10000) warnings.push("Results may be incomplete — your date range contains more than 10,000 lessons. Try a shorter period.");` consistent with sibling batch-10 hooks |
| **Bracket driver** | LOW per intra-batch class-consistency drift class |

### 3.8 F-10-008 LOW — SECDEF RPC anon-EXECUTE-grant cohort despite body-gate

| Field | Value |
|---|---|
| **ID** | F-10-008 |
| **Severity** | LOW |
| **Class** | SECDEF RPC anon-EXECUTE-grant despite body-gate (CC-19 #1 helper-fn EXECUTE-grant hygiene class) |
| **Class-precedent** | F-09-002 LOW (`recalc_continuation_summary` anon+PUBLIC EXECUTE despite body-gate; s48 close) |
| **Cohort framing precedent** | F-09-009 useCan cohort (13 anchors) + F-09-012 CHECK cohort (4 anchors) + F-08-005 silent-swallow cohort (3 anchors) — single-class cohort with multiple anchors |
| **Anchors (cohort 2; DB-verified Phase 6 §3)** | (1) **`get_revenue_report(_org_id, _start_date, _end_date, _prev_start_date, _prev_end_date)`** — `has_function_privilege('anon', oid, 'EXECUTE') = true`; body-gate via div-by-zero pattern at L13 `SELECT 1 / (CASE WHEN is_org_finance_team(auth.uid(), _org_id) THEN 1 ELSE 0 END);` (Phase 1 §1.1.b verbatim — solidly protective); (2) **`get_teachers_with_pay(p_org_id uuid, p_teacher_ids uuid[])`** — `has_function_privilege('anon', oid, 'EXECUTE') = true`; body-gate via `SELECT om.role INTO _role FROM org_memberships WHERE user_id = auth.uid()` + role-IN check + `RAISE EXCEPTION` on insufficient role at L33 (Phase 1 §1.1.a verbatim — solidly protective via RAISE) |
| **Magnitude factors** | (a) Body-gates are functionally protective: div-by-zero raises on non-finance-team (also F-10-003 UX class); RAISE EXCEPTION on non-staff/insufficient role; defence-in-depth class. (b) Pre-launch zero exercise paths via anon (no anon callers for reports surface). (c) Class-consistency with F-09-002 precedent at LOW. |
| **Late-surfacing context** | Phase 6 §3 via CC-19 #1 carry investigation (methodology drift #29 ratification at Phase 7 §1: Phase 1 launch prompt task 1.1 did not specify EXECUTE grant enumeration; future Phase 1 prompts MUST include `has_function_privilege()` queries per drift #29 mitigation rule) |
| **Remediation class** | `REVOKE EXECUTE ON FUNCTION public.get_revenue_report(uuid, date, date, date, date) FROM PUBLIC, anon;` + `REVOKE EXECUTE ON FUNCTION public.get_teachers_with_pay(uuid, uuid[]) FROM PUBLIC, anon;` retaining GRANT EXECUTE to authenticated + service_role + postgres |
| **Bracket driver** | LOW per F-09-002 class-precedent (hygiene-class drift; body-gate compensates) |

---

## §4 Severity adjudication ledger

| Seed | Final ID | Pre-tag | Phase 5/7 bracket | Driver | Class-precedent | Event implication |
|---|---|---|---|---|---|---|
| S-01 (PI-01) | F-10-001 | CRITICAL (s38 single-bracket committed) | CRITICAL | same-bracket confirmation | F-02-005 + F-07-003 + F-09-001 anchor stack | NOT event |
| S-02 + S-11 (clustered Option A) | F-10-003 | LOW class observation | LOW | confirmed within-bracket | POS-4 sub-class candidate Phase 8 (no anchor) | NOT event |
| S-03 (invoice_stats_mv) | F-10-002 | TBD (ambiguous default-expectation CRITICAL via F-02-002 anchor) | HIGH | **class-precedent reassessment (F-08-003 event #11 mechanism)** | F-02-002 anchor reassessed; D4 NO + D3 PARTIAL drove bracket-shift; F-05-007 HIGH supports | **EVENT #13** |
| S-04 + S-05 + S-06 (cohort) | F-10-004 | LOW (all sub-seeds) | LOW | confirmed within-bracket | F-09-012 + F-07-006/007 + F-05-010 | NOT event |
| S-07 (retain-split) | F-10-006 | MEDIUM/LOW (bracket-pair pre-tag) | LOW | ambiguous-pre-tag selection | F-09-002 + F-05-009 hygiene class | NOT event |
| S-10 (retain-split cohort) | F-10-005 | MEDIUM/LOW (bracket-pair pre-tag) | MEDIUM | ambiguous-pre-tag selection | PI-17 + F-04-005 MEDIUM | NOT event |
| S-13 (NEW Phase 5) | F-10-007 | (none; Phase 5 surfaced) | LOW | Phase 5 NEW seed | sibling-hooks-have-warning + F-09-010 | NOT event |
| S-08/S-09/S-12 | NOT-allocated / Cat C | NOT-allocated | n/a | (POSITIVE Pattern #39 candidate evidence; CENSUS Cat C only) | (deferred batch-19 + Phase 9 Cat C) | NOT event |
| CC-19 #1 cohort (Phase 6 §3) | **F-10-008** | (none; late-surfaced via methodology drift #29) | LOW | class-precedent allocation | F-09-002 | NOT event |

**Cumulative severity-adjustment events post-s49**: **13 events** (event #13 = F-10-002 HIGH via class-precedent reassessment; F-08-003 mechanism shape).

---

## §5 Class-pattern membership matrix

### 5.1 F-10-NNN × class-pattern matrix

| Finding | Class-pattern memberships |
|---|---|
| F-10-001 | Schema column constraint CC-19 #11 (via F-10-004 cohort kinship; teachers.pay_rate_* input column); financial-falsification class anchor stack (F-02-005 + F-07-003 + F-09-001); TS-bypass-cast Sub-A literal CC-19 #7 (+3 sites at L116/L154/L158); **Pattern #38 RATIFIED NEGATIVE instance** |
| F-10-002 | Information-disclosure cross-tenant enumeration (anchor +1, batch-19 carry); CC-19 #15 dead-code SECDEF + orphan trigger fns sub-shape (**Orphan MV sub-class RATIFIED Phase 8**); event #13 |
| F-10-003 | **POS-4 Divide-by-zero auth gate sub-class RATIFIED Phase 8** (auth-gate-UX class family) |
| F-10-004 | Schema column constraint CC-19 #11 cohort (+3 negatives; cohort 11 → 14: 12 negative + 2 positive); **Present-NOT-VALID variant sub-class RATIFIED Phase 8** |
| F-10-005 | FE-direct aggregate cosmetic-but-visible cohort (NEW class shape; batch-19 carry); F-09-009 cohort framing precedent |
| F-10-006 | Consumer-of-RPC defensive-clamp absence class (batch-19 carry); F-09-002 hygiene class kin |
| F-10-007 | Partial-result visibility intra-batch drift (batch-19 carry); F-09-010 retain-split kin |
| F-10-008 | CC-19 #1 helper-fn EXECUTE-grant hygiene cohort (+2 anchors); F-09-002 class-precedent kin |

### 5.2 Pattern catalog state transitions (Phase 8 RATIFIED)

**Pattern #38 RATIFIED to placed slot**: "Unit-conversion discipline at the formatter boundary"
- Discriminating rule: MAJOR-stored monetary values converted to MINOR via explicit `* 100` immediately before passing to `formatCurrencyMinor` (or equivalent MINOR-expecting formatter); class-distinct from naked-value + formatCurrency (MAJOR-expecting) which is the F-10-001 failure shape.
- 4 POSITIVE instances (across batches 02, 06, 10): TeacherLink.tsx:213; TeacherQuickView.tsx:215; PaymentAnalyticsCard.tsx (multiple sites); ActiveDisputesCard.tsx:41
- 1 NEGATIVE instance (batch-10): usePayroll.ts:213 (F-10-001 anchor)

**Pattern #37 + #39 DEFERRED to batch-19 candidates**:
- #37 "Read-only-report-RPC FE-invocation discipline" — single-batch evidence; slot reserved
- #39 "Defensive `?? 0` fallback on RPC json-shape return" — single-batch single-instance evidence; slot reserved

**3 Sub-class introductions RATIFIED (no Pattern slot consumed)**:
- POS-4 "Divide-by-zero auth gate" under auth-gate-UX class family
- "Present-NOT-VALID variant" under CC-19 #11 schema-column-constraint cohort
- "Orphan MV with anon-SELECT + stale-by-design" under CC-19 #15

**Pattern observation recorded (no allocation)**:
- "RLS-canonical-FE-cosmetic role-check" — 7 batch-10 sites (see §11)

### 5.3 Updated catalog state post-s49

| Category | Pre-s49 | Post-s49 | Delta |
|---|---|---|---|
| Placed patterns | 33 | 34 | +1 (#38) |
| Candidates (batch-19 / post-launch deferred) | 3 (#26, #29, #34) | 5 (#26, #29, #34, #37, #39) | +2 (#37, #39 deferred) |
| NEGATIVE-instance sub-class flags | 1 (Pattern #27 sub-B) | 1 unchanged | 0 |
| Sub-shape inventory expansion | — | +3 (POS-4 / NOT-VALID / Orphan MV) within existing CC-19 carries | +3 |

---

## §6 CC-19 # contributions

| CC-19 # | Description | Batch-10 contribution | Cumulative post-s49 |
|---|---|---|---|
| **#1** | Helper-fn EXECUTE-grant hygiene | **+2 cohort anchors via F-10-008** (get_revenue_report + get_teachers_with_pay both `anon EXECUTE = true` despite body-gate solid) | Active; F-10-008 + F-09-002 anchor cohort |
| **#3** | audit_log INSERT integrity gap | 0 batch-10 findings + 1 architectural-exception sub-class candidate (ai_interaction_metrics zero triggers; batch-17-owned per Phase 1 §3); 7-of-8 in-scope tables POSITIVE class-consistency | Active (mixed; batch-17 sub-class carry) |
| **#6** | Org-context spoofing (parameter-spoofing class) | 0 negatives; 1 POSITIVE (get_teachers_with_pay role-gate clean per Phase 1 §1.1.a) | ~49 unchanged |
| **#7** | Generated-types pipeline drift (TS-bypass-cast Sub-A literal) | +~12 Sub-A literal + 1 Sub-D2 (useAttendanceReport.ts:52 `queryBuilder: any`) | ≥376 → ~388 raw |
| **#8** | E2E fixture hygiene | delta 0 vs s48 baseline (471 passed / 5 failed / 30 test files (28+2) / 3 unhandled rejections — Phase 0 §1 baseline carries through Phase 7 §6 verified) | Active (carry continues) |
| **#10** | Sentry edge-fn instrumentation | 0 batch-10 edge fns; 0 cross-batch consumer fns (Phase 2 §3 NOT APPLICABLE) | ~8 unchanged |
| **#11** | CI-enforced positive-amount CHECK | +3 negatives (F-10-004 cohort) | Cohort 11 → 14 (12 negative + 2 positive); Phase 8 sub-class introduction NOT-VALID variant |
| **#14** | Claimed-service-role-gate misnaming | 0 instances | 2 anchors unchanged |
| **#15** | Dead-code SECDEF + orphan triggers | +1 sub-class candidate (F-10-002 orphan MV invoice_stats_mv with anon-SELECT + stale-by-design; Phase 8 sub-class introduction RATIFIED) | 4 instances + 1 sub-class introduction |

---

## §7 PI closures + enrichments

### 7.1 PI-01 closure detail

**PI-01 CRITICAL** → **F-10-001 CRITICAL** (same-bracket confirmation).

| Field | Value |
|---|---|
| PI tagged | s38 (single-bracket CRITICAL) |
| Sessions carried | s38 → s48 (11 sessions) |
| Closure session | s49 |
| Phase 3 verification | CONFIRMED CRITICAL via end-to-end trace at usePayroll.ts:213 (Phase 3 §4-§5) |
| Magnitude factors | (a) UI fully selectable; (b) zero current DB rows pre-launch; (c) high-detectability + high-confidence-misuse class |
| Bracket driver | Same-bracket confirmation; NOT a severity-adjustment event |
| Class-precedent chain | F-02-005 (financial-falsification anchor) + F-07-003 (composition-chain CRITICAL) + F-09-001 (anon-callable financial-downstream anchor) |
| PI register impact | Active cohort 6 → 5 (−1C) |

### 7.2 Enrichments

**None this session.** PI-09 unchanged (no batch-10 phantom-RPC class instances). PI-17 unchanged (timezone class continues batch-19 carry). PI-10 + PI-12 + PI-16 unchanged (out-of-scope batches).

---

## §8 Cumulative tally arithmetic (drift #27 two-line check)

### 8.1 Two-line arithmetic

**(a) PI cohort math**: `pre − closures + enrichments = post`
- Pre: 6 active+partial (2C/3H/1M/0L)
- Closures: PI-01 CRITICAL → F-10-001 = **−1C**
- Enrichments: 0
- Post: **5 active+partial (1C/3H/1M/0L)** ✓

**(b) Grand active math**: `pre + batch findings delta + PI cohort bracket delta = post`
- Pre: 134 (18C/40H/25M/51L)
- Batch-10 findings delta (8 findings): +1C (F-10-001) + 1H (F-10-002) + 1M (F-10-005) + 5L (F-10-003/004/006/007/008) = **+8**
- PI cohort bracket delta: **−1C** (PI-01 closure)
- Post: 134 + 8 − 1 = **141** ✓

### 8.2 Bracket cross-verification

| Bracket | Pre | F-10-NNN allocations | PI closure | Post |
|---|---|---|---|---|
| Critical | 18 | +1 (F-10-001) | −1 (PI-01 closed) | **18** |
| High | 40 | +1 (F-10-002) | 0 | **41** |
| Medium | 25 | +1 (F-10-005) | 0 | **26** |
| Low | 51 | +5 (F-10-003 + F-10-004 + F-10-006 + F-10-007 + F-10-008) | 0 | **56** |
| **Sum** | 134 | +8 | −1 | **141** ✓ |

Cross-verified: 18 + 41 + 26 + 56 = **141** ✓ matches §8.1 grand active.

**Net delta s48 → s49**: 0C / +1H / +1M / +5L = **+7 net** by bracket.

---

## §9 Cross-batch carries

### 9.1 Tier-gating flag-presence sites (batch-16 cross-batch)

5 tier-gating sites confirmed PRESENT per Phase 4 §10:

| Site | File:line | Required feature |
|---|---|---|
| Reports hub useFeatureGate call | [Reports.tsx:104](src/pages/Reports.tsx:104) | `report.requiredFeature \|\| 'advanced_reports'` |
| Reports hub isLocked guard | [Reports.tsx:109](src/pages/Reports.tsx:109) | `report.requiredFeature && !featureGate.hasAccess` |
| TeacherPerformance hook check | [TeacherPerformance.tsx:53](src/pages/reports/TeacherPerformance.tsx:53) | `useFeatureGate('teacher_performance')` |
| TeacherPerformance wrapper | [TeacherPerformance.tsx:101](src/pages/reports/TeacherPerformance.tsx:101) | `<FeatureGate feature="teacher_performance">` |
| (Utilisation.tsx route-level only) | (NOT IMPORTED in page body; Phase 4 §10 "presumed" citation was INCORRECT per Phase 5 §1 sweep-completeness closure → methodology drift #28 Cat 3 CC-origin ratified) | hub-only enforcement via Reports.tsx:104 |

**Reports hub tier mapping** (Reports.tsx:24-101 static config):
- revenue → 'advanced_reports'
- payroll → 'payroll_reports'
- utilisation → 'multi_location'
- teacher-performance → 'teacher_performance'
- (outstanding, lessons, attendance, cancellations: NO feature gate)

**Class-shape observation for batch-16**: tier-gating-by-hub-only pattern; direct URL navigation to `/reports/utilisation` etc. bypasses the `multi_location` feature gate. Batch-16 enforcement audit will adjudicate route-level vs hub-only tier gates.

### 9.2 Information-disclosure cross-tenant enumeration anchor cohort

Cohort grows from 4 anchors → **5 anchors** post-s49:

| Anchor | Owning batch | Sub-shape |
|---|---|---|
| F-02-002 `get_students_for_org` | 02 closed | row-level child-PII anon-cross-tenant SECDEF RPC |
| F-05-007 `list_invoice_pdf_objects` | 05 closed | storage-path enumeration anon SECDEF RPC |
| F-08-002 `find_waitlist_matches` | 08 closed | child-PII + guardian-PII parameter-spoofed SECDEF RPC |
| F-09-003 (merged with F-09-004) `continuation_run_org_id` + `user_has_continuation_response_in_run` | 09 closed | helper-RPC INCIDENTAL bounded info-disclosure |
| **F-10-002 `invoice_stats_mv`** | **10 (this batch)** | **aggregate-financial MV with anon-SELECT (NEW sub-shape)** |

**Sub-class introduction reserved for batch-19** (per s44 deferral): "Information-disclosure 4-anchor → 5-anchor sub-classification" — sub-shapes (SELECT-list vs storage-path vs helper-RPC vs enumeration-via-helper vs aggregate-MV) for batch-19 cohesion sweep.

### 9.3 NEW class shapes for batch-19 cohesion sweep

3 NEW class shapes surfaced batch-10; all carry to batch-19 as anchor-only-instances per F-04-003 precedent (single-batch evidence insufficient for Pattern classification):

| Class shape | Anchor | Batch-19 sweep direction |
|---|---|---|
| FE-direct aggregate cosmetic-but-visible cohort | F-10-005 (useReports.ts:207 + usePaymentAnalytics.ts:89-92) | Sweep all FE-direct subtraction-without-clamp sites across batches 11-18 |
| Consumer-of-RPC defensive-clamp absence | F-10-006 (useReports.ts:628) | Sweep all FE consumer sites that read RPC json aggregates without defensive clamp |
| Partial-result visibility intra-batch drift | F-10-007 (Utilisation.tsx:90) | Sweep all `.limit(N)` sites across batches for warning-emit consistency |

### 9.4 Hook-discipline drift catalogue (batch-19 cohesion-sweep input)

[AttendanceReport.tsx:59-73](src/pages/reports/AttendanceReport.tsx:59) — inline useQuery with direct `supabase.from('teachers')` call for filter-dropdown population. Pattern #27 NEGATIVE-instance batch-10 observation per Phase 6 §4. Class-distinct from PortalContinuation:71 sub-class B architectural-exception. F-09-002 hygiene-class precedent applies; no allocation. Catalogued for batch-19 cohesion-sweep consideration.

### 9.5 TS-bypass-cast Sub-C nested-join cohort

Batch-19 flag continues per s48 deferral. Batch-10 contribution: 0 Sub-C instances (no PostgREST nested-join patterns in batch-10 hooks; all hooks use multi-statement chunked queries rather than nested-join).

### 9.6 useCan unimplementation cohort

≥211 sites cumulative pre-s49. Batch-10 contribution: +0 mutation hooks (read-only reports surface); +7 direct-currentRole-check sites (class-distinct sub-shape per Phase 3 §14 + Phase 5 ledger; recorded as Pattern observation §11). Cohort ≥211 unchanged; sub-shape observation added.

---

## §10 Batch-19 sweep deferrals + Phase 8 candidate carries

### 10.1 Pattern catalog candidates deferred to batch-19

| Candidate | Slot | Deferral context |
|---|---|---|
| Pattern #26 "Log-shape table protection cohort" | reserved | s46 batch-07 deferral; batch-19 full-schema sweep |
| Pattern #29 "Caller-RLS-respecting view (security_invoker=on)" | reserved | s47 batch-08 deferral; batch-19 full-schema view sweep |
| Pattern #34 "42P01 graceful-degradation" | reserved | s48 batch-09 deferral; post-launch revisit (tech-debt-borderline) |
| **Pattern #37 "Read-only-report-RPC FE-invocation discipline"** | reserved (NEW s49) | Single-batch evidence (2 anchors batch-10 only); batch-19 cross-batch sweep needed |
| **Pattern #39 "Defensive `?? 0` fallback on RPC json-shape return"** | reserved (NEW s49) | Single-batch single-instance evidence (useReports.ts only); batch-19 cross-batch sweep needed |

### 10.2 Sub-class introductions ratified Phase 8 (no batch-19 carry; placed under existing CC-19 # carries)

| Sub-class | Parent class family | Status |
|---|---|---|
| POS-4 "Divide-by-zero auth gate" | auth-gate-UX class family | RATIFIED Phase 8; recorded under F-10-003 |
| "Present-NOT-VALID variant" | CC-19 #11 schema-column-constraint cohort | RATIFIED Phase 8; recorded under F-10-004 |
| "Orphan MV with anon-SELECT + stale-by-design" | CC-19 #15 dead-code SECDEF + orphan trigger fns | RATIFIED Phase 8; recorded under F-10-002 |

### 10.3 Batch-19 sweep targets (cumulative through s49)

From s48 carry + s49 additions:

1. CC-19 #1 helper-fn EXECUTE-grant hygiene cohort sweep across all batches
2. CC-19 #3 audit_log INSERT integrity gap full-schema sweep (incl. ai_interaction_metrics architectural-exception batch-17)
3. CC-19 #6 parameter-spoofing cohort consolidation
4. CC-19 #7 TS-bypass-cast Sub-C nested-join sweep
5. CC-19 #8 E2E fixture hygiene resolution
6. CC-19 #10 Sentry edge-fn instrumentation hardening
7. CC-19 #11 schema-column-constraint cohort full-schema sweep (incl. NOT-VALID variant sub-class)
8. CC-19 #14 claimed-service-role-gate misnaming consolidation
9. CC-19 #15 dead-code SECDEF + orphan trigger fns full-schema sweep (incl. Orphan MV sub-class)
10. Pattern #26 + #29 + #34 candidate ratification
11. Pattern #37 + #39 candidate ratification (NEW s49)
12. Information-disclosure 5-anchor sub-classification (sub-shapes enumerated §9.2)
13. F-10-005 FE-direct cosmetic-but-visible class cohort sweep (NEW s49)
14. F-10-006 consumer-of-RPC defensive-clamp absence class sweep (NEW s49)
15. F-10-007 partial-result visibility class sweep (NEW s49)
16. F-01-017 UPDATE-policy-no-WITH-CHECK cohort consolidation
17. Hook-discipline drift catalogue (Pattern #27 NEGATIVE-instance enumeration; AttendanceReport.tsx:59-73 batch-10 contribution)

---

## §11 Audit-method appendix

### 11.1 Cumulative methodology entries

**31 total entries** post-s49 (28 Cat 1 + 1 Cat 2 + 2 Cat 3):

| Category | Count | Description |
|---|---|---|
| Cat 1 reviewing-Claude origin | **28** | s42-s48 cumulative 26 + Phase 0 s49 ratification of #27 (1) + Phase 7 s49 ratification of #29 (1) |
| Cat 2 environment caveat | 1 | s46 git object DB corruption mitigation; `/tmp/lessonloop3-fresh` canonical |
| Cat 3 CC-origin | **2** | s46 Sub-pattern D `supabase: any` helper-signature undercount (1) + Phase 5 s49 ratification of #28 "Phase 4 §10 presumed import without verbatim verification" (1) |

**s49 methodology ratifications**:

- **#27 (Cat 1; Phase 0)**: Cumulative tally arithmetic at PI closures — two-line check at batch close (PI cohort math + grand active math); cross-verify via STATUS.md column sums.
- **#28 (Cat 3; Phase 5)**: Tier-gating flag-presence verification REQUIRES verbatim import + call-site cite, not derivation from sibling page convention. Origin: Phase 4 §10 over-confidence on Utilisation.tsx `useFeatureGate('multi_location')` import without verbatim verification; caught at Phase 5 §1 sweep-completeness closure mandate per §9 rule 8.
- **#29 (Cat 1; Phase 7)**: SECDEF RPC audit at Phase 1 MUST include EXECUTE grant enumeration query (`pg_proc.proacl` OR `has_function_privilege()` for anon + authenticated + service_role roles), in addition to body-level auth gate verification. Origin: Phase 1 launch prompt task 1.1 + §6 PI block did not include EXECUTE grant enumeration. Mitigation closes F-09-002 class-shape verification gap; allocates F-10-008 cohort via late-surfacing.

### 11.2 Cumulative severity-adjustment events

**13 total events** post-s49 (12 pre-s49 + 1 event #13 at s49).

| # | Event | Session | Direction | Reasoning |
|---|---|---|---|---|
| 1 | PI-08 → F-02-005 | s41 | HIGH ↑ CRITICAL | No `auth.uid()` in record_stripe_payment; financial-falsification anchor |
| 2 | PI-11 → F-03-004 | s42 | Critical ↓ HIGH | CAPS-at-HIGH; check_lesson_conflicts 2-of-7 partial coverage |
| 3 | F-04-002 | s43 | HIGH unchanged | Regression-class support |
| 4 | F-04-004 | s43 | HIGH unchanged | Intent-ambiguity |
| 5 | PI-02 → F-05-003 | s44 | Critical ↓ HIGH | Missing UI for tracked DB state; CAPS |
| 6 | PI-03 → F-05-004 | s44 | Critical ↓ HIGH | Silent failure; cached-value drift |
| 7 | PI-04 → F-05-005 | s44 | Critical ↓ HIGH | Silent failure; banner partial mitigation |
| 8 | PI-05 → F-06-005 | s45 | Critical ↓ HIGH | Missing UI + CAPS |
| 9 | F-06-001 mid-session | s45 | (MEDIUM/HIGH) ↑ CRITICAL | F-06-003 composition discovery |
| 10 | F-07-003 mid-session | s46 | (HIGH operational) ↑ CRITICAL | Composition chain with F-02-005 + F-07-001 |
| 11 | F-08-003 | s47 | (CRITICAL tag) ↓ HIGH | F-01-001 anchor REFUTED via 6-dim class-shape; PI-09 HIGH anchor; class-precedent reassessment |
| 12 | F-09-007 (PI-13) | s48 | (CRITICAL pre-tag) ↓ HIGH | PI-17 class shape (UTC arithmetic ignoring org timezone); CAPS chain; class-precedent reassessment |
| **13** | **F-10-002 (S-03)** | **s49** | **(CRITICAL default-expectation via F-02-002 anchor) ↓ HIGH** | **6-dim class-precedent reassessment: 2 MATCH + 2 PARTIAL + 1 NO + 1 NEUTRAL; D4 NO regulatory scope + D3 PARTIAL payload sensitivity drive bracket-shift from F-02-002 child-PII + GDPR Art 9 anchor. F-08-003 event #11 mechanism shape kinship.** |

### 11.3 4-element magnitude-factor rubric (reusable refinement for aggregate-financial cross-tenant findings)

Per reviewing-Claude Phase 5 §13 Q4 endorsement, the following 4-element rubric is reusable for future MV/aggregate-financial cross-tenant findings:

1. **Aggregate-not-row-level**: payload is org-level aggregate vs row-level entity (mitigates D3 payload sensitivity)
2. **Commercial-not-regulated**: financial-aggregate is commercially sensitive but NOT GDPR Art 9 special-category or Art 33 breach-notifiable (mitigates D4 regulatory scope)
3. **Zero-real-rows**: pre-launch context; no real exploitation surface at HEAD
4. **Zero-consumers**: triple-verified via FE grep + edge fn grep + cron sweep; no required-paths exercise grants

These 4 elements decompose D5 trust-erosion magnitude rubric line for class-precedent reassessment of cross-tenant aggregate findings vs F-02-002 anchor.

### 11.4 Pattern observation "RLS-canonical-FE-cosmetic role-check" recording

Server-side RLS via SECDEF body-gate is canonical authorization mechanism for batch-10 surface (`get_teachers_with_pay` role-RAISE-EXCEPTION; `get_revenue_report` div-by-zero auth gate). FE-side direct `currentRole === ...` checks are cosmetic UI show/hide only; class-distinct from useCan unimplementation cohort (mutation-hook-targeted).

7 batch-10 sites enumerated:

| Site | File:line |
|---|---|
| Reports hub role-filter | [Reports.tsx:175](src/pages/Reports.tsx:175) + [Reports.tsx:194](src/pages/Reports.tsx:194) |
| Payroll page isAdmin | [Payroll.tsx:29](src/pages/reports/Payroll.tsx:29) |
| usePayroll isAdmin | [usePayroll.ts:37](src/hooks/usePayroll.ts:37) |
| useLessonsDeliveredReport isAdmin | [useReports.ts:273](src/hooks/useReports.ts:273) |
| useCancellationReport isAdmin | [useReports.ts:425](src/hooks/useReports.ts:425) |
| AttendanceReport page isAdmin | [AttendanceReport.tsx:50](src/pages/reports/AttendanceReport.tsx:50) |
| useAttendanceReport isAdmin | [useAttendanceReport.ts:89](src/hooks/useAttendanceReport.ts:89) |

**No allocation**; class-consistency observation only. Recorded for batch-19 cohesion-sweep potential.

### 11.5 Pattern #27 NEGATIVE-instance enumeration

[AttendanceReport.tsx:59-73](src/pages/reports/AttendanceReport.tsx:59) — inline useQuery with direct `supabase.from('teachers')` call for filter-dropdown population. Pattern #27 NEGATIVE-instance batch-10 observation; non-PII filter-dropdown drift; F-09-002 hygiene-class precedent applies; no allocation. Class-distinct from PortalContinuation:71 sub-class B architectural-exception (which has structural unauth-token surface justification).

Batch-19 cohesion-sweep input: "Hook-discipline drift catalogue" item.

### 11.6 Phase 8 Pattern catalog state transitions

Detailed in §5.2 + §10.1 + §10.2 above. Summary:
- Pattern #38 RATIFIED to placed slot
- Pattern #37 + #39 DEFERRED to batch-19 candidates
- 3 sub-class introductions RATIFIED (POS-4 + NOT-VALID + Orphan MV)
- 1 Pattern observation recorded (RLS-canonical-FE-cosmetic)
- 1 Pattern #27 NEGATIVE-instance enumerated

### 11.7 s50+ Phase 1 prompt template carry (drift #29 operational guidance)

Per reviewing-Claude Phase 7 launch §(1) endorsement, drift #29 mitigation rule lands in §10b reviewing-Claude handover snapshot at Phase 10 close with explicit operational guidance for batch 11+ Phase 1 prompts:

> Every Phase 1 prompt for batch 11 onward includes a task line: "EXECUTE grant enumeration for each batch-owned SECDEF RPC via `has_function_privilege()` (or `pg_proc.proacl`) for anon + authenticated + service_role roles, in addition to body-level auth gate verification."

This closes the F-09-002 class-shape verification gap and provides templating precedent for batch-11+ findings of CC-19 #1 class.

---

## §12 Verification summary

### 12.1 Hard rules §9 unbroken throughout Phase 0-9

| Rule | Status |
|---|---|
| #1 AUDIT-ONLY no fix work | ✓ working tree clean; HEAD unchanged through Phase 7 §6 verification |
| #2 No migrations | ✓ no `apply_migration` invoked; only `execute_sql` read-only |
| #3 No deploys | ✓ |
| #4 HALT after EXIT | ✓ all phases halted per HALT directives |
| #5 Banner intact | ✓ [STATUS.md:12](audit/sweep/STATUS.md:12) AUDIT IN PROGRESS — DO NOT FIX YET preserved |
| #6 NEVER echo secrets | ✓ token verification by prefix/suffix length only |
| #7 Closed-batch immutability | ✓ all closed-batch citations enumerated as class-precedent reference only |
| #8 Audit scope completeness | ✓ Utilisation.tsx full-read closure Phase 5 §1 per §9 rule 8 |
| #9 Zoom-only sub-surface deferral | ✓ no other deferrals |
| #10 File:line OR DB evidence | ✓ all evidence cited |
| #11 Pattern catalog promotions surface Phase 8 EXIT | ✓ Phase 8 EXIT surfaced 7 candidates; doc-write uses ratified names + numbers only |
| #12 Drift #27 two-line check | ✓ §8 cross-verified |
| #13 Phase 10 commit placeholder pattern | (deferred to Phase 10 commit) |
| #14 Methodology entries ≠ events | ✓ counter distinction maintained |

### 12.2 100% audit-only compliance maintained

Phase 7 §6 verification: working-tree-clean + HEAD-unchanged + deterministic-test-suite + no-env-changes = test baseline carries through. 0 code modifications. No `apply_migration` invocations. No deploys.

### 12.3 Closed-batch immutability citations enumerated

Closed-batch class-precedent references (all cited reference-only, NOT body-edited):

| Closed batch | Citations |
|---|---|
| 01 (s40) | is_org_finance_team + is_org_staff helpers |
| 02 (s41) | TeacherLink.tsx:213 + TeacherQuickView.tsx:215 + Teachers.tsx:107-117 + F-02-002 anchor + F-02-005 anchor |
| 03 (s42) | (no direct citations) |
| 04 (s43) | F-04-003 cascade-completeness-asymmetry precedent + F-04-005 audit-trigger gap MEDIUM precedent |
| 05 (s44) | get_invoice_stats body (F-10-006 anchor; reference for consumer audit) + F-05-003 PI-02 closure + F-05-005 + F-05-007 + F-05-009 + F-05-010 |
| 06 (s45) | ActiveDisputesCard.tsx:41 + F-06-005 overpayment_minor populator + F-06-006 unsuffixed orphan trigger fn |
| 07 (s46) | F-07-003 composition-chain CRITICAL anchor + F-07-005 orphan trigger fn + F-07-006/007 amount_minor positive CHECK |
| 08 (s47) | F-08-001 + F-08-002 + F-08-005 silent-swallow cohort + Pattern #27 sub-B PortalContinuation:71 NEGATIVE-instance flag |
| 09 (s48) | F-09-001 + F-09-002 LOW (F-10-008 class-precedent anchor) + F-09-007 PI-13 event #12 + F-09-008 + F-09-009 + F-09-010 + F-09-011 + F-09-012 + Pattern #30/#31/#32/#33/#35/#36 |

### 12.4 Drift #27 two-line check passes

§8 cross-verified: PI cohort 6−1+0=5 ✓; Grand active 134+8−1=141 ✓; bracket sums 18+41+26+56=141 ✓.

### 12.5 Sweep-completeness §9 rule 8 satisfied

Utilisation.tsx full-read closure at Phase 5 §1; no remaining sweep-completeness gaps.

### 12.6 Methodology entries / events separation

31 cumulative methodology entries / 13 cumulative severity-adjustment events. Counter distinction maintained per PLAN.md §4.1.

### 12.7 Phase 8 ratifications surfaced before doc-write

Pattern #38 RATIFIED + #37/#39 DEFERRED + 3 sub-class introductions RATIFIED + 1 Pattern observation recorded — all surfaced Phase 8 EXIT before Phase 9 doc-write per hard rule §11.

---

**End of batch-10 findings doc.**
