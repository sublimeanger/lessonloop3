import { useState } from 'react';
import { format } from 'date-fns';
import { RegisterLesson, useUpdateAttendance, useMarkLessonComplete, AttendanceStatus } from '@/hooks/useRegisterData';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Check, 
  X, 
  Clock, 
  ChevronDown, 
  MapPin, 
  CheckCircle2,
  Loader2,
  StickyNote,
  Ban
} from 'lucide-react';
import { cn } from '@/lib/utils';

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

  const timeDisplay = `${format(new Date(lesson.start_at), 'HH:mm')} - ${format(new Date(lesson.end_at), 'HH:mm')}`;
  const isCompleted = lesson.status === 'completed';
  const isCancelled = lesson.status === 'cancelled';
  const allMarked = lesson.participants.every(p => p.attendance_status !== null);

  const handleAttendanceClick = async (studentId: string, status: AttendanceStatus) => {
    setSavingStudent(studentId);
    try {
      await updateAttendance.mutateAsync({
        lessonId: lesson.id,
        studentId,
        status,
      });
    } finally {
      setSavingStudent(null);
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
                <div key={participant.student_id} className="flex items-center justify-between gap-4 py-2">
                  <div className="font-medium">{participant.student_name}</div>
                  
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
