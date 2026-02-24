import { TableHead } from '@/components/ui/table';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import type { SortDir } from '@/hooks/useSortableTable';

interface SortableTableHeadProps<F extends string> {
  label: string;
  field: F;
  currentField: F;
  currentDir: SortDir;
  onToggle: (field: F) => void;
  className?: string;
}

export function SortableTableHead<F extends string>({
  label,
  field,
  currentField,
  currentDir,
  onToggle,
  className = '',
}: SortableTableHeadProps<F>) {
  const isActive = currentField === field;

  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => onToggle(field)}
        className="inline-flex min-h-11 items-center gap-1 text-left text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-label={`Sort by ${label}`}
      >
        <span>{label}</span>
        {isActive ? (
          currentDir === 'asc' ? (
            <ArrowUp className="h-4 w-4" />
          ) : (
            <ArrowDown className="h-4 w-4" />
          )
        ) : (
          <ArrowUpDown className="h-4 w-4 opacity-30" />
        )}
      </button>
    </TableHead>
  );
}
