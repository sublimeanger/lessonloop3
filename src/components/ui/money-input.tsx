import * as React from 'react';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { formatCurrencyMinor, currencySymbol } from '@/lib/utils';

export interface MoneyInputProps {
  /** Stored value in MINOR units (pence/cents). */
  valueMinor: number;
  onChangeMinor: (minorUnits: number) => void;
  currencyCode?: string;
  placeholder?: string;
  id?: string;
  className?: string;
  disabled?: boolean;
  /** When true, render a small "= £X.XX GBP" preview line below the input. Default true. */
  showPreview?: boolean;
  /** Optional helper text shown below the input next to an info icon. */
  helpText?: string;
}

/**
 * Money input with intuitive typing UX:
 *  - User types `35` → state.minor = 3500 (£35.00)
 *  - User types `35.00` → state.minor = 3500
 *  - User types `3500` → state.minor = 350000 (£3,500.00 — intentional)
 *  - Strips non-numeric characters, allows one decimal point, max 2 decimal places
 *  - On blur, pads to 2 decimal places ("35" → "35.00")
 *  - Live preview below input: "= £35.00 GBP"
 *  - inputMode="decimal" so mobile keyboards show the decimal point
 *
 * State storage in PARENT is always MINOR units (pence). The input itself
 * holds raw text so users can type "35.0" mid-keystroke without losing the
 * trailing dot.
 */
export function MoneyInput({
  valueMinor,
  onChangeMinor,
  currencyCode = 'GBP',
  placeholder = '30.00',
  id,
  className,
  disabled,
  showPreview = true,
  helpText,
}: MoneyInputProps) {
  const [raw, setRaw] = React.useState(() =>
    valueMinor === 0 ? '' : (valueMinor / 100).toFixed(2),
  );

  // Re-sync when the prop changes externally (e.g. opening an edit form for
  // a different rate card). Don't clobber mid-typing local state for the
  // same value.
  React.useEffect(() => {
    const expected = valueMinor === 0 ? '' : (valueMinor / 100).toFixed(2);
    const localMinor = Math.round((parseFloat(raw || '0') || 0) * 100);
    if (localMinor !== valueMinor) {
      setRaw(expected);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valueMinor]);

  const symbol = currencySymbol(currencyCode);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let next = e.target.value;
    // Allow only digits and at most one decimal point.
    next = next.replace(/[^\d.]/g, '');
    const dotCount = (next.match(/\./g) || []).length;
    if (dotCount > 1) {
      const i = next.indexOf('.');
      next = next.slice(0, i + 1) + next.slice(i + 1).replace(/\./g, '');
    }
    // Limit to 2 decimal places.
    const [whole, decimals] = next.split('.');
    if (decimals !== undefined && decimals.length > 2) {
      next = `${whole}.${decimals.slice(0, 2)}`;
    }
    setRaw(next);

    const parsed = parseFloat(next || '0');
    const minor = Number.isNaN(parsed) ? 0 : Math.round(parsed * 100);
    onChangeMinor(minor);
  };

  const handleBlur = () => {
    if (!raw) return;
    if (!raw.includes('.')) {
      setRaw(`${raw}.00`);
    } else if (raw.endsWith('.')) {
      setRaw(`${raw}00`);
    } else {
      const [whole, decimals] = raw.split('.');
      if (decimals && decimals.length === 1) {
        setRaw(`${whole}.${decimals}0`);
      }
    }
  };

  return (
    <div className={className}>
      <div className="relative">
        <span
          aria-hidden="true"
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none select-none"
        >
          {symbol}
        </span>
        <Input
          id={id}
          type="text"
          inputMode="decimal"
          value={raw}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          aria-describedby={helpText ? `${id ?? 'money-input'}-help` : undefined}
          className="pl-7"
        />
      </div>
      {showPreview && valueMinor > 0 && (
        <div className="mt-1 text-xs text-muted-foreground" data-testid="money-input-preview">
          = {formatCurrencyMinor(valueMinor, currencyCode)}
        </div>
      )}
      {helpText && (
        <div
          id={`${id ?? 'money-input'}-help`}
          className={cn('mt-1 flex items-start gap-1.5 text-xs text-muted-foreground')}
        >
          <Info className="h-3 w-3 mt-0.5 shrink-0" aria-hidden="true" />
          <span>{helpText}</span>
        </div>
      )}
    </div>
  );
}
