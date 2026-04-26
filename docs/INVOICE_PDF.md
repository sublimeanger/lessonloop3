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
attachment; P3 wires the receipt attachment. P1 deliberately makes no
consumer changes.

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

**Email attachment (P2/P3, not yet wired)**

Service-call with `return_bytes: true`, then attach to Resend:

```ts
const { pdf_base64, filename } = await fetchPdf({
  invoice_id, return_bytes: true,
});
await sendWithRetry(resendApiKey, {
  ...payload,
  attachments: [{ filename, content: pdf_base64 }],
});
```

**Parent portal download (P2, not yet wired)**

Service-call with `return_bytes: false`, redirect the browser to the
returned `signed_url`.

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

## Known follow-ups

- **P2** — refactor `useInvoicePdf.ts` to consume
  `src/lib/invoice-pdf-renderer.ts` (eliminate the third copy of the
  layout). Wire `send-invoice-email-core` to attach the PDF.
- **P3** — wire `send-payment-receipt` to attach the same.
- **Future** — purge the bucket of stale `{org_id}/{invoice_id}_*.pdf`
  objects whose `pdf_rev` is below the current invoice rev. Today
  superseded objects sit in the bucket forever; a cron sweep mirrored
  on `cleanup-webhook-retention` would clean them up.
