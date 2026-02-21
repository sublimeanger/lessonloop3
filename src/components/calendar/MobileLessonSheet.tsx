import { format, parseISO, differenceInMinutes } from 'date-fns';
import { LessonWithDetails } from './types';
import { TeacherColourEntry } from './teacherColours';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Clock, User, MapPin, Repeat, Users, Edit2, Check, UserX, Ban } from 'lucide-react';

interface MobileLessonSheetProps {
  lesson: LessonWithDetails | null;
  open: boolean;
  onClose: () => void;
  onEdit: (lesson: LessonWithDetails) => void;
  onOpenDetail: (lesson: LessonWithDetails) => void;
  teacherColour: TeacherColourEntry;
}

const STATUS_STYLES: Record<string, { className: string; label: string }> = {
  scheduled: { className: 'bg-primary/10 text-primary', label: 'Scheduled' },
  completed: { className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400', label: 'Completed' },
  cancelled: { className: 'bg-muted text-muted-foreground', label: 'Cancelled' },
};

export function MobileLessonSheet({
  lesson,
  open,
  onClose,
  onEdit,
  onOpenDetail,
  teacherColour,
}: MobileLessonSheetProps) {
  if (!lesson) return null;

  const startTime = parseISO(lesson.start_at);
  const endTime = parseISO(lesson.end_at);
  const duration = differenceInMinutes(endTime, startTime);
  const statusInfo = STATUS_STYLES[lesson.status] ?? STATUS_STYLES.scheduled;

  const studentNames = lesson.participants?.map(
    (p) => `${p.student.first_name} ${p.student.last_name}`
  ) ?? [];
  const primaryStudentName = studentNames[0] || lesson.title;

  const teacherName = lesson.teacher?.full_name || lesson.teacher?.email || 'Unknown';
  const teacherInitials = teacherName
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');

  const isCancelled = lesson.status === 'cancelled';

  return (
    <Drawer open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <DrawerTitle className="text-lg font-bold truncate">
              {primaryStudentName}
            </DrawerTitle>
            <Badge className={cn('text-[11px] shrink-0', statusInfo.className)}>
              {statusInfo.label}
            </Badge>
          </div>
          {lesson.title !== primaryStudentName && (
            <p className="text-sm text-muted-foreground truncate">{lesson.title}</p>
          )}
        </DrawerHeader>

        <div className="px-4 pb-6 space-y-4 overflow-y-auto">
          {/* Detail rows */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex items-center gap-2 text-sm">
                <span className="tabular-nums text-foreground">
                  {format(startTime, 'HH:mm')} – {format(endTime, 'HH:mm')}
                </span>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {duration} min
                </Badge>
              </div>
            </div>

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

            {lesson.location && (
              <div className="flex items-center gap-3">
                <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm text-foreground">
                  {lesson.location.name}
                  {lesson.room && <span className="text-muted-foreground"> · {lesson.room.name}</span>}
                </span>
              </div>
            )}

            {lesson.recurrence_id && (
              <div className="flex items-center gap-3">
                <Repeat className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm text-muted-foreground">Recurring lesson</span>
              </div>
            )}

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
            </>
          )}

          <Separator />

          {/* Actions */}
          <div className="space-y-2">
            <Button
              onClick={() => { onClose(); onEdit(lesson); }}
              className="w-full gap-2"
              style={{ minHeight: 44 }}
            >
              <Edit2 className="h-4 w-4" />
              Edit Lesson
            </Button>

            {!isCancelled && (
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="secondary"
                  className="gap-1.5"
                  style={{ minHeight: 44 }}
                  onClick={() => { onClose(); onOpenDetail(lesson); }}
                >
                  <Check className="h-4 w-4" />
                  Complete
                </Button>
                <Button
                  variant="secondary"
                  className="gap-1.5"
                  style={{ minHeight: 44 }}
                  onClick={() => { onClose(); onOpenDetail(lesson); }}
                >
                  <UserX className="h-4 w-4" />
                  Absent
                </Button>
              </div>
            )}

            {!isCancelled && (
              <Button
                variant="outline"
                className="w-full gap-2 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                style={{ minHeight: 44 }}
                onClick={() => { onClose(); onOpenDetail(lesson); }}
              >
                <Ban className="h-4 w-4" />
                Cancel Lesson
              </Button>
            )}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
