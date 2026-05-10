# LoopAssist comprehensive audit + Phase 1 fix

**Severity:** P0 (trust-breaking — marketed differentiator did not work end-to-end)
**Status:** Phase 1 fix shipped in s37. Phases 2 (s38) + 3 (s39) tracked separately.
**Area:** AI / LoopAssist
**Discovered:** 2026-05-11 (Jamie's shadow studio UI walkthrough surfaced the broken proposal flow)
**Fixed:** 2026-05-11 (s37 Phase 1)

## Symptom

User: "Show me outstanding invoices" → LoopAssist returns correct list of 4 overdue invoices, asks "Want me to draft reminder emails?"
User: "yes please."
LoopAssist: "Perfect — I'll draft friendly but clear reminder emails for all four guardians ... Once you confirm, they'll be sent immediately."
**[Nothing further happens. No action card. Conversation appears to dead-end.]**

Marketing promises: "LoopAssist proposes actions and shows you exactly what it wants to do" / "Invoice runs, reschedule slots, attendance follow-ups. LoopAssist suggests — you approve with one click." These promises describe behaviour that did not work end-to-end.

## Real root cause (pre-investigation hypothesis was wrong)

The pre-investigation hypothesis was that the model wasn't following the action-block contract because the instruction was buried at 88% of a 586-line cached knowledge base. **This hypothesis was WRONG.**

Inspection of Lauren's actual conversation (via `ai_messages` table) showed:

1. The model DID emit a structurally valid ` ```action ``` ` JSON block.
2. The block had correct `action_type` ("send_invoice_reminders"), `description`, `entities[]`, `params{}`.
3. **But entity `id` values were invoice numbers** (`"LL-2026-00108"`) instead of UUIDs.
4. Client-side `validateProposal` (`src/hooks/useLoopAssist.ts:77-87`) silently dropped the proposal:
   ```ts
   if (entity.id && !UUID_RE.test(entity.id)) return false;
   ```
5. Zero proposal records in `ai_action_proposals` for shadow studio — confirmed.

Why did the model use invoice numbers? Because the chat function's `search_invoices` tool output (`looopassist-chat/index.ts:694`) emits invoice references as `[Invoice:${inv.invoice_number}]` — a 2-part marker that **omits the UUID entirely**.

Compare with the other entity tools:

| Entity | Marker format | UUID visible to LLM? |
|---|---|---|
| Student | `[Student:${s.id}:${s.first_name} ${s.last_name}]` | ✓ YES |
| Lesson | `[Lesson:${l.id}:${l.title}]` | ✓ YES |
| Guardian | `[Guardian:${g.id}:${g.full_name}]` | ✓ YES |
| **Invoice** | `[Invoice:${inv.invoice_number}]` | **✗ NO** |

The model is doing exactly what it can: picking the only ID-shaped string in the tool result. The bug is in the tool output format.

## Severity classification

- **P0**: capabilities 4-12 (every action that involves invoices) due to single root cause. Also capabilities 20 (org isolation) and 22 (role-gating) if broken — needs verification.
- **P1**: capability 21 (audit trail), 13 (bulk complete unmarketed).
- **P2**: capabilities 14-17 (missing tools), 18 (proactive surfacing), 19 (mobile parity), 24 (stale-proposal expiry).
- **P3**: capability 23 (cancelled-proposal cleanup polish).

See `audit/feature-catalogues/loopassist.md` for the full 24-capability table.

## Phase 1 fix (s37)

### Phase 1A — Core fix (5 lines + 1 strip-regex line)

`supabase/functions/looopassist-chat/index.ts`:
- Line 436: `[Invoice:${inv.invoice_number}]` → `[Invoice:${inv.id}:${inv.invoice_number}]`
- Line 694: same
- Line 989: same
- Line 1336: same (page context for current-invoice route)
- Line 1022 (strip regex): `\[Invoice:([^\]]+)\]` → `\[Invoice:[^:]+:([^\]]+)\]` (mirrors the Student/Lesson/Guardian pattern, keeping the display label)

### Phase 1B — Knowledge base updates

`supabase/functions/looopassist-chat/knowledge-base.ts`:
- Move the ACTION PROPOSALS — WRITE OPERATIONS section from the bottom (line 520 of 586) to near the top (after the personality section). Position bias improves adherence even though it wasn't the root cause this time.
- Add explicit ENTITY-ID GUIDANCE inside the ACTION PROPOSALS section:
  > "When tool results include `[Entity:UUID:Label]` markers, the UUID is the part between the colons. Always copy the UUID into proposal `entities[].id` and `params.*_ids[]`. Never use display labels (invoice numbers, names, dates) as IDs."
- Add NEGATIVE EXAMPLES (BAD vs GOOD): show invoice-number-as-ID as the canonical BAD example, fixed with UUID as the GOOD example.
- Add a RESPONSE FORMATTING reinforcement at the end:
  > "CRITICAL INVARIANT: If you commit to an action ("I'll draft", "I'll send", "I'll generate"), the message MUST contain a ` ```action ` JSON block, and entity IDs MUST be UUIDs from tool results. No exceptions."

### Phase 1C — Server-side broken-promise detector

`supabase/functions/looopassist-chat/index.ts`:
- After assembling the final assistant content, scan for promise-language without an accompanying action block.
- If detected: log to Sentry as a quality metric (warning level) with the first 500 chars of content + model + conversationId. Append a clarifying note for the user: *"I started to propose an action but didn't complete the proposal. Please ask me again — e.g., 'draft those reminders now' — and I'll attempt again."*
- This catches the ORIGINAL hypothesised failure mode (model commits to action but emits no block) which still happens occasionally and now has a graceful fallback.

### Phase 1D — Deploy + verification

Deploy `looopassist-chat` via Supabase MCP. Verify in the shadow studio: same conversation flow ("show me outstanding invoices" → "yes please") should now produce an action card with the 4 invoices, clickable Confirm/Cancel.

## Verification methodology

### Manual verification (Jamie — gates Lauren onboarding)

In the shadow studio (org 551ca74e):
1. Open LoopAssist drawer (Cmd+J)
2. Type "Show me outstanding invoices"
3. Type "yes please" (or "draft those reminders")
4. **Expected post-s37**: action card renders with 4 invoices, Confirm/Cancel buttons
5. Click Confirm
6. **Expected**: 4 invoice_reminder rows in message_log; 4 emails arrive in jamie@searchflare.co.uk inbox with `[SHADOW: 551ca74e]` prefix

### Phase 2 e2e test — deferred to s38

A live e2e test against real Anthropic was scoped for s37 but deferred. Rationale:
- Real-Anthropic e2e is non-deterministic; even a 10% flake rate would erode trust in the master baseline.
- Anthropic API spend per CI run is non-trivial.
- The prompt's HARD RULE provides an escape hatch: "if >30% flake rate, exclude + file finding for s38 mock-mode design."

s38 task: design a mock-mode for `looopassist-chat` that emits a canned action block when invoked with a designated test header (e.g., `X-LoopAssist-Mock: action-block`). The mock-mode runs in CI; the real path is exercised by manual verification + occasional smoke runs.

## Deferred work

### Deferred to s38 (tool catalogue + safety + streaming UX)

- **Tool catalogue expansion**: add `search_lesson_notes`, `search_makeup_credits`, `search_message_log`, `search_resources`.
- **Safety hardening**: server-side entity-ID validation against caller's org (defence in depth — RLS already gates, but the execute fn should reject mismatched UUIDs explicitly with a clear error).
- **Streaming UX**: surface a "drafting…" indicator while the model is mid-response, before the action block lands. Reduces the perceived dead-end.
- **Stale-proposal expiry**: cron that moves `status='proposed'` rows older than 24h to `status='expired'`. Prevents the 16-stuck rows from cross-org test data.
- **Parent LoopAssist parallel audit**: same exercise for the parent-portal LoopAssist surface (different chat fn, similar architecture).

### Deferred to s39 (marketing alignment + advanced flows)

- **Marketing alignment review**: walk through every claim on the feature page; for each, decide fix-to-match-marketing OR adjust-marketing-to-match.
- **Mobile parity verification**: spot-check `LoopAssistDrawer` on iPhone + Android viewports.
- **Advanced flows**: multi-turn proposals (edit-before-confirm), "undo" after confirm.
- **Long-tail capability adds**: surface lesson_notes content in answers, surface message history.

## Latent customer impact

No real customers exist yet. Had Lauren onboarded onto her shadow studio mid-walkthrough, she would have hit exactly this bug on first attempt to act on an invoice list — the highest-visibility moment for trust calibration with a new user.

## References

- Feature catalogue: `audit/feature-catalogues/loopassist.md`
- Affected files:
  - `supabase/functions/looopassist-chat/index.ts` (Phase 1A + 1C)
  - `supabase/functions/looopassist-chat/knowledge-base.ts` (Phase 1B)
  - `tests/e2e/master/21-loopassist.spec.ts` (Phase 2)
- Conversation evidence: `ai_messages` rows for org `551ca74e` from 2026-05-10 23:36 (Lauren's shadow studio session).
