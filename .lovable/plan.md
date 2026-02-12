

# Fix Invoice PDF Generation -- World-Class Reliability

## Problem
The `invoice-pdf` edge function returns a persistent 404 because `pdf-lib` (via any import method -- static, dynamic, esm.sh, npm:) crashes the Deno edge runtime during boot. This is a known incompatibility. No amount of import tweaking will fix it.

## Solution: Build PDFs from Raw PDF Specification

Replace `pdf-lib` with a zero-dependency, hand-crafted PDF generator using the raw PDF 1.4 specification. PDF is a text-based format at its core -- objects, streams, and cross-reference tables. We can construct professional invoices entirely from string concatenation with no external library.

This approach:
- Has zero external dependencies (nothing to crash)
- Is fully compatible with every Deno/edge runtime
- Produces valid, standards-compliant PDF 1.4 files
- Supports text, fonts (Helvetica/Helvetica-Bold built into every PDF reader), colours, and rectangles

## What the PDF Will Include

- Organisation name, address, VAT number (header)
- "INVOICE" title with invoice number, dates, bill-to
- Line items table (description, qty, rate, amount)
- Subtotal, VAT, make-up credit, total
- "PAID" watermark when applicable
- Bank transfer details footer (Account Name, Sort Code, Account Number, Reference)
- Notes section

## Technical Approach

### Raw PDF Structure
A PDF file is built from numbered objects:

```text
%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 5 0 R /Resources << /Font << /F1 4 0 R >> >> >> endobj
4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
5 0 obj << /Length {n} >> stream ... endstream endobj
xref
0 6
trailer << /Size 6 /Root 1 0 R >>
startxref {offset}
%%EOF
```

The content stream uses PDF operators: `BT` (begin text), `Tf` (set font), `Td` (move cursor), `Tj` (show text), `ET` (end text), `re` (rectangle), `rg`/`RG` (colour).

### Helper Functions
Build small utility functions:
- `pdfString(text)` -- escape parentheses and backslashes
- `addObject(content)` -- track object offsets for the xref table
- `buildContentStream(invoice, org)` -- generate all drawing commands
- `buildPdf(objects)` -- assemble the final file with correct byte offsets

### Files Changed

| File | Change |
|------|--------|
| `supabase/functions/invoice-pdf/index.ts` | Complete rewrite: remove pdf-lib, use raw PDF construction |

No other files change. The function signature, URL, and response format remain identical.

### Verification Plan
1. Deploy the function
2. Call `/invoice-pdf?health=true` to confirm it boots
3. Call `/invoice-pdf` (no invoiceId) to get a test PDF
4. Call `/invoice-pdf?invoiceId={real-id}` with auth to generate a real invoice PDF

### Why This Is World-Class
- Zero runtime dependencies = zero deployment failures
- Every PDF reader (Chrome, Safari, Adobe, Preview) supports PDF 1.4
- Bank details footer ensures parents always have payment info
- Professional layout matching the current design spec
- Instant deployment with no esm.sh/npm resolution delays

