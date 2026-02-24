import { useState } from 'react';
import { logger } from '@/lib/logger';
import { jsPDF } from 'jspdf';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useOrg } from '@/contexts/OrgContext';
import { useAuth } from '@/contexts/AuthContext';
import { formatDateUK } from '@/lib/utils';
import { parseISO } from 'date-fns';

interface InvoicePdfData {
  id: string;
  invoice_number: string;
  status: string;
  issue_date: string;
  due_date: string;
  subtotal_minor: number;
  tax_minor: number;
  vat_rate: number;
  total_minor: number;
  credit_applied_minor: number;
  paid_minor: number | null;
  payment_plan_enabled: boolean | null;
  notes: string | null;
  payer_guardian?: { full_name: string; email?: string | null } | null;
  payer_student?: { first_name: string; last_name: string; email?: string | null } | null;
  items?: Array<{
    description: string;
    quantity: number;
    unit_price_minor: number;
    amount_minor: number;
  }>;
  payments?: Array<{
    amount_minor: number;
    paid_at: string;
    method: string;
  }>;
  installments?: Array<{
    installment_number: number;
    amount_minor: number;
    due_date: string;
    status: string;
    paid_at: string | null;
  }>;
}

interface OrgPdfDetails {
  name: string | null;
  address: string | null;
  logo_url: string | null;
  brand_color: string | null;
  accent_color: string | null;
  invoice_from_name: string | null;
  invoice_from_address_line1: string | null;
  invoice_from_address_line2: string | null;
  invoice_from_city: string | null;
  invoice_from_postcode: string | null;
  invoice_from_country: string | null;
  invoice_footer_note: string | null;
  vat_enabled: boolean | null;
  vat_registration_number: string | null;
  bank_account_name: string | null;
  bank_sort_code: string | null;
  bank_account_number: string | null;
  bank_reference_prefix: string | null;
}

export function useInvoicePdf() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { currentOrg } = useOrg();
  const { user } = useAuth();

  const downloadPdf = async (invoiceId: string, invoiceNumber: string) => {
    setIsLoading(true);
    toast({ title: 'Generating PDF...', description: `Preparing ${invoiceNumber}` });
    try {
      if (!currentOrg?.id) throw new Error('No organisation selected');

      const { data: invoice, error: invErr } = await supabase
        .from('invoices')
        .select(`
          *,
          payer_guardian:guardians(id, full_name, email),
          payer_student:students(id, first_name, last_name, email)
        `)
        .eq('id', invoiceId)
        .eq('org_id', currentOrg.id)
        .single();

      if (invErr || !invoice) throw new Error('Invoice not found');

      const { data: items } = await supabase
        .from('invoice_items')
        .select('description, quantity, unit_price_minor, amount_minor')
        .eq('invoice_id', invoiceId)
        .order('created_at', { ascending: true });

      const { data: payments } = await supabase
        .from('payments')
        .select('amount_minor, paid_at, method')
        .eq('invoice_id', invoiceId)
        .order('paid_at', { ascending: false });

      let installments: InvoicePdfData['installments'] = [];
      if (invoice.payment_plan_enabled) {
        const { data: instData } = await supabase
          .from('invoice_installments')
          .select('installment_number, amount_minor, due_date, status, paid_at')
          .eq('invoice_id', invoiceId)
          .order('installment_number', { ascending: true });
        installments = instData || [];
      }

      let orgDetails: OrgPdfDetails | null = null;
      if (currentOrg?.id) {
        const { data } = await supabase
          .from('organisations')
          .select(`
            name, address, logo_url, brand_color, accent_color,
            invoice_from_name, invoice_from_address_line1, invoice_from_address_line2,
            invoice_from_city, invoice_from_postcode, invoice_from_country,
            invoice_footer_note, vat_enabled, vat_registration_number,
            bank_account_name, bank_sort_code, bank_account_number, bank_reference_prefix
          `)
          .eq('id', currentOrg.id)
          .single();
        orgDetails = data;
      }

      const currency = currentOrg?.currency_code || 'GBP';
      const fullInvoice: InvoicePdfData = {
        ...invoice,
        items: items || [],
        payments: payments || [],
        installments,
      };

      // Load logo image if available
      let logoImg: HTMLImageElement | null = null;
      if (orgDetails?.logo_url) {
        try {
          logoImg = await loadImage(orgDetails.logo_url);
        } catch {
          // Logo load failed — continue without it
        }
      }

      generatePdf(fullInvoice, orgDetails, currency, invoiceNumber, logoImg);

      if (currentOrg?.id && user?.id) {
        supabase.from('audit_log').insert({
          action: 'pdf_generated',
          entity_type: 'invoice',
          entity_id: invoiceId,
          actor_user_id: user.id,
          org_id: currentOrg.id,
        }).then(({ error: auditErr }) => {
          if (auditErr) logger.error('Audit log error:', auditErr);
        });
      }

      toast({
        title: 'Download Complete',
        description: `Invoice ${invoiceNumber} downloaded.`,
      });
    } catch (error: unknown) {
      logger.error('PDF generation error:', error);
      toast({
        title: 'Download Failed',
        description: error instanceof Error ? error.message : 'Failed to generate invoice PDF.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return { downloadPdf, isLoading };
}

// ─── Helpers ───

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image load failed'));
    img.src = url;
  });
}

function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : [0, 0, 0];
}

function luminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/** Returns white or dark text depending on background luminance */
function contrastColor(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb(hex);
  return luminance(r, g, b) > 0.4 ? [26, 26, 46] : [255, 255, 255];
}

function fmtCur(amountMinor: number, currencyCode: string): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: currencyCode,
  }).format(amountMinor / 100);
}

// ─── PDF Generation ───

function generatePdf(
  inv: InvoicePdfData,
  org: OrgPdfDetails | null,
  currency: string,
  filename: string,
  logoImg: HTMLImageElement | null
) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;

  const brandColor = org?.brand_color || '#1a1a2e';
  const accentColor = org?.accent_color || '#6366f1';
  const [brandR, brandG, brandB] = hexToRgb(brandColor);
  const [accentR, accentG, accentB] = hexToRgb(accentColor);
  const [headerTextR, headerTextG, headerTextB] = contrastColor(brandColor);

  let y = 0;

  // ━━━ WATERMARK for paid/void ━━━
  if (inv.status === 'paid' || inv.status === 'void') {
    doc.saveGraphicsState();
    doc.setTextColor(220, 220, 220);
    doc.setFontSize(60);
    doc.text(inv.status.toUpperCase(), pageWidth / 2, 160, {
      align: 'center',
      angle: 45,
    });
    doc.restoreGraphicsState();
  }

  // ━━━ BRANDED HEADER BAR ━━━
  const headerHeight = 28;
  doc.setFillColor(brandR, brandG, brandB);
  doc.rect(0, 0, pageWidth, headerHeight, 'F');

  // Logo in header
  let logoEndX = margin;
  if (logoImg) {
    try {
      const logoSize = 16;
      const logoX = margin;
      const logoY = (headerHeight - logoSize) / 2;
      // White background pill behind logo
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(logoX - 1, logoY - 1, logoSize + 2, logoSize + 2, 2, 2, 'F');
      doc.addImage(logoImg, 'PNG', logoX, logoY, logoSize, logoSize);
      logoEndX = logoX + logoSize + 4;
    } catch {
      // Logo render failed — continue without
    }
  }

  // Org name in header
  doc.setTextColor(headerTextR, headerTextG, headerTextB);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(org?.invoice_from_name || org?.name || 'Invoice', logoEndX, headerHeight / 2 + 1, {
    baseline: 'middle',
  });

  // "INVOICE" label on right
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('INVOICE', pageWidth - margin, headerHeight / 2 - 2, {
    align: 'right',
    baseline: 'middle',
  });
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(inv.invoice_number, pageWidth - margin, headerHeight / 2 + 4, {
    align: 'right',
    baseline: 'middle',
  });

  y = headerHeight + 10;

  // ━━━ ACCENT LINE under header ━━━
  doc.setFillColor(accentR, accentG, accentB);
  doc.rect(0, headerHeight, pageWidth, 1.2, 'F');

  // ━━━ ADDRESS + DATES BLOCK ━━━
  // Left: org address
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120, 120, 120);

  const addressParts = [
    org?.invoice_from_address_line1,
    org?.invoice_from_address_line2,
    org?.invoice_from_city,
    org?.invoice_from_postcode,
  ].filter(Boolean);

  if (addressParts.length) {
    doc.text(addressParts.join(', '), margin, y);
    y += 4;
  }
  if (org?.vat_registration_number) {
    doc.text(`VAT: ${org.vat_registration_number}`, margin, y);
    y += 4;
  }

  y = Math.max(y, headerHeight + 14);

  // ━━━ BILL TO + DATES ━━━
  y += 4;
  const payerName = inv.payer_guardian?.full_name
    || (inv.payer_student ? `${inv.payer_student.first_name} ${inv.payer_student.last_name}` : '');
  const payerEmail = inv.payer_guardian?.email || inv.payer_student?.email || '';

  // Bill To section
  doc.setFontSize(7);
  doc.setTextColor(accentR, accentG, accentB);
  doc.setFont('helvetica', 'bold');
  doc.text('BILL TO', margin, y);

  // Dates section
  const dateX = pageWidth / 2 + 15;
  doc.text('ISSUE DATE', dateX, y);
  doc.text('DUE DATE', dateX + 40, y);
  y += 4;

  doc.setTextColor(30, 30, 30);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(payerName, margin, y);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(formatDateUK(parseISO(inv.issue_date), 'dd/MM/yyyy'), dateX, y);
  doc.text(formatDateUK(parseISO(inv.due_date), 'dd/MM/yyyy'), dateX + 40, y);
  y += 4;

  if (payerEmail) {
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(payerEmail, margin, y);
    y += 4;
  }

  y += 8;

  // ━━━ LINE ITEMS TABLE ━━━
  const colX = {
    desc: margin,
    qty: margin + contentWidth * 0.55,
    rate: margin + contentWidth * 0.72,
    amount: pageWidth - margin,
  };

  // Table header row with accent background
  doc.setFillColor(accentR, accentG, accentB);
  doc.roundedRect(margin, y - 4, contentWidth, 8, 1.5, 1.5, 'F');
  const [thR, thG, thB] = contrastColor(accentColor);
  doc.setTextColor(thR, thG, thB);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('DESCRIPTION', colX.desc + 2, y);
  doc.text('QTY', colX.qty, y, { align: 'right' });
  doc.text('RATE', colX.rate, y, { align: 'right' });
  doc.text('AMOUNT', colX.amount - 2, y, { align: 'right' });
  y += 7;

  // Table rows
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(9);

  const descMaxWidth = contentWidth * 0.53;
  let rowEven = false;

  for (const item of inv.items || []) {
    const descLines = doc.splitTextToSize(item.description, descMaxWidth);
    const lineHeight = 4;
    const blockHeight = descLines.length * lineHeight;
    const rowH = Math.max(blockHeight, 6) + 3;

    if (y + rowH > 258) {
      doc.addPage();
      y = margin;
    }

    // Alternating row background
    if (rowEven) {
      doc.setFillColor(248, 248, 252);
      doc.rect(margin, y - 3.5, contentWidth, rowH, 'F');
    }
    rowEven = !rowEven;

    doc.setTextColor(30, 30, 30);
    doc.text(descLines, colX.desc + 2, y);
    doc.setTextColor(100, 100, 100);
    doc.text(String(item.quantity), colX.qty, y, { align: 'right' });
    doc.text(fmtCur(item.unit_price_minor, currency), colX.rate, y, { align: 'right' });
    doc.setTextColor(30, 30, 30);
    doc.setFont('helvetica', 'bold');
    doc.text(fmtCur(item.amount_minor, currency), colX.amount - 2, y, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    y += rowH;
  }

  // Divider line
  y += 3;
  doc.setDrawColor(accentR, accentG, accentB);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  // ━━━ TOTALS SECTION ━━━
  const totalsX = pageWidth - margin - 2;
  const labelX = totalsX - 52;

  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text('Subtotal', labelX, y, { align: 'right' });
  doc.setTextColor(30, 30, 30);
  doc.text(fmtCur(inv.subtotal_minor, currency), totalsX, y, { align: 'right' });
  y += 5;

  if (inv.tax_minor > 0) {
    doc.setTextColor(100, 100, 100);
    doc.text(`VAT (${inv.vat_rate}%)`, labelX, y, { align: 'right' });
    doc.setTextColor(30, 30, 30);
    doc.text(fmtCur(inv.tax_minor, currency), totalsX, y, { align: 'right' });
    y += 5;
  }

  if (inv.credit_applied_minor > 0) {
    doc.setTextColor(34, 139, 34);
    doc.text('Make-Up Credit', labelX, y, { align: 'right' });
    doc.text(`-${fmtCur(inv.credit_applied_minor, currency)}`, totalsX, y, { align: 'right' });
    y += 5;
  }

  // Total highlight bar
  y += 2;
  doc.setFillColor(accentR, accentG, accentB);
  doc.roundedRect(labelX - 8, y - 4, totalsX - labelX + 12, 10, 1.5, 1.5, 'F');
  doc.setTextColor(thR, thG, thB);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL', labelX, y + 1, { align: 'right' });
  doc.text(fmtCur(inv.total_minor, currency), totalsX, y + 1, { align: 'right' });
  y += 12;

  // Payments
  const totalPaid = (inv.payments || []).reduce((s, p) => s + p.amount_minor, 0);
  if (totalPaid > 0) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(34, 139, 34);
    doc.text('Paid', labelX, y, { align: 'right' });
    doc.text(`-${fmtCur(totalPaid, currency)}`, totalsX, y, { align: 'right' });
    y += 5;

    const amountDue = inv.total_minor - totalPaid;
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Amount Due', labelX, y, { align: 'right' });
    doc.text(fmtCur(amountDue, currency), totalsX, y, { align: 'right' });
    y += 10;
  }

  // ━━━ PAYMENT SCHEDULE (for payment plans) ━━━
  if (inv.payment_plan_enabled && inv.installments && inv.installments.length > 0) {
    if (y > 225) {
      doc.addPage();
      y = margin;
    }

    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 7;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(accentR, accentG, accentB);
    doc.text('PAYMENT SCHEDULE', margin, y);
    y += 6;

    // Schedule table header
    const schColInstallment = margin;
    const schColAmount = margin + contentWidth * 0.4;
    const schColDue = margin + contentWidth * 0.6;
    const schColStatus = pageWidth - margin;

    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(120, 120, 120);
    doc.text('INSTALLMENT', schColInstallment, y);
    doc.text('AMOUNT', schColAmount, y, { align: 'right' });
    doc.text('DUE DATE', schColDue, y);
    doc.text('STATUS', schColStatus, y, { align: 'right' });
    y += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);

    for (const inst of inv.installments) {
      if (y > 262) {
        doc.addPage();
        y = margin;
      }
      const statusLabel = inst.status === 'paid'
        ? `Paid${inst.paid_at ? ' ' + formatDateUK(parseISO(inst.paid_at), 'dd/MM/yyyy') : ''}`
        : inst.status === 'overdue'
          ? 'Overdue'
          : 'Pending';

      doc.setTextColor(30, 30, 30);
      doc.text(`Installment ${inst.installment_number}`, schColInstallment, y);
      doc.text(fmtCur(inst.amount_minor, currency), schColAmount, y, { align: 'right' });
      doc.text(formatDateUK(parseISO(inst.due_date), 'dd/MM/yyyy'), schColDue, y);

      if (inst.status === 'paid') {
        doc.setTextColor(34, 139, 34);
      } else if (inst.status === 'overdue') {
        doc.setTextColor(200, 50, 50);
      } else {
        doc.setTextColor(140, 140, 140);
      }
      doc.text(statusLabel, schColStatus, y, { align: 'right' });
      y += 5;
    }

    y += 3;
    doc.setDrawColor(220, 220, 220);
    doc.line(margin, y, pageWidth - margin, y);
    y += 5;

    const paidTotal = inv.installments
      .filter((i) => i.status === 'paid')
      .reduce((s, i) => s + i.amount_minor, 0);
    const remaining = inv.total_minor - paidTotal;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text('Total:', schColAmount - 25, y, { align: 'right' });
    doc.setTextColor(30, 30, 30);
    doc.text(fmtCur(inv.total_minor, currency), schColAmount, y, { align: 'right' });
    y += 4;
    doc.setTextColor(34, 139, 34);
    doc.text('Paid:', schColAmount - 25, y, { align: 'right' });
    doc.text(fmtCur(paidTotal, currency), schColAmount, y, { align: 'right' });
    y += 4;
    doc.setTextColor(30, 30, 30);
    doc.setFont('helvetica', 'bold');
    doc.text('Remaining:', schColAmount - 25, y, { align: 'right' });
    doc.text(fmtCur(remaining, currency), schColAmount, y, { align: 'right' });
    y += 8;
  }

  // ━━━ BANK DETAILS SECTION ━━━
  if (org?.bank_account_name && org?.bank_sort_code && org?.bank_account_number) {
    if (y > 248) {
      doc.addPage();
      y = margin;
    }
    y = Math.max(y, y);

    // Left accent border for bank details
    doc.setFillColor(accentR, accentG, accentB);
    doc.rect(margin, y, 1.2, 20, 'F');

    doc.setFillColor(248, 248, 252);
    doc.roundedRect(margin + 2, y, contentWidth - 2, 20, 1.5, 1.5, 'F');

    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(accentR, accentG, accentB);
    doc.text('PAYMENT DETAILS', margin + 5, y + 4);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    doc.setFontSize(8);
    doc.text(`Account: ${org.bank_account_name}`, margin + 5, y + 9);
    doc.text(`Sort Code: ${org.bank_sort_code}    Account: ${org.bank_account_number}`, margin + 5, y + 14);
    if (org.bank_reference_prefix) {
      doc.text(`Reference: ${org.bank_reference_prefix}-${inv.invoice_number}`, margin + 5, y + 19);
    }
    y += 26;
  }

  // ━━━ NOTES ━━━
  if (inv.notes) {
    if (y > 255) {
      doc.addPage();
      y = margin;
    }
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(120, 120, 120);
    doc.text('NOTES', margin, y);
    y += 4;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    doc.setFontSize(8);
    const lines = doc.splitTextToSize(inv.notes, contentWidth);
    doc.text(lines, margin, y);
    y += lines.length * 3.5 + 4;
  }

  // ━━━ FOOTER NOTE ━━━
  if (org?.invoice_footer_note) {
    if (y > 260) {
      doc.addPage();
      y = margin;
    }
    doc.setFontSize(7);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(140, 140, 140);
    const footerLines = doc.splitTextToSize(org.invoice_footer_note, contentWidth);
    doc.text(footerLines, margin, y);
  }

  // ━━━ BOTTOM ACCENT BAR ━━━
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    // Accent bar at bottom
    doc.setFillColor(accentR, accentG, accentB);
    doc.rect(0, pageHeight - 3, pageWidth, 3, 'F');
    // Page number
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(170, 170, 170);
    doc.text(
      `Page ${p} of ${totalPages}`,
      pageWidth / 2,
      pageHeight - 6,
      { align: 'center' }
    );
  }

  doc.save(`${filename}.pdf`);
}
