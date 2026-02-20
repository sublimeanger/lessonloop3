import { format, parseISO, differenceInMinutes } from 'date-fns';
import { LessonWithDetails } from './types';
import { TeacherColourEntry } from './teacherColours';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { X, Clock, User, MapPin, Repeat, Users, Edit2, Check, UserX, Ban } from 'lucide-react';

interface LessonDetailSidePanelProps {
  lesson: LessonWithDetails | null;
  open: boolean;
  onClose: () => void;
  onEdit: (lesson: LessonWithDetails) => void;
  onMarkAttendance: (lesson: LessonWithDetails, status: string) => void;
  teacherColour: TeacherColourEntry;
}

const STATUS_STYLES: Record<string, { className: string; label: string }> = {
  scheduled: { className: 'bg-primary/10 text-primary', label: 'Scheduled' },
  completed: { className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400', label: 'Completed' },
  cancelled: { className: 'bg-muted text-muted-foreground', label: 'Cancelled' },
};

export function LessonDetailSidePanel({
  lesson,
  open,
  onClose,
  onEdit,
  onMarkAttendance,
  teacherColour,
}: LessonDetailSidePanelProps) {
  if (!lesson && !open) return null;

  const startTime = lesson ? parseISO(lesson.start_at) : new Date();
  const endTime = lesson ? parseISO(lesson.end_at) : new Date();
  const duration = lesson ? differenceInMinutes(endTime, startTime) : 0;

  const studentNames = lesson?.participants?.map(
    (p) => `${p.student.first_name} ${p.student.last_name}`
  ) ?? [];

  const primaryStudentName = studentNames[0] || lesson?.title || 'Untitled Lesson';

  const statusInfo = lesson ? STATUS_STYLES[lesson.status] || STATUS_STYLES.scheduled : STATUS_STYLES.scheduled;

  const teacherName = lesson?.teacher?.full_name || lesson?.teacher?.email || 'Unknown';
  const teacherInitials = teacherName
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');

  // Recurrence display
  const recurrenceLabel = lesson?.recurrence_id ? 'Recurring lesson' : null;

  const isCancelled = lesson?.status === 'cancelled';

  return (
    <div
      className={cn(
        'shrink-0 border-l bg-background shadow-lg overflow-y-auto transition-all duration-200 ease-out',
        'w-80 xl:w-96',
        open ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0 w-0 border-0 overflow-hidden'
      )}
      style={{ willChange: 'transform, opacity, width' }}
    >
      {lesson && (
        <div className="p-4 space-y-4 animate-scale-fade">
          {/* Header */}
          <div className="space-y-1.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-bold text-foreground truncate">
                  {primaryStudentName}
                </h2>
                <p className="text-sm text-muted-foreground truncate">
                  {lesson.title !== primaryStudentName ? lesson.title : ''}
                </p>
              </div>
              <button
                onClick={onClose}
                className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                aria-label="Close panel"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <Badge className={cn('text-[11px]', statusInfo.className)}>
              {statusInfo.label}
            </Badge>
          </div>

          <Separator />

          {/* Detail rows */}
          <div className="space-y-3">
            {/* Time */}
            <div className="flex items-center gap-3">
              <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex items-center gap-2 text-sm">
                <span className="font-mono text-foreground">
                  {format(startTime, 'HH:mm')} – {format(endTime, 'HH:mm')}
                </span>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {duration} min
                </Badge>
              </div>
            </div>

            {/* Teacher */}
            <div className="flex items-center gap-3">
              <User className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex items-center gap-2 text-sm">
                <span
                  className="h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                  style={{ backgroundColor: teacherColour.hex }}
                >
                  {teacherInitials}
                </span>
                <span className="text-foreground">{teacherName}</span>
              </div>
            </div>

            {/* Location */}
            {lesson.location && (
              <div className="flex items-center gap-3">
                <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm text-foreground">
                  {lesson.location.name}
                  {lesson.room && <span className="text-muted-foreground"> · {lesson.room.name}</span>}
                </span>
              </div>
            )}

            {/* Recurrence */}
            {recurrenceLabel && (
              <div className="flex items-center gap-3">
                <Repeat className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm text-muted-foreground">{recurrenceLabel}</span>
              </div>
            )}

            {/* Participants (group lessons) */}
            {studentNames.length > 1 && (
              <div className="flex items-start gap-3">
                <Users className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <div className="text-sm space-y-0.5">
                  {studentNames.map((name, i) => (
                    <div key={i} className="text-foreground">{name}</div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          {(lesson.notes_shared || lesson.notes_private) && (
            <>
              <Separator />
              <div className="space-y-2">
                {lesson.notes_shared && (
                  <div className="rounded-lg bg-muted/50 p-3 text-sm text-foreground">
                    <p className="text-[11px] font-medium text-muted-foreground mb-1">Shared notes</p>
                    {lesson.notes_shared}
                  </div>
                )}
                {lesson.notes_private && (
                  <div className="rounded-lg bg-muted/50 p-3 text-sm text-foreground">
                    <p className="text-[11px] font-medium text-muted-foreground mb-1">Private notes</p>
                    {lesson.notes_private}
                  </div>
                )}
              </div>
            </>
          )}

          <Separator />

          {/* Quick actions */}
          <div className="space-y-2">
            <Button
              onClick={() => onEdit(lesson)}
              className="w-full gap-2"
              disabled={isCancelled}
            >
              <Edit2 className="h-4 w-4" />
              Edit Lesson
            </Button>

            {!isCancelled && (
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => onMarkAttendance(lesson, 'completed')}
                >
                  <Check className="h-3.5 w-3.5" />
                  Complete
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => onMarkAttendance(lesson, 'absent')}
                >
                  <UserX className="h-3.5 w-3.5" />
                  Absent
                </Button>
              </div>
            )}

            {!isCancelled && (
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => onMarkAttendance(lesson, 'cancel')}
              >
                <Ban className="h-3.5 w-3.5" />
                Cancel Lesson
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
