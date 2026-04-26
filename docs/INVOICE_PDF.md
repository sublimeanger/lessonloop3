# Invoice PDF generation

Server-side rendering for invoice PDFs. Lifted from the client-only
`useInvoicePdf` flow during Journey 11 so the same renderer can power
teacher downloads, parent-portal downloads, and email attachments
(invoice + receipt) without three drifting copies of the layout.

## Why this exists

Before J11, jsPDF rendered invoices in the browser only. The
consequences:

- Email functions (`send-invoice-email`, `send-payment-receipt`) could
  not attach a PDF — they shipped HTML-only emails.
- Parent portal downloads required a logged-in browser session to
  re-render; no link could be sent in an email or messaged.
- Any background flow that needed a PDF (cron-driven receipts, support
  exports) had no path to one.

J11 ships the foundation: a shared renderer plus a service-role edge
function that produces and caches PDFs. P2 wires the invoice-email
attachment; P3 wires the receipt attachment (closed). P1 deliberately
makes no consumer changes.

## Architecture

The renderer lives in two mirrored files because Supabase Edge
Functions (Deno) and the Vite app (browser/Node) cannot share imports
across the `supabase/` ↔ `src/` boundary:

- `supabase/functions/_shared/invoice-pdf.ts` — Deno; jsPDF from
  `https://esm.sh/jspdf@4`.
- `src/lib/invoice-pdf-renderer.ts` — browser; jsPDF from the `jspdf`
  npm package (`^4.1.0` in `package.json`).

The function bodies are byte-identical except for the import line.
The contract type `InvoicePdfInput` is duplicated, not shared, for
the same reason. Sync by hand when the renderer changes.

The renderer takes a fully-resolved `InvoicePdfInput` and returns
`Uint8Array` PDF bytes. It never touches `fetch`, `Image`, `document`,
or `window`. The browser-only image loading from the original
`useInvoicePdf` (`new Image()` + `crossOrigin`) is the caller's
responsibility — pre-load the logo and pass `logoDataUrl` as a
`data:` URL.

Date handling: `parseISO` from date-fns is gone. The renderer calls
`new Date(...)` directly, and `formatDateUK` is inlined using UTC
components so server-rendered and browser-rendered output is byte-
equivalent regardless of system timezone.

## Cache and invalidation

Server-rendered PDFs are cached in the **`invoice-pdfs`** storage
bucket at:

```
{org_id}/{invoice_id}_{pdf_rev}.pdf
```

The bucket is private (10MB cap, `application/pdf` only, service-role
RLS — end users get signed URLs from the edge fn, never direct read
access).

`invoices.pdf_rev` is a counter on the invoices table that increments
whenever a column or related row that affects PDF output mutates.
Four trigger sources keep it in sync:

| Source                      | Trigger                                         |
| --------------------------- | ----------------------------------------------- |
| `invoices` (direct columns) | `BEFORE UPDATE` — bumps when status, totals, dates, payer, notes, plan flags change |
| `invoice_items`             | `AFTER INSERT/UPDATE/DELETE` — line items in the PDF table |
| `invoice_installments`      | `AFTER INSERT/UPDATE/DELETE` — payment schedule block |
| `payments`                  | `AFTER INSERT/UPDATE/DELETE` — Paid / Amount Due summary block |

Migration: `supabase/migrations/20260504100000_invoice_pdfs_storage.sql`.

## Edge function contract

`supabase/functions/generate-invoice-pdf/index.ts`. Auth: service-role
only. End-user flows must route through `send-invoice-email` /
`send-payment-receipt` (which already gate on the user JWT) and
service-call this function internally.

**Request**

```json
{
  "invoice_id": "uuid",
  "force_regenerate": false,
  "return_bytes": false
}
```

- `force_regenerate` (default `false`) — skip the cache check and
  render fresh.
- `return_bytes` (default `false`) — return inline base64 instead of
  a signed URL. Used by email attachment paths (P2/P3).

**Response (success)**

```json
{
  "success": true,
  "cached": true,
  "filename": "LL-2026-00042.pdf",
  "signed_url": "https://...",
  "pdf_base64": "<only when return_bytes=true>"
}
```

Signed URLs have a 7-day TTL.

## Caller patterns

**Email attachment (invoice + reminder — P2 wired)**

`supabase/functions/_shared/send-invoice-email-core.ts` invokes
`generate-invoice-pdf` with `return_bytes: true` via the shared
`fetchInvoicePdfAttachment` helper in `_shared/invoice-pdf-attachment.ts`
(lifted from inline in P3-C1), then threads the result through
`sendWithRetry` as Resend's `attachments` field. `sendWithRetry`'s
payload type accepts an optional `attachments?:
Array<{ filename, content }>` field; the body is a transparent
JSON.stringify so Resend sees the field natively.

**Receipt attachment (P3 wired)**

`supabase/functions/send-payment-receipt/index.ts` invokes the same
`fetchInvoicePdfAttachment` helper after the T05-F4 idempotency
pre-check passes, the `message_log` row has been inserted, and the
`RESEND_API_KEY` early-return has been cleared. See "Receipt
attachment flow" below.

**Parent portal download (deferred follow-up)**

Service-call with `return_bytes: false`, redirect the browser to the
returned `signed_url`. Not yet wired — current portal still uses
client-side `useInvoicePdf`.

## Email attachment flow

Order of operations inside `sendInvoiceEmailCore` (post-J11-P2):

1. Wrapper-supplied auth gate (caller-supplied `authorize` callback
   on the invoice row).
2. Status guard — paid / void invoices reject with 400.
3. 5-minute idempotency debounce check on `message_log`. Re-sends
   inside the window short-circuit with 409 **before** any PDF or
   Resend work, so we never waste a render on a debounced send.
4. HTML render via `buildInvoiceEmailHtml`.
5. `message_log` row insert (`status: 'pending'`).
6. `RESEND_API_KEY` guard — if missing, mark log row `'logged'` and
   return success.
7. **PDF attachment fetch** (best-effort) via the internal
   `fetchInvoicePdfAttachment` → invokes `generate-invoice-pdf` with
   `return_bytes: true`. Cache hit returns sub-100ms; cache miss
   renders + caches before returning.
8. If the PDF fetch returned `null`, write an
   `'invoice_email_pdf_fallback'` row to `platform_audit_log`
   (severity `warning`).
9. Resend send via `sendWithRetry` with `attachments` field
   (or `undefined` on fallback — never `[]`, since Resend treats an
   empty array differently from a missing field).
10. `message_log` status update (`'sent'` / `'failed'`).
11. Invoice status transition `draft` → `sent` (skipped if already
    sent or paid).

### Cache warming

`recurring-billing-scheduler` pre-warms the cache by invoking
`generate-invoice-pdf` (no `return_bytes`) immediately before each
`send-invoice-email-internal` call inside its per-draft loop. Net
latency unchanged: the cold render still happens once per invoice
either way — this just shifts it from inside the email-attach step
(which falls back to HTML on failure) to a dedicated step (which
logs + proceeds). The subsequent send hits a warm cache.

### Operator queries

PDF fallbacks last 24h:

```sql
SELECT created_at, details
FROM platform_audit_log
WHERE action = 'invoice_email_pdf_fallback'
  AND created_at > now() - interval '24 hours'
ORDER BY created_at DESC;
```

Fallback rate per org last 7d:

```sql
SELECT details->>'org_id' AS org_id, count(*) AS fallbacks
FROM platform_audit_log
WHERE action = 'invoice_email_pdf_fallback'
  AND created_at > now() - interval '7 days'
GROUP BY details->>'org_id'
ORDER BY fallbacks DESC;
```

Cross-references: idempotency debounce semantics overlap with
`docs/WEBHOOK_DEDUP.md` (different table, same shape); audit row
shape matches `docs/PLATFORM_AUDIT_LOG.md`.

## Receipt attachment flow

**Trigger.** `stripe-webhook` invokes `send-payment-receipt` after a
successful payment lands (one invocation per payment, both at the
checkout-completed and payment-intent-succeeded sites).

**Receipt content.** HTML email with the PAID acknowledgement block +
the canonical invoice PDF attached as `Invoice-{invoice_number}.pdf`
— the same filename used by the invoice email. The two PDFs may have
different bytes if `pdf_rev` has incremented since the invoice
email was sent (a payment landing always bumps `pdf_rev` via the
`payments` trigger). World-class billing means **one canonical
document**, not parallel "invoice" and "receipt" artifacts; parents
file by invoice number and the email client keeps the latest copy.

**Watermark behaviour.** The renderer paints the **PAID** watermark
automatically when `invoice.status === 'paid'` (i.e. the payment that
cleared the balance). For partial payments the invoice is still in
`'sent'` status — no watermark — but the totals block shows
`Paid: £X / Remaining: £Y` so the parent sees their running balance
on the receipt PDF.

**Cache behaviour.** Payment landing fires the `pdf_rev` triggers
(`status` and/or `paid_minor` changed), invalidating the
`{invoice_id}_{old_rev}.pdf` cache. The receipt's attachment fetch is
therefore a cache miss and renders fresh — exactly what we want, the
new bytes show the new state. Subsequent receipts (e.g. a refund
processed later, generating an updated receipt) cache miss again on
the next `pdf_rev` bump.

**Idempotency.** T05-F4's pre-check on `message_log.payment_id UNIQUE`
prevents double-receipts on Stripe webhook retry. PDF generation only
fires when the pre-check passes, so retry storms do **not** create a
cache-miss thundering herd. The 23505 race-loser path also returns
before the attachment fetch.

**Best-effort fallback.** If `generate-invoice-pdf` returns no bytes,
the receipt email still goes out HTML-only and the gap is logged to
`platform_audit_log` with `action='payment_receipt_pdf_fallback'`,
`severity='warning'`, and `details` containing `payment_id`,
`invoice_id`, `invoice_number`, `org_id`. Same shape as the P2
invoice-email fallback; only the action string differs.

**Cross-references.** See `docs/WEBHOOK_DEDUP.md` for the receipt's
role in the two-phase webhook chain (Stripe-side acknowledgement vs
local replay handling).

### Operator queries

Receipt PDF fallbacks last 24h:

```sql
SELECT created_at, details
FROM platform_audit_log
WHERE action = 'payment_receipt_pdf_fallback'
  AND created_at > now() - interval '24 hours'
ORDER BY created_at DESC;
```

Combined invoice + receipt fallback rate per org last 7d:

```sql
SELECT
  details->>'org_id' AS org_id,
  action,
  count(*) AS fallbacks
FROM platform_audit_log
WHERE action IN ('invoice_email_pdf_fallback', 'payment_receipt_pdf_fallback')
  AND created_at > now() - interval '7 days'
GROUP BY details->>'org_id', action
ORDER BY fallbacks DESC;
```

## Audit

Every server render writes:

```
audit_log: {
  org_id: <invoice.org_id>,
  actor_user_id: null,
  action: 'pdf_generated_server',
  entity_type: 'invoice',
  entity_id: <invoice_id>,
  after: { pdf_rev, cache_path, size_bytes }
}
```

The `_server` suffix distinguishes these from the `pdf_generated` rows
written by the existing teacher-side `useInvoicePdf` flow, so
operators can tell teacher downloads apart from email-driven /
cron-driven generation.

`actor_user_id` is intentionally `NULL` because this fn runs without
a user JWT.

## Operator queries

Cache size by org:

```sql
SELECT
  bucket_id,
  count(*) AS objects,
  pg_size_pretty(sum((metadata->>'size')::bigint)) AS total
FROM storage.objects
WHERE bucket_id = 'invoice-pdfs'
GROUP BY bucket_id;
```

Recent server renders:

```sql
SELECT created_at, entity_id, after
FROM audit_log
WHERE action = 'pdf_generated_server'
ORDER BY created_at DESC
LIMIT 20;
```

Force-clear cache for a single invoice (e.g. after a manual fix that
should have bumped `pdf_rev` but didn't):

```sql
UPDATE invoices SET pdf_rev = pdf_rev + 1 WHERE id = '<uuid>';
```

The next call to `generate-invoice-pdf` will miss the cache and
re-render.

## Cache hygiene

Every time `pdf_rev` increments, the next render writes a new object
at `{org_id}/{invoice_id}_{new_rev}.pdf`. The previous object at
`_{old_rev}.pdf` is never overwritten (different key), so without a
sweep it would persist forever.

`cleanup-invoice-pdf-orphans` is the daily sweep that handles this.
Schedule: `45 3 * * *` (3:45 AM UTC) — registered in
`supabase/migrations/20260504100100_invoice_pdf_orphan_cron.sql`.

What it deletes:

- Any cached object whose embedded `rev` is **below** the parent
  invoice's current `pdf_rev`.
- Every cached object for an invoice that has been deleted
  entirely (no row in `invoices` for that `invoice_id`).

What it always preserves:

- The **current-rev** object for every live invoice
  (`{org_id}/{invoice_id}_{invoices.pdf_rev}.pdf`). The next
  `generate-invoice-pdf` call still hits the cache.

The sweep self-audits each run into `platform_audit_log`
(`action='invoice_pdf_orphan_sweep'`, `severity='info'`, with
`{ objects_inspected, orphans_identified, orphans_deleted, ran_at }`
in `details`).

Operator query — recent sweeps:

```sql
SELECT created_at, severity, details
FROM platform_audit_log
WHERE action = 'invoice_pdf_orphan_sweep'
ORDER BY created_at DESC
LIMIT 10;
```

The edge function reads `storage.objects` via
`public.list_invoice_pdf_objects()` (a `SECURITY DEFINER` RPC
defined in the same migration) because PostgREST does not expose
the storage schema by default. The function also tries a direct
`supabase-js .from('storage.objects')` query first; in normal
deployments this fails fast with "schema not exposed" and the RPC
fallback runs.

## Known follow-ups

- **Parent portal download** — replace the client-side
  `useInvoicePdf` call on `/portal/invoices` with a redirect to the
  signed URL returned by `generate-invoice-pdf`. (P3 closes all
  email-attachment paths; the portal-download deferred follow-up is
  the only remaining J11 wiring gap.)
