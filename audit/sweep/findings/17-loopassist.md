# Batch 17 — LoopAssist

**Session**: s56 (2026-05-17)
**HEAD pin at session start**: `2412c24d`
**Status**: Phase B audit complete; remediation deferred to Phase C.

---

## §1 Summary

### 1.1 Batch context

Batch 17 audits the entire LoopAssist surface — both staff-facing (looopassist-chat + looopassist-execute) and parent-facing (parent-loopassist-chat) — plus the marketing-chat fn that CENSUS §3.17 L432 attributes to batch-17 ("V2 plan §3.3 marks for cut; still in code"). AUDIT SCOPE COMPLETENESS per PLAN.md §3 rule 3: prior "shelved" framing removed at s41 correction; LoopAssist is fully IN-SWEEP for Phase B.

V2_PLAN.md §3.6 L301 verbatim (filesystem-verified at composition + Phase 0 + Phase 6 doc-write):

> ✅ LoopAssist scoped at launch (read-only enabled, destructive deferred)

This supersedes V2_PLAN.md §3.3 L186:

> **LoopAssist defer to v1.1.** It's a product-within-a-product. Launching with it makes the v1 surface harder to make coherent. Hide behind feature flag for launch; bring back in v1.1.

§3.6 L295 dated 2026-05-09 supersedes §3.3 L186. v1.0 launch scope = LoopAssist read-only scoped at launch with destructive operations gated. Batch-17 audit is therefore launch-blocker-tier; findings land in Phase C remediation cycle.

### 1.2 Pre/post tally

| Bracket | Pre s56 | Post s56 | Delta |
|---|---|---|---|
| Critical | 21 | **20** | -1 (PI-12 closed → F-17-001 HIGH bracket-shift) |
| High | 51 | **52** | +1 (F-17-001 + F-17-002 added; PI-12 + PI-16 closed) |
| Medium | 28 | 28 | 0 |
| Low | 84 | **91** | +7 (F-17-003 + F-17-004 + F-17-005 + F-17-006 + F-17-007 + F-17-008 + F-17-009) |
| **Total active** | **184** | **191** | **+7** |

PI cohort transitions: 5 → 3 (1C/3H/1M/0L → 0C/2H/1M/0L). PI-12 CRITICAL Active → RESOLVED via F-17-001. PI-16 HIGH Active → RESOLVED via F-17-002. PI-09 + PI-10 PARTIAL + PI-17 unchanged.

### 1.3 Path Y phase

Phase B (Systematic Audit): batches 01-16 complete entering s56; **17 of 21 complete at s56 close**. Batches 18 (settings-tabs; Zoom sub-deferred) + 19 (cross-cutting) + 20 (ux-flows) + 21 (marketing-surface; ZoomGuide sub-deferred) remain.

### 1.4 Scope IN/OUT (per launching prompt §7)

**IN**:
- 4 edge fns: `looopassist-chat`, `looopassist-execute`, `parent-loopassist-chat`, `marketing-chat` (CENSUS §3.16 L420-426 + §3.17 L432)
- 4 tables: `ai_action_proposals`, `ai_conversations`, `ai_interaction_metrics`, `ai_messages` (CENSUS §5.13 L836-843)
- 2 triggers: `audit_ai_action_proposals` + `update_ai_conversations_updated_at` (CENSUS §5.13 L840-841)
- 16 FE files (8 components/loopassist/ + 2 dashboard/ + 1 settings/ + 1 shared/ + 1 contexts/ + 3 hooks/) per CENSUS §9.12 L1152 + §9.13 L1158-1159
- 1 lib helper: `src/lib/action-registry.ts`

**OUT**:
- Closed-batch substrate (batches 01-16; immutable per PLAN.md §6)
- Zoom sub-surface (batch-18 carry-forward from batch-15 deferral)

### 1.5 Headline outcomes

- **PI-12 CRITICAL → F-17-001 HIGH RESOLVED** via class-precedent reassessment with F-03-004 operational-correctness CAPS chain. **Event #16 RATIFIED** (cumulative events 15 → 16; first event since #15 at s54).
- **PI-16 HIGH → F-17-002 HIGH RESOLVED** via same-bracket pre-tag confirmation (NOT event).
- **Capability #20 multi-org isolation P0** POSITIVE verified across 4/4 edge fns.
- **Capability #21 audit trail P1** MIXED-POSITIVE verified (universal `audit_ai_action_proposals` trigger coverage + 4/10 explicit `audit_log` + domain-specific surfaces; reschedule_lessons thinnest → F-17-008).
- **Capability #22 role gating destructive P0** POSITIVE verified (`ACTION_ROLE_PERMISSIONS` 10/10 MATCH vs `src/lib/action-registry.ts`).
- **Pattern #44 NEW PLACED single-anchor**: looopassist-chat 3-layer prompt-injection mitigation (sanitiseMessage + sanitiseForPrompt + sanitisePref). Catalog 37 → 38 PLACED.
- **Pattern #31 cohort enrichment 1 → 2**: bulk-process-continuation (s48 anchor) + looopassist-execute L80-245 (NEW s56 anchor). Documentation-only per placement-slot invariance.
- **Architectural-exception sub-class cohort 1 → 2**: ai_interaction_metrics (s49 precedent CENSUS L843) + ai_messages (s56 extension). Documentation-only.
- **CC-19 #4 ARCHITECTURAL N/A sub-shape cohort 1 → 2**: batch-14 (s53 anchor) + batch-17 (s56 extension). Documentation-only.
- **Drift #30.A 8th cumulative operational manifestation** ratified (Phase 1 §1.C unrestricted findings/*.md grep pre-empted F-17-NNN over-allocation against batch-05 helpers).
- **Drift #38 18/18 anchor 4-part attestation PASS** at Phase 5 §5.B (exceeds s55 16/16 baseline by +2 anchors).
- **Drift #36 STANDARD PROCEDURE 3rd operational application**: live-DB `SELECT pg_get_functiondef(oid) FROM pg_proc` on create_invoice_with_items + get_invoice_stats; ZERO body drift vs s44 close.
- **9 fresh F-17-NNN** contiguous (F-17-001 through F-17-009; 2H + 7L).

---

## §2 Surface inventory

### 2.1 Edge fns (4 total; 4730 lines)

Per CENSUS §3.16 L420-426 + §3.17 L432:

| Fn | Lines | Companion | Sentry wrap | CENSUS | Auth posture |
|---|---|---|---|---|---|
| `looopassist-chat` | 1852 | `knowledge-base.ts` (646L) | ✓ L1228 wrapEdgeFn | §3.16 L424 | auth-required |
| `looopassist-execute` | 1560 | — | ✓ L63 wrapEdgeFn | §3.16 L425 | auth-required |
| `parent-loopassist-chat` | 398 | — | ✓ L30 wrapEdgeFn | §3.16 L426 | auth-required (parent) |
| `marketing-chat` | 274 | — | ✗ bare `Deno.serve` L129 (→ F-17-006) | §3.17 L432 | public (V2 §3.3 marks for cut) |

### 2.2 FE surface (16 files)

| Path | Purpose | Batch attribution |
|---|---|---|
| `src/components/loopassist/ActionCard.tsx` | LoopAssist action proposal card UI | 17 |
| `src/components/loopassist/EntityChip.tsx` | Entity chip rendering | 17 |
| `src/components/loopassist/LoopAssistDrawer.tsx` | Main chat drawer (31909 bytes) | 17 |
| `src/components/loopassist/LoopAssistIntroModal.tsx` | First-run intro modal | 17 |
| `src/components/loopassist/MessageFeedback.tsx` | Feedback (thumb up/down → ai_interaction_metrics) | 17 |
| `src/components/loopassist/ProactiveAlerts.tsx` | Proactive alert panel | 17 |
| `src/components/loopassist/ProactiveWelcome.tsx` | Welcome state | 17 |
| `src/components/loopassist/ResultCard.tsx` | Action result rendering | 17 |
| `src/components/dashboard/LoopAssistAlerts.tsx` | Dashboard alert widget | 17 |
| `src/components/dashboard/LoopAssistWidget.tsx` | Dashboard summary widget | 17 |
| `src/components/settings/LoopAssistPreferencesTab.tsx` | Settings tab (per-org AI preferences) | 17 |
| `src/components/shared/LoopAssistPageBanner.tsx` | Cross-page banner | 17 |
| `src/contexts/LoopAssistContext.tsx` | LoopAssist React context | 17 |
| `src/hooks/useLoopAssist.ts` | Staff chat/execute hook | 17 (CENSUS §9.13 L1158) |
| `src/hooks/useLoopAssistFirstRun.ts` | First-run intro hook | 17 (CENSUS §9.13 L1159) |
| `src/hooks/useParentLoopAssist.ts` | Parent-side hook | 17 (CENSUS §9.12 L1152) |

### 2.3 Lib helpers

`src/lib/action-registry.ts` (99 lines): exports `ACTION_REGISTRY` (10-action map), `isDestructiveAction()`, `getAllowedRoles()`, `getActionLabel()`. Per audit/feature-catalogues/loopassist.md row #22 expectation, this is the canonical role-permission registry consumed by both FE and edge fns.

### 2.4 DB tables (4 ai_* tables; DB-state authoritative per Phase 1 §1.B)

| Table | Columns | CHECK | FKs | Indexes | RLS |
|---|---|---|---|---|---|
| `ai_action_proposals` | id+org_id+user_id+conversation_id+proposal(jsonb)+status+result(jsonb)+created_at+executed_at | status enum (proposed/confirmed/executing/executed/failed/cancelled) | org_id→organisations CASCADE; conversation_id→ai_conversations SET NULL | pkey + status + (user_id,org_id) | ENABLED (not forced); 3 PERMISSIVE policies (INSERT + SELECT + UPDATE; **UPDATE WITH_CHECK=NULL → F-17-003**) |
| `ai_conversations` | id+org_id+user_id+title+created_at+updated_at | — | org_id→organisations CASCADE | pkey + (user_id,org_id) | ENABLED (not forced); 4 PERMISSIVE policies (INSERT + SELECT + UPDATE + DELETE; **UPDATE WITH_CHECK=NULL → F-17-004**) |
| `ai_interaction_metrics` | id+org_id+message_id+conversation_id+user_id+feedback+**response_time_ms (NO positive CHECK → F-17-005)**+action_proposed+action_executed+created_at | feedback enum (helpful/not_helpful) | org_id→organisations CASCADE; message_id→ai_messages SET NULL; conversation_id→ai_conversations SET NULL | pkey + created_at + message_id + org_id | ENABLED (not forced); 3 PERMISSIVE policies (INSERT + 2 SELECT). 0 triggers — architectural-exception sub-class per CENSUS L843 |
| `ai_messages` | id+conversation_id+org_id+user_id+role+content+metadata+created_at | role enum (user/assistant/system) | org_id→organisations CASCADE; conversation_id→ai_conversations CASCADE | pkey + conversation_id | ENABLED (not forced); 2 PERMISSIVE policies (INSERT + SELECT only; append-only by RLS → architectural-exception sub-class extension §11.E) |

### 2.5 Triggers (2; per CENSUS §5.13 L840-841)

- `audit_ai_action_proposals` AFTER I/U/D on `ai_action_proposals` → `log_audit_event_singular` (universal proposal-lifecycle audit; underpins capability #21 MIXED-POSITIVE verdict)
- `update_ai_conversations_updated_at` BEFORE UPDATE on `ai_conversations` → `update_updated_at_column`

Note: `ai_interaction_metrics` + `ai_messages` have 0 triggers each. Per CENSUS L843 + s49 reviewing-Claude adjudication, ai_interaction_metrics 0-trigger is pre-adjudicated architectural-exception ("metrics IS the audit"). Phase 5 §5.E ratifies ai_messages as cohort extension ("conversation log IS the audit").

### 2.6 RPCs

**ZERO native batch-17 RPCs** (DB-verified Phase 1 §1.C; pg_proc regex `ai|loopassist|loop_assist|proposal|conversation` returned only cross-cutting helpers — no LoopAssist-semantic RPCs).

**Cross-batch helper SECDEFs invoked from batch-17 edge fns** (Phase 1 §1.C grep + Phase 1 drift #29 EXECUTE grant enumeration):

| Helper | Invocation site | SECDEF | Volatility | anon | auth | srv | Owning batch | Status |
|---|---|---|---|---|---|---|---|---|
| `create_invoice_with_items(uuid,date,uuid,uuid,text,uuid[],jsonb)` | looopassist-execute:722 (inside executeGenerateBillingRun) | TRUE | VOLATILE | TRUE | TRUE | TRUE | **batch-05** (CENSUS L524) | Pattern #10 dual-mode auth POSITIVE per findings/05 L825; drift #36 HEAD-verified §11.A |
| `get_invoice_stats(uuid)` | looopassist-chat:140 (inside buildLeanContext aggregate) | TRUE | STABLE | TRUE | TRUE | TRUE | **batch-05** (CENSUS L527) | Pattern #11 graceful-fail POSITIVE per findings/05 L826; drift #36 HEAD-verified §11.A |

Citation-only carries per closed-batch immutability + drift #30.A 8th cumulative manifestation pre-emption (§11.B).

### 2.7 Rate-limit registry (per `supabase/functions/_shared/rate-limit.ts`)

All 5 batch-17 rate-limit invocations are **registry-defined AND invoked** (Pattern #42 NEGATIVE counter-examples ×5; §11.J):

| Edge fn | Registry key | Limit | Invocation site |
|---|---|---|---|
| looopassist-chat | `looopassist-chat` | 20/min | L1299 `checkRateLimit(user.id, ...)` |
| looopassist-execute | `looopassist-execute` | 10/min | L97 `checkRateLimit(user.id, ...)` |
| parent-loopassist-chat | `parent-loopassist-chat` | 10/hr (custom config) | L67-70 `checkRateLimit(user.id, ..., { maxRequests:10, windowMinutes:60 })` |
| marketing-chat (IP) | `marketing-chat` | 20/hr | L148-152 |
| marketing-chat (global) | `marketing-chat-daily` | 1000/day | L171-175 |

Plus `checkLoopAssistDailyCap(orgId)` at looopassist-chat L1305 (per-org cost-control cap 200/day reading ai_messages via service-role with `.eq("org_id", orgId)` filter; orgId pre-validated at L1283-1289 via org_memberships).

---

## §3 Findings detail

### §3.1 F-17-001 HIGH — `executeRescheduleLessons` bypasses 5/7 conflict checks via bare PostgREST UPDATE (PI-12 closure)

| Field | Value |
|---|---|
| **ID** | F-17-001 |
| **Severity** | **HIGH** (PI-12 pre-tag CRITICAL → HIGH via class-precedent reassessment; **event #16 RATIFIED** per §6) |
| **Area** | LoopAssist edge fn body / lesson-reschedule handler / conflict-check bypass |
| **Phase surfaced** | Phase 2 §2.A handler #3 verbatim body trace + Phase 3 §3.B PI-12 closure adjudication |
| **Class** | operational-correctness — conflict-check-bypass-via-bare-UPDATE; CAPS-at-HIGH per class chain |
| **Class-precedent** (drift #38 4-part attestation) | Finding-ID: **F-03-004** / Verbatim severity: **HIGH** (event #2 s42 PI-11 Critical → HIGH adjustment) / Verbatim class-shape: "`check_lesson_conflicts` DB trigger enforces only 2 of 7 promised conflict checks; 5 app-layer-only and bypassable via ≥4 production-relevant non-FE paths" (findings/03 L49 + L174 + L181) / Verbatim batch attribution: **03-calendar-core** |

#### §3.1.1 Defect class-shape

> "LoopAssist `executeRescheduleLessons` handler invokes bare PostgREST `supabase.from('lessons').update({start_at, end_at}).eq('id', lesson.id)` instead of routing through a conflict-aware RPC (e.g. `check_lesson_conflicts`). Only the 2/7 conflicts implemented as BEFORE UPDATE triggers on lessons fire; the 5/7 RPC-side conflict checks (FE-routed via `check_lesson_conflicts(...)`) are bypassed."

#### §3.1.2 Evidence

**PI-12 verbatim seed** (STATUS.md L120):
> "PI-12 | Critical | LoopAssist `executeRescheduleLessons` bypasses ALL 7 conflict checks | `supabase/functions/looopassist-execute/index.ts` — bare `UPDATE lessons SET start_at, end_at`; DB trigger catches teacher/room only | 17-loopassist"

**Phase 2 verbatim handler trace** (`supabase/functions/looopassist-execute/index.ts:971-977`):
```typescript
const { error: updateError } = await supabase
  .from("lessons")
  .update({
    start_at: newStartAt.toISOString(),
    end_at: newEndAt.toISOString(),
  })
  .eq("id", lesson.id);
```

Lessons were fetched at L939-944 with `.eq("org_id", orgId).in("id", lessonIds).eq("status", "scheduled")` (org-scope verified). The UPDATE at L971-977 uses `.eq("id", lesson.id)` only — **does NOT invoke** `check_lesson_conflicts` RPC. Per PI-12 evidence verified by F-03-004 anchor at closed-batch-03: 2/7 conflicts caught by DB trigger; 5/7 RPC-checked. The bare UPDATE bypasses the RPC-side checks.

#### §3.1.3 6-dim adjudication vs F-03-004 anchor

- **D1 cross-tenant**: NO — Phase 2 §2.A user-scoped client + proposal.org_id validated upstream at L167-180 org_memberships active-role check
- **D2 reachability**: PARTIAL — authenticated owner/admin/teacher only (`ACTION_ROLE_PERMISSIONS reschedule_lessons: ['owner','admin','teacher']`)
- **D3 payload**: MATCH — bare UPDATE bypasses RPC-side conflict checks (5/7 bypassed; 2/7 trigger-gated unchanged) — class-shape parallel to F-03-004 anchor "5 app-layer-only and bypassable via ≥4 production-relevant non-FE paths"
- **D4 regulatory**: NO
- **D5 trust-erosion**: PARTIAL — user expectation that all 7 conflict checks enforced; only 2/7 enforced; visible-impact on scheduling integrity
- **D6 composition**: NO — composition probe negative across F-02-005 + F-02-002 + F-08-001 + F-02-008 chains (Phase 3 §3.C; lesson time-change does not compose to financial-falsification / child-PII / mass-credit-void / cross-tenant notification chains)

**Verdict**: HIGH per operational-correctness CAPS-at-HIGH class chain (F-03-004 + F-05-003 + F-05-004 + F-05-005 + F-06-005 + F-09-007 + F-10-002 cumulative chain). Class-precedent reassessment from CRITICAL pre-tag = event #16 (§6).

#### §3.1.4 Phase C remediation note

Replace bare PostgREST UPDATE in `executeRescheduleLessons` with conflict-aware RPC invocation OR add explicit pre-check via `check_lesson_conflicts` RPC. Deferred to Phase C; not in audit-only scope.

### §3.2 F-17-002 HIGH — `bulk_complete_lessons` marks lessons completed regardless of attendance state (PI-16 closure)

| Field | Value |
|---|---|
| **ID** | F-17-002 |
| **Severity** | **HIGH** (PI-16 pre-tag HIGH → F-17-002 HIGH; same-bracket pre-tag confirmation; NOT event per §18) |
| **Area** | LoopAssist edge fn body / bulk-complete-lessons handler / attendance-state validation gap |
| **Phase surfaced** | Phase 2 §2.A handler #10 verbatim body trace + Phase 3 §3.B PI-16 closure adjudication + Phase 4 §4.A.2 anchor refinement (F-05-003 → F-04-003) |
| **Class** | operational-correctness — cascade-completeness-asymmetry (bulk-handler omits step that single-row handler performs) |
| **Class-precedent** (drift #38 4-part attestation; refined Phase 4) | Finding-ID: **F-04-003** / Verbatim severity: **HIGH** / Verbatim class-shape: "`bulk_update_lessons` cancel-path is cascade-completeness-asymmetry vs single-row cancel-this-and-future cascade — steps 5-7 (recurrence end_date cap + fire-and-forget invoice/notify) omitted on bulk path" (findings/04 L53 + L107) / Verbatim batch attribution: **04-lessons-scheduling-deep** |

#### §3.2.1 Defect class-shape

> "LoopAssist `bulk_complete_lessons` handler marks lessons `status='completed'` based solely on `status='scheduled' AND start_at < cutoffDate` filter; does NOT verify attendance state of participants before completion. Single-row `mark_attendance` handler validates participant attendance pre-completion; bulk handler omits this validation step — cascade-completeness-asymmetric."

#### §3.2.2 Evidence

**PI-16 verbatim seed** (STATUS.md L124):
> "PI-16 | High | `bulk_complete_lessons` (LoopAssist) marks lessons completed regardless of attendance state | Bulk handler filters `eq(\"status\",\"scheduled\")` only; no participant attendance check | 17-loopassist"

**Phase 2 verbatim handler trace** (`supabase/functions/looopassist-execute/index.ts:405-421`):
```typescript
const { data: pastLessons } = await supabase
  .from("lessons")
  .select("id, title")
  .eq("org_id", orgId)
  .eq("status", "scheduled")
  .lt("start_at", `${cutoffDate}T00:00:00`)
  .limit(100);
// ... no attendance JOIN, no participant validation ...
await supabase.from("lessons").update({ status: "completed" })
  .in("id", lessonIds).eq("org_id", orgId);
```

No JOIN to `attendance_records`. No participant attendance state validation. Compared to single-row `executeMarkAttendance` handler (L1082-1188) which DOES validate participant attendance per-student via lesson_participants lookup + attendance_records UPSERT, then `audit_log` INSERT — the bulk handler omits the participant-validation step entirely.

#### §3.2.3 6-dim adjudication vs F-04-003 anchor

- **D1 cross-tenant**: NO — RLS-gated; user-scoped client + `.eq("org_id", orgId)` double-filter at fetch L405-411 + UPDATE L417-421
- **D2 reachability**: PARTIAL — authenticated owner/admin/teacher (`ACTION_ROLE_PERMISSIONS bulk_complete_lessons: ['owner','admin','teacher']` with destructive:true)
- **D3 payload**: MATCH — bulk handler omits attendance-state validation step that single mark_attendance handler performs; class-shape parallel to F-04-003 "bulk cancel-path omits steps 5-7 vs single-row cascade"
- **D4 regulatory**: NO
- **D5 trust-erosion**: MATCH — marketing claim per audit/feature-catalogues/loopassist.md row #10 "Mark lessons complete YES" violated by silent completion without attendance recording; user expects "mark attendance THEN mark complete" ordering
- **D6 composition**: NO

**Verdict**: HIGH per operational-correctness CAPS chain. Same-bracket pre-tag confirmation (PI-16 HIGH → F-17-002 HIGH). NOT event per §18.

#### §3.2.4 Anchor adequacy note

Phase 4 refined anchor F-05-003 → F-04-003. F-04-003 cascade-completeness-asymmetry class-shape is the closest class-shape match to PI-16 (bulk-handler-omits-validation-step). F-05-003 (state-machine completeness gap) was loose. Phase 5 §5.A re-verification confirmed F-04-003 anchor adequacy; no further refinement.

#### §3.2.5 Phase C remediation note

Add attendance-state validation to bulk_complete_lessons handler before UPDATE; reject lessons where any participant lacks attendance record. Deferred to Phase C.

### §3.3 F-17-003 LOW — `ai_action_proposals` UPDATE policy lacks explicit `WITH CHECK`

| Field | Value |
|---|---|
| **ID** | F-17-003 |
| **Severity** | LOW |
| **Area** | RLS policy hygiene / ai_action_proposals UPDATE policy |
| **Class-precedent** (drift #38 4-part attestation) | Finding-ID: **F-01-017** / Verbatim severity: **LOW** / Verbatim class-shape: "UPDATE/ALL policies on ~50 tables lack explicit `WITH CHECK` clause" (findings/01 L413) / Verbatim batch attribution: **01-auth-sessions-rls** |

#### §3.3.1 Defect class-shape + evidence

DB-verified Phase 1 §1.B:
- Policy: `"Staff can update own action proposals"` on `ai_action_proposals`
- USING: `(is_org_staff(auth.uid(), org_id) AND (user_id = auth.uid()))`
- WITH_CHECK: **NULL** (no explicit WITH CHECK clause)

USING-only policy means post-UPDATE row can violate the USING invariant. Class-shape match F-01-017 cohort precedent (F-12-004 + F-13-002 + F-14-005 + F-15-008 + ≥35 main entering s56).

**Cumulative cohort post-s56**: ≥35 → **≥36** (+1 batch-17).

### §3.4 F-17-004 LOW — `ai_conversations` UPDATE policy lacks explicit `WITH CHECK`

| Field | Value |
|---|---|
| **ID** | F-17-004 |
| **Severity** | LOW |
| **Area** | RLS policy hygiene / ai_conversations UPDATE policy |
| **Class-precedent** | Same as F-17-003 (F-01-017 cohort) |

DB-verified Phase 1 §1.B:
- Policy: `"Staff can update own conversations"` on `ai_conversations`
- USING: `(is_org_staff(auth.uid(), org_id) AND (user_id = auth.uid()))`
- WITH_CHECK: **NULL**

**Cumulative cohort post-s56**: ≥36 → **≥37** (+1 batch-17).

### §3.5 F-17-005 LOW — `ai_interaction_metrics.response_time_ms` lacks positive-amount CHECK

| Field | Value |
|---|---|
| **ID** | F-17-005 |
| **Severity** | LOW |
| **Area** | Schema column constraint hygiene / CC-19 #11 cohort enrichment |
| **Class-precedent** (drift #38 4-part attestation) | Finding-ID: **F-07-006** / Verbatim severity: **LOW** / Verbatim class-shape: "`public.invoice_installments.amount_minor` integer NOT NULL no positive CHECK; CC-19 #11 Schema column constraint hygiene" (findings/07 L20 + L448) / Verbatim batch attribution: **07-payment-plans-installments** |

#### §3.5.1 Defect class-shape + evidence

DB-verified Phase 1 §1.B:
- Column `response_time_ms` integer NULL on `ai_interaction_metrics`
- NO positive-amount CHECK constraint
- Inserted from edge fn body (no FE input)

Class-shape match CC-19 #11 cohort precedent chain (F-07-006 + F-07-007 + F-09-012 + F-10-004 + F-13-004 + F-14-006 + F-16-008 = 38 entering s56).

**Cumulative cohort post-s56**: 38 → **39** (+1 batch-17).

#### §3.5.2 Additional column-CHECK-absent sweep (Phase 3 §3.A.4)

Other batch-17 numeric/text columns evaluated; class-DISTINCT from CC-19 #11:

| Column | Reason class-distinct |
|---|---|
| `ai_action_proposals.proposal` jsonb | FE+edge-fn-bounded validation (looopassist-execute L196-209 entity count cap + UUID regex); class-DISTINCT from CC-19 #11 column-numeric-invariant class |
| `ai_messages.content` text | sanitiseMessage + sanitiseForPrompt cap by-context; class-DISTINCT |
| `ai_conversations.title` text default 'New conversation' | display-only; class-DISTINCT |

Single batch-17 anchor F-17-005 for CC-19 #11.

### §3.6 F-17-006 LOW — `marketing-chat` lacks `wrapEdgeFn` Sentry instrumentation

| Field | Value |
|---|---|
| **ID** | F-17-006 |
| **Severity** | LOW |
| **Area** | Sentry edge-fn instrumentation hygiene / CC-19 #10 cohort enrichment |
| **Class-precedent** (drift #38 4-part attestation) | Finding-ID: CC-19 #10 cohort (F-13 cleanup-orphaned-resources s52 anchor) / Verbatim severity: **LOW** (hygiene class) / Verbatim class-shape: "bare `Deno.serve` lacks `wrapEdgeFn` Sentry instrumentation wrap; observability gap" (findings/13 L515 + L564) / Verbatim batch attribution: **13-practice-resources** |

#### §3.6.1 Defect class-shape + evidence

Phase 1 §1.E + Phase 2 §2.D verbatim verification (`supabase/functions/marketing-chat/index.ts`):
- L1-6 imports: cors / supabase-js / rate-limit / sanitise-ai-input — **NO `import { wrapEdgeFn } from "../_shared/sentry.ts"`**
- L129: `Deno.serve(async (req) => {` — bare serve; no Sentry wrapper

Class-shape match precedent: cleanup-orphaned-resources (s52 batch-13) + send-push (s51 batch-12) + send-lesson-reminders (s51 batch-12) CC-19 #10 cohort.

**Cumulative cohort post-s56**: ~12 → **~13** (+1 batch-17).

#### §3.6.2 Phase C remediation note

Add `import { wrapEdgeFn } from "../_shared/sentry.ts"` + wrap `Deno.serve` body. Standard one-line fix. Deferred to Phase C.

### §3.7 F-17-007 LOW — PERMISSIVE-DEFAULT + silent-no-op-logs-as-executed audit-trail-integrity observation

| Field | Value |
|---|---|
| **ID** | F-17-007 |
| **Severity** | LOW |
| **Area** | LoopAssist edge fn body / role-permission fallback + default-case silent no-op |
| **Phase surfaced** | Phase 2 §2.G PERMISSIVE-DEFAULT execution body trace + Phase 3 §3.E.7 6-dim adjudication |
| **Class** | NEW class observation — AI-emitted-action-type silent-no-op-status-misrepresentation; audit-trail-integrity sub-class; defense-in-depth-bounded |
| **Anchor** | NEW class observation; no direct anchor. Class-distinction sound vs F-05-005 (silent-swallow), Pattern #41, CC-19 #6, CC-19 #14 (Phase 5 §5.A verified) |

#### §3.7.1 Defect class-shape

> "An LLM-emitted unknown `action_type` (not in the 10-action `ACTION_ROLE_PERMISSIONS` map at looopassist-execute L154-165) flows through the PERMISSIVE-DEFAULT fallback at L184 (`|| ['owner','admin']`) → owner/admin role gate → switch default case at L448-449 (sets result message 'acknowledged but not implemented' without performing work) → `newStatus='executed'` remains unchanged at L195 initial assignment → `ai_action_proposals.status='executed'` UPDATE at L508-517 → `audit_ai_action_proposals` trigger logs proposal as executed → `ai_messages` INSERT chat assistant message prefix '✓' at L527-533. The audit trail and chat surface report success; no write actually occurred."

#### §3.7.2 Evidence

Verbatim (`supabase/functions/looopassist-execute/index.ts:184`):
```typescript
const allowedRoles = ACTION_ROLE_PERMISSIONS[actionType] || ['owner', 'admin'];
```

Verbatim (`supabase/functions/looopassist-execute/index.ts:448-449`):
```typescript
default:
  result = { message: `Action type '${action_type}' acknowledged but not implemented` };
```

Trace:
- L195: `let newStatus = "executed";`
- L247-450: switch on action_type — 10 cases dispatch to handlers
- L448-449: default case sets result.message; does NOT throw; does NOT set result.outcome='no_op'; newStatus remains "executed"
- L475-477: outcome override `if (newStatus === "executed" && result.outcome === "no_op") { newStatus = "failed"; }` — default case doesn't set result.outcome, so newStatus stays "executed"
- L508-517: UPDATE ai_action_proposals SET status="executed", result, executed_at
- L527-533: INSERT ai_messages role="assistant" content=`✓ Action type 'X' acknowledged but not implemented`

#### §3.7.3 6-dim adjudication (Phase 5 §5.A re-verified)

- D1 cross-tenant: NO — proposal.org_id user-validated; ACTION_ROLE_PERMISSIONS owner/admin fallback bounded to caller's org
- D2 reachability: PARTIAL — authenticated owner/admin only; LLM-emitted hallucinated action_type required
- D3 payload: NO — default case doesn't perform write; just sets result message
- D4 regulatory: NO
- D5 trust-erosion: PARTIAL — audit `status='executed'` misrepresents but visible "not implemented" message reduces erosion
- D6 composition: NO

**Class-shape distinction (Phase 5 §5.A drift #35.B verification)**:
- vs F-05-005 silent-swallow: DISTINCT (visible "not implemented" message vs silent swallow)
- vs Pattern #41 cross-tenant action: DISTINCT (no caller-supplied identity bypass)
- vs CC-19 #6 org-context spoofing: DISTINCT (no org-context exploitation)
- vs CC-19 #14 claimed-service-role-gate misnaming: DISTINCT (no misnamed gate)

**Verdict**: LOW per defense-in-depth-bounded + visible-message class-distinction modulator.

#### §3.7.4 Phase C remediation note

Two surgical options: (a) replace `|| ['owner', 'admin']` with `|| []` to reject unknown action_types at role gate; (b) replace default case L448-449 with `throw new Error('Unknown action_type')` to land in catch-block at L451 → newStatus="failed". Either eliminates the silent-misrepresentation. Deferred to Phase C.

### §3.8 F-17-008 LOW — `executeRescheduleLessons` lacks lesson-layer `audit_log` INSERT

| Field | Value |
|---|---|
| **ID** | F-17-008 |
| **Severity** | LOW (partial-coverage modulator bracket-bottom of F-09-011 HIGH per s55 F-16-006 precedent) |
| **Area** | LoopAssist edge fn body / reschedule_lessons handler / audit-trail-thinness |
| **Phase surfaced** | Phase 2 §2.F capability #21 aggregated verdict (reschedule_lessons thinnest coverage) + Phase 3 §3.E.8 6-dim adjudication |
| **Class** | audit-trail-thinness with partial-coverage mitigation |
| **Class-precedent** (drift #38 4-part attestation) | Finding-ID: **F-09-011** / Verbatim severity: **HIGH** (bracket-bottom for F-17-008 via partial-coverage modulator) / Verbatim class-shape: "`public.term_continuation_runs` table has NO `audit_term_continuation_runs` AFTER INSERT/UPDATE/DELETE trigger; 4 of 7 state transitions unaudited" (findings/09 L19) / Verbatim batch attribution: **09-term-continuation** |

#### §3.8.1 Defect class-shape + evidence

`executeRescheduleLessons` handler (L920-1001) has NO explicit `audit_log` INSERT. Compared to 4/10 sibling handlers (bulk_complete_lessons + mark_attendance + cancel_lesson + complete_lessons) which DO write to `audit_log`, and 5/10 which write to domain-specific audit surfaces (billing_runs + message_log + make_up_credits), reschedule_lessons is the SINGLE handler with NEITHER `audit_log` NOR domain-specific audit surface beyond proposal-level + fire-and-forget calendar sync.

#### §3.8.2 Partial-coverage modulator (per s55 F-16-006 precedent)

Proposal-level audit via `audit_ai_action_proposals` AFTER I/U/D trigger (CENSUS §5.13 L840) captures:
- action_type (`reschedule_lessons`)
- entities (lesson IDs + labels)
- params (shift_minutes / new_start_time)
- result jsonb (lessons_updated count + per-lesson details + entities array)
- executed_at timestamp
- actor_user_id via proposal.user_id

This is structurally analogous to F-09-011 anchor's "manual `audit_log` INSERTs at create-continuation-run:339-350 ... cover 3 of 7 transitions" partial mitigation, but with greater coverage (100% of action context captured at proposal level vs F-09-011's 3/7).

#### §3.8.3 6-dim adjudication vs F-09-011 anchor

- D1 cross-tenant: NO
- D2 reachability: PARTIAL — authenticated owner/admin/teacher
- D3 payload: PARTIAL — lesson UPDATE; proposal-level audit covers universal action context
- D4 regulatory: NO
- D5 trust-erosion: PARTIAL — marketing claim "every action is logged" (audit/feature-catalogues/loopassist.md row #21) — proposal-level audit IS present; lesson-layer absent
- D6 composition: NO

**Verdict**: LOW per partial-coverage modulator (proposal-level audit MORE comprehensive than F-09-011's 3/7 manual audit_log; bracket-bottom of F-09-011 HIGH per s55 F-16-006 modulator precedent).

#### §3.8.4 Phase C remediation note

Add `audit_log` INSERT to executeRescheduleLessons body (parallel to L431-438 bulk_complete_lessons pattern). One-handler additive change. Deferred to Phase C.

### §3.9 F-17-009 LOW — 3 handlers UPDATE lessons without explicit `.eq("org_id", orgId)` double-filter (RLS-gated; DiD-weaker)

| Field | Value |
|---|---|
| **ID** | F-17-009 |
| **Severity** | LOW |
| **Area** | LoopAssist edge fn body / 3 lesson-UPDATE handlers / defense-in-depth observation |
| **Phase surfaced** | Phase 2 §2.A handler enumeration (reschedule + cancel + complete UPDATE pattern observation) + Phase 3 §3.E.9 6-dim adjudication |
| **Class** | NEW defense-in-depth-weaker observation; RLS-gated; security boundary intact |
| **Anchor** | NEW DiD-weaker observation; no direct anchor. Class-distinction sound vs Pattern #41, CC-19 #6, F-01-017 (Phase 5 §5.A verified) |

#### §3.9.1 Defect class-shape

> "3 LoopAssist handlers (executeRescheduleLessons L971-977 + executeCancelLesson L1232-1235 + executeCompleteLessons L1340-1343) issue `supabase.from('lessons').update(...).eq('id', lesson.id)` without explicit `.eq('org_id', orgId)` double-filter. RLS on lessons table enforces org-membership at UPDATE time so the security boundary is intact — but defense-in-depth weaker than the bulk_complete_lessons handler (L417-421) which DOES explicitly double-filter `.eq('org_id', orgId)`. TOCTOU-class observation: lesson was fetched with `.eq('org_id', orgId)` filter then UPDATE drops the filter."

#### §3.9.2 Evidence

Three handlers verbatim:

- executeRescheduleLessons L971-977: `.update({start_at, end_at}).eq("id", lesson.id)` — no double-org-filter
- executeCancelLesson L1232-1235: `.update({status: "cancelled"}).eq("id", lesson.id)` — no double-org-filter
- executeCompleteLessons L1340-1343: `.update({status: "completed"}).eq("id", lesson.id)` — no double-org-filter

Compare bulk_complete_lessons L417-421: `.update({status:"completed"}).in("id", lessonIds).eq("org_id", orgId)` — **DOES** double-filter (best-of-handlers pattern).

#### §3.9.3 6-dim adjudication

- D1 cross-tenant: NO — RLS on lessons table enforces org-membership at UPDATE time
- D2 reachability: NO — authenticated; bounded
- D3 payload: NO — single lesson UPDATE per call; RLS gates
- D4 regulatory: NO
- D5 trust-erosion: NO — security boundary intact
- D6 composition: NO

**Class-shape distinction (Phase 5 §5.A drift #35.B verification)**:
- vs Pattern #41: DISTINCT (no caller-supplied identity bypass; orgId pre-validated upstream)
- vs CC-19 #6: DISTINCT (no org-context spoofing)
- vs F-01-017: DISTINCT (RLS policy presence; this is HANDLER-side filter absence)

**Verdict**: LOW per defense-in-depth-weaker observation.

#### §3.9.4 Phase C remediation note

Add `.eq("org_id", orgId)` filter to 3 handler UPDATEs (parallel to bulk_complete_lessons pattern). 3 one-line additive changes. Deferred to Phase C.

---

## §3.10 Cross-batch observations (closed-batch citations + POSITIVE pattern observations; no F-17-NNN)

### §3.10 F-16-007 closed-batch-16 — marketing-chat 6th confirmed manifestation surface

**Drift #38 4-part attestation**:
- Finding-ID: **F-16-007**
- Verbatim severity: **MEDIUM**
- Verbatim class-shape: "Agency tier visibility V2_PLAN-FE divergence (V2_PLAN §3.6 L306 hidden + FE renders self-serve £79/mo)" (findings/16 L39 + §3.7 L342-353)
- Verbatim batch attribution: **16-subscription-tiers** (closed-batch immutable)

**Batch-17 contribution (6th confirmed manifestation surface)**: marketing-chat system prompt L38 hardcodes "Agency Plan — £79/month (or £790/year)". This extends F-16-007 surface enumeration:
1. (a) `src/lib/pricing-config.ts:207` PLAN_ORDER includes 'agency'
2. (b) `src/lib/pricing-config.ts:152-184` Agency PRICING_CONFIG £79/mo
3. (c) `src/components/settings/BillingTab.tsx:184` Agency self-serve PlanCard
4. (d) `src/components/subscription/TrialExpiredModal.tsx:83` Agency checkout button
5. (e) `supabase/functions/stripe-subscription-checkout/index.ts:46-49` STRIPE_PRICE_AGENCY_* env vars
6. (NEW s56) `supabase/functions/marketing-chat/index.ts:38` LLM system prompt hardcoded Agency £79/mo

CITATION-ONLY per closed-batch immutability PLAN.md §6; no fresh F-17-NNN.

### §3.11 Pattern #10 + Pattern #11 POSITIVE preserved at HEAD (drift #36 3rd operational application)

Per Phase 2 §2.E live-DB `SELECT pg_get_functiondef(oid)` execution on the 2 batch-17-invoked helper SECDEFs:

**create_invoice_with_items** (looopassist-execute:722; CENSUS L524 batch-05-billing-invoicing):
- LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
- Auth gate verbatim:
```
IF auth.uid() IS NOT NULL THEN
  IF NOT is_org_finance_team(auth.uid(), _org_id) THEN
    RAISE EXCEPTION 'Not authorised to create invoices for this organisation';
  END IF;
ELSIF current_setting('role', true) <> 'service_role' THEN
  RAISE EXCEPTION 'Not authorised: anonymous callers cannot create invoices' ...
END IF;
```
- **Pattern #10 dual-mode auth POSITIVE confirmed at HEAD**. Drift #38 4-part attestation: Pattern #10 (findings/05 L825) / NEGATIVE counter-example POSITIVE / "Dual-mode auth with explicit anon-reject branch — Pattern #9 + explicit `ELSIF current_setting('role') <> 'service_role' THEN RAISE` for anon callers" / 05-billing-invoicing. **ZERO body drift vs s44 close.**

**get_invoice_stats** (looopassist-chat:140; CENSUS L527 batch-05-billing-invoicing):
- LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
- Auth gate verbatim:
```
IF NOT is_org_staff(auth.uid(), _org_id) THEN
  RETURN '{}'::json;
END IF;
```
- **Pattern #11 graceful-fail POSITIVE confirmed at HEAD**. Drift #38 4-part attestation: Pattern #11 (findings/05 L826) / NEGATIVE counter-example POSITIVE / "Graceful-fail USE-CASE CONSTRAINED (dashboard/display-only `IF NOT is_org_*(...) THEN RETURN '{}'`)" / 05-billing-invoicing. **ZERO body drift vs s44 close.**

CITATION-ONLY per closed-batch immutability.

### §3.12 F-13-001 META 13-fn cohort cross-check (zero batch-17 matches)

Per Phase 4 §4.B verbatim re-verification of F-13-001 §3.1.3 13-fn enumeration (findings/13 L107):
- record_installment_payment (batch-07)
- record_stripe_payment (batch-02 F-02-005)
- 5 batch-08 fns (auto_issue_credit_on_absence + on_slot_released + auto_add_to_waitlist + notify_makeup_match_webhook + cleanup_attendance_on_cancel)
- cleanup_rate_limits + generate_invoice_number + set_invoice_number (cross-cutting)
- reset_stale_streaks + complete_expired_assignments (batch-13)
- find_waitlist_matches (batch-08 F-08-002)

**Neither create_invoice_with_items nor get_invoice_stats appears in this cohort.** AUTH-H5 META framework does not extend to batch-17. Citation-only carry per closed-batch-13 immutability.

### §3.13 ai_messages vs message_log surface distinction (POSITIVE: domain-appropriate audit surfaces preserved)

Per Phase 4 §4.C grep verification:

- **ai_messages** (batch-17 owned per CENSUS §5.13 L840): 1 INSERT in batch-17 fns — looopassist-execute L527 (assistant message after handler completion). User-scoped client.
- **message_log** (batch-12 owned; cross-batch consumer surface from batch-17): 4 INSERT touchpoints from batch-17 — looopassist-execute L1049 executeDraftEmail + L1513 executeSendProgressReport + indirect via dispatchInvoiceReminder helper (executeSendInvoiceReminders + send_bulk_reminders). All user-scoped client; RLS-enforced.

**Distinction confirmed**: distinct table schemas + distinct primary write surfaces; no collapse risk. POSITIVE pattern: batch-17 handlers route messaging actions through batch-12 message_log surface (domain audit) AND route chat assistant responses through ai_messages (LoopAssist-specific transcript). Domain-appropriate audit surfaces preserved.

### §3.14 useFeatureGate('loop_assist') 2 batch-17 FE consumer surfaces POSITIVE

Per Phase 4 §4.D verification — closed-batch-16 substrate at `src/hooks/useFeatureGate.ts:13` (Feature type) + L27 FEATURE_MATRIX entry `'loop_assist': ['trial','solo_teacher','academy','agency','custom']`:

- `src/components/settings/LoopAssistPreferencesTab.tsx:97` → `<FeatureGate feature="loop_assist">` wrapper
- `src/components/shared/LoopAssistPageBanner.tsx:17` → `const { hasAccess } = useFeatureGate('loop_assist');`

**POSITIVE pattern**: tier-gating consumer surface present. Citation-only carry per closed-batch immutability (batch-16 substrate); no fresh F-17-NNN.

### §3.15 Marketing claim accuracy verdicts (Phase 4 §4.E)

| Claim | Line | Verdict | Evidence |
|---|---|---|---|
| "Bank-level encryption (AES-256 at rest, TLS 1.3 in transit)" | L107 | ACCURATE | Supabase/Postgres baseline true |
| "Row-level security — organisations cannot see each other's data" | L108 | ACCURATE | Cumulative audit batches 01-17 RLS verification + Phase 1 12 RLS policies on 4 ai_* tables + Pattern #41 NEGATIVE counter-examples ×3 batch-17 |
| "GDPR compliant: right to access, export, and delete data" | L109 | ACCURATE | gdpr-export + gdpr-delete edge fns exist (verified `ls supabase/functions/`); functional readiness verified at batch-01 closure (s40) |
| "SOC 2 aligned practices" | L110 | NEEDS-QUALIFIER | qualifier "aligned" not "certified"; defensible at marketing; §11.L doc-write note |
| "Role-based access control (owner, admin, teacher, finance, parent)" | L113 | ACCURATE | AppRole enum verbatim from `src/contexts/AuthContext.tsx`: `'owner' \| 'admin' \| 'teacher' \| 'finance' \| 'parent'` (5 roles exact match) |

ZERO MISLEADING or FALSE marketing claims; ZERO fresh F-17-NNN from claim-accuracy probe.

### §3.16 ai_interaction_metrics 0-trigger architectural-exception (citation-only per CENSUS L843)

Per CENSUS L843 verbatim:
> "Batch-17 table-level attribution (added s49 Phase 10 Cat C): `ai_interaction_metrics` table — 0 triggers (architectural-exception sub-class candidate 'metrics IS the audit' per s49 Phase 1 §3 + Phase 6 §3 reviewing-Claude adjudication; writer-owned by batch-17)."

Pre-adjudicated architectural-exception sub-class precedent. CITATION-ONLY carry; no fresh F-17-NNN. Sub-class extension to ai_messages ratified at §11.E.

### §3.17 Pattern #41 batch-17 NEGATIVE counter-examples ×3 + NOT-APPLICABLE ×1

Per Phase 2 §2.A + §2.B + §2.C body-trace verification + Phase 3 §3.A vectors #10-#13 + Phase 5 §5.A re-verification:

| Edge fn | Pattern #41 verdict | Body-level identity validation evidence |
|---|---|---|
| looopassist-execute | **NEGATIVE counter-example** | L113-120 proposal fetch `.eq("user_id", user.id)` + L167-180 org_memberships active-role check against proposal.org_id |
| looopassist-chat | **NEGATIVE counter-example** | L1283-1289 org_memberships active-role check against body-supplied orgId BEFORE data access (parallel to s55 batch-16 stripe-subscription-checkout L124-134 NEGATIVE) |
| parent-loopassist-chat | **NEGATIVE counter-example** | orgId DERIVED from authenticated guardian record at L114 (NOT body-supplied); supabaseAdmin used for token verify only at L46-53; all data reads via supabaseUser at L60+ |
| marketing-chat | **NOT-APPLICABLE** | Public fn; no caller identity at all; no identity parameter to validate |

**Cumulative cross-batch NEGATIVE cohort**: 5 (batch-16 +2 stripe-subscription-checkout + onboarding-setup + batch-17 +3). Reinforces F-12-003 placement-reasoning sub-class on "auth-required + body-level membership-check" as defining contrast to F-12-003 anchor.

Pattern catalog 4 PLACED anchors UNCHANGED (no new placed instance; cross-batch NEGATIVE cohort enriches counter-example evidence). Drift #38 4-part attestation per F-12-003 + F-14-001 + F-15-001 + F-15-003 anchors per Phase 5 §5.B 18/18 PASS.

### §3.18 Pattern #42 batch-17 NEGATIVE counter-examples ×5 (all rate-limit registry-defined-AND-invoked)

Per Phase 1 §1.C + Phase 2 §2.B/§2.D + Phase 5 §5.A:

All 5 batch-17 rate-limit invocations are registry-defined AND invoked (see §2.7). 5/5 NO MATCH for Pattern #42 class-shape (registry-defined-but-uninvoked). Reinforces F-12-008 single-anchor candidate framing.

Pattern catalog 1 candidate UNCHANGED. Drift #38 4-part attestation per F-12-008 anchor.

---

## §4 Cross-batch reach map

### 4.1 Closed-batch citation list (Phase 4 §4.H final list; drift #30.A unrestricted grep verified)

| Cite | Anchor F-ID | Severity | Class-shape verbatim | Batch | Purpose |
|---|---|---|---|---|---|
| F-17-001 anchor | F-03-004 | HIGH | "check_lesson_conflicts DB trigger enforces only 2 of 7 promised conflict checks; 5 app-layer-only and bypassable" | 03-calendar-core | Class-precedent reassessment for event #16 |
| F-17-002 anchor | F-04-003 | HIGH | "bulk_update_lessons cancel-path is cascade-completeness-asymmetry vs single-row cancel-this-and-future cascade — steps 5-7 omitted on bulk path" | 04-lessons-scheduling-deep | Bulk-handler-asymmetric-step-omission class-shape match |
| F-17-003 + F-17-004 cohort | F-01-017 | LOW | "UPDATE/ALL policies on ~50 tables lack explicit WITH CHECK clause" | 01-auth-sessions-rls | Cohort enrichment ≥35 → ≥37 |
| F-17-005 cohort | F-07-006 | LOW | "integer NOT NULL no positive CHECK; schema-level invariant absence" | 07-payment-plans-installments | CC-19 #11 cohort 38 → 39 |
| F-17-006 cohort | CC-19 #10 (F-13 cleanup-orphaned-resources) | LOW | "bare Deno.serve lacks wrapEdgeFn Sentry instrumentation" | 13-practice-resources | CC-19 #10 cohort ~12 → ~13 |
| F-17-008 anchor | F-09-011 | HIGH (bracket-bottom modulator) | "table has NO audit_* AFTER I/U/D trigger; N of M state transitions unaudited; partial mitigation N/M via manual audit_log INSERTs" | 09-term-continuation | Partial-coverage modulator class-shape parallel |
| Marketing-chat Agency 6th surface | F-16-007 | MEDIUM | "Agency tier visibility V2_PLAN-FE divergence per V2_PLAN.md §3.6 L306 'Agency hidden ('Contact us')' + FE renders self-serve £79/mo" | 16-subscription-tiers | 6th confirmed manifestation surface |
| Helper SECDEF citation | Pattern #10 (findings/05 L825) | POSITIVE | "Dual-mode auth with explicit anon-reject branch" | 05-billing-invoicing | Pattern #10 body HOLDS unchanged at HEAD (drift #36) |
| Helper SECDEF citation | Pattern #11 (findings/05 L826) | POSITIVE | "Graceful-fail USE-CASE CONSTRAINED" | 05-billing-invoicing | Pattern #11 body HOLDS unchanged at HEAD (drift #36) |
| Architectural-exception sub-class | ai_interaction_metrics (CENSUS L843; s49 reviewing-Claude adjudication) | (sub-class) | "metrics IS the audit; 0 triggers by-design; terminal-audit-via-table" | s49 sub-class precedent | Cohort 1 → 2 retrofit (ai_messages extension §11.E) |
| CC-19 #4 ARCHITECTURAL N/A sub-shape | F-14 sub-shape (s53 anchor; findings/14 L938-942) | (sub-shape) | "permissions enforced via routing-layer gate + RLS-as-SSOT; no UI-layer affordance gating" | 14-bookings-leads-enrolment | Cohort 1 → 2 sub-shape extension §11.F |
| Pattern #41 PLACED anchors | F-12-003 + F-14-001 + F-15-001 + F-15-003 | various | "edge fn has auth-required gate; body accepts caller-supplied identity; body performs action with NO body-level validation that caller is authorized" | various closed batches | 3 batch-17 NEGATIVE counter-examples reinforce placement |
| Pattern #42 single-anchor candidate | F-12-008 | LOW | "Registry-defined-but-uninvoked rate-limit key" | 12-messages-notifications | 5 batch-17 NEGATIVE counter-examples reinforce single-anchor |
| AUTH-H5 META cohort | F-13-001 | CRITICAL META | "13-fn cohort spanning batches 02 + 07 + 08 + 13 + cross-cutting helpers" | 13-practice-resources | Zero batch-17 cohort matches |
| useFeatureGate('loop_assist') substrate | batch-16 (findings/16 §10 + L295 + handover §11) | (substrate) | "FEATURE_MATRIX 'loop_assist' entry + batch-17 FE 2 consumer surfaces" | 16-subscription-tiers | POSITIVE tier-gating gate present |

### 4.2 Cross-batch substrate dependencies

- `ai_action_proposals` → `organisations` (FK ON DELETE CASCADE; batch-02 closed substrate)
- `ai_conversations` → `organisations` (FK ON DELETE CASCADE; batch-02 closed substrate)
- `ai_interaction_metrics` → `organisations` + `ai_messages` + `ai_conversations` (FKs)
- `ai_messages` → `organisations` + `ai_conversations` (FKs)
- looopassist-execute action handlers consume: rate_cards (batch-05) + lessons (batch-03) + invoices (batch-05) + invoice_items (batch-05) + billing_runs (batch-05) + organisations (batch-02) + lesson_participants (batch-03) + students (batch-02) + attendance_records (batch-08) + make_up_credits (batch-08) + practice_streaks (batch-13) + practice_logs (batch-13) + guardians (batch-02) + student_guardians (batch-02) + term_adjustments (batch-09) + message_log (batch-12)
- looopassist-chat tool catalogue consumes: students + lessons + invoices + teachers + lesson_participants + attendance_records + practice_streaks + practice_logs + make_up_credits + term_adjustments + practice_assignments + locations + payments + student_instruments + grade_levels + exam_boards + instruments + student_teacher_assignments + organisations
- parent-loopassist-chat consumes: guardians + students + student_guardians + lesson_participants + lessons + attendance_records + practice_streaks + invoices + organisations + locations

All cross-batch reads use user-scoped Supabase client → RLS-enforced. No service-role bypass; no body-level identity gap (Pattern #41 NEGATIVE counter-examples ×3 per §3.17).

### 4.3 Pattern catalog enrichments (per §10 + §11)

- **Pattern #31 cohort 1 → 2**: bulk-process-continuation (s48 batch-09 anchor) + looopassist-execute L80-245 (s56 anchor). Documentation-only per placement-slot invariance s47+. See §11.H.
- **Pattern #44 NEW PLACED single-anchor**: looopassist-chat 3-layer prompt-injection mitigation. Catalog 37 → 38 PLACED. See §11.G.
- **Architectural-exception sub-class cohort 1 → 2**: ai_interaction_metrics + ai_messages. Documentation-only. See §11.E.
- **CC-19 #4 ARCHITECTURAL N/A sub-shape cohort 1 → 2**: batch-14 + batch-17. Documentation-only. See §11.F.

---

## §5 PI-12 + PI-16 closure documentation

### 5.1 PI-12 CRITICAL → F-17-001 HIGH RESOLVED

**Verbatim seed** (STATUS.md L120):
> "PI-12 | Critical | LoopAssist `executeRescheduleLessons` bypasses ALL 7 conflict checks | `supabase/functions/looopassist-execute/index.ts` — bare `UPDATE lessons SET start_at, end_at`; DB trigger catches teacher/room only | 17-loopassist | Awaiting batch (IN-SWEEP per s41 discipline correction)"

**s41 discipline correction precedent** (findings/01 L69-71):
> "PI-12 (LoopAssist `executeRescheduleLessons` bypasses all 7 conflict checks — `STATUS.md` §5.3) classification confirmed Critical per the same rubric application as `F-01-002` (`F7a`): security/integrity exposure + production data corruption + first-encounter trust erosion. `(deferred-shelved)` is a tracking status, not a severity demotion."

**Phase 2 evidence verification (concern persistence at HEAD)**: CONFIRMED — bare PostgREST UPDATE pattern persists at executeRescheduleLessons L971-977 (see §3.1.2).

**Closure decision**: **PI-12 Active → RESOLVED via F-17-001 HIGH allocation**. Bracket adjudication per class-precedent reassessment with F-03-004 operational-correctness CAPS chain (event #16; §6).

### 5.2 PI-16 HIGH → F-17-002 HIGH RESOLVED

**Verbatim seed** (STATUS.md L124):
> "PI-16 | High | `bulk_complete_lessons` (LoopAssist) marks lessons completed regardless of attendance state | Bulk handler filters `eq(\"status\",\"scheduled\")` only; no participant attendance check | 17-loopassist | Awaiting batch (IN-SWEEP per s41 discipline correction)"

**Phase 2 evidence verification (concern persistence at HEAD)**: CONFIRMED — bulk_complete_lessons handler L405-421 filters by `status='scheduled'` + cutoffDate; no JOIN to attendance_records; no participant validation (see §3.2.2).

**Closure decision**: **PI-16 Active → RESOLVED via F-17-002 HIGH allocation**. Same-bracket pre-tag confirmation (HIGH → HIGH); NOT event per §18.

### 5.3 PI cohort transition

| PI | Pre s56 | Post s56 | Status |
|---|---|---|---|
| PI-09 | HIGH Active | HIGH Active | UNCHANGED (batch-19 owned; no enrichment since s48) |
| PI-10 | HIGH PARTIAL-HANDOVER | HIGH PARTIAL-HANDOVER | UNCHANGED (calendar-sync addressed s54; Zoom sub-surface at batch-18) |
| PI-12 | CRITICAL Active | **RESOLVED via F-17-001 HIGH** | CLOSED at s56 |
| PI-16 | HIGH Active | **RESOLVED via F-17-002 HIGH** | CLOSED at s56 |
| PI-17 | MEDIUM Active | MEDIUM Active | UNCHANGED (batch-19 owns canonical closure) |

**PI cohort 5 → 3** (1C/3H/1M/0L → 0C/2H/1M/0L).

---

## §6 Severity-adjustment event #16 ratification

### 6.1 Event #16: PI-12 CRITICAL ↓ HIGH via class-precedent reassessment

| Criterion | Status |
|---|---|
| Pre-tag bracket: PI-12 CRITICAL | CONFIRMED (STATUS.md L120 verbatim) |
| Final bracket: F-17-001 HIGH per 6-dim + CAPS chain | CONFIRMED (Phase 3 §3.E.1 + Phase 4 §4.A.1 + Phase 5 §5.A) |
| Bracket-shift: CRITICAL → HIGH = DIFFERENT bracket | CONFIRMED per §18 methodology |
| Driver type: class-precedent reassessment (not composition-discovery) | CONFIRMED per F-08-003 (#11) + F-09-007 (#12) + F-10-002 (#13) kin chain |
| Composition probe negative | CONFIRMED (Phase 3 §3.C; F-02-005 + F-02-002 + F-08-001 + F-02-008 chains all NO MATCH) |
| Class-precedent chain: operational-correctness CAPS-at-HIGH | CONFIRMED per F-03-004 + F-05-003 + F-05-004 + F-05-005 + F-06-005 + F-09-007 + F-10-002 cumulative chain (PLAN.md §4.1 + handover §9) |

**Verdict: RATIFIED event #16**. Driver type: class-precedent reassessment.

### 6.2 Cumulative events post-s56

| # | Session | Direction | Driver |
|---|---|---|---|
| 1-15 | s41-s54 | (carry-forward) | (per PLAN.md §4.1 + handover §9) |
| **16** | **s56** | **CRITICAL ↓ HIGH** | **class-precedent reassessment with F-03-004 operational-correctness CAPS chain (PI-12 → F-17-001)** |

**Cumulative events: 15 → 16**. First event since #15 at s54 (F-15-001 xero OAuth composition-CRITICAL).

---

## §7 Capability matrix closures (audit/feature-catalogues/loopassist.md vectors #14/#15/#16)

### 7.1 Capability #20 multi-org isolation P0 — POSITIVE VERIFIED

| Edge fn | Verdict | Evidence |
|---|---|---|
| looopassist-execute | POSITIVE | All 10 handlers user-scoped client + proposal.org_id validated upstream (L113-120) + org_memberships active-role check (L167-180) + entity ownership validation (L211-245) |
| looopassist-chat | POSITIVE | org_memberships validated against body-supplied orgId BEFORE data access (L1283-1289) + all 12 tools `.eq("org_id", orgId)`-filtered + RBAC role restrictions per tool |
| parent-loopassist-chat | POSITIVE | orgId derived from authenticated guardian record (L114) + supabaseUser (RLS-enforced) for ALL 6 data reads |
| marketing-chat | N/A | Public fn; no tenant data accessed |

**Capability #20 PASSES at HEAD**. Closes audit/feature-catalogues/loopassist.md row #20 "should be — needs verification" → CONFIRMED POSITIVE.

### 7.2 Capability #21 audit trail P1 — MIXED-POSITIVE VERIFIED

Universal proposal-level audit via `audit_ai_action_proposals` AFTER I/U/D trigger (CENSUS §5.13 L840) covers ALL 10 action handlers. Domain-specific audit surfaces by handler:

| Handler | audit_log | message_log | billing_runs | make_up_credits | Proposal trigger |
|---|---|---|---|---|---|
| generate_billing_run | ✗ | ✗ | ✓ | ✗ | ✓ |
| send_invoice_reminders | ✗ | ✓ (via helper) | ✗ | ✗ | ✓ |
| **reschedule_lessons** | **✗** | **✗** | **✗** | **✗** | **✓** (thinnest → F-17-008) |
| draft_email | ✗ | ✓ | ✗ | ✗ | ✓ |
| mark_attendance | ✓ | ✗ | ✗ | ✗ | ✓ |
| cancel_lesson | ✓ | ✗ | ✗ | ✓ | ✓ |
| complete_lessons | ✓ | ✗ | ✗ | ✗ | ✓ |
| send_progress_report | ✗ | ✓ | ✗ | ✗ | ✓ |
| send_bulk_reminders | ✗ | ✓ (via helper) | ✗ | ✗ | ✓ |
| bulk_complete_lessons | ✓ | ✗ | ✗ | ✗ | ✓ |

**Capability #21 PASSES with caveat**: reschedule_lessons thinnest audit coverage → F-17-008 LOW partial-coverage modulator. Marketing claim "every action is logged" technically held at proposal layer; lesson-layer addition is hygiene.

### 7.3 Capability #22 role gating destructive P0 — POSITIVE VERIFIED

- `ACTION_ROLE_PERMISSIONS` map at looopassist-execute L154-165 (10 entries) verified verbatim against `src/lib/action-registry.ts` `ACTION_REGISTRY` L20-81 (10 entries): **10/10 MATCH** (Phase 1 §1.D)
- Role enforcement at L167-191: org_memberships active-role check + `allowedRoles.includes(membership.role)` BEFORE switch dispatch — no bypass via early-return or before-role-check writes
- 3 destructive actions (`generate_billing_run` + `cancel_lesson` + `bulk_complete_lessons` per `isDestructiveAction()`) require finance/owner/admin or owner/admin or owner/admin/teacher per ACTION_REGISTRY destructive:true flag
- PERMISSIVE-DEFAULT at L184 bounded by upstream role gate; unknown action_type still requires owner/admin role to reach silent-no-op default case (→ F-17-007 LOW observation)

**Capability #22 PASSES**. Closes audit/feature-catalogues/loopassist.md row #22 "unknown — needs verification" → CONFIRMED POSITIVE.

---

## §8 Cross-batch helper-fn invocations

Two helper SECDEFs invoked from batch-17 edge fns; both closed-batch-05 owned; both POSITIVE preserved at HEAD per drift #36 standard procedure:

### 8.1 create_invoice_with_items (Pattern #10 dual-mode auth)

- Invocation: `supabase/functions/looopassist-execute/index.ts:722` (inside `executeGenerateBillingRun` per-payer loop)
- CENSUS attribution: L524 batch-05-billing-invoicing
- Drift #29 EXECUTE grants: anon=TRUE + auth=TRUE + service_role=TRUE
- Pattern #10 dual-mode auth body POSITIVE confirmed at HEAD (§3.11 + §11.A; drift #36 3rd operational application)

### 8.2 get_invoice_stats (Pattern #11 graceful-fail)

- Invocation: `supabase/functions/looopassist-chat/index.ts:140` (inside `buildLeanContext` aggregate parallel)
- CENSUS attribution: L527 batch-05-billing-invoicing
- Drift #29 EXECUTE grants: anon=TRUE + auth=TRUE + service_role=TRUE
- Pattern #11 graceful-fail body POSITIVE confirmed at HEAD (§3.11 + §11.A; drift #36 3rd operational application)

Both helpers are citation-only carries per closed-batch immutability. AUTH-H5 META cohort cross-check at §3.12 confirms zero batch-17 helper SECDEFs match F-13-001 13-fn cohort.

---

## §9 STATUS.md PI register update

Per Phase 3 §3.B + §5 closure documentation:

| PI | Severity | Owning batch | Status (pre s56) | Status (post s56) |
|---|---|---|---|---|
| PI-09 | HIGH | 19 | Active | Active (UNCHANGED) |
| PI-10 | HIGH | 15 + 18 | PARTIAL-HANDOVER (s54) | PARTIAL-HANDOVER (UNCHANGED; Zoom sub-surface to batch-18) |
| PI-12 | CRITICAL | 17 | Active | **RESOLVED via F-17-001 HIGH** (event #16) |
| PI-16 | HIGH | 17 | Active | **RESOLVED via F-17-002 HIGH** (same-bracket; NOT event) |
| PI-17 | MEDIUM | 08 + 19 partial | Active | Active (UNCHANGED) |

**PI cohort 5 → 3** (1C/3H/1M/0L → 0C/2H/1M/0L).

---

## §10 Pattern catalog matrix (post-s56)

### 10.1 Pattern catalog state

| Cohort | Pre s56 | Post s56 | Delta | Notes |
|---|---|---|---|---|
| PLACED slots | 37 | **38** | +1 | Pattern #44 NEW PLACED single-anchor (looopassist-chat 3-layer prompt-injection) |
| Candidates | 6 | 6 | UNCHANGED | #26 + #29 + #34 + #37 + #39 + #42 |
| Sub-class introductions | 8 | 8 | UNCHANGED | cohort enrichments per placement-slot invariance |
| NEGATIVE-instance flag | 1 | 1 | UNCHANGED | Pattern #27 sub-B PortalContinuation:71 |
| Pattern #31 cohort | 1 | **2** | +1 | bulk-process-continuation s48 + looopassist-execute s56 NEW anchor |
| Architectural-exception sub-class cohort | 1 | **2** | +1 | ai_interaction_metrics s49 + ai_messages s56 extension |
| CC-19 #4 ARCHITECTURAL N/A sub-shape cohort | 1 | **2** | +1 | batch-14 s53 + batch-17 s56 extension |
| Pattern #41 PLACED anchors | 4 | 4 | UNCHANGED | 3 batch-17 NEGATIVE counter-examples reinforce placement |
| Pattern #41 RLS-policy substrate sub-class | 2 | 2 | UNCHANGED | F-05-001 + F-15-002 cohort-evidence retrofit |
| Pattern #42 single-anchor candidate | 1 | 1 | UNCHANGED | 5 batch-17 NEGATIVE counter-examples reinforce single-anchor |

### 10.2 CC-19 # carries cumulative post-s56

| CC-19 # | Description | Batch-17 contribution | Cumulative |
|---|---|---|---|
| #1 | Helper-fn EXECUTE-grant hygiene | +0 (2 helper SECDEFs closed-batch-05 citation-only) | ~15 unchanged |
| #3 | audit_log INSERT integrity gap | +0 batch-17 enumeration; architectural-exception sub-class extension to ai_messages §11.E | ACTIVE-mixed unchanged |
| #4 | useCan unimplementation | +0 (ARCHITECTURAL N/A sub-shape extension batch-17; §11.F) | ≥218 unchanged |
| #6 | Org-context spoofing | +0 (3 NEGATIVE counter-examples + 1 N/A per §3.17) | ~49 unchanged |
| #7 Sub-A | TS literal cast | NOT sweep'd batch-17 | ~416 unchanged |
| #7 Sub-D2 | TS callback cast | NOT sweep'd batch-17 | ~25 unchanged |
| #7 Sub-E | TS catch-block hygiene | NOT sweep'd batch-17 | 43 unchanged |
| #8 | E2E fixture hygiene | NOT sweep'd batch-17 | 471/5/30 baseline |
| #10 | Sentry edge-fn instrumentation | **+1 batch-17 (F-17-006 marketing-chat)** | **~12 → ~13** |
| #11 | column-CHECK-absent | **+1 batch-17 (F-17-005 ai_interaction_metrics.response_time_ms)** | **38 → 39** |
| #13 | PERMISSIVE-as-RESTRICTIVE | +0 batch-17 | 6 bifurcated + 4 INERT unchanged |
| #14 | Claimed-service-role-gate | +0 batch-17 | 2 anchors unchanged |
| #15 | Dead-code SECDEF + orphans | +0 batch-17 | 6 unchanged |
| #16 | Rate-limit-key-mismatch | +0 batch-17 (5/5 NEGATIVE counter-examples per §3.18) | 3 cohort unchanged |
| F-01-017 | UPDATE-no-WITH-CHECK | **+2 batch-17 (F-17-003 + F-17-004)** | **≥35 → ≥37** |
| Pattern #41 | cross-tenant action via unvalidated identity | +0 (3 NEGATIVE + 1 N/A; 4 PLACED anchors unchanged) | 4 anchors unchanged |
| Pattern #42 | registry-defined-but-uninvoked | +0 (5 NEGATIVE counter-examples reinforce single-anchor) | 1 candidate unchanged |
| POS-5 | _activity-sibling-table | +0 (no batch-17 instances) | 2-anchor pair unchanged |
| Internal-trust observation | streak-notification sole anchor | +0 (no batch-17 internal-trust gated paths) | 1 sole anchor unchanged |

---

## §11 Audit-method appendix

### §11.A Drift #36 STANDARD PROCEDURE 3rd operational application

Per s52 ratification + s53 promotion to "standard Phase 2 procedure entering batch 15+" + s54 1st application + s55 2nd application: every Phase 2 dispatch for batch 16+ includes explicit task line for live-DB body verification via `SELECT pg_get_functiondef(p.oid) FROM pg_proc p` on materially load-bearing SECDEF RPC body claims.

**s56 batch-17 3rd operational application**: Phase 2 §2.E fetched both batch-17-invoked helper SECDEF bodies via live `pg_get_functiondef`:

- `create_invoice_with_items` body verbatim verified — Pattern #10 dual-mode auth POSITIVE per findings/05 L825 anchor; **ZERO body drift vs s44 close**
- `get_invoice_stats` body verbatim verified — Pattern #11 graceful-fail USE-CASE CONSTRAINED POSITIVE per findings/05 L826 anchor; **ZERO body drift vs s44 close**

**2/2 PASS zero divergence**. Drift #36 standard procedure remains operational entering batch 18+.

### §11.B Drift #30.A 8th cumulative operational manifestation

Drift #30.A OPERATIONAL CARRY (NEW s50 mandate; scope-refined s50 Phase 1 + Phase 6): unrestricted findings/*.md grep applies at ANY phase where closed-batch coverage is relevant.

**Cumulative manifestations entering s56: 7** (s50 #1+#2 + s52 #3 + s53 #4 + s54 #5 + s55 #6+#7).

**Manifestation #8 at s56 Phase 1.C**:

- **Mechanism**: Phase 1 §1.C drift #29 EXECUTE grant enumeration surfaced 2 helper SECDEFs (create_invoice_with_items + get_invoice_stats) with anon=TRUE EXECUTE
- **Pre-emption**: Unrestricted findings/*.md grep at Phase 1 §1.C surfaced existing batch-05 attribution (CENSUS L524 + L527) + Pattern #10/#11 POSITIVE precedents (findings/02 L1313 + findings/05 L665 + L825-826 + findings/08 L82 + findings/10 L170). Both helpers documented as Pattern #10/#11 POSITIVE; closed-batch immutable. Zero fresh F-17-NNN allocated.
- **Class-shape match precedent**: drift #30.A 6th + 7th cumulative manifestations (s55 Phase 3.1 F-02-001 + Phase 3.4 F-05-001 catches; same mechanism — unrestricted grep pre-empts over-allocation against closed-batch CRITICAL anchors via existing finding attribution)

**Cumulative manifestations post-s56: 8**. Documentation-only mitigation counter increment.

### §11.C Drift #38 18/18 anchor 4-part attestation PASS

Drift #38 OPERATIONAL CARRY (NEW s54 mandate): every class-anchor citation in ANY phase requires finding-ID + verbatim severity + verbatim class-shape one-liner + verbatim batch attribution from anchor doc.

**Phase 5 §5.B verification** ran unrestricted `audit/sweep/findings/*.md` grep on every anchor citation in this finding doc (18 total):

| # | Anchor | PASS? |
|---|---|---|
| 1 | F-03-004 (F-17-001) | ✓ |
| 2 | F-04-003 (F-17-002 refined) | ✓ |
| 3 | F-01-017 (F-17-003 + F-17-004) | ✓ |
| 4 | F-07-006 (F-17-005) | ✓ |
| 5 | CC-19 #10 / F-13 cleanup-orphaned-resources (F-17-006) | ✓ |
| 6 | F-09-011 (F-17-008) | ✓ |
| 7 | F-16-007 (marketing-chat 6th surface) | ✓ |
| 8 | Pattern #10 (create_invoice_with_items) | ✓ |
| 9 | Pattern #11 (get_invoice_stats) | ✓ |
| 10 | ai_interaction_metrics architectural-exception (CENSUS L843 + findings/10) | ✓ |
| 11 | F-14 CC-19 #4 ARCHITECTURAL N/A sub-shape | ✓ |
| 12 | F-12-003 Pattern #41 PLACED | ✓ |
| 13 | F-14-001 Pattern #41 PLACED | ✓ |
| 14 | F-15-001 Pattern #41 PLACED | ✓ |
| 15 | F-15-003 Pattern #41 PLACED | ✓ |
| 16 | F-12-008 Pattern #42 single-anchor candidate | ✓ |
| 17 | F-13-001 AUTH-H5 META cohort | ✓ |
| 18 | useFeatureGate('loop_assist') batch-16 substrate | ✓ |

**18/18 PASS** at Phase 5 (exceeds s55 16/16 baseline by +2 anchors due to F-17-002 anchor refinement adding F-04-003 + retention of architectural-exception sub-class + ARCHITECTURAL N/A sub-shape extensions). Zero drift #38 cite failures.

### §11.D Event #16 RATIFICATION — PI-12 CRITICAL ↓ HIGH class-precedent reassessment

See §6.1-§6.2 for full ratification chain.

Driver type: class-precedent reassessment (kin to event #11 F-08-003 + event #12 F-09-007 + event #13 F-10-002; NOT composition-discovery escalation events #9 + #10 + #14 + #15).

Class-precedent chain (operational-correctness CAPS-at-HIGH): F-03-004 (s42 #2) + F-05-003 (s44 #5) + F-05-004 (s44 #6) + F-05-005 (s44 #7) + F-06-005 (s45 #8) + F-09-007 (s48 #12) + F-10-002 (s49 #13).

Composition-discovery escalation probe (s56 Phase 3 §3.C): zero composition paths fire across F-02-005 + F-02-002 + F-08-001 + F-02-008 chains. Bracket lands HIGH; event #16 ratified.

### §11.E Architectural-exception sub-class extension (ai_messages cohort 1 → 2)

**Sub-class precedent (s49)**: ai_interaction_metrics architectural-exception sub-class candidate "metrics IS the audit" per CENSUS L843 + s49 Phase 1 §3 + Phase 6 §3 reviewing-Claude adjudication. Class-DISTINCT from CC-19 #3 main class.

**Sub-class extension (s56) — ai_messages**:

DB-verified Phase 1 §1.B: ai_messages has INSERT + SELECT policies only; ZERO UPDATE/DELETE policies; ZERO triggers. Append-only by RLS design.

**6-dim contrast (a) vs ai_interaction_metrics precedent**:

| Dim | ai_interaction_metrics | ai_messages | Match |
|---|---|---|---|
| Audit value role | Diagnostic data (latency, action_proposed/executed flags, feedback) | Conversation transcript (user/assistant message log) | DIFFERENT in nature; SAME in role (terminal audit) |
| Audit value semantics | "metrics IS the audit" | "the conversation log IS the audit trail of the AI interactions" | **PARALLEL rationale** |
| Trigger coverage | 0 | 0 | MATCH |
| Append-only intent | INSERT + SELECT only (no UPDATE/DELETE) | INSERT + SELECT only (no UPDATE/DELETE) | MATCH |
| CC-19 #3 distinguishing factor | "loss-of-audit = loss-of-diagnostic data; recoverable from operational logs" | "loss-of-audit = loss-of-conversation, which is structurally impossible if append-only RLS holds" | **PARALLEL: terminal-audit-via-table** |

**6-dim contrast (b) vs CC-19 #3 audit_log INSERT integrity gap main-class anchor (F-02-010 class header)**:

| Dim | CC-19 #3 main class | ai_messages candidate | Match |
|---|---|---|---|
| Class-shape | Mutable table lacks AFTER I/U/D trigger to write to audit_log; audit gap from mutation surface | ai_messages IS the conversation log; no separate audit_log needed because the table IS the audit | NO MATCH — class-distinguishing factor "table IS the audit" |
| Audit destination | audit_log table (separate) | ai_messages table (self-audit) | DIFFERENT |
| Append-only mechanism | Not enforced (CC-19 #3 anchors lack append-only) | INSERT + SELECT only RLS policies; no UPDATE/DELETE | DIFFERENT — append-only enforced via RLS |
| Loss-of-audit implication | Loss-of-mutation-history | Loss-of-conversation = loss-of-the-table (structurally impossible) | **STRUCTURAL CLASS-DIFFERENCE** |

**Verdict (Phase 5 §5.E + Phase 7 §7.B)**: ai_messages MATCHES architectural-exception sub-class precedent (6/6 structural class match at terminal-audit-via-table + append-only-by-RLS + 0-trigger-by-design + parallel rationale-class). STRUCTURALLY DISTINCT from CC-19 #3 main class.

**Cohort enrichment 1 → 2** (ai_interaction_metrics + ai_messages). Documentation-only per placement-slot invariance s47+ rule; sub-class introduction count UNCHANGED in catalog (still 8).

### §11.F CC-19 #4 ARCHITECTURAL N/A sub-shape extension (batch-17 cohort 1 → 2)

**Sub-shape precedent (s53 NEW)**: per findings/14 L938-942 + L1181:
> "Phase 4.1 verdict: CC-19 #4 ARCHITECTURAL N/A for batch-14. Access control enforced via routing-layer gate (per CENSUS:83-85 owner/admin-only routes) + RLS-layer enforcement (every batch-14 table's USING expression uses is_org_admin/is_org_staff helpers). **CC-19 #4 sub-shape 'ARCHITECTURAL N/A' NEW s53** (sub-class introduction within CC-19 #4 cohort; class-DISTINCT from useCan-anchored main class on design-philosophy axis per Phase 5.3b adjudication)."

**Sub-shape extension (s56) — batch-17**:

Phase 1 §1.D verified: ZERO `useCan(` calls across all 16 batch-17 FE files (grep on `src/components/loopassist/` + `src/contexts/LoopAssistContext.tsx` + `src/hooks/useLoopAssist*.ts` + `src/hooks/useParentLoopAssist*.ts` + `src/components/dashboard/LoopAssist*.tsx` + `src/components/settings/LoopAssistPreferencesTab.tsx` + `src/components/shared/LoopAssistPageBanner.tsx` returned 0 hits).

Access control design at batch-17:
- Server-side: `ACTION_ROLE_PERMISSIONS` map at looopassist-execute L154-165 + org_memberships role check + RLS-as-SSOT
- FE-side: zero useCan + zero inline role-check (Phase 1 §1.D + Phase 2 §2.B + §2.C verbatim verification)
- Parallel design-philosophy to batch-14: server-side-gate-as-SSOT; intentional architectural design

**Class-shape feature MATCH per drift #35.B**: defining feature = "permissions enforced via routing-layer + RLS-as-SoT + server-side enforcement; no UI-layer affordance gating"; MATCH to F-14 sub-shape anchor.

**Verdict (Phase 5 §5.F + Phase 7 §7.B)**: ratified sub-shape extension. **Cohort enrichment 1 → 2** (batch-14 + batch-17). Documentation-only per placement-slot invariance s47+ rule; sub-class introduction count UNCHANGED in catalog (still 8).

### §11.G Pattern #44 NEW PLACED single-anchor (3-layer prompt-injection mitigation)

**Pattern slot assignment**: **Pattern #44** (sequential after Pattern #43 PLACED single-anchor s53 at F-14-002 useConvertLead FE direct-write bypass).

**Class-shape verbatim**: "Layered prompt-injection defense at edge fn body — sanitisation at user-input layer + at context-data-injected layer + at config-data-injected layer"

**Anchor**: `supabase/functions/looopassist-chat/index.ts` (s56 batch-17).

**3 layers verbatim verified at Phase 2 §2.B**:

- **Layer 1 — user-input sanitisation**: `sanitiseMessage` import from `_shared/sanitise-ai-input.ts` applied at L1314 to user role messages in body. Shared sanitisation utility (cross-fn reused).
- **Layer 2 — context-data-injected sanitisation**: `sanitiseForPrompt` defined at L37-47 — strips control chars `[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]` + backticks → single-quotes + entity markers `[(Student|Lesson|Invoice|Guardian|Action):...]` + role-prefix `^(system|assistant|user|human):\s*` + caps at 100 chars + trim. Applied to student/guardian/teacher/lesson names + notes before embedding in context strings injected into LLM system prompt (e.g. L243, L248, L293, L333, L354, L359).
- **Layer 3 — config-data-injected sanitisation**: `sanitisePref` defined at L1458-1467 — strips control chars + triple-backticks `` ``` `` → `'''` + role-prefix + literal phrase `ignore (all) previous instructions` → `[filtered]` + literal phrase `new system prompt` → `[filtered]` + caps at configurable maxLen. Applied to org `ai_preferences` table values (term_name, billing_cycle, tone, progress_report_style, custom_instructions) before injection into system prompt at L1471-1477.

**Class-shape distinction from existing catalog**:
- vs Pattern #4 (sanitisation of user-generated text in messaging surfaces): single-layer single-source vs multi-layer multi-source — DISTINCT
- vs Pattern #31 (multi-layer auth/validation pre-sensitive-write): auth defense vs content-injection defense — DISTINCT class focus
- vs Pattern #5+: distinct class shapes (none address LLM prompt-injection at edge fn body)

**Placement precedent for single-anchor**: Pattern #40 (F-11-004 s50) + Pattern #41 (F-12-003 s51) + Pattern #43 (F-14-002 s53) — all single-anchor PLACED at first introduction batch for novel class-shape.

**Catalog count delta**: 37 PLACED → **38 PLACED** at s56.

### §11.H Pattern #31 cohort enrichment (looopassist-execute NEW anchor)

**Class-shape verbatim**: "multi-layer defense-in-depth (auth-stack + identity-validation-stack) before sensitive write OR cross-batch RPC invocation"

**Anchor 1 (existing s48)**: `supabase/functions/bulk-process-continuation/index.ts:64-150` — bearer + getUser + role-IN check + rate-limit + entity-scope-verification before invocation of sensitive cross-batch RPCs (cleanup_withdrawal_credits + materialise_continuation_lessons + others).

**Anchor 2 (NEW s56)**: `supabase/functions/looopassist-execute/index.ts:80-245` — Authorization+getUser (L80-94) + user-scoped client (L80-83) + checkRateLimit (L97-99) + atomic claim L137-150 + org_memberships active-role check (L167-180) + ACTION_ROLE_PERMISSIONS role gate (L182-191) + entity count cap 50 (L203-205) + UUID regex format validation (L207-215) + entity ownership validation (L211-245) before action handler dispatch (L247+) + cross-batch RPC invocation (create_invoice_with_items at L722).

**Class-shape feature MATCH per drift #35.B**: defining feature = "multi-layer auth-validation stack pre-sensitive-operation OR pre-cross-batch-RPC-invocation"; both anchors share defining shape with anchor-specific elaboration on layer count + sensitive-operation type.

**Cohort enrichment**: Pattern #31 cohort 1 → 2 (bulk-process-continuation + looopassist-execute). Documentation-only per placement-slot invariance s47+ rule.

### §11.I Pattern #41 batch-17 NEGATIVE counter-examples cohort

Per Phase 5 §5.A re-verification:
- looopassist-execute: NEGATIVE counter-example (proposal.user_id=auth.uid() validated at L113-120; org_memberships at L167-180)
- looopassist-chat: NEGATIVE counter-example (org_memberships at L1283-1289 validates body-supplied orgId; parallel s55 stripe-subscription-checkout L124-134 pattern)
- parent-loopassist-chat: NEGATIVE counter-example (orgId derived from authenticated guardian record at L114; NOT body-supplied)
- marketing-chat: NOT-APPLICABLE (public; no caller identity)

**Cross-batch NEGATIVE cohort post-s56**: 5 (batch-16 +2: stripe-subscription-checkout + onboarding-setup; batch-17 +3: looopassist-execute + looopassist-chat + parent-loopassist-chat). Reinforces F-12-003 placement-reasoning sub-class on "auth-required + body-level membership-check".

Pattern #41 4 PLACED anchors UNCHANGED.

Drift #38 4-part attestation per F-12-003 + F-14-001 + F-15-001 + F-15-003 PLACED anchors (Phase 5 §5.B 18/18 PASS).

### §11.J Pattern #42 batch-17 NEGATIVE counter-examples cohort

Per §2.7 rate-limit registry + §3.18:
- All 5 batch-17 rate-limit invocations are registry-defined AND invoked
- 5/5 NO MATCH for Pattern #42 class-shape (registry-defined-but-uninvoked)

Reinforces F-12-008 single-anchor candidate framing. Pattern #42 single-anchor candidate UNCHANGED.

Drift #38 4-part attestation per F-12-008 anchor (Phase 5 §5.B 18/18 PASS).

### §11.K POSITIVE observation set (8 items)

Per Phase 7 §7.C:

1. **ACTION_ROLE_PERMISSIONS inline-vs-registry 10/10 MATCH** (sync-discipline POSITIVE pattern): looopassist-execute L154-165 inline map verbatim-matches src/lib/action-registry.ts ACTION_REGISTRY L20-81 for all 10 action_types + role permission lists. Comment at L153 "Mirror of src/lib/action-registry.ts roles — keep in sync" honoured at HEAD.

2. **Pattern #41 batch-17 NEGATIVE counter-examples ×3** — see §11.I.

3. **Pattern #42 batch-17 NEGATIVE counter-examples ×5** — see §11.J.

4. **PostgREST filter input sanitisation** (search_students L574): `String(toolInput.query).replace(/[%_(),.*\\]/g, '').slice(0, 100).trim()` — sanitises PostgREST filter operators (%, _, parens, dot, asterisk, backslash) + length cap + trim before injecting into `.or('first_name.ilike.%${safeQuery}%,last_name.ilike.%${safeQuery}%')`. PostgREST filter injection mitigation.

5. **RBAC role-based context filtering** (looopassist-chat L1411-1424 + buildStudentContext L289+ + executeToolCall L555-563):
   - TEACHER role: hides billing section + emails in page context
   - FINANCE role: hides emails + practice/notes + practice assignments in page context
   - TEACHER_BLOCKED_TOOLS = ["search_invoices", "get_revenue_summary", "get_term_adjustments"]
   - FINANCE_BLOCKED_TOOLS = ["get_practice_history"]
   - Per-role visibility filtering at server layer (defense-in-depth POSITIVE pattern)

6. **detectsBrokenPromise** (looopassist-chat L17-34): server-side LLM quality metric detecting "I'll do X..." text without `\`\`\`action` JSON block (s37 audit lesson per audit/feature-catalogues/loopassist.md §1A). POSITIVE observation candidate; not catalog-promotion-worthy as standalone (single-use intent).

7. **Atomic claim pattern** (looopassist-execute L137-150): `UPDATE ai_action_proposals SET status='executing' WHERE id=$ AND status='proposed' RETURNING id` for concurrent-execution prevention. Standard PG idiom; not catalog-promotion-worthy (Phase 7 §7.A.3 demotion).

8. **SOC 2 "aligned" qualifier note** (marketing-chat L110 system prompt): "aligned" not "certified" — defensible at marketing per Phase 4 §4.E ACCURATE × 4 + NEEDS-QUALIFIER × 1 verdict matrix. Phase 6 doc-write annotation; no F-17-NNN.

### §11.L Marketing claim accuracy + SOC 2 qualifier note

Per Phase 4 §4.E verdicts:
- ACCURATE × 4 (L107 encryption + L108 RLS + L109 GDPR + L113 role enum)
- NEEDS-QUALIFIER × 1 (L110 SOC 2 "aligned" — defensible at marketing; not equivalent to "certified")
- ZERO MISLEADING or FALSE marketing claims
- ZERO fresh F-17-NNN from claim-accuracy probe

### §11.M Closed-batch citation framework

Per s53 + s54 + s55 precedent: closed-batch finding citations + cross-batch observations do NOT consume F-NN-NNN finding IDs.

**Allocation rules at s56**:
- **Fresh F-17-NNN**: 9 findings (0C + 2H + 0M + 7L). Contiguous IDs F-17-001 through F-17-009.
- **Closed-batch citations** (§3.10 + §3.11 + §3.12 + §3.16): cite closed-batch anchors verbatim with drift #38 4-part attestation; no F-17-NNN. Purpose: composition-chain documentation + Phase C remediation prioritization signals + Pattern #10/#11 anchor body integrity preservation.
- **Cross-batch observations** (§3.13 + §3.14 + §3.15 + §3.17 + §3.18): POSITIVE pattern observations + substrate/data-flow reach observations; no F-17-NNN. Purpose: POSITIVE pattern reinforcement + cross-batch reach map documentation.

Net allocation discipline: total fresh F-17-NNN per batch reflects ONLY batch-owned findings; substrate reach + closed-batch citations + cross-batch observations are documentation-only (no tally inflation; no closed-batch immutability violation).

### §11.N Drift #41 §6 21-vector enumeration mapping (Phase 5.1 self-check)

Per Phase 5 §5.C: 21+1 vectors per launching prompt §8 Phase 3 enumeration mandate; all mapped to explicit audit decisions at Phase 3 EXIT.

| # | Vector | Audit decision |
|---|---|---|
| 1 | ai_action_proposals UPDATE WITH_CHECK=NULL | F-17-003 LOW |
| 2 | ai_conversations UPDATE WITH_CHECK=NULL | F-17-004 LOW |
| 3 | ai_interaction_metrics.response_time_ms NO CHECK | F-17-005 LOW |
| 4 | Additional column-CHECK enumeration | CITATION-ONLY (class-distinct) |
| 5 | ai_messages append-only adjudication | CITATION-ONLY architectural-exception sub-class extension §11.E |
| 6 | ai_interaction_metrics 0-trigger pre-adjudication carry | CITATION-ONLY per CENSUS L843 §3.16 |
| 7 | PERMISSIVE-DEFAULT L184 + L448-449 | F-17-007 LOW |
| 8 | ACTION_ROLE_PERMISSIONS 10/10 MATCH | POSITIVE observation §11.K.1 |
| 9 | FE useCan ZERO vs ARCHITECTURAL N/A | Sub-shape extension §11.F |
| 10 | Pattern #41 at looopassist-execute | NEGATIVE counter-example §11.I |
| 11 | Pattern #41 at looopassist-chat | NEGATIVE counter-example §11.I |
| 12 | Pattern #41 at parent-loopassist-chat | NEGATIVE counter-example §11.I |
| 13 | Pattern #41 at marketing-chat | NOT-APPLICABLE §11.I |
| 14 | Capability #20 multi-org isolation | POSITIVE VERIFIED §7.1 |
| 15 | Capability #21 audit trail | MIXED-POSITIVE + F-17-008 §7.2 |
| 16 | Capability #22 role gating destructive | POSITIVE VERIFIED §7.3 |
| 17 | PI-12 CRITICAL closure | F-17-001 HIGH + event #16 §5.1 + §6 |
| 18 | PI-16 HIGH closure | F-17-002 HIGH same-bracket §5.2 |
| 19 | marketing-chat V2 §3.3 marks-for-cut | CITATION observation §3.10 |
| 20 | Cross-batch reach batch-16 useFeatureGate | CLOSED-BATCH CITATION POSITIVE §3.14 |
| 21 | marketing-chat NO wrapEdgeFn | F-17-006 LOW §3.6 |
| BONUS | 3 handlers UPDATE no double-org-filter | F-17-009 LOW §3.9 |

**21+1 vectors all mapped to explicit audit decisions**. Drift #41 mitigation operating as designed at s56 (no manifestation surfaced; Phase 5.1 self-check returns clean per s55 §11.K precedent).

---

## §12 EXIT summary

Batch 17 audit complete. 9 fresh F-17-NNN allocations (2H + 7L). PI-12 + PI-16 closed (cohort 5 → 3). Capability #20/#21/#22 verified. Event #16 ratified (cumulative 15 → 16). Pattern #44 NEW PLACED + Pattern #31 cohort 1 → 2 + 2 sub-class extensions. Drift #30.A 8th cumulative manifestation. Drift #36 3rd operational application clean. Drift #38 18/18 PASS.

Grand active tally post-s56: **191 (20C/52H/28M/91L)**. Cumulative methodology entries: 42 (unchanged; drift #30.A counter +1). Pattern catalog post-s56: 38 PLACED + 6 candidates + 8 sub-class introductions + 1 NEGATIVE-instance flag.

Phase B progress: **17 of 21 batches complete**. Batches 18-21 remain. Phase C remediation deferred.

---
