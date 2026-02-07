import { cn } from '@/lib/utils';
import { TeacherWithColour } from './teacherColours';
import { CalendarFilters } from './types';

interface TeacherColourLegendProps {
  teachers: TeacherWithColour[];
  filters: CalendarFilters;
  onFilterTeacher: (teacherId: string | null) => void;
}

export function TeacherColourLegend({ teachers, filters, onFilterTeacher }: TeacherColourLegendProps) {
  if (teachers.length <= 1) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button
        onClick={() => onFilterTeacher(null)}
        className={cn(
          'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer',
          !filters.teacher_id
            ? 'bg-primary/10 text-primary ring-1 ring-primary/30'
            : 'bg-muted text-muted-foreground hover:bg-muted/80'
        )}
      >
        All
      </button>
      {teachers.map((teacher) => (
        <button
          key={teacher.id}
          onClick={() =>
            onFilterTeacher(filters.teacher_id === teacher.id ? null : teacher.id)
          }
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer',
            filters.teacher_id === teacher.id
              ? 'ring-1 ring-offset-1 ring-offset-background'
              : 'hover:opacity-80',
            filters.teacher_id === teacher.id
              ? `${teacher.colour.bgLight} ${teacher.colour.text} ring-current`
              : 'bg-muted text-muted-foreground'
          )}
        >
          <span
            className={cn('h-2.5 w-2.5 rounded-full shrink-0', teacher.colour.bg)}
          />
          <span className="truncate max-w-[100px]">{teacher.name}</span>
        </button>
      ))}
    </div>
  );
}
