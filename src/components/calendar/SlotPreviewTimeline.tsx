import { cn } from '@/lib/utils';
import type { GeneratedSlot } from '@/hooks/useSlotGenerator';
import { X, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SlotPreviewTimelineProps {
  slots: GeneratedSlot[];
  onToggleSlot: (id: string) => void;
}

export function SlotPreviewTimeline({ slots, onToggleSlot }: SlotPreviewTimelineProps) {
  const activeCount = slots.filter(s => !s.excluded).length;

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        {activeCount} of {slots.length} slots will be created
      </p>
      <div className="space-y-1 max-h-[340px] overflow-y-auto pr-1">
        {slots.map((slot) => {
          const isConflict = !!slot.conflictMessage;
          return (
            <div
              key={slot.id}
              className={cn(
                'flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors',
                slot.excluded && isConflict
                  ? 'border-destructive/30 bg-destructive/5 text-muted-foreground'
                  : slot.excluded
                    ? 'border-dashed border-muted bg-muted/30 text-muted-foreground line-through'
                    : 'border-border bg-card'
              )}
            >
              <div className="flex items-center gap-3">
                {isConflict && <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />}
                <span className="font-mono font-medium tabular-nums">{slot.startTime}</span>
                <span className="text-muted-foreground">→</span>
                <span className="font-mono font-medium tabular-nums">{slot.endTime}</span>
                {slot.conflictMessage && (
                  <span className="text-xs text-destructive">{slot.conflictMessage}</span>
                )}
              </div>
              {/* Conflict slots cannot be toggled back on */}
              {!isConflict && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={() => onToggleSlot(slot.id)}
                  title={slot.excluded ? 'Include slot' : 'Exclude slot'}
                >
                  <X className={cn('h-3.5 w-3.5', slot.excluded && 'rotate-45')} />
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
