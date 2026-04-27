# Rate Snapshot Fix — Scope

Purpose: complete inventory before a fix is written for the `lesson_participants.rate_minor` snapshot gap flagged as HIGH in Section 3b of BILLING_FORENSICS.md. Read-only investigation.

## 1. All INSERT paths to `lesson_participants`

Enumerated by grep across `src/`, `supabase/functions/`, `supabase/migrations/`. Live paths only (later migrations of the same function supersede earlier versions — the older rows below have been excluded from the count and noted at the bottom).

| # | File:line | Trigger | Sets `rate_minor`? | Rate source if patched |
|---|-----------|---------|--------------------|------------------------|
| 1 | `src/components/calendar/useLessonForm.ts:565-567` | Main lesson edit / reschedule form | **Conditional** — fetches `rate_cards`, includes `rate_minor` via `...(rate != null ? { rate_minor: rate } : {})` at line 560. Silent skip if fetch throws (try/catch at line 550 swallows). | Already implemented; harden by failing-loud instead of silent-skip |
| 2 | `src/components/calendar/useLessonForm.ts:755-757` | Main lesson initial creation | **Conditional** — same pattern, line 751 spread, catch at line 744. | Same as #1 |
| 3 | `src/components/calendar/QuickCreatePopover.tsx:156-160` | Calendar quick-create popover | **No** — `{org_id, lesson_id, student_id}` only | `rate_cards` lookup by lesson duration at call site |
| 4 | `supabase/functions/csv-import-execute/index.ts:1235-1239` | Bulk CSV student/lesson import | **No** | `rate_cards` lookup per-row inside the import loop |
| 5 | `supabase/functions/process-term-adjustment/index.ts:755` | Term-adjustment continuation flow | **No** — `participantRows` built at lines 749-753 without `rate_minor`. The function already has `lessonRate` computed at lines 273-274 (from `manual_rate_minor` or rate_card lookup) and persists it onto the adjustment record at line 462 — so the rate is already in scope at the call site, just not propagated. | Local `lessonRate` variable already in scope |
| 6 | `supabase/functions/seed-e2e-data/index.ts:543` | E2E test fixture seeding | **No** | `rate_cards` lookup or fixed seed value |
| 7 | `supabase/functions/seed-demo-data/index.ts:442` (rows built at line 409) | Demo-org seeding | **No** | Fixed seed value |
| 8 | `supabase/functions/seed-demo-solo/index.ts:319` (rows built at line 307) | Solo demo seeding | **No** | Fixed seed value |
| 9 | `supabase/functions/seed-demo-agency/index.ts:538` (rows built at line 511) | Agency demo seeding | **No** | Fixed seed value |
| 10 | `supabase/migrations/20260316270000_fix_waitlist_audit_findings.sql:92-93` — `confirm_makeup_booking(_waitlist_id, _org_id)` RPC | Make-up booking from waitlist match (trigger/RPC) | **No** — `INSERT INTO lesson_participants (lesson_id, student_id, org_id)` | The function resolves `_lesson` earlier (implicit in `matched_lesson_id`). A rate_card lookup by lesson duration would work; alternatively carry `rate_minor` from the originating missed lesson's `lesson_participants` row |
| 11 | `supabase/migrations/20260316250000_materialise_continuation_lessons.sql:133-135` — `materialise_continuation_lessons` RPC | Term continuation materialisation (RPC) | **Yes** — `INSERT INTO lesson_participants (org_id, lesson_id, student_id, rate_minor) VALUES (p_org_id, _new_lesson_id, p_student_id, p_rate_minor)` | N/A — already correct |

**Totals:** 11 live INSERT paths. **3** populate `rate_minor` (1 unconditional + 2 conditional with silent failure mode). **8** never populate.

**Superseded migration versions** (historical, not counted — later migrations redefined the same function):
- `20260316260000:110-111` (`confirm_makeup_booking`) — superseded by `20260316270000`.
- `20260315200300:80` (`confirm_makeup_booking`) — superseded.
- `20260315200100:78` (`confirm_makeup_booking`) — superseded.
- `20260223004403:74` (`confirm_makeup_booking`) — superseded.
- `20260222234306:253` (`confirm_makeup_booking`) — superseded.
- `20260222233359:65` (`confirm_makeup_booking`) — earliest version.

## 2. Rate card history

- **No history table.** `rate_cards` is defined at `supabase/migrations/20260119231833_2b03d37b-3e0a-4314-ade3-c9f69c76e932.sql:40-50` with columns: `id, org_id, name, duration_mins, rate_amount, currency_code, is_default, created_at, updated_at`. No `effective_from` / `effective_to`, no `rate_cards_history` table, no dedicated version column.
- **Only trigger on the table** is `update_rate_cards_updated_at` at `supabase/migrations/20260119231833_...sql:148-151`, a `BEFORE UPDATE` setting `updated_at`. No audit-log trigger.
- **`docs/AUDIT_LOGGING.md:127`** claims `rate_cards` has pricing-history audit coverage ("✅ ✅ ✅ Pricing history"). Grep for an audit trigger attached to `rate_cards` (`supabase/migrations` for `TRIGGER.*rate_cards`, `audit_rate_cards`, `trg_audit_rate`) returns **zero** matches. Client hooks (`src/hooks/useRateCards.ts`) perform direct `update`/`insert`/`delete` on the table with no `logAudit` call. The documentation claim is aspirational and not implemented.
- **Reconstruction of historical rates is therefore impossible** from inside the app. The only signal that a rate changed is `rate_cards.updated_at` (one timestamp per card, no before-value retained). An NULL-snapshot lesson dated before a rate bump cannot be backfilled to the correct historical rate — the historical rate is not stored anywhere.

## 3. NULL `rate_minor` rows — schema reality

- **Nullable:** yes. `supabase/migrations/20260315083032_b42e8c3a-...sql:1` — `ALTER TABLE public.lesson_participants ADD COLUMN IF NOT EXISTS rate_minor integer DEFAULT NULL`. The descriptive migration `20260315220001_add_rate_minor_to_lesson_participants.sql:3-4` adds the same column (idempotent `IF NOT EXISTS`) with a `COMMENT` describing the snapshot intent, but does not apply a constraint or backfill.
- **No CHECK constraint** on the column (grep for `CHECK.*rate_minor` in `supabase/migrations/` returns none beyond the column addition). Negative or zero values are not rejected at the DB level.
- **No default** beyond `NULL`. No backfill migration populates `rate_minor` for rows that predate the column addition.
- **Generated types** (`src/integrations/supabase/types.ts`) type `rate_minor` as `number | null`.

## 4. Billing run fallback behaviour

- **Code path:** `supabase/functions/create-billing-run/index.ts:696-704`:
  ```
  if (snapshotRate != null && snapshotRate > 0) return snapshotRate;
  const durationMins = Math.round((end - start) / 60000);
  return findRateForDuration(durationMins, rateCards || [], fallbackRate);
  ```
  where `findRateForDuration` at lines 50-61 picks the `rate_cards` row whose `duration_mins` matches, otherwise the `is_default` card, otherwise the first card, otherwise `fallbackRate` (caller-supplied, default `3000`).
- **Fallback is live** — uses whatever is in `rate_cards` at bill-time, not lesson-time.
- **User-visible documentation of the fallback: none.** Grep for "rate snapshot" / "retroactive" / "snapshot" across the codebase returns only:
  - Code comments inside `create-billing-run/index.ts:697-699`
  - Migration comments at `20260315220001_add_rate_minor_to_lesson_participants.sql:1-7`
  - The `BILLING_FORENSICS.md` audit (this repo, internal)
  - The `looopassist-chat` knowledge base (might surface to chatbot users but not inside the billing-run UI)
- No banner, toast, or review-step in `BillingRunWizard.tsx` warns the operator that N of M lessons will price at current rates rather than at lesson-time rates.

## 5. Tests

- **Vitest coverage:** `src/test/billing/BillingRunCreation.test.ts` uses a single parameter `rateMinor` for invoice-total calculations (line 60) and tests the arithmetic. It does **not** cover the snapshot-vs-live fallback. Grep for `rate_minor` / `snapshotRate` / `snapshot` across `src/test/` returns zero matches.
- **Playwright coverage:** `tests/e2e/invoices.spec.ts`, `tests/e2e/calendar.spec.ts`, and sibling specs do not reference `rate_minor`, snapshots, or mid-period rate changes. Grep across `tests/` returns zero matches.
- **Coverage gap:** no test exercises the "create lesson at rate A → change rate_cards to B → run billing" scenario end-to-end. The bug is invisible to the current test suite.

## 6. Proposed fix options

| Option | Description | Complexity | Risk | User-facing impact |
|--------|-------------|------------|------|--------------------|
| **A** | Patch the 8 no-set paths (rows 3-10 in section 1). For each: add a `rate_cards` lookup or accept a `rate_minor` parameter from caller. Harden the 2 conditional paths (rows 1-2) by failing loudly instead of silent-catch. Leave existing NULLs untouched; fallback continues as today. | **Low** — ~8 small diffs, all localised | **Low** — new code only sets a previously-unset column; no data migration | None for operators; incrementally improves correctness for all new lessons |
| **B** | A + backfill existing NULLs with best-available historical rate. | **Not feasible as specified.** Section 2 shows rate history is not stored anywhere. Any backfill would use the *current* rate — which is exactly what the fallback already does, so the backfill would be a no-op semantically while removing the NULL signal that "this row is using a fallback". | — | — |
| **C** | A + UI confirmation before a billing run flags any NULL-snapshot rows and requires the operator to (a) acknowledge the live-rate fallback, or (b) set a per-lesson override. Persist the operator's acknowledgement on the lesson so it is not re-prompted. | **Medium** — new wizard step, new override column or audit entry, new banner | **Low-to-medium** — behaviour change in the most visible user flow; teachers may be surprised on first run | Prevents surprise repricing; adds one confirmation click per billing run when old NULL rows are in range |
| **D** | A + `NOT NULL` constraint on `rate_minor` once all paths patched. | **High** — requires A complete, all historical rows backfilled (impossible per B above) or hard-deleted, and every remaining path validated. Risk of constraint violation breaking unrelated flows (demo seeding, E2E tests, CSV import). | **High** — one missed insert path crashes the feature in production | Hardens against future regression but high blast radius if any path is missed |

## Recommendation

**Option A + Option C, in that order.**

Rationale:
- Option A is the necessary and sufficient change for *new* data. It is small, localised, and mechanically reviewable. Each of the 8 no-set paths can be patched in isolation with a targeted test.
- Option B is not available — there is no rate history to backfill from.
- Option C handles the *existing* NULL rows (potentially thousands per mature org) without guessing. It turns the silent retroactive-repricing failure into an explicit operator decision at billing-run time, which is the teacher-visible boundary where it actually matters. It also gives us an audit footprint (the operator acknowledgement) that the DDL gives us for nothing today.
- Option D should be deferred until A has landed, settled for one billing cycle, and we have evidence every path is covered. A premature NOT NULL is the highest-risk option because the blast radius (billing run crashes for an entire org) is enormous and the benefit (defence-in-depth) is modest once A is in place.

Flag for fix-pass discussion: whether C's "per-lesson override" should live on `lesson_participants` (new column) or on the `lessons` row (audit_log entry), and whether the operator acknowledgement should be per-billing-run or persisted per-lesson-forever.
