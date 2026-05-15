# PLAN — Path Y full-app audit sweep

Canonical plan for the Path Y full-app audit. Created s39 (2026-05-11). For live audit state see [`STATUS.md`](STATUS.md); for the feature inventory see [`CENSUS.md`](CENSUS.md).

## 1. Why Path Y

LessonLoop entered May 2026 with LoopAssist as the headline launch feature. In session s38, while wiring the end-to-end LoopAssist execution flow, a routine reschedule proposal returned a UUID for "William Lewis" — the model had fabricated the ID. The real William Lewis exists; his UUID is `2b021243-bd7c-4e78-9001-6576d38ed3da`, not the hallucinated `b2155883-3c1a-43ed-a08e-329f5e66d6be`. The surface-level fix is to pin tools to return UUIDs alongside names. The deeper question — _what other class bugs are sitting under the surface?_ — triggered a two-feature audit (billing/invoicing + lessons/scheduling) that turned up 17 distinct findings spanning five cross-cutting patterns: money-unit mixing (PI-01), status enum gaps (PI-02), bookkeeping drift (PI-03/PI-04), tracked DB state with no UI surface (PI-05), and silent error swallowing in webhooks and crons (PI-06/PI-07).

These 17 are not isolated bugs. They are evidence that the app shipped feature-by-feature without a systemic sweep, and that LoopAssist sitting on top of this foundation amplifies every latent defect into a user-visible failure. The decision: **shelve LoopAssist; audit the entire app; fix what's found; only then resume the AI layer.** No scope reduction. Every feature listed in `CENSUS.md` is in. Time horizon: 3–5 months. The contract is discipline — separate phases for audit and fix, no overlap, no exceptions.

## 2. Phases

Six phases, A through F. Each phase has a goal, an explicit allowed/forbidden boundary, an EXIT condition, and a transition gate to the next.

### Phase A — Census + Plan

- **Goal:** Establish the documentation spine (PLAN, CENSUS, STATUS) and capture pre-investigation evidence from s38.
- **Allowed:** Creating files under `audit/sweep/`; one-paragraph reconciliation note on `audit/README.md`; a new entry in `HANDOVER.md`.
- **Forbidden:** Any code change, any migration, any deploy, any fix work, any new findings investigation.
- **EXIT:** All three docs exist; 17 PI findings captured in STATUS.md; commit pushed to `main`.
- **Gate to B:** Jamie confirms scaffolds read clean; STATUS.md banner reads `AUDIT IN PROGRESS — DO NOT FIX YET`.

### Phase B — Systematic Audit

- **Goal:** Walk all 20 batches in order. Per batch, read every file in scope, run a live trace, and document findings with severity and reproduction evidence into `audit/sweep/findings/NN-batch.md`. Audit-only — no code touched.
- **Allowed:** Reading source; reading DB state via Supabase MCP; writing finding files; updating STATUS.md trackers; appending HANDOVER entries.
- **Forbidden:** **ANY fix work, ANY migration, ANY code change outside `audit/sweep/` and `HANDOVER.md`. New findings discovered mid-batch are documented, never fixed.** This is the cardinal rule of Phase B. A "tiny fix while I'm here" is a discipline failure.
- **EXIT:** All 20 batches complete; `findings/00-summary.md` aggregates the catalogue; every finding has an `F-NN-NNN` ID, a severity, and a reproduction.
- **Gate to C:** Jamie reviews the summary; Phase C is authorised only on explicit go-ahead.

### Phase C — Fix Sprints

- **Goal:** Triage findings into sprints; fix critical-first, gated. Each sprint is one focused theme (e.g. money convention, RLS gaps, conflict checks).
- **Allowed:** Code edits, migrations, edge function deploys — all scoped to the active sprint.
- **Forbidden:** Picking up new findings during a sprint; expanding scope; touching unrelated areas; resuming LoopAssist work.
- **EXIT:** All critical and high severity findings closed; medium/low triaged into v1.1 backlog or accepted-as-is with explicit annotation.
- **Gate to D:** Sprint closure log clean; STATUS.md banner can drop from "AUDIT IN PROGRESS" once Phase C is underway.

### Phase D — Cohesion Sweep

- **Goal:** End-to-end UX walkthroughs covering the journeys defined in batch 20-ux-flows. Catch the seams between features that were fixed in isolation.
- **Allowed:** Polish-level code edits; copy fixes; navigation fixes.
- **Forbidden:** Feature additions; architectural refactors; fixes that should have been caught in Phase C.
- **EXIT:** Every batch-20 journey walked end-to-end on staging without surprise failure.
- **Gate to E:** Cohesion log clean; Jamie signs off on demo readiness.

### Phase E — Lauren Shadow Term

- **Goal:** Real-usage validation. Lauren's shadow studio runs a full term cycle: enrol, schedule, deliver, invoice, pay, attend, credit, continue. Issues surface only under real load and real edge cases.
- **Allowed:** Targeted fixes for issues Lauren surfaces; observability work; Sentry triage.
- **Forbidden:** Treating Lauren's term as a beta program for new features. Path Y still holds.
- **EXIT:** A full term completed end-to-end with no critical incidents; outstanding issues non-blocking.
- **Gate to F:** Lauren sign-off; commercial launch readiness confirmed.

### Phase F — LoopAssist remediation completion

- **Status (s41 correction):** Phase F may be subsumed by Phase B/C/D work. LoopAssist (batch 17) is fully IN-SWEEP for Phase B; its findings will be remediated in Phase C alongside other classes. A distinct Phase F may not be necessary — decision deferred until Phase B closes.
- **Goal (if retained):** Complete any LoopAssist-specific remediation work that did not fit cleanly into Phase C class-based sprints. Resume the AI layer (Path B from the s38 LoopAssist conversation) if rebuild rather than remediation is the right path. Tools return UUIDs alongside names; execution paths route through the same conflict checks and money-handling rules the rest of the app uses; no shortcuts.
- **Allowed (if retained):** LoopAssist code; prompts; tool definitions; LoopAssist edge functions.
- **Forbidden (if retained):** Bypassing app-layer checks; new "AI-only" code paths that duplicate logic; deploying without test coverage for the new tool contracts.
- **EXIT (if retained):** LoopAssist live on staging, passing all 20 batch-derived integration scenarios.
- **Gate:** Full launch.

## 3. Discipline rules

These rules are non-negotiable. They reinforce the phase boundaries in Section 2 and exist because the most common failure mode of a long sweep is the "tiny fix while I'm here" that quietly bleeds audit-phase discipline into fix work.

1. **No fix work during Phase B.** None. Findings get written; code does not get touched. If a one-line fix looks "obvious", it still waits for Phase C. Mixing audit and fix loses the catalogue.
2. **No new feature work during any audit phase.** v1 scope is locked. v1.1+ items live in the legacy `audit/MASTER.md` and wait their turn.
3. **AUDIT SCOPE COMPLETENESS.** Every feature in the codebase is audited in Phase B. ONLY Zoom is deferred from Phase B sweep, and only because external Zoom authorization/verification is pending. Zoom deferral is sub-surface, NOT whole-batch — batches 15 (calendar-sync-zoom-xero), 18 (settings-tabs), and 21 (marketing surface) each contain Zoom surface alongside non-Zoom surface. When those batches execute, the audit basis statement MUST declare: *"Zoom-specific surface (zoom-oauth-callback / zoom-oauth-start / zoom-sync-lesson edge fns; ZoomOAuthCallback.tsx; ZoomIntegrationTab; ZoomGuide marketing page) is deferred pending external Zoom authorization/verification — out of audit scope for THIS batch ONLY, NOT shelved. All non-Zoom surface in this batch is audited fully."* No feature is shelved, deferred, or excluded from Phase B sweep on any other grounds. If any future phase or session attempts to exclude a feature from audit, that is a discipline failure — push back. (s41 correction superseded prior "LoopAssist is shelved" framing.)
4. **Every Claude Code session follows the 11-section prompt contract** defined in Section 10. Any prompt arriving missing a section is a discipline failure — halt and surface to Jamie.
5. **Every session updates `HANDOVER.md` and `STATUS.md` at exit.** No exceptions. STATUS.md is the canonical ledger; HANDOVER.md is the chronological narrative.
6. **New findings discovered mid-batch are documented, never fixed.** They get an `F-NN-NNN` ID, a severity, and a slot in the relevant batch's findings file. They do not trigger a code change. This is the same rule as #1, restated because it is the most common failure mode.

## 4. Severity rubric

Each finding gets exactly one severity. No "high-ish", no "low-medium". If torn between two levels, pick the higher one and note the ambiguity in the finding body.

- **Critical** — financial loss, data loss, security exposure, marketed feature fundamentally broken, or a defect that would erode user trust on first encounter. Anchors: PI-01 (payroll 100× error), PI-11 (conflict trigger gap), the William Lewis class bug.
- **High** — feature works but in a degraded, surprising, or unsupported way; silent failure modes; broken edge cases; missing UI surfaces for tracked DB state. Anchors: PI-05 (overpayment hidden), PI-07 (failed-payment webhook silence).
- **Medium** — cosmetic but visible inconsistency; timezone-edge issues; non-critical race conditions; minor UX dead-ends. Anchor: PI-17 (credit-expiry UTC off by ±12h for non-UTC orgs).
- **Low** — code-hygiene drift; stale comments; minor docstring/API inconsistency; legacy artefacts.

### 4.1 Severity-adjustment methodology (added s45)

Pre-investigation s38 tags are STARTING POINTS for prioritisation, NOT severity commitments. Full audit owns canonical severity per §4 anchors above. Severity-adjustment events are tracked in each batch's findings doc §11 (audit-method appendix) and aggregated cumulatively in the reviewing-Claude handover snapshot for the closing session.

**Two distinct adjustment classes**:
1. **Bracket-shift event** (counted as a severity-adjustment event): the finding's severity moves between rubric brackets (Critical / High / Medium / Low). Examples:
   - PI-08 → F-02-005 HIGH ↑ CRITICAL (s41 event #1) — financial-falsification class anchor unlocked via body re-audit.
   - PI-11 → F-03-004 Critical ↓ HIGH (s42 event #2) — operational-correctness class CAPS-at-HIGH per class-consistency.
   - F-06-001 mid-session ↑ Phase 3 MEDIUM/HIGH bracket → Phase 5 CRITICAL (s45 event #9) — F-06-003 composition discovery shifted bracket from operational-correctness HIGH to financial-falsification CRITICAL.
2. **Bracket-internal refinement** (NOT counted): pre-class within a bracket sharpens via mid-session evidence without crossing bracket boundary. Example: F-06-002 pre-class "HIGH or CRITICAL deferred" → HIGH-confirmed via Stripe-side PM-to-customer validation analysis (s45 Phase 6) is bracket-internal — the deferred range was "HIGH or CRITICAL"; the evidence resolved within that range without an unambiguous bracket-shift.

**Class-consistency precedent** is the primary anchor for adjudication. Operational-correctness class CAPS at HIGH per s42 PI-11 + s44 PI-02/03/04 + s45 PI-05/PI-07 precedent chain. Financial-falsification class anchors at CRITICAL per F-02-005 + F-02-002 + F-05-001 + F-06-001/003 family. Class-consistent grading prevents "scored differently because one happens to have a downstream rollback" drift.

**Cumulative severity-adjustment events through s49**: **13** (events #1-#13; s46 +1 event #10 F-07-003 mid-session bracket-shift CRITICAL via composition with F-02-005; s47 +1 event #11 F-08-003 mid-session bracket-shift CRITICAL ↓ HIGH via class-precedent reassessment with F-01-001 anchor REFUTED → PI-09 HIGH adopted; s48 +1 event #12 F-09-007 PI-13 CRITICAL ↓ HIGH via class-precedent reassessment with PI-17 class shape match (UTC-based time arithmetic ignoring org timezone, end-to-end at edge-fn:735 + FE input + FE output) + operational-correctness CAPS-at-HIGH chain (kinship to events #2/#5/#6/#7/#8/#10/#11); no composition path to financial-falsification CRITICAL per Phase 2 composition probe + Phase 3 FE evidence; driver type: class-precedent reassessment; **s49 +1 event #13 F-10-002 invoice_stats_mv HIGH via class-precedent reassessment from CRITICAL default-expectation via F-02-002 anchor; 6-dim class-shape rubric: D1 cross-tenant MATCH + D2 anon-reachable MATCH + D3 payload sensitivity PARTIAL (aggregate-financial vs row-level child-PII) + D4 regulatory scope NO (commercial-not-regulated vs GDPR Art 9/33) + D5 trust-erosion PARTIAL (post-pg_cron-enablement inaction framing) + D6 composition NEUTRAL (standalone); D4 NO + D3 PARTIAL drove bracket-shift; F-05-007 HIGH information-disclosure precedent supports bracket placement; mechanism shape kin to F-08-003 event #11; aggregate-cross-tenant-financial-standalone bracket positioned between F-05-007 HIGH and F-02-002 CRITICAL; driver type: class-precedent reassessment**). PI-01 → F-10-001 s49 = same-bracket pre-tag confirmation (NOT event; cumulative events unchanged by F-10-001 closure). Full table maintained in each batch findings doc §11 + reviewing-Claude handover §9. **Ambiguous-pre-tag adjudication is NOT an event** (s48 clarification): bracket-pair pre-tags like {MEDIUM, HIGH} with Phase 5 selection are normal adjudication. **Same-bracket pre-tag confirmation is NOT an event** (s49 clarification via PI-01 → F-10-001 precedent): only single-bracket pre-tag adjudicated to a DIFFERENT bracket counts as event.

**Cumulative methodology-drift entries through s49**: **31** (28 Category 1 reviewing-Claude origin drifts + 1 Category 2 environment caveat + 2 Category 3 CC-origin drifts). Full ledger maintained in reviewing-Claude handover snapshots §14 (`audit/sweep/handovers/reviewing-claude-sNN-close.md`). **s48 Phase 0 ratifies #25 + #26** (Category 1): **#25 Phase 10 commit pattern** — SHA-embed-via-amend (s47 refinement of s46 placeholder precedent) broke at s47 close; revert to s46 placeholder pattern. Operator MUST leave literal `<sNN Phase 10 commit SHA>` placeholders in the closing handover snapshot §2/§4/§21 and record the actual post-commit SHA externally in STATUS.md / HANDOVER.md / Jamie's notes. **#26 Placeholder count discipline** — before any substitution operation on the handover snapshot, run `grep -c "<sNN Phase 10 commit SHA>"` to count actual placeholders; verify the count matches reviewing-Claude's stated N before proceeding; halt on mismatch. **s49 Phase 0 ratifies #27** (Category 1): **#27 Cumulative tally arithmetic at PI closures** — failed to subtract closed-PI bracket counts from grand active when PIs close at a batch (s48 internal correction at Phase 10 Message B pre-commit; kin to s45 drift #7). Mitigation: at every batch-close, explicit two-line arithmetic check — (a) PI cohort math `pre − closures + enrichments = post`; (b) grand active math `pre + batch findings delta + PI cohort bracket delta = post`. Cross-verify via STATUS.md column sums. **s49 Phase 5 ratifies #28** (Category 3 CC-origin): **#28 Tier-gating flag-presence "presumed" without verbatim cite** — Phase 4 §10 over-confidence on Utilisation.tsx `useFeatureGate('multi_location')` import without verbatim verification; caught via §9 rule 8 sweep-completeness mandate at Phase 5 §1 Utilisation.tsx full-read closure (confirmed NOT IMPORTED in page body). Mitigation: tier-gating flag-presence verification REQUIRES verbatim import + call-site cite, not derivation from sibling page convention. **s49 Phase 7 ratifies #29** (Category 1): **#29 SECDEF RPC EXECUTE grant enumeration omitted from Phase 1 scope** — Phase 1 launch prompt task 1.1 + §6 PI block specified body verbatim + auth gate region + SECDEF/STABLE/search_path flags only; EXECUTE grant enumeration omitted. Caught via Phase 6 §3 CC-19 #1 carry investigation (both batch-10 RPCs DB-verified anon EXECUTE = true despite body-gate solid; allocated F-10-008 cohort per F-09-002 class-precedent). Mitigation: SECDEF RPC audit at Phase 1 MUST include EXECUTE grant enumeration query (`pg_proc.proacl` OR `has_function_privilege()` for anon + authenticated + service_role roles), in addition to body-level auth gate verification. Closes F-09-002 class-shape verification gap. **Operational mandate for s50+ Phase 1 prompts**. Post-s49 cumulative methodology-drift entries: **31** (28 Category 1 + 1 Category 2 + 2 Category 3).

**Pattern catalog + CC-19 cross-batch carry register**: full catalogs (23 positive patterns + 15 active CC-19 carries post-s45) maintained in `audit/sweep/findings/NN-*.md` files; reviewing-Claude handover snapshots `audit/sweep/handovers/reviewing-claude-sNN-close.md` consolidate counts at each session close. New patterns + carries declared in Phase 9 of the discovering session per the 11-section contract.

**Pattern declarations through s49**: #1-#21 + #22 two-state-managed webhook dedup with stale-recovery (anchor stripe-webhook:121-233; s45) + #23 non-SECDEF row-lock validation trigger with intent-acknowledged compensating-cascade bypass (anchor validate_refund_amount; s45) + #24 Finance-team-gated SECDEF stacking 6 layers (anchor generate_installments; s46) + #25 Defensive-narrowing-via-roles in PERMISSIVE RLS policies (anchor auto_pay_attempts policy roles={authenticated}; s46) + s47-s48 ratifications #27 + #28 + s48 NEW #30/#31/#32/#33/#35/#36 + **s49 NEW #38 "Unit-conversion discipline at the formatter boundary"** (RATIFIED Phase 8 s49; class-shape: MAJOR-stored values converted to MINOR via explicit `* 100` immediately before MINOR-expecting formatter; class-distinct from naked-value + MAJOR-expecting formatter; 4 POSITIVE instances across 3 batches: TeacherLink.tsx:213 batch-02 + TeacherQuickView.tsx:215 batch-02 + PaymentAnalyticsCard.tsx batch-10 + ActiveDisputesCard.tsx:41 batch-06; 1 NEGATIVE at usePayroll.ts:213 F-10-001 anchor). **Pattern candidates carrying entering batch-11**: #26 Log-shape table protection cohort (batch-19) + #29 Caller-RLS-respecting view security_invoker=on (batch-19) + #34 42P01 graceful-degradation (post-launch revisit) + **#37 Read-only-report-RPC FE-invocation discipline (batch-19 NEW s49; slot reserved; single-batch evidence insufficient per F-04-003 precedent)** + **#39 Defensive `?? 0` fallback on RPC json-shape return (batch-19 NEW s49; slot reserved; single-batch single-instance evidence)**. **Sub-class introductions ratified s49** (class-cataloguing taxonomy declarations under existing CC-19 carries; no Pattern slot consumed): **POS-4 "Divide-by-zero auth gate"** under auth-gate-UX class family (F-10-003 anchor; class-distinct from RAISE / soft-fail / return-null sub-shapes; operator-debugging-friction class) + **"Present-NOT-VALID variant"** under CC-19 #11 schema-column-constraint cohort (F-10-004 component; teachers_pay_rate_type_check convalidated=false; third sub-shape after absent + present-validated; false-confidence-at-HEAD class) + **"Orphan MV with anon-SELECT + stale-by-design"** under CC-19 #15 dead-code SECDEF + orphan trigger fns ACTIVE carry (F-10-002 anchor; class-distinct from F-06-006/F-07-005 zero-binding sub-shape via creation-migration anchor + anon-SELECT-grant + post-blocker-resolution inaction dimensions). **Pattern observation recorded s49** (no allocation; findings/10 §11): "RLS-canonical-FE-cosmetic role-check" (7 batch-10 sites; class-distinct from useCan unimplementation cohort).

**CC-19 carry declarations through s45**: #1-#13 + **#14 claimed-service-role-gate misnaming** (RPC body `auth.uid() IS NOT NULL` variant + RLS policy `auth.uid() IS NULL` variant; same root cause, opposite reasoning; s45 batch-19 sweep) + **#15 dead-code SECDEF RPCs + orphan trigger functions** (s45; batch-19 sweep target).

## 5. Batches

Twenty-one batches, locked as of s39 (batch 21 added during Phase A to separate the marketing surface from operational user journeys). Splits or merges require explicit Jamie approval recorded in the session log. Each batch's one-line description below is the canonical scope; expanded scope lives in the batch's findings file once Phase B opens it.

- **01-auth-sessions-rls** — Login, session refresh, JWT handling, magic links, password reset, route guards, RLS coverage across all tables.
- **02-org-management** — Organisation creation, multi-org switching, membership, roles (`useCan`), permissions, invitations.
- **03-calendar-core** — Single-lesson creation, recurring lessons, drag-and-resize, slot generator, conflict detection (all 7), cancel/edit "this only" vs "this & future".
- **04-lessons-scheduling-deep** — Group lessons, online lessons, lesson notes (shared/private), bulk operations, calendar filters.
- **05-billing-invoicing** — Invoice creation (manual + billing run + RPC `create_invoice_with_items`), status lifecycle, refunds, credit notes, VAT, currency handling, payment plans, installments.
- **06-payments-stripe-connect** — Stripe Connect onboarding/status/payouts, manual + Stripe payment recording, webhook coverage (all event types), refund + dispute lifecycle, auto-pay.
- **07-payment-plans-installments** — Plan creation, installment generation, installment overdue handling, auto-pay installment, parent-side plan visibility.
- **08-attendance-credits-waitlists** — Attendance recording, make-up credit lifecycle (issue/redeem/void/expire), make-up waitlist matching, credit caps per term.
- **09-term-continuation** — Term-continuation runs, parent response collection, deadline handling, term-adjustment processing (withdrawal + day_change).
- **10-reports-analytics-payroll** — All reports, analytics dashboards, payroll calculation (PI-01 lives here), CSV exports.
- **11-parent-portal** — Parent auth (separate surface from staff), invoice viewing, payment history, payment plans, make-up booking, attendance visibility.
- **12-messages-notifications** — In-app messages, internal threads, email delivery (Resend), notification preferences, draft/queued/sent lifecycle.
- **13-practice-resources** — Practice assignments, practice logs, streak tracking, resource library, student-facing surfaces.
- **14-bookings-leads-enrolment** — Booking page, lead capture, enrolment waitlist, offer expiry, conversion path.
- **15-calendar-sync-zoom-xero** — Google Calendar OAuth + busy-fetch + sync, Zoom integration, Xero connection + invoice/payment sync.
- **16-subscription-tiers** — Stripe Subscriptions for the LessonLoop product itself, tier enforcement (Teacher/Studio/Academy/Agency), trial handling, plan downgrade UX.
- **17-loopassist** — Existing audit at `audit/feature-catalogues/loopassist.md` is the starting point. **IN-SWEEP** — full LoopAssist surface audited in Phase B (read-only fns + write fns including `executeRescheduleLessons` + `bulk_complete_lessons` + the 12 LoopAssist tools). Remediation lands in Phase C alongside other classes. (s41 correction: prior "SHELVED" framing removed per AUDIT SCOPE COMPLETENESS rule §3.3.)
- **18-settings-tabs** — All 24 settings tabs (per V2 plan §5 PR3 — pre-IA-pass). Each tab's functionality + data wiring + RLS reachability (PI-10 lives here).
- **19-cross-cutting** — Timezones (PI-13, PI-17), money convention (`_minor` everywhere + CHECK constraints), status enum exhaustiveness (PI-02), RLS gap sweep, Sentry coverage, audit log coverage, migration-replay safety (PI-09).
- **20-ux-flows** — Not code: end-to-end user journeys. Sign-up → first lesson → first invoice → first payment → first absence → first make-up → end-of-term continuation. Audit dimension is cohesion across the journey, not the individual surfaces (those are audited in their primary batch). Journey list is enumerated in `CENSUS.md` §11.B. World-class bar test.
- **21-marketing-surface** — All content under `src/pages/marketing/*` — landing pages, pricing, blog posts, feature pages, use-case pages. Audit dimensions: claim accuracy vs shipped features (does `FeatureLoopAssist` describe what LoopAssist actually does?), content consistency, branding, dead-route detection, redirect health to `lessonloop.net` static site, blog post freshness. Production routes are redirects to the external static site; SSG mode renders the components directly.

## 6. Finding ID scheme

Format: `F-{batch:02}-{seq:03}`. Example: `F-05-007` is batch 5, finding 7.

Pre-investigation findings retain their `PI-NN` IDs while parked in `STATUS.md`. When re-verified in their target batch during Phase B, each receives an `F-NN-NNN` ID and the mapping (e.g. `PI-03 → F-05-002`) is recorded in the batch's findings file and in STATUS.md's pre-investigation table.

A finding's severity, batch, and ID are immutable once the batch closes. If understanding changes later, write a new finding and cross-reference; do not edit the original.

## 7. Sprint ID scheme

Format: `S-{seq:02}-{kebab-name}`. Example: `S-01-money-convention`.

Sprints are defined at the start of Phase C, not earlier. Phase B does not pre-bucket findings into sprints — the catalogue is the source, and Phase C reads the full catalogue to define sprints once the picture is complete.

## 8. Doc backbone

```
audit/sweep/
├── PLAN.md            this file — canonical plan
├── CENSUS.md          every feature in the app, batch-tagged
├── STATUS.md          running ledger — every session reads this FIRST
├── findings/
│   ├── 00-summary.md  Phase B aggregate, created when the first batch closes
│   └── NN-{batch}.md  one per batch
└── sprints/
    ├── 00-roadmap.md  Phase C roadmap, created at C kickoff
    └── S-NN-*.md      one per sprint
```

Pre-existing `audit/` content — `MASTER.md`, `findings/`, `active/`, `archive/`, `feature-catalogues/`, `reports/`, `00-launch-readiness.md` — is preserved as legacy reference and remains the home for v1.1+ items not in v1 scope.

## 9. STATUS.md front-matter contract

Every session writes/updates a front-matter block at the top of `STATUS.md`, immediately under the `# STATUS` heading, as a markdown table with the following fields:

| Field | Meaning |
|---|---|
| Phase | A through F. |
| Active batch | Batch ID + name, or `(none)` between batches. |
| Last session | Session ID and absolute date (YYYY-MM-DD). |
| Next session must | One-sentence directive for the very first action of the next session. |
| Total findings | Integer count, including pre-investigation entries. |
| By severity | Critical / High / Medium / Low breakdown. |
| Closed | Integer count of findings with `Status: closed`. |
| Banner | Literal text `AUDIT IN PROGRESS — DO NOT FIX YET` whenever Phase < C. Removed once Phase C is authorised. |

The banner is load-bearing. While Phase < C, anyone reading STATUS.md — Claude Code, a new Claude chat, Jamie's own future self — sees the banner before reading anything else.

## 10. The 11-section Claude Code prompt contract

Every Claude Code session executing Path Y work runs from a prompt with exactly these eleven sections, in this order:

1. **Session header** — session ID, date, phase, this-session goal, prev session, next session.
2. **Setup steps** — exact bash commands to bring the working tree to the expected baseline, with expected HEAD and halt conditions. Setup step 2 includes bun→npm auto-detect: `if command -v bun >/dev/null; then bun install; bun run typecheck; else npm install; npm run typecheck; fi` (s43 methodology lesson #6).
3. **Token & secret locations** — canonical list of where credentials live (`.env.test`, `~/.claude/settings.json`, Supabase secrets). Hard rule on never echoing production secrets; verification by prefix/suffix length only.
4. **Project IDs** — repo, working tree path, branch, expected HEAD, Supabase project refs, key UUIDs.
5. **READ-FIRST list** — files Claude Code must view before any other action, in order.
6. **Pre-investigation findings** — evidence captured from prior sessions, NOT to be re-investigated or fixed; tagged to target batches. Methodology constraints (cumulative through s43):
   - Schema-name verification via `information_schema.tables` / `pg_proc` LIKE patterns BEFORE constructing IN-lists (s42 lesson).
   - Trigger-event decoding via OR-able-bit enumeration in CTE, NOT first-match CASE WHEN (s43 lesson #4).
   - TS-bypass-cast prevalence sweep covers sub-patterns A (`(supabase.rpc as any)`), B (`as any[]` return-cast), C (misc payload casts) (s43 lesson #5).
   - Multi-export hook files honoured — `useFooBar.ts` may contain >1 export.
7. **Scope** — IN/OUT scope this session; existing-doc reconciliation policy.
8. **Phase-by-phase plan** — every phase of this session has a goal, an EXIT condition, allowed/forbidden boundaries, and a halt point. **Phase 0 HEAD-pin nuance**: halt only if intervening commits touch `audit/sweep/` substantively, HANDOVER.md narrative, batch-relevant edge fns, or schema; pure cosmetic/widget/doc commits do not block.
9. **Hard rules** — non-negotiable rules for this session (audit-only mode, no migrations, no deploys, no force push, halt-before-commit on every Phase EXIT, no secrets echoed, evidence-first severity, class-pattern reuse, no timing predictions, no `apply_migration` during Phase B).
10. **Required updates at session end** — three categories, ALL mandatory:
    - **(a) CC-facing repo edits**: HANDOVER.md prepend (s-NN entry), `audit/sweep/STATUS.md` update (severity tally + batch tracker + session log + PI register if changed), findings doc for this batch.
    - **(b) Reviewing-Claude handover snapshot**: `audit/sweep/handovers/reviewing-claude-sNN-close.md` — fresh-written each session, authored by the reviewing Claude inside the Phase 10 paste-back, committed verbatim by CC. The **§10.8 sub-step** delivering this snapshot in the Phase 10 paste-back is mandatory **in every Phase 10 paste-back from s44 onward**. The latest snapshot bootstraps the next reviewing-Claude chat when chat continuity rolls over.
    - **(c) PLAN.md / CENSUS.md edits**: only if explicitly justified by a discipline correction or methodology lesson; never silently.
11. **EXIT report template** — the canonical EXIT report block to paste back to Jamie at session end. Includes: commits landed, **reviewing-Claude handover snapshot committed (§10(b) confirmation, path + line count)**, findings closed with proof, findings deferred with reason, new findings for next batch, baseline test delta, confidence rating.

If any Claude Code prompt arrives missing one of these 11 sections, halt and surface to Jamie — that is a discipline failure.
