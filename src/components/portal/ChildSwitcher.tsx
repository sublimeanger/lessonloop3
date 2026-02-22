import { useChildrenWithDetails } from '@/hooks/useParentPortal';
import { useChildFilter } from '@/contexts/ChildFilterContext';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Users } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChildSwitcherProps {
  className?: string;
  compact?: boolean;
}

export function ChildSwitcher({ className, compact }: ChildSwitcherProps) {
  const { data: children } = useChildrenWithDetails();
  const { selectedChildId, setSelectedChildId } = useChildFilter();

  if (!children || children.length <= 1) return null;

  return (
    <Select
      value={selectedChildId || '__all__'}
      onValueChange={(v) => setSelectedChildId(v === '__all__' ? null : v)}
    >
      <SelectTrigger className={cn('bg-background', compact ? 'h-8 text-xs w-36' : 'w-48', className)}>
        <div className="flex items-center gap-2 truncate">
          <Users className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <SelectValue placeholder="All children" />
        </div>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__all__">All children</SelectItem>
        {children.map((child) => (
          <SelectItem key={child.id} value={child.id}>
            {child.first_name} {child.last_name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
