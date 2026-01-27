import { useState } from 'react';
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
import { Mail, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { useUpdateInvoiceStatus } from '@/hooks/useInvoices';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { InvoiceWithDetails } from '@/hooks/useInvoices';
import { formatCurrencyMinor } from '@/lib/utils';

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
  const queryClient = useQueryClient();
  const updateStatus = useUpdateInvoiceStatus();
  const [isSending, setIsSending] = useState(false);
  const [customMessage, setCustomMessage] = useState('');

  const recipientEmail =
    invoice?.payer_guardian?.email || invoice?.payer_student?.email || null;
  const recipientName =
    invoice?.payer_guardian?.full_name ||
    (invoice?.payer_student
      ? `${invoice.payer_student.first_name} ${invoice.payer_student.last_name}`
      : 'Customer');

  const handleSend = async () => {
    if (!invoice || !currentOrg || !recipientEmail) return;

    setIsSending(true);

    try {
      // Call edge function to send email - it handles message logging with service role
      const { error: sendError } = await supabase.functions.invoke('send-invoice-email', {
        body: {
          invoiceId: invoice.id,
          recipientEmail,
          recipientName,
          invoiceNumber: invoice.invoice_number,
          amount: formatCurrencyMinor(invoice.total_minor, currentOrg.currency_code),
          dueDate: invoice.due_date,
          orgName: currentOrg.name,
          orgId: currentOrg.id,
          isReminder,
          customMessage,
        },
      });

      if (sendError) throw sendError;

      // Update invoice status to sent if it was a draft
      if (invoice.status === 'draft') {
        await updateStatus.mutateAsync({ id: invoice.id, status: 'sent' });
      }

      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice'] });

      toast.success(isReminder ? 'Reminder sent' : 'Invoice sent');
      onOpenChange(false);
    } catch (error: any) {
      toast.error(`Failed to send: ${error.message}`);
    } finally {
      setIsSending(false);
    }
  };

  const getDefaultMessage = () => {
    if (isReminder) {
      return `This is a friendly reminder that payment for invoice ${invoice?.invoice_number} is due.`;
    }
    return `Please find attached your invoice. Payment is due by ${invoice?.due_date}.`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isReminder ? 'Send Payment Reminder' : 'Send Invoice'}
          </DialogTitle>
          <DialogDescription>
            {invoice && `Invoice ${invoice.invoice_number}`}
          </DialogDescription>
        </DialogHeader>

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
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={isSending || !recipientEmail}>
            {isSending ? 'Sending...' : isReminder ? 'Send Reminder' : 'Send Invoice'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
