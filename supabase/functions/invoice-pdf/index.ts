import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unit_price_minor: number;
  amount_minor: number;
}

interface Payment {
  id: string;
  amount_minor: number;
  paid_at: string;
  method: string;
}

function formatCurrency(amountMinor: number, currencyCode: string = "GBP", locale: string = "en-GB"): string {
  const amount = amountMinor / 100;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currencyCode,
  }).format(amount);
}

function formatDate(dateStr: string, locale: string = "en-GB"): string {
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function getLocaleFromCountry(countryCode: string): string {
  const localeMap: Record<string, string> = {
    GB: "en-GB",
    US: "en-US",
    DE: "de-DE",
    FR: "fr-FR",
    ES: "es-ES",
    IT: "it-IT",
  };
  return localeMap[countryCode] || "en-GB";
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  const corsResponse = handleCorsPreflightRequest(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    // Get auth token from header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Create authenticated Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Get invoice ID from query params
    const url = new URL(req.url);
    const invoiceId = url.searchParams.get("invoiceId");
    if (!invoiceId) {
      return new Response(JSON.stringify({ error: "Missing invoiceId parameter" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Fetch invoice with all related data - RLS will enforce access control
    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select(`
        *,
        items:invoice_items(*),
        payments:payments(*),
        payer_guardian:guardians!invoices_payer_guardian_id_fkey(id, full_name, email),
        payer_student:students!invoices_payer_student_id_fkey(id, first_name, last_name, email),
        organisation:organisations(
          name,
          currency_code,
          country_code,
          vat_enabled,
          vat_rate,
          vat_registration_number,
          invoice_from_name,
          invoice_from_address_line1,
          invoice_from_address_line2,
          invoice_from_city,
          invoice_from_postcode,
          invoice_from_country,
          logo_url,
          invoice_footer_note
        )
      `)
      .eq("id", invoiceId)
      .single();

    if (invoiceError || !invoice) {
      console.error("Invoice fetch error:", invoiceError);
      return new Response(JSON.stringify({ error: "Invoice not found or access denied" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const org = invoice.organisation;
    const currency = org?.currency_code || "GBP";
    const locale = getLocaleFromCountry(org?.country_code || "GB");

    // Create PDF document
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]); // A4 size in points
    const { width, height } = page.getSize();

    // Load fonts
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Colors
    const black = rgb(0, 0, 0);
    const gray = rgb(0.4, 0.4, 0.4);
    const lightGray = rgb(0.9, 0.9, 0.9);
    const darkBlue = rgb(0.15, 0.25, 0.45);

    let y = height - 50;
    const leftMargin = 50;
    const rightMargin = width - 50;

    // Header - Organization name or invoice_from_name
    const orgDisplayName = org?.invoice_from_name || org?.name || "Invoice";
    page.drawText(orgDisplayName, {
      x: leftMargin,
      y,
      size: 24,
      font: helveticaBold,
      color: darkBlue,
    });

    // INVOICE title on right
    page.drawText("INVOICE", {
      x: rightMargin - helveticaBold.widthOfTextAtSize("INVOICE", 24),
      y,
      size: 24,
      font: helveticaBold,
      color: darkBlue,
    });

    y -= 30;

    // Organization address (from fields)
    const addressLines: string[] = [];
    if (org?.invoice_from_address_line1) addressLines.push(org.invoice_from_address_line1);
    if (org?.invoice_from_address_line2) addressLines.push(org.invoice_from_address_line2);
    if (org?.invoice_from_city || org?.invoice_from_postcode) {
      addressLines.push([org?.invoice_from_city, org?.invoice_from_postcode].filter(Boolean).join(", "));
    }
    if (org?.invoice_from_country) addressLines.push(org.invoice_from_country);

    for (const line of addressLines) {
      page.drawText(line, {
        x: leftMargin,
        y,
        size: 10,
        font: helvetica,
        color: gray,
      });
      y -= 14;
    }

    // VAT number if enabled
    if (org?.vat_enabled && org?.vat_registration_number) {
      page.drawText(`VAT Registration: ${org.vat_registration_number}`, {
        x: leftMargin,
        y,
        size: 10,
        font: helvetica,
        color: gray,
      });
      y -= 14;
    }

    y -= 20;

    // Invoice details box
    const invoiceDetailsY = height - 80;
    const detailsX = rightMargin - 180;

    page.drawText("Invoice Number:", {
      x: detailsX,
      y: invoiceDetailsY,
      size: 9,
      font: helvetica,
      color: gray,
    });
    page.drawText(invoice.invoice_number, {
      x: detailsX + 85,
      y: invoiceDetailsY,
      size: 9,
      font: helveticaBold,
      color: black,
    });

    page.drawText("Date Issued:", {
      x: detailsX,
      y: invoiceDetailsY - 14,
      size: 9,
      font: helvetica,
      color: gray,
    });
    page.drawText(formatDate(invoice.created_at, locale), {
      x: detailsX + 85,
      y: invoiceDetailsY - 14,
      size: 9,
      font: helvetica,
      color: black,
    });

    page.drawText("Due Date:", {
      x: detailsX,
      y: invoiceDetailsY - 28,
      size: 9,
      font: helvetica,
      color: gray,
    });
    page.drawText(formatDate(invoice.due_date, locale), {
      x: detailsX + 85,
      y: invoiceDetailsY - 28,
      size: 9,
      font: helveticaBold,
      color: black,
    });

    // Bill To section
    y = Math.min(y, invoiceDetailsY - 60);
    page.drawText("BILL TO", {
      x: leftMargin,
      y,
      size: 10,
      font: helveticaBold,
      color: darkBlue,
    });
    y -= 16;

    const payerName = invoice.payer_guardian
      ? invoice.payer_guardian.full_name
      : invoice.payer_student
      ? `${invoice.payer_student.first_name} ${invoice.payer_student.last_name}`
      : "Unknown";

    page.drawText(payerName, {
      x: leftMargin,
      y,
      size: 11,
      font: helveticaBold,
      color: black,
    });
    y -= 14;

    const payerEmail = invoice.payer_guardian?.email || invoice.payer_student?.email;
    if (payerEmail) {
      page.drawText(payerEmail, {
        x: leftMargin,
        y,
        size: 10,
        font: helvetica,
        color: gray,
      });
      y -= 14;
    }

    y -= 30;

    // Items table header
    const tableTop = y;
    const colDesc = leftMargin;
    const colQty = 340;
    const colRate = 400;
    const colAmount = rightMargin - 60;

    // Table header background
    page.drawRectangle({
      x: leftMargin - 5,
      y: tableTop - 5,
      width: rightMargin - leftMargin + 10,
      height: 20,
      color: lightGray,
    });

    page.drawText("Description", { x: colDesc, y: tableTop, size: 9, font: helveticaBold, color: gray });
    page.drawText("Qty", { x: colQty, y: tableTop, size: 9, font: helveticaBold, color: gray });
    page.drawText("Rate", { x: colRate, y: tableTop, size: 9, font: helveticaBold, color: gray });
    page.drawText("Amount", { x: colAmount, y: tableTop, size: 9, font: helveticaBold, color: gray });

    y = tableTop - 25;

    // Items
    const items: InvoiceItem[] = invoice.items || [];
    for (const item of items) {
      let desc = item.description || "";
      if (desc.length > 45) desc = desc.substring(0, 42) + "...";

      page.drawText(desc, { x: colDesc, y, size: 10, font: helvetica, color: black });
      page.drawText(String(item.quantity), { x: colQty, y, size: 10, font: helvetica, color: black });
      page.drawText(formatCurrency(item.unit_price_minor, currency, locale), { x: colRate, y, size: 10, font: helvetica, color: black });

      const amountText = formatCurrency(item.amount_minor, currency, locale);
      const amountWidth = helvetica.widthOfTextAtSize(amountText, 10);
      page.drawText(amountText, { x: rightMargin - amountWidth, y, size: 10, font: helvetica, color: black });

      y -= 18;
    }

    y -= 10;

    // Draw line above totals
    page.drawLine({
      start: { x: colRate - 20, y: y + 5 },
      end: { x: rightMargin, y: y + 5 },
      thickness: 0.5,
      color: gray,
    });

    // Totals section
    const totalsX = colRate - 20;

    page.drawText("Subtotal", { x: totalsX, y, size: 10, font: helvetica, color: gray });
    let subtotalText = formatCurrency(invoice.subtotal_minor, currency, locale);
    page.drawText(subtotalText, { x: rightMargin - helvetica.widthOfTextAtSize(subtotalText, 10), y, size: 10, font: helvetica, color: black });
    y -= 16;

    if (invoice.tax_minor > 0) {
      page.drawText(`VAT (${invoice.vat_rate}%)`, { x: totalsX, y, size: 10, font: helvetica, color: gray });
      const taxText = formatCurrency(invoice.tax_minor, currency, locale);
      page.drawText(taxText, { x: rightMargin - helvetica.widthOfTextAtSize(taxText, 10), y, size: 10, font: helvetica, color: black });
      y -= 16;
    }

    page.drawText("Total", { x: totalsX, y, size: 11, font: helveticaBold, color: black });
    const totalText = formatCurrency(invoice.total_minor, currency, locale);
    page.drawText(totalText, { x: rightMargin - helveticaBold.widthOfTextAtSize(totalText, 11), y, size: 11, font: helveticaBold, color: black });
    y -= 16;

    const payments: Payment[] = invoice.payments || [];
    const totalPaid = payments.reduce((sum, p) => sum + p.amount_minor, 0);

    if (totalPaid > 0) {
      page.drawText("Paid", { x: totalsX, y, size: 10, font: helvetica, color: rgb(0.13, 0.55, 0.13) });
      const paidText = `-${formatCurrency(totalPaid, currency, locale)}`;
      page.drawText(paidText, { x: rightMargin - helvetica.widthOfTextAtSize(paidText, 10), y, size: 10, font: helvetica, color: rgb(0.13, 0.55, 0.13) });
      y -= 16;

      const amountDue = invoice.total_minor - totalPaid;
      page.drawText("Amount Due", { x: totalsX, y, size: 12, font: helveticaBold, color: darkBlue });
      const dueText = formatCurrency(amountDue, currency, locale);
      page.drawText(dueText, { x: rightMargin - helveticaBold.widthOfTextAtSize(dueText, 12), y, size: 12, font: helveticaBold, color: darkBlue });
      y -= 20;
    }

    // Notes section
    if (invoice.notes) {
      y -= 20;
      page.drawText("Notes", { x: leftMargin, y, size: 10, font: helveticaBold, color: darkBlue });
      y -= 14;
      const noteLines = invoice.notes.split("\n").slice(0, 3);
      for (const line of noteLines) {
        page.drawText(line.substring(0, 80), { x: leftMargin, y, size: 9, font: helvetica, color: gray });
        y -= 12;
      }
    }

    // Footer note
    if (org?.invoice_footer_note) {
      const footerY = 50;
      page.drawLine({
        start: { x: leftMargin, y: footerY + 15 },
        end: { x: rightMargin, y: footerY + 15 },
        thickness: 0.5,
        color: lightGray,
      });
      page.drawText(org.invoice_footer_note.substring(0, 100), { x: leftMargin, y: footerY, size: 8, font: helvetica, color: gray });
    }

    // Status watermark for paid/void invoices
    if (invoice.status === "paid") {
      page.drawText("PAID", {
        x: width / 2 - 80,
        y: height / 2,
        size: 72,
        font: helveticaBold,
        color: rgb(0.13, 0.55, 0.13),
        opacity: 0.2,
        rotate: { angle: -30, type: "degrees" } as any,
      });
    } else if (invoice.status === "void") {
      page.drawText("VOID", {
        x: width / 2 - 80,
        y: height / 2,
        size: 72,
        font: helveticaBold,
        color: rgb(0.8, 0.2, 0.2),
        opacity: 0.2,
        rotate: { angle: -30, type: "degrees" } as any,
      });
    }

    // Serialize PDF
    const pdfBytes = await pdfDoc.save();

    return new Response(new Uint8Array(pdfBytes), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="invoice-${invoice.invoice_number}.pdf"`,
      },
    });
  } catch (error: any) {
    console.error("PDF generation error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
