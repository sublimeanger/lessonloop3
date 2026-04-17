# A4 diagnostic — Paid-invoice refund ledger corruption

Read-only diagnostic for A4 (Section 6 CRITICAL finding). **Do not apply any fix based on this file alone — confirm results first.**

## What the corrupt state looks like

After Phase 1 walk-through, the corruption manifests as:
- `invoices.status = 'paid'`
- `invoices.paid_minor = invoices.total_minor` (looks fully paid in the DB)
- `SUM(refunds.amount_minor WHERE invoice_id = X AND status = 'succeeded') > 0` (real refund money moved)

The `recalculate_invoice_paid` RPC should have reduced `paid_minor` and transitioned `status → 'sent'`, but the `enforce_invoice_status_transition` trigger blocked the transition and rolled the recalc back. The refund row persisted because it was committed in a **separate** Supabase client transaction — only the webhook + admin-refund edge function paths have this behaviour. The `record_manual_refund` RPC is atomic (single server-side transaction) so refunds through it do NOT leave a corrupt state; they loudly fail instead.

## Which paths corrupt vs fail loudly

| Path | Refund INSERT txn | Recalc txn | On recalc-raise |
|------|-------------------|------------|-----------------|
| `record_manual_refund` RPC (`supabase/migrations/20260331160000_record_manual_refund_rpc.sql:69-74`) | Same RPC body, single server-side transaction | Same (PERFORM inside the RPC) | Whole RPC rolls back. Refund row does NOT persist. Teacher sees error. **No corruption.** |
| Stripe webhook `charge.refunded` (`supabase/functions/stripe-webhook/index.ts:916-985`) | Separate Supabase client INSERT (line 916-927) | Separate `supabase.rpc(...)` call (line 979-981) | `recalcError` caught at line 983-985, `console.error`-only, function returns normally. **Refund row persists, invoice state corrupt.** |
| `stripe-process-refund` edge function (`supabase/functions/stripe-process-refund/index.ts:125-187`) | Separate INSERT (line 125-138) → Stripe API (line 160) → separate UPDATE (line 171-174) | Separate `supabase.rpc(...)` (line 185-187) | `recalcError` caught at line 189-191, `console.error`-only, response returns `success: true` with Stripe refund id. **Refund row persists, invoice state corrupt, teacher told it worked.** |

## Count query (run FIRST — cheap)

Count invoices currently in the corrupt state, across every org. Read-only.

```sql
SELECT COUNT(*) AS corrupt_invoice_count
FROM public.invoices i
WHERE i.status = 'paid'
  AND i.paid_minor >= i.total_minor
  AND EXISTS (
    SELECT 1 FROM public.refunds r
    WHERE r.invoice_id = i.id
      AND r.status = 'succeeded'
  );
```

## Breakdown by org (run SECOND — shows scope)

```sql
SELECT
  o.id AS org_id,
  o.name AS org_name,
  COUNT(*) AS corrupt_count,
  SUM(
    COALESCE((
      SELECT SUM(r.amount_minor)
      FROM public.refunds r
      WHERE r.invoice_id = i.id AND r.status = 'succeeded'
    ), 0)
  ) AS total_unaccounted_refund_minor
FROM public.invoices i
JOIN public.organisations o ON o.id = i.org_id
WHERE i.status = 'paid'
  AND i.paid_minor >= i.total_minor
  AND EXISTS (
    SELECT 1 FROM public.refunds r
    WHERE r.invoice_id = i.id AND r.status = 'succeeded'
  )
GROUP BY o.id, o.name
ORDER BY corrupt_count DESC;
```

## Detail sample (run THIRD — if count > 0, pull the top 20 for manual review)

```sql
SELECT
  i.id                AS invoice_id,
  i.invoice_number,
  i.org_id,
  i.status            AS invoice_status,
  i.total_minor,
  i.paid_minor,
  COALESCE((
    SELECT SUM(r.amount_minor)
    FROM public.refunds r
    WHERE r.invoice_id = i.id AND r.status = 'succeeded'
  ), 0)               AS total_refunded_minor,
  i.paid_minor - COALESCE((
    SELECT SUM(r.amount_minor)
    FROM public.refunds r
    WHERE r.invoice_id = i.id AND r.status = 'succeeded'
  ), 0)               AS net_paid_minor_expected,
  i.created_at,
  i.updated_at
FROM public.invoices i
WHERE i.status = 'paid'
  AND i.paid_minor >= i.total_minor
  AND EXISTS (
    SELECT 1 FROM public.refunds r
    WHERE r.invoice_id = i.id AND r.status = 'succeeded'
  )
ORDER BY i.updated_at DESC
LIMIT 20;
```

`net_paid_minor_expected` is what `paid_minor` SHOULD equal if recalc had succeeded. For every row returned, the delta `paid_minor − net_paid_minor_expected` is the amount of real refund money that isn't reflected in the invoice's own math.

## What to do with results

- **`corrupt_invoice_count = 0`:** bug is dormant on this database. The trigger/recalc conflict is real in code, but no path has exercised it yet on live data. Fix is still CRITICAL — next refund of a paid invoice will corrupt.
- **`corrupt_invoice_count > 0`:** bug is active. For each row returned by Query 3:
  - The refund actually moved money (Stripe / bank) — confirm via Stripe dashboard or bank records.
  - The invoice still shows fully paid in LessonLoop. Parent may be paying twice / accounting out of balance.
  - A separate one-off backfill migration is needed AFTER the A4 fix to reconcile: set `paid_minor = net_paid_minor_expected`, set `status` accordingly (`'sent'` or `'overdue'` depending on due_date). Write that backfill as a dedicated migration tied to whichever A4 fix approach lands (allowlist the transition, or drop the status update from recalc).

## What to send back to Claude after running

Reply in chat with:
1. `corrupt_invoice_count` from Query 1.
2. Number of orgs affected (count of rows from Query 2).
3. The maximum `total_unaccounted_refund_minor` from Query 2 (largest single-org exposure).
4. If any rows returned from Query 3, paste the first 3-5 rows so Claude can see the shape of real data.

That tells Claude the severity of live impact and whether the A4 fix should include a backfill migration.
