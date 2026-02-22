import { useState } from 'react';
import { logger } from '@/lib/logger';
import { jsPDF } from 'jspdf';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useOrg } from '@/contexts/OrgContext';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrencyMinor, formatDateUK } from '@/lib/utils';
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
    try {
      if (!currentOrg?.id) throw new Error('No organisation selected');

      // Fetch full invoice data (org-scoped for defence-in-depth)
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

      // Fetch installments if payment plan
      let installments: InvoicePdfData['installments'] = [];
      if (invoice.payment_plan_enabled) {
        const { data: instData } = await supabase
          .from('invoice_installments')
          .select('installment_number, amount_minor, due_date, status, paid_at')
          .eq('invoice_id', invoiceId)
          .order('installment_number', { ascending: true });
        installments = instData || [];
      }

      // Fetch org details for header
      let orgDetails: OrgPdfDetails | null = null;
      if (currentOrg?.id) {
        const { data } = await supabase
          .from('organisations')
          .select('name, address, invoice_from_name, invoice_from_address_line1, invoice_from_address_line2, invoice_from_city, invoice_from_postcode, invoice_from_country, invoice_footer_note, vat_enabled, vat_registration_number, bank_account_name, bank_sort_code, bank_account_number, bank_reference_prefix')
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

      generatePdf(fullInvoice, orgDetails, currency, invoiceNumber);

      // Audit log: PDF generated
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

function generatePdf(
  inv: InvoicePdfData,
  org: OrgPdfDetails | null,
  currency: string,
  filename: string
) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  // --- Watermark for paid/void ---
  if (inv.status === 'paid' || inv.status === 'void') {
    doc.saveGraphicsState();
    doc.setTextColor(200, 200, 200);
    doc.setFontSize(60);
    doc.text(inv.status.toUpperCase(), pageWidth / 2, 150, {
      align: 'center',
      angle: 45,
    });
    doc.restoreGraphicsState();
    doc.setTextColor(0, 0, 0);
  }

  // --- Organisation Header ---
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(org?.name || 'Invoice', margin, y);
  y += 7;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
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
  doc.setTextColor(0, 0, 0);

  // --- INVOICE title + number (right aligned) ---
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(80, 80, 80);
  doc.text('INVOICE', pageWidth - margin, margin, { align: 'right' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  doc.text(inv.invoice_number, pageWidth - margin, margin + 8, { align: 'right' });

  y = Math.max(y, margin + 20) + 8;

  // --- Bill To / Dates ---
  const payerName = inv.payer_guardian?.full_name
    || (inv.payer_student ? `${inv.payer_student.first_name} ${inv.payer_student.last_name}` : '');

  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text('BILL TO', margin, y);
  doc.text('ISSUE DATE', pageWidth / 2 + 10, y);
  y += 5;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.text(payerName, margin, y);
  doc.text(formatDateUK(parseISO(inv.issue_date), 'dd/MM/yyyy'), pageWidth / 2 + 10, y);
  y += 5;
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text('', margin, y);
  doc.text('DUE DATE', pageWidth / 2 + 10, y);
  y += 5;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.text(formatDateUK(parseISO(inv.due_date), 'dd/MM/yyyy'), pageWidth / 2 + 10, y);

  y += 12;

  // --- Line items table ---
  const colX = {
    desc: margin,
    qty: margin + contentWidth * 0.55,
    rate: margin + contentWidth * 0.7,
    amount: pageWidth - margin,
  };

  // Header row
  doc.setFillColor(245, 245, 245);
  doc.rect(margin, y - 4, contentWidth, 8, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(80, 80, 80);
  doc.text('Description', colX.desc, y);
  doc.text('Qty', colX.qty, y, { align: 'right' });
  doc.text('Rate', colX.rate, y, { align: 'right' });
  doc.text('Amount', colX.amount, y, { align: 'right' });
  y += 7;

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(9);

  const descMaxWidth = contentWidth * 0.55 - 4; // leave small gap before qty column

  for (const item of inv.items || []) {
    const descLines = doc.splitTextToSize(item.description, descMaxWidth);
    const lineHeight = 4;
    const blockHeight = descLines.length * lineHeight;

    if (y + blockHeight > 260) {
      doc.addPage();
      y = margin;
    }
    doc.text(descLines, colX.desc, y);
    doc.text(String(item.quantity), colX.qty, y, { align: 'right' });
    doc.text(fmtCur(item.unit_price_minor, currency), colX.rate, y, { align: 'right' });
    doc.text(fmtCur(item.amount_minor, currency), colX.amount, y, { align: 'right' });
    y += Math.max(blockHeight, 6) + 2;
  }

  // Line
  y += 2;
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  // --- Totals ---
  const totalsX = pageWidth - margin;
  const labelX = totalsX - 50;

  doc.setFontSize(9);
  doc.text('Subtotal', labelX, y, { align: 'right' });
  doc.text(fmtCur(inv.subtotal_minor, currency), totalsX, y, { align: 'right' });
  y += 5;

  if (inv.tax_minor > 0) {
    doc.text(`VAT (${inv.vat_rate}%)`, labelX, y, { align: 'right' });
    doc.text(fmtCur(inv.tax_minor, currency), totalsX, y, { align: 'right' });
    y += 5;
  }

  if (inv.credit_applied_minor > 0) {
    doc.setTextColor(34, 139, 34);
    doc.text('Make-Up Credit', labelX, y, { align: 'right' });
    doc.text(`-${fmtCur(inv.credit_applied_minor, currency)}`, totalsX, y, { align: 'right' });
    doc.setTextColor(0, 0, 0);
    y += 5;
  }

  doc.setDrawColor(200, 200, 200);
  doc.line(labelX - 5, y, pageWidth - margin, y);
  y += 6;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Total', labelX, y, { align: 'right' });
  doc.text(fmtCur(inv.total_minor, currency), totalsX, y, { align: 'right' });
  y += 10;

  // Payments
  const totalPaid = (inv.payments || []).reduce((s, p) => s + p.amount_minor, 0);
  if (totalPaid > 0) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(34, 139, 34);
    doc.text('Paid', labelX, y, { align: 'right' });
    doc.text(`-${fmtCur(totalPaid, currency)}`, totalsX, y, { align: 'right' });
    doc.setTextColor(0, 0, 0);
    y += 5;

    const amountDue = inv.total_minor - totalPaid;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Amount Due', labelX, y, { align: 'right' });
    doc.text(fmtCur(amountDue, currency), totalsX, y, { align: 'right' });
    y += 10;
  }

  // --- Payment Schedule (for payment plans) ---
  if (inv.payment_plan_enabled && inv.installments && inv.installments.length > 0) {
    if (y > 230) {
      doc.addPage();
      y = margin;
    }

    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 6;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('PAYMENT SCHEDULE', margin, y);
    y += 6;

    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 6;

    // Schedule table header
    const schColInstallment = margin;
    const schColAmount = margin + contentWidth * 0.4;
    const schColDue = margin + contentWidth * 0.6;
    const schColStatus = pageWidth - margin;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(80, 80, 80);
    doc.text('Installment', schColInstallment, y);
    doc.text('Amount', schColAmount, y, { align: 'right' });
    doc.text('Due Date', schColDue, y);
    doc.text('Status', schColStatus, y, { align: 'right' });
    y += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);

    for (const inst of inv.installments) {
      if (y > 265) {
        doc.addPage();
        y = margin;
      }
      const statusLabel = inst.status === 'paid'
        ? `Paid${inst.paid_at ? ' ' + formatDateUK(parseISO(inst.paid_at), 'dd/MM/yyyy') : ''}`
        : inst.status === 'overdue'
          ? 'Overdue'
          : 'Pending';

      doc.text(`Installment ${inst.installment_number}`, schColInstallment, y);
      doc.text(fmtCur(inst.amount_minor, currency), schColAmount, y, { align: 'right' });
      doc.text(formatDateUK(parseISO(inst.due_date), 'dd/MM/yyyy'), schColDue, y);

      if (inst.status === 'paid') {
        doc.setTextColor(34, 139, 34);
      } else if (inst.status === 'overdue') {
        doc.setTextColor(200, 50, 50);
      } else {
        doc.setTextColor(120, 120, 120);
      }
      doc.text(statusLabel, schColStatus, y, { align: 'right' });
      doc.setTextColor(0, 0, 0);
      y += 5;
    }

    // Schedule summary
    y += 2;
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 5;

    const paidTotal = inv.installments
      .filter((i) => i.status === 'paid')
      .reduce((s, i) => s + i.amount_minor, 0);
    const remaining = inv.total_minor - paidTotal;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Total:', schColAmount - 30, y, { align: 'right' });
    doc.text(fmtCur(inv.total_minor, currency), schColAmount, y, { align: 'right' });
    y += 5;
    doc.setTextColor(34, 139, 34);
    doc.text('Paid to date:', schColAmount - 30, y, { align: 'right' });
    doc.text(fmtCur(paidTotal, currency), schColAmount, y, { align: 'right' });
    doc.setTextColor(0, 0, 0);
    y += 5;
    doc.setFont('helvetica', 'bold');
    doc.text('Remaining:', schColAmount - 30, y, { align: 'right' });
    doc.text(fmtCur(remaining, currency), schColAmount, y, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    y += 10;
  }

  // --- Bank details footer ---
  if (org?.bank_account_name && org?.bank_sort_code && org?.bank_account_number) {
    y = Math.max(y, 230);
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 6;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('Payment Details', margin, y);
    y += 4;
    doc.setFont('helvetica', 'normal');
    doc.text(`Account Name: ${org.bank_account_name}`, margin, y);
    y += 4;
    doc.text(`Sort Code: ${org.bank_sort_code}    Account Number: ${org.bank_account_number}`, margin, y);
    y += 4;
    if (org.bank_reference_prefix) {
      doc.text(`Reference: ${org.bank_reference_prefix}-${inv.invoice_number}`, margin, y);
    }
  }

  // --- Notes ---
  if (inv.notes) {
    y += 8;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('Notes', margin, y);
    y += 4;
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(inv.notes, contentWidth);
    doc.text(lines, margin, y);
  }

  doc.save(`${filename}.pdf`);
}

function fmtCur(amountMinor: number, currencyCode: string): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: currencyCode,
  }).format(amountMinor / 100);
}
