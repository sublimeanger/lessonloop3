import { useState } from 'react';
import { logger } from '@/lib/logger';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useOrg } from '@/contexts/OrgContext';
import { useAuth } from '@/contexts/AuthContext';
import { renderInvoicePdf, type InvoicePdfInput } from '@/lib/invoice-pdf-renderer';

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

      // ── Fetch invoice + relations ────────────────────────────────
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

      const [{ data: items }, { data: payments }, { data: org }] = await Promise.all([
        supabase
          .from('invoice_items')
          .select('description, quantity, unit_price_minor, amount_minor')
          .eq('invoice_id', invoiceId)
          .order('created_at', { ascending: true }),
        supabase
          .from('payments')
          .select('amount_minor, paid_at, method')
          .eq('invoice_id', invoiceId)
          .order('paid_at', { ascending: false }),
        supabase
          .from('organisations')
          .select(`
            name, address, logo_url, brand_color, accent_color,
            invoice_from_name, invoice_from_address_line1, invoice_from_address_line2,
            invoice_from_city, invoice_from_postcode, invoice_from_country,
            invoice_footer_note, vat_enabled, vat_registration_number,
            bank_account_name, bank_sort_code, bank_account_number, bank_reference_prefix
          `)
          .eq('id', currentOrg.id)
          .single(),
      ]);

      let installments: InvoicePdfInput['invoice']['installments'] = [];
      if (invoice.payment_plan_enabled) {
        const { data: instData } = await supabase
          .from('invoice_installments')
          .select('installment_number, amount_minor, due_date, status, paid_at')
          .eq('invoice_id', invoiceId)
          .order('installment_number', { ascending: true });
        installments = instData || [];
      }

      // ── Pre-load logo as data URL (no <Image> dependency in renderer) ──
      let logoDataUrl: string | null = null;
      if (org?.logo_url) {
        try {
          logoDataUrl = await fetchLogoAsDataUrl(org.logo_url);
        } catch {
          // Non-fatal: renderer skips logo on null
        }
      }

      const flat = <T,>(v: T | T[] | null | undefined): T | null =>
        Array.isArray(v) ? (v[0] ?? null) : (v ?? null);

      const input: InvoicePdfInput = {
        invoice: {
          id: invoice.id,
          invoice_number: invoice.invoice_number,
          status: invoice.status,
          issue_date: invoice.issue_date,
          due_date: invoice.due_date,
          subtotal_minor: invoice.subtotal_minor,
          tax_minor: invoice.tax_minor,
          vat_rate: invoice.vat_rate,
          total_minor: invoice.total_minor,
          credit_applied_minor: invoice.credit_applied_minor,
          paid_minor: invoice.paid_minor,
          payment_plan_enabled: invoice.payment_plan_enabled,
          notes: invoice.notes,
          payer_guardian: flat(invoice.payer_guardian as unknown) as InvoicePdfInput['invoice']['payer_guardian'],
          payer_student: flat(invoice.payer_student as unknown) as InvoicePdfInput['invoice']['payer_student'],
          items: items ?? [],
          payments: payments ?? [],
          installments,
        },
        org: org ?? null,
        currency: currentOrg?.currency_code || 'GBP',
        logoDataUrl,
      };

      // ── Render via shared renderer ─────────────────────────────────
      const pdfBytes = await renderInvoicePdf(input);

      // Trigger browser download
      const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${invoiceNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      // Audit (fire-and-forget; same action string as legacy implementation)
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

// ─── Helpers ─────────────────────────────────────────────────────

async function fetchLogoAsDataUrl(url: string): Promise<string> {
  const response = await fetch(url, { mode: 'cors' });
  if (!response.ok) throw new Error('Logo fetch failed');
  const blob = await response.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('FileReader result was not a string'));
    };
    reader.onerror = () => reject(new Error('FileReader failed'));
    reader.readAsDataURL(blob);
  });
}
