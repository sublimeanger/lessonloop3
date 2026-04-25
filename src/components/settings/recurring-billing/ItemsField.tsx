import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, X } from 'lucide-react';

const CURRENCY_SYMBOLS: Record<string, string> = {
  GBP: '£',
  USD: '$',
  EUR: '€',
  AUD: 'A$',
  CAD: 'C$',
  NZD: 'NZ$',
};

const AMOUNT_PATTERN = /^[0-9]*\.?[0-9]{0,2}$/;

export interface ItemDraft {
  id?: string;
  description: string;
  amount_major: string;
  quantity: number;
}

interface ItemsFieldProps {
  value: ItemDraft[];
  onChange: (items: ItemDraft[]) => void;
  currencyCode: string;
}

export function ItemsField({ value, onChange, currencyCode }: ItemsFieldProps) {
  const symbol = CURRENCY_SYMBOLS[currencyCode] || currencyCode;

  const updateRow = (idx: number, patch: Partial<ItemDraft>) => {
    onChange(value.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  };

  const removeRow = (idx: number) => {
    onChange(value.filter((_, i) => i !== idx));
  };

  const addRow = () => {
    onChange([...value, { description: '', amount_major: '', quantity: 1 }]);
  };

  return (
    <div className="space-y-2">
      {value.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No items yet. Add at least one for upfront or hybrid mode.
        </p>
      )}
      {value.map((row, idx) => (
        <div
          key={idx}
          className="grid grid-cols-[1fr_8rem_5rem_auto] items-center gap-2"
        >
          <Input
            placeholder="e.g. Studio fee"
            value={row.description}
            onChange={(e) => updateRow(idx, { description: e.target.value })}
            className="min-w-0"
          />
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
              {symbol}
            </span>
            <Input
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={row.amount_major}
              onChange={(e) => {
                const next = e.target.value;
                if (next === '' || AMOUNT_PATTERN.test(next)) {
                  updateRow(idx, { amount_major: next });
                }
              }}
              className="w-full pl-7"
            />
          </div>
          <Input
            type="number"
            min={1}
            step={1}
            value={row.quantity}
            onChange={(e) => {
              const n = parseInt(e.target.value, 10);
              updateRow(idx, { quantity: Number.isFinite(n) && n > 0 ? n : 1 });
            }}
            className="w-full"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => removeRow(idx)}
            aria-label="Remove item"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={addRow}
        className="gap-1"
      >
        <Plus className="h-4 w-4" />
        Add item
      </Button>
    </div>
  );
}
