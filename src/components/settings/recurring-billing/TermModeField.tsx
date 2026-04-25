import { useMemo } from 'react';
import { useTerms } from '@/hooks/useTerms';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { format, parseISO } from 'date-fns';

export type TermModeValue = {
  mode: 'rolling' | 'one_shot';
  termId: string | null;
};

interface TermModeFieldProps {
  value: TermModeValue;
  onChange: (next: TermModeValue) => void;
}

function formatDateSafe(iso: string): string {
  try {
    return format(parseISO(iso), 'd MMM yyyy');
  } catch {
    return iso;
  }
}

export function TermModeField({ value, onChange }: TermModeFieldProps) {
  const { data: terms = [] } = useTerms();

  const sortedTerms = useMemo(
    () =>
      [...terms].sort((a, b) =>
        a.start_date < b.start_date ? 1 : a.start_date > b.start_date ? -1 : 0,
      ),
    [terms],
  );

  return (
    <div className="space-y-3">
      <RadioGroup
        value={value.mode}
        onValueChange={(next) => {
          if (next === 'rolling') {
            onChange({ mode: 'rolling', termId: null });
          } else {
            onChange({ mode: 'one_shot', termId: value.termId });
          }
        }}
      >
        <div className="flex items-start gap-2">
          <RadioGroupItem value="rolling" id="term-mode-rolling" className="mt-1" />
          <Label htmlFor="term-mode-rolling" className="font-normal leading-snug">
            <span className="font-medium">Rolling</span>
            <span className="block text-sm text-muted-foreground">
              Generate each term automatically. After billing, advance to next term.
            </span>
          </Label>
        </div>
        <div className="flex items-start gap-2">
          <RadioGroupItem value="one_shot" id="term-mode-one-shot" className="mt-1" />
          <Label htmlFor="term-mode-one-shot" className="font-normal leading-snug">
            <span className="font-medium">One-shot</span>
            <span className="block text-sm text-muted-foreground">
              Generate for one specific term, then auto-pause.
            </span>
          </Label>
        </div>
      </RadioGroup>

      {value.mode === 'one_shot' && (
        <div className="pl-6">
          {sortedTerms.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No terms exist yet. Add terms in Settings → Terms first.
            </p>
          ) : (
            <Select
              value={value.termId ?? ''}
              onValueChange={(next) =>
                onChange({ mode: 'one_shot', termId: next || null })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Pick a term…" />
              </SelectTrigger>
              <SelectContent>
                {sortedTerms.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name} ({formatDateSafe(t.start_date)} – {formatDateSafe(t.end_date)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}
    </div>
  );
}
