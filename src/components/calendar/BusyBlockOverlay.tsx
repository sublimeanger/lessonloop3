import { useMemo } from 'react';
import { parseISO, isSameDay, differenceInMinutes, format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { BusyBlock } from '@/hooks/useExternalBusyBlocks';

interface BusyBlockOverlayProps {
  busyBlocks: BusyBlock[];
  day: Date;
  startHour: number;
  hourHeight: number;
  /** Optional: map of user_id → teacher_id to filter by visible teacher columns */
  className?: string;
}

/**
 * Renders semi-transparent busy block overlays behind lesson cards.
 * Should be placed inside a relative-positioned day column.
 */
export function BusyBlockOverlay({
  busyBlocks,
  day,
  startHour,
  hourHeight,
  className,
}: BusyBlockOverlayProps) {
  const dayBlocks = useMemo(() => {
    return busyBlocks.filter((b) => {
      const bStart = parseISO(b.start_at);
      const bEnd = parseISO(b.end_at);
      // Block overlaps this day if it starts before end of day and ends after start of day
      return isSameDay(bStart, day) || isSameDay(bEnd, day) ||
        (bStart < day && bEnd > day);
    }).map((b) => {
      const bStart = parseISO(b.start_at);
      const bEnd = parseISO(b.end_at);

      // Clamp to the day boundaries
      const dayStart = new Date(day);
      dayStart.setHours(startHour, 0, 0, 0);
      const effectiveStart = bStart < dayStart ? dayStart : bStart;

      const startMinutes = effectiveStart.getHours() * 60 + effectiveStart.getMinutes();
      const endMinutes = bEnd.getHours() * 60 + bEnd.getMinutes();
      
      const top = ((startMinutes - startHour * 60) / 60) * hourHeight;
      const height = ((endMinutes - startMinutes) / 60) * hourHeight;

      return {
        id: b.id,
        top: Math.max(0, top),
        height: Math.max(height, 4),
        title: b.title,
      };
    });
  }, [busyBlocks, day, startHour, hourHeight]);

  if (dayBlocks.length === 0) return null;

  return (
    <>
      {dayBlocks.map((block) => (
        <div
          key={block.id}
          className={cn(
            'absolute left-0 right-0 z-[1] pointer-events-none overflow-hidden',
            className,
          )}
          style={{
            top: block.top,
            height: block.height,
            background: 'repeating-linear-gradient(135deg, transparent, transparent 4px, hsl(var(--muted-foreground) / 0.08) 4px, hsl(var(--muted-foreground) / 0.08) 8px)',
            backgroundColor: 'hsl(var(--muted-foreground) / 0.06)',
          }}
          title={block.title || 'External event'}
        >
          {block.height >= 16 && block.title && (
            <span className="block px-1 text-[10px] text-muted-foreground/60 truncate leading-tight mt-0.5">
              {block.title}
            </span>
          )}
        </div>
      ))}
    </>
  );
}
