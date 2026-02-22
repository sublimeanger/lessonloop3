import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { X } from 'lucide-react';
import type { InvoiceFilters } from '@/hooks/useInvoices';
import type { Database } from '@/integrations/supabase/types';
import { useTerms } from '@/hooks/useTerms';
import { cn } from '@/lib/utils';

type InvoiceStatus = Database['public']['Enums']['invoice_status'];

interface InvoiceFiltersBarProps {
  filters: InvoiceFilters;
  onFiltersChange: (filters: InvoiceFilters) => void;
  statusCounts?: Record<string, number>;
}

type StatusPill = { value: InvoiceStatus | 'all'; label: string };

const STATUS_PILLS: StatusPill[] = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'paid', label: 'Paid' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'void', label: 'Cancelled' },
];

export function InvoiceFiltersBar({
  filters,
  onFiltersChange,
  statusCounts,
}: InvoiceFiltersBarProps) {
  const { data: terms = [] } = useTerms();
  const currentStatus = filters.status || 'all';

  const hasDateOrTermFilters =
    filters.dueDateFrom || filters.dueDateTo || filters.termId;

  const clearFilters = () => {
    onFiltersChange({});
  };

  return (
    <div className="space-y-3">
      {/* Status pills */}
      <div className="flex items-center gap-1 rounded-lg bg-muted/50 p-0.5 overflow-x-auto">
        {STATUS_PILLS.map((pill) => {
          const count = statusCounts?.[pill.value];
          return (
            <button
              key={pill.value}
              onClick={() =>
                onFiltersChange({
                  ...filters,
                  status: pill.value === 'all' ? undefined : (pill.value as InvoiceStatus),
                })
              }
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-all',
                currentStatus === pill.value ||
                  (pill.value === 'all' && !filters.status)
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {pill.label}
              {count !== undefined && (
                <span className="ml-1 text-muted-foreground">({count})</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Secondary filters row — only show when needed */}
      {(hasDateOrTermFilters || terms.length > 0) && (
        <div className="flex flex-wrap items-end gap-3">
          {terms.length > 0 && (
            <div className="space-y-1">
              <Label htmlFor="term" className="text-xs">
                Term
              </Label>
              <Select
                value={filters.termId || 'all'}
                onValueChange={(value) =>
                  onFiltersChange({ ...filters, termId: value === 'all' ? undefined : value })
                }
              >
                <SelectTrigger id="term" className="w-full sm:w-[160px] h-8 text-xs">
                  <SelectValue placeholder="All Terms" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Terms</SelectItem>
                  {terms.map((term) => (
                    <SelectItem key={term.id} value={term.id}>
                      {term.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="dueDateFrom" className="text-xs">
              Due From
            </Label>
            <Input
              id="dueDateFrom"
              type="date"
              value={filters.dueDateFrom || ''}
              onChange={(e) =>
                onFiltersChange({ ...filters, dueDateFrom: e.target.value || undefined })
              }
              className="w-full sm:w-[150px] h-8 text-xs"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="dueDateTo" className="text-xs">
              Due To
            </Label>
            <Input
              id="dueDateTo"
              type="date"
              value={filters.dueDateTo || ''}
              onChange={(e) =>
                onFiltersChange({ ...filters, dueDateTo: e.target.value || undefined })
              }
              className="w-full sm:w-[150px] h-8 text-xs"
            />
          </div>

          {hasDateOrTermFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 h-8 text-xs">
              <X className="h-3 w-3" />
              Clear
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
