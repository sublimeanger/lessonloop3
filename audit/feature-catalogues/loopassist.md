# LoopAssist Feature Catalogue (s37+)

Capability-by-capability audit of LoopAssist. Tracks whether each marketed/implied capability is **implemented**, **e2e tested**, and **currently working in production**. This is the source of truth for s37-s39 LoopAssist work.

**Last reviewed:** 2026-05-11 (s37)
**Status:** s37 Phase 1 fix applied (Phase 1A invoice-UUID format); subsequent phases tracked in `audit/findings/2026-05-11-loopassist-comprehensive-audit.md`.

| # | Capability | Marketing claim | Implemented? | E2E tested? | Currently working? | Severity if broken |
|---|---|---|---|---|---|---|
| 1 | Answer questions about students | YES | YES (`search_students`, `get_student_detail` tools) | partial | YES | n/a |
| 2 | Answer questions about schedule | YES | YES (`search_lessons`, `get_teacher_schedule`) | partial | YES | n/a |
| 3 | Answer questions about invoices | YES | YES (`search_invoices`, `get_revenue_summary`) | partial | YES | n/a |
| 4 | Draft messages | YES | YES (`draft_email` action in execute fn) | NO | s37: was broken due to invoice-UUID bug — see #20. Other entities OK. | P0 trust-breaking |
| 5 | Send invoice reminders | YES | YES (`send_invoice_reminders`) | NO | **Was broken**: tool output omitted UUIDs → validator dropped proposal. **Fixed in s37 Phase 1A**. | P0 |
| 6 | Generate billing runs | YES | YES (`generate_billing_run`) | NO | Needs verification post-s37 — likely OK (uses student IDs, not invoice IDs) | P0 |
| 7 | Reschedule lessons | YES | YES (`reschedule_lessons`) | NO | Needs verification — uses lesson UUIDs which were already visible | P0 |
| 8 | Mark attendance | YES (implied) | YES (`mark_attendance`) | NO | Needs verification — uses lesson + student UUIDs (already visible) | P0 |
| 9 | Cancel lessons | YES (implied) | YES (`cancel_lesson`) | NO | Needs verification — uses lesson UUIDs (visible) | P0 |
| 10 | Complete lessons | YES (implied) | YES (`complete_lessons`) | NO | Needs verification — uses lesson UUIDs (visible) | P0 |
| 11 | Send progress reports | YES (implied) | YES (`send_progress_report`) | NO | Needs verification — uses student UUIDs (visible) | P0 |
| 12 | Bulk reminders | YES (implied) | YES (`send_bulk_reminders`) | NO | Same invoice-UUID dependency as #5; fixed by s37 1A. | P0 |
| 13 | Bulk complete lessons | NO (not marketed) | YES (`bulk_complete_lessons`) | NO | Same as #10 | P1 |
| 14 | Search lesson notes | NO (not marketed) | NO — no `search_lesson_notes` tool | NO | n/a — missing capability | P2 missing (s38) |
| 15 | Search make-up credits | NO | NO | NO | n/a | P2 missing (s38) |
| 16 | Search message history | NO | NO | NO | n/a | P2 missing (s38) |
| 17 | Search resources | NO | NO | NO | n/a | P2 missing (s38) |
| 18 | Proactive churn alerts | YES | partial (`get_at_risk_students` returns data; no proactive UI surfacing) | NO | partial | P2 |
| 19 | Mobile parity | YES | YES (`LoopAssistDrawer` responsive) | NO | unknown — needs spot-check | P2 |
| 20 | Multi-org isolation | YES | YES (RLS-gated at every tool call) | partial | should be — needs verification | P0 if broken |
| 21 | Audit trail | YES ("every action is logged") | partial (audit_log written by execute fn) | partial | needs verification | P1 |
| 22 | Role gating on destructive actions | NO (not marketed, but expected) | YES (`ACTION_REGISTRY isDestructiveAction` + `getAllowedRoles`) | NO | unknown — needs verification | P0 if broken |
| 23 | Cancelled-proposal cleanup | NO | partial (status='cancelled' works) | NO | partial | P3 |
| 24 | Stale-proposal expiry | NO | NO — 16 stuck in 'proposed' forever (cross-org) | NO | n/a — missing | P2 missing (s38) |

## Real root cause discovered (s37 Phase 0.1)

The pre-investigation hypothesis ("instruction at 88% of knowledge base, model never emits action block") is **WRONG**. Inspection of Lauren's actual failed conversation showed:

1. Model DID emit a structurally valid ` ```action ` JSON block.
2. Block had correct `action_type`, `description`, `entities[]`, `params{}`.
3. BUT: entity `id` values were **invoice numbers** (`"LL-2026-00108"`) instead of UUIDs.
4. Client-side `validateProposal` (`src/hooks/useLoopAssist.ts:77-87`) rejects entities where `id` doesn't match `UUID_RE`. Proposal silently dropped.
5. Zero proposal records in `ai_action_proposals` for shadow studio — confirmed.

Why did the model use invoice numbers? Because the chat fn's `search_invoices` tool output (`looopassist-chat/index.ts:694`) emits `[Invoice:${inv.invoice_number}]` — a 2-part marker that **omits the UUID entirely**. Compare:

- Students: `[Student:${s.id}:${s.first_name} ${s.last_name}]` ✓ UUID visible
- Lessons: `[Lesson:${l.id}:${l.title}]` ✓ UUID visible
- Guardians: `[Guardian:${g.id}:${g.full_name}]` ✓ UUID visible
- **Invoices: `[Invoice:${inv.invoice_number}]` ❌ UUID never reaches the LLM**

The model picked the only ID-shaped string available in the tool result.

## Phase 1A fix (s37)

Surgical: change all 5 invoice-bracket references in chat fn to `[Invoice:${inv.id}:${inv.invoice_number}]`. Update the `[Invoice:...]` strip regex at line 1022. Document the canonical entity-marker format in knowledge base.

## Phase 1B-D (s37)

Defense in depth — still valuable but no longer the critical path:
- Knowledge base: explicit entity-ID guidance ("the UUID is the part between the colons; not the invoice number / display label")
- Knowledge base: negative examples
- Server-side broken-promise detector (catches the OTHER failure mode where model commits to action without emitting a block at all)

## Deferred to s38

- Tool catalogue expansion (#14-17 missing tools)
- Safety hardening (org-isolation entity validation, #20 verification)
- Streaming UX (intermediate "drafting..." indicator)
- Stale-proposal expiry cron (#24)
- Parent LoopAssist parallel audit

## Deferred to s39

- Marketing alignment review (per-capability fix-or-adjust)
- Mobile parity verification (#19)
- Advanced flows (multi-turn proposals, edit-before-confirm, "undo")
- Long-tail capability adds
