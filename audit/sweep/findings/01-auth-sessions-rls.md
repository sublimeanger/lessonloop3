# 01 — Auth, sessions, RLS — findings

**Session:** s40 (2026-05-11)
**Status:** In Progress (closes at Phase 10 commit)
**Severity tally:** 3 critical / 4 high / 10 medium / 19 low — total 36
**Batch:** 01-auth-sessions-rls per [`PLAN.md`](../PLAN.md) §5

---

## Front matter

### Scope of this audit

Per [`PLAN.md`](../PLAN.md) §5 batch 01 description and [`CENSUS.md`](../CENSUS.md) §11.A batch 01 row. Surfaces audited:

- **8 auth pages** (`Login`, `Signup`, `ForgotPassword`, `ResetPassword`, `VerifyEmail`, `AcceptInvite`, `Index`, `NotFound`) — Phase 1
- **6 auth edge functions** (`account-delete`, `profile-ensure`, `invite-accept`, `invite-get`, `gdpr-delete`, `gdpr-export`) — Phase 2
- **Auth context + session lifecycle** (`src/contexts/AuthContext.tsx`, `src/contexts/OrgContext.tsx`, `src/integrations/supabase/client.ts`) — Phase 3
- **Route guards** (`src/components/auth/RouteGuard.tsx`, `src/components/shared/AuthRedirect.tsx`, `src/App.tsx` route table) — Phase 4
- **RLS coverage** across all 93 public tables (88 with policies + 5 zero-policy) — Phases 5, 6
- **SECURITY DEFINER functions** (7 unpinned + 6 high-amplification helpers + 4 non-public-pinned variance drill) — Phase 7
- **6 legacy findings re-verified** under `audit/findings/` — Phase 8

### Headline result: the auth/RLS foundation is materially stronger than the rest of the codebase

- **270 RLS policies validated against 6 high-amplification helpers — all CLEAN.** `is_org_admin` (117 policies), `is_org_staff` (58), `has_org_role` (36), `is_org_finance_team` (24), `is_org_member` (23), `is_parent_of_student` (12). Every helper is `SECURITY DEFINER`, pinned to `search_path=public`, schema-qualified, with simple correct `EXISTS` predicates. A bug in any one would cascade across the named policy counts; none has a bug.
- **0 any-authenticated-grant policies** found across 93 tables.
- **0 no-tenant-scope policies** found.
- **All 6 legacy findings hold-as-fixed** (3 verified inline during Phases 2/3; 3 re-verified in Phase 8 against live DB / live config).
- **Phase C sprint scope narrows accordingly.** What would otherwise be a "rebuild RLS layer" sprint becomes a bounded refactor: **explicit `WITH CHECK` (F-01-017) + helper-style consistency (F-01-031) + SECDEF pinning (F-01-036) + parameter-spoofing codemod (F-01-003 + PI-08 class)**. Sprint scope estimate tightens dramatically.

### Spot-check settlements (Phase 9 pre-write)

| Finding | Pre-settle | Post-settle | Reason |
|---|---|---|---|
| **F5b** (`get_parent_lesson_notes` RPC vs policy divergence) | HIGH (pending) | **HIGH (held)** | Spot-check: `src/hooks/useLessonNotes.ts:113-129` exports `useParentLessonNotes` which calls the RPC; used by `src/pages/portal/PortalSchedule.tsx:124`. Parent flow does use the RPC path. The divergence (group-lesson whole-lesson notes invisible) is a real production gap when the RPC works. (Note: a separate critical finding — F-01-001 — exists for a parameter mismatch that currently prevents the RPC from working at all.) Mapped to `F-01-005`. |
| **F1c** (VerifyEmail → `/onboarding` always) | MEDIUM (held) | **LOW** | Spot-check: `src/pages/Onboarding.tsx:46-50` auto-bounces `profile?.has_completed_onboarding` users to `/dashboard` (with `?new=true` exception for second-org creation). Secondary safety net at lines 52-74 routes users with existing memberships to `/dashboard` or `/portal/home`. Both VerifyEmail's hardcoded `navigate('/onboarding')` and any other accidental nav to /onboarding are caught. Cosmetic wasted hop only. Mapped to `F-01-020`. |

### Withdrawn findings (recorded for audit history)

| ID | Withdrawn in | One-line reason |
|---|---|---|
| F1d | Phase 3 | ForgotPassword email-enumeration framing — `AuthContext.resetPassword` is a direct passthrough to `supabase.auth.resetPasswordForEmail` which returns generic 200 regardless of user-exists; the UI error path only fires on network/HTTP-layer failures, not on user-not-found. No enumeration vector exists. |
| F5e | Phase 5 | Parent-access gap on `make_up_credits`/`make_up_waitlist` — false alarm from a helper-only dependency query. Targeted query confirmed both tables have parent SELECT policies using inline subqueries against `guardians` + `student_guardians` (not via `is_parent_of_student` helper). Functional coverage exists; style inconsistency captured under F-01-031. |
| F2d | Phase 8 | config.toml verify_jwt drift — Phase 2 framed as drift; Phase 8 confirmed via the 2026-05-06 sb-secret-verify-jwt-incompatibility finding's category taxonomy that the 5 batch-01 fns missing from config.toml are intentionally **category (A) end-user JWT** (platform default `verify_jwt=true` + manual `getUser(token)` for defence-in-depth). config.toml is exceptions-only by design. No drift. |

### Deferred to other batches

| Item | Originating batch | Target batch | Why |
|---|---|---|---|
| **PI-10** (Settings → Accounting tab queries `xero_connections` + `xero_entity_mappings` via anon client; RLS-on-zero-policies silently returns 0 rows) | s38 pre-investigation, surfaced by Phase 6 cross-cutting | 18-settings-tabs + 15-calendar-sync-zoom-xero | Per `STATUS.md` §5 PI table — target batches own the re-verification |
| **2026-05-07-calendar-oauth-callback-verify-jwt-missing** legacy finding | Phase 8 | 15-calendar-sync-zoom-xero | Cross-batch by design per s40 prompt §6 |

### Cross-cutting concerns drafted for batch 19

1. **Multi-step write rollback discipline** — class pattern across `F-01-002` (`F1a` AcceptInvite), `F-01-004` (`F2a` account-delete), `F-01-006` (`F2c` invite-accept), `F-01-030` (`F3f` setCurrentOrg). Recommend: every multi-write flow that spans two or more tables / two or more service boundaries (DB + edge fn + Stripe API + Supabase Auth API) gets either (i) a single SECDEF RPC wrapping the transaction OR (ii) explicit compensating-action catch blocks. Codemod target.
2. **GDPR export reliability cluster** — `F-01-012` (`F2f` 50k silent truncation) + `F-01-013` (`F2g` unbounded response) + `F-01-027` (`F2e` no rate limit). Single Phase C sprint: stream to storage + signed URL + per-table-count metadata + rate limit. **GDPR Article 17 / 5(1)(d) compliance dimension** also added to `F-01-004` (account-delete partial-failure) impact field.
3. **Email enumeration class** — `signIn` is hardened (SEC-AUTH-03 normalisation); `signUp` is the bypass (`F-01-007` / F3a). Recommend uniform-error-shape audit across all auth-touching surfaces (forgot password, accept invite, signup, password update). F-01-007 needs explicit Phase C decision conversation given UX-vs-security trade-off (`decision_needed: true`).
4. **Parameter-vs-`auth.uid()` spoofing class** — confirmed instances: PI-08 (`record_stripe_payment`, batch 06) + `F-01-003` (`F7a` `undo_student_import`, batch 01 CRITICAL). Pattern likely endemic across SECDEF RPCs that accept `_user_id` / `_org_id` / `_guardian_id` / `_teacher_id` / `_student_id` parameters. **Phase B priority audit target** for every batch from s41 onwards.
5. **RLS+SECDEF duplicate-path divergence** — `F-01-005` (`F5b` `lesson_notes` policy + RPC drift). Class concern for any table with both direct RLS policy AND SECDEF RPC for the same role audience.
6. **"RLS-enabled, zero policies" ambiguity** — `F-01-035` (`F6a` 3 service-role-only batch-01 tables) + PI-10's xero pattern (broken). Same state, different intent.
7. **CI script deliverable** — `audit/scripts/check-rls-hygiene.sh` with three rules:
   - (a) Zero-policy-table reference check (F-01-035 class): fail build if any `relrowsecurity=true AND policy_count=0` table is referenced from `src/` outside `src/integrations/supabase/types.ts`.
   - (b) SECDEF unpinned check (F-01-036): fail build if any `prosecdef=true` function lacks a `search_path` config.
   - (c) Parameter-spoofing SECDEF audit (F-01-002 + PI-08 class): fail build if any SECDEF function takes `_user_id` / `_org_id` / `_guardian_id` / `_teacher_id` / `_student_id` parameter without either an `auth.uid()` equality check OR an explicit allowlist comment marker `-- @safe-params: …` on the function body header.
8. **`(supabase.rpc as any)` / TS-bypass-cast audit pattern.** `F-01-001` surfaced specifically because the cast on `useLessonNotes.ts:119` silenced the TypeScript signature check that would have caught the `p_student_id` vs `p_student_ids` mismatch against generated `src/integrations/supabase/types.ts`. Every other site with `(supabase.rpc as any)`, `(supabase.from as any)`, `(... as any).rpc`, or similar bypass is a candidate for a latent parameter-mismatch bug of the same class. Sprint deliverable: grep across `src/`, audit every site, fix or justify each, then remove the casts. **Bundle with the `F-01-001` fix sprint** since the cleanup is mechanical and the discovery vector is the same.
9. **Positive reference patterns** to document and lift: open-redirect protection (`PublicRoute` allowlist + scheme check), grace-period pattern (`RouteGuard` profile+role timers + retry), `block_expired_trial_*` defence-in-depth, `make_up_waitlist` parent UPDATE with bounded-status `WITH CHECK`, helper-pinning + schema-qualification standard (the 136 pinned SECDEF set).

### PI-12 severity symmetry (per Phase 7 note)

`PI-12` (LoopAssist `executeRescheduleLessons` bypasses all 7 conflict checks — `STATUS.md` §5.3) classification confirmed Critical per the same rubric application as `F-01-002` (`F7a`): security/integrity exposure + production data corruption + first-encounter trust erosion. `(deferred-shelved)` is a tracking status, not a severity demotion. No `STATUS.md` change needed.

---

## Findings

### F-01-001 — `useParentLessonNotes` calls `get_parent_lesson_notes` RPC with wrong parameter name; parent portal Schedule page never displays lesson notes

- **Severity:** **Critical**
- **Area:** rls (parent data access) / hooks
- **Evidence:**
  - Hook definition: [`src/hooks/useLessonNotes.ts:113-129`](../../src/hooks/useLessonNotes.ts) — calls `supabase.rpc('get_parent_lesson_notes', { p_student_id: studentId, p_org_id: orgId })`. Parameter `p_student_id` is singular scalar UUID.
  - RPC signature (verified Phase 9 via `pg_proc` query): `get_parent_lesson_notes(p_org_id uuid, p_student_ids uuid[])`. Parameter `p_student_ids` is plural array. Confirmed via:
    ```sql
    SELECT proname, pg_get_function_arguments(oid)
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='get_parent_lesson_notes';
    -- Returns: get_parent_lesson_notes | p_org_id uuid, p_student_ids uuid[]
    -- Exactly one row — no singular-parameter variant exists.
    ```
  - PostgREST RPC resolution is by parameter name. `{p_student_id, p_org_id}` does not match `(p_org_id, p_student_ids)` → PGRST202 "Could not find the function … in the schema cache".
  - Hook usage: [`src/pages/portal/PortalSchedule.tsx:124`](../../src/pages/portal/PortalSchedule.tsx) — `const { data: parentNotes } = useParentLessonNotes(selectedChildId || undefined, currentOrg?.id);`. This is a primary parent-portal surface (the schedule page).
  - The `(supabase.rpc as any)` cast on `useLessonNotes.ts:119` bypassed the TypeScript check that would have caught the name mismatch against generated types (`src/integrations/supabase/types.ts`).
  - Repro: a parent user logs in → navigates to `/portal/schedule` → selects a child → React Query fires `useParentLessonNotes` → PostgREST returns PGRST202 → React Query catches error → `parentNotes` is `undefined` → UI renders no notes. No error toast surfaces (the hook's error is silently swallowed by React Query default behaviour — no `onError` handler).
- **Impact:**
  - **Production-breaking for parent portal lesson notes.** Every parent visiting `/portal/schedule` sees zero lesson notes for any child, even when notes exist with `parent_visible = true`.
  - First-encounter trust erosion: parents log in to see their kid's progress notes from teachers; they see nothing. The marketing-promised feature ("see your child's lesson notes from teachers") does not work.
  - Silent failure mode — no error toast, no Sentry capture from this path (React Query default doesn't surface errors as toasts; the `useQuery` returns `{ data: undefined, error: <PGRST202> }` but the caller in `PortalSchedule.tsx:124` only destructures `data`).
  - **Severity Critical** per [`PLAN.md`](../PLAN.md) §4 rubric: marketed feature fundamentally broken + first-encounter trust erosion. Compare with `F-01-002`/PI-12 which sit in the same class.
- **Fix surface:**
  - Single-line in `useLessonNotes.ts:120` — rename `p_student_id: studentId` to `p_student_ids: [studentId]` (wrap in array to match `uuid[]` signature).
  - Remove the `(supabase.rpc as any)` cast on line 119 to restore type-check coverage; regenerate `src/integrations/supabase/types.ts` if it's stale.
  - Once the parameter mismatch is fixed, the underlying behavioural divergence captured by `F-01-005` (group-lesson whole-lesson notes invisible) becomes the next user-visible issue. Bundle both fixes in the same Phase C ticket.
- **Decision needed:** No — straightforward fix.
- **Target sprint:** TBD (assigned in Phase C; recommend parent-portal sprint with `F-01-005`)
- **Closure:** (empty in Phase B; populated in Phase C with commit hash)

### F-01-002 — `AcceptInvite.signUpAndAccept` leaves orphan auth account on invite-accept failure

- **Severity:** **Critical**
- **Area:** auth-pages
- **Evidence:**
  - [`src/pages/AcceptInvite.tsx:169-273`](../../src/pages/AcceptInvite.tsx) — `signUpAndAccept` calls `supabase.auth.signUp(...)` (line 202-209), waits for profile via `waitForProfile` poll (line 17-28 + 214), then `supabase.functions.invoke('invite-accept', { token })` (line 225-227).
  - Catch block at line 267-272 surfaces a toast but performs no rollback: no `supabase.auth.admin.deleteUser` call, no token reset, no compensating action.
  - Failure modes hitting the gap: network blip between signUp and invite-accept, edge-fn 5xx, token race (concurrent acceptor), teacher-limit-reached (`invite-accept` returns 403 per `invite-accept/index.ts:142-146`), guardian-creation silent failure inside invite-accept (F-01-006 cross-link).
  - Outcome: user has a Supabase auth account with the typed email; no org membership; the invite token is **still un-consumed** (good — invite-accept marks `accepted_at` only on success at line 242).
  - Recovery path that exists: user refreshes the AcceptInvite page → `if (user)` branch at line 317 renders the "Already logged in / Accept invitation" UI → click Accept → invite-accept retries (and the edge fn IS idempotent per F-01-011 analysis). The recovery works but is **non-obvious**; user has no in-page "Try again" affordance.
- **Impact:**
  - First-encounter trust erosion for invited users (teachers, parents, finance staff). Invited user attempts signup, gets a confusing failure, may abandon. Auth account remains stranded.
  - If admin resends a new invite to same email later, the user now hits "An account with this email may already exist" via F-01-007 (signup duplicate-email obfuscation) — compounded confusion.
  - Cross-batch class match to F-01-004 (account-delete 3-step partial failure) and F-01-006 (invite-accept inner-step partial failure). Class pattern listed in cross-cutting #1.
  - **Severity Critical** per `PLAN.md` §4: marketed-feature-fundamentally-broken (invite flow is the canonical multi-tenant onboarding path) + first-encounter trust erosion.
- **Fix surface:**
  - Add an in-page "Try again" affordance on the error toast that retries `invite-accept` with the same token (the function is idempotent — see F-01-011).
  - On terminal failure (after retries), call `supabase.auth.admin.deleteUser` via a service-role edge fn OR mark the auth account for cleanup via a side-channel.
  - Coordinate with F-01-006 fix (invite-accept inner-step silent error swallowing) — both must be fixed together since the AcceptInvite page can't distinguish between "transient fail → retry safe" and "inner-step left dangling teacher/guardian → retry needs cleanup".
- **Decision needed:** No (fix is mechanical).
- **Target sprint:** TBD (recommend invite-flow sprint combining F-01-002 + F-01-006 + F-01-011)
- **Closure:** (empty)

### F-01-003 — `undo_student_import` SECDEF RPC trusts caller-supplied `_user_id` parameter; bypasses authorisation

- **Severity:** **Critical**
- **Area:** secdef
- **Evidence:**
  - Function body (Phase 7 `pg_get_functiondef` query, `public.undo_student_import`):
    ```sql
    SELECT role INTO _membership
    FROM org_memberships
    WHERE org_id = _org_id AND user_id = _user_id AND status = 'active';
    IF _membership IS NULL OR _membership.role NOT IN ('owner', 'admin') THEN
      RAISE EXCEPTION 'Unauthorized: admin role required';
    END IF;
    ```
  - **The function verifies the NAMED user (`_user_id`) has admin role in `_org_id` — but never checks that the CALLER (`auth.uid()`) IS that named user.** No `IF auth.uid() != _user_id THEN RAISE` anywhere.
  - SECDEF execution mode bypasses RLS; the function runs as the function owner regardless of caller.
  - Reachable from any authenticated user via `supabase.rpc('undo_student_import', {...})` (default `EXECUTE` grants on SECDEF functions in Supabase).
  - Cascade destruction surface (function body lines 71-98): deletes from `attendance_records`, `lesson_participants`, `student_instruments`, `student_teacher_assignments`, `student_guardians`, `lessons` (orphaned-by-import-only), `recurrence_rules`; soft-deletes `students` for the given `import_batch_id` within `_org_id`.
  - Class match to PI-08 (`record_stripe_payment` accepts `_org_id` parameter without verifying caller's membership) — see `STATUS.md` §5.1.
- **Impact:**
  - Authenticated-bypass triggering destructive cascade deletion. Authenticated user with knowledge of an admin's `user_id` UUID + an `import_batch_id` UUID can trigger cascade deletion of student/attendance/lesson/recurrence data.
  - UUID-leak surfaces exist: admin `user_id` may appear in shared metadata (action proposals, audit log entries returned to UI), `batch_id` appears in `StudentsImport` URL history and in `audit_log` rows for `entity_type='import'`. Realistically observable to any authenticated user.
  - Cross-org destruction is not recoverable like cross-org misallocation (PI-08) — soft-deleted students can be restored, but cascade-deleted attendance/lessons/recurrences require manual recreation.
  - Aligns with `PLAN.md` §4 Critical rubric: security exposure + data loss + first-encounter trust erosion (single API call from a hostile or buggy actor can destroy a term's worth of an org's data).
- **Fix surface:**
  - Single-line change inside function body: add `IF auth.uid() != _user_id THEN RAISE EXCEPTION 'auth.uid() must match _user_id parameter'; END IF;` immediately before the existing membership lookup. Better: drop the `_user_id` parameter entirely and use `auth.uid()` directly throughout (matches the modern pattern in `confirm_makeup_booking`, `generate_invoices_from_template`, etc.).
  - Cross-cutting #4 / #7 codemod: every SECDEF RPC in batches 02-21 that accepts `_user_id` / `_org_id` / `_guardian_id` / `_teacher_id` / `_student_id` parameters gets the same audit treatment. CI script rule #3 catches future occurrences.
- **Decision needed:** No (mechanical fix, no UX trade-off).
- **Target sprint:** TBD (recommend bundle with PI-08 fix as "SECDEF parameter-spoofing codemod" Phase C sprint)
- **Closure:** (empty)

### F-01-004 — `account-delete` 3-step deletion has no transaction; partial failure leaves orphan auth user

- **Severity:** High
- **Area:** auth-edge-fn
- **Evidence:**
  - [`supabase/functions/account-delete/index.ts:86-116`](../../supabase/functions/account-delete/index.ts) — sequence: (1) delete `org_memberships` (line 87-95), (2) delete `profile` (line 98-106), (3) `supabaseAdmin.auth.admin.deleteUser` (line 109-116).
  - Three writes hit three different layers: `public` schema via service-role client (steps 1, 2), Supabase Auth API via admin client (step 3). No transaction can span Auth API + DB.
  - If step 3 fails after steps 1+2 succeed (e.g. Auth API transient failure, network blip mid-deploy), the auth user still exists but has no profile/memberships. The function returns 500 "Internal server error" with no rollback.
  - Caller cannot retry safely — re-invoking the function fails at step 2 (no profile to delete, the maybeSingle returns null but the `.delete().eq('id', user.id)` would just return zero rows; actually no error). Step 3 retries cleanly. So retry is convergent but the catch block doesn't issue a retry signal — just returns 500.
  - **GDPR Article 17 / 5(1)(d) dimension** (carry from your Phase 2 note): if the user invoked account-delete as a right-to-erasure request and the auth account survives step 3's failure, the org has technically failed to fulfil the deletion request. Partial-fulfilment is hard to defend if a regulator asks.
- **Impact:**
  - Silent broken state. Auth user exists with no DB footprint. They can technically still log in via Supabase Auth (their JWT still validates) but every subsequent app interaction fails (no profile, no membership, every RLS-gated query returns 0 rows).
  - Compliance risk on GDPR right-to-erasure requests.
  - Class match with F-01-002 (AcceptInvite signUpAndAccept) and F-01-006 (invite-accept teacher/guardian) — multi-step write rollback discipline, cross-cutting #1.
- **Fix surface:**
  - Reverse step order: call `auth.admin.deleteUser(user.id)` FIRST. If FK cascade is configured on `profiles.id → auth.users.id` and `org_memberships.user_id → auth.users.id`, the delete cascades and steps 1+2 are unnecessary. If cascade is not configured (verify by querying `pg_constraint`), add the cascades.
  - Alternative: keep step order but add a try/catch around step 3 that on failure REVERSES steps 1+2 by re-inserting the captured rows (compensating action pattern). Heavier.
- **Decision needed:** No.
- **Target sprint:** TBD (recommend "multi-step write rollback discipline" Phase C sprint with F-01-002 + F-01-006 + F-01-030)
- **Closure:** (empty)

### F-01-005 — `get_parent_lesson_notes` SECDEF RPC under-returns vs `lesson_notes_parent_select` RLS policy on group-lesson notes

- **Severity:** High
- **Area:** rls + secdef (duplicate-path divergence)
- **Evidence:**
  - RLS policy `lesson_notes_parent_select` (Phase 5 `pg_policies` query, lesson_notes table):
    ```
    ((parent_visible = true) AND is_org_member(auth.uid(), org_id) AND (
      ((student_id IS NOT NULL) AND (student_id IN (
        SELECT sg.student_id FROM student_guardians sg JOIN guardians g ON g.id = sg.guardian_id WHERE g.user_id = auth.uid()
      )))
      OR
      ((student_id IS NULL) AND (EXISTS (
        SELECT 1 FROM lesson_participants lp JOIN student_guardians sg ON sg.student_id = lp.student_id JOIN guardians g ON g.id = sg.guardian_id
        WHERE lp.lesson_id = lesson_notes.lesson_id AND g.user_id = auth.uid()
      )))
    ))
    ```
    Policy handles BOTH paths: `student_id IS NOT NULL` (per-student note) AND `student_id IS NULL` (group-lesson whole-lesson note via `lesson_participants`).
  - SECDEF RPC body (Phase 7 `pg_get_functiondef`, `get_parent_lesson_notes`):
    ```sql
    RETURN QUERY
      SELECT ln.id, ln.lesson_id, ln.student_id, ...
      FROM lesson_notes ln
      WHERE ln.org_id = p_org_id
        AND ln.parent_visible = true
        AND ln.student_id = ANY(
          SELECT sg2.student_id FROM student_guardians sg2
          JOIN guardians g2 ON g2.id = sg2.guardian_id
          WHERE g2.user_id = auth.uid() AND sg2.student_id = ANY(p_student_ids)
        );
    ```
    The `ln.student_id = ANY(...)` clause **excludes rows where `student_id IS NULL`** by definition. Group-lesson whole-lesson notes are silently filtered out.
  - Spot-check (Phase 9): parent flow uses the RPC path via `useParentLessonNotes` (`useLessonNotes.ts:113-129`, used at `PortalSchedule.tsx:124`). **Currently masked by F-01-001's parameter mismatch (RPC errors out before returning any rows); becomes user-visible once F-01-001 is fixed.**
- **Impact:**
  - Once F-01-001 is fixed, parents will see per-student notes but NOT group-lesson whole-lesson notes (`student_id IS NULL` notes attached to a group lesson via lesson_participants). For a studio running ensemble / theory / group classes, group notes are a meaningful surface — silently invisible to parents.
  - Class concern (cross-cutting #5): every table with both a direct RLS policy AND a SECDEF RPC for the same role audience is at risk of drift between the two.
- **Fix surface:**
  - Update `get_parent_lesson_notes` body to add a second branch matching the policy's group-lesson path:
    ```sql
    AND (
      ln.student_id = ANY(<guardian's student_id list>)
      OR (
        ln.student_id IS NULL
        AND EXISTS (
          SELECT 1 FROM lesson_participants lp
          JOIN student_guardians sg ON sg.student_id = lp.student_id
          JOIN guardians g ON g.id = sg.guardian_id
          WHERE lp.lesson_id = ln.lesson_id AND g.user_id = auth.uid()
        )
      )
    )
    ```
  - **Must be bundled with F-01-001 fix.** Fixing F-01-001 alone ships a different bug (parent sees notes for the first time but missing group-lesson notes); fixing F-01-005 alone has no observable effect (RPC still errors out before its body runs). Phase C ticket: both together.
- **Decision needed:** No.
- **Target sprint:** TBD (bundle with F-01-001 in parent-portal sprint)
- **Closure:** (empty)

### F-01-006 — `invite-accept` silently `console.error`s and continues on teacher/guardian creation failures

- **Severity:** High
- **Area:** auth-edge-fn
- **Evidence:**
  - [`supabase/functions/invite-accept/index.ts:175-177`](../../supabase/functions/invite-accept/index.ts) — teacher INSERT failure handler: `if (teacherError) { console.error(...); }`. No `throw` or early `return`. Flow proceeds to org_membership upsert at line 182-185.
  - [`supabase/functions/invite-accept/index.ts:212-217`](../../supabase/functions/invite-accept/index.ts) — guardian INSERT failure handler: `if (guardianError) { console.error(...); } else { guardianId = newGuardian.id; }`. On guardian failure, `guardianId` is undefined → the student_guardian link block (line 220-238) is skipped (`if (guardianId && invite.related_student_id)`). Membership has already been written.
  - Resulting silent broken states:
    - Teacher invite path: `org_membership.role='teacher'` exists with no corresponding `teachers` row. RLS policies that join through `teachers` (e.g. `is_lesson_teacher`, `get_teacher_id_for_user`) return null/false. Teacher logs in, has 'teacher' role, but can't be assigned to lessons or have notes/availability.
    - Parent invite path: `org_membership.role='parent'` exists with no `guardians` row (and no `student_guardians` link). Parent logs in, sees parent portal, but `is_parent_of_student` returns false everywhere → no children visible, no invoices visible.
- **Impact:**
  - First-encounter trust erosion for invited users. Account creation reports success; portal is blank. User assumes the system is broken.
  - Silent failure mode — `console.error` goes to Supabase function logs only, no Sentry breadcrumb, no error response to caller (function returns 200).
  - Same class as F-01-002 (AcceptInvite) and F-01-004 (account-delete) — multi-step write rollback discipline. Cross-cutting #1.
- **Fix surface:**
  - Replace `console.error` with `throw teacherError` / `throw guardianError` so the outer catch (line 258-264) returns 500 to the page, which then surfaces an error toast via `AcceptInvite.tsx:267-272`.
  - Or implement compensating action: roll back the partial writes (delete teacher row if created, delete guardian row if created) before throwing.
  - Cleanest: wrap the whole sequence in a SECDEF RPC `accept_invite_atomic(token)` so all writes execute in a single DB transaction with PostgreSQL's rollback-on-error semantics. The auth.admin.deleteUser step is moot since invite-accept doesn't create auth users.
- **Decision needed:** No.
- **Target sprint:** TBD (bundle with F-01-002 + F-01-011 in invite-flow sprint)
- **Closure:** (empty)

### F-01-007 — `AuthContext.signUp` duplicate-email obfuscation defeat enables email enumeration

- **Severity:** High
- **Area:** session (auth context)
- **Evidence:**
  - [`src/contexts/AuthContext.tsx:379-386`](../../src/contexts/AuthContext.tsx):
    ```ts
    // Detect Supabase's duplicate email obfuscation:
    // When "Confirm email" is ON and the email already exists,
    // Supabase returns success but with identities: []
    if (!error && data?.user?.identities?.length === 0) {
      return {
        error: new Error('An account with this email may already exist. Please try logging in or resetting your password.'),
      };
    }
    ```
  - Supabase's design intent (with "Confirm email" ON) is to return success-with-empty-`identities` when the email already exists — deliberately preventing enumeration. AuthContext detects this and converts to a definitive "exists" message.
  - Compare with `signIn` (line 395-408): SEC-AUTH-03 enumeration normalisation collapses every "user not found" / "wrong password" / "invalid credentials" Supabase variant into a single `Invalid email or password`. `signIn` is hardened; `signUp` is the bypass.
  - Repro: any unauthenticated visitor opens `/signup`, submits with a real user's email + any password. If the email is registered, gets the "may already exist" message. If not, gets the "Check your email" success card.
- **Impact:**
  - GDPR-shaped — leaks personal-data existence to anyone with a guess. Reveals which of N candidate emails are registered LessonLoop users.
  - Compounded with F-01-002: invited users who get caught in the AcceptInvite signUp+invite-accept partial-failure path (orphan auth account) then try a fresh signup and get this leak as confirmation that "yes, that email is taken" — confusing recovery story.
- **Fix surface:**
  - Remove the obfuscation-defeat branch (lines 379-386). Let Supabase's empty-identities response pass through as success. The UI flow becomes: typed-existing-email → "Check your email" card → user never receives an email → they figure it out from "didn't get the email? Try Forgot Password instead."
  - Trade-off acknowledged: legitimate users who mistype-into-existing-email get a confusing silent-success experience. Security wins over UX for an enumeration vector affecting all users.
- **Decision needed:** **YES (`decision_needed: true`).** Phase C sprint planning includes a Jamie conversation. The fix is a single-branch deletion; the UX cost is real (users who mistype the email don't know why they got no verification email). Likely outcome per `PLAN.md` §4 severity rubric: security > UX for an enumeration vector. Worth surfacing.
- **Target sprint:** TBD (recommend "email-enumeration class" Phase C sprint per cross-cutting #3)
- **Closure:** (empty)

### F-01-008 — `ResetPassword` enforces only minLength; no strength score (inconsistent with Signup)

- **Severity:** Medium
- **Area:** auth-pages
- **Evidence:**
  - [`src/pages/Signup.tsx:121-128`](../../src/pages/Signup.tsx) requires `getPasswordScore(password) >= 2` before submission.
  - [`src/pages/ResetPassword.tsx:75-78`](../../src/pages/ResetPassword.tsx) enforces only `password.length >= PASSWORD_MIN_LENGTH`. No `getPasswordScore` call.
  - `AuthContext.resetPassword` wrapper (`AuthContext.tsx:444-449`) is a passthrough to `supabase.auth.resetPasswordForEmail`; no strength check there either.
  - Server-side HIBP check + Supabase min-length enforcement apply via Auth platform config (verified Phase 8 legacy: `2026-05-08-supabase-auth-tightening-pre-launch.md`).
- **Impact:**
  - Inconsistency: signup demands stronger passwords than password reset. A user can sign up with a strong password, then reset it to a weaker (length-compliant but score < 2) password.
  - **Security boundary held by server-side HIBP**, so this is UI-consistency only.
- **Fix surface:** Add `if (getPasswordScore(password) < 2)` toast-and-return block to `ResetPassword.tsx` between line 78 and 80, matching `Signup.tsx:121-128`.
- **Decision needed:** No.
- **Target sprint:** TBD (small; bundle with auth-pages polish sprint)
- **Closure:** (empty)

### F-01-009 — `Login` OAuth callback strips `?redirect=` query param

- **Severity:** Medium
- **Area:** auth-pages
- **Evidence:**
  - [`src/pages/Login.tsx:51`](../../src/pages/Login.tsx) — inside the OAuth-callback timeout effect: `window.history.replaceState({}, '', '/login');`. Any `?redirect=` query param that came with the original login link is overwritten.
  - The OAuth helper at line 60-72 sets `redirect_uri: ${origin}/login` — doesn't preserve the original `redirect` param.
  - Compare with `RouteGuard.PublicRoute` (`RouteGuard.tsx:245-254`): for password login, the `from` state is preserved via `Navigate state={{ from: location }}`. OAuth path bypasses this.
- **Impact:** Marketing or in-app links of the form `/login?redirect=/protected/page` — user signs in via Google/Apple OAuth, lands on default `/dashboard` instead of the requested page. Annoying; user navigates manually.
- **Fix surface:** capture `redirect` query param in component state before the OAuth flow; pass it as part of the OAuth `redirect_uri` (e.g. `${origin}/login?redirect=${encoded}`); restore via `Navigate state` after OAuth callback resolves.
- **Decision needed:** No.
- **Target sprint:** TBD.
- **Closure:** (empty)

### F-01-010 — `Login` OAuth 10-second timeout error message non-specific

- **Severity:** Medium
- **Area:** auth-pages
- **Evidence:** [`src/pages/Login.tsx:44-52`](../../src/pages/Login.tsx) — `setTimeout(() => { setIsOAuthCallback(false); toast({ title: 'Sign in timed out', description: 'Please try again.', ... }) }, 10000);`. No discrimination between popup blocked, OAuth provider non-response, malformed callback, or genuine network failure.
- **Impact:** User who can't sign in via OAuth gets the same generic message regardless of cause. Support burden + frustration.
- **Fix surface:** discriminate based on signals available (window.opener state, URL hash content, navigator.onLine, etc.) and surface actionable messages.
- **Decision needed:** No.
- **Target sprint:** TBD.
- **Closure:** (empty)

### F-01-011 — `invite-accept` idempotency analysis (paired with F-01-002)

- **Severity:** Medium (informational; positive — function IS recoverable)
- **Area:** auth-edge-fn
- **Evidence:** Phase 2 analysis of `invite-accept/index.ts` body:
  - **(a) Token consumption at END of function** (line 242 `update({ accepted_at: ... })`) — good: transient mid-flow failures don't burn the token.
  - **(b) Idempotency on retry** — verified: org_membership upsert (line 182-185), existing-teacher check before insert (line 120-178), existing-guardian check before insert (line 188-217), existing student_guardian-link check before insert (line 220-238). All convergent.
  - **(c) Page retry path** — works only if user refreshes (then `if (user)` branch at `AcceptInvite.tsx:317` renders accept-invitation UI). NO in-page retry button on the error toast catch.
- **Impact:** Recovery exists but is non-obvious. Combined with F-01-002 + F-01-006, the remediation surface is clear: page-side retry button + server-side documentation of convergence + fix F-01-006's silent error swallowing.
- **Fix surface:** documentation only (no code change to invite-accept itself). Bundle the finding's analysis into the F-01-002 fix PR description.
- **Decision needed:** No.
- **Target sprint:** TBD (bundle with F-01-002 + F-01-006).
- **Closure:** (empty)

### F-01-012 — `gdpr-export` silently truncates at 50,000 rows per table

- **Severity:** Medium
- **Area:** auth-edge-fn
- **Evidence:** [`supabase/functions/gdpr-export/index.ts:23-26`](../../supabase/functions/gdpr-export/index.ts) — inside `fetchAll`: `if (allRows.length > 50000) { console.warn(...); break; }`. The warn only goes to function logs; the caller receives the partial dataset without any `truncated: true` marker. Response payload at line 119-148 lacks a per-table count metadata that would let the caller detect truncation.
- **Impact:** GDPR Article 15 (right of access) compliance risk. A data subject requesting their full data export from a large org receives an incomplete export with no indication of the gap. Org admin downloading their own org's export sees only 50k rows per table.
- **Fix surface:** Add `truncated: boolean` and `total_count: integer` to the per-table metadata in the response. Better: stream to storage + return signed URL (see F-01-013 — same fix).
- **Decision needed:** No.
- **Target sprint:** TBD (bundle with F-01-013 + F-01-027 as GDPR-export reliability sprint per cross-cutting #2).
- **Closure:** (empty)

### F-01-013 — `gdpr-export` response payload size unbounded

- **Severity:** Medium
- **Area:** auth-edge-fn
- **Evidence:** [`supabase/functions/gdpr-export/index.ts:119-148`](../../supabase/functions/gdpr-export/index.ts) — builds `exportData` object containing 5 CSV strings inline and returns as `JSON.stringify(exportData)`. For a 50k-students-per-table org (the cap from F-01-012), payload could exceed 100MB. Likely exceeds Supabase Edge Function response-size limits or hits Deno memory limits.
- **Impact:** Large orgs requesting GDPR export get a 5xx or stalled connection — silent failure of the right-to-access feature.
- **Fix surface:** stream each CSV to `storage.invoice-pdfs` (or a new `gdpr-exports` bucket); return JSON with signed download URLs per table. Standard pattern.
- **Decision needed:** No.
- **Target sprint:** TBD (bundle with F-01-012 + F-01-027).
- **Closure:** (empty)

### F-01-014 — Stale `roles` array after mid-session role revocation

- **Severity:** Medium
- **Area:** session (auth context)
- **Evidence:**
  - [`src/contexts/AuthContext.tsx:310-313`](../../src/contexts/AuthContext.tsx) — `if (initialisedRef.current && profileIdRef.current === newSession.user.id) { logger.debug('Already initialised with same user - skipping refetch'); return; }` — guards against duplicate fetches but ALSO prevents the role refetch path on `SIGNED_IN` events when the user is the same.
  - If admin role is revoked while user is logged in (e.g. removed from org_membership table by another admin), the in-memory `roles` array retains the stale value. Next `SIGNED_IN` event won't refetch (same-user skip). Refresh only happens on full sign-out / sign-in OR on JWT-expiry-forces-refresh.
- **Impact:**
  - UI continues to show admin-only navigation, controls, settings tabs for the revoked admin. RLS server-side prevents actual DB writes/reads — security boundary holds.
  - UX-only confusion: clicks succeed-then-fail (UI shows the button but the action errors). Internal-trust concern.
- **Fix surface:** add a periodic role refresh (e.g. every 5 min) OR add a realtime subscription on `org_memberships` keyed by `user_id` so revocation triggers a re-fetch. Simpler: rely on the existing `OrgContext` realtime subscription (`OrgContext.tsx:250-272`) which already invalidates on org row changes; add similar for membership row changes.
- **Decision needed:** No.
- **Target sprint:** TBD.
- **Closure:** (empty)

### F-01-015 — Org switch does not invalidate TanStack Query cache

- **Severity:** Medium
- **Area:** session (org context, cross-batch with 02-org-management)
- **Evidence:**
  - [`src/contexts/OrgContext.tsx:274-288`](../../src/contexts/OrgContext.tsx) — `setCurrentOrg` updates state + writes `profile.current_org_id`. Never calls `queryClient.invalidateQueries()` or `queryClient.clear()`.
  - Most query keys include `orgId` (verified Phase 5 — `invoice-stats`, `lesson-notes`, etc.) so the cache is keyed correctly. But stale results from the previous org persist in the cache and remain reachable.
  - Native-resume path (`App.tsx:144-172`) DOES call wholesale `queryClient.invalidateQueries()`. Pattern exists; just not applied at org switch.
- **Impact:**
  - RLS prevents actual data leak (RLS scopes everything by current org_id at query time).
  - Cached display data from previous org may briefly flash on-screen until the new org's query runs. Confusing UX.
  - Memory growth over multiple org switches.
- **Fix surface:** add `queryClient.invalidateQueries()` (or scoped `queryClient.removeQueries()`) inside `setCurrentOrg` after `setCurrentOrgState`. Cross-batch concern noted to 02-org-management.
- **Decision needed:** No.
- **Target sprint:** TBD (recommend 02-org-management Phase B audit to deepen, then Phase C fix).
- **Closure:** (empty)

### F-01-016 — 6-second auth-init hard timeout can force-finalise with `user=null` on slow networks

- **Severity:** Medium
- **Area:** session
- **Evidence:** [`src/contexts/AuthContext.tsx:203-210`](../../src/contexts/AuthContext.tsx) — hard timeout: `if (mountedRef.current && !initialisedRef.current) { setIsLoading(false); setIsInitialised(true); initialisedRef.current = true; }`. If `getSession()` + profile/roles fetch takes > 6s on a slow network, the timeout fires before completion, leaving `user=null`. RouteGuard then redirects to `/login` even though a valid stored session exists.
- **Impact:** Slow-network users (poor mobile signal, slow proxy) get spurious sign-outs on initial page load. The self-healing recovery effect at line 179-196 doesn't help because it only fires when `user` is non-null but `profile` is null.
- **Fix surface:** distinguish between "session genuinely null" and "session not yet fetched". On hard timeout, fall through to a longer-running fetch with the AuthLoading UI still up (the `AuthLoading` component already has an 8s force-redirect at `RouteGuard.tsx:23`). Alternative: extend hard timeout to match slow-network 95th percentile (e.g. 12s).
- **Decision needed:** No.
- **Target sprint:** TBD.
- **Closure:** (empty)

### F-01-017 — UPDATE/ALL policies on ~50 tables lack explicit `WITH CHECK` clause

- **Severity:** Medium
- **Area:** rls (cluster finding)
- **Evidence:**
  - Phase 5 `pg_policies` query for UPDATE/ALL policies with `qual IS NOT NULL AND with_check IS NULL` returned 60+ rows across ~50 tables.
  - PostgreSQL default: when `WITH CHECK` is omitted, `USING` is reused for the new-row check (verified via `CREATE POLICY` documentation).
  - Default correctly mitigates gross cross-tenant move (admin in org X cannot UPDATE a row's `org_id` to org Y unless also admin in Y, because USING-as-WITH-CHECK re-fires against the new row).
  - What the default does NOT catch: **FK-column tampering** — admin can change `student_id`, `teacher_id`, `guardian_id`, `lesson_id` etc. to UUIDs from another org. Row's own `org_id` stays put so RLS passes, but referential integrity drifts across tenants.
  - Mitigated for org_id specifically on 8 tables via `prevent_org_id_change` trigger (lessons, lesson_notes, invoices, payments, students, guardians, teachers, org_memberships). FK-other-column mutations are not trigger-protected.
  - Affected tables (cluster — full list in evidence): ai_action_proposals, ai_conversations, attendance_records, availability_blocks, availability_templates, billing_runs, booking_page_*, calendar_*, closure_dates, enrolment_waitlist, guardian_payment_preferences, guardians*, instruments, invites, invoice_items*, invoices*, lead_*, lesson_*, lessons*, locations, make_up_*, message_*, notification_preferences, org_messaging_settings, organisations, payment_notifications, payments*, practice_*, profiles*, rate_cards, recurrence_rules, resource_*, resources, rooms, student_*, students*, teachers*, term_*, terms, time_off_blocks. (*) = also covered by `prevent_org_id_change` trigger for org_id specifically.
- **Impact:** Reliance on PG implicit default is fragile (semantic has held for decades but is undocumented in our codebase). Explicit-best-practice violated at scale. FK-tampering is a real (if narrow, admin-only) vector.
- **Fix surface:**
  - Add explicit `WITH CHECK <same as USING>` to every UPDATE/ALL policy. Mechanical refactor — codemod over the policy SQL set.
  - For policies where WITH CHECK should be STRICTER than USING (state transitions with bounded value sets — e.g. `make_up_waitlist` parent UPDATE already does this correctly at status=ANY(['accepted','declined','waiting'])), those already have explicit WITH CHECK; F-01-017 is about the rest.
  - Bundle in Phase C "RLS hardening" sprint with F-01-031 (helper-style consistency) + F-01-036 (SECDEF pinning) + F-01-003 (parameter-spoofing codemod).
- **Decision needed:** No.
- **Target sprint:** TBD (RLS hardening Phase C sprint).
- **Closure:** (empty)

### F-01-018 — `ResetPassword` post-success navigates to `/dashboard` regardless of onboarding state

- **Severity:** Low
- **Area:** auth-pages (Phase 4 settled — cosmetic; route guard catches)
- **Evidence:** [`src/pages/ResetPassword.tsx:92-94`](../../src/pages/ResetPassword.tsx) — `setTimeout(() => navigate('/dashboard'), 2000)` after password update success. No check on `profile?.has_completed_onboarding`.
- **Impact:** Pre-onboarded user resetting password gets sent to `/dashboard` instead of `/onboarding`. `RouteGuard` at `/dashboard` (`RouteGuard.tsx:174-176`) auto-corrects to `/onboarding`. Parent role auto-corrects to `/portal/home`. Cosmetic wasted-hop only.
- **Fix surface:** read `profile` from `useAuth()`; navigate to `'/onboarding'` if `!profile.has_completed_onboarding`, `/portal/home` if `currentRole === 'parent'`, else `/dashboard`. Or just trust the RouteGuard (no fix needed).
- **Decision needed:** No.
- **Target sprint:** TBD (low-priority polish).
- **Closure:** (empty)

### F-01-019 — `VerifyEmail` auto-poll runs every 5 seconds with no backoff or max retries

- **Severity:** Low
- **Area:** auth-pages
- **Evidence:** [`src/pages/VerifyEmail.tsx:30-40`](../../src/pages/VerifyEmail.tsx) — `setInterval(async () => { ... }, 5000)`. Bounded only by component unmount or successful verification. No exponential backoff.
- **Impact:** User stuck on page for an hour racks up 720 `auth.getUser` calls. Minor backend load; negligible cost.
- **Fix surface:** add exponential backoff (5s → 10s → 20s → 60s cap) and a max-retry counter that surfaces an explicit "still waiting? Resend the email" CTA after N tries.
- **Decision needed:** No.
- **Target sprint:** TBD.
- **Closure:** (empty)

### F-01-020 — `VerifyEmail` navigates to `/onboarding` always after verification (cosmetic — Onboarding self-bounces)

- **Severity:** Low (Phase 9 spot-check settled MEDIUM → LOW)
- **Area:** auth-pages
- **Evidence:**
  - [`src/pages/VerifyEmail.tsx:36, 65`](../../src/pages/VerifyEmail.tsx) — both auto-poll success (line 36) and manual "I've verified" check (line 65) navigate to `/onboarding` unconditionally.
  - [`src/pages/Onboarding.tsx:46-50`](../../src/pages/Onboarding.tsx) — auto-bounces `profile?.has_completed_onboarding` users to `/dashboard` (with `?new=true` exception). Secondary safety net at lines 52-74 routes users with existing memberships to `/dashboard` or `/portal/home`.
- **Impact:** Returning user re-verifying email (e.g. email change) gets sent to `/onboarding` which immediately bounces them. Wasted-hop UX only.
- **Fix surface:** in `VerifyEmail.tsx`, check `profile?.has_completed_onboarding` and navigate to `/dashboard` (or `/portal/home` for parents) for already-onboarded users; only navigate to `/onboarding` for genuinely-new users. Or trust Onboarding's own bounce (no fix needed).
- **Decision needed:** No.
- **Target sprint:** TBD.
- **Closure:** (empty)

### F-01-021 — `Index.tsx` is Lovable-default placeholder content; orphaned (route `/` uses `AuthRedirect`)

- **Severity:** Low
- **Area:** auth-pages
- **Evidence:**
  - [`src/pages/Index.tsx`](../../src/pages/Index.tsx) — content is "Welcome to Your Blank App" / "Start building your amazing project here!". Header comment line 1 confirms: "Update this page (the content is just a fallback if you fail to update the page)".
  - [`src/config/routes.ts:188`](../../src/config/routes.ts) — route `/` resolves to `AuthRedirect`, not `Index`. The Index file is not imported from any route.
- **Impact:** Dead code in `src/pages/`. Signals neglect to anyone browsing the codebase; tiny build-size cost; no user impact.
- **Fix surface:** delete `src/pages/Index.tsx`. Update `CENSUS.md` §2.1 to remove the entry (pages count: 89 → 88).
- **Decision needed:** No.
- **Target sprint:** TBD (dead-code-cleanup; bundle with V2 plan §3.3 cut items like `migration-dump`).
- **Closure:** (empty)

### F-01-022 — `NotFound.tsx` action buttons link to auth-protected routes

- **Severity:** Low
- **Area:** auth-pages
- **Evidence:** [`src/pages/NotFound.tsx:48-58`](../../src/pages/NotFound.tsx) — buttons link to `/dashboard`, `/calendar`, `/help`. All are `protected` routes per `routes.ts`. Unauthenticated visitors clicking any of them get redirected to `/login`.
- **Impact:** Unauthenticated visitor lands on 404 → tries to navigate "home" → ends at `/login`. Functional but unhelpful. No unauthenticated-friendly path (e.g. link to the marketing site root).
- **Fix surface:** add a conditional render based on `useAuth().user` — show /dashboard etc. when authed; show /login + external `lessonloop.net` link when not.
- **Decision needed:** No.
- **Target sprint:** TBD.
- **Closure:** (empty)

### F-01-023 — Lovable wrapper used inconsistently with direct supabase.auth calls

- **Severity:** Low
- **Area:** auth-pages (V2 plan §0 — Lovable retirement queued)
- **Evidence:**
  - `Login.tsx:14, 60, 78` and `Signup.tsx:14, 54, 72` use `lovable.auth.signInWithOAuth(...)` (from `@/integrations/lovable`) for social OAuth.
  - Every other auth operation uses `supabase.auth` directly or via `AuthContext` (`signIn`, `signUp`, `resetPassword`, `signOut`, `resend`).
- **Impact:** Architectural inconsistency. The Lovable preview platform is being retired (V2 plan §0). The 7 `lovable.auth.signInWithOAuth` references (4 in Login.tsx + 3 in Signup.tsx via Google + Apple paths) need migration to `supabase.auth.signInWithOAuth` before Lovable goes away. Currently functional.
- **Fix surface:** replace `lovable.auth.signInWithOAuth(provider, opts)` with `supabase.auth.signInWithOAuth({ provider, options: { redirectTo: opts.redirect_uri }})` across the 7 sites. Remove the `@/integrations/lovable` import and the integration file once unused.
- **Decision needed:** No (timing-coordinated with V2 plan Lovable retirement).
- **Target sprint:** TBD (bundle with Lovable retirement sprint).
- **Closure:** (empty)

### F-01-024 — Resend pattern inconsistency (Signup/VerifyEmail bypass AuthContext)

- **Severity:** Low
- **Area:** auth-pages
- **Evidence:**
  - `Signup.tsx:147` calls `supabase.auth.resend({ type: 'signup', email })` directly.
  - `VerifyEmail.tsx:46-50` calls `supabase.auth.resend({ type: 'signup', email })` directly.
  - `signIn` / `signUp` / `resetPassword` / `signOut` all route through `AuthContext` for consistency.
- **Impact:** Two paths to the same backend call. If `AuthContext` ever adds shared logging/rate-limit/Sentry-breadcrumb to auth operations, the direct calls bypass it. Architectural drift only.
- **Fix surface:** add `resendVerification(email)` method to `AuthContextType`; route both call sites through it.
- **Decision needed:** No.
- **Target sprint:** TBD (bundle with auth-pages polish sprint).
- **Closure:** (empty)

### F-01-025 — `Login` error mapping uses brittle string-match against Supabase error messages

- **Severity:** Low
- **Area:** auth-pages
- **Evidence:** [`src/pages/Login.tsx:125-129`](../../src/pages/Login.tsx) — `error.message?.toLowerCase().includes('invalid login credentials')` and `.includes('email not confirmed')`. Supabase wording changes silently break the user-friendly mapping.
- **Impact:** Future Supabase SDK upgrade with reworded error strings → user sees raw Supabase error instead of the friendly mapping. Minor UX regression risk.
- **Fix surface:** match on `error.code` if available (Supabase error responses often include a stable `code` field) rather than `message`. Or maintain a unit test that asserts current Supabase error format matches expectations.
- **Decision needed:** No.
- **Target sprint:** TBD.
- **Closure:** (empty)

### F-01-026 — Email handling inconsistency (trim vs trim+lowercase across pages)

- **Severity:** Low
- **Area:** auth-pages
- **Evidence:**
  - `Login.tsx:96` — `email.trim()` only.
  - `Signup.tsx:90` — `email.trim()` only.
  - `AcceptInvite.tsx:179` — `signupEmail.trim().toLowerCase()`.
  - `AuthContext.signIn` (line 392) and `signUp` (line 369) — both `email.trim().toLowerCase()` (the canonical form).
- **Impact:** Supabase Auth normalises server-side, so functional behaviour is identical. Visual inconsistency in the form-submission code. No bug.
- **Fix surface:** apply `.trim().toLowerCase()` everywhere a user-typed email is sent to AuthContext or Supabase. Single sweep.
- **Decision needed:** No.
- **Target sprint:** TBD.
- **Closure:** (empty)

### F-01-027 — `gdpr-export` lacks rate limit

- **Severity:** Low
- **Area:** auth-edge-fn
- **Evidence:** [`supabase/functions/gdpr-export/index.ts`](../../supabase/functions/gdpr-export/index.ts) — no `checkRateLimit` call. Compare with `gdpr-delete` which has 5/5min rate limit (`gdpr-delete/index.ts:47`).
- **Impact:** Expensive fn (5 × `fetchAll` reads with 50k-row cap). Owner/admin role gate is the only barrier. A buggy admin client could spin the fn in a tight loop.
- **Fix surface:** add `checkRateLimit(user.id, 'gdpr-export', { maxRequests: 5, windowMinutes: 5 })` after user verification and before profile/membership check.
- **Decision needed:** No.
- **Target sprint:** TBD (bundle with F-01-012 + F-01-013 GDPR-export reliability sprint).
- **Closure:** (empty)

### F-01-028 — `ForgotPassword` lacks email regex validation (inconsistent with Login)

- **Severity:** Low
- **Area:** auth-pages
- **Evidence:** `ForgotPassword.tsx:34-43` accepts any non-empty string as email; `Login.tsx:107-114` rejects malformed emails with regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`.
- **Impact:** Malformed email submits to `supabase.auth.resetPasswordForEmail` which returns an error → user sees error toast. Functional; just an extra round-trip.
- **Fix surface:** lift Login's regex into a shared util; call from ForgotPassword + AcceptInvite signup form too.
- **Decision needed:** No.
- **Target sprint:** TBD.
- **Closure:** (empty)

### F-01-029 — `NotFound.tsx` has no 404 observability

- **Severity:** Low
- **Area:** auth-pages
- **Evidence:** [`src/pages/NotFound.tsx`](../../src/pages/NotFound.tsx) — no Sentry breadcrumb, no `logger.info`, no analytics event. Bad-URL tracking for marketing/campaign hygiene is impossible.
- **Impact:** Marketing campaigns or shared links pointing at non-existent paths fail silently. No data to triage which URLs need redirects.
- **Fix surface:** add `Sentry.captureMessage('404 hit', { extra: { path: location.pathname, referrer: document.referrer }})` on mount.
- **Decision needed:** No.
- **Target sprint:** TBD.
- **Closure:** (empty)

### F-01-030 — `setCurrentOrg` fire-and-forget profile update with no error handling

- **Severity:** Low
- **Area:** session (org context)
- **Evidence:** [`src/contexts/OrgContext.tsx:283-287`](../../src/contexts/OrgContext.tsx) — `if (user) { await supabase.from('profiles').update({ current_org_id: orgId }).eq('id', user.id); }`. The `await` is present but the result is never inspected; an error would be silently dropped.
- **Impact:** If the profile UPDATE fails (RLS race, transient network failure), in-memory `currentOrg` is now ahead of persisted `profile.current_org_id`. Next session reload restores the old org. User would re-switch. Minor inconvenience.
- **Fix surface:** capture `{ error }`; on error, revert in-memory state and toast.
- **Decision needed:** No.
- **Target sprint:** TBD.
- **Closure:** (empty)

### F-01-031 — Policy style inconsistency: inline `org_memberships` subqueries vs helper functions

- **Severity:** Low
- **Area:** rls
- **Evidence:** Phase 5 `pg_policies` query — 5 policies on 3 tables use inline subqueries instead of `is_org_admin` / `is_org_staff` etc. helpers:
  - `make_up_credits` — SELECT/INSERT/UPDATE/DELETE policies all use `org_id IN (SELECT org_memberships.org_id FROM org_memberships WHERE user_id = auth.uid() AND status = 'active' AND role = ANY (ARRAY[...]))`.
  - `practice_assignments` UPDATE policy — same inline pattern with roles `['owner', 'admin', 'teacher']`.
  - `practice_logs` UPDATE policy — same.
- **Impact:** Functionally equivalent to helper-based policies (Phase 7 verified the 6 helpers are CLEAN). Visual inconsistency; query-plan stability variation (helpers are pinned `STABLE SECURITY DEFINER` so PG can memoise; inline subqueries re-evaluate per policy-check); easier-to-audit-with-greps if all org-role policies use the same helper.
- **Fix surface:** refactor the 5 policies to use `is_org_admin(auth.uid(), org_id)`, `is_org_staff(auth.uid(), org_id)`, or `has_org_role(auth.uid(), org_id, 'teacher')` as appropriate. Mechanical; bundle with F-01-017 (WITH CHECK) sprint.
- **Decision needed:** No.
- **Target sprint:** TBD (RLS hardening Phase C sprint).
- **Closure:** (empty)

### F-01-032 — `profile-ensure` `fullName` fallback `'User'` literal

- **Severity:** Low
- **Area:** auth-edge-fn
- **Evidence:** [`supabase/functions/profile-ensure/index.ts:82`](../../supabase/functions/profile-ensure/index.ts) — `const fullName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User';`. Terminal fallback to `'User'` for users lacking both metadata and email.
- **Impact:** Rare path (no Supabase-native email means SSO-only provider without name claim; not currently in scope). If hit, the user's profile has `full_name='User'` displayed across the app. Cosmetic.
- **Fix surface:** prompt the user to set their name on first login if the fallback fires.
- **Decision needed:** No.
- **Target sprint:** TBD.
- **Closure:** (empty)

### F-01-033 — `fetchRoles` 5-second timeout returns empty array; brief role-less window

- **Severity:** Low
- **Area:** session
- **Evidence:** [`src/contexts/AuthContext.tsx:79-104`](../../src/contexts/AuthContext.tsx) — `fetchRoles` race against `setTimeout(() => resolve([]), 5000)`. On timeout, `roles` is set to `[]`.
- **Impact:** User with valid session may briefly appear role-less. UI hides role-gated nav items for the render cycle until next auth state change refetches.
- **Fix surface:** distinguish "fetch failed/timeout" from "user genuinely has no roles". On timeout, set a `rolesError` flag; UI should show loading state rather than treating empty as authoritative. Or extend timeout to match `fetchProfile`'s grace period (3s grace in RouteGuard at line 74).
- **Decision needed:** No.
- **Target sprint:** TBD.
- **Closure:** (empty)

### F-01-034 — `RouteGuard` role-null fallback to `/dashboard` creates potential render-loop on permanently-broken memberships

- **Severity:** Low
- **Area:** routes
- **Evidence:** [`src/components/auth/RouteGuard.tsx:185-194`](../../src/components/auth/RouteGuard.tsx) — when `currentRole === null` after the 5s grace period + 1 retry, line 193 returns `<Navigate to="/dashboard" replace />`. If we're already on `/dashboard`, the same guard re-runs, hits the same branch, returns same navigation. React Router de-dupes; visually the user sees `AppShellSkeleton` flicker until the 8s `AuthLoading` force-redirect fires (which goes to `/onboarding` per line 122-130).
- **Impact:** Edge case affecting only users whose memberships are permanently broken (e.g. all memberships revoked between sessions, all marked status='disabled', etc.). User experiences a flicker → /onboarding redirect (self-heal attempt). Recovery exists; UX is poor.
- **Fix surface:** redirect role-null users to `/onboarding` instead of `/dashboard` in `RouteGuard.tsx:193`. Onboarding's self-heal effect (`Onboarding.tsx:55-74`) can rebuild membership if recoverable, OR show the user a clear "you've been removed from this organisation" message if not.
- **Decision needed:** No.
- **Target sprint:** TBD.
- **Closure:** (empty)

### F-01-035 — 3 RLS-on-zero-policies tables (`_spotcheck_log`, `platform_audit_log`, `stripe_webhook_events`) correctly service-role-only but rely on implicit PG deny-all

- **Severity:** Low
- **Area:** rls
- **Evidence:**
  - Phase 6 classification: all 3 tables are RLS-enabled with zero policies. PG default: deny-all to non-bypass roles.
  - `_spotcheck_log` (20 rows): only `supabase/functions/migration-dump/index.ts:189` references it; `migration-dump` is V2 plan §3.3 cut candidate. **Dead/legacy.**
  - `platform_audit_log` (5052 rows): 6 service-role edge fns write to it (`stripe-webhook` L194, `cleanup-webhook-retention` L44, `send-payment-receipt` L318, `_shared/send-invoice-email-core.ts` L571, `cleanup-invoice-pdf-orphans` L69+L156, `cron-health-watchdog` L190). Service-role-only by design.
  - `stripe_webhook_events` (586 rows): only `stripe-webhook` itself writes/reads (idempotency dedup). Service-role-only.
  - Phase 6 client-side grep: only `src/integrations/supabase/types.ts` (generated) references these names. Zero runtime references.
- **Impact:** Correct security by PG default. Documentation gap — a future dev reading `pg_policies` sees "no policies" and may misinterpret either as bug or as service-role-only without explicit signal.
- **Fix surface:**
  - Add explicit `CREATE POLICY "Deny authenticated" ON <table> FOR ALL TO authenticated USING (false)` matching the existing "Block anonymous" pattern.
  - Add `COMMENT ON TABLE <table> IS 'Service-role-only. Authenticated access intentionally blocked.';`
  - **Sub-action:** drop `_spotcheck_log` entirely in Phase C when `migration-dump` is cut per V2 plan §3.3 (bundle).
  - Cross-cutting #6 CI rule (a) catches future drift of this class (silent client-side failure if any future code references a zero-policy table).
- **Decision needed:** No.
- **Target sprint:** TBD (bundle with batch 19 CI script deliverable).
- **Closure:** (empty)

### F-01-036 — 7 unpinned SECDEF functions lack explicit `SET search_path = 'public'` pin

- **Severity:** Low
- **Area:** secdef
- **Evidence:**
  - Phase 7 `pg_proc` query — 7 functions are `prosecdef=true` but have NULL `proconfig`: `auto_issue_credit_on_absence`, `confirm_makeup_booking`, `generate_invoices_from_template`, `get_lesson_notes_for_staff`, `get_parent_lesson_notes`, `retry_failed_recipients`, `undo_student_import`.
  - All 7 reference `public.*` tables unqualified throughout their bodies (Phase 7 reads).
  - Supabase permission model: `authenticated` and `anon` roles **cannot CREATE TABLE in any schema** (only `service_role` and `postgres` have schema-creation privilege). Search-path injection requires the attacker to create a shadow table in a schema earlier in the search_path, which they can't do.
  - Not practically exploitable; defence-in-depth gap only.
- **Impact:** Inconsistent with the other 136 SECDEF functions which ARE pinned. Future schema changes or a Supabase platform change could elevate the risk if the permission model relaxes. Audit clarity gap.
- **Fix surface:** `ALTER FUNCTION public.<name>(...) SET search_path = 'public';` for each of the 7. Migration adds the pins. Or rewrite the function bodies to schema-qualify every reference (more invasive but stronger).
- **Decision needed:** No.
- **Target sprint:** TBD (RLS-hardening Phase C sprint with F-01-017 + F-01-031).
- **Closure:** (empty)

---

## Cross-cutting concerns (to batch 19)

Eight class patterns + one CI-script deliverable, fully enumerated in the Front Matter "Cross-cutting concerns drafted for batch 19" section above. Summary index for batch 19 entry:

1. Multi-step write rollback discipline — `F-01-002`, `F-01-004`, `F-01-006`, `F-01-030` (minor)
2. GDPR export reliability cluster — `F-01-012`, `F-01-013`, `F-01-027` (+ GDPR dimension on `F-01-004`)
3. Email enumeration class — `F-01-007` (`signUp` defeats Supabase's design); signIn hardened (SEC-AUTH-03)
4. Parameter-vs-`auth.uid()` spoofing class — PI-08 + `F-01-003`
5. RLS+SECDEF duplicate-path divergence — `F-01-005`
6. "RLS-enabled, zero policies" ambiguity — `F-01-035` + PI-10
7. **CI script deliverable** `audit/scripts/check-rls-hygiene.sh` — three rules: zero-policy-table reference check + SECDEF unpinned check + parameter-spoofing SECDEF audit
8. **`(supabase.rpc as any)` / TS-bypass-cast audit pattern** — surface latent parameter-mismatch class bugs across `src/`
9. Positive reference patterns to document and lift

---

## Re-verified legacy findings

| Legacy finding | Original status | Re-verification | Verified in |
|---|---|---|---|
| `2026-05-05-public-schema-grants-missing` | fixed (critical) | **holds-as-fixed** | Phase 8: 6 sample tables (profiles, organisations, lessons, invoices, audit_log, xero_connections) — service_role + authenticated + anon all have SELECT/INSERT/UPDATE/DELETE granted. `pg_default_acl` has entries for `supabase_admin` and `postgres` grantors → future-table grants auto-apply. RLS is the actual gate (documented Supabase pattern). |
| `2026-05-06-account-delete-data-loss-event` | fixed (high) | **holds-as-fixed** | Phase 2: account-delete code unchanged, behaves as documented (delete caller's own account when called with caller's JWT — by-design contract). Fix was process-level (smoke-test harness no longer sweeps destructive fns); no code regression possible. |
| `2026-05-06-sb-secret-verify-jwt-incompatibility` | fixed (high) | **holds-as-fixed** + **settles F2d → WITHDRAWN** | Phase 8: the "24 reconfigured" list (7 service-role-Bearer + 17 cron-secret) does NOT include the 5 batch-01 fns flagged in Phase 2 (`account-delete`, `invite-accept`, `invite-get`, `gdpr-delete`, `gdpr-export`). Per the finding's category taxonomy, these 5 are category (A) end-user JWT — platform default `verify_jwt=true` + manual `getUser(token)` in body is the intentional defence-in-depth pattern. F2d was a Phase 2 framing error; resolved as Interpretation #1 (intentional). |
| `2026-05-08-authcontext-onauthstatechange-async-hang` | fixed (high) | **holds-as-fixed** | Phase 3: callback synchronous (`AuthContext.tsx:286`), DB work deferred via `setTimeout(0)` (line 323), `INITIAL_SESSION` skipped (line 292-294) to avoid double-processing. |
| `2026-05-08-supabase-auth-tightening-pre-launch` | fixed (medium) | **holds-as-fixed** | Phase 3: SEC-AUTH-03 enumeration normalisation present (`AuthContext.tsx:395-408`), SEC-AUTH-07 global signout present (line 429) with local fallback (line 431). |
| `2026-05-10-getuser-noargs-sweep` | fixed (high) | **holds-as-fixed** | Phase 2: `getUser(token)` pattern applied across all 6 batch-01 edge fns (account-delete L42, profile-ensure L34, invite-accept L48, invite-get N/A no JWT, gdpr-delete L38, gdpr-export L55). |
| `2026-05-07-calendar-oauth-callback-verify-jwt-missing` | fixed (cross-batch) | **deferred to batch 15** | Cross-batch with calendar-sync per s40 prompt §6 — batch 15 owns re-verification. |

---

## Pre-investigation findings (PI) tagged to this batch

`STATUS.md` §2 batch tracker shows batch 01 has **0 PI seeds**. No PI → F-01-NNN mapping in this batch. PIs tagged to other batches surface in their respective findings files.

---

*End of `audit/sweep/findings/01-auth-sessions-rls.md`. Status flips from In Progress → Complete at Phase 10 commit.*
