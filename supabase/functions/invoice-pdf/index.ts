// Invoice PDF generator
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

Deno.serve(async (req: Request): Promise<Response> => {
  const corsResponse = handleCorsPreflightRequest(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req);
  const url = new URL(req.url);

  // Health check endpoint
  if (url.searchParams.get("health") === "true") {
    return new Response(JSON.stringify({ status: "ok" }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  try {
    // Dynamic import of pdf-lib to avoid potential deployment issues
    const { PDFDocument, rgb, StandardFonts } = await import("https://esm.sh/pdf-lib@1.17.1");
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.45.0");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Authenticate
    const authHeader = req.headers.get("Authorization");
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader || "" } },
    });
    const { data: { user } } = await supabaseAuth.auth.getUser();

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get invoice ID from query or body
    let invoiceId = url.searchParams.get("invoiceId");
    if (!invoiceId && req.method === "POST") {
      const body = await req.json();
      invoiceId = body.invoiceId;
    }

    if (!invoiceId) {
      // Fallback: generate a test PDF
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([595, 842]);
      const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
      page.drawText("Test Invoice", { x: 50, y: 750, size: 24, font: helvetica, color: rgb(0, 0, 0) });
      const pdfBytes = await pdfDoc.save();
      return new Response(new Uint8Array(pdfBytes), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="test.pdf"` },
      });
    }

    // Fetch invoice with items
    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select(`
        *,
        invoice_items (*),
        organisations (name, address, vat_number, currency_code, bank_account_name, bank_sort_code, bank_account_number, bank_reference_prefix),
        payer_guardian:payer_guardian_id (full_name),
        payer_student:payer_student_id (first_name, last_name)
      `)
      .eq("id", invoiceId)
      .single();

    if (invoiceError || !invoice) {
      return new Response(JSON.stringify({ error: "Invoice not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const org = invoice.organisations as any;
    const currency = org?.currency_code || "GBP";
    const formatAmount = (minor: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(minor / 100);

    const payerName = invoice.payer_guardian
      ? (invoice.payer_guardian as any).full_name
      : invoice.payer_student
      ? `${(invoice.payer_student as any).first_name} ${(invoice.payer_student as any).last_name}`
      : "Customer";

    // Create PDF
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]);
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    let y = 790;
    const leftMargin = 50;
    const rightMargin = 545;

    // Header - Org name
    page.drawText(org?.name || "Invoice", { x: leftMargin, y, size: 20, font: helveticaBold, color: rgb(0.1, 0.1, 0.1) });
    y -= 20;
    if (org?.address) {
      page.drawText(org.address, { x: leftMargin, y, size: 9, font: helvetica, color: rgb(0.4, 0.4, 0.4) });
      y -= 14;
    }
    if (org?.vat_number) {
      page.drawText(`VAT: ${org.vat_number}`, { x: leftMargin, y, size: 9, font: helvetica, color: rgb(0.4, 0.4, 0.4) });
      y -= 14;
    }

    // Invoice title and status
    y -= 10;
    page.drawText("INVOICE", { x: leftMargin, y, size: 14, font: helveticaBold, color: rgb(0.15, 0.39, 0.92) });

    if (invoice.status === "paid") {
      page.drawText("PAID", { x: 380, y: y - 2, size: 28, font: helveticaBold, color: rgb(0.13, 0.72, 0.42) });
    }

    y -= 25;

    // Invoice details
    const details = [
      { label: "Invoice Number", value: invoice.invoice_number },
      { label: "Issue Date", value: new Date(invoice.issue_date).toLocaleDateString("en-GB") },
      { label: "Due Date", value: new Date(invoice.due_date).toLocaleDateString("en-GB") },
    ];

    details.forEach(({ label, value }) => {
      page.drawText(label, { x: leftMargin, y, size: 9, font: helveticaBold, color: rgb(0.4, 0.4, 0.4) });
      page.drawText(value, { x: leftMargin + 100, y, size: 9, font: helvetica, color: rgb(0.1, 0.1, 0.1) });
      y -= 16;
    });

    // Bill To
    page.drawText("Bill To", { x: 350, y: y + 48, size: 9, font: helveticaBold, color: rgb(0.4, 0.4, 0.4) });
    page.drawText(payerName, { x: 350 + 60, y: y + 48, size: 9, font: helvetica, color: rgb(0.1, 0.1, 0.1) });

    y -= 15;

    // Table header
    page.drawRectangle({ x: leftMargin, y: y - 2, width: rightMargin - leftMargin, height: 20, color: rgb(0.95, 0.95, 0.97) });
    page.drawText("Description", { x: leftMargin + 8, y: y + 3, size: 9, font: helveticaBold, color: rgb(0.3, 0.3, 0.3) });
    page.drawText("Qty", { x: 370, y: y + 3, size: 9, font: helveticaBold, color: rgb(0.3, 0.3, 0.3) });
    page.drawText("Rate", { x: 420, y: y + 3, size: 9, font: helveticaBold, color: rgb(0.3, 0.3, 0.3) });
    page.drawText("Amount", { x: 490, y: y + 3, size: 9, font: helveticaBold, color: rgb(0.3, 0.3, 0.3) });
    y -= 22;

    // Line items
    const items = invoice.invoice_items || [];
    items.forEach((item: any) => {
      const desc = item.description?.substring(0, 50) || "Item";
      page.drawText(desc, { x: leftMargin + 8, y, size: 9, font: helvetica, color: rgb(0.1, 0.1, 0.1) });
      page.drawText(String(item.quantity || 1), { x: 375, y, size: 9, font: helvetica, color: rgb(0.1, 0.1, 0.1) });
      page.drawText(formatAmount(item.unit_price_minor), { x: 415, y, size: 9, font: helvetica, color: rgb(0.1, 0.1, 0.1) });
      page.drawText(formatAmount(item.amount_minor), { x: 488, y, size: 9, font: helvetica, color: rgb(0.1, 0.1, 0.1) });
      y -= 18;
    });

    // Totals
    y -= 10;
    page.drawLine({ start: { x: 380, y: y + 8 }, end: { x: rightMargin, y: y + 8 }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) });

    page.drawText("Subtotal", { x: 390, y, size: 9, font: helvetica, color: rgb(0.4, 0.4, 0.4) });
    page.drawText(formatAmount(invoice.subtotal_minor), { x: 488, y, size: 9, font: helvetica, color: rgb(0.1, 0.1, 0.1) });
    y -= 16;

    if (invoice.tax_minor > 0) {
      page.drawText(`VAT (${invoice.vat_rate}%)`, { x: 390, y, size: 9, font: helvetica, color: rgb(0.4, 0.4, 0.4) });
      page.drawText(formatAmount(invoice.tax_minor), { x: 488, y, size: 9, font: helvetica, color: rgb(0.1, 0.1, 0.1) });
      y -= 16;
    }

    if (invoice.credit_applied_minor > 0) {
      page.drawText("Make-Up Credit", { x: 390, y, size: 9, font: helvetica, color: rgb(0.13, 0.72, 0.42) });
      page.drawText(`-${formatAmount(invoice.credit_applied_minor)}`, { x: 488, y, size: 9, font: helvetica, color: rgb(0.13, 0.72, 0.42) });
      y -= 16;
    }

    page.drawLine({ start: { x: 380, y: y + 8 }, end: { x: rightMargin, y: y + 8 }, thickness: 1, color: rgb(0.15, 0.39, 0.92) });
    page.drawText("Total", { x: 390, y, size: 11, font: helveticaBold, color: rgb(0.1, 0.1, 0.1) });
    page.drawText(formatAmount(invoice.total_minor), { x: 485, y, size: 11, font: helveticaBold, color: rgb(0.1, 0.1, 0.1) });
    y -= 24;

    // Notes
    if (invoice.notes) {
      page.drawText("Notes", { x: leftMargin, y, size: 9, font: helveticaBold, color: rgb(0.4, 0.4, 0.4) });
      y -= 14;
      page.drawText(invoice.notes.substring(0, 120), { x: leftMargin, y, size: 9, font: helvetica, color: rgb(0.3, 0.3, 0.3) });
      y -= 20;
    }

    // Bank Details Footer
    const bankName = org?.bank_account_name;
    const bankSortCode = org?.bank_sort_code;
    const bankAccountNumber = org?.bank_account_number;
    const bankRefPrefix = org?.bank_reference_prefix;

    if (bankName && bankSortCode && bankAccountNumber) {
      y -= 10;
      page.drawLine({ start: { x: leftMargin, y: y + 8 }, end: { x: rightMargin, y: y + 8 }, thickness: 0.5, color: rgb(0.85, 0.85, 0.85) });
      y -= 6;

      page.drawRectangle({ x: leftMargin, y: y - 60, width: rightMargin - leftMargin, height: 70, color: rgb(0.94, 0.97, 1) });

      page.drawText("Payment Details", { x: leftMargin + 12, y: y - 2, size: 10, font: helveticaBold, color: rgb(0.05, 0.29, 0.43) });
      y -= 18;
      page.drawText(`Account Name: ${bankName}`, { x: leftMargin + 12, y, size: 9, font: helvetica, color: rgb(0.15, 0.15, 0.15) });
      y -= 14;
      page.drawText(`Sort Code: ${bankSortCode}`, { x: leftMargin + 12, y, size: 9, font: helvetica, color: rgb(0.15, 0.15, 0.15) });
      page.drawText(`Account Number: ${bankAccountNumber}`, { x: 250, y, size: 9, font: helvetica, color: rgb(0.15, 0.15, 0.15) });
      y -= 14;
      const reference = bankRefPrefix ? `${bankRefPrefix}-${invoice.invoice_number}` : invoice.invoice_number;
      page.drawText(`Reference: ${reference}`, { x: leftMargin + 12, y, size: 9, font: helveticaBold, color: rgb(0.15, 0.15, 0.15) });
    }

    const pdfBytes = await pdfDoc.save();

    return new Response(new Uint8Array(pdfBytes), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${invoice.invoice_number}.pdf"`,
      },
    });
  } catch (error: any) {
    console.error("PDF error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...getCorsHeaders(req) },
    });
  }
});
