import { useState, useRef, useEffect, useMemo } from 'react';
import { format, parseISO, differenceInMinutes, differenceInHours, eachWeekOfInterval, addWeeks, isAfter, isBefore, getDay } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { LessonWithDetails, AttendanceStatus } from './types';
import { RecurringActionDialog, RecurringActionMode } from './RecurringActionDialog';
import { useOrg } from '@/contexts/OrgContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useMakeUpCredits } from '@/hooks/useMakeUpCredits';
import { useRateCards, findRateForDuration } from '@/hooks/useRateCards';
import { supabase } from '@/integrations/supabase/client';
import { logAudit } from '@/lib/auditLog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Clock, MapPin, User, Users, Edit2, Check, X, AlertCircle, Loader2, Trash2, Ban, Gift, AlertTriangle, CalendarClock, StopCircle, Repeat } from 'lucide-react';

interface LessonDetailPanelProps {
  lesson: LessonWithDetails | null;
  open: boolean;
  onClose: () => void;
  onEdit: () => void;
  onUpdated: () => void;
}

const ATTENDANCE_OPTIONS: { value: AttendanceStatus; label: string; icon: React.ReactNode; color: string }[] = [
  { value: 'present', label: 'Present', icon: <Check className="h-4 w-4" />, color: 'bg-success text-success-foreground' },
  { value: 'absent', label: 'Absent', icon: <X className="h-4 w-4" />, color: 'bg-destructive text-destructive-foreground' },
  { value: 'late', label: 'Late', icon: <Clock className="h-4 w-4" />, color: 'bg-warning text-warning-foreground' },
  { value: 'cancelled_by_teacher', label: 'Cancelled (Teacher)', icon: <AlertCircle className="h-4 w-4" />, color: 'bg-muted text-muted-foreground' },
  { value: 'cancelled_by_student', label: 'Cancelled (Student)', icon: <AlertCircle className="h-4 w-4" />, color: 'bg-muted text-muted-foreground' },
];

export function LessonDetailPanel({ lesson, open, onClose, onEdit, onUpdated }: LessonDetailPanelProps) {
  const { currentOrg } = useOrg();
  const { user } = useAuth();
  const { toast } = useToast();
  const { createCredit, checkCreditEligibility } = useMakeUpCredits();
  const { data: rateCards } = useRateCards();
  const firstActionRef = useRef<HTMLButtonElement>(null);

  // Auto-focus first action button when panel opens
  useEffect(() => {
    if (open && lesson) {
      requestAnimationFrame(() => {
        firstActionRef.current?.focus();
      });
    }
  }, [open, lesson?.id]);
  
  const [savingAttendance, setSavingAttendance] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState(false);
  
  // Recurring action dialog state
  const [recurringDialogOpen, setRecurringDialogOpen] = useState(false);
  const [recurringAction, setRecurringAction] = useState<'cancel' | 'delete'>('cancel');
  
  // Confirm delete dialog (for non-recurring or after mode selection)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [pendingMode, setPendingMode] = useState<RecurringActionMode | null>(null);
  
  // Credit offer dialog state
  const [creditOfferOpen, setCreditOfferOpen] = useState(false);
  const [pendingCreditInfo, setPendingCreditInfo] = useState<{
    studentId: string;
    studentName: string;
    creditValue: number;
    hoursNotice: number;
  } | null>(null);

  // Cancellation confirmation with reason
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');
  const [cancelMode, setCancelMode] = useState<RecurringActionMode>('this_only');

  // Fetch recurrence rule details
  const { data: recurrenceRule } = useQuery({
    queryKey: ['recurrence-rule', lesson?.recurrence_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recurrence_rules')
        .select('days_of_week, end_date, interval_weeks, start_date')
        .eq('id', lesson!.recurrence_id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!lesson?.recurrence_id,
    staleTime: 5 * 60_000,
  });

  const recurrenceDescription = useMemo(() => {
    if (!recurrenceRule) return null;
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const days = (recurrenceRule.days_of_week || []).sort().map(d => dayNames[d]).join(', ');
    const freq = recurrenceRule.interval_weeks === 1 ? 'Weekly' : `Every ${recurrenceRule.interval_weeks} weeks`;
    const endDate = recurrenceRule.end_date ? format(parseISO(recurrenceRule.end_date), 'd MMM yyyy') : null;

    // Count remaining lessons
    let remaining: number | null = null;
    if (recurrenceRule.end_date && recurrenceRule.days_of_week?.length) {
      const now = new Date();
      const end = parseISO(recurrenceRule.end_date);
      const daysSet = new Set(recurrenceRule.days_of_week as number[]);
      let count = 0;
      let current = now;
      while (isBefore(current, end)) {
        if (daysSet.has(getDay(current))) count++;
        current = new Date(current.getTime() + 86400000);
      }
      remaining = Math.max(0, Math.ceil(count / (recurrenceRule.interval_weeks || 1)));
    }

    let desc = `${freq} on ${days}`;
    if (endDate) desc += ` · Until ${endDate}`;
    if (remaining !== null) desc += ` · ${remaining} remaining`;
    return desc;
  }, [recurrenceRule]);

  if (!lesson) return null;

  const startTime = parseISO(lesson.start_at);
  const endTime = parseISO(lesson.end_at);
  const duration = differenceInMinutes(endTime, startTime);

  const statusColors = {
    scheduled: 'bg-primary/10 text-primary',
    completed: 'bg-green-500/10 text-green-700',
    cancelled: 'bg-muted text-muted-foreground',
  };

  const handleAttendanceChange = async (studentId: string, status: AttendanceStatus) => {
    if (!currentOrg || !user) return;
    
    setSavingAttendance(studentId);

    try {
      // Check if attendance record exists
      const existing = lesson.attendance?.find(a => a.student_id === studentId);

      if (existing) {
        // Update existing
        await supabase
          .from('attendance_records')
          .update({ 
            attendance_status: status,
            recorded_by: user.id,
            recorded_at: new Date().toISOString(),
          })
          .eq('lesson_id', lesson.id)
          .eq('student_id', studentId);
      } else {
        // Create new
        await supabase
          .from('attendance_records')
          .insert({
            org_id: currentOrg.id,
            lesson_id: lesson.id,
            student_id: studentId,
            attendance_status: status,
            recorded_by: user.id,
          });
      }

      onUpdated();
      toast({ title: 'Attendance recorded' });
      
      // Check for make-up credit eligibility on student cancellation
      if (status === 'cancelled_by_student') {
        const eligibility = await checkCreditEligibility(lesson.start_at);
        
        if (eligibility.eligible) {
          // Find student name for the dialog
          const participant = lesson.participants?.find(p => p.student.id === studentId);
          const studentName = participant 
            ? `${participant.student.first_name} ${participant.student.last_name}`
            : 'Student';
          
          // Calculate credit value based on lesson duration and rate cards
          const creditValue = findRateForDuration(duration, rateCards || []);
          
          setPendingCreditInfo({
            studentId,
            studentName,
            creditValue,
            hoursNotice: eligibility.hoursNotice,
          });
          setCreditOfferOpen(true);
        }
      }
    } catch (error: any) {
      toast({ title: 'Error recording attendance', description: error.message, variant: 'destructive' });
    } finally {
      setSavingAttendance(null);
    }
  };

  const getStudentAttendance = (studentId: string): AttendanceStatus | null => {
    return lesson.attendance?.find(a => a.student_id === studentId)?.attendance_status || null;
  };

  const isRecurring = !!lesson.recurrence_id;

  // Calculate hours until lesson for late cancellation warning
  const hoursUntilLesson = differenceInHours(startTime, new Date());
  const cancellationNoticeHours = (currentOrg as any)?.cancellation_notice_hours || 24;
  const isLateCancellation = hoursUntilLesson < cancellationNoticeHours && hoursUntilLesson >= 0;

  const handleCancelClick = () => {
    if (isRecurring) {
      setRecurringAction('cancel');
      setRecurringDialogOpen(true);
    } else {
      // Show cancel confirmation dialog with reason input
      setCancelMode('this_only');
      setCancelDialogOpen(true);
    }
  };

  const handleDeleteClick = () => {
    if (isRecurring) {
      setRecurringAction('delete');
      setRecurringDialogOpen(true);
    } else {
      setConfirmDeleteOpen(true);
    }
  };

  const handleRecurringSelect = (mode: RecurringActionMode) => {
    setRecurringDialogOpen(false);
    if (recurringAction === 'cancel') {
      // Show cancel confirmation dialog with reason input
      setCancelMode(mode);
      setCancelDialogOpen(true);
    } else {
      setPendingMode(mode);
      setConfirmDeleteOpen(true);
    }
  };

  const performCancel = async () => {
    if (!lesson || !user) return;
    setActionInProgress(true);
    setCancelDialogOpen(false);

    try {
      const cancelData = {
        status: 'cancelled' as const,
        cancellation_reason: cancellationReason || null,
        cancelled_by: user.id,
        cancelled_at: new Date().toISOString(),
      };

      if (cancelMode === 'this_only') {
        // Cancel just this lesson
        const { error } = await supabase
          .from('lessons')
          .update(cancelData)
          .eq('id', lesson.id);
        if (error) throw error;
        logAudit(currentOrg!.id, user.id, 'cancel', 'lesson', lesson.id, {
          after: { reason: cancellationReason || null },
        });
        toast({ title: 'Lesson cancelled' });
      } else {
        // Cancel this and all future lessons in series
        const { error } = await supabase
          .from('lessons')
          .update(cancelData)
          .eq('recurrence_id', lesson.recurrence_id)
          .gte('start_at', lesson.start_at);
        if (error) throw error;
        logAudit(currentOrg!.id, user.id, 'cancel', 'lesson', lesson.id, {
          after: { reason: cancellationReason || null, scope: 'this_and_future' },
        });
        toast({ title: 'Series cancelled', description: 'This and all future lessons have been cancelled.' });
      }
      setCancellationReason('');
      onUpdated();
      onClose();
    } catch (error: any) {
      toast({ title: 'Error cancelling lesson', description: error.message, variant: 'destructive' });
    } finally {
      setActionInProgress(false);
    }
  };

  const performDelete = async () => {
    if (!lesson) return;
    setActionInProgress(true);
    setConfirmDeleteOpen(false);

    const mode = pendingMode || 'this_only';

    try {
      if (mode === 'this_only' || !isRecurring) {
        // Delete just this lesson
        const { error } = await supabase
          .from('lessons')
          .delete()
          .eq('id', lesson.id);
        if (error) throw error;
        logAudit(currentOrg!.id, user!.id, 'delete', 'lesson', lesson.id, {
          before: { title: lesson.title, start_at: lesson.start_at },
        });
        toast({ title: 'Lesson deleted' });
      } else {
        // Delete this and all future lessons in series
        const { error } = await supabase
          .from('lessons')
          .delete()
          .eq('recurrence_id', lesson.recurrence_id)
          .gte('start_at', lesson.start_at);
        if (error) throw error;
        logAudit(currentOrg!.id, user!.id, 'delete', 'lesson', lesson.id, {
          before: { title: lesson.title, start_at: lesson.start_at, scope: 'this_and_future' },
        });
        toast({ title: 'Series deleted', description: 'This and all future lessons have been deleted.' });
      }
      onUpdated();
      onClose();
    } catch (error: any) {
      toast({ title: 'Error deleting lesson', description: error.message, variant: 'destructive' });
    } finally {
      setActionInProgress(false);
      setPendingMode(null);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader className="space-y-1">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-xl">{lesson.title}</SheetTitle>
            <Badge className={statusColors[lesson.status]}>{lesson.status}</Badge>
          </div>
        </SheetHeader>

        <div className="mt-4 space-y-5">
          {/* Quick Actions - prominent, right at the top */}
          {lesson.status !== 'cancelled' && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <Button ref={firstActionRef} onClick={onEdit} variant="outline" className="gap-2" disabled={actionInProgress}>
                  <CalendarClock className="h-4 w-4" />
                  Reschedule
                </Button>
                <Button 
                  variant="outline"
                  onClick={handleCancelClick} 
                  className="gap-2 border-warning/50 text-warning hover:bg-warning/10 hover:text-warning"
                  disabled={actionInProgress}
                >
                  {actionInProgress ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
                  Cancel
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {isRecurring && (
                  <Button 
                    variant="outline"
                    onClick={() => {
                      setRecurringAction('cancel');
                      setCancelMode('this_and_future');
                      setCancelDialogOpen(true);
                    }}
                    className="gap-2 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    disabled={actionInProgress}
                  >
                    <StopCircle className="h-4 w-4" />
                    End Series
                  </Button>
                )}
                <Button 
                  variant="ghost" 
                  onClick={handleDeleteClick} 
                  className="gap-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  disabled={actionInProgress}
                >
                  {actionInProgress ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  Delete
                </Button>
              </div>
            </div>
          )}

          {lesson.status === 'cancelled' && (
            <div className="flex gap-2">
              <Button onClick={onEdit} variant="outline" className="flex-1 gap-2" disabled={actionInProgress}>
                <Edit2 className="h-4 w-4" />
                Edit
              </Button>
              <Button 
                variant="ghost" 
                onClick={handleDeleteClick} 
                className="flex-1 gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                disabled={actionInProgress}
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            </div>
          )}

          <Separator />

          {/* Time & Date */}
          <div className="flex items-center gap-3 text-muted-foreground">
            <Clock className="h-4 w-4 flex-shrink-0" />
            <div className="text-sm">
              <span className="font-medium text-foreground">
                {format(startTime, 'EEE d MMM')}
              </span>
              {' · '}
              {format(startTime, 'HH:mm')}–{format(endTime, 'HH:mm')} ({duration} min)
            </div>
          </div>

          {/* Teacher */}
          <div className="flex items-center gap-3 text-muted-foreground">
            <User className="h-4 w-4 flex-shrink-0" />
            <span className="text-sm font-medium text-foreground">
              {lesson.teacher?.full_name || lesson.teacher?.email || 'Unknown'}
            </span>
          </div>

          {/* Location */}
          {lesson.location && (
            <div className="flex items-center gap-3 text-muted-foreground">
              <MapPin className="h-4 w-4 flex-shrink-0" />
              <span className="text-sm font-medium text-foreground">
                {lesson.location.name}
                {lesson.room && ` – ${lesson.room.name}`}
              </span>
            </div>
          )}

          {/* Recurrence info */}
          {isRecurring && recurrenceDescription && (
            <div className="flex items-center gap-3 text-muted-foreground">
              <Repeat className="h-4 w-4 flex-shrink-0" />
              <span className="text-sm text-foreground">{recurrenceDescription}</span>
            </div>
          )}

          {/* Students */}
          <div className="flex items-start gap-3 text-muted-foreground">
            <Users className="h-4 mt-0.5 flex-shrink-0" />
            <div className="flex-1 text-sm">
              {lesson.participants?.map((p, i) => (
                <span key={p.id} className="text-foreground">
                  {p.student.first_name} {p.student.last_name}
                  {i < (lesson.participants?.length || 0) - 1 && ', '}
                </span>
              ))}
              {(!lesson.participants || lesson.participants.length === 0) && (
                <span className="text-muted-foreground italic">No students assigned</span>
              )}
            </div>
          </div>

          <Separator />

          {/* Attendance */}
          <div>
            <h3 className="font-semibold mb-3 text-sm">Attendance</h3>
            <div className="space-y-3">
              {lesson.participants?.map((p) => {
                const currentStatus = getStudentAttendance(p.student.id);
                return (
                  <div key={p.id} className="space-y-2">
                    <div className="font-medium text-sm">{p.student.first_name} {p.student.last_name}</div>
                    <div className="grid grid-cols-3 gap-1">
                      {ATTENDANCE_OPTIONS.map((option) => (
                        <Button
                          key={option.value}
                          size="sm"
                          variant={currentStatus === option.value ? 'default' : 'outline'}
                          className={currentStatus === option.value ? option.color : ''}
                          onClick={() => handleAttendanceChange(p.student.id, option.value)}
                          disabled={savingAttendance === p.student.id}
                        >
                          {savingAttendance === p.student.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              {option.icon}
                              <span className="ml-1">{option.label}</span>
                            </>
                          )}
                        </Button>
                      ))}
                    </div>
                  </div>
                );
              })}
              {(!lesson.participants || lesson.participants.length === 0) && (
                <p className="text-muted-foreground text-sm">Add students to record attendance</p>
              )}
            </div>
          </div>

          {/* Shared Notes */}
          {lesson.notes_shared && (
            <>
              <Separator />
              <div>
                <h3 className="font-semibold mb-2 text-sm">Lesson Notes (Shared)</h3>
                <p className="text-muted-foreground text-sm whitespace-pre-wrap bg-muted/50 p-3 rounded-md">{lesson.notes_shared}</p>
              </div>
            </>
          )}

          {/* Private Notes */}
          {lesson.notes_private && (
            <>
              <Separator />
              <div>
                <h3 className="font-semibold mb-2 text-sm">Private Notes (Staff Only)</h3>
                <p className="text-muted-foreground text-sm whitespace-pre-wrap">{lesson.notes_private}</p>
              </div>
            </>
          )}
        </div>
      </SheetContent>

      {/* Recurring Action Dialog */}
      <RecurringActionDialog
        open={recurringDialogOpen}
        onClose={() => setRecurringDialogOpen(false)}
        onSelect={handleRecurringSelect}
        action={recurringAction}
      />

      {/* Cancel Confirmation Dialog with Reason */}
      <Dialog open={cancelDialogOpen} onOpenChange={(open) => {
        setCancelDialogOpen(open);
        if (!open) setCancellationReason('');
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ban className="h-5 w-5" />
              Cancel Lesson
            </DialogTitle>
            <DialogDescription>
              {cancelMode === 'this_and_future' 
                ? 'This will cancel this lesson and all future lessons in the series.'
                : 'This will mark the lesson as cancelled.'}
            </DialogDescription>
          </DialogHeader>
          
          {/* Late Cancellation Warning */}
          {isLateCancellation && (
            <div className="flex items-start gap-3 p-3 bg-warning/10 border border-warning/30 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-warning">Late Cancellation Notice</p>
                <p className="text-muted-foreground mt-1">
                  This lesson starts in {hoursUntilLesson} hours. Your policy requires {cancellationNoticeHours} hours notice.
                  Students may not receive a make-up credit for late cancellations.
                </p>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="cancellation-reason">Cancellation Reason (optional)</Label>
            <Textarea
              id="cancellation-reason"
              placeholder="e.g., Student illness, teacher unavailable, weather..."
              value={cancellationReason}
              onChange={(e) => setCancellationReason(e.target.value)}
              rows={2}
            />
            <p className="text-xs text-muted-foreground">This will be recorded for your records and can be viewed in the audit log.</p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>
              Keep Lesson
            </Button>
            <Button
              variant="destructive"
              onClick={performCancel}
              disabled={actionInProgress}
            >
              {actionInProgress ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Ban className="h-4 w-4 mr-2" />}
              Cancel Lesson
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Delete Dialog */}
      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Lesson</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingMode === 'this_and_future' 
                ? 'This will permanently delete this lesson and all future lessons in the series. This action cannot be undone.'
                : 'This will permanently delete this lesson. This action cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingMode(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={performDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Credit Offer Dialog */}
      <Dialog open={creditOfferOpen} onOpenChange={setCreditOfferOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-primary" />
              Issue Make-Up Credit?
            </DialogTitle>
            <DialogDescription>
              {pendingCreditInfo && (
                <>
                  <strong>{pendingCreditInfo.studentName}</strong> cancelled with{' '}
                  <strong>{pendingCreditInfo.hoursNotice} hours</strong> notice, 
                  which meets your cancellation policy.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              Would you like to issue a make-up credit for the value of this lesson?
            </p>
            {pendingCreditInfo && (
              <div className="mt-3 p-3 bg-primary/5 rounded-lg">
                <p className="text-lg font-semibold text-primary">
                  {new Intl.NumberFormat('en-GB', {
                    style: 'currency',
                    currency: currentOrg?.currency_code || 'GBP',
                  }).format(pendingCreditInfo.creditValue / 100)}
                </p>
                <p className="text-xs text-muted-foreground">Credit expires in 3 months</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setCreditOfferOpen(false);
                setPendingCreditInfo(null);
              }}
            >
              Skip
            </Button>
            <Button
              onClick={async () => {
                if (pendingCreditInfo) {
                  await createCredit.mutateAsync({
                    student_id: pendingCreditInfo.studentId,
                    issued_for_lesson_id: lesson.id,
                    credit_value_minor: pendingCreditInfo.creditValue,
                    expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
                    notes: `Auto-issued for cancelled lesson: ${lesson.title}`,
                  });
                  setCreditOfferOpen(false);
                  setPendingCreditInfo(null);
                }
              }}
              disabled={createCredit.isPending}
            >
              {createCredit.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Gift className="h-4 w-4 mr-2" />
              )}
              Issue Credit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sheet>
  );
}
