import { TableHead } from '@/components/ui/table';
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
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
    <TableHead
      className={`cursor-pointer select-none hover:text-foreground ${className}`}
      onClick={() => onToggle(field)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {isActive ? (
          currentDir === 'asc' ? (
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowDown className="h-3 w-3" />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-30" />
        )}
      </span>
    </TableHead>
  );
}
