import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Mail, AlertCircle, ArrowLeft, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { useUpdateInvoiceStatus } from '@/hooks/useInvoices';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import type { InvoiceWithDetails } from '@/hooks/useInvoices';
import { formatCurrencyMinor, formatDateUK } from '@/lib/utils';
import { parseISO } from 'date-fns';
import DOMPurify from 'dompurify';

interface SendInvoiceModalProps {
  invoice: InvoiceWithDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isReminder?: boolean;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildPreviewHtml(
  recipientName: string,
  invoiceNumber: string,
  amount: string,
  dueDate: string,
  orgName: string,
  isReminder: boolean,
  customMessage: string,
): string {
  const invoiceDetailsBlock = `
    <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 5px 0;"><strong>Invoice Number:</strong> ${escapeHtml(invoiceNumber)}</p>
      <p style="margin: 5px 0;"><strong>Amount Due:</strong> ${escapeHtml(amount)}</p>
      <p style="margin: 5px 0;"><strong>Due Date:</strong> ${escapeHtml(dueDate)}</p>
    </div>`;

  const buttonStyle = 'display: inline-block; background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0;';

  const payOnlineCta = `
    <p style="text-align: center;">
      <a href="#" style="${buttonStyle}">View & Pay Invoice</a>
    </p>
    <p style="font-size: 12px; color: #666;">
      Click the button above to view your invoice and make a payment securely online.
    </p>`;

  const customBlock = customMessage ? `<p>${escapeHtml(customMessage)}</p>` : '';

  if (isReminder) {
    return `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #333; margin-bottom: 20px;">Payment Reminder</h1>
      <p>Dear ${escapeHtml(recipientName)},</p>
      <p>This is a friendly reminder that payment for the following invoice is due:</p>
      ${invoiceDetailsBlock}
      ${customBlock}
      ${payOnlineCta}
      <p>Thank you,<br>${escapeHtml(orgName)}</p>
    </div>`;
  }

  return `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <h1 style="color: #333; margin-bottom: 20px;">Invoice ${escapeHtml(invoiceNumber)}</h1>
    <p>Dear ${escapeHtml(recipientName)},</p>
    <p>Please find below the details of your invoice:</p>
    ${invoiceDetailsBlock}
    ${customBlock}
    ${payOnlineCta}
    <p>If you have any questions about this invoice, please don't hesitate to contact us.</p>
    <p>Thank you for your business,<br>${escapeHtml(orgName)}</p>
  </div>`;
}

export function SendInvoiceModal({
  invoice,
  open,
  onOpenChange,
  isReminder = false,
}: SendInvoiceModalProps) {
  const { currentOrg } = useOrg();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const updateStatus = useUpdateInvoiceStatus();
  const [isSending, setIsSending] = useState(false);
  const [customMessage, setCustomMessage] = useState('');
  const [step, setStep] = useState<'compose' | 'preview'>('compose');

  const recipientEmail =
    invoice?.payer_guardian?.email || invoice?.payer_student?.email || null;
  const recipientName =
    invoice?.payer_guardian?.full_name ||
    (invoice?.payer_student
      ? `${invoice.payer_student.first_name} ${invoice.payer_student.last_name}`
      : 'Customer');

  const currency = currentOrg?.currency_code || 'GBP';
  const amount = invoice ? formatCurrencyMinor(invoice.total_minor, currency) : '';
  const dueDate = invoice ? formatDateUK(parseISO(invoice.due_date), 'dd/MM/yyyy') : '';

  const subject = useMemo(() => {
    if (!invoice || !currentOrg) return '';
    return isReminder
      ? `Payment Reminder: Invoice ${invoice.invoice_number}`
      : `Invoice ${invoice.invoice_number} from ${currentOrg.name}`;
  }, [invoice, currentOrg, isReminder]);

  const previewHtml = useMemo(() => {
    if (!invoice || !currentOrg) return '';
    return buildPreviewHtml(
      recipientName,
      invoice.invoice_number,
      amount,
      dueDate,
      currentOrg.name,
      isReminder,
      customMessage,
    );
  }, [invoice, currentOrg, recipientName, amount, dueDate, isReminder, customMessage]);

  const handleSend = async () => {
    if (!invoice || !currentOrg || !recipientEmail) return;

    setIsSending(true);

    try {
      const { error: sendError } = await supabase.functions.invoke('send-invoice-email', {
        body: {
          invoiceId: invoice.id,
          recipientEmail,
          recipientName,
          invoiceNumber: invoice.invoice_number,
          amount,
          dueDate: invoice.due_date,
          orgName: currentOrg.name,
          orgId: currentOrg.id,
          isReminder,
          customMessage,
        },
      });

      if (sendError) throw sendError;

      if (invoice.status === 'draft') {
        await updateStatus.mutateAsync({ id: invoice.id, status: 'sent' });
      }

      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice'] });

      toast({ title: isReminder ? 'Reminder sent' : 'Invoice sent' });
      handleClose();
    } catch (error: unknown) {
      toast({ title: 'Error', description: `Failed to send: ${error instanceof Error ? error.message : 'Unknown error'}`, variant: 'destructive' });
    } finally {
      setIsSending(false);
    }
  };

  const handleClose = () => {
    setStep('compose');
    setCustomMessage('');
    onOpenChange(false);
  };

  const getDefaultMessage = () => {
    if (isReminder) {
      return `This is a friendly reminder that payment for invoice ${invoice?.invoice_number} is due.`;
    }
    return `Please find attached your invoice. Payment is due by ${invoice?.due_date}.`;
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {step === 'preview'
              ? 'Preview Email'
              : isReminder ? 'Send Payment Reminder' : 'Send Invoice'}
          </DialogTitle>
          <DialogDescription>
            {invoice && `Invoice ${invoice.invoice_number}`}
          </DialogDescription>
        </DialogHeader>

        {step === 'compose' && (
          <>
            <div className="space-y-4">
              {!recipientEmail && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No email address found for the payer. Please add an email address to send
                    the invoice.
                  </AlertDescription>
                </Alert>
              )}

              {recipientEmail && (
                <div className="rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="text-sm font-medium">{recipientName}</div>
                      <div className="text-xs text-muted-foreground">{recipientEmail}</div>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="message">Custom Message (Optional)</Label>
                <Textarea
                  id="message"
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  placeholder={getDefaultMessage()}
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                variant="secondary"
                onClick={() => setStep('preview')}
                disabled={!recipientEmail}
              >
                <Eye className="mr-2 h-4 w-4" />
                Preview
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'preview' && (
          <>
            <div className="space-y-3">
              {/* Email metadata */}
              <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5 text-sm">
                <div className="flex gap-2">
                  <span className="text-muted-foreground font-medium w-12 shrink-0">To:</span>
                  <span className="text-foreground">{recipientName} &lt;{recipientEmail}&gt;</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-muted-foreground font-medium w-12 shrink-0">Subject:</span>
                  <span className="text-foreground">{subject}</span>
                </div>
              </div>

              {/* Email body preview */}
              <div className="rounded-lg border bg-white overflow-hidden">
                <div
                  className="p-1 max-h-[320px] overflow-y-auto"
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(previewHtml) }}
                />
              </div>

              <p className="text-xs text-muted-foreground">
                Bank transfer details (if configured) will also be included in the sent email.
              </p>
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={() => setStep('compose')} className="gap-1.5">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
              <Button onClick={handleSend} disabled={isSending}>
                {isSending ? 'Sending...' : isReminder ? 'Send Reminder' : 'Send Invoice'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
