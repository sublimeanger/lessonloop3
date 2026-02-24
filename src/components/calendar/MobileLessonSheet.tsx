import { format, parseISO, differenceInMinutes } from 'date-fns';
import { LessonWithDetails } from './types';
import { TeacherColourEntry } from './teacherColours';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Clock, User, MapPin, Repeat, Users, Edit2, Video, ExternalLink } from 'lucide-react';

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
  completed: { className: 'bg-success/10 text-success', label: 'Completed' },
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
            <Badge className={cn('text-micro shrink-0', statusInfo.className)}>
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
                <Badge variant="secondary" className="text-micro px-1.5 py-0">
                  {duration} min
                </Badge>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <User className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex items-center gap-2 text-sm">
                <span
                  className="h-5 w-5 rounded-full flex items-center justify-center text-micro font-bold text-white shrink-0"
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
                  <p className="text-micro font-medium text-muted-foreground mb-1">Shared notes</p>
                  {lesson.notes_shared}
                </div>
              )}
              {lesson.notes_private && (
                <div className="rounded-lg bg-muted/50 p-3 text-sm text-foreground">
                  <p className="text-micro font-medium text-muted-foreground mb-1">Private notes</p>
                  {lesson.notes_private}
                </div>
              )}
            </>
          )}

          {/* Recap Link */}
          {lesson.recap_url && (
            <>
              <Separator />
              <a
                href={lesson.recap_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-lg border bg-muted/50 p-3 text-sm font-medium text-primary hover:bg-muted transition-colors"
                style={{ minHeight: 44 }}
              >
                <Video className="h-4 w-4 shrink-0" />
                <span className="flex-1">Watch Recap</span>
                <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </a>
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

            <Button
              variant="secondary"
              className="w-full gap-2"
              style={{ minHeight: 44 }}
              onClick={() => { onClose(); onOpenDetail(lesson); }}
            >
              <Users className="h-4 w-4" />
              Attendance &amp; Details
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
