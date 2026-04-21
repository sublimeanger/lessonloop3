

## Apply migration: `update_invoice_with_items` RPC

This is a schema change (new RPC function), so it goes through the migration tool. After approval, I'll run the verification queries and report back.

### Migration

Single `CREATE OR REPLACE FUNCTION` for `public.update_invoice_with_items(uuid, date, uuid, uuid, date, text, uuid[], jsonb)` — atomic editor for draft invoices, with:

- Row lock on the target invoice
- Auth gate: `is_org_finance_team(auth.uid(), org_id)`
- Status gate: `status = 'draft'` only
- Payer XOR gate: exactly one of `_payer_guardian_id` / `_payer_student_id`
- Items validation: non-empty array, non-empty description, qty > 0, unit price >= 0
- VAT recompute from `invoices.vat_rate`
- Payment-plan guard: blocks edits that change `total_minor` when `payment_plan_enabled = true`
- Credits: frees previously-applied credits on this invoice, re-applies `_credit_ids` (with redeemed/expired guards), caps applied to new total
- Items: `DELETE` then re-`INSERT` from `_items` jsonb
- Updates invoice header + recomputed totals
- Writes `audit_log` row (`action = 'invoice_edited'`) with before/after totals, payer, due date, item counts
- Returns jsonb summary `{ id, invoice_number, subtotal_minor, tax_minor, total_minor, credit_applied_minor, status }`

Permissions: `REVOKE ALL FROM PUBLIC`, `GRANT EXECUTE TO authenticated`.

Schema cache: `NOTIFY pgrst, 'reload schema'` inside the transaction.

### Post-apply verification (read-only)

1. Function exists + signature:
   ```sql
   SELECT proname, pg_get_function_arguments(oid)
   FROM pg_proc
   WHERE proname = 'update_invoice_with_items';
   ```
2. Privileges:
   ```sql
   SELECT grantee, privilege_type
   FROM information_schema.routine_privileges
   WHERE routine_name = 'update_invoice_with_items';
   ```
   Expected: `authenticated / EXECUTE` (no PUBLIC).
3. Smoke test (bogus uuid → expect SQLSTATE `P0002` "Invoice ... not found"):
   ```sql
   SELECT update_invoice_with_items(
     '00000000-0000-0000-0000-000000000000'::uuid,
     CURRENT_DATE,
     '00000000-0000-0000-0000-000000000000'::uuid,
     NULL, NULL, 'smoke test',
     ARRAY[]::uuid[], '[]'::jsonb
   );
   ```
4. Confirm `NOTIFY pgrst, 'reload schema'` ran (it's in the migration body).

### Report back

- Applied cleanly / errors
- Function signature output
- Privilege grant output
- Smoke test result (expect `P0002`)
- Schema reload confirmation
- No `main` modifications — DB-only change

