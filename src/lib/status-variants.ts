import type { BadgeProps } from '@/components/ui/badge';

type BadgeVariant = NonNullable<BadgeProps['variant']>;

/**
 * Centralized invoice-status → badge-variant mapping.
 * Consumed by BillingTab, InvoiceDetail, PortalInvoices.
 */
export const invoiceStatusConfig: Record<
  string,
  { variant: BadgeVariant; label: string }
> = {
  draft: { variant: 'secondary', label: 'Draft' },
  sent: { variant: 'default', label: 'Sent' },
  paid: { variant: 'success', label: 'Paid' },
  overdue: { variant: 'destructive', label: 'Overdue' },
  void: { variant: 'outline', label: 'Void' },
  open: { variant: 'secondary', label: 'Open' },
  uncollectible: { variant: 'destructive', label: 'Uncollectible' },
};

/**
 * Returns the badge variant + display label for a given invoice status.
 * Automatically detects overdue invoices by comparing dueDate to today.
 */
export function getInvoiceStatusConfig(
  status: string | null,
  dueDate?: string,
): { variant: BadgeVariant; label: string } {
  if (!status) return { variant: 'outline', label: 'Unknown' };

  // Auto-detect overdue: invoice is "sent" but past due
  if (status === 'sent' && dueDate) {
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (due < today) {
      return { variant: 'destructive', label: 'Overdue' };
    }
  }

  return (
    invoiceStatusConfig[status] ?? {
      variant: 'outline',
      label: status.charAt(0).toUpperCase() + status.slice(1),
    }
  );
}

/**
 * Centralized lesson-status → badge-variant mapping.
 */
export const lessonStatusConfig: Record<
  string,
  { variant: BadgeVariant; label: string }
> = {
  scheduled: { variant: 'outline', label: 'Scheduled' },
  completed: { variant: 'secondary', label: 'Completed' },
  cancelled: { variant: 'destructive', label: 'Cancelled' },
};
