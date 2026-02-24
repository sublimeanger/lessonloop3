import { useState, useCallback } from 'react';
import { format, parseISO, differenceInMinutes } from 'date-fns';
import { LessonWithDetails, AttendanceStatus } from './types';
import { TeacherColourEntry } from './teacherColours';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { X, Clock, User, MapPin, Repeat, Users, Edit2, Check, UserX, Ban, AlertCircle, Loader2 } from 'lucide-react';
import { useUpdateAttendance } from '@/hooks/useRegisterData';
import { useAuth } from '@/contexts/AuthContext';
import { useOrg } from '@/contexts/OrgContext';

interface LessonDetailSidePanelProps {
  lesson: LessonWithDetails | null;
  open: boolean;
  onClose: () => void;
  onEdit: (lesson: LessonWithDetails) => void;
  onMarkAttendance: (lesson: LessonWithDetails, status: string) => void;
  onUpdated: () => void;
  teacherColour: TeacherColourEntry;
}

const STATUS_STYLES: Record<string, { className: string; label: string }> = {
  scheduled: { className: 'bg-primary/10 text-primary', label: 'Scheduled' },
  completed: { className: 'bg-success/10 text-success', label: 'Completed' },
  cancelled: { className: 'bg-muted text-muted-foreground', label: 'Cancelled' },
};

const ATTENDANCE_OPTIONS: { value: AttendanceStatus; label: string; icon: React.ReactNode; color: string }[] = [
  { value: 'present', label: 'Present', icon: <Check className="h-3.5 w-3.5" />, color: 'bg-success text-success-foreground' },
  { value: 'absent', label: 'Absent', icon: <X className="h-3.5 w-3.5" />, color: 'bg-destructive text-destructive-foreground' },
  { value: 'late', label: 'Late', icon: <Clock className="h-3.5 w-3.5" />, color: 'bg-warning text-warning-foreground' },
  { value: 'cancelled_by_teacher', label: 'Teacher', icon: <AlertCircle className="h-3.5 w-3.5" />, color: 'bg-muted text-muted-foreground' },
  { value: 'cancelled_by_student', label: 'Student', icon: <AlertCircle className="h-3.5 w-3.5" />, color: 'bg-muted text-muted-foreground' },
];

export function LessonDetailSidePanel({
  lesson,
  open,
  onClose,
  onEdit,
  onMarkAttendance,
  onUpdated,
  teacherColour,
}: LessonDetailSidePanelProps) {
  const { currentOrg } = useOrg();
  const { user } = useAuth();
  const updateAttendance = useUpdateAttendance();
  const [savingAttendance, setSavingAttendance] = useState<string | null>(null);

  const handleAttendanceChange = useCallback(async (studentId: string, status: AttendanceStatus) => {
    if (!currentOrg || !user || !lesson) return;
    setSavingAttendance(studentId);
    try {
      await updateAttendance.mutateAsync({
        lessonId: lesson.id,
        studentId,
        status,
      });
    } finally {
      setSavingAttendance(null);
    }
  }, [currentOrg, user, lesson, updateAttendance]);

  const getStudentAttendance = useCallback((studentId: string): AttendanceStatus | null => {
    return lesson?.attendance?.find(a => a.student_id === studentId)?.attendance_status || null;
  }, [lesson]);

  if (!lesson) return null;

  const startTime = parseISO(lesson.start_at);
  const endTime = parseISO(lesson.end_at);
  const duration = differenceInMinutes(endTime, startTime);

  const studentNames = lesson?.participants?.map(
    (p) => `${p.student.first_name} ${p.student.last_name}`
  ) ?? [];

  const primaryStudentName = studentNames[0] || lesson?.title || 'Untitled Lesson';
  const statusInfo = lesson ? STATUS_STYLES[lesson.status] || STATUS_STYLES.scheduled : STATUS_STYLES.scheduled;
  const teacherName = lesson?.teacher?.full_name || lesson?.teacher?.email || 'Unknown';
  const teacherInitials = teacherName.split(' ').slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');
  const recurrenceLabel = lesson?.recurrence_id ? 'Recurring lesson' : null;
  const isCancelled = lesson?.status === 'cancelled';

  return (
    <div
      className={cn(
        'shrink-0 border-l bg-background shadow-lg overflow-y-auto transition-all duration-200 ease-out',
        open ? 'w-80 xl:w-96 opacity-100' : 'w-0 opacity-0 border-0 overflow-hidden p-0'
      )}
    >
      {lesson && (
        <div className="p-4 space-y-4 animate-scale-fade">
          {/* Header */}
          <div className="space-y-1.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-bold text-foreground truncate">{primaryStudentName}</h2>
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
            <Badge className={cn('text-micro', statusInfo.className)}>{statusInfo.label}</Badge>
          </div>

          <Separator />

          {/* Detail rows */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex items-center gap-2 text-sm">
                <span className="tabular-nums text-foreground">
                  {format(startTime, 'HH:mm')} – {format(endTime, 'HH:mm')}
                </span>
                <Badge variant="secondary" className="text-micro px-1.5 py-0">{duration} min</Badge>
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
                  {lesson.location.name}{lesson.location.is_archived && <span className="text-muted-foreground"> (Archived)</span>}
                  {lesson.room && <span className="text-muted-foreground"> · {lesson.room.name}</span>}
                </span>
              </div>
            )}

            {recurrenceLabel && (
              <div className="flex items-center gap-3">
                <Repeat className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm text-muted-foreground">{recurrenceLabel}</span>
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
              </div>
            </>
          )}

          {/* Inline Attendance */}
          {!isCancelled && lesson.participants && lesson.participants.length > 0 && (
            <>
              <Separator />
              <div>
                <h3 className="font-semibold mb-2 text-sm">Attendance</h3>
                <div className="space-y-3">
                  {lesson.participants.map((p) => {
                    const currentStatus = getStudentAttendance(p.student.id);
                    return (
                      <div key={p.id} className="space-y-1.5">
                        <div className="font-medium text-sm text-foreground">
                          {p.student.first_name} {p.student.last_name}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {ATTENDANCE_OPTIONS.map((option) => (
                            <Button
                              key={option.value}
                              size="sm"
                              variant={currentStatus === option.value ? 'default' : 'outline'}
                              className={cn(
                                'h-7 text-micro px-1.5 gap-0.5',
                                currentStatus === option.value ? option.color : ''
                              )}
                              onClick={() => handleAttendanceChange(p.student.id, option.value)}
                              disabled={savingAttendance === p.student.id}
                            >
                              {savingAttendance === p.student.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <>
                                  {option.icon}
                                  <span className="truncate">{option.label}</span>
                                </>
                              )}
                            </Button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          <Separator />

          {/* Quick actions */}
          <div className="space-y-2">
            <Button onClick={() => onEdit(lesson)} className="w-full gap-2" disabled={isCancelled}>
              <Edit2 className="h-4 w-4" />
              Edit Lesson
            </Button>

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
