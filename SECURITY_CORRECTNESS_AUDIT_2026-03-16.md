# LessonLoop Deep Security & Correctness Audit (2026-03-16)

## 1) SECURITY DEFINER RPCs (CRITICAL)
### What I checked
- `grep -r "SECURITY DEFINER" supabase/migrations/ --include="*.sql"`
- Manual source review of representative SECURITY DEFINER SQL functions, especially client-invocable RPCs and helper functions.
- Heuristic sweep of all SECURITY DEFINER function bodies for `auth.uid()` + org scoping patterns.

### Findings
| ID | Severity | Description | File | Line(s) | Evidence |
|---|---|---|---|---|---|
| SD-01 | CRITICAL | `anonymise_student` is SECURITY DEFINER and performs updates with no `auth.uid()`/org membership check, allowing arbitrary anonymisation if executable by authenticated users. | `supabase/migrations/20260120101011_c01a870d-3f12-4d2f-961a-f219fbe4dc0b.sql` | 80-98 | Function body updates by `student_id` only; no caller validation. |
| SD-02 | CRITICAL | `anonymise_guardian` has same issue: SECURITY DEFINER, no authentication/org authorization gate. | `supabase/migrations/20260120101011_c01a870d-3f12-4d2f-961a-f219fbe4dc0b.sql` | 102-116 | Function body updates by `guardian_id` only; no caller validation. |
| SD-03 | HIGH | `get_user_id_by_email` is SECURITY DEFINER and reads `auth.users` by arbitrary email with no caller check, enabling user enumeration/correlation risk. | `supabase/migrations/20260119232754_4b51666a-17b5-42ba-906d-c4ca5e7eb4ec.sql` | 34-42 | Direct `SELECT id FROM auth.users WHERE email = _email`. |
| SD-04 | MEDIUM | Many SECURITY DEFINER helper functions rely on `_user_id` parameters instead of `auth.uid()` (PARTIAL), which is acceptable only if never directly exposed to untrusted callers. | multiple migrations | n/a | Heuristic sweep found mixed patterns (YES/NO/PARTIAL). |

### Verdict
**FAIL** (critical unauthenticated/unsafeguarded SECURITY DEFINER functions found).

---

## 2) RLS Policy Audit (CRITICAL)
### What I checked
- `grep -r "USING\s*(true)" supabase/migrations/ --include="*.sql"`
- `grep -r "WITH CHECK\s*(true)" supabase/migrations/ --include="*.sql"`
- Global migration scan for tables with RLS enabled but no policies.

### Findings
| ID | Severity | Description | File | Line(s) | Evidence |
|---|---|---|---|---|---|
| RLS-01 | LOW | `rate_limits` service_role policy uses `USING (true) / WITH CHECK (true)`; scoped to `TO service_role`, generally intentional. | `supabase/migrations/20260122141328_6e44ed63-791d-4c6d-ba2a-4286285858fc.sql` | 11-15 | Universal condition but restricted role. |
| RLS-02 | LOW | `user_roles` service_role policy uses universal true checks; likely intentional for backend automation. | `supabase/migrations/20260122141328_6e44ed63-791d-4c6d-ba2a-4286285858fc.sql` | 18-22 | Same pattern, service role only. |
| RLS-03 | HIGH (historical fixed) | `practice_streaks` previously had universal write policies; a later migration explicitly documents and fixes this. | `supabase/migrations/20260124130317_2436aeb2-ea74-43a5-aaa9-66edf3a88c8a.sql` + `20260315100000_fix_practice_streaks_rls.sql` | 30-37; 1-16 | Original permissive policies replaced with org-member scoped ones. |
| RLS-04 | MEDIUM | `stripe_webhook_events` has RLS enabled but no policies. This blocks client access and appears intentional for service-role-only webhook dedup table. | `supabase/migrations/20260222220737_c85a833c-ac1a-455f-9771-defc18de4778.sql` | 14-15 | Comment says service-role-only; no policy created. |

### Verdict
**PASS with caveats** (no currently active universal authenticated policy identified in reviewed targets; one intentional no-policy table).

---

## 3) Edge Function Auth Gaps (CRITICAL)
### What I checked
- `supabase/config.toml` for `verify_jwt = false`
- Line-by-line review of required functions:
  - `stripe-create-checkout`
  - `send-message`
  - `send-invoice-email`
  - `create-billing-run`
  - `stripe-webhook`
- Spot-check of adjacent payment function `stripe-create-payment-intent`.

### Findings
| ID | Severity | Description | File | Line(s) | Evidence |
|---|---|---|---|---|---|
| EF-01 | CRITICAL | `verify_jwt` is disabled for many user-facing functions; relies on manual auth in each handler, increasing footgun risk. | `supabase/config.toml` | 1-93 | 27 functions explicitly set `verify_jwt = false`. |
| EF-02 | PASS | `stripe-create-checkout` does manual auth and checks payer/org finance membership before charging. | `supabase/functions/stripe-create-checkout/index.ts` | 24-37, 80-120 | Explicit `getUser()` + payer or org role authorization. |
| EF-03 | CRITICAL | `stripe-create-payment-intent` authenticates user but **does not verify caller owns/has role for target invoice** before creating payment intent. | `supabase/functions/stripe-create-payment-intent/index.ts` | 20-29, 46-68 | Invoice fetched by ID; no payer/org-membership authorization check. |
| EF-04 | PASS | `send-message` resolves recipient from DB and enforces recipient org match; does not trust client-provided recipient metadata. | `supabase/functions/send-message/index.ts` | 110-178 | DB lookup + org_id consistency checks. |
| EF-05 | PASS | `send-invoice-email` fetches invoice from DB and checks caller org membership role (`owner/admin/finance`). | `supabase/functions/send-invoice-email/index.ts` | 126-160 | Server-side source of truth + role gate. |
| EF-06 | PASS | `create-billing-run` validates date format/order/range and checks overlapping billing runs. | `supabase/functions/create-billing-run/index.ts` | 151-182, 219-239 | ISO validation + overlap query and 409 response. |
| EF-07 | PASS | `stripe-webhook` returns HTTP 500 on processing failures (forces Stripe retries), and dedups by event_id unique insert. | `supabase/functions/stripe-webhook/index.ts` | 65-75, 170-178 | Duplicate 200; errors bubble to 500. |

### Verdict
**FAIL** (critical auth gap in `stripe-create-payment-intent`).

---

## 4) Financial Calculation Correctness (HIGH)
### What I checked
- `rg -n "(/\s*100|Math\.round|Math\.floor|Math\.ceil|toFixed\()" src/hooks/usePayroll.ts src/hooks/useReports.ts supabase/functions/create-billing-run/index.ts`
- Read requested files end-to-end.

### Findings
| ID | Severity | Description | File | Line(s) | Evidence |
|---|---|---|---|---|---|
| FIN-01 | HIGH | Payroll percentage calculation converts both percent and revenue with floating math; introduces precision drift risk and mixed major/minor units in same hook. | `src/hooks/usePayroll.ts` | 215 | `(payRateValue / 100) * (lessonRevenue / 100)`. |
| FIN-02 | HIGH | Revenue RPC sums `total_minor` for `status='paid'` instead of `paid_minor`; partial-pay edge cases can be misstated if status or paid progression diverges. | `supabase/migrations/20260222215011_dcf76feb-c01d-437a-a05a-7d28f1ab8468.sql` | 28, 43 | `SUM(total_minor)` aliased as paid amount. |
| FIN-03 | HIGH | Ageing/outstanding report uses `total_minor` only and ignores `paid_minor`, overstating outstanding where partial payments exist. | `src/hooks/useReports.ts` | 163, 216-219, 227 | Outstanding buckets add `total_minor/100` without subtracting paid. |
| FIN-04 | MEDIUM | Billing run VAT uses floating multiplication + `Math.round`; acceptable if controlled, but still float-based. Prefer integer-safe basis points math. | `supabase/functions/create-billing-run/index.ts` | 666 | `Math.round(subtotal * (vatRate / 100))`. |

### Verdict
**FAIL** (material financial reporting/calc correctness risks).

---

## 5) Privacy & Data Leakage (HIGH)
### What I checked
- Lesson notes policies and RPCs.
- Parent portal data access patterns.
- Teacher visibility constraints.
- Select-star patterns.

### Findings
| ID | Severity | Description | File | Line(s) | Evidence |
|---|---|---|---|---|---|
| PRIV-01 | MEDIUM | Parent teacher-access model is row-level only; migration comment explicitly says parents can SELECT teachers and column filtering must be done in query layer. This is brittle and can leak teacher email/phone if a parent query selects those columns. | `supabase/migrations/20260315220010_fix_teacher_audit_findings.sql` | 152-163 | Comment acknowledges RLS cannot enforce column privacy and relies on query discipline. |
| PRIV-02 | PASS | Parent lesson notes RPC intentionally excludes `teacher_private_notes`. | `supabase/migrations/20260316300000_fix_lesson_notes_audit_findings.sql` | 85-101, 126-133 | Parent RPC return type omits private column. |
| PRIV-03 | PASS | Staff notes RPC masks private notes for non-owning teachers; admin/owner only full visibility. | `supabase/migrations/20260316300000_fix_lesson_notes_audit_findings.sql` | 205-210 | CASE expression nulls private notes for other teachers. |
| PRIV-04 | PASS | Parent portal lessons query fetches teacher display name only (no teacher email/phone). | `src/hooks/useParentPortal.ts` | 277, 326 | `teacher(display_name)`; mapped to `teacher_name`. |

### Verdict
**PASS with caveat** (no direct active leak found in reviewed paths; policy design remains brittle for teacher contact fields).

---

## 6) Committed Secrets (CRITICAL)
### What I checked
- `git ls-files | grep -i env`
- repository-wide string scan for likely secrets/test credentials
- Playwright config and e2e defaults

### Findings
| ID | Severity | Description | File | Line(s) | Evidence |
|---|---|---|---|---|---|
| SEC-01 | HIGH | Real-looking shared test credential appears in repo docs/context. | `claude.md` | 123 | `patrick-*` accounts + password included. |
| SEC-02 | MEDIUM | E2E helper hardcodes fallback credentials (`e2e-owner@test.lessonloop.net` / `TestPass123!`). | `tests/e2e/supabase-admin.ts` | 19-20 | Defaults present in code if env vars absent. |
| SEC-03 | PASS | No tracked `.env` with live keys found (`.env.example` only). | repo root | n/a | `git ls-files | grep -i env` output. |
| SEC-04 | PASS | Playwright has production guard; requires explicit override to run against prod URL. | `playwright.config.ts` | 10-16 | Throws unless `ALLOW_PRODUCTION_TESTS=true`. |

### Verdict
**FAIL** (credential hygiene issues in tracked files).

---

## 7) Webhook Reliability (HIGH)
### What I checked
- Full read of `stripe-webhook` including event dedup, error propagation, DB writes.

### Findings
| ID | Severity | Description | File | Line(s) | Evidence |
|---|---|---|---|---|---|
| WH-01 | PASS | Handler returns 500 on errors to force Stripe retry. | `supabase/functions/stripe-webhook/index.ts` | 170-178 | Catch returns 500. |
| WH-02 | PASS | Idempotency layer present via `stripe_webhook_events` unique insert + duplicate short-circuit. | `supabase/functions/stripe-webhook/index.ts` | 63-75 | Duplicate event returns 200 duplicate=true. |
| WH-03 | MEDIUM | Some non-critical writes are “best effort” (e.g., checkout session status update); they log errors and continue. Acceptable for non-source-of-truth fields but should be monitored. | `supabase/functions/stripe-webhook/index.ts` | 241-253 | Update failure does not fail webhook. |

### Verdict
**PASS** (core payment-record path retries safely).

---

## 8) Dead Code / Schema Drift (MEDIUM)
### What I checked
- `rg -n "voided_at" ...`
- migration scan for RLS enablement vs policy presence

### Findings
| ID | Severity | Description | File | Line(s) | Evidence |
|---|---|---|---|---|---|
| DRIFT-01 | LOW | `stripe_webhook_events` RLS enabled with no policies; intentional but effectively inaccessible to non-service roles. | `supabase/migrations/20260222220737_c85a833c-ac1a-455f-9771-defc18de4778.sql` | 14-15 | Explicit comment indicates intent. |
| DRIFT-02 | PASS | Recent migrations add `voided_at IS NULL` filters in critical credit flows. | `supabase/migrations/20260316260000_fix_voided_credits_audit.sql` | 114-126, 323-331, 372-381 | Multiple guarded queries include `voided_at IS NULL`. |

### Verdict
**PASS with caveat**.

---

## 9) Race Conditions (MEDIUM)
### What I checked
- Trigger/RPC locking in teacher limits, billing, waitlist/credit usage.

### Findings
| ID | Severity | Description | File | Line(s) | Evidence |
|---|---|---|---|---|---|
| RC-01 | PASS | Teacher limit enforcement uses row locking (`FOR UPDATE`) in trigger path. | `supabase/migrations/20260315220010_fix_teacher_audit_findings.sql` | 16-35 | Locking in `check_teacher_limit`. |
| RC-02 | PASS | Credit consumption uses `FOR UPDATE SKIP LOCKED` to reduce double-spend races. | `supabase/migrations/20260316270000_fix_waitlist_audit_findings.sql` | 107-114 | Locking before credit assignment. |
| RC-03 | PASS | Waitlist booking flow locks waitlist and lesson rows (`FOR UPDATE`) before booking mutations. | `supabase/migrations/20260316270000_fix_waitlist_audit_findings.sql` | 31-35, 51 | Explicit locks. |

### Verdict
**PASS**.

---

## 10) Timezone & Currency Consistency (MEDIUM)
### What I checked
- `rg -n "toLocaleDateString\(" src`
- `rg -n "£|€|\bGBP\b|\bUSD\b|\bEUR\b" src supabase/functions`
- requested billing/report/payroll files for timezone boundaries.

### Findings
| ID | Severity | Description | File | Line(s) | Evidence |
|---|---|---|---|---|---|
| TZ-01 | MEDIUM | Multiple UI paths still use `toLocaleDateString()` (browser locale/timezone dependent), contrary to org-timezone-only business formatting requirement. | `src/hooks/useLeadActivities.ts` (example) | 200 | Direct `toLocaleDateString()` call. |
| TZ-02 | LOW | `create-billing-run` derives due date via locale string round-trip and `toISOString`, which can be brittle around timezone transitions. | `supabase/functions/create-billing-run/index.ts` | 642-645 | `toLocaleDateString('en-CA', {timeZone})` then `toISOString().split('T')[0]`. |
| TZ-03 | LOW | Hardcoded GBP symbols still exist in user-facing strings in some functions/components. | `supabase/functions/process-term-adjustment/index.ts` | 866-868 | Interpolated `£${rateFormatted}`. |

### Verdict
**FAIL (medium)** due to remaining timezone/currency consistency debt.

---

## Overall Verdict
**Grade: C-**

### Top 10 most critical findings (ranked)
1. **EF-03 (CRITICAL):** `stripe-create-payment-intent` missing invoice ownership/org authorization.
2. **SD-01 (CRITICAL):** `anonymise_student` SECURITY DEFINER without auth/org check.
3. **SD-02 (CRITICAL):** `anonymise_guardian` SECURITY DEFINER without auth/org check.
4. **FIN-03 (HIGH):** Ageing report computes outstanding from `total_minor`, ignores `paid_minor`.
5. **FIN-02 (HIGH):** Revenue RPC sums `total_minor` for paid totals.
6. **SEC-01 (HIGH):** Shared test credentials committed in `claude.md`.
7. **FIN-01 (HIGH):** Payroll percentage calculation mixes floating/major-minor units.
8. **EF-01 (CRITICAL process risk):** 27 functions with `verify_jwt=false` rely on manual auth; one already has a gap.
9. **PRIV-01 (MEDIUM):** Teacher contact privacy depends on query discipline (not enforceable by RLS columns).
10. **TZ-01 (MEDIUM):** Widespread `toLocaleDateString()` timezone inconsistency risk.

### Estimated fix effort
- EF-03: **S** (0.5 day)
- SD-01/SD-02: **S-M** (0.5–1 day incl. grants review)
- FIN-03/FIN-02: **M** (1–2 days incl. regression checks)
- SEC-01/SEC-02: **S** (0.5 day)
- FIN-01: **M** (1 day, plus test updates)
- EF-01 process hardening: **M-L** (2–4 days; central auth middleware + audit)
- PRIV-01: **M** (1–2 days; parent-safe RPC/view adoption)
- TZ-01/TZ-02/TZ-03: **M** (1–3 days depending on breadth)

### Security score before vs after fixes
- **Before:** 61/100 (C-)
- **After top-10 fixes:** 85/100 (B+/A-)
