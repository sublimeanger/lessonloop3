# LoopAssist confirm-flow: three sequential root causes (s37 → s38)

**Severity:** P0 (launch-blocker; marketed differentiator silently broken for ~2 months)
**Status:** RESOLVED in s38 — all three layers fixed + regression-tested
**Area:** AI / LoopAssist / schema / data
**Discovered:** 2026-05-09 (s37 chat audit), 2026-05-11 (s38 manual verify + DB inspection)
**Fixed:** 2026-05-11 (s37 Phase 1A + s38 Phase 0–1)
**Affected:** Every LoopAssist write-action confirm click for every user across every org since at least 2026-03-04

## TL;DR

LoopAssist's "propose action → confirm → execute" pipeline had three layered bugs. Each was hidden by the one below it, so each session fixed a layer and exposed the next:

1. **s37**: invoice citation marker in chat-fn omitted UUIDs → model emitted proposals with invoice numbers in `entities[].id` → client-side `validateProposal` UUID regex dropped them silently. **Net effect: every "send reminders" attempt produced zero proposal rows.**
2. **s38 layer 1**: once the proposal rendered correctly post-s37, the *execute* function tried to atomic-claim it via `UPDATE … SET status='executing' WHERE status='proposed'`, but the `ai_action_proposals_status_check` CHECK constraint allowed only `[proposed, confirmed, executed, failed, cancelled]` — `'executing'` was never in the allowed values. **Net effect: every confirm click returned 409 "Proposal already processed" (misleading) without modifying any row.**
3. **s38 layer 2**: once the CHECK constraint was fixed and the handler ran, the `send_invoice_reminders` handler looked up recipient email only via direct FKs (`invoice.payer_guardian_id` → guardian.email, then `invoice.payer_student_id` → student.email). It did not fall back through `student_guardians.is_primary_payer + receives_billing → guardian.email`. **Net effect on shadow studio (and on any real prod studio where a minor with no email is the named payer): handler ran, queued zero reminders, returned "✓ Queued 0 payment reminder(s)" — a success-shaped response for a no-op outcome.**

Each layer's fix is independently necessary; the marketing claim "LoopAssist proposes actions; you approve with one click" only became technically true after all three landed.

## Symptoms by session

**s36 / earlier:** Marketing made the claim. No automated test exercised the full proposal→confirm pipeline. No reports because the user-facing failure mode varied silently across the three layers.

**s37 manual walkthrough (Jamie, shadow studio):** "show me outstanding invoices" → "yes please draft reminders" → assistant says "I'll draft…" → **nothing renders below**. Pre-investigation hypothesised "instruction buried at 88% of knowledge base"; that hypothesis was wrong. Real cause was the invoice citation marker omitting UUIDs; client validator silently dropped proposals.

**s38 pre-investigation:** Tested s37 fix in shadow studio. Action card now rendered with UUIDs in entities + params (Phase 1A working). Click Confirm → **"Error: Proposal already processed"** on first attempt. Edge fn logs show one POST → 409. `audit_log` shows only the INSERT row, no UPDATE. RLS-context SQL reproduction returned `new row for relation "ai_action_proposals" violates check constraint "ai_action_proposals_status_check"`. The CHECK constraint mismatch.

**s38 manual re-test post-constraint-fix:** Action card rendered, confirm clicked → **"✓ Queued 0 payment reminder(s) — review and send from Messages"**. DB inspection showed proposal d414fac7 in `status='executed'` with `result.reminders_sent=0, result.details=['LL-2026-00108: No email address', ...]`. The third layer — handler email resolution didn't fall back through `student_guardians`.

## Evidence

All three layers were verified against live DB state via Supabase MCP execute_sql:

- s37: `ai_messages` content showed `[Invoice:LL-2026-00108]` markers (2-part, no UUID); pre-fix `ai_action_proposals` rowcount for shadow studio = 0.
- s38 layer 1: `pg_get_constraintdef(...)` for `ai_action_proposals_status_check` did NOT include `'executing'`. `audit_log` for proposal `8d5cb48c` had only one INSERT row, no UPDATE. RLS-context reproduction returned the Postgres CHECK violation.
- s38 layer 2: proposal `d414fac7` post-second-click had `result.reminders_sent=0` + four "No email address" entries; all 90 shadow invoices had `payer_guardian_id IS NULL` + `payer_student_id` populated; all 90 students had a primary-payer guardian via `student_guardians` (receives_billing=true) with a valid email — the fallback path was present but unused.

## Scale

- s37 layer: every LoopAssist invoice-action proposal across every user across every org since at least 2026-03-04 was silently dropped at the client validator.
- s38 layer 1: 17 'proposed' rows accumulated across 6+ orgs / 6+ users between 2026-03-04 and 2026-05-11. Two 'executed' rows total in the same window — both from before the constraint or code drifted into using 'executing'.
- s38 layer 2: not yet observed in real production (shadow studio's seed shape is unusual — student-payer + minor with no email). But the gap is real: any real studio creating an invoice with `payer_student_id` for a minor would silently fail to send reminders forever.

## Fix layers

### s37 Phase 1A — invoice citation marker

In `supabase/functions/looopassist-chat/index.ts`, all 4 invoice-bracket emit sites updated from `[Invoice:${inv.invoice_number}]` to `[Invoice:${inv.id}:${inv.invoice_number}]`. Strip regex at line 1022 updated to match the 3-part shape. Knowledge base rewritten with explicit UUID guidance + negative example. Server-side broken-promise detector added as safety net. See `audit/findings/2026-05-11-loopassist-comprehensive-audit.md` for the full Phase 1 detail.

### s38 Phase 0 — CHECK constraint

Migration `20260523100000_ai_action_proposals_add_executing_status.sql` widens the constraint to include `'executing'`. Applied via Supabase MCP as a chat-applied hotfix (Lauren-onboarding-blocker, narrow, reversible) and tracked in repo. No code change in `looopassist-execute` — the code was always correct; the schema was the lie.

### s38 Phase 1 — handler email resolution

New shared module `supabase/functions/_shared/invoice-recipient.ts` exporting:
- `INVOICE_RECIPIENT_SELECT` — canonical PostgREST SELECT shape that joins guardians, students, AND `student_guardians.guardian` so the resolver has every path available.
- `resolveInvoiceRecipient(invoice)` — pure function returning `{ ok: true, email, name, recipientType, recipientId, source }` or `{ ok: false, reason }`. Priority: direct guardian → direct student → student's primary-payer guardian via `student_guardians`.

`looopassist-execute`'s `executeSendInvoiceReminders` and the inline `send_bulk_reminders` handler both updated to use the shared resolver. Result surface restructured to classify outcomes: `success` (all queued), `partial` (some queued, some skipped), `no_op` (zero queued). The outer dispatcher overrides `newStatus='failed'` when outcome is `no_op` so the chat UI renders `✗` instead of a misleading `✓`. Audit-log lifecycle now accurately reflects whether the intent was realised.

## Regression tests

`tests/e2e/master/21-loopassist-actions.spec.ts` — seven deterministic tests covering the proposal-execute lifecycle by bypassing the Anthropic call entirely (synthetic `ai_action_proposals` row + curl to the execute fn). Test harness lives in `tests/e2e/master/_fixtures/loopassist-harness.ts`.

| Test | Layer covered |
|---|---|
| §21.5.1 | Direct guardian payer happy path |
| §21.5.2 | **Student-payer fallback through `student_guardians`** (this is the s38 third root cause, codified) |
| §21.5.3 | Cancel path → status=cancelled, no message_log |
| §21.5.4 | Double-confirm safety (no double-queue) |
| §21.5.5 | **No recipient reachable → outcome=no_op, status=failed, ✗ prefix** ("Queued 0 ✓" surface fix) |
| §21.5.6 | **Partial success → outcome=partial, status=executed** (mixed-outcome surface) |
| §21.5.7 | **Entity ownership: bogus UUID rejected** (closed the invoice-skip hole in ENTITY_TABLE_MAP) |

The 6 fixmes in `21-loopassist.spec.ts` that previously listed `§21.5 — action proposal accept → looopassist-execute called` (and friends) are removed; the new file supersedes them with real tests, not placeholders.

## Side fix: entity ownership uniform

`looopassist-execute/index.ts:212–233` previously had `ENTITY_TABLE_MAP` with a comment `// invoice entities use invoice_number not UUID, skip ownership check`. That comment was stale post-s37 (invoice entities now use UUIDs). Updated map to include `invoice: "invoices"`. §21.5.7 verifies a bogus-UUID proposal fails at the entry point with "Entity not found in your organisation" instead of slipping through to handler-layer scoping.

## Cleanup

`20260523100100_s38_cancel_stale_constraint_era_proposals.sql` — bulk-transitions all `status='proposed'` rows with `created_at < 2026-05-11` to `status='cancelled'` with an audit-log row explaining why. 16 rows transitioned; the post-cutoff proposal (`8d5cb48c…`) is preserved for Jamie's live UI verification. Result: cancelled 31 / executed 3 / proposed 1.

## Why this was missed — three times

1. **No deterministic e2e of the full pipeline.** The 45-test workflow spec stubbed at the HTTP boundary or skipped the Anthropic call. The full path — proposal insert → confirm → handler → result message → audit log — had **never** been exercised in CI without manual handholding. Every session's bug would have been caught by a single deterministic test.

2. **Tool result format was prose, not structured data.** The s37 layer (citation marker shape) was a string-template inconsistency between four entity types. Structured tool results (JSON discriminated unions) would have made the inconsistency impossible to ship.

3. **No outcome telemetry.** The handler returned `reminders_sent=0` happily; no metric, alert, or log surfaced that as an anomaly. Anomaly detection on `outcome='no_op'` rate would have flagged the s38 layer 2 within hours.

## Follow-up (sprint 2+)

- `looopassist-chat`'s `search_invoices` tool result still constructs prose; rewriting to use the canonical SELECT shape + structured JSON tool results closes the s37 class of bug structurally.
- The other 9 action handlers (`generate_billing_run`, `reschedule_lessons`, `draft_email`, `mark_attendance`, `cancel_lesson`, `complete_lessons`, `send_progress_report`, `send_bulk_reminders`, `bulk_complete_lessons`) need parallel canary tests using the same harness — see `audit/feature-catalogues/loopassist.md` rows 4–13.
- Single source of truth for action registry (currently three: knowledge base, execute fn role permissions, client validator) — collapse into one TS module so adding action #11 touches one file.
- Centralise `resolveInvoiceRecipient` usage in `overdue-reminders` cron, `send-invoice-email`, and any future ad-hoc invoice notification path — currently each rolls its own (shallow) lookup.

## Related findings

- `audit/findings/2026-05-11-loopassist-comprehensive-audit.md` (s37 Phase 0–1 root-cause + Phase 1 surgical fix)
- `audit/findings/2026-05-11-rate-amount-convention-enforcement.md` (s36 — same class of issue: code's expected shape didn't match the schema's actual shape)
- `audit/feature-catalogues/loopassist.md` (capability-by-capability status)
