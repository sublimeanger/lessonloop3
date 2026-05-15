# Batch 12 — Messages + Notifications

**Session**: s51
**Date**: 2026-05-15
**HEAD pin**: `<s51 Phase 10 commit SHA>`
**Status**: CLOSED
**Findings allocated**: 8 (0C / 3H / 0M / 5L); F-12-001 through F-12-008

---

## §1 Batch overview

### 1.1 Surface enumeration

CENSUS attribution: **1 staff route + 1 staff page + 9 batch-12-canonical edge fns + 1 cron schedule + 1 batch-12-canonical RPC (CENSUS:624) + 8 batch-12-canonical hooks + 6 implicit-attribution-via-owning-feature-surface tables + 11 components in src/components/messages/**.

| Surface class | Count | Anchors |
|---|---|---|
| Routes (CENSUS:79) | 1 | `/messages` (owner/admin/teacher/finance) |
| Pages (CENSUS:158) | 1 | `Messages.tsx` |
| Edge functions IN-12 (CENSUS lines below) | 9 | `send-message` (CENSUS:396) + `send-bulk-message` (:394) + `send-contact-message` (:395 public) + `send-cancellation-notification` (:289) + `send-notes-notification` (:397) + `notify-internal-message` (:393) + `mark-messages-read` (:392) + `send-push` (:400) + `send-lesson-reminders` (:290 cron) |
| Edge functions OUT (closed-immutable) | 2 | `send-parent-message` (CENSUS:399 batch-11) + `send-parent-enquiry` (CENSUS:398 batch-11) |
| Cron schedules (CENSUS:915) | 1 | cron 101 — `send-lesson-reminders` hourly `0 * * * *` |
| SECDEF RPCs IN-12 | 1 | `reassign_teacher_conversations_to_owner` (CENSUS:624) — audited Phase 1 not surfaced as fresh finding |
| SECDEF RPCs OUT (closed-immutable) | 3 | `_notify_streak_milestone` (CENSUS:889 batch-19; covered by F-02-008 batch-02 cross-batch citation §3.9) + `notify_makeup_match_webhook` (CENSUS:823 batch-08 trigger fn cross-batch citation §3.11) + `teacher_has_thread_access` (CENSUS:888 batch-01 / F-02-020 batch-02 cross-batch citation §3.10) |
| Tables (implicit attribution per Adjudication 9 convention) | 6 | `internal_messages`, `message_batches`, `message_log`, `message_requests`, `message_templates`, `notification_preferences` |
| Triggers | 1 owned | `audit_internal_messages` AFTER INSERT/DELETE/UPDATE on internal_messages → `log_audit_event_singular` (CENSUS:830 trigger group attribution 19-cross-cutting; trigger itself batch-12-table) |
| Hooks (CENSUS §9.4 + §10.A) | 8 batch-12-canonical | `useMessages` (CENSUS:1132) + `useMessageThreads` (:1133) + `useUnreadMessages` (:1134) + `useInternalMessages` (:1135) + `useMessagingSettings` (:1136) + `useBulkMessage` (:1137) + `useAdminMessageRequests` (:1138) + `useStaffNotifications` (:1139) + `useNotesNotification` (:1039) |
| Components | 11 | `src/components/messages/*` — MessageList, MessageRequestsList, ComposeMessageModal, BulkComposeModal, InternalComposeModal, InternalMessageList, ThreadedMessageList, MessageFiltersBar, RecipientFilter, ThreadCard, ThreadMessageItem |

**Implicit-attribution-via-owning-feature-surface candidates surfaced for Phase 7 convention codification** (5 total per Adjudication 9 + Adjudication 24):
- `message_batches` (no CENSUS line; implicit batch-12 via useBulkMessage hook)
- `message_log` (no CENSUS line; implicit batch-12 via 8 batch-12 hooks + messaging spine)
- `ai_messages` (no CENSUS line; implicit batch-17 paired with ai_conversations CENSUS:841)
- `payment_notifications` (no CENSUS line; cross-batch candidate batch-05/06; defer to next batch audit)
- `push_tokens` (no CENSUS line; **primary-write-surface = `src/services/pushNotifications.ts:38` `.from('push_tokens').upsert(...)`** mobile-capacitor registration; implicit batch-13 practice-resources OR batch-18 settings-tabs per s52 attribution audit; send-push at batch-12 is consumer-only)

### 1.2 Batch close metadata

- **Session**: s51 (2026-05-15)
- **Prior session**: s50 closed batch-11 parent-portal at HEAD `cfd31aa7` (4 findings: 1C/1H/0M/2L; F-11-001 ID RELEASED)
- **HEAD pin (s51 close)**: `<s51 Phase 10 commit SHA>` (literal placeholder per drift #25; SHA recorded externally)
- **Phase timeline**: 10 phases executed (0-10); Phase 0 push hygiene check (workflow rule s51+ first application) clean

### 1.3 Finding count + severity histogram

**8 fresh F-12-NNN findings**: **0C / 3H / 0M / 5L**:
- F-12-001 HIGH (`send-cancellation-notification` rate-limit-key-mismatch fallback-to-default 6000/hr)
- F-12-002 HIGH (`send-notes-notification` rate-limit-key-mismatch fallback-to-default 6000/hr)
- F-12-003 HIGH (`send-push` cross-user push-notification injection via unvalidated `userId` parameter; **Pattern #41 anchor**)
- F-12-004 LOW (F-01-017 UPDATE-no-WITH-CHECK cohort; 4 batch-12 anchors)
- F-12-005 LOW (CC-19 #13 INERT sub-shape cohort; 2 batch-12 anchors)
- F-12-006 LOW (CC-19 #3 audit_log INSERT integrity gap cohort; 5 batch-12 anchors)
- F-12-007 LOW (CC-19 #7 Sub-E catch-block ": any" hygiene cohort; 8 batch-12 anchors across 5 files)
- F-12-008 LOW (`notify-internal-message` registry-defined-but-uninvoked rate-limit key; **Pattern #42 candidate anchor**)

**3 closed-batch citations (no fresh IDs)**: §3.9 F-02-008 (batch-02 HIGH `_notify_streak_milestone`); §3.10 F-02-020 (batch-02 MEDIUM `teacher_has_thread_access`); §3.11 closed-batch-08 LOW (`notify_makeup_match_webhook` CC-19 #1 cohort enrichment).

### 1.4 Session phase summary (input to §11 audit-method)

| Phase | Tasks | Output highlight |
|---|---|---|
| 0 | Setup + READ-FIRST + push hygiene check (workflow rule s51+ first application) + drift #31 cross-verification | HEAD `cfd31aa7` verified; baseline 471/5/30/3 (delta 0 vs s50); tally 145 (19C/42H/26M/58L) confirmed; PI cohort 5 unchanged; LOCAL == REMOTE clean; 2 drift #31 candidate observations in launching prompt §5 (F-01-006 + F-01-036 mismatches) surfaced |
| 1 | CENSUS scope finalisation + DB enumeration + class-precedent verbatim cite | 23-row CENSUS scope table delivered; 9 IN-12 + 2 OUT-closed-11 + 3 SECDEF RPCs all non-batch-12 (closed-batch-citation); DB-state zero delta from launch §6; 12 class-precedent finding-IDs verbatim-cited; 4× F-01-017 cohort USING expressions captured; RLS spot-checks confirm anon-gate clean (no F-11-004 candidates); F-02-008 batch-02 pre-existing cited as Adjudication-6 trigger |
| 2 | Edge fn body audit + Sub-class B verification + Sub-E enumeration + CC-19 #16 closure | F-02-008 Outcome A confirmed → no PI-51-A; Sub-class B HIGH revised 3→2 (send-contact-message:38-39 EXEMPT per inline-override); **send-push F-12-003 NEW HIGH** (Pattern #41 candidate); notify-internal-message F-12-008 NEW LOW (Pattern #42 candidate); Sub-E 8 instances across 5 files; **drift #35 ratified** (sub-drifts #35.A + #35.B) |
| 3 | FE caller enumeration + RPC named-param consistency + useCan + Sub-D2 + send-push D6 | 10 edge fn invocations + 35 table accesses + 0 RPC calls; F-11-003 class empty for batch-12; CC-19 #4 enrichment +4 per-usage (Messages.tsx; NOT architectural N/A); 0 Sub-D2 batch-12 instances; send-push D6 REAL within-org (message_log.sender_user_id SELECT exposure) + cross-org (F-02-020 helpers) |
| 4 | Cross-batch reach matrix + notify_makeup_match_webhook chain + F-08-001 applicability + CC-19 #3 coverage | 6 inbound cross-batch consumers all CENSUS-resolved unambiguous; 11 cross-batch outbound (read-only); F-08-001 NONE for batch-12; CC-19 #3 5 NO + 1 POSITIVE (internal_messages selective-regression framing per Adjudication 26); F-02-010 class header lineage correction per Adjudication 23 |
| 5 | Pattern catalog candidates + sub-class introductions + bracket-pair queue | Pattern #41 PLACED ratified (send-push F-12-003 anchor; edge-fn-body layer NEW); Pattern #42 CANDIDATE ratified (notify-internal-message F-12-008 anchor; batch-19 sweep target); 0 sub-class introductions; bracket-pair queue EMPTY (Adjudication 14 teacher_has_thread_access MOOT + Adjudication 18 F-12-005 LOW finalised) |
| 6 | Findings composition + CENSUS verbatim mapping + 6-dim rubric | 8 F-12-NNN drafted; 3 closed-batch citations drafted; 8 §11 entries; F-12-003 6-dim rubric vs F-02-008 (HIGH per s41 close per Phase 7 Correction 2); 0 severity-adjustment events s51 (all single-bracket pre-tag confirmations) |
| 7 | Doc-write | This findings doc + STATUS.md (153 tally) + PLAN.md (drift 34→35; pattern placed 35→36; pattern candidates 5→6; CC-19 carries enrichment counts; implicit-attribution convention codified) + CENSUS edits (push_tokens write-surface lookup result documented; no CENSUS line edits per Adjudication 9 deferred to post-Phase-B editorial workstream) |
| 8 | Pre-commit arithmetic verification | (Phase 8 EXIT) |
| 9 | HANDOVER.md prepend | (Phase 9 EXIT) |
| 10 | Commit + handover snapshot | (Phase 10 EXIT) |

---

## §2 PI map

### 2.1 PI candidate adjudications

**Batch-12 owns 0 fresh PI-51 seeds** per STATUS.md s51 banner: "Batch-12 owns 0 fresh PI seeds (all batch-12 mentions are batch-11 cross-batch reach observations)".

**Adjudication 6 disposition**: `_notify_streak_milestone` audit revealed F-02-008 already captures the class at HIGH (batch-02 close adjudication); no fresh PI-51-A allocation. Cross-batch citation only (§3.9).

**PI cohort 5 unchanged** entering and exiting s51: 1C PI-12 / 3H PI-09 + PI-10 + PI-16 / 1M PI-17.

### 2.2 Inherited cross-batch carries entering s51

Cohort enrichments documented per CC-19 carry; subsumed in F-12-NNN findings:

| Carry | s50 state | s51 batch-12 enrichment | s51 post-state |
|---|---|---|---|
| CC-19 #1 (helper-fn EXECUTE-grant hygiene) | ~6 active | +1 closed-batch-08 entry (`notify_makeup_match_webhook` §3.11) | ~7 |
| CC-19 #3 (audit_log INSERT integrity gap) | ACTIVE mixed (batch-11 +1 obs) | +5 batch-12 anchors (F-12-006) | enriched |
| CC-19 #4 (useCan unimplementation) | ≥211 per-usage | +4 per-usage (Messages.tsx L51+L52+L53+L287) | ≥215 |
| CC-19 #7 Sub-A literal | ~394 active | +0 batch-12 | ~394 |
| CC-19 #7 Sub-E catch-block ": any" | 32 cumulative | +8 batch-12 per-instance (F-12-007 across 5 files) | 40 |
| CC-19 #10 (Sentry edge-fn instrumentation) | ~8 active | +2 batch-12 (send-lesson-reminders + send-push lack wrapEdgeFn) | ~10 |
| CC-19 #13 INERT sub-shape | 1 active | +2 batch-12 (F-12-005) | 3 |
| CC-19 #16 Sub-class A LOW | 1 (F-11-005) | +0 batch-12 | 1 |
| CC-19 #16 Sub-class B HIGH | 0 ratified | +2 batch-12 (F-12-001 + F-12-002; revised from inherited 3 per Adjudication 2A — send-contact-message:38-39 EXEMPT inline-override) | 2 |
| F-01-017 UPDATE-no-WITH-CHECK | ≥21 active | +4 batch-12 anchors (F-12-004) | ≥25 |

---

## §3 Findings detail

### 3.1 F-12-001 HIGH — `send-cancellation-notification` rate-limit-key-mismatch fallback-to-default 6000/hr

| Field | Value |
|---|---|
| **ID** | F-12-001 |
| **Severity** | HIGH |
| **Area** | edge-fn / rate-limit registry / operational-correctness |
| **Phase surfaced** | 2 (Task 2.2 body inspection) |
| **Class anchor (drift #31)** | F-05-005 (findings/05-billing-invoicing.md:364-416 HIGH) — operational-correctness silent-failure CAPS-at-HIGH per s42 PI-11 / s44 PI-02/03/04 / s45 PI-05 / s48 PI-13 precedent chain. Class-shape verbatim: "silent failure modes" + cron callers swallow EXCEPTION |
| **Cohort** | CC-19 #16 Sub-class B HIGH (NEW s50 carry) |
| **CENSUS cite (drift #30.B)** | CENSUS:289 — `\| send-cancellation-notification \| notification \| service-role \| 12-messages-notifications \|` |
| **Evidence** | `supabase/functions/send-cancellation-notification/index.ts:53` invokes `checkRateLimit(user.id, "send-cancellation-notification")` with NO 3rd-arg config override; `_shared/rate-limit.ts:10-58` RATE_LIMITS registry has NO `"send-cancellation-notification"` entry; per `_shared/rate-limit.ts:100` fallback `const limits = config \|\| RATE_LIMITS[actionType] \|\| RATE_LIMITS["default"]` → falls to `"default": { maxRequests: 100, windowMinutes: 1 }` = 6000/hr |
| **Impact** | Intended messaging-class ~50/hr; actual 6000/hr = 120× looser. Silent-failure mode: no warning, no Sentry breadcrumb, no operator visibility. Org-admin caller could spam-cancel-notify guardians without rate-limit protection. Defence-in-depth gap on messaging-spam vector. |
| **Severity reasoning (PLAN.md §4)** | HIGH per "silent failure modes" anchor + operational-correctness class CAPS-at-HIGH per F-05-005 anchor + class-consistency chain. Same-bracket pre-tag confirmation (NOT severity-adjustment event per F-10-001 / F-11-004 precedent). |
| **Remediation** | Add to `_shared/rate-limit.ts` RATE_LIMITS registry: `"send-cancellation-notification": { maxRequests: 50, windowMinutes: 60 },` (messaging-class default matching sibling fns) |
| **Decision needed** | No |
| **Target sprint** | Phase C — rate-limit registry hygiene (bundle with F-12-002) |
| **Closure** | (empty) |

### 3.2 F-12-002 HIGH — `send-notes-notification` rate-limit-key-mismatch fallback-to-default 6000/hr

| Field | Value |
|---|---|
| **ID** | F-12-002 |
| **Severity** | HIGH |
| **Area** | edge-fn / rate-limit registry / operational-correctness (parallel to F-12-001) |
| **Phase surfaced** | 2 (Task 2.2 body inspection) |
| **Class anchor (drift #31)** | F-05-005 (parallel to F-12-001) |
| **Cohort** | CC-19 #16 Sub-class B HIGH |
| **CENSUS cite (drift #30.B)** | CENSUS:397 — `\| send-notes-notification \| notification \| service-role \| 12-messages-notifications \|` |
| **Evidence** | `supabase/functions/send-notes-notification/index.ts:58` invokes `checkRateLimit(user.id, "send-notes-notification")` with NO config override; key absent from registry; falls to default 6000/hr |
| **Impact** | Parallel to F-12-001; messaging-class intent (~50/hr) → unbounded effect (6000/hr default). |
| **Severity reasoning (PLAN.md §4)** | HIGH per F-05-005 class-precedent. Same-bracket pre-tag confirmation. |
| **Remediation** | Add to `_shared/rate-limit.ts`: `"send-notes-notification": { maxRequests: 50, windowMinutes: 60 },` |
| **Decision needed** | No |
| **Target sprint** | Phase C — bundle with F-12-001 |
| **Closure** | (empty) |

### 3.3 F-12-003 HIGH — `send-push` cross-user push-notification injection via unvalidated `userId` parameter

| Field | Value |
|---|---|
| **ID** | F-12-003 |
| **Severity** | HIGH |
| **Area** | edge-fn body / cross-tenant notification injection / authenticated-not-authorized |
| **Phase surfaced** | 2 (Task 2.1 body inspection) + Phase 3 Task 3.5 D6 composition + Phase 4 Task 4.1.b outbound dependency |
| **Class anchor (drift #31)** | F-02-008 (findings/02-org-management.md:521-573) HIGH — cross-tenant notification injection class anchor; `_notify_streak_milestone` audit-log forgery + downstream `net.http_post` chain. Class verbatim §523: "Severity: High; Area: secdef / cross-tenant-write / child-safeguarding adjacency / forensic-integrity" |
| **Pattern slot** | **Pattern #41 PLACED at s51 (per Adjudication 29)** — anchor of NEW pattern "Authenticated cross-tenant action via unvalidated identity parameter"; edge-fn body layer (NEW layer vs DB-SECDEF anchors F-02-002/005/008 + F-08-001 + Pattern #40); authenticated-only reachability (NEW reachability axis vs anon-reachable closed anchors) |
| **CENSUS cite (drift #30.B)** | CENSUS:400 — `\| send-push \| notification \| service-role \| 12-messages-notifications \|` |
| **Evidence — body inspection** | `supabase/functions/send-push/index.ts:36` destructures `{ userId, title, body, data } = __body`. Lines L51-54 query `push_tokens WHERE user_id = userId` — NO check that `userId === auth.uid()` and NO check that caller has authority over userId. Platform `verify_jwt=true` (per launching prompt §6.7) gates anon but admits any authenticated user. L83-95 dispatches FCM/APNs with caller-controlled `title` + `body` + `data` |
| **Evidence — Sentry instrumentation gap** | `send-push/index.ts:19` uses bare `Deno.serve(...)` without `wrapEdgeFn()`. CC-19 #10 cohort enrichment (separate from this finding's primary class). |
| **Evidence — attack surface (Phase 3 A.1)** | ZERO FE callers in `src/` (Phase 3 grep verified exhaustively). Only legitimate invocation is server-side from `send-lesson-reminders/index.ts:470` with service-role bearer. **Attack surface is direct HTTP POST to `/functions/v1/send-push` by any authenticated user with a valid JWT.** |
| **Exploit shape** | Authenticated user (any role) crafts HTTP POST: `Authorization: Bearer <valid-JWT>`, body `{ userId: <victim-uuid>, title: "Account compromised", body: "Click here to reset", data: { link: "..." } }` → edge fn fetches victim's push_tokens → dispatches FCM/APNs notifications with attacker-controlled content. **Within-org targets**: user_ids enumerable from `message_log.sender_user_id` SELECT exposure (`useMessageThreads.ts:147+243+269` includes sender_user_id in SELECT lists for RLS-permitted message threads). **Cross-org targets**: F-02-020 closed-batch-02 helpers (Track 1 fix list at findings/02-org-management.md:1067) enable role-edge probing for arbitrary (user_id, org_id) pairs. |
| **6-dim rubric vs F-02-008 anchor (HIGH per s41 close)** | (full table below) |

**6-dim rubric for F-12-003 vs F-02-008 anchor (HIGH per s41 close)**:

| Dimension | F-02-008 anchor (HIGH per s41 close) | F-12-003 (send-push) | Comparison |
|---|---|---|---|
| **D1 cross-tenant** | YES — anon-supplied `_org_id` enables cross-tenant action | YES — caller-supplied `userId` enables cross-user action; user_id enumeration paths real (Phase 3 A.5) | MATCH |
| **D2 anon-reachable** | YES — anon=X EXECUTE on SECDEF | **NO — verify_jwt=true platform gate rejects anon** | MAGNITUDE-WEAKER vs anchor (not bracket-shift factor per class-consistency precedent) |
| **D3 payload sensitivity** | HIGH — audit_log INSERT + caller-controlled streak count + parent-facing email with real student name | MEDIUM — push notification title+body caller-controlled; impersonation of platform messaging; not direct PII exfiltration | MAGNITUDE-WEAKER |
| **D4 regulatory scope** | YES — GDPR Art-33 audit-trail integrity + parent-facing trust erosion + child-safeguarding adjacency | PARTIAL — parental-trust channel (push notifications for child-related events); GDPR Art-32 integrity-of-processing adjacency; not direct PII exposure | MAGNITUDE-WEAKER |
| **D5 trust erosion** | HIGH — parents receive spurious emails about their child's practice with attacker-chosen streak counts | HIGH — push notification is impersonation of legitimate platform messaging (first-encounter trust erosion + phishing vector + spam vector) | MATCH-or-STRONGER |
| **D6 composition chain** | YES — `_notify_streak_milestone` body composes with downstream `streak-notification` edge fn; user_id enumeration via F-02-009/020 closed-batch helpers | YES REAL — within-org via batch-12 `message_log.sender_user_id` SELECT exposure (useMessageThreads.ts:147+243+269); cross-org via F-02-020 closed-batch-02 helpers Track 1 fix list | MATCH-or-STRONGER (within-org composition is batch-12 surface contribution, not just inherited closed-batch chains) |

**Bracket verdict**: HIGH per F-02-008 class-precedent CAPS-at-HIGH. D2 NO (verify_jwt=true) is magnitude factor weakening reach but doesn't bracket-shift per class-consistency precedent (D5+D6 stand at or exceed F-02-008 anchor). Same-bracket pre-tag confirmation per F-10-001/F-11-004 precedent — NOT a severity-adjustment event.

| Field | Value |
|---|---|
| **Impact** | Push notification = impersonation of legitimate platform messaging (parents trust LessonLoop's brand for child-related notifications). First-encounter trust erosion + phishing vector + spam vector. Within-org REAL composition path; cross-org REAL composition path. |
| **Severity reasoning (PLAN.md §4)** | HIGH per F-02-008 class-precedent CAPS-at-HIGH for cross-tenant notification injection. Class-consistency precedent: D2 NO is magnitude factor not bracket-shift factor. |
| **Remediation** | Body-level auth check at fn entry: `const isSelf = userId === user.id;` `const isOrgAdmin = await isOrgAdminFor(user.id, await deriveOrgFromUserId(userId));` `if (!isSelf && !isOrgAdmin) return 403`. Alternative: restrict send-push to service-role callers only by validating `Authorization` Bearer against `SUPABASE_SERVICE_ROLE_KEY` env var — Pattern #41 PLACED remediation surface. Co-fix: add `wrapEdgeFn("send-push", handler)` for Sentry instrumentation (CC-19 #10). |
| **Decision needed** | No |
| **Target sprint** | Phase C — cross-tenant-action body-gate hardening |
| **Closure** | (empty) |

### 3.4 F-12-004 LOW — F-01-017 UPDATE-no-WITH-CHECK cohort (4 batch-12 anchors; selective regression)

| Field | Value |
|---|---|
| **ID** | F-12-004 |
| **Severity** | LOW (cohort-enrichment CAPS-at-LOW per s50 batch-11 +2 precedent on F-01-017 carry; anchor F-01-017 itself is MEDIUM cluster header) |
| **Area** | RLS policy / UPDATE-policy-missing-WITH-CHECK |
| **Phase surfaced** | 1 (Task 1.4 DB-verified pg_policies enumeration) |
| **Class anchor (drift #31)** | F-01-017 (findings/01-auth-sessions-rls.md:413-431) MEDIUM cluster — "UPDATE/ALL policies on ~50 tables lack explicit WITH CHECK clause" |
| **Cohort** | F-01-017 batch-19 sweep target #16 enrichment; pre-s51 ≥21 → post-s51 ≥25 (+4 batch-12) |
| **CENSUS cite (drift #30.B)** | Implicit attribution via owning-feature-surface per Adjudication 9 (4 batch-12 tables attributed implicitly via hooks CENSUS:1132-1139 + triggers CENSUS:831-833) |
| **Anchors (Phase 1 Task 1.4 verbatim USING captures)** | (1) `message_batches "Org admins can update message batches"` UPDATE USING `is_org_admin(auth.uid(), org_id)`, with_check=NULL; (2) `message_requests "Admins can update message requests"` UPDATE USING `is_org_admin(auth.uid(), org_id)`, with_check=NULL; (3) `message_templates "Admin can update message templates"` UPDATE USING `is_org_admin(auth.uid(), org_id)`, with_check=NULL; (4) `notification_preferences "Users can update own notification preferences"` UPDATE USING `(user_id = auth.uid())`, with_check=NULL |
| **POSITIVE counter-example (selective regression)** | `internal_messages "Recipients can mark messages read"` UPDATE has explicit WITH CHECK `(recipient_user_id = auth.uid())` (DB-verified Phase 1 Task 1.4). **Correct pattern available in batch-12; 4 batch-12 UPDATE policies selectively miss adoption.** Reinforces hygiene-class LOW framing — the org has the pattern; missed adoption is selective regression. |
| **Impact** | Reliance on PG implicit default (USING reused for new-row check). Catches gross org_id-tampering. Does NOT catch FK-other-column tampering (recipient_id, sender_user_id, etc.) per F-01-017 §424 analysis. Admin-only attack surface; bounded. |
| **Severity reasoning (PLAN.md §4)** | LOW per "code-hygiene drift" anchor + cohort-enrichment-CAPS-at-LOW precedent (s50 batch-11 +2 LOW assignments at guardians + student_guardians) |
| **Remediation** | Add explicit `WITH CHECK (...)` matching `USING (...)` clause to each of the 4 policies; co-fix with batch-19 sweep target #16 systematic cohort closure |
| **Decision needed** | No |
| **Target sprint** | Phase C — RLS hardening (bundle with F-01-017 batch-19 cohort sweep) |
| **Closure** | (empty) |

### 3.5 F-12-005 LOW — CC-19 #13 INERT sub-shape cohort (2 batch-12 anchors)

| Field | Value |
|---|---|
| **ID** | F-12-005 |
| **Severity** | LOW |
| **Area** | RLS policy / PERMISSIVE-intended-as-RESTRICTIVE / INERT sub-shape |
| **Phase surfaced** | 1 (Task 1.2.e DB-verified pg_policies enumeration) |
| **Class anchor (drift #31)** | (1) **Class header**: F-05-001 (findings/05-billing-invoicing.md:68-73) CRITICAL — PERMISSIVE-intended-as-RESTRICTIVE class header; INERT sub-shape documented §170-176: "qual=false (inert) \| 1 (payments \"Block anonymous access to payments\") \| INERT (PERMISSIVE qual=false adds zero rows to OR-set)"; (2) **Sub-shape anchor**: F-06-003 (findings/06-payments-stripe-connect.md:132-137) CRITICAL — auth-state-only sub-shape (active-broadening; distinct from INERT) |
| **Cohort** | CC-19 #13 INERT sub-shape; cohort 1 → 3 (payments F-05-001 carry + 2 batch-12) |
| **CENSUS cite (drift #30.B)** | Implicit attribution via owning-feature-surface |
| **Anchors** | (1) `notification_preferences "Block anonymous access to notification_preferences"` PERMISSIVE roles={anon} cmd=ALL USING=`false` (qual=false sub-shape; semantic effect: anon has no other matching policies → already denied by default; this policy is cosmetic NO-OP); (2) `message_log "Block authenticated insert on message_log"` PERMISSIVE roles={authenticated} cmd=INSERT WITH CHECK=`false` (with_check=false sub-shape; OR'd against "Staff can insert messages" PERMISSIVE roles={public} WITH CHECK=`(is_org_staff(auth.uid(), org_id) AND (sender_user_id = auth.uid()))` — staff path passes, block path inert) |
| **Bifurcation note** | Per Adjudication 8 + Phase 5 Sub-class (i) confirmation, qual=false and with_check=false are clause-location variants of same anti-pattern; cohort documented as one INERT sub-shape with bifurcated remediation framing (qual=false applies to USING clause; with_check=false applies to WITH CHECK clause) |
| **Impact** | Cosmetic policy-author intent failure: RESTRICTIVE-block intent declared as PERMISSIVE → no actual access broadening (the "block" never blocks because PERMISSIVE OR-chain admits when any one allow-path passes). Dead-weight policy code; readers misinterpret as RESTRICTIVE. |
| **Severity reasoning (PLAN.md §4)** | LOW per "code-hygiene drift" — INERT sub-shape adds zero exploit surface unlike active-broadening sub-shapes F-05-001 / F-06-003 CRITICAL. Bracket-shift DOWN from F-05-001 CRITICAL via INERT class-distinct sub-shape established at F-05-001 §175. Same-bracket pre-tag confirmation. |
| **Remediation** | Either (a) convert to RESTRICTIVE policy if intent is to block (per F-05-001 §157 anchor fix template), OR (b) remove the policy entirely if redundant (other policies' default-deny suffices for anon and {authenticated}-INSERT-via-staff-path satisfies legitimate staff use) |
| **Decision needed** | No |
| **Target sprint** | Phase C — bundle with batch-19 sweep target #13 CC-19 #13 systematic sweep |
| **Closure** | (empty) |

### 3.6 F-12-006 LOW — CC-19 #3 audit_log INSERT integrity gap cohort (5 batch-12 anchors; selective regression)

| Field | Value |
|---|---|
| **ID** | F-12-006 |
| **Severity** | LOW |
| **Area** | DB schema / audit-trigger coverage gap / forensic-integrity |
| **Phase surfaced** | 1 (Task 1.2.g) + Phase 4 Task 4.4 (formalised) |
| **Class anchor (drift #31; dual citation per Adjudication 23)** | (1) **Class header anchor**: F-02-010 (batch-02 closed-immutable; "`audit_log` table has no INSERT-time integrity trigger; 70.1% historical NULL-actor") at findings/02-org-management.md — original CC-19 #3 class-defining finding; (2) **Most recent cohort precedent**: F-11-003 §B (batch-11 closed-immutable; lesson_notes lacks audit trigger observation) at findings/11-parent-portal.md |
| **Cohort** | CC-19 #3 audit_log INSERT integrity gap; batch-12 +5 anchors |
| **CENSUS cite (drift #30.B)** | Implicit attribution via owning-feature-surface |
| **Anchors (DB-verified Phase 1 Task 1.2.g)** | (1) `message_log` — no audit trigger; messaging spine; 8 RLS policies; highest bite per Adjudication 7; GDPR Art-32 integrity surface; (2) `message_batches` — no audit trigger; bulk-send audit-trail gap; (3) `message_requests` — no audit trigger; cancellation/reschedule audit-trail gap; only `update_message_requests_updated_at` BEFORE UPDATE; (4) `message_templates` — no audit trigger; template-edit-history gap; only `update_message_templates_updated_at` BEFORE UPDATE; (5) `notification_preferences` — no audit trigger; preference-change-history gap; only `update_notification_preferences_updated_at` BEFORE UPDATE |
| **POSITIVE counter-example (selective regression per Adjudication 26)** | `internal_messages` has `audit_internal_messages` AFTER INSERT/DELETE/UPDATE trigger calling `log_audit_event_singular` (DB-verified Phase 1.2.g; CENSUS:830 attribution). **Correct pattern available in batch-12; 5-of-6 tables selectively miss adoption.** The org's audit-trigger infrastructure works (POSITIVE example) — the gap is selective regression, not systemic absence. |
| **Impact** | Forensic-integrity gap. INSERT/UPDATE/DELETE on these 5 tables produces no audit-trail entry. message_log especially significant: messaging spine for the entire app; UPDATE actions (e.g. status flips sent→failed; read_at marks) and DELETE actions (e.g. admin remove) leave no auditable record. GDPR Art-32 "integrity and confidentiality" obligation pressure post-launch. |
| **Severity reasoning (PLAN.md §4)** | LOW per "code-hygiene drift" + cohort-enrichment CAPS-at-LOW per F-02-010 + F-11-003 §B class-precedent chain. Selective-regression framing further reinforces LOW (org has the pattern; missed adoption is hygiene-class). Note: bite-magnitude for message_log alone is higher than the other 4 anchors but class-precedent governs bracket per class-consistency. |
| **Remediation** | Apply `audit_<table>` AFTER INSERT/UPDATE/DELETE trigger calling `log_audit_event_singular()` to each of the 5 tables; pattern matches internal_messages POSITIVE counter-example exactly |
| **Decision needed** | No |
| **Target sprint** | Phase C — audit-trigger coverage sweep (bundle with batch-19 cohort target) |
| **Closure** | (empty) |

### 3.7 F-12-007 LOW — CC-19 #7 Sub-E catch-block ": any" hygiene cohort (8 batch-12 anchors across 5 files)

| Field | Value |
|---|---|
| **ID** | F-12-007 |
| **Severity** | LOW |
| **Area** | TypeScript / catch-block type hygiene / strict-mode bypass |
| **Phase surfaced** | 2 (Task 2.3 enumeration) |
| **Class anchor (drift #31)** | F-11-002 Sub-E (NEW s50 ratification; findings/11-parent-portal.md Sub-E catch-block hygiene cohort; 4 batch-11 anchors at send-parent-enquiry:195+:223 + send-parent-message:320+:349; 32-instance cumulative cohort DB-verified Phase 6 §4) |
| **Cohort** | CC-19 #7 Sub-E catch-block hygiene cohort; pre-s51 32 instances → post-s51 40 instances (+8 batch-12 per-instance enrichment across 5 files) |
| **CENSUS cite (drift #30.B)** | CENSUS:289 (send-cancellation-notification) + CENSUS:394 (send-bulk-message) + CENSUS:396 (send-message) + CENSUS:397 (send-notes-notification) + CENSUS:393 (notify-internal-message) — 5 batch-12 edge fns explicitly CENSUS-attributed |
| **Anchors (Phase 2 Task 2.3 verbatim file:line enumeration)** | (1) `supabase/functions/send-message/index.ts:305` `catch (emailError: any)` (inner Resend); (2) `:336` `catch (error: any)` (outer); (3) `supabase/functions/send-bulk-message/index.ts:86` `catch (err: any)` (inner sendSingleEmail); (4) `:429` `catch (error: any)` (outer); (5) `supabase/functions/send-cancellation-notification/index.ts:229` `catch (error: any)` (outer); (6) `supabase/functions/send-notes-notification/index.ts:265` `catch (error: any)` (outer); (7) `supabase/functions/notify-internal-message/index.ts:173` `catch (emailError: any)` (inner Resend); (8) `:209` `catch (error: any)` (outer) |
| **POSITIVE counter-examples** | Other 4 IN-12 edge fns use bare `catch (error)` (implicit unknown per TS strict) OR explicit `: unknown`: send-contact-message + mark-messages-read + send-push (bare); send-lesson-reminders (`: unknown` at L64+L84+L263+L279). Correct pattern available in batch-12; selective regression in 5 files. |
| **Impact** | TS strict-mode `useUnknownInCatchVariables=true` is bypassed by explicit `: any` annotation. Allows callers to access arbitrary properties on caught errors without narrowing. Type-safety hygiene; no functional defect. |
| **Severity reasoning (PLAN.md §4)** | LOW per "code-hygiene drift" + Sub-E sub-class CAPS-at-LOW per s50 F-11-002 Sub-E precedent |
| **Remediation** | Replace `catch (X: any)` with `catch (X)` (implicit `: unknown`) or `catch (X: unknown)` + add type-narrowing helper like `errorMessage(X)` for `.message` access |
| **Decision needed** | No |
| **Target sprint** | Phase C — TS strict-mode hygiene (bundle with batch-19 sweep target #4 CC-19 #7 Sub-E cumulative cohort) |
| **Closure** | (empty) |

### 3.8 F-12-008 LOW — `notify-internal-message` registry-defined-but-uninvoked rate-limit key

| Field | Value |
|---|---|
| **ID** | F-12-008 |
| **Severity** | LOW |
| **Area** | edge-fn / rate-limit infrastructure / author-intent failure |
| **Phase surfaced** | 2 (Task 2.4 cohort completion check) |
| **Class anchor (drift #31)** | **Pattern #42 CANDIDATE NEW at s51 (per Adjudication 30; F-12-008 is the anchor).** Class-shape: edge fn has explicit rate-limit registry entry indicating author-intent; body executes WITHOUT invoking `checkRateLimit()`; author-intent failure surfaced via registry-vs-body diff. |
| **Cohort** | Pattern #42 CANDIDATE cohort entering Phase 7 (single instance; batch-19 sweep determines promotion to PLACED if ≥2 additional instances surface) |
| **CENSUS cite (drift #30.B)** | CENSUS:393 — `\| notify-internal-message \| notification \| service-role \| 12-messages-notifications \|` |
| **Evidence** | (1) `supabase/functions/_shared/rate-limit.ts:26` declares author-intent: `"notify-internal-message": { maxRequests: 50, windowMinutes: 60 },` (2) `supabase/functions/notify-internal-message/index.ts` imports section L1-7: NO `checkRateLimit` import; (3) full-body grep: NO `checkRateLimit` invocation anywhere (Phase 2 Task 2.4 verified) |
| **Class-distinctness from CC-19 #16 (per Adjudication 16 + Phase 5 Task 5.2)** | CC-19 #16 Sub-class A defect locus = key-string-correctness at invocation site (BOUNDED); Sub-class B defect locus = registry-side missing entry (UNBOUNDED via default-fallback). Pattern #42 defect locus = invocation-side absence despite registry-extant. Different root cause class; defect locus diverges. |
| **Impact** | Silent removal of rate-limiting protection on internal-staff-messaging edge fn. Effect bounded only by upstream platform-level limits (Supabase Edge concurrency caps). Within-org messaging spam vector by authenticated staff. Author-intent failure: registry declares 50/hr, body enforces 0/hr (unlimited). Practical impact bounded by sender + recipient must both be org members + sender role gate (owner/admin/teacher) limits attack surface. |
| **Severity reasoning (PLAN.md §4)** | LOW per "code-hygiene drift" + "minor docstring/API inconsistency" — registry entry declares intent; body fails to enforce. Hygiene-class CAPS-at-LOW. |
| **Remediation** | Add to `notify-internal-message/index.ts` after authentication: `import { checkRateLimit, rateLimitResponse } from "../_shared/rate-limit.ts";`; `const rateLimitResult = await checkRateLimit(user.id, "notify-internal-message"); if (!rateLimitResult.allowed) return rateLimitResponse(corsHeaders, rateLimitResult);` |
| **Decision needed** | No |
| **Target sprint** | Phase C — edge-fn rate-limit infrastructure hardening |
| **Closure** | (empty) |

### 3.9 F-02-008 closed-batch-02 HIGH — cross-batch citation (DB-state re-verification only)

F-02-008 closed-batch-02 HIGH class (findings/02-org-management.md:521-573; batch-02 closed-immutable; "cross-tenant audit-log injection + parent-notification injection"; class anchor stack F-02-005 + F-07-003) continues to apply at HEAD pin cfd31aa7. Phase 1 Task 1.2.c body inspection re-verified the function body is unchanged from F-02-008 evidence: SECURITY DEFINER + search_path=public + anon=X EXECUTE + no auth.uid() check; INSERTs audit_log with actor_user_id=NULL + caller-supplied _org_id + caller-supplied _student_id; PERFORMs net.http_post to /functions/v1/streak-notification with caller-supplied payload signed via vault-fetched SUPABASE_SERVICE_ROLE_KEY + INTERNAL_CRON_SECRET.

CENSUS:889 attributes `_notify_streak_milestone` to "Audit-log infrastructure" group → 19-cross-cutting (per s51 launch prompt §6.3.a pre-investigation; verified Phase 1 Task 1.1 verbatim cite). The security class is captured at F-02-008 (batch-02 close adjudication HIGH per parameter-spoofing + cross-tenant-write class CAPS-at-HIGH). No batch-12 audit action.

### 3.10 F-02-020 closed-batch-02 MEDIUM — cross-batch citation (DB-state re-verification only)

F-02-020 closed-batch-02 MEDIUM class (findings/02-org-management.md:1013-1078; batch-02 closed-immutable; "Helper-fn information-disclosure class (19 fns) — cross-tenant enumeration via SECDEF helpers") continues to apply at HEAD pin cfd31aa7. `teacher_has_thread_access` is explicitly listed at findings/02-org-management.md:1037 as one of the 19 helper-fn cohort members; Track 1 fix list at line 1067 explicitly includes `REVOKE EXECUTE ON FUNCTION public.teacher_has_thread_access(uuid, uuid, uuid) FROM authenticated, anon;`.

Phase 1 Task 1.2.c body inspection re-verified: SECURITY DEFINER + STABLE + search_path=public + anon=X EXECUTE; body `SELECT EXISTS (SELECT 1 FROM public.message_log ml WHERE ml.thread_id = _thread_id AND ml.org_id = _org_id AND ml.related_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.student_teacher_assignments sta WHERE sta.student_id = ml.related_id AND sta.org_id = ml.org_id AND sta.teacher_user_id = _teacher_user_id))` — NO auth.uid() body-gate; boolean-oracle for teacher↔thread access.

CENSUS:888 attributes `teacher_has_thread_access` to "RLS role-check helpers" group → 01-auth-sessions-rls (per s51 launch prompt §6.3.c pre-investigation; verified Phase 1 Task 1.1 verbatim cite). The security class is captured at F-02-020 (batch-02 MEDIUM class header). CC-19 #1 helper-fn EXECUTE-grant hygiene cohort (which requires STRONG body-gate per F-09-002 + F-10-008 + F-11-002 anchor class-shape) does NOT apply — `teacher_has_thread_access` has no body-gate, putting it in F-02-020 enumeration class rather than CC-19 #1 hygiene class. No batch-12 audit action.

### 3.11 `notify_makeup_match_webhook` closed-batch-08 LOW — CC-19 #1 cohort enrichment

`notify_makeup_match_webhook` trigger function (CENSUS:823 trigger attribution batch-08-attendance-credits-waitlists; trigger fn invoked exclusively via DB trigger trg_notify_makeup_match on make_up_waitlist AFTER UPDATE — DB-verified Phase 1 Task 1.2.g) re-verified at HEAD pin cfd31aa7: SECURITY DEFINER + search_path=public + anon=X EXECUTE (DB-verified Phase 1 Task 1.2.b); body `RETURNS trigger`; fires `PERFORM net.http_post` on NEW.status='matched' to `/functions/v1/notify-makeup-match` (CENSUS:367 batch-08 edge fn).

anon EXECUTE grant has hygiene-only practical impact — trigger fns are not directly RPC-callable via PostgREST; only fire on table DML events the caller has rights to (make_up_waitlist is batch-08-RLS-protected). CC-19 #1 helper-fn EXECUTE-grant hygiene cohort entry under closed-batch-08 attribution (NOT fresh F-12-NNN per Adjudication 3; batch-08 closed-immutable).

Class precedent: F-09-002 + F-10-008 + F-11-002 cohort (LOW hygiene class CAPS-at-LOW per F-09-002 batch-09 anchor). Phase 7 PLAN.md cohort update: CC-19 #1 carry +1 closed-batch-08 entry.

---

## §11 Audit-method appendix

### §11.A Class-precedent verbatim cite per drift #31

| Finding-ID | Source file:line | Class-shape excerpt cited in s51 |
|---|---|---|
| F-01-017 | findings/01-auth-sessions-rls.md:413-431 | "UPDATE/ALL policies on ~50 tables lack explicit WITH CHECK clause" MEDIUM cluster |
| F-02-002 | findings/02-org-management.md:167-225 | "`get_students_for_org` anonymous cross-tenant child-PII exfiltration" CRITICAL headline; GDPR Art 33 |
| F-02-005 | findings/02-org-management.md:383-455 | "`record_stripe_payment` anonymous cross-tenant payment falsification (PI-08 elevation HIGH → CRITICAL)" |
| F-02-008 | findings/02-org-management.md:521-573 | "`_notify_streak_milestone` cross-tenant audit-log injection + parent-notification injection" HIGH |
| F-02-009 | findings/02-org-management.md:575-612 | "`get_student_ids_for_parent` cross-user student-set enumeration" HIGH |
| F-02-010 | (cited as class header for CC-19 #3 per Adjudication 23) | "`audit_log` table has no INSERT-time integrity trigger; 70.1% historical NULL-actor" |
| F-02-020 | findings/02-org-management.md:1013-1078 | "Helper-fn information-disclosure class (19 fns)" MEDIUM class |
| F-05-001 | findings/05-billing-invoicing.md:68-73 + §170-176 INERT sub-shape | "PERMISSIVE-policy anon-cross-tenant INSERT on invoices via 3-layer no-auth composition" CRITICAL; CC-19 #13 class header |
| F-05-005 | findings/05-billing-invoicing.md:364-416 | "`recalculate_invoice_paid` draft→paid blocked by trigger; cron callers silently swallow EXCEPTION" HIGH operational-correctness CAPS-at-HIGH |
| F-06-003 | findings/06-payments-stripe-connect.md:132-137 | "`payment_disputes 'Service role manages disputes'` PERMISSIVE policy enables anon-CRUD" CRITICAL; auth-state-only sub-shape |
| F-08-001 | findings/08-attendance-credits-waitlists.md:92-141 | "`cleanup_withdrawal_credits` anon-callable SECDEF (parameter-spoofing + financial-falsification)" CRITICAL |
| F-09-002 | findings/09-term-continuation.md:718-736 | "`recalc_continuation_summary` anon-EXECUTE-grant-with-body-gate (CC-19 #1 hygiene)" LOW class CAPS-at-LOW |
| F-10-008 | findings/10-reports-analytics-payroll.md:198-212 | "SECDEF RPC anon-EXECUTE-grant cohort despite body-gate" LOW; CC-19 #1 cohort |
| F-11-002 | findings/11-parent-portal.md:116-132 | "CC-19 #1 helper-fn EXECUTE-grant hygiene cohort (3 anchors)" LOW + Sub-E catch-block class anchor (NEW s50) |
| F-11-003 | findings/11-parent-portal.md:134-155 (+ §B observation for CC-19 #3 cohort precedent) | "useParentLessonNotes RPC named-parameter mismatch always-errors at PG layer" HIGH operational-correctness CAPS-at-HIGH |
| F-11-004 | findings/11-parent-portal.md:157-188 | "`get_parent_dashboard_data` NULL-conditional auth gate bypass" CRITICAL; Pattern #40 anchor |

### §11.B F-08-001 NONE batch-12 instances (per Adjudication 25)

F-08-001 closed-batch-08 CRITICAL class (parameter-spoofing + financial-falsification; class anchor stack F-02-005 + F-07-003) was cited in s51 READ-FIRST list per drift #31 mandate. Phase 4.3 per-edge-fn class-shape verification confirmed zero batch-12 instances: 7 of 9 IN-12 edge fns have SOLID auth-gate preventing parameter-spoofing; send-contact-message is PUBLIC-by-design (no caller authentication intended); send-push F-12-003 has partial class element (caller-supplied userId) but lacks financial-falsification dimension — F-02-008 anchor is correct precedent per Adjudication 15 + Adjudication 20. Class-precedent loaded for the audit but not actualised.

### §11.C F-11-003 anticipatory READ-FIRST note (per Adjudication 21)

F-11-003 closed-batch-11 HIGH class (FE-RPC named-parameter mismatch; PG SQLSTATE 42883 undefined_function on mismatch) was cited in s51 READ-FIRST list per drift #31 mandate. Phase 3.2 enumeration confirmed zero batch-12 surface: no `supabase.rpc()` call sites for the 3 batch-12-attribution SECDEF RPCs (all OUT per Phase 1 Task 1.1) AND no RPC calls in the 8 batch-12-owned hooks. Class-precedent loaded for the audit but not actualised. F-11-003 §B is cited as cohort precedent for F-12-006 CC-19 #3 audit_log INSERT integrity gap cohort (class header F-02-010).

### §11.D Cross-batch outbound architectural hygiene POSITIVE observation (per Adjudication 27)

Phase 4.1.b outbound dependency enumeration confirmed batch-12 edge fns only READ cross-batch tables (11 tables across batches 01/02/03/04/05). Zero cross-batch INSERT/UPDATE/DELETE. Architectural hygiene POSITIVE observation: messaging surface respects closed-batch boundaries for read-only consumption. push_tokens consumption is the only outbound write candidate, deferred to Phase 7 attribution resolution per Adjudication 24 (primary-write-surface convention).

### §11.E Pattern #41 PLACED at s51 (per Adjudication 29)

Pattern #41 RATIFIED PLACED at s51 Phase 5: "Authenticated cross-tenant action via unvalidated identity parameter".

Class-shape: edge fn has auth-required gate (verify_jwt=true OR body-level Authorization+getUser(token)); body accepts caller-supplied identity parameter (userId, targetUserId, recipient_user_id, etc.); body performs action on that identity with NO body-level validation that caller is authorized over the identity.

Layer: edge-fn body (NEW layer — first placed pattern at this layer for cross-tenant-action class shape; closed-batch anchors F-02-002 + F-02-005 + F-02-008 + F-08-001 + Pattern #40 are all DB-SECDEF layer).

Reachability: authenticated-only (verify_jwt=true platform gate; NEW reachability axis vs existing anon-reachable anchors).

Class-distinct from F-02-002 / F-02-005 / F-02-008 / F-08-001 / Pattern #40 per Phase 5 Task 5.1 distinctness assessment table.

Anchor: F-12-003 (send-push at `supabase/functions/send-push/index.ts`).

Remediation: body-level check `if (userId !== user.id && !await isOrgAdminFor(user.id, targetOrgId)) return 403;` OR restrict to service-role bearer via header validation.

Placement precedent: Pattern #40 single-anchor placement at s50 (F-11-004 anchor). Single-anchor placement is sufficient when class-shape is well-defined and clearly distinct from existing catalog.

### §11.F Pattern #42 CANDIDATE at s51 (per Adjudication 30)

Pattern #42 RATIFIED CANDIDATE at s51 Phase 5: "Registry-defined-but-uninvoked rate-limit key".

Class-shape: edge fn name has explicit entry in rate-limit registry declaring author-intent; body executes WITHOUT invoking `checkRateLimit()` (or equivalent). Author-intent failure surfaced via registry-vs-body diff.

Defect locus: invocation side (no checkRateLimit call) — distinct from CC-19 #16 Sub-class A (wrong-but-extant key at invocation site) and Sub-class B (missing-registry-entry at registry side).

Anchor: F-12-008 (notify-internal-message at `supabase/functions/notify-internal-message/index.ts`; registry entry at `_shared/rate-limit.ts:26`).

Candidate status rationale: single-instance evidence entering Phase 7. Promote to PLACED if batch-19 sweep finds ≥2 additional instances; OR single-anchor placement per Pattern #40/#41 precedent if reviewing-Claude prefers earlier placement.

Sweep target assignment: batch-19 cross-cutting (sweep target for registry-vs-body diff across all edge fns).

### §11.G Drift #35 ratified at s51 Phase 2 (per Adjudication 13)

Methodology drift #35 RATIFIED at s51 Phase 2 (Category 1 reviewing-Claude origin): "Instance classification (cohort membership, sub-class assignment, cross-batch attribution) in handover §2 entering-cohort lists, launching-prompt §6 pre-investigation, and any Phase 1+ class-precedent citation MUST verify the candidate matches the class-shape's defining features AND must check class-specific exemption rules. Surface features (name patterns, anon=X EXECUTE) are not sufficient; defining features (body-gate presence for CC-19 #1; absence-of-inline-override for CC-19 #16 Sub-class B) must be DB-verified or source-grep-verified before classification."

Sub-drift #35.A (no counter increment): exemption-rule verification — cohort instance classification must check class-specific exemption rules (e.g. CC-19 #16 Sub-class B inline-override exemption per account-delete:51 + gdpr-delete L47 precedent). Manifestation: send-contact-message:38-39 listed in s50 handover §2 as Sub-class B HIGH despite the same s50 PLAN.md L106 declaring the inline-override exemption rule.

Sub-drift #35.B (no counter increment): class-shape feature verification — class-precedent citation must verify the candidate matches the precedent's required defining features (e.g. body-gate presence for CC-19 #1). Manifestation: teacher_has_thread_access listed in s51 launching prompt §6.3.c as CC-19 #1 hygiene candidate despite body having NO auth.uid() check (CC-19 #1 class-shape requires STRONG body-gate per F-09-002 + F-10-008 + F-11-002 anchor verbatim).

Drift #35.B scope refinement at Phase 4 (per Adjudication 23 follow-on): class-precedent citations must distinguish "class header anchor" (original class-defining finding) from "cohort precedent" (most recent instance). Manifestation: Adjudication 7 cited F-11-003 §B as F-12-006 class anchor; CC's Phase 4 traced the class header to F-02-010 (batch-02 closed-immutable class definition). Editorial within #35.B scope; no new sub-drift letter.

Counter increment: 34 → 35. Sub-drifts share parent counter slot (precedent: drift #30/#30.A/#30.B single-slot family; sub-drifts share parent counter slot). Cumulative methodology-drift entries post-s51: 35 (32 Category 1 + 1 Category 2 + 2 Category 3).

### §11.H Severity-adjustment events s51 = 0 (per Adjudication 32)

Cumulative severity-adjustment events through s51: 13 unchanged.

s51 batch-12 audit produced 0 severity-adjustment events:
- F-12-001 + F-12-002 + F-12-003 single-bracket HIGH pre-tags → HIGH final via F-05-005 (F-12-001/2) and F-02-008 (F-12-003) class-precedent confirmation; same-bracket pre-tag confirmation per F-10-001 / F-11-004 precedent — NOT events.
- F-12-004 through F-12-008 single-bracket LOW pre-tags → LOW final via class-precedent confirmation; same-bracket — NOT events.
- 3 closed-batch citations carry immutable class brackets (F-02-008 HIGH; F-02-020 MEDIUM; closed-batch-08 LOW) — class-bracket NOT adjudicated at batch-12; not events.

Adjudication 32 confirmed counter unchanged at 13.
