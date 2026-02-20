// Invoice PDF generator — zero external dependencies, zero imports
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

function pdfStr(t: string): string {
  return t.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}
function fc(r: number, g: number, b: number): string { return `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg`; }
function rect(x: number, y: number, w: number, h: number, r: number, g: number, b: number): string { return `${fc(r,g,b)}\n${x} ${y} ${w} ${h} re f`; }
function ln(x1: number, y1: number, x2: number, y2: number, r: number, g: number, b: number, w=0.5): string { return `${w} w\n${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} RG\n${x1} ${y1} m ${x2} ${y2} l S`; }
function tx(x: number, y: number, f: string, s: number, c: string, r=0, g=0, b=0): string { return `BT\n${fc(r,g,b)}\n/${f} ${s} Tf\n${x} ${y} Td\n(${pdfStr(c)}) Tj\nET`; }

function buildPdf(cs: string): Uint8Array {
  const o: string[] = [];
  o.push("<< /Type /Catalog /Pages 2 0 R >>");
  o.push("<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  o.push("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 6 0 R /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> >>");
  o.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  o.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  const enc = new TextEncoder();
  const sb = enc.encode(cs);
  o.push(`<< /Length ${sb.length} >>\nstream\n${cs}\nendstream`);
  const hdr = "%PDF-1.4\n";
  let b = hdr;
  const offs: number[] = [];
  for (let i = 0; i < o.length; i++) {
    offs.push(b.length);
    b += `${i + 1} 0 obj\n${o[i]}\nendobj\n`;
  }
  const xo = b.length;
  const cnt = o.length + 1;
  let x = `xref\n0 ${cnt}\n0000000000 65535 f \n`;
  for (const off of offs) x += `${String(off).padStart(10, "0")} 00000 n \n`;
  x += `trailer\n<< /Size ${cnt} /Root 1 0 R >>\nstartxref\n${xo}\n%%EOF\n`;
  b += x;
  return enc.encode(b);
}

function fmtAmt(minor: number, cur: string): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: cur }).format(minor / 100);
}

function buildInvoiceContent(inv: any, org: any, items: any[], payer: string): string {
  const cur = org?.currency_code || "GBP";
  const fmt = (m: number) => fmtAmt(m, cur);
  const c: string[] = [];
  let y = 790;
  const L = 50;
  const R = 545;

  c.push(tx(L, y, "F2", 20, org?.name || "Invoice", 0.1, 0.1, 0.1));
  y -= 20;
  if (org?.address) { c.push(tx(L, y, "F1", 9, org.address, 0.4, 0.4, 0.4)); y -= 14; }
  if (org?.vat_number) { c.push(tx(L, y, "F1", 9, "VAT: " + org.vat_number, 0.4, 0.4, 0.4)); y -= 14; }
  y -= 10;
  c.push(tx(L, y, "F2", 14, "INVOICE", 0.15, 0.39, 0.92));
  if (inv.status === "paid") c.push(tx(380, y - 2, "F2", 28, "PAID", 0.13, 0.72, 0.42));
  y -= 25;

  const ds: [string, string][] = [
    ["Invoice Number", inv.invoice_number],
    ["Issue Date", new Date(inv.issue_date).toLocaleDateString("en-GB")],
    ["Due Date", new Date(inv.due_date).toLocaleDateString("en-GB")],
  ];
  for (const [l, v] of ds) {
    c.push(tx(L, y, "F2", 9, l, 0.4, 0.4, 0.4));
    c.push(tx(L + 100, y, "F1", 9, v, 0.1, 0.1, 0.1));
    y -= 16;
  }
  c.push(tx(350, y + 48, "F2", 9, "Bill To", 0.4, 0.4, 0.4));
  c.push(tx(410, y + 48, "F1", 9, payer, 0.1, 0.1, 0.1));
  y -= 15;

  c.push(rect(L, y - 2, R - L, 20, 0.95, 0.95, 0.97));
  c.push(tx(L + 8, y + 3, "F2", 9, "Description", 0.3, 0.3, 0.3));
  c.push(tx(370, y + 3, "F2", 9, "Qty", 0.3, 0.3, 0.3));
  c.push(tx(420, y + 3, "F2", 9, "Rate", 0.3, 0.3, 0.3));
  c.push(tx(490, y + 3, "F2", 9, "Amount", 0.3, 0.3, 0.3));
  y -= 22;

  for (const it of items) {
    c.push(tx(L + 8, y, "F1", 9, (it.description || "Item").substring(0, 50), 0.1, 0.1, 0.1));
    c.push(tx(375, y, "F1", 9, String(it.quantity || 1), 0.1, 0.1, 0.1));
    c.push(tx(415, y, "F1", 9, fmt(it.unit_price_minor), 0.1, 0.1, 0.1));
    c.push(tx(488, y, "F1", 9, fmt(it.amount_minor), 0.1, 0.1, 0.1));
    y -= 18;
  }

  y -= 10;
  c.push(ln(380, y + 8, R, y + 8, 0.8, 0.8, 0.8, 0.5));
  c.push(tx(390, y, "F1", 9, "Subtotal", 0.4, 0.4, 0.4));
  c.push(tx(488, y, "F1", 9, fmt(inv.subtotal_minor), 0.1, 0.1, 0.1));
  y -= 16;
  if (inv.tax_minor > 0) {
    c.push(tx(390, y, "F1", 9, "VAT (" + inv.vat_rate + "%)", 0.4, 0.4, 0.4));
    c.push(tx(488, y, "F1", 9, fmt(inv.tax_minor), 0.1, 0.1, 0.1));
    y -= 16;
  }
  if (inv.credit_applied_minor > 0) {
    c.push(tx(390, y, "F1", 9, "Make-Up Credit", 0.13, 0.72, 0.42));
    c.push(tx(488, y, "F1", 9, "-" + fmt(inv.credit_applied_minor), 0.13, 0.72, 0.42));
    y -= 16;
  }
  c.push(ln(380, y + 8, R, y + 8, 0.15, 0.39, 0.92, 1));
  c.push(tx(390, y, "F2", 11, "Total", 0.1, 0.1, 0.1));
  c.push(tx(485, y, "F2", 11, fmt(inv.total_minor), 0.1, 0.1, 0.1));
  y -= 24;

  if (inv.notes) {
    c.push(tx(L, y, "F2", 9, "Notes", 0.4, 0.4, 0.4));
    y -= 14;
    c.push(tx(L, y, "F1", 9, inv.notes.substring(0, 120), 0.3, 0.3, 0.3));
    y -= 20;
  }

  const bn = org?.bank_account_name;
  const bs = org?.bank_sort_code;
  const ba = org?.bank_account_number;
  const bp = org?.bank_reference_prefix;
  if (bn && bs && ba) {
    y -= 10;
    c.push(ln(L, y + 8, R, y + 8, 0.85, 0.85, 0.85, 0.5));
    y -= 6;
    c.push(rect(L, y - 60, R - L, 70, 0.94, 0.97, 1));
    c.push(tx(L + 12, y - 2, "F2", 10, "Payment Details", 0.05, 0.29, 0.43));
    y -= 18;
    c.push(tx(L + 12, y, "F1", 9, "Account Name: " + bn, 0.15, 0.15, 0.15));
    y -= 14;
    c.push(tx(L + 12, y, "F1", 9, "Sort Code: " + bs, 0.15, 0.15, 0.15));
    c.push(tx(250, y, "F1", 9, "Account Number: " + ba, 0.15, 0.15, 0.15));
    y -= 14;
    const ref = bp ? bp + "-" + inv.invoice_number : inv.invoice_number;
    c.push(tx(L + 12, y, "F2", 9, "Reference: " + ref, 0.15, 0.15, 0.15));
  }

  return c.join("\n");
}

Deno.serve(async (req: Request): Promise<Response> => {
  const corsResponse = handleCorsPreflightRequest(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req);
  const url = new URL(req.url);

  if (url.searchParams.get("health") === "true") {
    return new Response(
      JSON.stringify({ status: "ok", engine: "raw-pdf-1.4" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  try {
    const sbUrl = Deno.env.get("SUPABASE_URL")!;
    const sbKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    let invoiceId = url.searchParams.get("invoiceId");
    if (!invoiceId && req.method === "POST") {
      const body = await req.json();
      invoiceId = body.invoiceId;
    }

    if (!invoiceId) {
      const testContent = [
        tx(50, 750, "F2", 24, "Test Invoice PDF", 0, 0, 0),
        tx(50, 720, "F1", 12, "Zero-dependency PDF generation working.", 0.3, 0.3, 0.3),
        tx(50, 700, "F1", 10, "Generated: " + new Date().toISOString(), 0.5, 0.5, 0.5),
      ].join("\n");
      const p = buildPdf(testContent);
      return new Response(p, {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/pdf", "Content-Disposition": 'attachment; filename="test.pdf"' },
      });
    }

    const q = `*,invoice_items(*),organisations(name,address,vat_number,currency_code,bank_account_name,bank_sort_code,bank_account_number,bank_reference_prefix),payer_guardian:payer_guardian_id(full_name),payer_student:payer_student_id(first_name,last_name)`;
    const res = await fetch(
      `${sbUrl}/rest/v1/invoices?id=eq.${invoiceId}&select=${encodeURIComponent(q)}`,
      {
        headers: {
          apikey: sbKey,
          Authorization: `Bearer ${sbKey}`,
          Accept: "application/json",
        },
      }
    );
    const data = await res.json();

    if (!data || !data.length) {
      return new Response(JSON.stringify({ error: "Invoice not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const inv = data[0];
    const org = inv.organisations;
    const payer = inv.payer_guardian
      ? inv.payer_guardian.full_name
      : inv.payer_student
        ? inv.payer_student.first_name + " " + inv.payer_student.last_name
        : "Customer";
    const items = inv.invoice_items || [];

    const pdf = buildPdf(buildInvoiceContent(inv, org, items, payer));
    return new Response(pdf, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${inv.invoice_number}.pdf"`,
      },
    });
  } catch (e: any) {
    console.error("PDF error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
