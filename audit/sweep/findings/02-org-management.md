# Batch 02 — Org Management — Findings

> **AUDIT IN PROGRESS — DO NOT FIX YET**

| Field | Value |
|---|---|
| Batch | 02-org-management |
| Phase | B (Systematic Audit) |
| Authoring session | s41 (2026-05-12) |
| HEAD pin | `beb496fe0ba420a21fb5fe3fe994560bde865cd3` (2026-05-11 20:55 BST) |
| Findings | 36 total (5 Critical / 10 High / 8 Medium / 13 Low) |
| Cumulative grand total active (PI active + batch 01 + batch 02) | 88 finding-instances (16 Critical / 21 High / 19 Medium / 32 Low) — see §10 + §12.7 for PI-08 elevation reconciliation. PI cohort retains PI-08 as historical entry (17 total PI ledger) tagged RESOLVED. |
| Status | Phase B EXIT; awaiting Phase 10 commit |

---

## 1. Audit basis

**Surface coverage.** Six org-management pages (`Onboarding`, `Students`, `Teachers`, `Locations`, settings tabs touched), five edge functions (`onboarding-setup`, `invite-accept`, `batch-invite-guardians`, `send-invite-email`, `complete_onboarding` RPC body), 28 `_user_id`-class SECDEF fns (Phase 5), 62 entity-context-class SECDEF fns (Phase 7C + 7.5). Total SECDEF identity/entity-shape fns audited: **90**.

**Enumeration completeness.** `pg_proc` regex sweep across 18 parameter-name variants for identity-shape params (`_user_id`, `p_user_id`, `_teacher_user_id`, `_actor_user_id`, `_caller_id`, `_by_user`, `_initiator`, `_operator`, `_actor_uuid`, `_owner_id`, `_granter`, `_creator`, `_author`, `_modifier`, `_invoker`, `_executor`, `_requester`, `_target_user`). Bare-prefix variants (`guardian_id`, `student_id` without `_` prefix — surfaced `anonymise_guardian`, `anonymise_student`) caught via widened sweep in Phase 7.5A. **Final class population is locked.**

**DiD methodology.** For write-class FAILs, Defence-in-Depth assessed via:
1. `pg_trigger` inventory on target tables (BEFORE / AFTER / event mask)
2. Trigger fn body analysis for `auth.uid()`, `current_setting('role')`, RAISE-on-condition patterns
3. PL/pgSQL transaction-rollback model — function body forms a single implicit transaction; trigger `RAISE EXCEPTION` rolls back all preceding writes (Phase 4 self-correction model)

Per the audit rubric: severity stays on class-consistency grounds regardless of DiD presence; partial-DiD bounded to specific row-state (e.g., draft-only) is documented and does not soften severity (Phase 7.5C precedent).

**Class FAIL ratios.**
- `_user_id`-class: 24 FAIL / 27 examined = **89% FAIL** (3 PASS: 1 self-check + 2 alternate-mechanism)
- Entity-context-class: 15 FAIL / 62 examined = **24% FAIL** (47 PASS)
- Cross-class total: **39 FAIL / 90 examined = 43% across full SECDEF identity/entity-shape surface**

**Sample-first methodology + decision gates.** Phase 7C used a 15-fn entity-context sample. Returned 53% FAIL with 3 Critical-class confirmed — both decision-gate triggers (>30% FAIL OR any Critical-class) fired per the s41 rubric. Phase 7.5 audited the remaining 45 fns to close the class; final population FAIL ratio is the 24% above.

**Honest limitations.**
- **`useCan` site count:** Phase 3 enumerated 188 sites consuming `useCan` (+33 vs V2 plan baseline of 155). Per-site review was sampled (15/188); the remaining 173 sites are tracked via the `useCan` unimplementation finding (F-02-027) as compound drift, not individually audited.
- **Zoom sub-surface deferral:** Zoom-specific surface (`zoom-oauth-callback`, `zoom-oauth-start`, `zoom-sync-lesson` edge fns; `ZoomOAuthCallback.tsx`; `ZoomIntegrationTab`; `ZoomGuide` marketing page) is deferred pending external Zoom authorization/verification. **Sub-surface deferral within batches 15 / 18 / 21**, not whole-batch shelving. Not applicable to batch 02 directly but noted for cross-batch carry awareness.
- **F-01-005 data-divergence dimension:** Phase 7C confirmed `get_parent_lesson_notes` auth posture is correct; the data-divergence concern from F-01-005 (group-lesson whole-lesson notes) was not re-audited.

**Severity rubric anchor.** All severity assignments cite `audit/sweep/PLAN.md` §4. Critical = financial loss / data loss / security exposure / marketed-feature-fundamentally-broken / first-encounter trust erosion. High = degraded-but-working / silent-failure / surprising. Medium = cosmetic-visible / timezone-edge / non-critical race / minor UX dead-end. Low = code-hygiene / stale comment / minor docstring / legacy artefact.

---

## 2. Findings index

| ID | Sev | Phase | One-liner |
|---|---|---|---|
| F-02-001 | Critical | 2 | `complete_onboarding` SECDEF RPC accepts caller-supplied `_user_id`; anon-callable; single-trigger-deep DiD via `trg_block_owner_insert` |
| F-02-002 | Critical | 5 | `get_students_for_org` anonymous cross-tenant child-PII exfiltration (HEADLINE) |
| F-02-003 | Critical | 7C | `cleanup_withdrawal_credits` anonymous cross-tenant destructive write (voids credits, cancels waitlist) |
| F-02-004 | Critical | 7C | `record_installment_payment` anonymous cross-tenant installment-as-paid falsification + vestigial `p_amount_minor` |
| F-02-005 | Critical | 7C | `record_stripe_payment` anonymous cross-tenant payment falsification — PI-08 elevation HIGH → CRITICAL |
| F-02-006 | High | 1 | `Teachers.processRemoval` multi-step write rollback discipline (5+ writes, no transaction) |
| F-02-007 | High | 5 | `check_rate_limit` cross-user counter spoofing → targeted DoS (incl. GDPR Art 12 dimension) |
| F-02-008 | High | 5 | `_notify_streak_milestone` cross-tenant audit-log injection + parent-notification injection (child-safeguarding adjacency) |
| F-02-009 | High | 5 | `get_student_ids_for_parent` cross-user student-set enumeration (child-safeguarding adjacency; array-return amplification) |
| F-02-010 | High | 6 | `audit_log` table has no INSERT-time integrity trigger; 70.1% historical NULL-actor |
| F-02-011 | High | 6 | `get_user_id_by_email` anonymous email→UUID enumeration (auth-schema-crossing) |
| F-02-012 | High | 7C | `find_waitlist_matches` anonymous cross-tenant waitlist-PII leak (guardian email + child name; child-safeguarding adjacency) |
| F-02-013 | High | 7C | `materialise_continuation_lessons` anonymous cross-tenant lesson-spam (200/call cap; downstream billing chain risk) |
| F-02-014 | High | 7.5 | `backfill_guardian_default_pm_set` anonymous cross-tenant guardian payment-preference write |
| F-02-015 | High | 7.5 | `respond_to_enrolment_offer` anonymous cross-tenant accept/decline (child-safeguarding adjacency; sibling-asymmetry vs `respond_to_makeup_offer`) |
| F-02-016 | Medium | 1 | `Students.tsx:290-297` stale comment "Server-side enforcement pending" — `enforce_student_limit` trigger DOES exist |
| F-02-017 | Medium | 2 | `send-invite-email` edge fn fire-and-forget Resend invocation; status-fidelity gap |
| F-02-018 | Medium | 2 | `send-invite-email` edge fn re-callable; duplicate-email risk on retry |
| F-02-019 | Medium | 2 | `batch-invite-guardians` invite-created-even-if-email-failed; status-fidelity gap |
| F-02-020 | Medium | 5 | Helper-fn information-disclosure class (19 fns) — cross-tenant enumeration via SECDEF helpers |
| F-02-021 | Medium | 7C | `count_lessons_on_dates` anonymous cross-tenant calendar-aggregate enumeration |
| F-02-022 | Medium | 7.5 | `generate_invoice_number` anonymous cross-tenant invoice-counter pollution |
| F-02-023 | Medium | 7.5 | `recalculate_installment_status` anonymous cross-tenant state-recompute write |
| F-02-024 | Low | 1 | `Locations.handleSetPrimary` stale primary-location handling on race |
| F-02-025 | Low | 1 | `Teachers.handleSelfAdd` no idempotency check |
| F-02-026 | Low | 1 | `Locations.confirmDeleteLocation` cascade-documentation gap on multi-step write |
| F-02-027 | Low | 3 | `useCan` unimplemented; 188 consumer sites (+33 vs V2 plan baseline) |
| F-02-028 | Low | 3 | `OrgContext` cross-tab persistence drift on org switch |
| F-02-029 | Low | 4 | `17e3ff72-...` orphan-org E2E fixture artefact (no current-user owner edge) |
| F-02-030 | Low | 4 | `25b57950-...` multi-owner state E2E fixture artefact |
| F-02-031 | Low | 5 | `user_has_continuation_response_in_run` niche cross-user enumeration |
| F-02-032 | Low | 5 | `get_lesson_notes_for_staff` vestigial `p_user_id` + `p_role` parameters (auth layer correct) |
| F-02-033 | Low | 7A | TS-bypass-cast prevalence class — 30 sites across 21 FE files |
| F-02-034 | Low | 7C | `is_org_active` + `is_org_write_allowed` class — cross-tenant subscription-state boolean probing |
| F-02-035 | Low | 7.5 | `continuation_run_org_id` anonymous cross-tenant run→org_id mapping probe |
| F-02-036 | Low | 7.5 | `get_unmarked_lesson_count` anonymous cross-tenant workflow-state aggregate enumeration |

---

## 3. Critical findings

### F-02-001 — `complete_onboarding` SECDEF RPC accepts caller-supplied `_user_id`; anon-callable; single-trigger-deep DiD

- **Severity:** **Critical**
- **Area:** secdef / onboarding-flow
- **Phase surfaced:** 2
- **Evidence:**
  - Function body (Phase 2 `pg_get_functiondef`, `public.complete_onboarding`):
    ```sql
    CREATE OR REPLACE FUNCTION public.complete_onboarding(
      _user_id uuid, _user_email text, _full_name text, _phone text,
      _org_name text, _org_type text, _country_code text, _currency_code text,
      _timezone text, _subscription_plan text, _max_students integer,
      _max_teachers integer, _parent_reschedule_policy text,
      _trial_days integer, _also_teaches boolean
    ) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
    AS $function$
    DECLARE _org_id uuid; _trial_ends_at timestamptz; _existing_org_id uuid;
    BEGIN
      SELECT current_org_id INTO _existing_org_id
      FROM profiles WHERE id = _user_id AND has_completed_onboarding = true;
      IF _existing_org_id IS NOT NULL THEN
        RETURN jsonb_build_object('success', true, 'org_id', _existing_org_id, ...);
      END IF;
      -- ... no auth.uid() check anywhere
      INSERT INTO profiles (id, email, full_name, phone, has_completed_onboarding)
      VALUES (_user_id, _user_email, _full_name, _phone, false)
      ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, ...;
      INSERT INTO organisations (id, name, org_type, ...) VALUES (_org_id, _org_name, ...);
      INSERT INTO org_memberships (org_id, user_id, role, status)
      VALUES (_org_id, _user_id, 'owner'::app_role, 'active'::membership_status)
      ON CONFLICT DO NOTHING;
      ...
    END;
    $function$
    ```
  - EXECUTE granted to `authenticated` AND `anon` (Phase 2 + Phase 5 `has_function_privilege` verification).
  - Edge fn caller [`supabase/functions/onboarding-setup/index.ts:178`](../../supabase/functions/onboarding-setup/index.ts) passes `user.id` (JWT-derived) — legitimate use is safe. **The fn itself does not enforce `auth.uid() = _user_id`.**
  - **No `IF auth.uid() != _user_id THEN RAISE` self-check anywhere in body.** Class-consistent with `undo_student_import` (F-01-003), `record_stripe_payment` (F-02-005), and the 24-fn `_user_id`-class FAIL set (Phase 5).
  - Profile path: `INSERT ... ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, ...` — the UPSERT is the account-takeover hinge in pure-SECDEF semantics. **Acknowledged: in the current schema this is rolled back by transaction semantics when the membership INSERT raises (see DiD below) — but the design itself is the defect.**
- **Defence-in-depth analysis (Phase 4 + Phase 6 self-correction):**
  - `trg_block_owner_insert` on `org_memberships` BEFORE INSERT raises if `NEW.role = 'owner' AND current_setting('role') != 'service_role'`. Trigger body (Phase 4 / Phase 6 confirmed):
    ```sql
    CREATE OR REPLACE FUNCTION public.block_owner_insert()
     RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
    AS $function$
    BEGIN
      IF NEW.role = 'owner' AND current_setting('role', true) != 'service_role' THEN
        RAISE EXCEPTION 'Cannot insert owner role directly. Use the onboarding flow.';
      END IF;
      RETURN NEW;
    END;
    $function$
    ```
  - When `complete_onboarding` runs under `authenticated` or `anon` PostgREST context, `current_setting('role', true)` returns that role — not `service_role`. The trigger RAISEs. PL/pgSQL transaction semantics roll back the entire fn body, including the preceding profile UPSERT and organisation INSERT. **In current production, the exploit chain does NOT complete: attacker gets nothing.**
  - Phase 6 confirmed `protect_owner_role` on `org_memberships` is BEFORE UPDATE only (`enforce_owner_role_protection` trigger; event mask = UPDATE; `pg_trigger.tgtype::int & 16`). Owner-role INSERT defence is therefore exclusively `trg_block_owner_insert`. **Single-trigger-deep DiD on a Critical-class bypass.** Architectural brittleness: removing or weakening `block_owner_insert` (e.g., adding role contexts that bypass the check) reopens the exploit instantly.
- **Production-impact framing:**
  - **Currently bounded by** the `trg_block_owner_insert` rollback. Not live-exploitable in current schema.
  - Severity stays CRITICAL per audit rubric on TWO grounds:
    1. **Class consistency.** The fn body matches the `_user_id`-class FAIL pattern shared with F-01-003 `undo_student_import` (CRITICAL) and F-02-005 `record_stripe_payment` (CRITICAL). Class-consistent grading prevents "scored differently because one happens to have a downstream rollback" drift.
    2. **Brittleness.** Single-trigger-deep DiD on critical bypass is not a robust pattern. Future migrations that change role contexts, add `service_role`-bypass paths, or alter trigger ordering would reopen the exploit silently.
- **Anchor fix at fn-body level, not downstream trigger:**
  ```sql
  IF auth.uid() IS NULL THEN
    -- Only the onboarding-setup edge fn (service-role) should call this anon
    IF current_setting('role', true) <> 'service_role' THEN
      RAISE EXCEPTION 'Not authorised';
    END IF;
  ELSIF _user_id != auth.uid() THEN
    RAISE EXCEPTION 'Cannot complete onboarding for another user';
  END IF;
  ```
  Pattern matches `create_invoice_with_items` (Positive Pattern #10, §7).
- **Decision needed:** No (mechanical fix; preserves edge-fn caller).
- **Target sprint:** Phase C — parameter-spoofing-class remediation (with F-01-003, F-02-005).
- **Closure:** (empty)

### F-02-002 — `get_students_for_org` anonymous cross-tenant child-PII exfiltration **(HEADLINE)**

- **Severity:** **Critical**
- **Area:** secdef / data-exfiltration / child-safeguarding
- **Phase surfaced:** 5
- **Evidence:**
  - Function body (Phase 5 `pg_get_functiondef`, `public.get_students_for_org`):
    ```sql
    CREATE OR REPLACE FUNCTION public.get_students_for_org(
      _org_id uuid, _role text DEFAULT NULL, _user_id uuid DEFAULT NULL
    ) RETURNS TABLE(id uuid, first_name text, last_name text, email text,
                    phone text, dob date, notes text, status text,
                    created_at timestamptz, guardian_count bigint)
     LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
    AS $function$
    BEGIN
      IF _role = 'teacher' AND _user_id IS NOT NULL THEN
        -- filtered branch: only assigned students
        RETURN QUERY SELECT s.* ... JOIN student_teacher_assignments sta ...;
      ELSE
        -- UNCONDITIONAL branch: ALL students for the org
        RETURN QUERY SELECT s.id, s.first_name, s.last_name, s.email, s.phone,
                            s.dob, s.notes, s.status::text, s.created_at,
                            guardian_count
                     FROM students s WHERE s.org_id = _org_id AND s.deleted_at IS NULL;
      END IF;
    END;
    $function$
    ```
  - EXECUTE granted to `authenticated` AND `anon` (Phase 5 `has_function_privilege`).
  - No `auth.uid()` reference anywhere in body. No caller-context membership check.
  - FE legitimate call site: [`src/hooks/useStudents.ts:29`](../../src/hooks/useStudents.ts) passes JWT-derived `user.id` + `currentRole` from `OrgContext`. The cast `(supabase.rpc as any)` on line 29 silences the generated-types signature check. The legitimate call is safe; the fn does not enforce caller-context independently.
- **Exploit shape (anonymous):**
  ```http
  POST https://<project>.supabase.co/rest/v1/rpc/get_students_for_org
  apikey: <public_anon_key>
  Authorization: Bearer <public_anon_key>
  Content-Type: application/json

  { "_org_id": "<any-org-uuid>", "_role": null, "_user_id": null }
  ```
  Response: array of all active (non-soft-deleted) students for the supplied org with **first_name, last_name, email, phone, dob, notes (free-text), status, created_at, guardian_count**.

  Org UUIDs are discoverable from marketing surfaces, parent-portal slugs, or — once one is obtained — bulk-enumerated by stepping through them. The public anon key is exposed to every browser via Supabase client init; no signed-in attacker required.

- **Scope of PII:**
  - **Names:** first + last (direct identification of minors).
  - **Contact:** email + phone (often parent's contact when student is a minor; in some studios it is the student's own contact).
  - **Date of birth:** age + birthday — directly identifies minors, age-bracket inference for safeguarding pattern matching.
  - **Notes (free-text):** in music-school convention, lesson notes commonly include SEN information ("autism — needs predictable routine", "ADHD — short tasks"), medical notes ("severe peanut allergy — epipen in case", "hearing aid in right ear, lessons must face student"), or family-context notes ("parents separating, behaviour may regress"). **This is special-category data under GDPR Article 9 (health, ethnic origin where inferable, family-life signals).**
  - **`guardian_count`:** stepping-stone for the `get_student_ids_for_parent` (F-02-009) enumeration chain.
- **Child-safeguarding dimension:**
  - The exposed dataset is a roster of identifiable minors, with contact information for them or their parents, and (commonly) notes indexing SEN / medical / family vulnerabilities.
  - **This is not a "PII leak" framing — it is a child-safeguarding incident at scale.** Adult-only PII leaks do not carry the same regulatory and operational threshold; child datasets do.
- **UK regulatory exposure:**
  - **GDPR Article 33** — breach notification to the supervisory authority (ICO in the UK) within **72 hours** of becoming aware. Special-category data triggers the obligation at a lower threshold; presence of children's data elevates further.
  - **GDPR Article 9** — special-category data (health data inferred from medical notes) is generally prohibited from processing without explicit consent or one of the Article 9(2) bases. A breach of special-category data is reportable under Article 33 unless the controller can demonstrate it is unlikely to result in a risk to natural persons — that bar is not met when minors' health context is involved.
  - **ICO reporting threshold** — guidance indicates that a personal-data breach involving children is at the high-risk end and should be reported to data subjects (Article 34) as well as the supervisory authority.
  - **Under Lauren shadow-term volume** (Phase E target: 12-week shadow with real-studio scale), a single anonymous exploit call against the shadow studio extracts that studio's full pupil roster. **This is a notifiable incident.** Treat the finding doc accordingly: this is THE batch 02 finding, not "another parameter-spoofing FAIL".
- **Defence-in-depth analysis:**
  - **None possible.** SECDEF bypasses `students`-table RLS by definition. Read-class fns leave no row trail; no INSERT/UPDATE trigger ever fires; PL/pgSQL transaction rollback model does not apply (no writes to roll back). The only enforcement point is the fn body itself, which has none.
  - Phase 5 `has_function_privilege` confirms EXECUTE granted to both `authenticated` and `anon` — pre-auth exposure is the operative class.
- **Production-impact framing:** **Live-exploitable in current production by anonymous attackers with the public anon key.** Not bounded by any downstream mechanism.
- **Anchor fix at fn-body level:**
  ```sql
  -- Two-line check, preserves the FE useStudents.ts:29 call pattern unchanged
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT is_org_member(auth.uid(), _org_id) THEN
    RAISE EXCEPTION 'Not a member of this organisation';
  END IF;
  -- For the teacher-branch, ensure _user_id matches caller
  IF _role = 'teacher' AND _user_id IS NOT NULL AND _user_id != auth.uid() THEN
    RAISE EXCEPTION 'Cannot query as another user';
  END IF;
  ```
  Pattern matches `get_parent_lesson_notes` three-layer defence (Positive Pattern #5, §7).
- **Decision needed:** No (mechanical fix). **Phase C priority: highest — this finding is the headline of batch 02.**
- **Target sprint:** Phase C — `S-01-secdef-headline` (recommend dedicated sprint covering this finding + F-02-001 + F-02-005 + F-02-004 as the security-class top tier).
- **Closure:** (empty)

### F-02-003 — `cleanup_withdrawal_credits` anonymous cross-tenant destructive write

- **Severity:** **Critical**
- **Area:** secdef / destructive-write
- **Phase surfaced:** 7C
- **Evidence:**
  - Function body (Phase 7C `pg_get_functiondef`, `public.cleanup_withdrawal_credits`):
    ```sql
    CREATE OR REPLACE FUNCTION public.cleanup_withdrawal_credits(
      _student_id uuid, _org_id uuid, _effective_date date
    ) RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
    AS $function$
    DECLARE _voided_count INTEGER := 0; _waitlist_count INTEGER := 0;
    BEGIN
      -- 1. Void unredeemed credits for lessons AFTER the effective date
      UPDATE make_up_credits
      SET voided_at = NOW(), voided_by = auth.uid()
      WHERE student_id = _student_id AND org_id = _org_id
        AND redeemed_at IS NULL AND expired_at IS NULL AND voided_at IS NULL
        AND issued_for_lesson_id IN (
          SELECT id FROM lessons WHERE start_at >= _effective_date::timestamp);
      GET DIAGNOSTICS _voided_count = ROW_COUNT;

      -- 2. Cancel active waitlist entries
      UPDATE make_up_waitlist
      SET status = 'expired', updated_at = NOW()
      WHERE student_id = _student_id AND org_id = _org_id
        AND status IN ('waiting', 'matched', 'offered');
      GET DIAGNOSTICS _waitlist_count = ROW_COUNT;

      -- 3. Audit log
      INSERT INTO audit_log (org_id, actor_user_id, action, entity_type, entity_id, after)
      VALUES (_org_id, COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'),
        'withdrawal_cleanup', 'student', _student_id, ...);

      RETURN json_build_object(
        'credits_voided', _voided_count,
        'waitlist_entries_cancelled', _waitlist_count);
    END;
    $function$
    ```
  - **No caller-context check.** `auth.uid()` is referenced only as `voided_by` audit field (and falls back to `'00000000-...'` on NULL) — never as an authorisation gate.
  - EXECUTE granted to `authenticated` AND `anon` (Phase 7C `has_function_privilege`).
- **Exploit shape:** Anonymous attacker calls with `(_student_id, _org_id, _effective_date)` triples drawn from any target org. Two destructive cross-tenant effects per call:
  1. **Voids all unredeemed make_up_credits** for the named student in the named org that were issued for lessons after the supplied effective date. Each call permanently sets `voided_at = NOW()`.
  2. **Cancels all active waitlist entries** for that student in that org (status flips from `waiting`/`matched`/`offered` to `expired`).
  3. **Pollutes the audit log** with attacker-controlled rows (synthesises a `withdrawal_cleanup` entry with NULL-effective actor — see also F-02-010 audit-log integrity gap).
- **Defence-in-depth analysis (Phase 7.5C precision):**
  - `make_up_credits` table triggers: `audit_make_up_credits` (AFTER, logging only), `update_make_up_credits_updated_at` (BEFORE UPDATE, no raise). **No protective trigger on UPDATE-of-`voided_at`.**
  - `make_up_waitlist` table triggers: `audit_make_up_waitlist` (AFTER, logging), `set_make_up_waitlist_updated_at` (BEFORE UPDATE, no raise), `trg_notify_makeup_match` (AFTER UPDATE, no raise), `trg_validate_waitlist_credit` (**BEFORE INSERT only** — `pg_trigger.tgtype::int & 4`, no UPDATE firing per Phase 8 §8A precision). The validation trigger does NOT fire on the exploit's UPDATE-status-to-expired path.
  - **No DiD.** Live-exploitable.
- **Production-impact framing:** **Live-exploitable in current production by anonymous attackers.** Each call irreversibly voids credit balances and expires waitlist entries for any chosen student in any chosen org.
- **Anchor fix:**
  ```sql
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT is_org_admin(auth.uid(), _org_id) THEN
    RAISE EXCEPTION 'Not authorised to manage withdrawals for this organisation';
  END IF;
  ```
- **Decision needed:** No.
- **Target sprint:** Phase C — `S-01-secdef-headline` bundle.
- **Closure:** (empty)

### F-02-004 — `record_installment_payment` anonymous cross-tenant installment-as-paid falsification + vestigial parameter

- **Severity:** **Critical**
- **Area:** secdef / financial-falsification
- **Phase surfaced:** 7C (with Phase 7B vestigial-parameter cross-link)
- **Evidence:**
  - Function body (Phase 7C, abbreviated to relevant lines):
    ```sql
    CREATE OR REPLACE FUNCTION public.record_installment_payment(
      p_installment_id uuid, p_amount_minor integer, p_stripe_payment_intent_id text
    ) RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
    AS $function$
    DECLARE _installment RECORD; _invoice RECORD; _net_paid INTEGER; ...
    BEGIN
      SELECT * INTO _installment FROM invoice_installments
        WHERE id = p_installment_id FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Installment not found'; END IF;
      IF _installment.status NOT IN ('pending', 'overdue') THEN
        RAISE EXCEPTION 'Installment is not payable (status: %)', _installment.status; END IF;
      SELECT * INTO _invoice FROM invoices WHERE id = _installment.invoice_id FOR UPDATE;
      ...
      UPDATE invoice_installments SET
        status = 'paid', paid_at = NOW(),
        stripe_payment_intent_id = COALESCE(p_stripe_payment_intent_id, stripe_payment_intent_id)
      WHERE id = p_installment_id;
      SELECT COALESCE(SUM(amount_minor), 0) INTO _net_paid
      FROM payments WHERE invoice_id = _installment.invoice_id;
      ...
      IF _all_paid AND _net_paid >= _invoice.total_minor THEN
        UPDATE invoices SET paid_minor = _net_paid, status = 'paid'
        WHERE id = _installment.invoice_id;
      ELSE
        UPDATE invoices SET paid_minor = _net_paid WHERE id = _installment.invoice_id;
      END IF;
      ...
    END;
    $function$
    ```
  - **No `auth.uid()` reference anywhere in body.** No caller-context check.
  - EXECUTE granted to `authenticated` AND `anon` (Phase 7C metadata).
  - **Vestigial parameter cross-link (Phase 7B):** `p_amount_minor` is declared but never referenced in the body. Body computes `_net_paid` from `SUM(amount_minor)` on the `payments` table — not from the parameter. The signature lies to callers about what is recorded. Phase 7B SQL sweep evidence:
    ```sql
    SELECT proname, args, param_name FROM vestigial WHERE is_vestigial
    -- Returns:
    -- record_installment_payment | p_installment_id uuid, p_amount_minor integer, ... | p_amount_minor
    ```
- **Exploit shape:** Anonymous attacker calls with `p_installment_id` drawn from any victim org's installment ledger. The fn locks the row, marks it `status='paid'` regardless of actual payments. Then `recalculate_invoice_paid`-equivalent logic flips the parent invoice to `'paid'` when `_net_paid >= total_minor`. **Cross-tenant ledger falsification: installment marked PAID without any payment having occurred.**
  Note: there IS an existing payment-amount cross-check (`_net_paid >= total_minor`) — so the invoice-status flip only happens if real payments already cover the total. But the **installment-level flip is unconditional**: a victim's pending installment becomes 'paid' simply by attacker invocation, with `paid_at = NOW()` and a forged `stripe_payment_intent_id` if supplied. This corrupts the per-installment ledger even when invoice-total reconciliation prevents the invoice-status flip.
- **Defence-in-depth analysis (Phase 7.5C):**
  - `invoice_installments` triggers: `audit_invoice_installments` (AFTER, logging), `set_updated_at` (BEFORE UPDATE, no raise), three `trg_bump_invoice_pdf_rev_from_installments_*` (AFTER, no raise). **No protective trigger on installment status flip.**
  - `invoices` triggers: `enforce_invoice_status_transition` (BEFORE UPDATE, RAISEs on illegal transitions like draft→paid), `enforce_subscription_active_invoices` (BEFORE INSERT), `set_invoice_number_trigger` (BEFORE INSERT, no raise), `trg_bump_invoice_pdf_rev`, `trg_prevent_org_id_change`, `update_invoices_updated_at`.
  - **Partial DiD framing (Phase 9 precision B):** `enforce_invoice_status_transition` blocks the draft→paid invoice flip when the inner fn calls `UPDATE invoices SET status = 'paid'` if the source state was 'draft'. **But:** most unpaid invoices in any LessonLoop install live in `'open'` state (after invoice is sent), not `'draft'`. The trigger permits `open → paid`. **The majority of attack surface remains live-exploitable.** Severity HOLDS CRITICAL.
- **Production-impact framing:**
  - **Live-exploitable on the installment ledger** in current production. Anonymous attacker permanently flips victim installments to `'paid'`.
  - **Partial DiD on the invoice-status flip bounded to draft-state invoices.** Open-state invoices (the operative volume in any operational install) flip through unimpeded.
- **UK regulatory framing:**
  - **MTD (Making Tax Digital) / HMRC:** UK tax records require accurate VAT-rated transactions in the invoice ledger. Falsified `status='paid'` rows feed into MTD-quarter submissions and Xero/QuickBooks reconciliation. Recovery requires reconstructing the legitimate ledger from payments-table evidence; the falsified rows are a regulatory-record-integrity event.
  - **Stripe TOS reconciliation:** Stripe requires that recorded payment intents map 1:1 to actual `payment_intent.succeeded` events. The forged `stripe_payment_intent_id` field (supplied directly by the attacker) creates phantom mappings; Stripe-side dispute audits could surface this as transaction reporting fraud.
  - **Child-safeguarding adjacency:** financial records are tied to minors' families (`payer_guardian_id` / `payer_student_id` on the parent invoice). Falsified payment status affects the family's billing relationship and the org's ability to flag legitimate concerns (e.g., unpaid invoices triggering safeguarding-adjacent welfare conversations).
- **Anchor fix:**
  ```sql
  -- Resolve invoice/org first, then gate
  SELECT inv.org_id INTO _org_id FROM invoice_installments inst
    JOIN invoices inv ON inv.id = inst.invoice_id WHERE inst.id = p_installment_id;
  IF NOT is_org_finance_team(auth.uid(), _org_id) THEN
    RAISE EXCEPTION 'Not authorised to record installment payments';
  END IF;
  ```
  Vestigial `p_amount_minor` resolution: either (a) drop the parameter in a follow-up migration after FE-callers are confirmed not to rely on it, OR (b) use it as the asserted-amount input and validate against `SUM(payments)` for the installment, raising on mismatch.
- **Decision needed:** No.
- **Target sprint:** Phase C — financial-falsification 2-fn class (with F-02-005).
- **Closure:** (empty)

### F-02-005 — `record_stripe_payment` anonymous cross-tenant payment falsification (PI-08 elevation HIGH → CRITICAL)

- **Severity:** **Critical** (elevated from PI-08 HIGH)
- **Area:** secdef / financial-falsification
- **Phase surfaced:** 7C (PI-08 body re-audit)
- **PI-08 history reconciliation:**
  - **Original PI-08 framing (s38 pre-investigation):** "record_stripe_payment accepts `_org_id` parameter but never verifies it matches invoice org" — HIGH, batch-06 ownership.
  - **Phase 7C body re-audit revealed:** the `_org_id` mismatch concern is a downstream symptom; the root defect is **no caller-context validation at all** in the fn body. There is no `auth.uid()` reference; the fn trusts every body parameter (`_invoice_id`, `_org_id`, `_amount_minor`, `_provider_reference`, `_installment_id`, `_pay_remaining`) implicitly.
  - **Severity elevated HIGH → CRITICAL** on class consistency with F-02-004 and the broader parameter-spoofing class.
  - **Primary ownership transferred from batch 06 to batch 02.** STATUS.md §5.1 row update text in §10 below.
- **Evidence:**
  - Function body (Phase 7C `pg_get_functiondef`, abbreviated):
    ```sql
    CREATE OR REPLACE FUNCTION public.record_stripe_payment(
      _invoice_id uuid, _org_id uuid, _amount_minor integer,
      _provider_reference text, _installment_id uuid DEFAULT NULL,
      _pay_remaining boolean DEFAULT false
    ) RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
    AS $function$
    DECLARE _invoice record; _existing_payment_id uuid; _payment_id uuid;
            _inst_row record; _recalc_result json;
    BEGIN
      SELECT id, org_id, total_minor, paid_minor, status, due_date
      INTO _invoice FROM invoices WHERE id = _invoice_id FOR UPDATE;
      IF _invoice IS NULL THEN RAISE EXCEPTION 'Invoice not found'; END IF;
      IF _invoice.status = 'void' THEN
        RETURN json_build_object('skipped', true, 'reason', 'Invoice is void', ...);
      END IF;
      SELECT id INTO _existing_payment_id FROM payments
        WHERE provider_reference = _provider_reference;
      IF _existing_payment_id IS NOT NULL THEN
        -- idempotency dedup
        _recalc_result := recalculate_invoice_paid(_invoice_id);
        RETURN ...;
      END IF;
      INSERT INTO payments (invoice_id, org_id, amount_minor, method, provider,
                             provider_reference, paid_at, installment_id)
      VALUES (_invoice_id, _org_id, _amount_minor, 'card', 'stripe',
              _provider_reference, NOW(), _installment_id)
      RETURNING id INTO _payment_id;
      ...
      _recalc_result := recalculate_invoice_paid(_invoice_id);
      RETURN ...;
    END;
    $function$
    ```
  - **No `auth.uid()` reference anywhere.**
  - EXECUTE granted to `authenticated` AND `anon`.
  - The `_org_id` body parameter is propagated to `payments.org_id` directly without cross-check against the actual `_invoice.org_id`. PI-08 caught this; the deeper defect is no caller-context check at all.
- **Exploit shape:** Anonymous attacker calls with `(_invoice_id, _org_id, _amount_minor, _provider_reference, ...)` drawn from any victim org. Fn:
  1. Locks the named invoice row.
  2. Checks idempotency on `provider_reference` (attacker supplies unique value → idempotency miss → INSERT path).
  3. **INSERTs a `payments` row** with attacker-controlled `amount_minor`, `provider_reference`, `installment_id`, and **`org_id` field directly from the body param** (no cross-check). The payment is recorded as `method='card'`, `provider='stripe'`.
  4. Calls `recalculate_invoice_paid(_invoice_id)`, which updates `invoices.paid_minor = SUM(payments.amount_minor) − SUM(refunds.amount_minor)` and flips status to `'paid'` if `_net_paid >= total_minor`.
  - Net effect: **attacker-forged payment recorded in victim's ledger; invoice flipped to paid in victim org without any actual money having moved.** Same class as F-02-004 record_installment_payment.
- **Defence-in-depth analysis (Phase 7.5C — same as F-02-004):**
  - `payments` table triggers: `audit_payments` (AFTER, logging), three `trg_bump_invoice_pdf_rev_from_payments_*` (AFTER, no raise), `trg_prevent_org_id_change` (BEFORE UPDATE — protects after the row is inserted; does not gate the INSERT itself), `update_payments_updated_at` (BEFORE UPDATE, no raise). **No protective trigger on payments INSERT.**
  - `invoices` triggers: same `enforce_invoice_status_transition` (BEFORE UPDATE) — partial DiD bounded to draft-state invoices only (Phase 9 precision B); open-state flips through.
  - **Live-exploitable** on the payments table INSERT path; **partial DiD** on the invoice-status flip restricted to draft-state.
- **UK regulatory framing:** same as F-02-004 — MTD/HMRC + Stripe TOS reconciliation + child-safeguarding adjacency (financial records tied to minors' families).
- **Anchor fix:**
  ```sql
  IF NOT is_org_finance_team(auth.uid(), _org_id) THEN
    RAISE EXCEPTION 'Not authorised to record Stripe payments';
  END IF;
  IF _invoice.org_id != _org_id THEN
    RAISE EXCEPTION 'Invoice does not belong to the supplied organisation';
  END IF;
  ```
  Matches `record_payment_and_update_status` PASS pattern (Positive Pattern usage; see §7 Pattern #4 derive-then-check).
- **Decision needed:** No.
- **Target sprint:** Phase C — financial-falsification 2-fn class (with F-02-004).
- **Closure:** (empty) — **closes PI-08 ledger entry; STATUS.md §5.1 row update text in §10**

---

## 4. High findings

### F-02-006 — `Teachers.processRemoval` multi-step write rollback discipline (5+ writes, no transaction)

- **Severity:** High
- **Area:** page-level / multi-step-write
- **Phase surfaced:** 1
- **Evidence:**
  - [`src/pages/Teachers.tsx:418-515`](../../src/pages/Teachers.tsx) — `processRemoval` orchestrates 5+ sequential writes during teacher removal: reassign lesson `teacher_user_id`, void pending invitations, archive teacher row, log audit entries, fire `reassign_teacher_conversations_to_owner` RPC. Each `.then(...)` chain has no `.catch(...)` or compensating action; partial failure leaves the teacher in a half-removed state (some lessons reassigned, some not; conversations reassigned but teacher row not archived; etc.).
  - Class match to F-01-002 (`AcceptInvite.signUpAndAccept`), F-01-004 (`account-delete` 3-step), F-01-006 (`invite-accept` inner-step partial failure), F-01-030 (`setCurrentOrg` fire-and-forget profile UPDATE). Cross-cutting class pattern listed in §11.
- **Impact:** Half-removed teacher state. Org admin sees inconsistent UI (some lessons still reference the teacher, some do not); audit log shows partial removal trail. Silent failure — no surfacing toast for partial completion. Recovery requires manual SQL or re-running parts of `processRemoval` that may or may not be idempotent.
- **Anchor fix surface:** Wrap the 5-step sequence in a single Edge Function RPC that runs server-side as a PL/pgSQL block (transactional). Class fix shared with F-01-002 / F-01-004 / F-01-006 / F-01-030.
- **Decision needed:** No.
- **Target sprint:** Phase C — multi-step write rollback discipline class (cross-cutting carry §11).
- **Closure:** (empty)

### F-02-007 — `check_rate_limit` cross-user counter spoofing → targeted DoS (GDPR Art 12 dimension)

- **Severity:** High
- **Area:** secdef / availability / regulatory
- **Phase surfaced:** 5
- **Evidence:**
  - Function body (Phase 5 `pg_get_functiondef`, `public.check_rate_limit` — full):
    ```sql
    CREATE OR REPLACE FUNCTION public.check_rate_limit(
      _user_id uuid, _action_type text, _max_requests integer, _window_minutes integer
    ) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
    AS $function$
    DECLARE _window_start timestamptz; _current_count integer;
    BEGIN
      _window_start := date_trunc('minute', now()) -
        (EXTRACT(MINUTE FROM now())::integer % _window_minutes) * INTERVAL '1 minute';
      INSERT INTO public.rate_limits (user_id, action_type, window_start, request_count)
      VALUES (_user_id, _action_type, _window_start, 1)
      ON CONFLICT (user_id, action_type, window_start)
      DO UPDATE SET request_count = rate_limits.request_count + 1
      RETURNING request_count INTO _current_count;
      RETURN _current_count <= _max_requests;
    END;
    $function$
    ```
  - **No caller-context check.** Trusts `_user_id` body parameter; the `ON CONFLICT DO UPDATE` increments the row keyed on attacker-chosen user_id.
  - EXECUTE granted to `authenticated` AND `anon`.
  - Legitimate caller: [`supabase/functions/_shared/rate-limit.ts:106`](../../supabase/functions/_shared/rate-limit.ts) — runs under service-role client; passes JWT-derived user_id from edge fn callers. The fn doesn't differentiate service-role from direct-PostgREST invocation.
- **Exploit shape:** Authenticated (or anonymous) attacker calls `supabase.rpc('check_rate_limit', { _user_id: 'VICTIM_UUID', _action_type: 'send-message', _max_requests: 50, _window_minutes: 60 })` 50× per minute. The counter for `(VICTIM_UUID, 'send-message', <window>)` is exhausted. When the victim's legitimate edge-fn invocation hits `checkRateLimit()`, it returns `false` → fn returns 429.
- **Affected actions (`_shared/rate-limit.ts:10-58`):** 30 action types including `looopassist-chat`, `send-message`, `send-parent-reply`, `send-invite-email`, `batch-invite-guardians`, `billing-run`, `stripe-create-checkout`, `record-payment`, `stripe-process-refund`, `csv-import`, **`gdpr-export`**, **`gdpr-delete`**, `onboarding-setup`, `invite-accept`, `profile-ensure`.
- **GDPR Article 12 dimension:**
  - Article 12(3) requires the controller to act on a data subject's request **"without undue delay and in any event within one month."** The rate limits applied to `gdpr-export` (5/hour) and `gdpr-delete` (5/hour) are part of the controller's anti-abuse posture — they are not legitimate grounds for impeding a real subject-access request.
  - **Attacker-induced counter exhaustion against a victim's `gdpr-export` / `gdpr-delete` endpoints = direct regulatory-rights impedance**, not just feature DoS. A motivated attacker could repeatedly exhaust a target's GDPR endpoint counters in a cron-like loop, blocking that user from exercising their rights for the duration of the rate window. The pattern leaves a clean log trail (rate-limit rows with attacker-injected counts) that is forensically attributable but does not surface alerts.
- **Defence-in-depth analysis:** **None at DB layer.** No protective trigger on `rate_limits` table writes.
- **Production-impact framing:** **Live-exploitable in current production.** Each call permanently bumps another user's counter for the supplied action type.
- **Anchor fix:**
  ```sql
  -- Track 1: REVOKE EXECUTE; legitimate caller is the service-role _shared/rate-limit.ts
  REVOKE EXECUTE ON FUNCTION public.check_rate_limit(uuid, text, integer, integer)
    FROM authenticated, anon;
  ```
  Service-role grant retained; edge fn caller is unaffected. Direct PostgREST `.rpc('check_rate_limit', ...)` calls return 404.
- **Decision needed:** No (Track 1 REVOKE is the simplest clean fix; no FE callers).
- **Target sprint:** Phase C — parameter-spoofing-class remediation Track 1 batch.
- **Closure:** (empty)

### F-02-008 — `_notify_streak_milestone` cross-tenant audit-log injection + parent-notification injection

- **Severity:** High
- **Area:** secdef / cross-tenant-write / child-safeguarding adjacency / forensic-integrity
- **Phase surfaced:** 5
- **Evidence:**
  - Function body (Phase 5 `pg_get_functiondef`, abbreviated):
    ```sql
    CREATE OR REPLACE FUNCTION public._notify_streak_milestone(
      _student_id uuid, _org_id uuid, _new_current integer
    ) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
    AS $function$
    BEGIN
      INSERT INTO public.audit_log (org_id, actor_user_id, action, entity_type, entity_id, after)
      VALUES (_org_id, NULL, 'streak_milestone', 'practice_streaks', _student_id,
              jsonb_build_object('streak', _new_current, 'student_id', _student_id));
      -- ... vault.decrypted_secrets lookup ...
      PERFORM net.http_post(
        url := _supabase_url || '/functions/v1/streak-notification',
        headers := jsonb_build_object(
          'x-cron-secret', _cron_secret,
          'Authorization', 'Bearer ' || COALESCE(_service_key, '')),
        body := jsonb_build_object(
          'student_id', _student_id, 'new_streak', _new_current, 'org_id', _org_id));
      ...
    END;
    $function$
    ```
  - Takes `_student_id` + `_org_id` (not `_user_id`), but **same parameter-spoofing class**: caller-supplied UUIDs drive a privileged cross-tenant write without authorisation check.
  - EXECUTE granted to `authenticated` AND `anon`.
- **Exploit shape (two distinct effects from a single call):**

  **Effect 1 — Cross-tenant audit-log injection.** Anonymous attacker calls with `(_student_id, _org_id, _new_current)` of a victim org. The fn inserts an `audit_log` row with attacker-controlled `org_id`, `entity_id`, and payload, with `actor_user_id = NULL` (literally NULL, not the attacker's auth.uid()). Repeated calls bury legitimate audit trail under chaff. **Forensic-integrity issue distinct from the email channel** — even if the streak-notification side-effect is mitigated, the audit-log poisoning persists.

  **Effect 2 — Cross-tenant parent-notification injection.** The `net.http_post` to `/functions/v1/streak-notification` succeeds: the DB fn pulls the cron secret from `vault.decrypted_secrets` and signs the request with it; the edge fn's `validateCronAuth` check passes. The edge fn (verified at [`supabase/functions/streak-notification/index.ts:97-160`](../../supabase/functions/streak-notification/index.ts)) looks up the real student name from DB, then emails the student's actual guardians via Resend with subject `"🔥 [Student Name] hit a [N]-day streak!"`. **Parents of real students in the victim org receive spurious milestone emails about their child's practice with attacker-chosen streak counts.**
- **Child-safeguarding adjacency:**
  - The email is parent-facing communication about a minor's practice activity, sent from `notifications@lessonloop.net` (legitimate domain). Content is a real student name (looked up by edge fn from DB) + an attacker-controlled streak count.
  - Trust erosion vector: parents associate the message with their lesson-loop relationship. Receiving fake milestone emails (e.g., "30-day streak achieved!" when the child has not practised) creates first-encounter trust damage and confused parent-teacher conversations.
  - Not a direct PII leak, but **the communication channel for parent-of-minor content is being weaponised cross-tenant.**
- **Audit-log integrity dimension (cross-link to F-02-010):**
  - The NULL actor_user_id this fn writes is part of the broader pattern documented in F-02-010 (70.1% of historical audit_log rows have NULL actor). The exploit blends into existing operational noise.
  - The Phase C fix for F-02-010 (BEFORE INSERT trigger requiring `actor_user_id IS NOT NULL OR current_setting('role') = 'service_role'`) would block this exploit at the audit-log INSERT level even if `_notify_streak_milestone` body fix is delayed — defence-in-depth alignment.
- **Defence-in-depth analysis:** **None.** Audit_log has no INSERT-time integrity trigger (see F-02-010). `streak-notification` edge fn validates cron auth, which the DB fn already supplies via vault — bypass complete.
- **Production-impact framing:** **Live-exploitable in current production.** Two simultaneous cross-tenant effects per call.
- **Anchor fix:**
  ```sql
  REVOKE EXECUTE ON FUNCTION public._notify_streak_milestone(uuid, uuid, integer)
    FROM authenticated, anon;
  ```
  The legitimate caller is a DB trigger on the practice-streak flow (runs as postgres role; EXECUTE grant irrelevant for trigger-fired SECDEF chains). No FE caller exists for this fn.
- **Decision needed:** No.
- **Target sprint:** Phase C — parameter-spoofing-class remediation Track 1 batch + child-safeguarding-adjacent priority.
- **Closure:** (empty)

### F-02-009 — `get_student_ids_for_parent` cross-user student-set enumeration (child-safeguarding adjacency; array-amplification)

- **Severity:** High
- **Area:** secdef / enumeration / child-safeguarding adjacency
- **Phase surfaced:** 5
- **Evidence:**
  - Function body (Phase 5 `pg_get_functiondef` — full):
    ```sql
    CREATE OR REPLACE FUNCTION public.get_student_ids_for_parent(_user_id uuid)
     RETURNS uuid[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
    AS $function$
      SELECT COALESCE(array_agg(DISTINCT sg.student_id), '{}')
      FROM public.student_guardians sg
      INNER JOIN public.guardians g ON g.id = sg.guardian_id
      WHERE g.user_id = _user_id
    $function$
    ```
  - **No `auth.uid()` check.** Trusts `_user_id` body parameter.
  - EXECUTE granted to `authenticated` AND `anon`.
- **Exploit shape:** Anonymous attacker calls `supabase.rpc('get_student_ids_for_parent', { _user_id: 'VICTIM_USER_UUID' })`. Returns the full UUID array of students that user is a guardian of, across all orgs.
- **Amplification rationale (HIGH vs MEDIUM bool helper):**
  - **Array-return vs bool-probe:** the equivalent bool-probe (`is_parent_of_student(_user_id, _student_id)`) is MEDIUM-class — one binary edge per call. This fn returns the **full array** of student UUIDs in one call. Single-call amplification: N students returned vs 1 boolean.
  - **Stepping-stone class:** the returned UUIDs feed downstream RPCs (lesson endpoints, invoice endpoints, notes endpoints, parent-portal RPCs) and, in combination with `get_students_for_org` (F-02-002 CRITICAL), enable cross-correlation of student↔parent graph.
  - **Family-structure disclosure:** the response reveals which users are parents at all, how many children each has, and (with cross-referencing against `get_students_for_org` rosters) which students belong to which families across orgs. Child-safeguarding adjacency: parent-child mapping is sensitive context independent of any single field value.
- **Child-safeguarding adjacency framing:**
  - Family structure (who parents whom) is among the categories that safeguarding frameworks treat as sensitive context, even when the underlying field values are individually mundane (UUIDs).
  - The enumeration enables an attacker to construct a directory of "user X parents children [A, B, C]" across multiple orgs — a precursor to targeted phishing or social-engineering against parents of specific identifiable minors.
- **Defence-in-depth analysis:** **None.** SECDEF bypasses RLS on `student_guardians` + `guardians`. Read-class — no trigger fires.
- **Production-impact framing:** **Live-exploitable in current production.**
- **Anchor fix:**
  ```sql
  REVOKE EXECUTE ON FUNCTION public.get_student_ids_for_parent(uuid)
    FROM authenticated, anon;
  ```
  No FE caller (`grep` confirmed); fn is consumed by RLS policies and other SECDEF fns running under postgres ownership. REVOKE has no behaviour impact.
- **Decision needed:** No.
- **Target sprint:** Phase C — parameter-spoofing-class remediation Track 1 batch.
- **Closure:** (empty)

### F-02-010 — `audit_log` table has no INSERT-time integrity trigger; 70.1% historical NULL-actor

- **Severity:** High
- **Area:** forensic-integrity / cross-cutting class root
- **Phase surfaced:** 6
- **Evidence:**
  - `pg_trigger` enumeration query confirmed **zero triggers on `audit_log` or `platform_audit_log` tables** (Phase 6 SQL):
    ```sql
    SELECT t.tgname FROM pg_trigger t
    WHERE t.tgrelid::regclass::text IN ('audit_log', 'platform_audit_log')
      AND NOT t.tgisinternal;
    -- Returns: 0 rows
    ```
  - Row distribution (Phase 6 stats query):
    ```sql
    SELECT CASE WHEN actor_user_id IS NULL THEN 'NULL_actor' ELSE 'has_actor' END,
           count(*) FROM public.audit_log GROUP BY 1;
    -- Returns: NULL_actor=78,474 | has_actor=33,427 (total 111,901; NULL ratio 70.1%)
    ```
  - The 27 `audit_*` triggers (BEFORE-INSERT on entity tables → AFTER-INSERT on `audit_log` via `log_audit_event_singular`) write with `actor_user_id := auth.uid()`. When `auth.uid()` is NULL (cron, service-role context, or attacker-injected SECDEF call), the audit row is written with NULL actor. **No INSERT-time row-validator on `audit_log` itself rejects this.**
- **Exploit chains (cross-link to F-02-008 + Phase 5 helper-class FAILs):**
  - **Attacker-injected NULL-actor rows via `_notify_streak_milestone`** (F-02-008): fn writes directly to `audit_log` with explicit `NULL` actor field. Repeated calls inject arbitrary rows that blend into the 70.1% NULL-actor noise.
  - **Audit-log chaff to mask cross-tenant exfiltration:** an attacker performing F-02-002 `get_students_for_org` data exfiltration (which leaves no audit trail — SECDEF SELECT) can simultaneously call `_notify_streak_milestone` × 1000 to inject `streak_milestone` rows into the victim org's audit log, making forensic review intractable.
- **Defence-in-depth analysis:** **None.** No table-level INSERT trigger. No CHECK constraint requiring `actor_user_id IS NOT NULL`. RLS on `audit_log` blocks unauthorised reads but does not gate writes from SECDEF context.
- **Production-impact framing:**
  - **Live-exploitable forensic-integrity gap.** The 70.1% pre-existing NULL-actor ratio means attacker injection is statistically invisible — there is no "anomaly signal" to fire on.
  - **Cross-link to F-02-008:** the audit-log integrity loss is a forensic-control issue distinct from the email channel; treat both effects in the fix design.
- **Anchor fix (BEFORE INSERT integrity trigger):**
  ```sql
  CREATE OR REPLACE FUNCTION public.enforce_audit_log_actor()
   RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
  AS $function$
  BEGIN
    IF NEW.actor_user_id IS NULL
       AND current_setting('role', true) NOT IN ('service_role', 'postgres') THEN
      RAISE EXCEPTION 'audit_log row must have actor_user_id when written by % role',
        current_setting('role', true);
    END IF;
    RETURN NEW;
  END;
  $function$;

  CREATE TRIGGER enforce_audit_log_actor BEFORE INSERT ON public.audit_log
    FOR EACH ROW EXECUTE FUNCTION enforce_audit_log_actor();
  ```
- **Phase C pre-deployment-sweep deliverable (concrete):** before deploying the trigger, run an audit query enumerating which DB functions currently INSERT into `audit_log` with NULL actor under non-service-role context, so the fix's breaking-callers footprint is known. The 78,474 historical rows are not retroactively affected (trigger is BEFORE INSERT, not BEFORE UPDATE). Suggested query shape:
  ```sql
  -- Phase C deliverable: enumerate fns that INSERT INTO audit_log
  -- without setting actor_user_id (or via COALESCE(auth.uid(), <placeholder>))
  SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.prosecdef = true
    AND pg_get_functiondef(p.oid) ~* 'INSERT\s+INTO\s+(public\.)?audit_log'
    AND pg_get_functiondef(p.oid) ~* 'COALESCE\s*\(\s*auth\.uid\(\)|actor_user_id\s*[,)]'
  ORDER BY p.proname;
  ```
  This produces the list of fns to either (a) elevate to `SET LOCAL role 'service_role'` or (b) update to require non-NULL actor.
- **Decision needed:** No (mechanical trigger creation; pre-deployment sweep query is a Phase C deliverable, not a blocker).
- **Target sprint:** Phase C — audit-log INSERT integrity (cross-cutting batch-19 carry §11).
- **Closure:** (empty)

### F-02-011 — `get_user_id_by_email` anonymous email→UUID enumeration (auth-schema-crossing)

- **Severity:** High
- **Area:** secdef / pre-auth-enumeration / auth-schema-crossing
- **Phase surfaced:** 6
- **Evidence:**
  - Function body (Phase 6 `pg_get_functiondef` — full):
    ```sql
    CREATE OR REPLACE FUNCTION public.get_user_id_by_email(_email text)
     RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
    AS $function$
      SELECT id FROM auth.users WHERE email = _email LIMIT 1
    $function$
    ```
  - **Crosses schema boundary** (`public` → `auth.users`). The `auth` schema is normally locked to service_role; SECDEF on a `public` fn bypasses that boundary.
  - **No `auth.uid()` reference; no caller-context check.**
  - EXECUTE granted to `authenticated` AND `anon` (Phase 6 `has_function_privilege`).
  - Phase 7D auth-schema-crossing sweep (`pg_get_functiondef ~* 'auth\.users|auth\.identities|auth\.sessions|auth\.refresh_tokens|auth\.mfa_'` on all SECDEF public fns) returned **this as the only result**. The auth-schema-crossing class is small but real.
- **Exploit shape:** Anonymous attacker calls `supabase.rpc('get_user_id_by_email', { _email: 'target@example.com' })` with the public anon key. Returns the user UUID (or NULL if not registered).
- **Attack chains:**
  1. **Account-existence enumeration.** Bulk-probe an email list against `auth.users` to confirm which addresses are registered. Standard anti-pattern for auth systems.
  2. **Email-to-UUID resolution for targeted attacks.** Once a UUID is obtained, feed into Phase 5 helper-class fns (`get_user_roles`, `is_org_admin`, `get_user_org_ids`) — see F-02-020 — to map the user's role and org membership. Combined with `get_students_for_org` (F-02-002 CRITICAL), build a complete attacker reconnaissance of any known user.
  3. **Phishing precursor.** Email + UUID + role + org context → highly-targeted social-engineering vector ("Hello [name], we noticed an issue with your owner account at [Org Name]...").
- **Defence-in-depth analysis:** **None.** SECDEF bypasses `auth.users` RLS / role-locking. No body validation.
- **Production-impact framing:** **Live-exploitable in current production by anonymous attackers.**
- **Anchor fix:**
  ```sql
  REVOKE EXECUTE ON FUNCTION public.get_user_id_by_email(text) FROM authenticated, anon;
  ```
  FE-caller absence verified by `grep` in Phase 6 (zero `supabase.rpc('get_user_id_by_email'` references across `src/` and `supabase/functions/`). **Pre-finalisation re-verification grep** confirmed prior to this doc landing (Phase 9 close): still zero callers. Safe to REVOKE without code changes.
- **Decision needed:** No.
- **Target sprint:** Phase C — parameter-spoofing-class remediation Track 1 batch + auth-schema-crossing class cleanup (batch-19 carry §11).
- **Closure:** (empty)

### F-02-012 — `find_waitlist_matches` anonymous cross-tenant waitlist-PII leak (child-safeguarding adjacency)

- **Severity:** High
- **Area:** secdef / data-exfiltration / child-safeguarding adjacency
- **Phase surfaced:** 7C
- **Evidence:**
  - Function body (Phase 7C `pg_get_functiondef`, abbreviated to relevant RETURN signature):
    ```sql
    CREATE OR REPLACE FUNCTION public.find_waitlist_matches(
      _lesson_id uuid, _absent_student_id uuid, _org_id uuid
    ) RETURNS TABLE(
      waitlist_id uuid, student_id uuid, student_name text,
      guardian_name text, guardian_email text,
      missed_lesson_title text, missed_lesson_date date,
      waiting_since timestamp with time zone, match_quality text
    ) LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
    AS $function$
    DECLARE _lesson RECORD; _duration INTEGER; ...
    BEGIN
      SELECT * INTO _lesson FROM lessons WHERE id = _lesson_id AND org_id = _org_id;
      IF NOT FOUND THEN RETURN; END IF;
      ...
      RETURN QUERY
      SELECT w.id, w.student_id,
        (s.first_name || ' ' || s.last_name)::TEXT,
        g.full_name::TEXT, g.email::TEXT,
        w.lesson_title, w.missed_lesson_date, w.created_at,
        CASE ... AS match_quality
      FROM make_up_waitlist w
      JOIN students s ON s.id = w.student_id
      LEFT JOIN guardians g ON g.id = w.guardian_id
      WHERE w.org_id = _org_id AND w.status = 'waiting'
        AND w.student_id != _absent_student_id
        AND ...
      LIMIT 10;
    END;
    $function$
    ```
  - **No `auth.uid()` check.** Trusts `_lesson_id`, `_absent_student_id`, `_org_id` body parameters.
  - EXECUTE granted to `authenticated` AND `anon`.
  - **Returns PII fields:** `student_name` (composed from first_name + last_name) + `guardian_name` + **`guardian_email`** per row. Up to 10 rows per call.
- **Exploit shape:** Anonymous attacker calls with `(_lesson_id, _absent_student_id, _org_id)` from a victim org. The fn returns up to 10 waitlist candidates for that lesson with composed student name + guardian name + guardian email. The lesson_id constraint scopes to lessons in the supplied org_id; the student_id != absent_student_id filter is a trivial pass.
- **Severity disposition (HIGH retention vs CRITICAL escalation):**
  - **Volume-bound rationale (HIGH retained):**
    - Scope is restricted to waitlist-status rows only (`w.status = 'waiting'`) — typical orgs have a small waitlist at any time (single-digit to low-dozens).
    - The query is keyed on a specific `_lesson_id`; attacker must know or enumerate lesson UUIDs (which are themselves not directly exposed via anon-key endpoints).
    - LIMIT 10 caps per-call output.
    - Per-row data is narrower than `get_students_for_org` (no DOB, no medical notes, no phone — just composed names + guardian email).
  - **Class-consistency argument for CRITICAL escalation (considered, not adopted):**
    - Cross-tenant PII (guardian email is contact data for a minor's parent) by anonymous attacker — same class as `get_students_for_org`.
    - Some audit frameworks treat any cross-tenant PII leak as CRITICAL regardless of volume.
  - **Final call: HIGH** — retain on volume-bound rationale. Phase 9 doc documents the rationale auditably visible so the reasoning can be revisited.
  - **Child-safeguarding adjacency captured:** child name + guardian email is parent-of-minor contact data; sufficient for targeted phishing or family-context social engineering. The safeguarding dimension is real even at HIGH; the severity grade reflects bounded volume, not absence of safeguarding concern.
- **Defence-in-depth analysis:** **None.** SECDEF bypasses RLS; read-class.
- **Anchor fix:**
  ```sql
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT is_org_staff(auth.uid(), _org_id) THEN
    RAISE EXCEPTION 'Not authorised to query waitlist matches for this organisation';
  END IF;
  ```
- **Decision needed:** No.
- **Target sprint:** Phase C — parameter-spoofing-class remediation Track 2 (body-level fix; FE-callable retained).
- **Closure:** (empty)

### F-02-013 — `materialise_continuation_lessons` anonymous cross-tenant lesson-spam

- **Severity:** High
- **Area:** secdef / cross-tenant-write
- **Phase surfaced:** 7C
- **Evidence:**
  - Function body (Phase 7C, abbreviated):
    ```sql
    CREATE OR REPLACE FUNCTION public.materialise_continuation_lessons(
      p_org_id uuid, p_recurrence_id uuid, p_student_id uuid,
      p_from_date date, p_to_date date,
      p_rate_minor integer DEFAULT NULL, p_created_by uuid DEFAULT NULL
    ) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
    AS $function$
    DECLARE _rec RECORD; _template RECORD; _max_cap integer := 200; ...
    BEGIN
      SELECT * INTO _rec FROM recurrence_rules
        WHERE id = p_recurrence_id AND org_id = p_org_id;
      ...
      FOR _day IN SELECT unnest(_rec.days_of_week) LOOP
        ...
        WHILE _cursor_date <= p_to_date LOOP
          IF (_existing_count + _created_count) >= _max_cap THEN EXIT; END IF;
          ...
          INSERT INTO lessons (org_id, recurrence_id, start_at, end_at, ...)
          VALUES (p_org_id, p_recurrence_id, _lesson_start, _lesson_end, ...);
          INSERT INTO lesson_participants (org_id, lesson_id, student_id, rate_minor)
          VALUES (p_org_id, _new_lesson_id, p_student_id, p_rate_minor)
          ON CONFLICT (lesson_id, student_id) DO NOTHING;
          ...
        END LOOP;
      END LOOP;
      ...
    END;
    $function$
    ```
  - **No `auth.uid()` reference anywhere.**
  - EXECUTE granted to `authenticated` AND `anon`.
  - Per-call cap: 200 lessons.
- **Exploit shape:** Anonymous attacker calls with `(p_org_id, p_recurrence_id, p_student_id, p_from_date, p_to_date, ...)` of victim org. Fn:
  1. Loads recurrence rule scoped to victim's org_id (legitimate constraint).
  2. Iterates date range and inserts up to 200 lessons in victim org.
  3. Inserts `lesson_participants` rows linking `p_student_id` to created lessons (with `p_rate_minor` from body).
  - Net effect: **victim org's calendar populated with 200 attacker-controlled lessons per call.** Repeated calls unbounded.
- **Defence-in-depth analysis (Phase 7.5C):**
  - `lessons` triggers: `enforce_subscription_active_lessons` (BEFORE INSERT, RAISEs if org subscription not active/trialing), `check_lesson_conflicts` (BEFORE INSERT, RAISEs on teacher/room conflict per PI-11), `audit_lessons` (AFTER, logging), `prevent_invoiced_lesson_delete` (BEFORE DELETE, no effect on INSERT), `trg_cleanup_attendance_on_cancel` (AFTER UPDATE, no INSERT effect), `trg_prevent_org_id_change` (BEFORE UPDATE), `trg_prevent_past_open_slot` (BEFORE INSERT, RAISEs on past-dated open slots).
  - `lesson_participants` triggers: `audit_lesson_participants` (AFTER, logging), `trg_clear_open_slot` (AFTER INSERT, no protective raise), `trg_makeup_participant_removed` (AFTER DELETE).
  - **Partial DiD:**
    - `enforce_subscription_active_lessons` bounds the exploit to victim orgs with active subscription — a meaningful constraint for trial-expired or paused orgs, **but not a meaningful bound for live operational orgs** (any operational LessonLoop install has an active subscription).
    - `check_lesson_conflicts` rejects on teacher/room conflict; the inner exception handler catches and skips conflicting rows. Net: attacker still creates non-conflicting lessons within the cap.
    - `trg_prevent_past_open_slot` only fires on past-dated `is_open_slot = true` lessons. The fn inserts with default open-slot semantics — past dates with non-open-slot may pass.
- **Production-impact framing:** **Live-exploitable in current production against any active-subscription victim org.** 200 lessons/call cap creates attack bounded by call repetition, not per-call.
- **Downstream chain risk:** the created lessons feed into billing-run (delivered-billing mode reads completed lessons), payroll (teacher-pay records), and parent-visible schedule surfaces. Calendar spam translates into financial pressure (recurring-template runs may bill against attacker-created lessons depending on attendance state).
- **Anchor fix:**
  ```sql
  IF NOT is_org_staff(auth.uid(), p_org_id) THEN
    RAISE EXCEPTION 'Not authorised to materialise continuation lessons for this organisation';
  END IF;
  ```
- **Decision needed:** No.
- **Target sprint:** Phase C — parameter-spoofing-class remediation Track 2 (body-level fix).
- **Closure:** (empty)

### F-02-014 — `backfill_guardian_default_pm_set` anonymous cross-tenant guardian payment-preference write

- **Severity:** High
- **Area:** secdef / cross-tenant-write
- **Phase surfaced:** 7.5
- **Evidence:**
  - Function body (Phase 7.5B):
    ```sql
    CREATE OR REPLACE FUNCTION public.backfill_guardian_default_pm_set(
      _guardian_id uuid, _org_id uuid, _payment_method_id text
    ) RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
    AS $function$
    DECLARE _existing record;
    BEGIN
      IF _guardian_id IS NULL OR _org_id IS NULL OR _payment_method_id IS NULL THEN
        RAISE EXCEPTION 'guardian_id, org_id, and payment_method_id are required';
      END IF;
      SELECT id, default_payment_method_id INTO _existing
        FROM public.guardian_payment_preferences
        WHERE guardian_id = _guardian_id AND org_id = _org_id FOR UPDATE;
      IF _existing IS NULL THEN
        INSERT INTO public.guardian_payment_preferences (
          guardian_id, org_id, default_payment_method_id, updated_at
        ) VALUES (_guardian_id, _org_id, _payment_method_id, now());
        RETURN json_build_object('updated', true, 'previous', null, 'action', 'inserted');
      END IF;
      IF _existing.default_payment_method_id IS NULL THEN
        UPDATE public.guardian_payment_preferences
          SET default_payment_method_id = _payment_method_id, updated_at = now()
          WHERE id = _existing.id;
        RETURN json_build_object('updated', true, 'previous', null, 'action', 'updated');
      END IF;
      RETURN json_build_object('updated', false, 'previous', _existing.default_payment_method_id, 'action', 'skipped');
    END;
    $function$
    ```
  - **No `auth.uid()` reference.** No caller-context check.
  - EXECUTE granted to `authenticated` AND `anon`.
- **Exploit shape:** Anonymous attacker calls with `(_guardian_id, _org_id, _payment_method_id)` of victim org. Two outcomes:
  - If no existing preference row: INSERT a row with attacker-supplied `_payment_method_id` (a Stripe `pm_...` identifier or arbitrary string).
  - If existing row has `default_payment_method_id IS NULL`: UPDATE the row, filling in the attacker-supplied value.
  - If existing row has a non-NULL default: SKIP (no overwrite).
- **DiD posture (Phase 9 precision D — explicit framing):**
  - **DiD: NONE.** `guardian_payment_preferences` has only one trigger: `audit_guardian_payment_preferences` (AFTER INSERT/UPDATE/DELETE) — logging only, no protective raise. No CHECK constraint on the table preventing cross-org or arbitrary-string writes.
  - **The INSERT-OR-NULL-FILL idempotency ceiling is a body-mechanic, NOT defence-in-depth.** The body refuses to overwrite an existing non-NULL default; this constrains the worst-case (cannot replace a victim's existing card mapping) but is the natural fn behaviour, not a protective layer. Distinguish explicitly: an attacker can still freely INSERT new rows on guardian/org pairs that have no preference yet, and fill NULLs on partially-configured rows.
- **Production-impact framing:** **Live-exploitable in current production.** The body-mechanic ceiling reduces but does not eliminate the cross-tenant write surface.
- **Downstream effect:** the `default_payment_method_id` is consumed by Stripe-flow downstream (invoice-payment selection, subscription auto-charge). A planted attacker-supplied value could redirect the FE's "default card" rendering and (if downstream consumers don't re-validate against the actual Stripe customer mapping) misdirect a charge attempt. The exact downstream sensitivity is batch-06 scope; the cross-tenant write surface itself is the batch-02 finding.
- **Anchor fix:**
  ```sql
  IF NOT is_org_finance_team(auth.uid(), _org_id) THEN
    RAISE EXCEPTION 'Not authorised to set guardian payment preferences';
  END IF;
  ```
- **Decision needed:** No.
- **Target sprint:** Phase C — parameter-spoofing-class remediation Track 2 (body-level fix).
- **Closure:** (empty)

### F-02-015 — `respond_to_enrolment_offer` anonymous cross-tenant accept/decline (child-safeguarding adjacency)

- **Severity:** High
- **Area:** secdef / cross-tenant-write / child-safeguarding adjacency / sibling-asymmetry
- **Phase surfaced:** 7.5
- **Evidence:**
  - Function body (Phase 7.5B, abbreviated):
    ```sql
    CREATE OR REPLACE FUNCTION public.respond_to_enrolment_offer(
      _entry_id uuid, _org_id uuid, _action text
    ) RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
    AS $function$
    DECLARE _entry RECORD;
    BEGIN
      IF _action NOT IN ('accept', 'decline') THEN RAISE EXCEPTION 'Invalid action'; END IF;
      SELECT * INTO _entry FROM enrolment_waitlist
        WHERE id = _entry_id AND org_id = _org_id FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Waitlist entry not found'; END IF;
      IF _entry.status != 'offered' THEN RAISE EXCEPTION 'Offer no longer available'; END IF;
      IF _entry.offer_expires_at IS NOT NULL AND _entry.offer_expires_at < NOW() THEN
        UPDATE enrolment_waitlist SET status = 'expired', updated_at = NOW() WHERE id = _entry_id;
        RAISE EXCEPTION 'This offer has expired';
      END IF;
      IF _action = 'accept' THEN
        UPDATE enrolment_waitlist SET status = 'accepted', responded_at = NOW(), ...
          WHERE id = _entry_id;
        INSERT INTO enrolment_waitlist_activity (..., created_by) VALUES (..., auth.uid());
        RETURN json_build_object('status', 'accepted', 'id', _entry_id);
      ELSE
        UPDATE enrolment_waitlist SET status = 'declined', responded_at = NOW(), ...
          WHERE id = _entry_id;
        INSERT INTO enrolment_waitlist_activity (..., created_by) VALUES (..., auth.uid());
        RETURN json_build_object('status', 'declined', 'id', _entry_id);
      END IF;
    END;
    $function$
    ```
  - **`auth.uid()` is referenced ONLY as `created_by` log column** — never as an authorisation gate. No caller-context membership / guardian check.
  - EXECUTE granted to `authenticated` AND `anon`.
- **Exploit shape:** Anonymous attacker calls with `(_entry_id, _org_id, _action)` for any victim-org enrolment waitlist entry currently in `'offered'` status. Fn flips status to `'accepted'` or `'declined'` and writes an activity row with NULL `created_by` (auth.uid() is NULL for anon caller).
  - **`accept` path:** attacker accepts the offer on behalf of the legitimate parent → entry moves to `'accepted'` → downstream `convert_waitlist_to_student` flow may be triggered by org admin assuming the parent agreed → creates a student record the parent never agreed to.
  - **`decline` path:** attacker declines a real offer → entry moves to `'declined'` → org admin sees the offer declined → moves to next person on waitlist. Parent never sees the offer; loses the place.
- **Child-safeguarding adjacency:**
  - Enrolment status decisions affect whether a minor enters the studio's pupil pipeline. Anonymous attacker affecting enrolment status of any victim org's waitlist entries is cross-tenant interference with a child-enrolment workflow.
  - Trust impact: parents waiting for an offer that they were never given (because attacker declined it) or finding themselves enrolled in a studio without having agreed (because attacker accepted) is first-encounter trust erosion adjacent to safeguarding sensitivity.
- **Sibling-asymmetry framing:**
  - `respond_to_makeup_offer` (sibling fn for the make-up-credit waitlist; Phase 7C audit) is **CORRECTLY GUARDED**: it resolves the guardian record for `auth.uid()` scoped to the entry's org, then RAISEs if `_entry.guardian_id != _guardian_id`. **Same family, divergent posture.**
  - The contrast is instructive — the make-up-offer-response pattern works because someone wrote the guardian-scoped resolution; the enrolment-offer-response pattern omits it. **Contributing factor sub-pattern** (one of the 5 sub-patterns identified in §8 below): newer parent-portal fns missing the sibling-guard pattern.
- **Defence-in-depth analysis:** **None.** `enrolment_waitlist` table has only `set_enrolment_waitlist_updated_at` (BEFORE UPDATE, no raise). No protective trigger. `enrolment_waitlist_activity` has no triggers at all.
- **Production-impact framing:** **Live-exploitable in current production.**
- **Anchor fix:** apply the `respond_to_makeup_offer` pattern (Positive Pattern #7, §7):
  ```sql
  -- Resolve guardian for current user, scoped to the entry's org
  SELECT g.id INTO _guardian_id FROM guardians g
   WHERE g.user_id = auth.uid() AND g.org_id = _entry.org_id AND g.deleted_at IS NULL
   LIMIT 1;
  IF _guardian_id IS NULL THEN
    RAISE EXCEPTION 'Guardian record not found for this organisation';
  END IF;
  IF _entry.guardian_id IS DISTINCT FROM _guardian_id THEN
    RAISE EXCEPTION 'Waitlist entry does not belong to you';
  END IF;
  ```
- **Decision needed:** No (sibling pattern is the canonical template).
- **Target sprint:** Phase C — parameter-spoofing-class remediation Track 2 (body-level fix; parent-portal subset).
- **Closure:** (empty)

---

## 5. Medium findings

### F-02-016 — `Students.tsx` stale comment "Server-side enforcement pending" misleads about `enforce_student_limit`

- **Severity:** Medium
- **Area:** code-hygiene / misleading-comment
- **Phase surfaced:** 1
- **Evidence:** [`src/pages/Students.tsx:290-297`](../../src/pages/Students.tsx) — comment block reads `// Server-side enforcement pending` and surrounding logic acts as though the student-limit check is FE-only. Phase 1 verified the `enforce_student_limit` trigger **does exist** on the `students` table (BEFORE INSERT/UPDATE, RAISEs on subscription cap breach). Comment is stale by at least one release cycle.
- **Impact:** Future maintainers reading `Students.tsx` infer that the only enforcement is FE-side, which is wrong. May lead to either (a) duplicate FE checks added defensively or (b) the FE check being relaxed under the false belief that server-side will catch it (true in this case, but the inverse reasoning would not be).
- **Anchor fix:** Replace the comment with the actual trigger reference: `// Server-side enforcement via enforce_student_limit trigger on students table`.
- **Decision needed:** No.
- **Target sprint:** Phase C — code-hygiene cleanup batch.
- **Closure:** (empty)

### F-02-017 — `send-invite-email` edge fn fire-and-forget Resend invocation; status-fidelity gap

- **Severity:** Medium
- **Area:** edge-fn / status-fidelity
- **Phase surfaced:** 2
- **Evidence:** [`supabase/functions/send-invite-email/index.ts`](../../supabase/functions/send-invite-email/index.ts) — invite-row insert + Resend email send are sequenced; the Resend error path returns the error to the caller, but the row already exists. Status reporting back to FE doesn't distinguish "invite stored AND email sent" vs "invite stored, email failed".
- **Impact:** Org admin clicks "Invite teacher", sees confirmation, assumes email was sent. If Resend fails (transient API outage, rate limit, recipient bounce), the row is created but no email lands. The recipient sees nothing; admin has no signal to resend.
- **Anchor fix:** Surface the Resend status explicitly in the response payload (e.g., `{ invite_id, email_sent: false, resend_error: <msg> }`) and prompt the admin UI to offer a resend affordance.
- **Decision needed:** No.
- **Target sprint:** Phase C — invite-flow status-fidelity batch.
- **Closure:** (empty)

### F-02-018 — `send-invite-email` edge fn re-callable; duplicate-email risk on retry

- **Severity:** Medium
- **Area:** edge-fn / idempotency
- **Phase surfaced:** 2
- **Evidence:** `send-invite-email` does not check for prior-call state on the invite row before re-sending. Admin clicking "Resend invite" calls the fn again; the recipient gets a second (and third...) copy.
- **Impact:** Recipient confusion + email-reputation cost (multiple sends from `notifications@lessonloop.net` to the same address increases the likelihood Resend flags the org's send pattern as noisy).
- **Anchor fix:** Add a `last_sent_at` field to the invite row and a server-side throttle in the fn body (e.g., refuse to re-send within 60 seconds of the previous attempt).
- **Decision needed:** No.
- **Target sprint:** Phase C — invite-flow batch.
- **Closure:** (empty)

### F-02-019 — `batch-invite-guardians` invite-created-even-if-email-failed; status-fidelity gap

- **Severity:** Medium
- **Area:** edge-fn / status-fidelity
- **Phase surfaced:** 2
- **Evidence:** [`supabase/functions/batch-invite-guardians/index.ts:358-369`](../../supabase/functions/batch-invite-guardians/index.ts) — inline comment: *"Invite was created even if email failed — still counts as sent"*. Per-row `Promise.allSettled` handling (line 400) reports successful row creation but doesn't distinguish row-create-only from row-create+email-sent.
- **Impact:** Same class as F-02-017 — admin sees N invites "sent" when actually only K had emails land. Bulk-invite scope makes this larger blast radius than the single-invite case.
- **Anchor fix:** Same as F-02-017 — surface per-row email status. The `Promise.allSettled` pattern is correctly chosen for resilience, but the result payload must include email-status per row, not just create-status.
- **Decision needed:** No.
- **Target sprint:** Phase C — invite-flow batch (cluster with F-02-017 / F-02-018).
- **Closure:** (empty)

### F-02-020 — Helper-fn information-disclosure class (19 fns) — cross-tenant enumeration via SECDEF helpers

- **Severity:** Medium (class finding spanning 19 fns)
- **Area:** secdef / enumeration
- **Phase surfaced:** 5
- **Evidence:** Phase 5 body audit of the 19-fn helper layer:
  - `get_user_roles(_user_id)` → returns `app_role[]` for any user across all orgs
  - `get_org_role(_user_id, _org_id)` → returns role of any user in any org
  - `get_user_org_ids(_user_id)` → returns array of org UUIDs for any user
  - `get_guardian_ids_for_user(_user_id)` → returns guardian record UUIDs for any user
  - `get_teacher_id_for_user(_user_id, _org_id)` → returns teacher record UUID for any user in any org
  - `can_edit_lesson(_user_id, _lesson_id)` → boolean for any user / any lesson
  - `is_org_admin(_user_id, _org_id)` → boolean role probe
  - `is_org_staff(_user_id, _org_id)` → boolean
  - `is_org_member(_user_id, _org_id)` → boolean
  - `is_org_finance_team(_user_id, _org_id)` → boolean
  - `is_org_parent(_user_id, _org_id)` → boolean
  - `is_org_scheduler(_user_id, _org_id)` → boolean
  - `has_role(_user_id, _role)` → boolean (global)
  - `has_org_role(_user_id, _org_id, _role)` → boolean
  - `is_assigned_teacher(_user_id, _org_id, _student_id)` → boolean
  - `is_invoice_payer(_user_id, _invoice_id)` → boolean
  - `is_lesson_teacher(_user_id, _lesson_id)` → boolean
  - `is_parent_of_student(_user_id, _student_id)` → boolean
  - `teacher_has_thread_access(_teacher_user_id, _thread_id, _org_id)` → boolean

  All 19 share: SECDEF, EXECUTE granted to `authenticated` + `anon`, no `auth.uid()` self-check, accept body-supplied identity-shape UUIDs.
- **Class exploit pattern:** anonymous attacker (or authenticated) calls each fn with arbitrary identity-shape + contextual UUIDs. Each call returns a single boolean (or UUID/UUID-array for the read-class members). No per-call PII leak; aggregate exploit value:
  - **Role enumeration:** map every user's role in every org (`is_org_admin`, `has_org_role`, `get_org_role`, `get_user_roles`).
  - **Org-graph reconnaissance:** list user→orgs membership (`get_user_org_ids`, `is_org_member`).
  - **Identity-edge probing:** confirm/deny specific relationship edges (`is_assigned_teacher`, `is_parent_of_student`, `is_lesson_teacher`, `is_invoice_payer`, `teacher_has_thread_access`, `can_edit_lesson`).
  - **Chains into the Criticals + Highs:** combined with F-02-002 `get_students_for_org` and F-02-009 `get_student_ids_for_parent`, the helper layer fully maps the multi-tenant graph (student↔parent↔teacher↔org).
- **Defence-in-depth analysis:** **None.** SECDEF bypasses RLS; bool/UUID responses leak no per-field data. Enumeration is unrestricted and unrate-limited (`check_rate_limit` is itself spoofable — F-02-007).
- **Production-impact framing:** **Live-exploitable in current production.** Class-finding rather than 19 individual MEDIUM findings because (a) shared root cause, (b) shared fix pattern, (c) graded as a class on aggregate exploit value rather than per-call.
- **Anchor fix — Track 1 / Track 2 split (§5.6 of Phase 5 EXIT report):**

  **Track 1 (one-shot, low-risk): REVOKE EXECUTE for 16 helper fns not called from FE.** Single migration; no FE code changes; no breaking change to RLS policies (postgres-owned, EXECUTE-grant-independent).
  ```sql
  REVOKE EXECUTE ON FUNCTION public.is_org_admin(uuid, uuid)         FROM authenticated, anon;
  REVOKE EXECUTE ON FUNCTION public.is_org_staff(uuid, uuid)         FROM authenticated, anon;
  REVOKE EXECUTE ON FUNCTION public.is_org_member(uuid, uuid)        FROM authenticated, anon;
  REVOKE EXECUTE ON FUNCTION public.is_org_finance_team(uuid, uuid)  FROM authenticated, anon;
  REVOKE EXECUTE ON FUNCTION public.is_org_parent(uuid, uuid)        FROM authenticated, anon;
  REVOKE EXECUTE ON FUNCTION public.is_org_scheduler(uuid, uuid)     FROM authenticated, anon;
  REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role)         FROM authenticated, anon;
  REVOKE EXECUTE ON FUNCTION public.has_org_role(uuid, uuid, app_role) FROM authenticated, anon;
  REVOKE EXECUTE ON FUNCTION public.is_assigned_teacher(uuid, uuid, uuid) FROM authenticated, anon;
  REVOKE EXECUTE ON FUNCTION public.is_invoice_payer(uuid, uuid)     FROM authenticated, anon;
  REVOKE EXECUTE ON FUNCTION public.is_lesson_teacher(uuid, uuid)    FROM authenticated, anon;
  REVOKE EXECUTE ON FUNCTION public.is_parent_of_student(uuid, uuid) FROM authenticated, anon;
  REVOKE EXECUTE ON FUNCTION public.can_edit_lesson(uuid, uuid)      FROM authenticated, anon;
  REVOKE EXECUTE ON FUNCTION public.get_org_role(uuid, uuid)         FROM authenticated, anon;
  REVOKE EXECUTE ON FUNCTION public.get_user_org_ids(uuid)           FROM authenticated, anon;
  REVOKE EXECUTE ON FUNCTION public.get_guardian_ids_for_user(uuid)  FROM authenticated, anon;
  REVOKE EXECUTE ON FUNCTION public.teacher_has_thread_access(uuid, uuid, uuid) FROM authenticated, anon;
  ```
  17 REVOKEs total (the list expands by 1 if `get_student_ids_for_parent` from F-02-009 is folded into the same Phase C batch — typically yes).

  **Track 2 (per-fn, FE-coordinated): body-level `auth.uid()` self-check for the 3 FE-consumed helpers.** Either add `IF _user_id != auth.uid() THEN RAISE` (matching `get_parent_dashboard_data` Positive Pattern #1, §7) OR migrate FE to direct RLS-protected SELECT.
  - `get_user_roles` ([`AuthContext.tsx:90`](../../src/contexts/AuthContext.tsx)) — currently called with `userId` (JWT-derived). Add body self-check.
  - `get_teacher_id_for_user` ([`NotesExplorer.tsx:40`](../../src/pages/NotesExplorer.tsx)) — same.
  - `get_students_for_org` (F-02-002 — already addressed at body-level per CRITICAL section).
- **Phase C sprint scope anchor:** see Phase 5 EXIT §5.6. Track 1 is a single migration commit; Track 2 is per-fn body fix + FE-regression test.
- **Decision needed:** No.
- **Target sprint:** Phase C — `S-?-secdef-parameter-spoofing-class-remediation` (Track 1) + parent-portal subset (Track 2).
- **Closure:** (empty)

### F-02-021 — `count_lessons_on_dates` anonymous cross-tenant calendar-aggregate enumeration

- **Severity:** Medium
- **Area:** secdef / enumeration
- **Phase surfaced:** 7C
- **Evidence:**
  - Function body (Phase 7C — full):
    ```sql
    CREATE OR REPLACE FUNCTION public.count_lessons_on_dates(_org_id uuid, _dates date[])
     RETURNS TABLE(lesson_date date, lesson_count bigint)
     LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
    AS $function$
      SELECT
        (start_at AT TIME ZONE COALESCE((SELECT timezone FROM organisations WHERE id = _org_id), 'Europe/London'))::date AS lesson_date,
        count(*) AS lesson_count
      FROM lessons WHERE org_id = _org_id AND status != 'cancelled'
        AND (start_at AT TIME ZONE COALESCE(..., 'Europe/London'))::date = ANY(_dates)
      GROUP BY lesson_date;
    $function$
    ```
  - **No caller-context check.** EXECUTE granted to `authenticated` + `anon`.
- **Exploit:** Anonymous attacker enumerates lesson volume per date for any org. Discloses studio activity patterns (busy days, quiet weeks, end-of-term ramps). No per-row PII, just aggregate counts.
- **Severity rationale:** scalar counts only; no identifying data; aggregate-only enumeration. Medium-class per rubric.
- **Anchor fix:** REVOKE EXECUTE from authenticated, anon. Used by FE at `useClosureDateSettings.ts:138` (TS-cast — F-02-033); needs body-level check OR FE migration to direct RLS-protected SELECT.
- **Decision needed:** No.
- **Target sprint:** Phase C — Track 2 body-fix.
- **Closure:** (empty)

### F-02-022 — `generate_invoice_number` anonymous cross-tenant invoice-counter pollution

- **Severity:** Medium
- **Area:** secdef / ledger-pollution
- **Phase surfaced:** 7.5
- **Evidence:** Phase 7.5B body audit:
  ```sql
  CREATE OR REPLACE FUNCTION public.generate_invoice_number(_org_id uuid)
   RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
  AS $function$
  ... INSERT INTO invoice_number_sequences (org_id, current_year, current_number)
        VALUES (_org_id, _year, 0) ON CONFLICT (org_id) DO NOTHING;
      UPDATE invoice_number_sequences
        SET current_number = CASE WHEN current_year = _year THEN current_number + 1 ELSE 1 END,
            current_year = _year
        WHERE org_id = _org_id
        RETURNING current_number INTO _current_number;
      RETURN _prefix || '-' || _year || '-' || LPAD(_current_number::text, _digits, '0');
  END; $function$
  ```
  No `auth.uid()` reference. EXECUTE granted to `authenticated` + `anon`.
- **Exploit:** Anonymous attacker calls 4,500× → victim's `current_number` jumps from 500 to 5,000. Next legitimate invoice numbered `LL-2026-5001` instead of `LL-2026-501`. Numbering integrity / Xero / QuickBooks reconciliation gaps.
- **DiD analysis:** **None** — no triggers on `invoice_number_sequences`.
- **Anchor fix:** REVOKE EXECUTE from authenticated/anon — the fn is called server-side by invoice-creation flow (via `set_invoice_number_trigger` BEFORE INSERT on `invoices`, which runs under postgres ownership regardless of grant).
- **Decision needed:** No.
- **Target sprint:** Phase C — Track 1.
- **Closure:** (empty)

### F-02-023 — `recalculate_installment_status` anonymous cross-tenant state-recompute write

- **Severity:** Medium
- **Area:** secdef / state-recompute-write
- **Phase surfaced:** 7.5
- **Evidence:** Phase 7.5B body audit:
  ```sql
  CREATE OR REPLACE FUNCTION public.recalculate_installment_status(_installment_id uuid)
   RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
  AS $function$
  DECLARE _inst RECORD; _applied INTEGER; _new_status TEXT;
  BEGIN
    SELECT ... INTO _inst FROM invoice_installments WHERE id = _installment_id FOR UPDATE;
    SELECT COALESCE(SUM(p.amount_minor), 0) ... INTO _applied FROM payments p ...;
    IF _applied <= 0 THEN ...; ELSIF _applied < _inst.amount_minor THEN ...; ELSE UPDATE invoice_installments SET status = 'paid', paid_at = ... WHERE id = _installment_id; END IF;
  END; $function$
  ```
  No `auth.uid()` reference. EXECUTE granted to `authenticated` + `anon`.
- **Exploit:** Anonymous attacker calls with any victim installment_id → fn recomputes status from existing payment/refund rows (truth-based, not attacker-influenced) and writes the result. **Mitigated by recompute-only semantics** — fn doesn't invent state, just reflects truth from `payments` + `refunds`. The only meaningful exploit is forcing a recompute at an unexpected time (e.g., between payment INSERT and webhook completion) to flip status into a transient state.
- **Severity rationale:** state-recompute write with truth-based output. Medium because no fabrication possible; downgraded from initial High consideration.
- **Anchor fix:** REVOKE EXECUTE — no FE caller; consumed by `record_installment_payment`, `record_stripe_payment`, `record_payment_and_update_status` server-side (which themselves run under postgres).
- **Decision needed:** No.
- **Target sprint:** Phase C — Track 1.
- **Closure:** (empty)

---

## 6. Low findings

### F-02-024 — `Locations.handleSetPrimary` stale primary-location handling on race

- **Severity:** Low
- **Area:** page-level / race-condition
- **Phase surfaced:** 1
- **Evidence:** [`src/pages/Locations.tsx`](../../src/pages/Locations.tsx) `handleSetPrimary` — invokes `set_primary_location` RPC (Phase 6 verified CLEAN at auth body) then refetches the locations list. Race-condition window between RPC success and refetch: a concurrent admin's change is visible only after refetch. UX-bound, not security-bound.
- **Anchor fix:** Optimistic update + invalidation in TanStack Query mutation; cluster with F-01-015 cache-invalidation pattern.
- **Target sprint:** Phase C — cache-discipline batch (with F-02-027 / F-02-028).

### F-02-025 — `Teachers.handleSelfAdd` no idempotency check

- **Severity:** Low
- **Area:** page-level / idempotency
- **Phase surfaced:** 1
- **Evidence:** [`src/pages/Teachers.tsx:252-260`](../../src/pages/Teachers.tsx) `handleSelfAdd` — owner admin clicking "Add me as a teacher" runs the insert without first checking whether a teacher row for the current user already exists in the org. Re-clicking creates a UI error toast but the underlying state is fine.
- **Anchor fix:** Existing-row check before INSERT; reuse the idempotent-INSERT pattern from `Onboarding.tsx:52-74` (positive pattern; not in §7 catalogue because page-level, not SECDEF).
- **Target sprint:** Phase C — page-level idempotency batch.

### F-02-026 — `Locations.confirmDeleteLocation` cascade-documentation gap on multi-step write

- **Severity:** Low
- **Area:** page-level / docs-hygiene
- **Phase surfaced:** 1
- **Evidence:** [`src/pages/Locations.tsx:444-495`](../../src/pages/Locations.tsx) `confirmDeleteLocation` — 4+ writes (unassign lessons from location, archive location, set new primary if archiving primary, audit log) with no comment block documenting the cascade order or what happens on partial failure. The actual sequence is safe (each step is idempotent on retry) but a future maintainer reading the code has no map.
- **Anchor fix:** Add a comment block at the top of `confirmDeleteLocation` describing the cascade order + partial-failure recovery.
- **Target sprint:** Phase C — code-hygiene batch.

### F-02-027 — `useCan` unimplemented; 188 consumer sites (+33 vs V2 plan baseline)

- **Severity:** Low
- **Area:** architectural drift
- **Phase surfaced:** 3
- **Evidence:** Phase 3 grep enumeration found 188 sites consuming `useCan` (or its inline-permission-check equivalents) across `src/`. V2 plan `LESSONLOOP_V2_PLAN.md` §5 PR1 baseline noted 155 sites at plan-time. Drift: +33 sites since plan-time. The `useCan` hook itself is documented as "to be implemented" in V2 plan §5 PR1; current implementation is direct role-string checks at each call site.
- **Impact:** Drift continues to accelerate as new features land. Each new site is a future migration cost when `useCan` is eventually implemented.
- **Anchor fix:** Implement `useCan` per V2 plan §5 PR1 + CI lint rule rejecting direct `currentRole === 'owner'` style checks outside `useCan` hook body.
- **Target sprint:** Phase C — V2 plan §5 PR1 implementation sprint.

### F-02-028 — `OrgContext` cross-tab persistence drift on org switch

- **Severity:** Low
- **Area:** architectural / state-management
- **Phase surfaced:** 3
- **Evidence:** [`src/contexts/OrgContext.tsx:274-288`](../../src/contexts/OrgContext.tsx) `setCurrentOrg` — fire-and-forget profile UPDATE with no error handling, no queryClient.invalidateQueries. Cross-tab drift: tab A switches org → tab B continues showing tab-A-previous org until manual refresh. Same root cause as F-01-015 + F-01-030 (batch 01).
- **Anchor fix:** Add `queryClient.invalidateQueries({ predicate: q => q.queryKey[1] === currentOrg?.id })` after the profile UPDATE; subscribe to localStorage events for cross-tab sync.
- **Target sprint:** Phase C — cache-discipline batch (cluster with F-01-015 + F-01-030 + F-02-024).

### F-02-029 — `17e3ff72-...` orphan-org E2E fixture artefact (no current-user owner edge)

- **Severity:** Low
- **Area:** data-state / E2E-fixture
- **Phase surfaced:** 4
- **Evidence:** Phase 4 audit_log + memberships investigation confirmed `17e3ff72-be2a-4f96-b69d-3b3c89a39c8c` is an E2E test fixture org with no current-user owner. The org was created by an old E2E test that hard-deleted its owner without cascading. No production-user impact; the org is unreachable via any FE surface (orphan).
- **Anchor fix:** Either (a) Phase C cleanup script deletes the orphan, or (b) E2E fixture-seeding script is updated to clean up its own orgs on teardown. Recommend (b) + (a) bundled.
- **Target sprint:** Phase C — E2E fixture hygiene (cross-cutting carry §11).

### F-02-030 — `25b57950-...` multi-owner state E2E fixture artefact

- **Severity:** Low
- **Area:** data-state / E2E-fixture
- **Phase surfaced:** 4
- **Evidence:** Phase 4 confirmed `25b57950-2c95-4f3b-bd0f-9c1a3c4ab7c8` is an E2E test fixture org with 2 active owner-role memberships. The `trg_block_owner_insert` trigger prevents this in production; the row was created via service-role bypass in test fixture seeding. No production-user impact.
- **Anchor fix:** E2E fixture cleanup (same path as F-02-029).
- **Target sprint:** Phase C — E2E fixture hygiene.

### F-02-031 — `user_has_continuation_response_in_run` niche cross-user enumeration

- **Severity:** Low
- **Area:** secdef / enumeration
- **Phase surfaced:** 5
- **Evidence:** Function body (Phase 5 — full):
  ```sql
  CREATE OR REPLACE FUNCTION public.user_has_continuation_response_in_run(
    _user_id uuid, _run_id uuid
  ) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
  AS $function$
    SELECT EXISTS (SELECT 1 FROM public.term_continuation_responses tcr
                   JOIN public.guardians g ON g.id = tcr.guardian_id
                   WHERE tcr.run_id = _run_id AND g.user_id = _user_id);
  $function$
  ```
  No `auth.uid()` check. EXECUTE granted to `authenticated` + `anon`.
- **Exploit:** Probes whether a given user responded to a given term-continuation run. Niche dataset (term-continuation runs are infrequent — once per term, batch 09 scope). Boolean return.
- **Anchor fix:** REVOKE EXECUTE from `authenticated`, `anon`. No FE caller; consumed by RLS policies.
- **Target sprint:** Phase C — Track 1.

### F-02-032 — `get_lesson_notes_for_staff` vestigial `p_user_id` + `p_role` parameters (auth layer correct)

- **Severity:** Low
- **Area:** code-hygiene / signature-mismatch
- **Phase surfaced:** 5
- **Evidence:** Phase 5 body audit + Phase 7B vestigial-parameter sweep SQL:
  ```sql
  SELECT proname, args, param_name FROM vestigial WHERE is_vestigial AND proname = 'get_lesson_notes_for_staff';
  -- Returns:
  -- get_lesson_notes_for_staff | p_org_id uuid, p_user_id uuid, p_role text, p_filters jsonb | p_role
  -- get_lesson_notes_for_staff | p_org_id uuid, p_user_id uuid, p_role text, p_filters jsonb | p_user_id
  ```
  Body uses `auth.uid()` for membership lookup, derives `v_role` from DB membership, **ignores** the body-supplied `p_user_id` and `p_role` parameters. Auth layer is **CORRECT** (Positive Pattern #3, §7) — fn does not trust caller-supplied identity. The vestigial parameters are a signature-misleading code-hygiene issue.
- **Impact:** Auditors and future callers may assume `p_user_id` / `p_role` are trusted-as-passed (consistent with the broken pattern elsewhere — F-02-001 / F-01-003 / etc.). Misleading signature on an otherwise-correct fn.
- **Anchor fix:** Drop the vestigial parameters in a follow-up migration, OR add a no-op assertion documenting that they are intentionally vestigial. The simpler path is parameter removal — `grep` for callers confirmed FE passes them but ignores the response side effects.
- **Cross-cutting class:** vestigial-parameter audit on SECDEF fns is a batch-19 carry; this is the first instance found.
- **Target sprint:** Phase C — code-hygiene batch.

### F-02-033 — TS-bypass-cast prevalence class (30 sites across 21 FE files)

- **Severity:** Low (class)
- **Area:** FE / type-coverage drift
- **Phase surfaced:** 7A
- **Evidence:** Phase 7A grep sweep across `src/` and `supabase/functions/` for `(supabase.rpc as any)` + `'<name>' as any` + `rpc<any>` patterns returned **30 sites across 21 files**. Notable:
  - 2 sites cross-link to Critical findings: `useStudents.ts:29` (`get_students_for_org` → F-02-002), `useStudentsImport.ts:362` (`undo_student_import` → F-01-003).
  - 28 remaining sites cast against SECDEF fns confirmed CLEAN at body in Phases 6 / 7C / 7.5 — pure hygiene drift.
  - Inline comment at `useRecurringTemplateRuns.ts:150` reads: *"but we cast here for defensive parity with other RPC hooks"* — confirms cast is hygienic copy-paste, not signature-divergence-silencing.
- **Class root cause:** generated-types pipeline drift. `supabase gen types typescript` does not cover all `public.rpc.*` entries cleanly; FE authors add `as any` casts to avoid TS errors. Most casts are not silencing real signature issues; they are silencing absence of types.
- **Class subsumption:** Phase 1's 2-site TS-cast cluster (initially Medium-graded) is **geometrically subsumed** by this 30-site class. The Phase 1 entry is dropped in favour of this canonical class record.
- **Anchor fix:**
  - **Short term:** regenerate types via `supabase gen types typescript`; remove the casts file-by-file as types catch up.
  - **Long term:** CI lint rule prohibiting `as any` adjacent to `.rpc(` calls — cross-cutting carry §11.
- **Target sprint:** Phase C — code-hygiene batch + CI gate.

### F-02-034 — `is_org_active` + `is_org_write_allowed` class — cross-tenant subscription-state boolean probing

- **Severity:** Low (class, 2 fns)
- **Area:** secdef / enumeration
- **Phase surfaced:** 7C
- **Evidence:** Function bodies (Phase 7C — full):
  ```sql
  CREATE OR REPLACE FUNCTION public.is_org_active(_org_id uuid)
   RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
  AS $function$
    SELECT CASE
      WHEN subscription_status = 'active' THEN true
      WHEN subscription_status = 'trialing' AND trial_ends_at > NOW() THEN true
      ELSE false
    END FROM organisations WHERE id = _org_id;
  $function$

  CREATE OR REPLACE FUNCTION public.is_org_write_allowed(_org_id uuid)
   RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
  AS $function$
    SELECT EXISTS (SELECT 1 FROM public.organisations
      WHERE id = _org_id AND (subscription_status IN ('active', 'trialing')
        OR (subscription_status = 'past_due' AND past_due_since IS NOT NULL
            AND past_due_since > NOW() - INTERVAL '7 days')));
  $function$
  ```
  Both have no caller-context check; EXECUTE granted to `authenticated` + `anon`.
- **Exploit:** anonymous probe of any org's subscription state. Returns boolean. No PII; org subscription state is not particularly sensitive (in many markets it's directly observable via marketing surfaces — "live customer" tier signals).
- **Severity rationale:** lowest amplification class — pure boolean enumeration of non-PII state.
- **Anchor fix:** REVOKE EXECUTE from `authenticated`, `anon`. Both fns are called by other server-side flows (`create_invoice_with_items` calls `is_org_active`; the `is_org_write_allowed` flag drives various server-side guards) which run under postgres ownership.
- **Target sprint:** Phase C — Track 1.

### F-02-035 — `continuation_run_org_id` anonymous cross-tenant run→org_id mapping probe

- **Severity:** Low
- **Area:** secdef / enumeration
- **Phase surfaced:** 7.5
- **Evidence:** Function body (Phase 7.5B):
  ```sql
  CREATE OR REPLACE FUNCTION public.continuation_run_org_id(_run_id uuid)
   RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
  AS $function$
    SELECT org_id FROM public.term_continuation_runs WHERE id = _run_id;
  $function$
  ```
  No `auth.uid()` check. EXECUTE granted to `authenticated` + `anon`.
- **Exploit:** maps run_id → org_id. Low-value enumeration (term-continuation run UUIDs are not casually exposed); useful only when chained with run-specific endpoints.
- **Anchor fix:** REVOKE EXECUTE; fn is consumed by RLS policies on `term_continuation_*` tables.
- **Target sprint:** Phase C — Track 1.

### F-02-036 — `get_unmarked_lesson_count` anonymous cross-tenant workflow-state aggregate enumeration

- **Severity:** Low
- **Area:** secdef / enumeration
- **Phase surfaced:** 7.5
- **Evidence:** Function body (Phase 7.5B):
  ```sql
  CREATE OR REPLACE FUNCTION public.get_unmarked_lesson_count(_org_id uuid, _teacher_id uuid DEFAULT NULL)
   RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
  AS $function$
    SELECT COUNT(DISTINCT l.id)::integer
    FROM lessons l JOIN lesson_participants lp ON lp.lesson_id = l.id
    LEFT JOIN attendance_records ar ON ar.lesson_id = l.id AND ar.student_id = lp.student_id
    WHERE l.org_id = _org_id AND l.status = 'scheduled' AND l.end_at < NOW()
      AND l.end_at > NOW() - INTERVAL '30 days' AND ar.id IS NULL
      AND (_teacher_id IS NULL OR l.teacher_id = _teacher_id);
  $function$
  ```
  No `auth.uid()` check. EXECUTE granted to `authenticated` + `anon`.
- **Exploit:** anonymous probe of "how many unmarked-attendance lessons does org X teacher Y have in the last 30 days?". Workflow-state signal; no PII.
- **Anchor fix:** REVOKE EXECUTE from `authenticated`, `anon`. Consumed server-side by teacher-dashboard read paths (which run under JWT-authenticated context that the RPC currently relies on, so a minor FE adjustment may be needed — verify before Track 1 lands).
- **Target sprint:** Phase C — Track 1 (with FE verification).

---

## 7. Positive-pattern catalogue (13 patterns)

The audit surfaced 13 distinct architectural patterns for SECDEF authorisation. Each has a body excerpt, class applicability, and instances where the pattern appears in production. Patterns are listed for use as fix templates and for batch-19 cross-cutting documentation.

### Pattern #1 — `_user_id != auth.uid()` body-level self-check

**Class applicability:** FE-consumed SECDEF fns that take a `_user_id` parameter and must verify the caller IS that user.

**Body excerpt** (`get_parent_dashboard_data`):
```sql
DECLARE _guardian_id UUID; _student_ids UUID[]; _result JSON;
BEGIN
  -- CRITICAL: Verify the caller is requesting their own data
  IF _user_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized: user_id mismatch';
  END IF;
  ...
```

**Reference instance:** `get_parent_dashboard_data` — sole SECDEF fn in `public` schema with this exact check.

**Use case:** parent-portal dashboard data fetch where the FE legitimately passes the user's own JWT-derived UUID. 2-line check, zero performance cost.

### Pattern #2 — EXECUTE-revocation + `auth.role() = 'service_role'` gate + content guard

**Class applicability:** service-role-only fns that must never be callable by `authenticated` or `anon`.

**Body excerpt** (`_e2e_set_user_email_confirmed`):
```sql
DECLARE v_email text; v_result jsonb;
BEGIN
  -- Only callable by service role
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Forbidden: _e2e_set_user_email_confirmed is service-role only';
  END IF;
  -- Safety guard: only affect test users
  SELECT email INTO v_email FROM auth.users WHERE id = _user_id;
  IF v_email IS NULL THEN RAISE EXCEPTION 'User % not found', _user_id; END IF;
  IF v_email NOT LIKE 'e2e-%@test.lessonloop.net' AND v_email NOT LIKE '%@test.lessonloop.net' THEN
    RAISE EXCEPTION 'Email % does not match e2e test pattern; refusing to modify', v_email;
  END IF;
  ...
```
Plus REVOKE EXECUTE from `authenticated` and `anon` (Phase 5 verified: `has_function_privilege` returns false for both).

**Reference instance:** `_e2e_set_user_email_confirmed` — three-layer defence (EXECUTE revoke + role check + content pattern guard).

**Use case:** test-only or service-role-only helpers that have powerful effects (e.g., manipulating auth.users). The triple guard ensures (a) accidental EXECUTE grant doesn't expose the fn, (b) caller-role check catches direct invocation, (c) content guard prevents misuse even from service-role.

### Pattern #3 — Membership-derived role lookup (`auth.uid()` → DB → role; body params ignored)

**Class applicability:** staff-role SECDEF fns where role-based filtering decisions need DB-authoritative role rather than caller-asserted role.

**Body excerpt** (`get_lesson_notes_for_staff`):
```sql
DECLARE v_teacher_id UUID; v_role TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT m.role INTO v_role FROM org_memberships m
    WHERE m.user_id = auth.uid() AND m.org_id = p_org_id AND m.status = 'active';
  IF v_role IS NULL THEN RAISE EXCEPTION 'Not a member of this organisation'; END IF;
  IF v_role NOT IN ('owner', 'admin', 'teacher') THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;
  ...
  -- Body uses v_role from DB, NOT body-supplied p_role parameter
  CASE WHEN v_role IN ('owner', 'admin') THEN ln.teacher_private_notes
       WHEN ln.teacher_id = v_teacher_id THEN ln.teacher_private_notes
       ELSE NULL END AS teacher_private_notes,
  ...
```

**Reference instance:** `get_lesson_notes_for_staff` (vestigial `p_user_id` + `p_role` params noted as F-02-032 hygiene issue, but the auth layer itself is the model).

**Use case:** staff fns where the FE may pass legacy params; body derives the actual role from DB and ignores caller-asserted role.

### Pattern #4 — Derive-then-`is_org_admin` (resolve target's org_id from row SELECT, then check caller)

**Class applicability:** SECDEF fns that take a target entity UUID (e.g., guardian_id, student_id, location_id) without an explicit `_org_id` parameter — body resolves the org from the target row, then checks caller against that org.

**Body excerpt** (`anonymise_guardian`):
```sql
DECLARE v_org_id uuid;
BEGIN
  SELECT org_id INTO v_org_id FROM public.guardians WHERE id = guardian_id;
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'Guardian not found'; END IF;
  IF NOT is_org_admin(auth.uid(), v_org_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  UPDATE public.guardians SET ...
```

**Reference instances (3):**
- `set_primary_location(p_org_id, p_location_id)` — variant where org_id is body-supplied; still checks `is_org_admin(auth.uid(), p_org_id)` at body entry.
- `anonymise_guardian(guardian_id)` — derives `v_org_id` from `guardians` row.
- `anonymise_student(student_id)` — derives `v_org_id` from `students` row.

**Use case:** GDPR-flow fns and ownership-mutation fns where the caller passes only the target entity; body resolves scope and verifies caller privilege.

### Pattern #5 — Three-layer parent-portal defence

**Class applicability:** parent-portal SECDEF fns returning student-related data; must verify (a) authenticated, (b) member of org, (c) guardian of the requested students.

**Body excerpt** (`get_parent_lesson_notes`):
```sql
BEGIN
  -- Verify authenticated
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  -- Verify org membership
  IF NOT EXISTS (SELECT 1 FROM org_memberships
    WHERE user_id = auth.uid() AND org_id = p_org_id AND status = 'active') THEN
    RAISE EXCEPTION 'Not a member of this organisation';
  END IF;

  -- Verify caller is guardian of at least one requested student
  IF NOT EXISTS (SELECT 1 FROM student_guardians sg
    JOIN guardians g ON g.id = sg.guardian_id
    WHERE g.user_id = auth.uid() AND sg.student_id = ANY(p_student_ids)) THEN
    RAISE EXCEPTION 'Not a guardian of the requested students';
  END IF;

  -- Return only public fields for students the caller is actually guardian of
  RETURN QUERY SELECT ... FROM lesson_notes ln
    WHERE ln.org_id = p_org_id AND ln.parent_visible = true
      AND ln.student_id = ANY(
        SELECT sg2.student_id FROM student_guardians sg2
        JOIN guardians g2 ON g2.id = sg2.guardian_id
        WHERE g2.user_id = auth.uid() AND sg2.student_id = ANY(p_student_ids)
      );
END;
```

**Reference instance:** `get_parent_lesson_notes` — sole confirmed instance of the four-step layered defence (auth → org → guardian → final filter on RETURN).

**Use case:** parent-portal RPCs returning data scoped to specific students. **Note the final RETURN-filter** — even if a caller passes UUIDs of students they don't parent, the SELECT restricts results to actual guardian-set, double-defending against the "passes student_ids without being guardian" attack.

### Pattern #6 — Service-role-only via inverse condition

**Class applicability:** SECDEF fns intended to be called ONLY by service-role (e.g., from a webhook handler or cron edge fn). Inverse to Pattern #2 — instead of allowing service-role, it requires service-role by raising when `auth.uid()` is non-NULL.

**Body excerpt** (`apply_lost_dispute_cascade`):
```sql
BEGIN
  -- No auth gate: this RPC is only called by the stripe-webhook
  -- edge fn running service-role. Adding an is_org_finance_team
  -- check would block it. Defence-in-depth: ensure auth.uid() IS NULL
  -- (service-role has no auth.uid()).
  IF auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'apply_lost_dispute_cascade is service-role-only';
  END IF;
  ...
```

**Reference instance:** `apply_lost_dispute_cascade` — inverse condition style.

**Use case:** fns that have legitimate service-role callers but should never be invoked by an authenticated user. The inverse condition is cleaner than `auth.role() = 'service_role'` when the calling edge fn happens to leave auth.uid() NULL (e.g., webhook handlers without JWT context).

### Pattern #7 — Guardian-of-waitlist-entry scoped resolution

**Class applicability:** parent-action RPCs operating on a waitlist/offer entry, where the caller must be the guardian associated with that entry.

**Body excerpt** (`respond_to_makeup_offer`):
```sql
DECLARE _entry RECORD; _guardian_id UUID; _user_id UUID;
BEGIN
  _user_id := auth.uid();
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  ...
  -- Read the waitlist row first to obtain org_id for guardian scoping
  SELECT * INTO _entry FROM make_up_waitlist WHERE id = _waitlist_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Waitlist entry not found'; END IF;

  -- Resolve guardian for the current user, scoped to the waitlist's org
  SELECT g.id INTO _guardian_id FROM guardians g
    WHERE g.user_id = _user_id AND g.org_id = _entry.org_id
      AND g.deleted_at IS NULL
    LIMIT 1;
  IF _guardian_id IS NULL THEN
    RAISE EXCEPTION 'Guardian record not found for this organisation';
  END IF;
  IF _entry.guardian_id IS DISTINCT FROM _guardian_id THEN
    RAISE EXCEPTION 'Waitlist entry does not belong to you';
  END IF;
  ...
```

**Reference instance:** `respond_to_makeup_offer` (and the sister fn `cancel_booked_makeup` confirmed Phase 7.5 — same pattern).

**Use case:** parent-action RPCs where the entry-row carries `org_id` + `guardian_id` and the caller's authority derives from being that guardian within that org. **Sibling fn `respond_to_enrolment_offer` lacks this pattern → F-02-015 HIGH.** The contrast is documented in §8 sub-pattern analysis.

### Pattern #8 — Mixed-org-input per-element filtering

**Class applicability:** bulk SECDEF fns that accept an array of entity IDs spanning multiple orgs in the worst case; body validates membership against the first element's org_id, then per-element filters out cross-org IDs.

**Body excerpt** (`bulk_update_lessons`, abbreviated):
```sql
DECLARE _caller_id uuid := auth.uid(); _org_id uuid; _caller_role app_role; ...
BEGIN
  IF p_lesson_ids IS NULL OR array_length(p_lesson_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'No lesson IDs provided.';
  END IF;
  IF array_length(p_lesson_ids, 1) > 100 THEN
    RAISE EXCEPTION 'Maximum 100 lessons per bulk operation.';
  END IF;
  ...
  SELECT l.org_id INTO _org_id FROM public.lessons l WHERE l.id = p_lesson_ids[1];
  ...
  SELECT om.role INTO _caller_role FROM public.org_memberships om
    WHERE om.user_id = _caller_id AND om.org_id = _org_id AND om.status = 'active';
  IF _caller_role IS NULL THEN RAISE EXCEPTION 'Not a member of this organisation.'; END IF;
  ...
  FOR _lesson IN SELECT ... FROM public.lessons l WHERE l.id = ANY(p_lesson_ids) ... LOOP
    IF _lesson.org_id != _org_id THEN
      _skip_ids := array_append(_skip_ids, _lesson.id);
      _skip_reasons := array_append(_skip_reasons, 'Lesson belongs to different organisation');
      CONTINUE;
    END IF;
    ...
```

**Reference instance:** `bulk_update_lessons` (called via `bulk_cancel_lessons` for cancel-class operations).

**Use case:** any bulk-by-ID RPC where the caller's input could mix orgs (intentionally or unintentionally). The pattern derives org from element [1], gates membership against that, then filters elements that don't match. Handles the mixed-input attack class (passing one own-org ID + one victim-org ID).

### Pattern #9 — Conditional auth, service-role-aware

**Class applicability:** SECDEF fns called from both authenticated UI and service-role cron/webhook. Body checks `auth.uid() IS NOT NULL` first; only enforces the role gate when authenticated.

**Body excerpt** (`recalculate_invoice_paid`):
```sql
BEGIN
  SELECT id, org_id, total_minor, status, due_date INTO _invoice
  FROM invoices WHERE id = _invoice_id FOR UPDATE;
  IF _invoice IS NULL THEN RAISE EXCEPTION 'Invoice not found'; END IF;

  -- Conditional auth: service-role bypass, authenticated must be finance-team
  IF auth.uid() IS NOT NULL AND NOT is_org_finance_team(auth.uid(), _invoice.org_id) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;
  ...
```

**Reference instance:** `recalculate_invoice_paid`.

**Use case:** ledger-mutation fns called both directly from UI (admin clicks "Retry recalc" — `admin_recalculate_invoice_paid` calls this) and from cron-triggered recompute paths (where there's no `auth.uid()`). The conditional form avoids breaking the cron caller while still gating UI callers.

### Pattern #10 — Dual-mode auth with explicit anon-reject branch

**Class applicability:** SECDEF fns called from authenticated UI AND service-role cron; want to explicitly reject anon callers (callers with no auth context AND not service-role).

**Body excerpt** (`create_invoice_with_items`):
```sql
BEGIN
  -- CW-F3: tightened auth carve-out.
  -- Authenticated callers must pass the finance-team check. Service-role
  -- callers (J9 generator, future trusted in-DB wrappers) bypass the
  -- row-level check on the assumption their wrapper does its own
  -- org-scope auth. Anonymous callers (no JWT, not service-role) reject.
  IF auth.uid() IS NOT NULL THEN
    IF NOT is_org_finance_team(auth.uid(), _org_id) THEN
      RAISE EXCEPTION 'Not authorised to create invoices for this organisation';
    END IF;
  ELSIF current_setting('role', true) <> 'service_role' THEN
    RAISE EXCEPTION 'Not authorised: anonymous callers cannot create invoices'
      USING HINT = 'Either authenticate as finance team, or invoke from a service-role context.';
  END IF;
  ...
```

**Reference instance:** `create_invoice_with_items`.

**Use case:** stronger version of Pattern #9 — explicit `ELSIF` branch rejects anon callers. Use when the fn must NEVER be callable by anon, even if EXECUTE happens to be granted.

### Pattern #11 — Graceful-fail (return empty)

**Class applicability:** **DASHBOARD / DISPLAY-ONLY** SECDEF fns where empty data is preferable to an error. **USE-CASE CONSTRAINED.**

**Body excerpt** (`get_invoice_stats`):
```sql
BEGIN
  IF NOT is_org_staff(auth.uid(), _org_id) THEN
    RETURN '{}'::json;
  END IF;

  RETURN (SELECT json_build_object('total_outstanding', ..., 'overdue', ..., ...));
END;
```

**Reference instance:** `get_invoice_stats`.

**Use-case constraint (explicit, do not generalise):** **dashboard or display-only queries**, **never sensitive operations**. The graceful-fail pattern hides authorisation failures from observability — the caller sees `{}` and assumes "no data". For dashboard counters where a permission gap is a UX issue and not a security issue, this is fine. **For any fn that returns identifying data, returns boolean security signals, or writes**, this pattern is wrong — use Pattern #1 / #5 / #7 instead.

**Why this matters:** if a future fn copies this pattern to a sensitive-operation context, the authorisation failure mode becomes invisible to monitoring (no RAISE, no error log). Pattern documentation MUST carry the use-case constraint to prevent that drift.

### Pattern #12 — Inline-WHERE auth (SQL-language fns)

**Class applicability:** SQL-language SECDEF fns where the auth check can be expressed as a WHERE-clause predicate — denial returns zero rows rather than raising.

**Body excerpt** (`get_org_calendar_health`):
```sql
SELECT cc.id as connection_id, cc.user_id, ...
FROM calendar_connections cc
LEFT JOIN teachers t ON t.user_id = cc.user_id AND t.org_id = cc.org_id
LEFT JOIN profiles p ON p.id = cc.user_id
LEFT JOIN LATERAL (
  SELECT COUNT(*) as event_count
  FROM calendar_event_mappings cem
  WHERE cem.connection_id = cc.id AND cem.sync_status = 'synced'
) em ON true
WHERE cc.org_id = p_org_id
  AND cc.guardian_id IS NULL
  AND is_org_admin(auth.uid(), p_org_id)   -- inline auth predicate
ORDER BY teacher_name, cc.provider;
```

**Reference instances:** `get_org_calendar_health`, `get_org_sync_error_count`.

**Use case:** SQL-language fns (no `IF/RAISE` available) that return calendar/health/status data. The auth predicate in WHERE returns zero rows on denial. Same use-case constraint as Pattern #11 — dashboard-display only.

### Pattern #13 — Conjunctive service-role-OR-admin

**Class applicability:** SECDEF fns called from both onboarding-flow edge fns (service-role) and admin UI. Need to allow either path with a single combined check.

**Body excerpt** (`seed_make_up_policies`):
```sql
BEGIN
  -- Service role (edge functions, onboarding RPC) is always allowed.
  -- Otherwise require org admin.
  IF current_setting('role', true) <> 'service_role'
     AND NOT is_org_admin(auth.uid(), _org_id) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;
  ...
```

**Reference instance:** `seed_make_up_policies`.

**Use case:** initial-setup fns called from onboarding-setup edge fn (service-role context) AND later from admin Settings UI (authenticated admin). Single conjunctive check allows either; uses `current_setting('role')` rather than `auth.role()` for symmetry with `block_owner_insert` / `protect_onboarding_flag` trigger patterns.

---

### Patterns explicitly NOT in the catalogue

#### Division-by-zero auth trick (`get_revenue_report`) — **TODO-class refactor target, NOT a positive pattern**

The fn body uses:
```sql
SELECT 1 / (CASE WHEN is_org_finance_team(auth.uid(), _org_id) THEN 1 ELSE 0 END);
```
to force a SQL exception when the caller is not finance-team. **Documented as TODO-class refactor target in §11 — not enshrined as a positive pattern.** The mechanism works (division-by-zero raises in SQL-language fns where IF/RAISE is unavailable), but it is fragile, surprising, and propagates an anti-pattern if copied. The cleaner fix is to either rework as PL/pgSQL or call a PL/pgSQL helper fn at the row level.

---

## 8. Class-pattern analysis

### 8.1 Parameter-spoofing class lineage

The parameter-spoofing class spans three batches:

| Source | Findings | Count |
|---|---|---|
| s38 pre-investigation | PI-08 (`record_stripe_payment` — resolved as F-02-005) | 1 |
| Batch 01 (s40) | F-01-003 `undo_student_import` | 1 |
| Phase 5 (s41) | 24 `_user_id`-class FAILs incl. F-02-001 `complete_onboarding`, F-02-002 `get_students_for_org`, F-02-007 `check_rate_limit`, F-02-008 `_notify_streak_milestone`, F-02-009 `get_student_ids_for_parent`, F-02-020 helper class (19 fns) | 24 |
| Phase 7C / 7.5 (s41) | 14 entity-context-class FAIL fns (across the 15 finding-IDs counted in this doc; LOW class F-02-034 covers 2 fns as a class entry) | 14 |
| **Total class instances** | | **41 confirmed instances across 90 examined fns = 46% class-FAIL** |

### 8.2 Helper-pattern canonicity

The `is_org_*(auth.uid(), <org_id>)` pattern is the **established canonical form** for org-scoped SECDEF authorisation. Reference instances of correct usage:

- `is_org_admin(auth.uid(), v_org_id)` — used by `anonymise_guardian`, `anonymise_student`, `set_primary_location`, `convert_lead`, `convert_waitlist_to_student`, `delete_billing_run`, `reassign_teacher_conversations_to_owner`
- `is_org_staff(auth.uid(), _org_id)` — used by `add_to_enrolment_waitlist`, `confirm_makeup_booking`, `dismiss_makeup_match`, `issue_make_up_credit`, `offer_makeup_slot`, `recalc_continuation_summary`, `redeem_make_up_credit`, `withdraw_from_enrolment_waitlist`
- `is_org_finance_team(auth.uid(), _org_id)` — used by `admin_recalculate_invoice_paid`, `create_invoice_with_items`, `generate_installments`, `generate_invoices_from_template`, `get_active_disputes_for_org`, `get_disputes_for_invoice`, `get_recent_recalc_failures_for_invoice`, `get_revenue_report`, `get_unbilled_lesson_ids`, `record_manual_payment`, `record_manual_refund`, `record_payment_and_update_status`, `retry_failed_recipients`, `update_invoice_with_items`, `void_invoice`

**FAILs are deviations**, not the absence of the canonical. Phase 7.5's 24% FAIL ratio on the entity-context class reflects the helper pattern being consistently applied; most FAILs are concentrated in five identifiable sub-pattern clusters (§8.3).

### 8.3 Five sub-pattern clusters within entity-context FAILs

1. **Financial-mutation historical drift.** `record_stripe_payment` (F-02-005), `record_installment_payment` (F-02-004). Predate the consistent `is_org_finance_team` pattern adoption. **Critical-class.**

2. **Cron / webhook gaps.** `cleanup_withdrawal_credits` (F-02-003), `_notify_streak_milestone` (F-02-008), `materialise_continuation_lessons` (F-02-013). Originally written for cron / trigger callers; the SECDEF + EXECUTE-to-anon combination was overlooked when the fns were never intended to be directly callable. **Critical / High class.**

3. **Counter / lookup helpers treated as innocuous.** `generate_invoice_number` (F-02-022), `get_unmarked_lesson_count` (F-02-036), `continuation_run_org_id` (F-02-035). Authors considered the operations low-impact (counter increments, read scalars) and skipped the auth check. **Medium / Low class.**

4. **Cross-tenant probes.** `find_waitlist_matches` (F-02-012), `count_lessons_on_dates` (F-02-021), `is_org_active` + `is_org_write_allowed` class (F-02-034). Probe-class fns that return scalars or small datasets; authors did not anticipate enumeration use. **High / Medium / Low class.**

5. **Newer parent-portal fns with sibling-asymmetry.** `respond_to_enrolment_offer` (F-02-015) lacks the guardian-of-entry scoped resolution that `respond_to_makeup_offer` correctly implements. Same family, divergent posture. **High class.**

### 8.4 Phase C sprint structure recommendation

Based on the class analysis, Phase C remediation is best structured around:

1. **`S-01-secdef-headline` — Critical-class headline batch.** F-02-001, F-02-002, F-02-003, F-02-004, F-02-005. Five Critical findings; high-priority commit; deserves a dedicated sprint commit + verification pass.

2. **`S-02-financial-falsification` — 2-fn class.** F-02-004 + F-02-005. Treat together because they share the `enforce_invoice_status_transition` partial-DiD posture and the UK regulatory dimension (MTD/Stripe TOS/child-safeguarding adjacency).

3. **`S-03-helper-class-track-1` — REVOKE EXECUTE batch.** F-02-020 Track 1 (17 fns) + F-02-007 + F-02-008 + F-02-009 + F-02-011 + F-02-022 + F-02-023 + F-02-031 + F-02-034 + F-02-035 (and F-01-003 from batch 01). Single migration; no FE code changes.

4. **`S-04-helper-class-track-2` — Body-level auth.uid() for FE-consumed.** F-02-002 body fix (already in `S-01`), F-02-013 body fix, F-02-014 body fix, F-02-015 body fix (apply sibling Pattern #7), F-02-021 body fix, F-02-036 body fix. Per-fn body change + FE verification per call site.

5. **`S-05-audit-log-integrity`.** F-02-010 BEFORE INSERT trigger + pre-deployment-sweep deliverable.

6. **`S-06-write-rollback-discipline`.** F-02-006 (Teachers.processRemoval) clustered with F-01-002 / F-01-004 / F-01-006 / F-01-030 — class fix for multi-step write rollback across 6 surfaces.

7. **`S-07-invite-flow-status-fidelity`.** F-02-017 + F-02-018 + F-02-019. Status-fidelity batch for invite-related edge fns.

8. **`S-08-cache-discipline`.** F-01-015 + F-01-030 + F-02-024 + F-02-028. Org-switch cache invalidation + cross-tab persistence.

9. **`S-09-code-hygiene`.** F-02-016, F-02-026, F-02-032, F-02-033 (long-term: CI gate). Low-priority cleanup batch.

10. **`S-10-e2e-fixture-hygiene`.** F-02-029, F-02-030. E2E test fixture teardown hardening.

11. **`S-11-v2-plan-pr1-usecan`.** F-02-027 — V2 plan §5 PR1 `useCan` hook implementation.

Sprint numbering is illustrative; Jamie / Lauren assigns final sprint IDs at Phase C kickoff.

---

## 9. Cross-link annotations to batch-01 findings

Seven batch-01 findings receive cross-link annotations from this batch-02 audit. Each annotation captures the batch-02 evidence and how it affects the finding's status or fix surface. Severity is unchanged for all; only fix-context and cross-reference are added.

### F-01-001 cross-link — `useParentLessonNotes` parameter-mismatch

**Original (batch 01):** Critical. `useLessonNotes.ts:120` calls `get_parent_lesson_notes` with `p_student_id` (singular scalar) instead of `p_student_ids` (array). PostgREST returns PGRST202; parent portal lesson notes never display.

**Batch 02 annotation (Phase 7C):** **DB-side audit verifies the parent-portal SECDEF RPC has correct three-layer auth defence (Positive Pattern #5).** Fix is purely an FE rename — no auth-surface risk in the fix itself. Cluster with F-01-005 (data-divergence dimension; not re-audited in batch 02) for parent-portal Phase C sprint.

### F-01-002 cross-link — `AcceptInvite.signUpAndAccept` orphan auth account

**Original (batch 01):** Critical. Page-level rollback gap; auth account stranded if invite-accept edge fn fails.

**Batch 02 annotation (Phase 2):** **Edge fn idempotency posture confirmed CLEAN.** Phase 2 audited `invite-accept` edge fn — JWT-derived user.id, email-match check, token consumed at end, idempotent on retry per F-01-011. **F-01-002 fix surface is page-side only.** Cluster with F-01-004, F-01-006, F-01-030, F-02-006 for `S-06-write-rollback-discipline` sprint.

### F-01-003 cross-link — `undo_student_import` SECDEF parameter-spoofing

**Original (batch 01):** Critical. Cascade destruction surface; authenticated-bypass triggering deletion of attendance / lessons / recurrences.

**Batch 02 annotation (Phase 5):** **Class-cross-link to F-02-001 / F-02-002 / F-02-005 / F-02-020.** F-01-003 is one of the 24 `_user_id`-class FAIL fns enumerated in Phase 5. Fix template is the Track 1 / Track 2 split from §F-02-020. `undo_student_import` has FE caller at `useStudentsImport.ts:362` (TS-cast); requires Track 2 body-level fix OR Track 1 REVOKE + FE migration. **Apply Pattern #1 (`_user_id != auth.uid()` self-check) per the F-01-003 original fix surface text.**

### F-01-005 cross-link — `get_parent_lesson_notes` group-lesson under-return

**Original (batch 01):** High. RPC under-returns vs `lesson_notes_parent_select` RLS policy on group-lesson notes.

**Batch 02 annotation (Phase 7C):** **Auth dimension verified CORRECT (Positive Pattern #5).** The data-divergence dimension F-01-005 captures — group-lesson whole-lesson notes (where `ln.student_id IS NULL`) not being returned to parents who legitimately can see them via RLS — was NOT re-audited in batch 02. Carry to parent-portal Phase C sprint.

### F-01-015 cross-link — Org switch does not invalidate TanStack Query cache

**Original (batch 01):** Medium. `OrgContext.setCurrentOrg` fire-and-forget profile UPDATE; no `queryClient.invalidateQueries`.

**Batch 02 annotation (Phase 3):** **Reinforced.** Phase 3 confirmed `OrgContext.tsx:274-288` body unchanged. Drift compounds: 188 `useCan` consumer sites (+33 vs V2 plan baseline of 155 — see F-02-027). Cluster with F-01-030 + F-02-024 + F-02-028 for `S-08-cache-discipline` sprint.

### F-01-030 cross-link — `setCurrentOrg` fire-and-forget profile UPDATE no error handling

**Original (batch 01):** Low. Same body as F-01-015; documented separately for the error-handling dimension.

**Batch 02 annotation (Phase 3):** Same root cause as F-01-015 per Phase 3 walk. **Same fix path.** Cluster in `S-08-cache-discipline`.

### F-01-031 cross-link — Policy style inconsistency: inline `org_memberships` subqueries vs helper functions

**Original (batch 01):** Low. Some RLS policies use inline subqueries; others call helper fns like `is_org_admin(...)`.

**Batch 02 annotation (Phase 7.5):** **Helper-fn pattern confirmed canonical** via Phase 7.5 positive-pattern catalogue (§7 Patterns #4 / #6 / #9 / #10 / #13 — all use the `is_org_*` helper family). F-01-031 is style-only; no security-class concern. **Severity downgrade candidate** for Phase C: LOW → INFO. Phase 9 doc flags for Jamie's review.

### F5e (s40 withdrawal) cross-link — Parent-data RLS gap (claimed)

**Original (s40):** withdrawn — misread of policy chain.

**Batch 02 annotation (Phase 7C / Phase 8.3):** **Reinforced WITHDRAWN.** Phase 7C body-verified `get_parent_lesson_notes` has CORRECT three-layer parent-portal defence (Positive Pattern #5). The original F5e concern was overstating; the parent-data path is well-guarded.

---

## 10. PI-08 closure

**Status:** **RESOLVED — re-classified as F-02-005 (Critical) in batch 02 Phase 7C.**

**History reconciliation:**

| Phase | Verdict | Evidence |
|---|---|---|
| s38 pre-investigation | HIGH | "RPC body verified — no `IF _invoice.org_id != _org_id THEN RAISE` check" — `_org_id` parameter-mismatch concern |
| Batch 02 Phase 7C (s41, 2026-05-11) | Body re-audit | No `auth.uid()` reference anywhere in body — real defect is no caller-context validation at all, not just `_org_id` mismatch. `_org_id` mismatch is a downstream symptom of the deeper no-caller-validation root cause. |
| Batch 02 Phase 9 (this doc) | CRITICAL via F-02-005 | Severity elevated HIGH → CRITICAL on class consistency with F-02-001 / F-02-003 / F-02-004 + Phase C `S-02-financial-falsification` class scoping. Primary ownership transferred from batch 06 to batch 02. |

**STATUS.md §5.1 row update text (queued for Phase 10 commit):**

```
| PI-08 | High → **CRITICAL** | record_stripe_payment accepts _org_id parameter but never verifies it matches invoice org | RPC body verified — no IF _invoice.org_id != _org_id THEN RAISE check | 06-payments-stripe-connect | **RESOLVED — re-classified as F-02-005 CRITICAL in batch 02 Phase 7C. Severity elevated HIGH → CRITICAL on body re-audit (real defect is no caller-context validation at all, not just _org_id mismatch). Primary ownership transferred from batch 06 to batch 02.** | s41 |
```

**STATUS.md §5.3 severity tally update (queued):**
- Critical: 8 → 9 (PI-08 elevation)
- High: 8 → 7

**Batch 06 ledger entry:** when batch 06 executes in Phase B, the `payments` audit will record a cross-reference annotation: "PI-08 resolved in batch 02 as F-02-005; record_stripe_payment fix landed in Phase C `S-02-financial-falsification`. No additional batch-06 action required on this fn."

---

## 11. Cross-cutting carries — batch 19 deliverables

The audit surfaced nine cross-cutting class patterns + one refactor target to be addressed in batch 19 (cross-cutting class consolidation) during Phase B/C/D execution.

### CC-19-? Helper-fn EXECUTE-grant hygiene + CI lint rule

**Class:** SECDEF helper fns in `public` schema with EXECUTE granted to `authenticated` and/or `anon` should be reviewed against an explicit FE-allowlist; non-allowlist fns should have EXECUTE revoked.

**CI lint deliverable:** `pg_proc` query in CI:
```sql
SELECT p.proname, pg_get_function_identity_arguments(p.oid) FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.prosecdef = true
  AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
  AND p.proname NOT IN (<FE-allowlist>)
ORDER BY p.proname;
-- Non-empty result fails CI
```

### CC-19-? Vestigial-parameter audit on SECDEF fns

**Class:** SECDEF fns with declared parameters not referenced in the body. First instance: `get_lesson_notes_for_staff` (F-02-032; vestigial `p_user_id` + `p_role`). Phase 7B SQL sweep methodology can be re-run periodically.

### CC-19-? `audit_log` INSERT integrity trigger

**Class:** see F-02-010 anchor fix — BEFORE INSERT trigger enforcing `actor_user_id IS NOT NULL OR current_setting('role') IN ('service_role', 'postgres')`. Includes pre-deployment-sweep deliverable.

### CC-19-? Auth-schema-crossing SECDEF audit

**Class:** SECDEF fns in `public` that read from / write to `auth.users`, `auth.identities`, `auth.sessions`, `auth.refresh_tokens`, `auth.mfa_*`. First (and only confirmed) instance: `get_user_id_by_email` (F-02-011). Phase 7D regex sweep methodology documents the class enumeration approach.

### CC-19-? Single-trigger DiD on critical-class bypasses

**Class:** critical-class SECDEF bypasses (e.g., F-02-001 `complete_onboarding`) defended by a single downstream trigger (`trg_block_owner_insert`). Brittleness if the trigger is removed or weakened.

**Enumeration approach:** enumerate triggers with names matching `block_*`, `protect_*`, `enforce_*` and cross-reference against SECDEF fns whose body would be insecure without them.

### CC-19-? Org-context spoofing class systematic sweep + CI lint

**Class:** the 62-fn entity-context-class enumerated in Phase 7.5 (15% FAIL after full sweep). Batch 19 owns the periodic re-enumeration to catch new instances + a CI lint rule detecting new SECDEF fns that take entity-UUID body params without `is_org_*(auth.uid(), ...)` check.

### CC-19-? Generated-types pipeline drift CI gate

**Class:** TS-bypass-cast prevalence (F-02-033 — 30 sites). Long-term fix: CI gate requiring `supabase gen types typescript` regeneration and forbidding `as any` adjacent to `.rpc(` calls.

### CC-19-? E2E fixture hygiene (idempotent seed scripts)

**Class:** E2E test fixtures (F-02-029 orphan org + F-02-030 multi-owner state) that leave artifacts in production-shape DB. Idempotent seeding + teardown.

### CC-19-? Multi-step write rollback discipline class (6 surfaces)

**Class:** F-01-002 (AcceptInvite signUp), F-01-004 (account-delete), F-01-006 (invite-accept inner steps), F-01-030 (setCurrentOrg fire-and-forget), F-02-006 (Teachers.processRemoval), F-02-026 (Locations.confirmDeleteLocation docs gap). Class fix: server-side transactional wrappers for multi-step writes; cluster in `S-06-write-rollback-discipline`.

### TODO — `get_revenue_report` div-by-zero auth trick refactor target

**Not enshrined as a positive pattern.** See §7 final block. The fn's auth check works (forces SQL exception when caller is not finance-team) but is fragile and surprising. Refactor target for Phase C cleanup: either rework as PL/pgSQL or extract the per-row auth check into a helper fn that integrates with the canonical pattern.

---

## 12. Audit-method appendix

### 12.1 Phase-by-phase coverage summary

| Phase | Surface | Findings delta | Cumulative |
|---|---|---|---|
| 0 | HEAD verify + pre-investigation re-verify | 0 | 0 |
| 1 | 6 org pages walk (Onboarding, Students, Teachers, Locations, settings touched, AcceptInvite touched) | 6 (0C/1H/2M/3L) | 6 |
| 2 | 5 edge fns + `complete_onboarding` RPC body (onboarding-setup, invite-accept, invite-get, batch-invite-guardians, send-invite-email) | 4 (1C/0H/3M/0L) | 10 |
| 3 | useCan / role permissions / OrgContext walk; 188 useCan sites enumerated | 2 (0C/0H/0M/2L) | 12 |
| 4 | Org state anomalies (2 orgs E2E-fixture-confirmed); trigger pull-forward analysis | 2 (0C/0H/0M/2L) | 14 |
| 5 | SECDEF `_user_id`-class body audit (28 fns: 1 PASS + 2 alternate-PASS + 25 FAIL of which 2 already-recorded) | 7 (1C/3H/1M/2L) | 21 |
| 6 | Org-management triggers (handle_new_organisation, protect_owner_role, validate_org_timezone_currency, prevent_org_id_change, block_owner_insert, protect_onboarding_flag) + audit-log integrity sweep | 2 (0C/2H/0M/0L) | 23 |
| 7A | TS-bypass-cast prevalence sweep across `src/` + `supabase/functions/` (30 sites, 21 files) | 1 LOW class | 24 |
| 7B | SECDEF fn vestigial-parameter sweep (SQL parse: param names vs body word-boundary matches) | (absorbed into F-02-032) | 24 |
| 7C | Org-context spoofing class — sample-first audit (15-fn sample); 53% FAIL triggered escalation | 7 (3C/2H/1M/1L) | 31 |
| 7D | Auth-schema-crossing SECDEF sweep | (no new; only F-02-011 already from Phase 6) | 31 |
| 7.5 | Org-context spoofing class — full audit (43 remaining of 62-fn class); 14% FAIL on Phase 7.5 alone | 6 (0C/2H/2M/2L) | 37 |
| (Phase 9 reconciliation) | Phase 1 TS-bypass-cast cluster subsumed by Phase 7A class (drop Medium) | −1 (0C/0H/-1M/0L) | **36** |
| 8 | Legacy findings re-verification (17 PIs + 36 batch-01 + 3 withdrawals) | 0 | **36** |

**Final ledger: 36 findings (5C / 10H / 8M / 13L) for batch 02-org-management.**

### 12.2 Enumeration regex variants (18 naming patterns)

`_user_id`-class enumeration sweep (Phase 5 + Phase 5.5 extension):
- `_user_id`, `p_user_id`, `_teacher_user_id` (caught direct in initial Phase 5)
- `_actor_user_id`, `_caller_id`, `_caller_user_id`, `_by_user`, `_initiator`, `_operator`, `_actor_uuid`, `_owner_id`, `_granter`, `_creator`, `_author`, `_modifier`, `_invoker`, `_executor`, `_requester`, `_target_user` (zero matches; class population confirmed lock)

Entity-context-class enumeration sweep (Phase 7C + Phase 7.5A widened-regex):
- `_org_id`, `_invoice_id`, `_lesson_id`, `_run_id`, `_student_id`, `_teacher_id`, `_guardian_id`, `_location_id`, `_booking_id`, `_payment_id`, `_term_id`, `_credit_id`, `_waitlist_id`, `_template_id`, `_recurrence_id`, `_dispute_id`, `_entry_id`, `_thread_id`, `_message_id`, `_installment_id`, `_batch_id`, `_lead_id`, `p_*` variants
- Bare-prefix variants (no underscore): `guardian_id`, `student_id` — caught via widened sweep in Phase 7.5A (surfaced `anonymise_guardian`, `anonymise_student`)

### 12.3 DiD analysis methodology

For each write-class FAIL:
1. `pg_trigger` inventory on target tables (BEFORE / AFTER / event mask) via:
   ```sql
   SELECT t.tgrelid::regclass, t.tgname, p.proname,
     CASE t.tgtype::int & 66 WHEN 2 THEN 'BEFORE' ELSE 'AFTER' END AS timing,
     array_to_string(ARRAY[
       CASE WHEN t.tgtype::int & 4 > 0 THEN 'INSERT' END,
       CASE WHEN t.tgtype::int & 8 > 0 THEN 'DELETE' END,
       CASE WHEN t.tgtype::int & 16 > 0 THEN 'UPDATE' END
     ], ' OR ') AS events
   FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid
   WHERE t.tgrelid::regclass::text IN (<table list>) AND NOT t.tgisinternal;
   ```
2. Trigger fn body inspection for `auth.uid()`, `current_setting('role', true)`, and RAISE-on-condition patterns.
3. PL/pgSQL transaction-rollback model: function body forms a single implicit transaction; trigger `RAISE EXCEPTION` rolls back all preceding writes in the body. The model was confirmed in Phase 4 self-correction on F-02-001 (`complete_onboarding`).

### 12.4 Severity rubric anchor per finding

Per `audit/sweep/PLAN.md` §4:
- **Critical** — financial loss, data loss, security exposure, marketed-feature-fundamentally-broken, or first-encounter trust erosion. Applied to F-02-001 (security exposure + marketed flow), F-02-002 (security exposure + data loss + child-safeguarding), F-02-003 (data loss + security exposure), F-02-004 + F-02-005 (financial-falsification + security exposure + UK regulatory).
- **High** — feature works but degraded, surprising, or unsupported; silent failure modes; missing UI for tracked DB state. Applied to F-02-006 through F-02-015 with per-finding rubric citation.
- **Medium** — cosmetic but visible inconsistency; timezone-edge issues; non-critical race conditions; minor UX dead-ends. F-02-016 through F-02-023.
- **Low** — code-hygiene drift; stale comments; minor docstring inconsistency; legacy artefacts. F-02-024 through F-02-036.

### 12.5 Sample-first methodology + decision gates (Phase 7C escalation case)

Phase 7C used a 15/60-fn sample of the entity-context-class. Composition: 3× `_org_id` solo, 2× `_invoice_id`, 2× `_lesson_id`, 2× `_student_id`, 2× parent-facing + FE-cast, 2× high-power writes, 2× other entity types. Result: 8 FAIL / 7 PASS = 53% FAIL. **Decision-gate rubric (per s41 instruction):**
- &gt;30% FAIL OR any Critical-class confirmed → escalate to full-class audit (Phase 7.5).
- 10–30% FAIL → individual findings for sample; remaining ~50 fns deferred to batch 19.
- &lt;10% FAIL → completeness check only.

Both escalation triggers fired (53% > 30% AND 3 Critical-class confirmed). Phase 7.5 audited the remaining 43 fns to close the class. Final population FAIL ratio: 24%.

### 12.6 Honest limitations

- **`useCan` site count:** Phase 3 enumerated 188 sites via `grep`. Per-site review was sampled (~15/188 spot-checked); the remaining 173 sites are tracked under F-02-027 as compound drift, not individually audited. The drift count (+33 vs V2 plan baseline) is the operative signal; individual call-site audit is deferred to V2 plan §5 PR1 `useCan` implementation sprint.
- **F-01-005 data-divergence dimension:** Phase 7C confirmed `get_parent_lesson_notes` auth posture (Pattern #5 PASS). The data-divergence concern (group-lesson whole-lesson notes invisible) was not re-audited in batch 02 — carries to parent-portal Phase C sprint.
- **Zoom sub-surface deferral:** Zoom-specific surface (3 edge fns + 1 page + settings tab + marketing page) is deferred pending external Zoom authorization/verification. Sub-surface deferral within batches 15 / 18 / 21, not whole-batch shelving. Not applicable to batch 02 directly but noted for cross-batch carry awareness.
- **`_notify_streak_milestone` initial enumeration miss:** Phase 5's regex captured fns with `_user_id`-shaped params. `_notify_streak_milestone` takes `_student_id` + `_org_id` (no `_user_id`), so the regex didn't match. The fn was included in Phase 5 audit via the s40 high-amplification-helper carry note. Phase 7.5A widened-regex closed this enumeration gap.

### 12.7 PI-08 reconciliation note + grand cumulative accounting

PI-08 (`record_stripe_payment`) originated as a batch-06-tagged HIGH finding in s38 pre-investigation. Phase 7C body re-audit (this batch) revealed the defect is broader than the original `_org_id` mismatch framing — no caller-context validation at all. Severity elevated HIGH → CRITICAL via F-02-005. Primary ownership transferred from batch 06 to batch 02. See §10 for the concrete STATUS.md row update.

**Single-counted accounting (PI-08 elevation reconciliation):**

PI-08 was originally graded HIGH; Phase 7C body re-audit elevated to CRITICAL and reclassified as F-02-005 in batch-02 Critical. The PI cohort retains PI-08 as a historical ledger entry at 17 (with RESOLVED tag) for traceability; active finding-instance count excludes the duplicate. **Single-counted: 16 PI active + 36 batch-01 + 36 batch-02 = 88 total active findings.**

**Cohort breakdown:**

| Cohort | Total | C | H | M | L |
|---|---|---|---|---|---|
| PI active (PI-08 RESOLVED to F-02-005; 17 historical retained) | 16 | 8 | 7 | 1 | 0 |
| Batch 01 | 36 | 3 | 4 | 10 | 19 |
| Batch 02 | 36 | 5 | 10 | 8 | 13 |
| **GRAND ACTIVE** | **88** | **16** | **21** | **19** | **32** |

Verification by direct count:
- PI Critical (active): PI-01, PI-02, PI-03, PI-04, PI-05, PI-11, PI-12 (un-shelved per s41 discipline correction), PI-13 = **8**
- Batch-01 Critical: F-01-001, F-01-002, F-01-003 = **3**
- Batch-02 Critical: F-02-001, F-02-002, F-02-003, F-02-004, F-02-005 (= PI-08 elevation) = **5**
- **Total Critical: 8 + 3 + 5 = 16 ✓**

---

> **AUDIT IN PROGRESS — DO NOT FIX YET**
>
> This document is the Phase B EXIT deliverable for batch 02-org-management. Findings are not authorised for fix until Phase C is explicitly opened and sprints are defined. Banner drops at Phase C kickoff.


