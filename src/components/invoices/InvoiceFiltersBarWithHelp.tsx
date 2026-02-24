import { InvoiceFiltersBar } from './InvoiceFiltersBar';
import { HelpTooltip } from '@/components/shared/HelpTooltip';
import type { InvoiceFilters } from '@/hooks/useInvoices';

interface InvoiceFiltersBarWithHelpProps {
  filters: InvoiceFilters;
  onFiltersChange: (filters: InvoiceFilters) => void;
}

export function InvoiceFiltersBarWithHelp(props: InvoiceFiltersBarWithHelpProps) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">Filters</span>
        <HelpTooltip 
          content="Filter invoices by status or due date. Use 'Overdue' to find unpaid invoices past their due date." 
          articleId="creating-invoices"
        />
      </div>
      <InvoiceFiltersBar {...props} />
    </div>
  );
}
