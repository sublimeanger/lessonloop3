# Batch 13 — Practice + Resources

**Session**: s52
**Date**: 2026-05-16
**HEAD pin**: `<s52 Phase 10 commit SHA>`
**Status**: CLOSED
**Findings allocated**: 4 (1C / 0H / 0M / 3L); F-13-001 through F-13-004

---

## §1 Batch context

### 1.1 Pre/post tally

| | Pre-s52 (s51 close) | Post-s52 | Delta |
|---|---|---|---|
| Total active | 153 | **157** | +4 |
| Critical | 19 | **20** | +1 (F-13-001 META) |
| High | 45 | 45 | 0 |
| Medium | 26 | 26 | 0 |
| Low | 63 | **66** | +3 (F-13-002 + F-13-003 + F-13-004) |

Plus 3 closed-batch citations (no fresh F-13-NNN IDs): F-02-008 + F-02-020 + closed-batch-08 CC-19 #1 cohort enrichment.

Plus 1 severity-adjustment event (#14): PI-52-P standalone HIGH → CRITICAL via composition.

### 1.2 Path Y phase

Phase B — Systematic Audit; **13 of 21 batches complete after s52**.

### 1.3 Session phase summary

| Phase | Output highlight |
|---|---|
| 0 | HEAD `f1e8cf41` verified == s51 close; tally 153/19C/45H/26M/63L confirmed; banner intact; push hygiene LOCAL==REMOTE clean (PLAN.md §3 rule 7 second application); baseline 471/5/30 delta 0; READ-FIRST list ingested; drift #31 verbatim cite table for 11 finding-IDs |
| 1 | CENSUS verbatim cites (17 rows incl. routes/pages/edge fns/RPCs/triggers/cron/hooks/tables); filesystem enumeration (2 edge fns + 2 pages + 5 hooks + 5 components); push_tokens primary-write-surface attribution → cross-cutting (NOT batch-13 per Adjudication 24); Pattern #41 candidate signal PRESENT for streak-notification + ABSENT for cleanup-orphaned-resources; Pattern #42 NO MATCH for both batch-13 edge fns; useCan MIXED (3 Resources sites + 0 Practice sites) |
| 2 | **PI-52-P AUTH-H5 mass REVOKE migration partial-mitigation cohort surfaced** (DB-verified 13-fn cohort retains anon EXECUTE; pg_default_acl postgres-owner schema-public default = `{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}` re-applies on CREATE OR REPLACE; AUTH-H5 omits FROM anon REVOKE); 6-dim adjudication of PI-52-A + PI-52-O vs 5 DB-SECDEF anchors → class-DISTINCT (strongest sibling F-02-002 "no gate at all" 2/6 strong match); Sub-option 2 recommendation (subsumed into META); F-12-006 precedent shape |
| 3 | F-01-017 cohort 4 anchors UPDATE-no-WITH-CHECK confirmed (selective regression POSITIVE counter-examples present); CC-19 #3 audit_log gap cohort 7 anchors (28-table POSITIVE baseline confirmed; STRONG/WEAK candidacy framed); practice_streaks POS-3 EXPLICIT confirmed (F3 MEDIUM migration comment); resource_shares + resource_category_assignments POS-3 IMPLICIT (DELETE-THEN-INSERT FE convention); 5 column-CHECK-absent anchors (CC-19 #11 cohort enrichment) |
| 4 | streak-notification body audit + 6-dim vs Pattern #41 anchor F-12-003 → class-DISTINCT on D2 reachability axis (cron-secret service-trust vs verify_jwt user-auth); cleanup-orphaned-resources Pattern #41 NO MATCH; CC-19 #7 Sub-E +1 (cleanup-orphaned-resources:107); CC-19 #10 +1 (cleanup-orphaned-resources bare Deno.serve) |
| 5 | Pattern catalog: 36 PLACED + 6 CANDIDATES unchanged; sub-class introduction #5 POS-3 IMPLICIT ratified; Internal-trust pattern observation-only (not promoted); event #14 ratified; Cat 2 #2 env caveat + Cat 1 #33 drift #36 ratified; cumulative methodology 35 → 37; Sub-option 2 subsumption confirmed |
| 6 | This finding doc + Phase 6.2 cite verification matrix + Phase 6.3 arithmetic verification |

---

## §2 Surface enumeration

### 2.1 CENSUS verbatim cites (drift #30 + #30.B operational application)

| Surface | CENSUS line | Verbatim |
|---|---|---|
| Route `/practice` | CENSUS:80 | `\| /practice \| Practice \| owner/admin/teacher \| 13-practice-resources \|` |
| Route `/resources` | CENSUS:81 | `\| /resources \| Resources \| owner/admin/teacher \| 13-practice-resources \|` |
| Page `Practice.tsx` | CENSUS:159 | `\| Practice.tsx \| 13-practice-resources \|` (306 lines) |
| Page `Resources.tsx` | CENSUS:160 | `\| Resources.tsx \| 13-practice-resources \|` (401 lines) |
| Edge fn `cleanup-orphaned-resources` | CENSUS:406 | `\| cleanup-orphaned-resources \| cron \| cron-only \| 13-practice-resources \|` (117 lines; verify_jwt=false) |
| Edge fn `streak-notification` | CENSUS:407 | `\| streak-notification \| notification \| service-role \| 13-practice-resources \|` (232 lines; verify_jwt=false) |
| SECDEF RPC `complete_expired_assignments` | CENSUS:655 | `\| complete_expired_assignments \| yes \| void \| 13-practice-resources \|` |
| SECDEF RPC `reset_stale_streaks` | CENSUS:656 | `\| reset_stale_streaks \| yes \| void \| 13-practice-resources \|` |
| Trigger `trg_cleanup_resource_shares_on_student_archive` | CENSUS:759 | `\| trg_cleanup_resource_shares_on_student_archive \| students \| cleanup_resource_shares_on_student_archive \| AFTER UPDATE \| 13-practice-resources \|` (cross-batch reach: trigger ON students batch-02) |
| Trigger `update_streak_on_practice_log` | CENSUS:872 | `\| update_streak_on_practice_log \| practice_logs \| update_practice_streak \| AFTER INSERT \| 13-practice-resources \|` (F-02-008 chain entry point) |
| Cron 99 | CENSUS:913 | cleanup-orphaned-resources `0 3 * * *` |
| Cron 105 | CENSUS:919 | complete-expired-assignments `0 4 * * *` direct `SELECT public.complete_expired_assignments()` |
| Cron 106 | CENSUS:920 | reset-stale-practice-streaks `0 3 * * *` direct `SELECT public.reset_stale_streaks()` |
| Hook `usePractice.ts` | CENSUS:1165 | Practice assignment CRUD (542 lines) |
| Hook `usePracticeStreaks.ts` | CENSUS:1166 | Streak data (119 lines) |
| Hook `useResources.ts` | CENSUS:1167 | Resource library list (408 lines) |
| Hook `useResourceCategories.ts` | CENSUS:1168 | Resource category CRUD (143 lines) |
| Hook `useUpdateResource.ts` | CENSUS:1169 | Resource update mutation (82 lines) |

### 2.2 Tables (implicit-attribution per s51 Phase 7 PLAN.md codification)

7 batch-13-implicit tables (owning surfaces = batch-13 hooks + edge fns):
1. `practice_assignments`
2. `practice_logs`
3. `practice_streaks`
4. `resource_categories`
5. `resource_category_assignments`
6. `resource_shares`
7. `resources`

### 2.3 Cross-batch reach (per Phase 1.6 mapping)

| # | Surface | Direction | Cross-batch endpoint | Status |
|---|---|---|---|---|
| (a) | `trg_cleanup_resource_shares_on_student_archive` | trigger on **students** (batch-02 closed) → DELETE on **resource_shares** (batch-13) | batch-02→13 cascading write | F-13-003 cohort entry (audit_log gap) |
| (b) | `PortalPractice.tsx` + `PortalResources.tsx` | parent-portal pages (CENSUS:48-49 batch-11 closed) READ batch-13 tables | batch-11→13 read | CLOSED-batch-11 consumer; no batch-13 finding |
| (c) | `pushNotifications.ts:38` push_tokens write | platform-services layer → push_tokens | cross-cutting attribution-ambiguous | DEFERRED to post-Phase-B editorial (PI-52-K) |
| (d) | F-02-020 closed-batch-02 helpers (5 used in batch-13 RLS) | RLS predicates consume closed-batch-02 SECDEF helpers | batch-02→13 RLS dependency | §3.6 PI-52-C citation |
| (e) | `_notify_streak_milestone` → `streak-notification` edge fn | closed-batch-02 SECDEF RPC PERFORMs net.http_post to batch-13 edge fn | batch-02→13 chain | §3.5 PI-52-B citation (F-02-008 HIGH) |
| (f) | `update_streak_on_practice_log` AFTER INSERT trigger | batch-13 trigger → calls update_practice_streak → PERFORMs `_notify_streak_milestone` at milestone thresholds | batch-13 chain entry point | F-02-008 chain reachable from batch-13 DML |
| (g) | F-13-001 META cohort | 13 fns span batches 02 + 07 + 08 + 13 + cross-cutting helpers | F-13-001 batch-13 attribution per implicit-attribution-via-owning-feature-surface (s52 discovery surface) | §3.1 META |

---

## §3 Findings detail

### 3.1 F-13-001 CRITICAL — AUTH-H5 mass REVOKE migration partial-mitigation cohort (META; subsumes PI-52-A + PI-52-O)

| Field | Value |
|---|---|
| **ID** | F-13-001 |
| **Severity** | **CRITICAL** (event #14 composition; standalone HIGH per migration-pattern-failure class CAPS-at-HIGH; CRITICAL via composition with F-02-005 + F-07-003 + F-08-002 closed-CRITICAL anchors) |
| **Area** | DB migration / mass REVOKE pattern-failure / cross-tenant anon-callable SECDEF persistence |
| **Phase surfaced** | 1.8 (CC migration audit discovery) + 2.0 (reviewing-Claude DB-side investigation + CC re-verification + root cause via pg_default_acl) |
| **Class** | META migration-pattern-failure; composition-CRITICAL via 3 closed-CRITICAL anchors in cohort |
| **Class-precedent** (drift #31 cite) | (a) F-12-006 META cohort precedent shape (findings/12-messages-notifications.md §3.6: single META F-ID + 5-row batch-attribution table for CC-19 #3 audit_log gap cohort); (b) F-06-001/F-06-003 event #9 precedent for composition-bracket escalation (PLAN.md §4.1 events row 9: "F-06-001 mid-session (s45) (MEDIUM/HIGH)↑CRITICAL F-06-003 composition discovery"); (c) F-05-005 silent-failure CAPS-at-HIGH for migration-pattern-failure standalone class |
| **Cohort** | 13-fn cohort spanning 5+ batches (batches 02 + 07 + 08 + 13 + cross-cutting helpers) |

#### 3.1.1 Defect class-shape (verbatim ratified at Phase 5.4)

> "AUTH-H5 mass REVOKE migration `20260401000000:307-396` partial-mitigation — PG REVOKE FROM authenticated + FROM public statements do not strip explicit `anon=X/postgres` grant entry; Supabase platform default-grant on schema public (postgres-owner pg_default_acl) re-applies anon+auth+srv on CREATE OR REPLACE; omission of `REVOKE EXECUTE ... FROM anon` is the discrete syntactic defect"

#### 3.1.2 Root cause evidence

**REVOKE syntax (filesystem cite, `supabase/migrations/20260401000000_auth_rls_hardening.sql`)**:
- L4: `-- ... AUTH-H4, AUTH-H5, AUTH-H6, AUTH-M2, AUTH-L1, AUTH-L2`
- L307-308: `REVOKE EXECUTE ON FUNCTION public.record_installment_payment(uuid, integer, text) FROM authenticated; FROM public;` (AUTH-H4 block)
- L318-319: `REVOKE EXECUTE ON FUNCTION public.record_stripe_payment(uuid, uuid, integer, text, uuid, boolean) FROM authenticated; FROM public;` (AUTH-H4 block)
- L363: `-- AUTH-H5 HIGH: Mass REVOKE for trigger/cron/internal functions`
- L369-396: 11 AUTH-H5 cohort REVOKEs (auto_issue_credit_on_absence + on_slot_released + auto_add_to_waitlist + notify_makeup_match_webhook + cleanup_attendance_on_cancel + cleanup_rate_limits + reset_stale_streaks + complete_expired_assignments + generate_invoice_number + set_invoice_number + find_waitlist_matches), all with `FROM authenticated; FROM public;` pattern
- **13 fns × 2 REVOKEs each = 26 statements; ZERO statements REVOKE FROM anon**

**pg_default_acl evidence (DB-verified)**:
- Two default-grant entries on schema `public` for objtype `f` (functions):
  - Owner `supabase_admin`: `{postgres=X/supabase_admin, anon=X/supabase_admin, authenticated=X/supabase_admin, service_role=X/supabase_admin}`
  - Owner `postgres`: `{postgres=X/postgres, anon=X/postgres, authenticated=X/postgres, service_role=X/postgres}` — **exactly matches the proacl format on all 13 cohort fns at HEAD**
- ZERO `ALTER DEFAULT PRIVILEGES` statements in `supabase/migrations/` — Supabase platform-level defaults
- Implication: every postgres-owner CREATE OR REPLACE FUNCTION in schema `public` auto-grants anon + authenticated + service_role per the default ACL

**PG semantics**:
- `REVOKE FROM public` removes the *pseudo-role* PUBLIC grant; does NOT touch explicit `anon=X/postgres` entry in proacl
- `REVOKE FROM authenticated` removes the explicit authenticated grant — but on next CREATE OR REPLACE, pg_default_acl re-applies the grant
- The migration NEVER says `REVOKE FROM anon` — the explicit anon grant is never touched

**Post-Apr-1 CREATE OR REPLACE (3 of 13)**:
- `record_installment_payment` re-created at `20260501215059_*.sql`
- `record_stripe_payment` re-created at 5 migrations (20260417190000 + 20260418092500 + 20260418151840 + 20260419000000 + 20260422174520)
- `auto_issue_credit_on_absence` re-created at `20260403000004_fix_credit_reversal_on_attendance_change.sql`

**HEAD state DB-verified** (Phase 2.0a + 2.1; `pg_proc.proacl` + `has_function_privilege()`): all 13 cohort fns retain `anon=X/postgres + authenticated=X/postgres + service_role=X/postgres` explicit grants; `has_function_privilege('anon', ..., 'EXECUTE')` returns TRUE for all 13.

#### 3.1.3 Cohort enumeration (F-12-006 precedent table shape)

| # | Function (with signature) | Migration line | Owning batch | Anchor finding | Standalone severity |
|---|---|---|---|---|---|
| 1 | `record_installment_payment(uuid, integer, text)` | L307-308 | batch-07 closed | F-07-003 | CRITICAL (financial-falsification via composition) |
| 2 | `record_stripe_payment(uuid, uuid, integer, text, uuid, boolean)` | L318-319 | batch-02 closed | **F-02-005** | **CRITICAL** (financial-falsification anchor) |
| 3 | `auto_issue_credit_on_absence()` | L369-370 | batch-08 closed | (CC-19 #1) | HIGH (operational hygiene) |
| 4 | `on_slot_released()` | L371-372 | batch-08 closed | (CC-19 #1) | HIGH (operational hygiene) |
| 5 | `auto_add_to_waitlist()` | L373-374 | batch-08 closed | (CC-19 #1) | HIGH (operational hygiene) |
| 6 | `notify_makeup_match_webhook()` | L375-376 | batch-08 closed | (CC-19 #1 closed-batch-08) | HIGH (operational hygiene) |
| 7 | `cleanup_attendance_on_cancel()` | L377-378 | batch-08 closed | (CC-19 #1) | HIGH (operational hygiene) |
| 8 | `cleanup_rate_limits()` | L381-382 | cross-cutting | (CC-19 #1) | HIGH (operational hygiene) |
| 9 | `reset_stale_streaks()` | L383-384 | **batch-13 (PI-52-A subsumed)** | F-13-001 META anchor | HIGH (operational disruption — cross-tenant streak reset) |
| 10 | `complete_expired_assignments()` | L385-386 | **batch-13 (PI-52-O subsumed)** | F-13-001 META anchor | HIGH (operational disruption — cross-tenant assignment status flip) |
| 11 | `generate_invoice_number(uuid)` | L389-390 | cross-cutting | (F-05-001 chain) | HIGH (operational hygiene) |
| 12 | `set_invoice_number()` | L391-392 | cross-cutting | (CC-19 #1) | HIGH (operational hygiene) |
| 13 | `find_waitlist_matches(uuid, uuid, uuid)` | L395-396 | batch-08 closed | **F-08-002** | **CRITICAL** (child-PII anon-callable) |

#### 3.1.4 Composition reasoning (event #14)

Three closed-CRITICAL anchors in cohort:
- **F-02-005** (record_stripe_payment financial-falsification; batch-02 close; closed-batch-immutable)
- **F-07-003** (record_installment_payment financial-falsification composition via F-02-005; batch-07 close)
- **F-08-002** (find_waitlist_matches child-PII anon-callable; batch-08 close)

The AUTH-H5 migration was the ALTERNATIVE remediation track (REVOKE EXECUTE to strip attack surface without body change). Body anchor-fixes never applied to any of the 3 closed-CRITICAL anchors:
- F-02-005 anchor fix (findings/02-org-management.md:443-451): `IF NOT is_org_finance_team(auth.uid(), _org_id) THEN RAISE EXCEPTION 'Not authorised to record Stripe payments';` — body unchanged at HEAD
- F-07-003 body anchor unchanged at HEAD (per batch-07 close + s51 close verification)
- F-08-002 body anchor unchanged at HEAD (per batch-08 close)

AUTH-H5 fails per §3.1.2 root cause → 3 closed-CRITICAL anchors remain anon-callable at HEAD → **composition-CRITICAL** via F-06-001/F-06-003 event #9 precedent.

**Severity-adjustment event #14**: PI-52-P standalone HIGH → CRITICAL via composition.

#### 3.1.5 Closed-batch immutability (per PLAN.md §6)

F-02-005 + F-07-003 + F-08-002 severities IMMUTABLE; F-13-001 META captures migration-pattern-failure explaining why these anchors remain live-exploitable at HEAD despite migration intent. No re-tag of closed-batch findings.

#### 3.1.6 6-dim class-shape adjudication for PI-52-A + PI-52-O (subsumed per Sub-option 2)

PI-52-A `reset_stale_streaks` + PI-52-O `complete_expired_assignments` 6-dim comparison vs 5 DB-SECDEF closed-batch anchors (Phase 2.2):

| Anchor | Match strength | Rationale |
|---|---|---|
| F-02-002 | PARTIAL 2/6 | D1+D2+D4 strong; D3 NO-MATCH (READ vs WRITE); D5 NO-MATCH (operational vs PII-CRITICAL); D6 NO-MATCH |
| F-02-005 | PARTIAL 3/6 | D1+D2+D4 strong; D3 PARTIAL (WRITE but operational not financial); D5 NO-MATCH; D6 PARTIAL — CLASS-DISTINCT per F-08-003 6-dim refutation precedent event #11 |
| F-02-008 | PARTIAL 3/6 (A) / NO-MATCH (O) | PI-52-A has indirect WRITE chain via update_practice_streak; PI-52-O has no chain |
| F-08-001 | PARTIAL 3/6 | CLASS-DISTINCT per F-08-003 6-dim refutation precedent |
| Pattern #40 | NO-MATCH | Dispositive D4: Pattern #40 requires structurally-present `IF <caller-context> != <param>` gate that bypasses via NULL 3VL; PI-52-A/O have NO gate at all |

Strongest sibling = F-02-002 ("no gate at all") matched at 2/6; class-shape candidate at META level is migration-pattern-failure (Sub-option 2 subsumed framing per F-12-006 precedent).

#### 3.1.7 Remediation prescription (Phase C planning)

(a) Migration adding `REVOKE EXECUTE ON FUNCTION public.<fn>(<sig>) FROM anon;` for each of 13 cohort members (13 statements)

(b) Migration adding:
```sql
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;
```
Prevents re-application on future CREATE OR REPLACE.

(c) Body anchor-fixes for F-02-005 + F-07-003 + F-08-002 per closed-batch finding docs (defense-in-depth; REVOKE alone is layer-1, body gate is layer-2)

#### 3.1.8 PI cohort tagging

- PI-52-P → CLOSED via F-13-001 META
- PI-52-A subsumed (item #9 of cohort enumeration; no individual F-13-NNN)
- PI-52-O subsumed (item #10 of cohort enumeration; no individual F-13-NNN)

#### 3.1.9 Decision needed / Target sprint / Closure

- Decision needed: No
- Target sprint: Phase C — AUTH-H5 mitigation completion (REVOKE FROM anon migration; defense-in-depth body anchor-fixes for 3 closed-CRITICAL anchors)
- Closure: (empty)

---

### 3.2 F-13-002 LOW — F-01-017 cohort 4 batch-13 anchors UPDATE-no-WITH-CHECK (PI-52-D)

| Field | Value |
|---|---|
| **ID** | F-13-002 |
| **Severity** | LOW (cohort-enrichment CAPS-at-LOW per F-12-004 selective-regression precedent) |
| **Area** | RLS policy / UPDATE-policy-missing-WITH-CHECK |
| **Phase surfaced** | 3.1 (DB-verified pg_policy + filesystem migration source) |
| **Class anchor** (drift #31 cite) | F-01-017 (findings/01-auth-sessions-rls.md:413-431) MEDIUM cluster header: "UPDATE/ALL policies on ~50 tables lack explicit `WITH CHECK` clause" |
| **Cohort** | F-01-017 cohort; pre-s52 ≥25 → post-s52 ≥29 |

#### Anchors (Phase 3.1 verbatim cites)

| # | Table | Policy | Migration:line | USING (qual) | WITH CHECK |
|---|---|---|---|---|---|
| 1 | practice_assignments | "Teachers and admins can update assignments" | 20260124023938:57-66 | org_id IN (SELECT org_id FROM org_memberships WHERE user_id = auth.uid() AND status = 'active' AND role IN ('owner','admin','teacher')) | **NULL** |
| 2 | practice_logs | "Teachers can update practice logs for feedback" | 20260124023938:108-115 | (same as #1) | **NULL** |
| 3 | resource_categories | "Staff can update categories" | 20260222224736:22-25 | is_org_staff(auth.uid(), org_id) | **NULL** |
| 4 | resources | "Staff can update own resources" | 20260124125828:40-42 | is_org_staff(auth.uid(), org_id) AND (uploaded_by = auth.uid() OR is_org_admin(auth.uid(), org_id)) | **NULL** |

#### POSITIVE counter-examples in batch-13 (selective regression framing per F-12-004)

- `resources` INSERT: `WITH CHECK (is_org_staff(auth.uid(), org_id) AND uploaded_by = auth.uid())` ✓ ownership-binding pattern
- `resource_categories` INSERT (20260222224736:20): `WITH CHECK (public.is_org_staff(auth.uid(), org_id))` ✓
- `resource_category_assignments` INSERT (20260222224736:46): `WITH CHECK (public.is_org_staff(auth.uid(), org_id))` ✓
- `resource_shares` INSERT (20260124125828:66): `WITH CHECK (is_org_staff(auth.uid(), org_id) AND shared_by = auth.uid())` ✓

Correct WITH CHECK pattern available in batch-13; 4 UPDATE policies selectively miss adoption.

#### Impact

Reliance on PG implicit default (USING reused for new-row check). Catches gross org_id-tampering. Does NOT catch FK-other-column tampering (per F-01-017 §424 analysis). Admin-only attack surface; bounded.

#### Remediation

Add explicit `WITH CHECK (...)` matching `USING (...)` clause to each of the 4 policies; bundle with F-01-017 batch-19 sweep target #16 systematic cohort closure.

#### Decision needed / Target sprint / Closure

- Decision needed: No
- Target sprint: Phase C — RLS hardening (bundle with F-01-017 batch-19 cohort sweep)
- Closure: (empty)
- PI cohort: PI-52-D → CLOSED via F-13-002

---

### 3.3 F-13-003 LOW — CC-19 #3 audit_log INSERT integrity gap cohort 7 batch-13 anchors (PI-52-E)

| Field | Value |
|---|---|
| **ID** | F-13-003 |
| **Severity** | LOW (cohort-enrichment CAPS-at-LOW per F-12-006 selective-regression precedent) |
| **Area** | DB schema / audit-trigger coverage gap / forensic-integrity |
| **Phase surfaced** | 3.2 (DB-verified pg_trigger + reviewing-Claude POSITIVE baseline) |
| **Class anchor** (drift #31 dual citation per Adjudication 23) | (a) **Class header**: F-02-010 batch-02 closed-immutable ("`audit_log` table has no INSERT-time integrity trigger; 70.1% historical NULL-actor"); (b) **Most recent cohort precedent**: F-11-003 §B batch-11 closed-immutable (lesson_notes lacks audit trigger observation) |
| **Cohort** | CC-19 #3 audit_log gap cohort; +7 batch-13 anchors |

#### Anchors (DB-verified Phase 3.2)

| # | Batch-13 table | STRONG/WEAK candidacy |
|---|---|---|
| 1 | **practice_streaks** | STRONGEST (F-02-008 chain spine; PI-52-A state-reset via SECDEF trigger; GDPR Art-32) |
| 2 | **resource_shares** | STRONGEST (cross-batch cascading-DELETE via trg_cleanup_resource_shares_on_student_archive; GDPR child-data) |
| 3 | **practice_logs** | STRONGEST (parent + staff write surface; student-attributed data; GDPR Art-32) |
| 4 | practice_assignments | STRONG (parent+staff visible; PI-52-O cron-RPC writes status) |
| 5 | resources | STRONG (file-upload metadata; GDPR child-content) |
| 6 | resource_categories | WEAKER (admin-only configuration table) |
| 7 | resource_category_assignments | WEAKER (junction table; least critical) |

#### POSITIVE baseline (28 audit triggers schema-wide)

DB-confirmed: 28 tables have audit_X AFTER INSERT triggers via `log_audit_event_singular` helper fn. Examples: students, lessons, make_up_credits, make_up_waitlist, attendance_records (uses `audit_attendance_changes` instead), invoices, payments, internal_messages (POSITIVE counter-example for batch-12 §3.6 F-12-006 selective regression).

**0 of 7 batch-13 tables have audit_X triggers**. Class-pattern strong: 28/35 schema coverage with batch-13 as 7-table gap.

#### Out-of-scope observation

All 28 audit triggers fire on **INSERT only** — UPDATE/DELETE NOT audited via these triggers. F-02-010 class anchor is specifically the INSERT integrity gap; batch-13's 7 missing audit_X INSERT triggers match the class. UPDATE/DELETE non-audit is a SEPARATE class-shape outside scope of F-02-010 + F-11-003 §B + F-13-003.

#### Remediation

Apply `audit_<table>` AFTER INSERT trigger calling `log_audit_event_singular()` to each of 7 batch-13 tables; pattern matches 28-table POSITIVE baseline exactly.

#### Decision needed / Target sprint / Closure

- Decision needed: No
- Target sprint: Phase C — audit-trigger coverage sweep (bundle with batch-19 cohort target)
- Closure: (empty)
- PI cohort: PI-52-E → CLOSED via F-13-003

---

### 3.4 F-13-004 LOW — CC-19 #11 column-CHECK-absent cohort 5 batch-13 anchors (PI-52-N partial)

| Field | Value |
|---|---|
| **ID** | F-13-004 |
| **Severity** | LOW (cohort-enrichment CAPS-at-LOW per F-07-006/007 + F-09-012 + F-10-004 precedent chain) |
| **Area** | DB schema / column CHECK constraint absence |
| **Phase surfaced** | 3.6 (DB-verified pg_constraint + information_schema.columns scan) |
| **Class anchor** (drift #31 cite) | F-07-006/F-07-007 batch-07 closed (no positive CHECK on amount_minor columns) + F-09-012 batch-09 closed (4-column financial-amount CHECK cohort) + F-10-004 batch-10 closed (NOT-VALID variant sub-class introduction) |
| **Cohort** | CC-19 #11 column-CHECK-absent; pre-s52 14 → post-s52 19 |

#### Anchors (DB-verified Phase 3.6)

| # | Column | Type | Default | Plausible CHECK |
|---|---|---|---|---|
| 1 | `practice_assignments.target_minutes_per_day` | integer | 30 | `> 0` (zero-minute targets nonsensical) |
| 2 | `practice_assignments.target_days_per_week` | integer | 5 | `BETWEEN 1 AND 7` (day-count range) |
| 3 | `practice_streaks.current_streak` | integer | 0 | `>= 0` (no negative streaks) |
| 4 | `practice_streaks.longest_streak` | integer | 0 | `>= 0` (no negative streaks) |
| 5 | `resources.file_size_bytes` | integer | — | `> 0` (positive file sizes) |

#### Confirmed validated CHECK constraints (POSITIVE baseline)

- `practice_assignments_status_check` validated=true: `CHECK (status IN ('active','completed','cancelled'))`
- `practice_logs_duration_minutes_check` validated=true: `CHECK (duration_minutes > 0 AND duration_minutes <= 720)`

**0 NOT-VALID variants** in batch-13 (matches launching prompt §6 PI-52-N pre-judgment on NOT-VALID specifically).

#### Magnitude-limiting note for F-13-001 × PI-52-A composition

practice_streaks.current_streak/longest_streak default-to-0 + no CHECK >= 0 means a successful anon-callable RESET via reset_stale_streaks (PI-52-A within F-13-001 cohort #9) hits already-default-or-positive state; no negative-value attack vector. This is a magnitude-LIMITING factor for F-13-001 × PI-52-A specifically — but does NOT bracket-shift F-13-001 (still CRITICAL via composition with F-02-005 financial-falsification).

#### Remediation

Add explicit `CHECK` constraints to each of 5 columns; bundle with batch-19 sweep target #11.

#### Decision needed / Target sprint / Closure

- Decision needed: No
- Target sprint: Phase C — schema-hardening cohort
- Closure: (empty)
- PI cohort: PI-52-N partial → CLOSED via F-13-004

---

### 3.5 PI-52-B citation — F-02-008 closed-batch-02 HIGH composition chain (no fresh F-13-NNN per s51 §3.9 pattern)

**F-02-008 closed-batch-02 HIGH class** (findings/02-org-management.md:521-573; batch-02 closed-immutable; "_notify_streak_milestone cross-tenant audit-log injection + parent-notification injection") continues to apply at HEAD pin `f1e8cf41`.

#### Chain integrity verified at HEAD

```
practice_log INSERT
  → update_practice_streak trigger AFTER INSERT (CENSUS:872; rettype=trigger; SECDEF + anon=X EXECUTE)
  → milestone threshold met (3/7/14/30/60/100 days)
  → PERFORM _notify_streak_milestone(_student_id, _org_id, _new_current)
  → INSERT audit_log with actor_user_id=NULL (forgery; Effect 1)
  → PERFORM net.http_post to /functions/v1/streak-notification
       (headers: Content-Type + x-cron-secret + Authorization Bearer <service-role-key>)
  → streak-notification edge fn validateCronAuth pass via x-cron-secret header
  → INSERT message_log (L203) + Resend email to guardians (Effect 2 parent-notification delivery)
```

#### Migration touch history (drift #36 mandate operational application)

Per Phase 5 ACK 2 / drift #36 ratification:
- `20260316310000_fix_practice_tracking_audit.sql` (initial CREATE OR REPLACE for `_notify_streak_milestone`)
- `20260426222037_18b1ef7a-8105-4738-a625-cddd9ff3a749.sql` (intermediate)
- `20260507100000_audit_t01_p3_entity_type_normalisation.sql` (audit_log entity_type changes)
- `20260509084937_notify_streak_milestone_defensive.sql` (x-cron-secret + RAISE WARNING + IF-NULL + COALESCE; enables validateCronAuth pass)

Live-DB body verified via `SELECT prosrc FROM pg_proc` at reviewing-Claude side (drift #36 operational application; supersedes Phase 2.4 migration-source-only verification path).

#### CENSUS attribution

CENSUS:889 attributes `_notify_streak_milestone` to "Audit-log infrastructure" group → 19-cross-cutting. Security class is captured at F-02-008 (batch-02 close adjudication HIGH per parameter-spoofing + cross-tenant-write class CAPS-at-HIGH). No batch-13 audit action.

#### streak-notification edge fn body (Phase 4.1d adjudication)

streak-notification edge fn body (verify_jwt=false + body-level validateCronAuth cron-secret gate + accepts caller-supplied {student_id, new_streak, org_id} without cross-tenant consistency validation) is the **Effect 2 delivery surface** of the F-02-008 chain. No independent F-13-NNN allocation — F-02-008 already captures the full chain class. Pattern #41 NO MATCH (class-DISTINCT on D2 reachability axis per Phase 4.1b 6-dim adjudication; Pattern #41 anchor F-12-003 requires `verify_jwt=true OR Authorization+getUser(token)` user-auth gate; streak-notification uses cron-secret service-trust gate).

#### PI cohort tagging

PI-52-B → CLOSED via §3.5 citation. PI-52-H → CLOSED via Pattern #41 class-distinct adjudication; streak-notification body absorbed by this §3.5 citation.

---

### 3.6 PI-52-C citation — F-02-020 closed-batch-02 MEDIUM helper-fn EXECUTE-grant cohort (no fresh F-13-NNN per s51 §3.10 pattern)

**F-02-020 closed-batch-02 MEDIUM class** (findings/02-org-management.md:1013-1078; batch-02 closed-immutable; "Helper-fn information-disclosure class (19 fns) — cross-tenant enumeration via SECDEF helpers") continues to apply at HEAD pin `f1e8cf41`.

#### 5 batch-13-RLS-consumer helpers re-verified at HEAD (Phase 2.5 DB-verified)

| Helper | rettype | secdef | anon=X | auth=X | srv=X |
|---|---|---|---|---|---|
| `is_org_staff(uuid, uuid)` | boolean | TRUE | TRUE | TRUE | TRUE |
| `is_org_admin(uuid, uuid)` | boolean | TRUE | TRUE | TRUE | TRUE |
| `is_parent_of_student(uuid, uuid)` | boolean | TRUE | TRUE | TRUE | TRUE |
| `has_org_role(uuid, uuid, app_role)` | boolean | TRUE | TRUE | TRUE | TRUE |
| `is_org_member(uuid, uuid)` | boolean | TRUE | TRUE | TRUE | TRUE |

All 5 retain anon+auth+srv EXECUTE grants matching F-02-020 cohort intent. Track 1 fix (findings/02-org-management.md:1051-1068; 17-helper REVOKE list) not yet applied; consistent with s51 close.

#### Distinct from F-13-001 META cohort

The 5 batch-13-RLS-consumer helpers are a DIFFERENT cohort from the 13-fn AUTH-H5 cohort (F-13-001 META). F-02-020 Track 1 deferred to Phase C; AUTH-H5 migration `20260401000000` did NOT include F-02-020 helpers in its REVOKE scope.

#### PI cohort tagging

PI-52-C → CLOSED via §3.6 citation.

---

### 3.7 PI-52-F citation — CC-19 #1 closed-batch-08 hygiene-only sub-class cohort enrichment +2 (no fresh F-13-NNN per s51 §3.11 pattern)

2 batch-13 trigger fns added to CC-19 #1 hygiene-only sub-class:

| Trigger fn | rettype | anon=X EXECUTE | Practical impact |
|---|---|---|---|
| `cleanup_resource_shares_on_student_archive` | trigger | TRUE | Hygiene-only — PostgREST does not directly RPC-call trigger fns even with anon EXECUTE; fires only on students table DML (cross-batch reach: batch-02 students → batch-13 resource_shares cascading DELETE) |
| `update_practice_streak` | trigger | TRUE | Hygiene-only; entry to F-02-008 chain (AFTER INSERT on practice_logs) |

Hygiene-only practical impact per `notify_makeup_match_webhook` closed-batch-08 precedent (s51 §3.11 cite framing).

#### Class precedent

F-09-002 + F-10-008 + F-11-002 cohort (LOW hygiene class CAPS-at-LOW). Closed-batch-08 sub-class subsumption per s51 §3.11 precedent.

#### Cumulative cohort

CC-19 #1 hygiene-only sub-class: pre-s52 ~7 → post-s52 ~9.

#### PI cohort tagging

PI-52-F → CLOSED via §3.7 citation.

---

## §4 Cross-batch reach

Per §2.3 + §3 finding-specific cross-batch citations. Notable batch-13 surface implications:

- `trg_cleanup_resource_shares_on_student_archive` (CENSUS:759) — trigger ON students (batch-02 closed) cascades DELETE on resource_shares (batch-13); audit-log gap captured by F-13-003 cohort entry #2
- F-02-008 chain endpoint (streak-notification edge fn) at batch-13; cited §3.5
- F-02-020 helpers consumed in batch-13 RLS predicates; cited §3.6
- F-13-001 META cohort spans batches 02 + 07 + 08 + 13 + cross-cutting; 3 closed-CRITICAL anchors (F-02-005 + F-07-003 + F-08-002) in cohort

---

## §5 Positive observations

### 5.1 POS-3 EXPLICIT — practice_streaks RLS write-through-SECDEF-trigger

Migration `20260316310000_fix_practice_tracking_audit.sql:5+12-20` verbatim:
```
L5:  -- F3 MEDIUM: Lock down practice_streaks INSERT/UPDATE to trigger-only
L12: -- F3: Lock down practice_streaks INSERT/UPDATE to service-role / trigger only
L13: -- The SECURITY DEFINER trigger bypasses RLS, so authenticated users should
L14: -- never write directly to practice_streaks.
L15: -- ---------------------------------------------------------------------------
L16: DROP POLICY IF EXISTS "Users can insert own streaks" ON public.practice_streaks;
L17: DROP POLICY IF EXISTS "Users can update own streaks" ON public.practice_streaks;
L18: DROP POLICY IF EXISTS "System can insert streaks" ON public.practice_streaks;
L19: DROP POLICY IF EXISTS "System can update streaks" ON public.practice_streaks;
L20: -- No replacement INSERT/UPDATE policies: only SECURITY DEFINER trigger writes.
```

Explicit DROP + comment block documenting intent → POS-3 design pattern CONFIRMED for practice_streaks. Not a defect — intentional architecture choice.

### 5.2 POS-3 IMPLICIT (NEW sub-class #5 at s52) — junction-table immutable-link via application convention

Class-shape (ratified Phase 5.1d): "Junction-table immutable-link UPDATE-policy absence via application convention (DELETE-THEN-INSERT FE write pattern; no migration source comment explicitly documenting intent)"

Sole-pair anchor at s52: **resource_shares + resource_category_assignments**

Distinct from POS-3 EXPLICIT (practice_streaks F3 MEDIUM migration comment).

#### FE evidence

`resource_shares` (DELETE-THEN-INSERT pattern):
- `src/hooks/useUpdateResource.ts:63` — pure DELETE unshare
- `src/hooks/useResources.ts:275-309` — DELETE-THEN-INSERT share-set management ("Get existing shares" SELECT + "Remove old shares" DELETE + "Add new shares" INSERT)

`resource_category_assignments` (DELETE-THEN-INSERT pattern):
- `src/hooks/useResourceCategories.ts:117-128` — "Delete existing assignments" DELETE + "Insert new assignments" INSERT
- `src/hooks/useResources.ts:186` — similar pattern

#### Fragility caveat

A new developer reading the migration could add an UPDATE policy without seeing the original design intent. Phase C may convert IMPLICIT → EXPLICIT via documentation-only migration-comment addition.

#### Single-anchor-pair placement precedent

Sub-E sub-class introduction at s50 (F-11-002 Sub-E single-anchor placement) is the precedent for placing a sub-class at single-anchor (or single-anchor-pair) evidence when class-shape is well-defined and clearly distinct from existing catalog.

**Cumulative sub-class introductions: 4 → 5 (POS-3 IMPLICIT NEW s52)**

### 5.3 Sub-E POSITIVE — streak-notification bare `catch (error)` at L82 + L225

Selective regression POSITIVE within batch-13 (cleanup-orphaned-resources:107 is the regression — captured in §10 CC-19 #7 Sub-E cohort enrichment).

### 5.4 CC-19 #10 POSITIVE — streak-notification wrapEdgeFn invocation at L88 + import at L6

Selective regression POSITIVE within batch-13 (cleanup-orphaned-resources bare `Deno.serve` at L21 is the regression — captured in §10 CC-19 #10 cohort enrichment).

### 5.5 Internal-trust pattern observation-only (Phase 5.1c ratified)

Class-shape sketch: "edge fn body has internal-trust gate (cron-secret OR service-role bearer body validation, NOT user-auth gate); accepts caller-supplied identity parameter(s); performs action on/for that identity without body-level consistency validation"

Sole anchor: streak-notification at s52.

**NOT promoted to Pattern catalog** per Phase 5 ACK 2 refined rationale:
- streak-notification body defect fully absorbed by F-02-008 closed-batch citation (§3.5); Pattern slot would duplicate closed-batch downstream-effect coverage
- Pattern #42 distinguishable on substrate: discrete syntactic diff (Pattern #42) vs semantic body-audit verdict (internal-trust); syntactic defects warrant CANDIDATE at single anchor; semantic verdicts warrant observation-only until evidence accumulates

Batch-19 watchlist: if ≥1 additional internal-trust+caller-supplied-identity instance NOT absorbed by closed-batch chains surfaces in batches 14-18, reconsider as Pattern #41 Sub-B sub-class introduction OR fresh Pattern slot.

---

## §6 Pre-investigation register updates

| PI | Disposition |
|---|---|
| PI-52-A | CLOSED via subsumption in F-13-001 META (item #9 of cohort) |
| PI-52-B | CLOSED via §3.5 citation (F-02-008 closed-batch-02 HIGH chain continues to apply) |
| PI-52-C | CLOSED via §3.6 citation (F-02-020 closed-batch-02 MEDIUM helpers continue to apply) |
| PI-52-D | CLOSED via F-13-002 LOW |
| PI-52-E | CLOSED via F-13-003 LOW |
| PI-52-F | CLOSED via §3.7 citation + CC-19 #1 cohort enrichment +2 |
| PI-52-G | CLOSED via POS-3 EXPLICIT (practice_streaks; §5.1) + POS-3 IMPLICIT sub-class #5 (resource_shares + resource_category_assignments; §5.2) |
| PI-52-H | CLOSED via Pattern #41 class-distinct adjudication (Phase 4.1b); streak-notification body absorbed by §3.5 citation |
| PI-52-I | CLOSED via Phase 1.7 (registry-entry missing for both batch-13 edge fns; Pattern #42 NO MATCH) |
| PI-52-J | CLOSED via Phase 1.7 (neither batch-13 edge fn calls checkRateLimit; CC-19 #16 Sub-B NO MATCH) |
| PI-52-K | DEFERRED to post-Phase-B editorial (push_tokens cross-cutting attribution per Phase 1.3; not feature-batch-13-owned) |
| PI-52-L | CLOSED via CC-19 #7 Sub-E cohort enrichment +1 + CC-19 #10 cohort enrichment +1 (Phase 4.3 + 4.4) |
| PI-52-M | CLOSED via CC-19 #4 useCan cohort enrichment +3 per-usage (Phase 1.5) |
| PI-52-N | CLOSED via F-13-004 LOW (partial; column-CHECK-absent class) |
| PI-52-O | CLOSED via subsumption in F-13-001 META (item #10 of cohort) |
| PI-52-P | CLOSED via F-13-001 META allocation |

**PI cohort 5 active+partial (1C / 3H / 1M / 0L)**: unchanged from s51 close (PI-12 + PI-09 + PI-10 + PI-16 + PI-17); no batch-13 contribution to historical PI register.

---

## §10 CC-19 cross-cutting cohort enrichments

| Carry | Batch-13 contribution | Cumulative pre → post |
|---|---|---|
| CC-19 #1 helper-fn EXECUTE-grant hygiene-only sub-class | +2 trigger fns (subsumed §3.7 PI-52-F: cleanup_resource_shares_on_student_archive + update_practice_streak) | ~7 → ~9 |
| CC-19 #3 audit_log INSERT integrity gap | +7 batch-13 anchors (subsumed F-13-003) | ACTIVE-mixed enriched |
| CC-19 #4 useCan unimplementation | +3 per-usage (Resources.tsx:77 canUpload + ResourceCard.tsx:64 canDelete + ResourceDetailModal.tsx:50-52 canEdit) | ≥215 → ≥218 |
| CC-19 #7 Sub-E catch-block hygiene | +1 per-instance (cleanup-orphaned-resources:107) | 40 → 41 |
| CC-19 #10 Sentry edge-fn instrumentation | +1 per-fn (cleanup-orphaned-resources bare Deno.serve at L21) | ~10 → ~11 |
| CC-19 #11 column-CHECK-absent | +5 batch-13 anchors (subsumed F-13-004) | 14 → 19 |
| F-01-017 cohort | +4 batch-13 anchors (subsumed F-13-002) | ≥25 → ≥29 |

---

## §11 Audit-method appendix

### §11.A Severity-adjustment events at s52

**Event #14 RATIFIED**: PI-52-P standalone HIGH → CRITICAL via composition with F-02-005 + F-07-003 + F-08-002 closed-CRITICAL anchors per F-06-001/F-06-003 event #9 precedent.

Event row text:
```
14  PI-52-P META (s52)  (HIGH standalone) ↑ CRITICAL
    Composition with F-02-005 closed-CRITICAL anchor (record_stripe_payment financial-falsification)
    + F-07-003 closed-CRITICAL (record_installment_payment) + F-08-002 closed-CRITICAL (find_waitlist_matches)
    via F-06-001/F-06-003 event #9 precedent (composition-discovery escalation);
    AUTH-H5 migration partial-mitigation cohort retains anon EXECUTE on 13 fns including 3 closed-CRITICAL anchors at HEAD;
    composition CRITICAL
```

**Cumulative events through s52: 14** (13 pre-s52 + 1 event #14).

### §11.B Pattern catalog changes at s52

- Pattern #41 — unchanged single-anchor PLACED (F-12-003); streak-notification class-DISTINCT on D2 reachability axis (Phase 4.1b)
- Pattern #42 — unchanged single-anchor CANDIDATE (F-12-008); batch-13 +0 contribution
- **Sub-class introduction #5 NEW**: POS-3 IMPLICIT (junction-table immutable-link via application convention; resource_shares + resource_category_assignments anchor pair)
- Internal-trust pattern: observation-only (NOT promoted); batch-19 watchlist
- NEGATIVE-instance flag (Pattern #27 sub-B PortalContinuation:71): unchanged

**Pattern catalog post-s52**: 36 PLACED + 6 CANDIDATES + 1 NEGATIVE-instance flag + **5 sub-class introductions** (+1 POS-3 IMPLICIT NEW s52).

### §11.C Methodology drift ratifications at s52

**Cat 1 #33 — drift #36 RATIFIED** (reviewing-Claude origin):
> "Live-DB body verification (SELECT prosrc FROM pg_proc) is canonical for SECDEF RPC body-state claims at HEAD; migration-source verification supplements but does not substitute when multiple migrations touch the same fn. Phase 2 RPC body audits MUST include SELECT prosrc FROM pg_proc query when the body claim is materially load-bearing (chain integrity, gate presence, cross-tenant validation). Migration-history enumeration via supabase_migrations.schema_migrations regex on fn name SHOULD also accompany to characterize cumulative touch chain."

Operational rule: every Phase 2 dispatch for batch 14+ MUST include explicit task line: "For each materially load-bearing RPC body claim, execute SELECT prosrc FROM pg_proc query at live-DB level; cross-reference with supabase_migrations.schema_migrations regex on fn name to enumerate cumulative migration touches."

**Cat 2 #2 — Environment caveat RATIFIED**:
> "s52 working-tree loss via macOS /tmp purge mid-Phase-2; mitigation = re-clone at canonical /tmp/lessonloop3-fresh + HEAD pin re-verify; same mitigation pattern as s46 Cat 2 #1"

**Cumulative methodology entries post-s52: 37** (33 Cat 1 + 2 Cat 2 + 2 Cat 3).

### §11.D Sub-option 2 subsumption framing for F-13-001 META

Per F-12-006 META cohort precedent (single META F-ID + cohort enumeration table + batch attribution per item):
- PI-52-A + PI-52-O subsumed into F-13-001 cohort enumeration (items #9 + #10)
- No individual F-13-NNN allocations for PI-52-A or PI-52-O
- Class-shape captured at META level; 6-dim PI-52-A/O class-distinctness from 5 DB-SECDEF anchors documented at §3.1.6

### §11.E Drift #31 verbatim cite operational application at s52

11 finding-IDs cited at Phase 0 0.3 with verbatim text from source finding docs. Finding-doc-level drift #31 operational application:
- F-01-017 anchor (findings/01-auth-sessions-rls.md:413-431) cited §3.2
- F-02-002 anchor (findings/02-org-management.md:167-225) cited §3.1.6
- F-02-005 anchor (findings/02-org-management.md:383-455) cited §3.1.3 + §3.1.4 + §3.1.7
- F-02-008 anchor (findings/02-org-management.md:521-573) cited §3.5
- F-02-010 class header + F-11-003 §B cohort precedent (Adjudication 23 dual citation) cited §3.3
- F-02-020 anchor (findings/02-org-management.md:1013-1078) cited §3.6
- F-06-001/F-06-003 event #9 precedent (PLAN.md §4.1 events row 9) cited §3.1.4 + §11.A
- F-07-003 closed-batch-07 CRITICAL anchor cited §3.1.3
- F-07-006/007 + F-09-012 + F-10-004 precedent chain cited §3.4
- F-08-002 closed-batch-08 CRITICAL anchor cited §3.1.3 + §3.1.4
- F-11-002 Sub-E single-anchor placement precedent (findings/11-parent-portal.md:260-274) cited §5.2 (POS-3 IMPLICIT placement precedent)
- F-12-003 Pattern #41 anchor verbatim class-shape (findings/12-messages-notifications.md §11.E) cited §3.5 (Pattern #41 class-distinct adjudication)
- F-12-006 META cohort precedent (findings/12-messages-notifications.md §3.6) cited §3.1 + §11.D

### §11.F Drift #29 EXECUTE grant enumeration operational application at s52

- 10 SECDEF RPCs enumerated at Phase 2.1 via `has_function_privilege()` for anon + authenticated + service_role roles (Drift #29 operational mandate from s49)
- 13-fn AUTH-H5 cohort additionally enumerated at Phase 2.0a (DB-side root-cause confirmation)
- 5 F-02-020 cohort helpers re-verified at Phase 2.5

### §11.G Drift #36 live-DB body verification operational application at s52

`_notify_streak_milestone` body re-verified via `SELECT prosrc FROM pg_proc` at reviewing-Claude side; migration touch history enumerated via `supabase_migrations.schema_migrations` regex (4 cumulative migration touches: 20260316310000 + 20260426222037 + 20260507100000 + 20260509084937). Drift #36 retroactively applied to Phase 2.4 verification path; substantive conclusion (chain integrity intact) confirmed by live-DB body cross-reference. Per §11.C operational rule, this becomes the standard for Phase 2 dispatches batch 14+.

### §11.H Phase 0 push hygiene check operational at s52

PLAN.md §3 rule 7 second application clean: `git rev-parse origin/main` == `git rev-parse HEAD` == `f1e8cf41e828c2913a68e5c920cba79a3f92896d` pre-Phase-1 dispatch. No divergence detected; workflow rule continues operational for s53+.
