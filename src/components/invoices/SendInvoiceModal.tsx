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
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import type { InvoiceWithDetails } from '@/hooks/useInvoices';
import DOMPurify from 'dompurify';

interface SendInvoiceModalProps {
  invoice: InvoiceWithDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isReminder?: boolean;
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

  const subject = useMemo(() => {
    if (!invoice || !currentOrg) return '';
    return isReminder
      ? `Payment Reminder: Invoice ${invoice.invoice_number}`
      : `Invoice ${invoice.invoice_number} from ${currentOrg.name}`;
  }, [invoice, currentOrg, isReminder]);

  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [previewSubject, setPreviewSubject] = useState<string>('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [recentSendInfo, setRecentSendInfo] = useState<{
    sentWithinDebounce: boolean;
    humanAgo?: string;
  }>({ sentWithinDebounce: false });

  // J3-F8: Fetch preview from edge function when entering preview step.
  // Source of truth is the server — no client-side HTML building.
  const fetchPreview = async () => {
    if (!invoice) return;
    setPreviewLoading(true);
    setPreviewError(null);
    try {
      const { data, error } = await supabase.functions.invoke('send-invoice-email', {
        body: {
          invoiceId: invoice.id,
          isReminder,
          customMessage,
          preview: true,
        },
      });
      if (error) throw error;
      if (data && typeof data === 'object' && 'error' in data && data.error) {
        throw new Error((data as any).error as string);
      }
      const d = data as {
        html: string;
        subject: string;
        recipientEmail: string;
        recipientName: string;
        recentSendInfo?: { sentWithinDebounce: boolean; humanAgo?: string };
      };
      setPreviewHtml(d.html);
      setPreviewSubject(d.subject);
      setRecentSendInfo(d.recentSendInfo || { sentWithinDebounce: false });
    } catch (err: unknown) {
      setPreviewError(err instanceof Error ? err.message : 'Failed to load preview');
      setPreviewHtml('');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleSend = async () => {
    if (!invoice || !currentOrg) return;

    // FIX 2: Guard against sending paid/void invoices
    if (invoice.status === 'void') {
      toast({ title: 'Cannot send voided invoice', variant: 'destructive' });
      return;
    }
    if (invoice.status === 'paid') {
      toast({ title: 'Cannot send paid invoice', variant: 'destructive' });
      return;
    }

    setIsSending(true);

    try {
      const { data, error: sendError } = await supabase.functions.invoke('send-invoice-email', {
        body: {
          invoiceId: invoice.id,
          isReminder,
          customMessage,
        },
      });

      // J3-F10: Transport-level failure
      if (sendError) throw sendError;

      // J3-F10: Server-returned error body. invoke() returns 200-299 as
      // success; non-2xx responses come back with data.error populated
      // but sendError = null.
      if (data && typeof data === 'object' && 'error' in data && data.error) {
        throw new Error((data as any).error as string);
      }

      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice'] });
      queryClient.invalidateQueries({ queryKey: ['message-log'] });

      toast({ title: isReminder ? 'Reminder sent' : 'Invoice sent' });
      handleClose();
    } catch (error: unknown) {
      toast({ title: isReminder ? 'Failed to send reminder' : 'Failed to send invoice', description: error instanceof Error ? error.message : 'An unexpected error occurred.', variant: 'destructive' });
    } finally {
      setIsSending(false);
    }
  };

  const handleClose = () => {
    setStep('compose');
    setCustomMessage('');
    setPreviewHtml('');
    setPreviewSubject('');
    setPreviewError(null);
    setRecentSendInfo({ sentWithinDebounce: false });
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
      <DialogContent className="h-screen w-screen max-w-none overflow-y-auto rounded-none border-0 p-4 sm:h-auto sm:max-w-lg sm:rounded-lg sm:border sm:p-6">
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
                    No email address found for the payer. Please add an email address to{' '}
                    {isReminder ? 'send the reminder' : 'send the invoice'}.
                  </AlertDescription>
                </Alert>
              )}

              {recipientEmail && (
                <div className="rounded-xl border p-3">
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

            <DialogFooter className="flex-col gap-2 sm:flex-row">
              <Button variant="outline" className="min-h-11 w-full sm:min-h-9 sm:w-auto" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                className="min-h-11 w-full sm:min-h-9 sm:w-auto"
                variant="secondary"
                onClick={async () => {
                  setStep('preview');
                  await fetchPreview();
                }}
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
              {/* Recent-send warning */}
              {recentSendInfo.sentWithinDebounce && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    This {isReminder ? 'reminder' : 'invoice'} was sent{' '}
                    {recentSendInfo.humanAgo}. Sending again will be blocked for 5 minutes.
                  </AlertDescription>
                </Alert>
              )}

              {/* Email metadata */}
              <div className="rounded-xl border bg-muted/30 p-3 space-y-1.5 text-sm">
                <div className="flex gap-2">
                  <span className="text-muted-foreground font-medium w-12 shrink-0">To:</span>
                  <span className="text-foreground">{recipientName} &lt;{recipientEmail}&gt;</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-muted-foreground font-medium w-12 shrink-0">Subject:</span>
                  <span className="text-foreground">{previewSubject || subject}</span>
                </div>
              </div>

              {/* Email body preview */}
              <div className="rounded-xl border bg-background overflow-hidden min-h-[200px]">
                {previewLoading ? (
                  <div className="flex items-center justify-center p-8 text-sm text-muted-foreground">
                    Loading preview...
                  </div>
                ) : previewError ? (
                  <div className="p-4 text-sm text-destructive">
                    Failed to load preview: {previewError}
                  </div>
                ) : (
                  <div
                    className="p-1 max-h-[320px] overflow-y-auto"
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(previewHtml) }}
                  />
                )}
              </div>

              <p className="text-xs text-muted-foreground">
                This preview shows the exact email your recipient will receive.
              </p>
            </div>

            <DialogFooter className="flex-col gap-2 sm:flex-row">
              <Button
                variant="outline"
                onClick={() => {
                  setStep('compose');
                  setPreviewHtml('');
                  setPreviewSubject('');
                  setPreviewError(null);
                  setRecentSendInfo({ sentWithinDebounce: false });
                }}
                className="min-h-11 w-full gap-1.5 sm:min-h-9 sm:w-auto"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
              <Button
                className="min-h-11 w-full sm:min-h-9 sm:w-auto"
                onClick={handleSend}
                disabled={
                  isSending ||
                  previewLoading ||
                  invoice?.status === 'void' ||
                  invoice?.status === 'paid' ||
                  recentSendInfo.sentWithinDebounce
                }
              >
                {isSending ? 'Sending...' : isReminder ? 'Send Reminder' : 'Send Invoice'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
