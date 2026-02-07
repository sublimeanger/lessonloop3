import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { X } from 'lucide-react';
import type { InvoiceFilters } from '@/hooks/useInvoices';
import type { Database } from '@/integrations/supabase/types';

type InvoiceStatus = Database['public']['Enums']['invoice_status'];

interface InvoiceFiltersBarProps {
  filters: InvoiceFilters;
  onFiltersChange: (filters: InvoiceFilters) => void;
}

const STATUS_OPTIONS: Array<{ value: InvoiceStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All Statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'paid', label: 'Paid' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'void', label: 'Void' },
];

export function InvoiceFiltersBar({ filters, onFiltersChange }: InvoiceFiltersBarProps) {
  const hasFilters =
    (filters.status && filters.status !== 'all') ||
    filters.dueDateFrom ||
    filters.dueDateTo;

  const clearFilters = () => {
    onFiltersChange({});
  };

  return (
    <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-end gap-3 sm:gap-4 rounded-lg border bg-card p-4">
      <div className="space-y-1.5">
        <Label htmlFor="status" className="text-xs">
          Status
        </Label>
        <Select
          value={filters.status || 'all'}
          onValueChange={(value) =>
            onFiltersChange({ ...filters, status: value as InvoiceStatus | 'all' })
          }
        >
          <SelectTrigger id="status" className="w-full sm:w-[140px]">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
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
          className="w-full sm:w-[140px]"
        />
      </div>

      <div className="space-y-1.5">
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
          className="w-full sm:w-[140px]"
        />
      </div>

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 col-span-2 sm:col-span-1">
          <X className="h-3 w-3" />
          Clear
        </Button>
      )}
    </div>
  );
}
