

# Fix: LoopAssist Action Proposals Not Rendering for Bulk Operations

## Root Cause

The system prompt in the chat edge function defines **10 action types**, but the frontend only recognises **8**. Two bulk-specific types are missing from the frontend validation:

- `bulk_complete_lessons` (used when the AI wants to mark all past lessons complete)
- `send_bulk_reminders` (used when the AI wants to send all overdue reminders)

When the AI emits one of these types, the frontend's `VALID_ACTION_TYPES` check silently discards it, so no proposal record is created and no ActionCard appears.

## Fix Strategy

Rather than adding two more action types to the frontend (which duplicates logic), the cleaner fix is to **consolidate** the prompt so the AI always uses the existing types (`complete_lessons` and `send_invoice_reminders`) for both single and bulk operations, and update the execute function to handle bulk params on those existing types.

### Changes

**1. System prompt (`supabase/functions/looopassist-chat/index.ts`)**
- Remove action types #9 (`send_bulk_reminders`) and #10 (`bulk_complete_lessons`) from the prompt
- Update the `complete_lessons` description to clarify it handles both single and bulk (just pass multiple `lesson_ids`)
- Update `send_invoice_reminders` similarly

**2. Execute function (`supabase/functions/looopassist-execute/index.ts`)**
- Merge the `bulk_complete_lessons` case logic into the `complete_lessons` handler (if no `lesson_ids` provided, fall back to "all past scheduled" behaviour)
- Merge `send_bulk_reminders` logic into `send_invoice_reminders` (if no `invoice_ids`, find all overdue)
- Remove the standalone `bulk_complete_lessons` and `send_bulk_reminders` cases
- Remove them from `ACTION_ROLE_PERMISSIONS`

**3. Frontend (`src/hooks/useLoopAssist.ts`)**
- As a safety net, also add `bulk_complete_lessons` and `send_bulk_reminders` to `VALID_ACTION_TYPES` so any in-flight conversations that already have these types still work

**4. Frontend (`src/components/loopassist/ActionCard.tsx`)**
- Add `bulk_complete_lessons` and `send_bulk_reminders` to `ACTION_ICONS`, `ACTION_LABELS`, `ACTION_ROLE_PERMISSIONS`
- Add preview text logic for `bulk_complete_lessons`
- Add to the `ActionProposalData.action_type` union

### Summary of file changes

| File | Change |
|------|--------|
| `supabase/functions/looopassist-chat/index.ts` | Remove types #9 and #10 from system prompt; update #2 and #7 descriptions |
| `supabase/functions/looopassist-execute/index.ts` | Merge bulk handlers into existing types; keep old cases as aliases for backwards compat |
| `src/hooks/useLoopAssist.ts` | Add `bulk_complete_lessons` and `send_bulk_reminders` to `VALID_ACTION_TYPES` |
| `src/components/loopassist/ActionCard.tsx` | Add both types to icons, labels, permissions, preview text, and the type union |

This ensures existing conversations with the old types still work, while new conversations will use the consolidated types.

