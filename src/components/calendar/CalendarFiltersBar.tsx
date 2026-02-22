import { useMemo } from 'react';
import { CalendarFilters } from './types';
import { TeacherWithColour } from './teacherColours';
import { cn } from '@/lib/utils';
import { LessonWithDetails } from './types';
import { format, parseISO } from 'date-fns';

interface CalendarFiltersBarProps {
  filters: CalendarFilters;
  onChange: (filters: CalendarFilters) => void;
  teachers: { id: string; name: string }[];
  locations: { id: string; name: string }[];
  rooms: { id: string; name: string; location_id: string }[];
  teachersWithColours?: TeacherWithColour[];
  lessons?: LessonWithDetails[];
  currentDate?: Date;
}

export function CalendarFiltersBar({
  filters,
  onChange,
  teachers,
  locations,
  teachersWithColours,
  lessons = [],
  currentDate,
}: CalendarFiltersBarProps) {
  const dayKey = currentDate ? format(currentDate, 'yyyy-MM-dd') : null;

  const counts = useMemo(() => {
    const byTeacher = new Map<string, number>();
    const byLocation = new Map<string, number>();
    let total = 0;

    for (const l of lessons) {
      if (l.status === 'cancelled') continue;
      if (dayKey) {
        const lessonDay = format(parseISO(l.start_at), 'yyyy-MM-dd');
        if (lessonDay !== dayKey) continue;
      }
      total++;
      if (l.teacher_id) {
        byTeacher.set(l.teacher_id, (byTeacher.get(l.teacher_id) || 0) + 1);
      }
      if (l.location_id) {
        byLocation.set(l.location_id, (byLocation.get(l.location_id) || 0) + 1);
      }
    }

    return { byTeacher, byLocation, total };
  }, [lessons, dayKey]);

  const totalCount = counts.total;

  const teacherList = teachersWithColours || teachers.map(t => ({ ...t, userId: null, colour: undefined as string | undefined }));

  return (
    <div
      className="flex items-center gap-1.5 overflow-x-auto pb-0.5"
      style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
    >
      {/* All pill */}
      <button
        onClick={() => onChange({ ...filters, teacher_id: null })}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-all cursor-pointer shrink-0',
          !filters.teacher_id
            ? 'bg-foreground text-background shadow-sm'
            : 'bg-muted/50 text-foreground hover:bg-muted'
        )}
      >
        All
        {totalCount > 0 && (
          <span className={cn(
            'text-[10px] opacity-70',
            !filters.teacher_id ? 'text-background/70' : ''
          )}>
            ({totalCount})
          </span>
        )}
      </button>

      {/* Teacher pills */}
      {teacherList.map((teacher) => {
        const isSelected = filters.teacher_id === teacher.id;
        const count = counts.byTeacher.get(teacher.id) || 0;
        const colour = 'colour' in teacher && teacher.colour ? teacher.colour : null;
        const firstName = teacher.name.split(' ')[0];

        return (
          <button
            key={teacher.id}
            onClick={() =>
              onChange({
                ...filters,
                teacher_id: isSelected ? null : teacher.id,
              })
            }
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-all cursor-pointer shrink-0',
              isSelected
                ? 'text-white shadow-sm'
                : 'bg-muted/50 text-foreground hover:bg-muted'
            )}
            style={
              isSelected && colour
                ? { backgroundColor: colour.hex }
                : undefined
            }
          >
            {colour && !isSelected && (
              <span className={cn('h-2 w-2 rounded-full shrink-0', colour.bg)} />
            )}
            {firstName}
            {count > 0 && (
              <span className={cn(
                'text-[10px] opacity-70',
                isSelected ? 'text-white/70' : ''
              )}>
                ({count})
              </span>
            )}
          </button>
        );
      })}

      {/* Divider */}
      {locations.length > 0 && (
        <div className="h-5 w-px bg-border shrink-0 mx-0.5" />
      )}

      {/* Location pills */}
      {locations.map((location) => {
        const isSelected = filters.location_id === location.id;
        const count = counts.byLocation.get(location.id) || 0;

        return (
          <button
            key={location.id}
            onClick={() =>
              onChange({
                ...filters,
                location_id: isSelected ? null : location.id,
                room_id: null,
              })
            }
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-all cursor-pointer shrink-0',
              isSelected
                ? 'bg-foreground text-background shadow-sm'
                : 'bg-muted/50 text-foreground hover:bg-muted'
            )}
          >
            {location.name}
            {count > 0 && (
              <span className={cn(
                'text-[10px] opacity-70',
                isSelected ? 'text-background/70' : ''
              )}>
                ({count})
              </span>
            )}
          </button>
        );
      })}

      {/* Divider before toggle */}
      <div className="h-5 w-px bg-border shrink-0 mx-0.5" />

      {/* Hide cancelled toggle */}
      <button
        onClick={() => onChange({ ...filters, hide_cancelled: !filters.hide_cancelled })}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-all cursor-pointer shrink-0',
          filters.hide_cancelled
            ? 'bg-foreground text-background shadow-sm'
            : 'bg-muted/50 text-foreground hover:bg-muted'
        )}
      >
        Hide cancelled
      </button>
    </div>
  );
}
