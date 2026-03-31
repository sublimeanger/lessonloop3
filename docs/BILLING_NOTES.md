# LessonLoop Billing — Design Notes

## Cancellation Billing Policy
- Lessons cancelled by the TEACHER are excluded from billing (attendance_status = 'cancelled_by_teacher')
- Lessons cancelled by the STUDENT are still billed (configurable per org in future — currently always billed)
- This is intentional: student cancellations are typically subject to the org's cancellation policy

## Re-billing After Refund
- A refunded invoice still has its invoice_items linked to lessons
- To re-bill refunded lessons, the original invoice must be VOIDED first (void_invoice RPC)
- Voiding clears linked_lesson_id on all items, allowing the lessons to be picked up by the next billing run
- This is by design: refund ≠ void. A refund returns money; a void cancels the billing relationship.

## Invoice Sending
- Billing runs create invoices in 'draft' status
- Draft invoices must be manually sent (bulk or individually) — there is no auto-send after billing
- This allows the admin to review invoices before parents see them

## VAT Calculation
- VAT is calculated on the invoice subtotal, not per-item
- This is standard UK/EU approach for small businesses
- Per-item VAT would require additional rounding logic

## Auto-Pay
- Guardians can opt into auto-pay via guardian_payment_preferences
- Auto-pay charges the default payment method for due installments
- Runs daily via cron (stripe-auto-pay-installment)
- Card declines trigger a notification email to the guardian
- Requires setup_future_usage: "off_session" on the initial PaymentIntent
