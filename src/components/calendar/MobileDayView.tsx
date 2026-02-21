import { useMemo } from 'react';
import { format, parseISO, differenceInMinutes, isSameDay } from 'date-fns';
import { LessonWithDetails } from './types';
import { TeacherWithColour, TeacherColourEntry, TEACHER_COLOURS } from './teacherColours';
import { cn } from '@/lib/utils';
import { Calendar as CalendarIcon } from 'lucide-react';

function resolveColourByUserId(
  colourMap: Map<string, TeacherWithColour>,
  teacherUserId: string | null | undefined
): TeacherColourEntry {
  if (!teacherUserId) return TEACHER_COLOURS[0];
  for (const entry of colourMap.values()) {
    if (entry.userId === teacherUserId) return entry.colour;
  }
  return TEACHER_COLOURS[0];
}

interface MobileDayViewProps {
  currentDate: Date;
  lessons: LessonWithDetails[];
  teacherColourMap: Map<string, TeacherWithColour>;
  onLessonClick: (lesson: LessonWithDetails) => void;
  savingLessonIds?: Set<string>;
}

export function MobileDayView({
  currentDate,
  lessons,
  teacherColourMap,
  onLessonClick,
  savingLessonIds,
}: MobileDayViewProps) {
  // Filter lessons for the current day and sort chronologically
  const dayLessons = useMemo(() => {
    return lessons
      .filter((l) => isSameDay(parseISO(l.start_at), currentDate))
      .sort((a, b) => a.start_at.localeCompare(b.start_at));
  }, [lessons, currentDate]);

  if (dayLessons.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
          <CalendarIcon className="h-8 w-8 text-muted-foreground/50" />
        </div>
        <p className="text-base font-semibold text-foreground">No lessons today</p>
        <p className="text-sm text-muted-foreground mt-1">
          Tap + to schedule a lesson
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {dayLessons.map((lesson, idx) => {
        const startTime = parseISO(lesson.start_at);
        const endTime = parseISO(lesson.end_at);
        const duration = differenceInMinutes(endTime, startTime);
        const colour = resolveColourByUserId(teacherColourMap, lesson.teacher_user_id);
        const isCancelled = lesson.status === 'cancelled';
        const isCompleted = lesson.status === 'completed';
        const isSaving = savingLessonIds?.has(lesson.id);

        // Calculate gap from previous lesson
        const prevLesson = idx > 0 ? dayLessons[idx - 1] : null;
        const gapMinutes = prevLesson
          ? differenceInMinutes(startTime, parseISO(prevLesson.end_at))
          : 0;
        const showBreak = gapMinutes > 45;

        const studentNames = lesson.participants?.map(
          (p) => `${p.student.first_name} ${p.student.last_name}`
        ) ?? [];
        const primaryName = studentNames[0] || lesson.title;

        return (
          <div key={lesson.id}>
            {/* Break indicator */}
            {showBreak && (
              <div className="flex items-center gap-3 px-4 py-2">
                <div className="flex-1 border-t border-dashed border-muted-foreground/20" />
                <span className="text-[11px] text-muted-foreground/60 font-medium whitespace-nowrap">
                  {gapMinutes >= 60
                    ? `${Math.floor(gapMinutes / 60)}h ${gapMinutes % 60 > 0 ? `${gapMinutes % 60}m` : ''} break`
                    : `${gapMinutes}m break`
                  }
                </span>
                <div className="flex-1 border-t border-dashed border-muted-foreground/20" />
              </div>
            )}

            {/* Lesson card */}
            <button
              onClick={() => onLessonClick(lesson)}
              className={cn(
                'w-full flex items-stretch gap-0 px-0 py-3 text-left transition-colors active:bg-muted/50',
                isCancelled && 'opacity-40',
                isSaving && 'animate-pulse',
              )}
              style={{ minHeight: 64 }}
            >
              {/* Time column */}
              <div className="w-14 shrink-0 flex flex-col items-end justify-start pr-3 pt-0.5">
                <span className="text-sm font-semibold tabular-nums text-foreground leading-tight">
                  {format(startTime, 'HH:mm')}
                </span>
                <span className="text-[11px] tabular-nums text-muted-foreground leading-tight">
                  {format(endTime, 'HH:mm')}
                </span>
              </div>

              {/* Color bar */}
              <div
                className="w-[3px] rounded-full shrink-0 self-stretch"
                style={{ backgroundColor: colour.hex }}
              />

              {/* Content */}
              <div className="flex-1 min-w-0 pl-3 pr-4">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    'text-sm font-semibold text-foreground truncate',
                    isCancelled && 'line-through',
                  )}>
                    {primaryName}
                  </span>
                  {isCompleted && (
                    <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400 shrink-0">
                      Done
                    </span>
                  )}
                  {isCancelled && (
                    <span className="inline-flex items-center rounded-full bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive shrink-0">
                      Cancelled
                    </span>
                  )}
                </div>
                <p className="text-[12px] text-muted-foreground truncate mt-0.5">
                  {lesson.title !== primaryName ? `${lesson.title} · ` : ''}
                  {duration}min
                  {lesson.location && ` · ${lesson.location.name}`}
                </p>
                {lesson.teacher?.full_name && (
                  <p className="text-[11px] text-muted-foreground/70 truncate mt-0.5">
                    {lesson.teacher.full_name}
                  </p>
                )}
                {studentNames.length > 1 && (
                  <p className="text-[11px] text-muted-foreground/70 truncate mt-0.5">
                    +{studentNames.length - 1} more student{studentNames.length > 2 ? 's' : ''}
                  </p>
                )}
              </div>
            </button>
          </div>
        );
      })}
    </div>
  );
}
