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
  AlertCircle,
  FileText
} from 'lucide-react';
import { LessonNotesForm } from '@/components/calendar/LessonNotesForm';
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
  const [showNotesForm, setShowNotesForm] = useState(false);
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
    const autoReason = status === 'cancelled_by_teacher' ? 'teacher_cancelled' : undefined;
    
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
        "rounded-xl border bg-card transition-colors",
        isCompleted && "bg-muted/30",
        isCancelled && "opacity-60"
      )}>
        {/* Main Row */}
        <div className="flex flex-wrap items-start gap-3 p-4 sm:flex-nowrap sm:items-center sm:gap-4">
          {/* Time */}
          <div className="w-full shrink-0 sm:w-28">
            <div className="text-sm font-medium tabular-nums">{timeDisplay}</div>
          </div>

          {/* Lesson Info */}
          <div className="flex-1 min-w-0">
            <div className="font-medium truncate">{lesson.title}</div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {lesson.location_name && (
                <span className="flex w-full flex-wrap items-center gap-1 sm:w-auto">
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
            <Button variant="ghost" size="icon" aria-label="Toggle details" className="h-11 w-11 shrink-0 sm:h-9 sm:w-9">
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
              <div
                key={participant.student_id}
                className="group/row rounded-md border-b py-2 last:border-b-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                tabIndex={0}
                role="row"
                aria-label={`${participant.student_name} — ${currentStatus ? statusConfig[currentStatus]?.label ?? 'unmarked' : 'unmarked'}. Press P, A, L, T, or S to set status.`}
                onKeyDown={(e) => {
                  if (isCancelled || isSaving) return;
                  const keyMap: Record<string, AttendanceStatus> = {
                    p: 'present', a: 'absent', l: 'late',
                    t: 'cancelled_by_teacher', s: 'cancelled_by_student',
                  };
                  const status = keyMap[e.key.toLowerCase()];
                  if (status) {
                    e.preventDefault();
                    handleAttendanceClick(participant.student_id, status);
                  }
                }}
              >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                     <div className="flex flex-wrap items-center gap-2">
                       <span className="font-medium">{participant.student_name}</span>
                       <span className="hidden group-focus-visible/row:inline text-micro text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">P / A / L / T / S</span>
                      {needsAbsenceReason(currentStatus) && !participant.absence_reason_category && !absenceReasons[participant.student_id] && (
                        <span title="Absence reason missing" className="text-warning">
                          <AlertCircle className="h-3.5 w-3.5" />
                        </span>
                      )}
                    </div>
                    
                    <div className="flex w-full flex-col items-start gap-1 sm:w-auto sm:items-end">
                      {isSaving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                      
                      {/* Primary statuses row */}
                      <div className="flex w-full flex-wrap items-center gap-1 sm:w-auto">
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
                                "gap-1.5 transition-colors h-11 px-3 sm:h-8 sm:px-2",
                                isActive && config.className
                              )}
                            >
                              <Icon className="h-3.5 w-3.5" />
                              <span className="sm:hidden">{config.shortLabel}</span>
                              <span className="hidden sm:inline">{config.label}</span>
                            </Button>
                          );
                        })}
                      </div>

                      {/* Cancellation statuses row */}
                      <div className="flex w-full flex-wrap items-center gap-1 sm:w-auto">
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
                                "gap-1.5 transition-colors text-xs h-11 px-3 sm:h-8 sm:px-2",
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
                      reason={(absenceReasons[participant.student_id] ?? (participant.absence_reason_category as AbsenceReasonValue)) || null}
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

            {/* Mark Complete + Add Notes Buttons */}
            {!isCancelled && (
              <div className="pt-2 border-t flex items-center justify-between gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowNotesForm(!showNotesForm)}
                  className="min-h-11 gap-2 sm:min-h-9 text-muted-foreground"
                >
                  <FileText className="h-4 w-4" />
                  {showNotesForm ? 'Hide Notes' : 'Add Notes'}
                </Button>
                {!isCompleted && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleMarkComplete}
                    disabled={markComplete.isPending}
                    className="min-h-11 gap-2 sm:min-h-9"
                  >
                    {markComplete.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    Mark Complete
                  </Button>
                )}
              </div>
            )}

            {/* Structured Notes Form */}
            {showNotesForm && !isCancelled && (
              <div className="pt-2">
                <LessonNotesForm
                  lessonId={lesson.id}
                  participants={lesson.participants.map(p => {
                    const nameParts = p.student_name.split(' ');
                    const firstName = nameParts[0] || '';
                    const lastName = nameParts.slice(1).join(' ') || '';
                    return {
                      id: p.student_id,
                      student: {
                        id: p.student_id,
                        first_name: firstName,
                        last_name: lastName,
                      },
                    };
                  })}
                  isGroupLesson={lesson.participants.length > 1}
                  defaultOpen={true}
                />
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
