import { useState } from 'react';
import { format } from 'date-fns';
import { RegisterLesson, useUpdateAttendance, useMarkLessonComplete, AttendanceStatus } from '@/hooks/useRegisterData';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { 
  Check, 
  X, 
  Clock, 
  ChevronDown, 
  MapPin, 
  CheckCircle2,
  Loader2,
  StickyNote,
  Ban,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AbsenceReasonPicker, needsAbsenceReason, type AbsenceReasonValue } from './AbsenceReasonPicker';

interface RegisterRowProps {
  lesson: RegisterLesson;
}

const statusConfig: Record<AttendanceStatus, { icon: typeof Check; label: string; shortLabel: string; className: string }> = {
  present: { icon: Check, label: 'Present', shortLabel: 'Present', className: 'bg-success/10 text-success border-success/20 hover:bg-success/20' },
  absent: { icon: X, label: 'Absent', shortLabel: 'Absent', className: 'bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/20' },
  late: { icon: Clock, label: 'Late', shortLabel: 'Late', className: 'bg-warning/10 text-warning border-warning/20 hover:bg-warning/20' },
  cancelled_by_teacher: { icon: Ban, label: 'Cxl (Teacher)', shortLabel: 'Cxl (T)', className: 'bg-muted text-muted-foreground border-muted-foreground/20 hover:bg-muted/80' },
  cancelled_by_student: { icon: Ban, label: 'Cxl (Student)', shortLabel: 'Cxl (S)', className: 'bg-muted text-muted-foreground border-muted-foreground/20 hover:bg-muted/80' },
};

const primaryStatuses: AttendanceStatus[] = ['present', 'absent', 'late'];
const cancellationStatuses: AttendanceStatus[] = ['cancelled_by_teacher', 'cancelled_by_student'];

export function RegisterRow({ lesson }: RegisterRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [savingStudent, setSavingStudent] = useState<string | null>(null);
  const updateAttendance = useUpdateAttendance();
  const markComplete = useMarkLessonComplete();
  const { toast } = useToast();

  const timeDisplay = `${format(new Date(lesson.start_at), 'HH:mm')} - ${format(new Date(lesson.end_at), 'HH:mm')}`;
  const isCompleted = lesson.status === 'completed';
  const isCancelled = lesson.status === 'cancelled';
  const allMarked = lesson.participants.every(p => p.attendance_status !== null);

  // Track per-student absence reason & notified date locally
  const [absenceReasons, setAbsenceReasons] = useState<Record<string, AbsenceReasonValue | null>>({});
  const [notifiedDates, setNotifiedDates] = useState<Record<string, Date>>({});

  const handleAttendanceClick = async (studentId: string, status: AttendanceStatus) => {
    const participant = lesson.participants.find(p => p.student_id === studentId);
    const previousStatus = participant?.attendance_status;

    // Auto-set reason for teacher cancellations
    const autoReason = status === 'cancelled_by_teacher' ? 'teacher_cancelled' as any : undefined;
    
    setSavingStudent(studentId);
    try {
      await updateAttendance.mutateAsync({
        lessonId: lesson.id,
        studentId,
        status,
        absenceReason: autoReason || absenceReasons[studentId] || undefined,
        absenceNotifiedAt: needsAbsenceReason(status)
          ? (notifiedDates[studentId] || new Date()).toISOString()
          : undefined,
      });

      // Show undo toast when overwriting an existing status
      if (previousStatus && previousStatus !== status) {
        const prevLabel = statusConfig[previousStatus]?.label || previousStatus;
        const newLabel = statusConfig[status]?.label || status;
        toast({
          title: 'Attendance updated',
          description: `Changed from ${prevLabel} to ${newLabel}`,
          action: (
            <ToastAction altText="Undo" onClick={() => handleAttendanceClick(studentId, previousStatus)}>
              Undo
            </ToastAction>
          ),
          duration: 5000,
        });
      }
    } finally {
      setSavingStudent(null);
    }
  };

  const handleReasonChange = async (studentId: string, reason: AbsenceReasonValue) => {
    setAbsenceReasons(prev => ({ ...prev, [studentId]: reason }));
    // Immediately persist
    const participant = lesson.participants.find(p => p.student_id === studentId);
    if (participant?.attendance_status) {
      setSavingStudent(studentId);
      try {
        await updateAttendance.mutateAsync({
          lessonId: lesson.id,
          studentId,
          status: participant.attendance_status,
          absenceReason: reason,
          absenceNotifiedAt: (notifiedDates[studentId] || new Date()).toISOString(),
        });
      } finally {
        setSavingStudent(null);
      }
    }
  };

  const handleNotifiedDateChange = async (studentId: string, date: Date) => {
    setNotifiedDates(prev => ({ ...prev, [studentId]: date }));
    const participant = lesson.participants.find(p => p.student_id === studentId);
    if (participant?.attendance_status && absenceReasons[studentId]) {
      setSavingStudent(studentId);
      try {
        await updateAttendance.mutateAsync({
          lessonId: lesson.id,
          studentId,
          status: participant.attendance_status,
          absenceReason: absenceReasons[studentId]!,
          absenceNotifiedAt: date.toISOString(),
        });
      } finally {
        setSavingStudent(null);
      }
    }
  };

  const handleMarkComplete = () => {
    markComplete.mutate(lesson.id);
  };

  const getStatusBadge = () => {
    if (isCancelled) {
      return <Badge variant="outline" className="text-muted-foreground">Cancelled</Badge>;
    }
    if (isCompleted) {
      return <Badge variant="outline" className="text-success border-success/20 bg-success/10">Completed</Badge>;
    }
    if (allMarked) {
      return <Badge variant="outline" className="text-primary border-primary/20 bg-primary/10">Ready</Badge>;
    }
    return <Badge variant="outline">Scheduled</Badge>;
  };

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <div className={cn(
        "rounded-lg border bg-card transition-colors",
        isCompleted && "bg-muted/30",
        isCancelled && "opacity-60"
      )}>
        {/* Main Row */}
        <div className="flex items-center gap-4 p-4">
          {/* Time */}
          <div className="w-28 shrink-0">
            <div className="text-sm font-medium tabular-nums">{timeDisplay}</div>
          </div>

          {/* Lesson Info */}
          <div className="flex-1 min-w-0">
            <div className="font-medium truncate">{lesson.title}</div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {lesson.location_name && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {lesson.location_name}
                  {lesson.room_name && ` • ${lesson.room_name}`}
                </span>
              )}
              <span>
                {lesson.participants.length} student{lesson.participants.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {/* Status Badge */}
          <div className="shrink-0">
            {getStatusBadge()}
          </div>

          {/* Expand Button */}
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="icon" className="shrink-0">
              <ChevronDown className={cn(
                "h-4 w-4 transition-transform",
                isExpanded && "rotate-180"
              )} />
            </Button>
          </CollapsibleTrigger>
        </div>

        {/* Expanded Content */}
        <CollapsibleContent>
          <div className="border-t px-4 py-3 space-y-3">
            {/* Participants */}
            {lesson.participants.map((participant) => {
              const currentStatus = participant.attendance_status;
              const isSaving = savingStudent === participant.student_id;

              return (
                <div key={participant.student_id} className="py-2 border-b last:border-b-0">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{participant.student_name}</span>
                      {needsAbsenceReason(currentStatus) && !participant.absence_reason_category && !absenceReasons[participant.student_id] && (
                        <span title="Absence reason missing" className="text-warning">
                          <AlertCircle className="h-3.5 w-3.5" />
                        </span>
                      )}
                    </div>
                    
                    <div className="flex flex-col items-end gap-1">
                      {isSaving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                      
                      {/* Primary statuses row */}
                      <div className="flex items-center gap-1">
                        {primaryStatuses.map((status) => {
                          const config = statusConfig[status];
                          const isActive = currentStatus === status;
                          const Icon = config.icon;
                          
                          return (
                            <Button
                              key={status}
                              variant="outline"
                              size="sm"
                              disabled={isCancelled || isSaving}
                              onClick={() => handleAttendanceClick(participant.student_id, status)}
                              className={cn(
                                "gap-1.5 transition-colors",
                                isActive && config.className
                              )}
                            >
                              <Icon className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline">{config.label}</span>
                            </Button>
                          );
                        })}
                      </div>

                      {/* Cancellation statuses row */}
                      <div className="flex items-center gap-1">
                        {cancellationStatuses.map((status) => {
                          const config = statusConfig[status];
                          const isActive = currentStatus === status;
                          const Icon = config.icon;
                          
                          return (
                            <Button
                              key={status}
                              variant="outline"
                              size="sm"
                              disabled={isCancelled || isSaving}
                              onClick={() => handleAttendanceClick(participant.student_id, status)}
                              className={cn(
                                "gap-1.5 transition-colors text-xs",
                                isActive && config.className
                              )}
                            >
                              <Icon className="h-3 w-3" />
                              <span className="hidden sm:inline">{config.label}</span>
                              <span className="sm:hidden">{config.shortLabel}</span>
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Absence reason picker — shown for absent / cancelled_by_student */}
                  {needsAbsenceReason(currentStatus) && (
                    <AbsenceReasonPicker
                      reason={(absenceReasons[participant.student_id] ?? participant.absence_reason_category as AbsenceReasonValue) || null}
                      notifiedAt={notifiedDates[participant.student_id] || new Date()}
                      onReasonChange={(r) => handleReasonChange(participant.student_id, r)}
                      onNotifiedAtChange={(d) => handleNotifiedDateChange(participant.student_id, d)}
                    />
                  )}
                </div>
              );
            })}

            {/* Notes Preview */}
            {(lesson.notes_shared || lesson.notes_private) && (
              <div className="pt-2 border-t">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <StickyNote className="h-3.5 w-3.5" />
                  Notes
                </div>
                {lesson.notes_shared && (
                  <p className="text-sm text-muted-foreground">{lesson.notes_shared}</p>
                )}
              </div>
            )}

            {/* Mark Complete Button */}
            {!isCompleted && !isCancelled && (
              <div className="pt-2 border-t flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleMarkComplete}
                  disabled={markComplete.isPending}
                  className="gap-2"
                >
                  {markComplete.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  Mark Complete
                </Button>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
