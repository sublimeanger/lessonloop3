import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Check, Tag } from 'lucide-react';
import { useResourceCategories } from '@/hooks/useResourceCategories';
import { cn } from '@/lib/utils';

interface CategoryPickerProps {
  selected: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}

export function CategoryPicker({ selected, onChange, disabled }: CategoryPickerProps) {
  const { data: categories = [] } = useResourceCategories();

  const toggle = (id: string) => {
    onChange(
      selected.includes(id)
        ? selected.filter((s) => s !== id)
        : [...selected, id]
    );
  };

  if (categories.length === 0) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="min-h-11 gap-1 text-xs sm:min-h-9" disabled={disabled}>
          <Tag className="h-3.5 w-3.5" />
          Categories
          {selected.length > 0 && (
            <Badge variant="secondary" className="ml-1 h-5 min-w-[20px] text-[10px] px-1">
              {selected.length}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[260px] p-2 sm:w-[220px]" align="start">
        <div className="space-y-1 max-h-[250px] overflow-y-auto">
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              className={cn(
                'flex min-h-11 w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent sm:min-h-9',
                selected.includes(cat.id) && 'bg-accent'
              )}
              onClick={() => toggle(cat.id)}
            >
              <div
                className="h-3 w-3 rounded-full shrink-0"
                style={{ backgroundColor: cat.color || 'hsl(var(--muted-foreground))' }}
              />
              <span className="flex-1 truncate">{cat.name}</span>
              {selected.includes(cat.id) && (
                <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
              )}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
