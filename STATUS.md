# Project status

**Last updated:** 2026-04-29 (Batch 2D / branch `claude/location-reschedule-override-7qJIX` — J2-F24 per-lesson reschedule policy resolution with location override)

## Next session handoff

- **Active area:** Area 2 — Parent Portal
- **Current batch:** (none in flight) post-merge
- **Last merged PR / branch:** PR #376 / `claude/location-reschedule-override-7qJIX` (Batch 2D) — open at end of this session, awaiting merge. PR #375 / `claude/fix-rls-guardian-scoping-Szciu` (Batch 2C) — confirmed complete by Lovable 2026-04-29 12:05 UTC (verification-method note: real-browser GET on `/rest/v1/term_continuation_responses` under parent JWT returned 200 from previously-blank `/portal/home` — this is the canonical proof for RLS-recursion-class fixes; the earlier `read_query`-role SQL impersonation bypasses RLS so was weaker than initially framed; codify in V2 verification template — filed in POLISH_NOTES Batch 2D).
- **What shipped:** J2-F24 closed. `PortalSchedule.tsx` page-level `reschedulePolicy/canReschedule/showSlotPicker` declarations replaced with a per-lesson `resolveReschedulePolicy(lesson)` resolver that applies `location.parent_reschedule_policy_override ?? org.parent_reschedule_policy ?? 'request_only'` precedence. `useParentLessons` query and lesson types extended to carry the location override field. Frontend-only fix; no migration, no edge fn change.
- **Lovable after-merge actions:** (none) for migrations — this batch ships zero migrations. (none) for edge functions — this batch ships zero edge fn changes.
- **Lovable status:** pending until Jamie confirms
- **Production SQL verification:** (none) — no schema change to verify.
- **App behaviour checks:** Parent on org with mixed-policy locations sees per-location override on each lesson card (org default e.g. `self_service`, one location override `admin_locked` — lessons at the override location hide the "Reschedule"/"Request Change" action; lessons elsewhere keep it). Parents at orgs with no per-location override see unchanged UI.
- **Next batch in active area:** Batch 2E — TBD by chat-Claude after this PR merges. Candidates: CC-2 money-math (J1-F17 + J3-F7 + CC-F7); J3-F19 refund netting in payment-intent edge function.
- **Next area after this one closes:** Area 3 — Students & guardians (per `LESSONLOOP_PRODUCTION_ROADMAP.md` status table)
- **Roadmap progress:** Area 1 closed; Area 2 in progress at **9/15 HIGH** (was 8/15; +J2-F24); Areas 0, 3-16 pending (17 areas total per `LESSONLOOP_PRODUCTION_ROADMAP.md` status table)
- **Next session first instruction:** After PR #376 merges and Jamie confirms the per-lesson override behaviour in a real browser (mixed-policy org + override-location lesson card), paste Batch 2E's prompt into a fresh Claude Code session.

---

## Active area

**Area 2 — Parent Portal**

- Walk: complete (`docs/audits/2026-04-area-2-parent-portal.md`)
- Findings: 18 HIGH (across 15 fix briefs — J1-F31 added in this batch), 25 MED, ~110 LOW + portal-defense-1 (MED, this batch)
- Fixes shipped: 4 of 14 HIGH (J5-F11 already-closed; J6-F4 + J6-F5 RLS lockdown — PR #367; J8-F9 + J8-F8 RLS lockdown + edge fn validation — PR #367 + follow-up PR #368; J1-F15 portal currency — Lovable 37163c52 + docs PR #370). Plus 3 LOW closed alongside (J3-F2, J3-F10, J3-F15-currency); CC-F8 closed by Batch 2A PR #373; broader CC-3 sweep — PR #373; J1-F1 + J1-F4 + J1-F29 + CC-1 partial — PR #374; CC-F15 + J1-F31 + portal-defense-1 — PR #375; J2-F24 — this PR.
- Status: 6 of 15 HIGH remaining (was 7; J2-F24 closed). Net: 9/15 HIGH closed. Next: Batch 2E — TBD; candidates CC-2 money-math (J1-F17 + J3-F7 + CC-F7) or J3-F19 refund netting.
- **Batch 2A (PR #373) — Lovable status:** confirmed complete 2026-04-29 06:48 UTC. Deployed 22 edge functions (20 named in PR body + 2 downstream importers of `_shared/auto-pay-reminder-core.ts` and `_shared/send-invoice-email-core.ts`).
- **Batch 2B (PR #374) — Lovable status:** confirmed complete 2026-04-29 07:35 UTC. All three behaviour spot-checks (cancel booked make-up; decline offered make-up; accept offered make-up) passed end-to-end via impersonated parent JWT (Jamie's verification method note: portal preview was blanked by CC-F15 recursion, so RPCs were exercised at SQL level — same code path, same SECURITY DEFINER, same triggers). `audit_make_up_waitlist` trigger fired correctly on every state change.
- **Batch 2C (PR #375) — Lovable status:** confirmed complete 2026-04-29 12:05 UTC. Migration applied; queries A–E pass; recursion-proof SQL pass (with caveat: `read_query` role bypasses RLS, so the proof is weaker than initially framed — the canonical proof is the real-browser GET on `/rest/v1/term_continuation_responses` under parent JWT, which returned 200 for `demo-parent-1` from the previously-blank `/portal/home` route). `SectionErrorBoundary` visible at `PortalHome.tsx:322`. Linter findings unchanged at 258, all pre-existing; all four functions touched have `proconfig=[search_path=public]`.

## In flight

- (none — Batch 2D PR open and awaiting merge)

## Awaiting Jamie decision

(none — all open Area 2 product decisions answered 2026-04-28)

## Recent decisions on file

- **CC-F3** (2026-04-28): Parent-side LoopAssist does NOT ship. Dead-mounted component, hook (`useParentLoopAssist`), and edge function (`parent-loopassist-chat`) to be removed in a future fix PR.
- **J3-F11** (2026-04-28): iOS payment flow → Option C. Email "Pay invoice" links open Safari direct to the invoice's pay page (not the iOS app). In-app unpaid-invoice card opens Safari direct-to-pay-page. No "visit lessonloop.net" wall.
- **J5-F4 / J5-F5** (2026-04-28): Weekly Goal card requires an active child filter to render. No multi-child aggregation.

## Recently closed areas

- **Area 1 — Billing & invoicing** (closed earlier in April 2026 — see `LESSONLOOP_PRODUCTION_ROADMAP.md` §"Area 1")
- **Area 2 — Invoicing UX** (closed earlier in April 2026 — see archived POLISH_NOTES at `docs/archive/polish-2026-q1/`)

## Next up after Area 2

Area 3 — Students & guardians (per roadmap)
