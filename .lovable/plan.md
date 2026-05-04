# J3-F19d spot-check — fixture creation + browser walk

## Status of code review

Fix is already on main and deployed:
- `RecordPaymentModal.tsx:80` uses `invoice?.paid_minor ?? 0`
- `InvoiceDetail.tsx:191` uses `invoice.paid_minor ?? 0`

The earlier conversation summary that said "fix not present" was incorrect. No code changes are required.

## Blocker

DB has **zero** invoices with a succeeded refund. The spot-check preconditions cannot be satisfied without first creating a fixture. This requires browser interaction (a mutation), which is unavailable in plan mode.

## Plan once approved

1. **Pick fixture invoice.** Query for a paid, non-plan invoice in `E2E Test Academy` (org `25b57950-6c4e-42d8-8089-4942d2bba959`) with `total_minor >= 5000` and at least one payment row. Record its id and current `paid_minor`.

2. **Create the refund via browser.**
   - Log in as the E2E Test Academy owner (existing test account).
   - Navigate to that invoice's detail page.
   - Trigger the refund flow against the existing payment for ~15% of the total (e.g. £30 on a £200 invoice). Use status 'succeeded' / non-Stripe path to avoid touching live Stripe.
   - Wait for `paid_minor` to update via `recalculate_invoice_paid` (re-query DB to confirm `paid_minor = total_minor - refund_amount`).

3. **CHECK A — RecordPaymentModal pre-fill.**
   - Reload invoice detail. Click "Record Payment".
   - Read the Amount field's pre-fill *and* the "Pay full amount (£X)" link label.
   - Compare to `(total_minor - paid_minor) / 100`. Expect non-zero, equal to refund amount.
   - Close without submitting.

4. **CHECK B — InvoiceDetail header.**
   - Read the "Amount Due" / outstanding header on the parent route.
   - Compare to same expected value.

5. **CHECK C — clean paid invoice regression.**
   - Pick any other invoice with `status='paid'` and zero refunds.
   - Open detail page: header should show £0 outstanding.
   - Open Record Payment modal: amount empty, "Pay full amount (£0.00)" link present, submit disabled.

6. **Report back** with: invoice ids used, observed values, pass/fail per check, any unexpected behaviour. If all pass, Batch 2F-followup can be flipped to "confirmed complete".

## Cleanup

The created refund will persist on the test invoice. Acceptable for E2E Test Academy; note the invoice id in the report so it can be reversed later if desired.

## Out of scope

- No code changes (fix already shipped).
- No migrations.
- No edge-function deploys.
- No production-org mutations — only `E2E Test Academy`.
