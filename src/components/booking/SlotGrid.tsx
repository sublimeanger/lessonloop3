import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { TimeSlot } from '@/hooks/useBookingPage';

interface SlotGridProps {
  slots: TimeSlot[];
  selectedSlot: TimeSlot | null;
  onSelect: (slot: TimeSlot) => void;
  accentColor?: string;
}

// ─── Time-of-day grouping ────────────────────────────────

interface SlotGroup {
  label: string;
  slots: TimeSlot[];
}

function getTimeOfDay(time: string): 'morning' | 'afternoon' | 'evening' {
  const hour = parseInt(time.split(':')[0], 10);
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

function groupSlotsByTimeOfDay(slots: TimeSlot[]): SlotGroup[] {
  const groups: Record<string, TimeSlot[]> = {
    morning: [],
    afternoon: [],
    evening: [],
  };

  for (const slot of slots) {
    const period = getTimeOfDay(slot.time);
    groups[period].push(slot);
  }

  const result: SlotGroup[] = [];
  if (groups.morning.length > 0) result.push({ label: 'Morning', slots: groups.morning });
  if (groups.afternoon.length > 0) result.push({ label: 'Afternoon', slots: groups.afternoon });
  if (groups.evening.length > 0) result.push({ label: 'Evening', slots: groups.evening });

  return result;
}

// ─── Component ───────────────────────────────────────────

export function SlotGrid({ slots, selectedSlot, onSelect, accentColor }: SlotGridProps) {
  const groups = useMemo(() => groupSlotsByTimeOfDay(slots), [slots]);

  if (slots.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground text-sm">
          No available slots for this date. Please try another day.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <div key={group.label}>
          <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
            {group.label}
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {group.slots.map((slot) => {
              const isSelected =
                selectedSlot?.time === slot.time &&
                selectedSlot?.teacher_id === slot.teacher_id &&
                selectedSlot?.date === slot.date;

              return (
                <button
                  key={`${slot.date}-${slot.time}-${slot.teacher_id}`}
                  onClick={() => onSelect(slot)}
                  className={cn(
                    'flex flex-col items-center justify-center rounded-lg border px-3 py-3 text-sm transition-all',
                    'min-h-[60px] touch-manipulation',
                    'hover:shadow-sm active:scale-[0.98]',
                    isSelected
                      ? 'border-transparent text-white shadow-md'
                      : 'border-border bg-card hover:border-primary/30',
                  )}
                  style={
                    isSelected
                      ? {
                          backgroundColor: accentColor || 'hsl(var(--primary))',
                          borderColor: accentColor || 'hsl(var(--primary))',
                        }
                      : undefined
                  }
                >
                  <span className="font-semibold">{slot.time}</span>
                  <span
                    className={cn(
                      'text-xs mt-0.5 truncate max-w-full',
                      isSelected ? 'text-white/80' : 'text-muted-foreground',
                    )}
                  >
                    {slot.teacher_name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
