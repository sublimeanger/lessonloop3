import { useState } from 'react';
import { jsPDF } from 'jspdf';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useOrg } from '@/contexts/OrgContext';
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
}

export function useInvoicePdf() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { currentOrg } = useOrg();

  const downloadPdf = async (invoiceId: string, invoiceNumber: string) => {
    setIsLoading(true);
    try {
      // Fetch full invoice data
      const { data: invoice, error: invErr } = await supabase
        .from('invoices')
        .select(`
          *,
          payer_guardian:guardians(id, full_name, email),
          payer_student:students(id, first_name, last_name, email)
        `)
        .eq('id', invoiceId)
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

      // Fetch org details for header
      let orgDetails: any = null;
      if (currentOrg?.id) {
        const { data } = await supabase
          .from('organisations')
          .select('name, address_line_1, address_line_2, city, postcode, vat_number, bank_account_name, bank_sort_code, bank_account_number, bank_reference_prefix')
          .eq('id', currentOrg.id)
          .single();
        orgDetails = data;
      }

      const currency = currentOrg?.currency_code || 'GBP';
      const fullInvoice: InvoicePdfData = {
        ...invoice,
        items: items || [],
        payments: payments || [],
      };

      generatePdf(fullInvoice, orgDetails, currency, invoiceNumber);

      toast({
        title: 'Download Complete',
        description: `Invoice ${invoiceNumber} downloaded.`,
      });
    } catch (error: any) {
      console.error('PDF generation error:', error);
      toast({
        title: 'Download Failed',
        description: error.message || 'Failed to generate invoice PDF.',
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
  org: any,
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
    org?.address_line_1,
    org?.address_line_2,
    org?.city,
    org?.postcode,
  ].filter(Boolean);
  if (addressParts.length) {
    doc.text(addressParts.join(', '), margin, y);
    y += 4;
  }
  if (org?.vat_number) {
    doc.text(`VAT: ${org.vat_number}`, margin, y);
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

  for (const item of inv.items || []) {
    if (y > 260) {
      doc.addPage();
      y = margin;
    }
    doc.text(item.description.substring(0, 60), colX.desc, y);
    doc.text(String(item.quantity), colX.qty, y, { align: 'right' });
    doc.text(fmtCur(item.unit_price_minor, currency), colX.rate, y, { align: 'right' });
    doc.text(fmtCur(item.amount_minor, currency), colX.amount, y, { align: 'right' });
    y += 6;
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
