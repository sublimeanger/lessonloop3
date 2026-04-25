# J9 Phase 4B — apply pending migration

## Status of what's already in the codebase  
  
make sure all added UX is polished for both mobile and desktop too.

Frontend is fully landed and wired — no code to write:

- `src/pages/RecurringTemplateDetail.tsx`, `src/pages/RecurringRunDetail.tsx` — present
- `src/hooks/useRecurringTemplateDetailPage.ts`, `src/hooks/useRecurringTemplateRuns.ts` (with `useRetryFailedRecipients`, `useCancelTemplateRun`) — present
- `src/components/dashboard/RecurringRunsCard.tsx`, `src/components/settings/recurring-billing/RecurringFailuresBanner.tsx` — present
- `src/config/routes.ts` — both new routes registered (`/settings/recurring-billing/:templateId`, `/settings/recurring-billing/runs/:runId`), gated to owner/admin/finance
- Phase 4A edits to `RecipientsField`, `ItemsField`, `RecurringBillingTab`, `useRecurringInvoiceTemplates` already in place from prior phases

The migration file `supabase/migrations/20260428100000_recurring_retry_failed_recipients.sql` is on disk, but **not yet applied to the database**:

- `recurring_template_runs.parent_run_id` column → does NOT exist
- `retry_failed_recipients` RPC → does NOT exist (only `cancel_template_run` and `generate_invoices_from_template` are present)
- `src/integrations/supabase/types.ts` → no `retry_failed_recipients` entry

The hooks (`useRetryFailedRecipients`, `useCancelTemplateRun`) already use `(supabase.rpc as any)` casts, so the UI will function the moment the RPC exists in the DB; types will regenerate automatically.

## What this plan does

1. **Apply the pending migration** as a Lovable-mirrored migration containing the verbatim contents of `20260428100000_recurring_retry_failed_recipients.sql`:
  - `ALTER TABLE recurring_template_runs ADD COLUMN IF NOT EXISTS parent_run_id uuid REFERENCES recurring_template_runs(id) ON DELETE SET NULL`
  - Partial index `idx_recurring_template_runs_parent` on `parent_run_id WHERE NOT NULL`
  - `CREATE OR REPLACE FUNCTION retry_failed_recipients(_run_id uuid) RETURNS jsonb` (SECURITY DEFINER) — full body per the file, including: parent run lock, `is_org_finance_team` auth gate, refusal of `cancelled`/`running` parents, `parent_run_id` linkage on the new run row with `triggered_by='retry'`, per-recipient savepoint loop, `already_invoiced` pre-check for upfront/hybrid, delivered-mode lesson dedup, rate-card chain, CIWI call with provenance UPDATE, and outcome rollup (`completed` / `partial` / `failed`)
  - `GRANT EXECUTE … TO authenticated, service_role`
  - `NOTIFY pgrst, 'reload schema'`
2. **Verify** post-apply by querying:
  - `information_schema.columns` for `parent_run_id` (expect 1 row, nullable, uuid)
  - `pg_proc` for `retry_failed_recipients` (expect 1 row)
3. **Report back** with the verification results, types.ts regen status (Lovable handles this automatically post-apply), and confirmation that the new routes resolve.

## Out of scope

- No edge function changes
- No cron changes
- No additional frontend code (everything is already on disk)
- Manual smoke tests 4-8 require populated org data and operator-driven retry scenarios — I'll note them as "requires test data" in the report rather than attempting them here