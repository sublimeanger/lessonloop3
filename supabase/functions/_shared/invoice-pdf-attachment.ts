// Shared helper: fetch an invoice PDF as a Resend-ready attachment.
// Used by send-invoice-email-core (J11-P2) and send-payment-receipt
// (J11-P3). Both paths attach the latest canonical invoice PDF — for
// receipts, the PAID watermark is rendered automatically when the
// invoice has reached paid status.
//
// Cache behaviour: first call for a given (invoice_id, pdf_rev) pair
// populates the cache; subsequent calls within the same rev hit the
// cache and are sub-100ms. The pdf_rev triggers in
// 20260504100000_invoice_pdfs_storage.sql ensure cache invalidation
// on every PDF-affecting mutation.

export async function fetchInvoicePdfAttachment(
  supabaseUrl: string,
  serviceKey: string,
  invoiceId: string,
  invoiceNumber: string,
): Promise<{ filename: string; content: string } | null> {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/generate-invoice-pdf`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ invoice_id: invoiceId, return_bytes: true }),
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => "<unreadable>");
      console.warn(
        `[invoice-pdf-attachment] generate-invoice-pdf returned ${response.status}: ${errBody}`,
      );
      return null;
    }

    const data = await response.json();
    if (!data.success || !data.pdf_base64) {
      console.warn(`[invoice-pdf-attachment] generate-invoice-pdf returned no bytes:`, data);
      return null;
    }

    return {
      filename: `Invoice-${invoiceNumber}.pdf`,
      content: data.pdf_base64,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.warn(`[invoice-pdf-attachment] fetch failed: ${message}`);
    return null;
  }
}
