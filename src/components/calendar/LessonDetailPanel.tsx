import { useState } from 'react';
import { format, parseISO, differenceInMinutes } from 'date-fns';
import { LessonWithDetails, AttendanceStatus } from './types';
import { useOrg } from '@/contexts/OrgContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Clock, MapPin, User, Users, Edit2, Check, X, AlertCircle, Loader2 } from 'lucide-react';

interface LessonDetailPanelProps {
  lesson: LessonWithDetails | null;
  open: boolean;
  onClose: () => void;
  onEdit: () => void;
  onUpdated: () => void;
}

const ATTENDANCE_OPTIONS: { value: AttendanceStatus; label: string; icon: React.ReactNode; color: string }[] = [
  { value: 'present', label: 'Present', icon: <Check className="h-4 w-4" />, color: 'bg-green-500 text-white' },
  { value: 'absent', label: 'Absent', icon: <X className="h-4 w-4" />, color: 'bg-destructive text-destructive-foreground' },
  { value: 'late', label: 'Late', icon: <Clock className="h-4 w-4" />, color: 'bg-amber-500 text-white' },
  { value: 'cancelled_by_teacher', label: 'Cancelled (Teacher)', icon: <AlertCircle className="h-4 w-4" />, color: 'bg-muted text-muted-foreground' },
  { value: 'cancelled_by_student', label: 'Cancelled (Student)', icon: <AlertCircle className="h-4 w-4" />, color: 'bg-muted text-muted-foreground' },
];

export function LessonDetailPanel({ lesson, open, onClose, onEdit, onUpdated }: LessonDetailPanelProps) {
  const { currentOrg } = useOrg();
  const { user } = useAuth();
  const { toast } = useToast();
  const [savingAttendance, setSavingAttendance] = useState<string | null>(null);

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
    } catch (error: any) {
      toast({ title: 'Error recording attendance', description: error.message, variant: 'destructive' });
    } finally {
      setSavingAttendance(null);
    }
  };

  const getStudentAttendance = (studentId: string): AttendanceStatus | null => {
    return lesson.attendance?.find(a => a.student_id === studentId)?.attendance_status || null;
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

        <div className="mt-6 space-y-6">
          {/* Time & Date */}
          <div className="flex items-center gap-3 text-muted-foreground">
            <Clock className="h-5 w-5" />
            <div>
              <div className="font-medium text-foreground">
                {format(startTime, 'EEEE, d MMMM yyyy')}
              </div>
              <div>
                {format(startTime, 'HH:mm')} – {format(endTime, 'HH:mm')} ({duration} min)
              </div>
            </div>
          </div>

          {/* Teacher */}
          <div className="flex items-center gap-3 text-muted-foreground">
            <User className="h-5 w-5" />
            <div>
              <div className="text-xs uppercase tracking-wide">Teacher</div>
              <div className="font-medium text-foreground">
                {lesson.teacher?.full_name || lesson.teacher?.email || 'Unknown'}
              </div>
            </div>
          </div>

          {/* Location */}
          {lesson.location && (
            <div className="flex items-center gap-3 text-muted-foreground">
              <MapPin className="h-5 w-5" />
              <div>
                <div className="text-xs uppercase tracking-wide">Location</div>
                <div className="font-medium text-foreground">
                  {lesson.location.name}
                  {lesson.room && ` – ${lesson.room.name}`}
                </div>
              </div>
            </div>
          )}

          {/* Students */}
          <div className="flex items-start gap-3 text-muted-foreground">
            <Users className="h-5 w-5 mt-0.5" />
            <div className="flex-1">
              <div className="text-xs uppercase tracking-wide mb-2">
                {lesson.lesson_type === 'group' ? 'Students' : 'Student'}
              </div>
              <div className="space-y-2">
                {lesson.participants?.map((p) => (
                  <div key={p.id} className="text-foreground">
                    {p.student.first_name} {p.student.last_name}
                  </div>
                ))}
                {(!lesson.participants || lesson.participants.length === 0) && (
                  <div className="text-muted-foreground italic">No students assigned</div>
                )}
              </div>
            </div>
          </div>

          <Separator />

          {/* Attendance */}
          <div>
            <h3 className="font-semibold mb-3">Attendance</h3>
            <div className="space-y-3">
              {lesson.participants?.map((p) => {
                const currentStatus = getStudentAttendance(p.student.id);
                return (
                  <div key={p.id} className="space-y-2">
                    <div className="font-medium">{p.student.first_name} {p.student.last_name}</div>
                    <div className="flex flex-wrap gap-1">
                      {ATTENDANCE_OPTIONS.slice(0, 3).map((option) => (
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
                <h3 className="font-semibold mb-2">Lesson Notes (Shared with Parents)</h3>
                <p className="text-muted-foreground text-sm whitespace-pre-wrap bg-muted/50 p-3 rounded-md">{lesson.notes_shared}</p>
              </div>
            </>
          )}

          {/* Private Notes */}
          {lesson.notes_private && (
            <>
              <Separator />
              <div>
                <h3 className="font-semibold mb-2">Private Notes (Staff Only)</h3>
                <p className="text-muted-foreground text-sm whitespace-pre-wrap">{lesson.notes_private}</p>
              </div>
            </>
          )}

          <Separator />

          {/* Actions */}
          <div className="flex gap-2">
            <Button onClick={onEdit} className="flex-1 gap-2">
              <Edit2 className="h-4 w-4" />
              Edit Lesson
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
