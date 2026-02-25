import { useState, useMemo, useCallback, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Calendar } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTeachers, type Teacher } from '@/hooks/useTeachers';
import { useOrg } from '@/contexts/OrgContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface BookTrialModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: any;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BookTrialModal({ open, onOpenChange, lead }: BookTrialModalProps) {
  const isMobile = useIsMobile();
  const { currentOrg } = useOrg();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: teachers } = useTeachers();

  const activeTeachers = useMemo(
    () => (teachers || []).filter((t: Teacher) => t.status === 'active'),
    [teachers],
  );

  const students = useMemo(
    () => (lead as any).lead_students || [],
    [lead],
  );

  // Form state
  const [studentId, setStudentId] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('10:00');
  const [durationMins, setDurationMins] = useState('30');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-select when there is only one student
  useEffect(() => {
    if (students.length === 1 && !studentId) {
      setStudentId(students[0].id);
    }
  }, [students, studentId]);

  const selectedStudent = useMemo(
    () => students.find((s: any) => s.id === studentId) || null,
    [students, studentId],
  );

  const canSubmit = useMemo(
    () => studentId && date && time && !isSubmitting,
    [studentId, date, time, isSubmitting],
  );

  const resetForm = useCallback(() => {
    setStudentId('');
    setTeacherId('');
    setDate('');
    setTime('10:00');
    setDurationMins('30');
    setNotes('');
  }, []);

  const handleClose = useCallback(() => {
    onOpenChange(false);
    setTimeout(resetForm, 200);
  }, [onOpenChange, resetForm]);

  const handleBook = useCallback(async () => {
    if (!currentOrg || !user || !canSubmit || !selectedStudent) return;

    setIsSubmitting(true);
    try {
      // Construct start and end times
      const startDateTime = new Date(`${date}T${time}`);
      const endDateTime = new Date(startDateTime.getTime() + parseInt(durationMins, 10) * 60_000);

      // 1. Create the trial lesson
      const { data: lesson, error: lessonError } = await supabase
        .from('lessons')
        .insert({
          org_id: currentOrg.id,
          teacher_id: teacherId || null,
          title: `Trial - ${selectedStudent.first_name}`,
          start_at: startDateTime.toISOString(),
          end_at: endDateTime.toISOString(),
          status: 'scheduled' as const,
          lesson_type: 'trial' as const,
        })
        .select()
        .single();

      if (lessonError) throw lessonError;

      // 2. Update the lead with trial info
      const { error: leadError } = await supabase
        .from('leads')
        .update({
          trial_lesson_id: lesson.id,
          trial_date: startDateTime.toISOString(),
          stage: 'trial_booked' as const,
        })
        .eq('id', lead.id);

      if (leadError) throw leadError;

      // 3. Log a 'trial_booked' activity
      await supabase.from('lead_activities').insert({
        lead_id: lead.id,
        org_id: currentOrg.id,
        activity_type: 'trial_booked',
        description: `Trial lesson booked for ${selectedStudent.first_name}`,
        created_by: user.id,
      });

      // 4. Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['lead'] });
      queryClient.invalidateQueries({ queryKey: ['lead-stage-counts'] });
      queryClient.invalidateQueries({ queryKey: ['lead-activities'] });

      toast({ title: 'Trial lesson booked' });
      handleClose();
    } catch (error) {
      toast({
        title: 'Failed to book trial',
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [currentOrg, user, canSubmit, selectedStudent, date, time, durationMins, teacherId, lead, queryClient, toast, handleClose]);

  // ---------------------------------------------------------------------------
  // Form body
  // ---------------------------------------------------------------------------

  const formBody = (
    <div className="space-y-4 px-1">
      {/* Student */}
      <div className="space-y-1.5">
        <Label>
          Student <span className="text-destructive">*</span>
        </Label>
        {students.length <= 1 ? (
          <Input
            value={selectedStudent ? `${selectedStudent.first_name}${selectedStudent.last_name ? ` ${selectedStudent.last_name}` : ''}` : 'No students on this lead'}
            disabled
          />
        ) : (
          <Select value={studentId} onValueChange={setStudentId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a student" />
            </SelectTrigger>
            <SelectContent>
              {students.map((s: any) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.first_name}{s.last_name ? ` ${s.last_name}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Teacher */}
      <div className="space-y-1.5">
        <Label>Teacher</Label>
        <Select value={teacherId} onValueChange={setTeacherId}>
          <SelectTrigger>
            <SelectValue placeholder="Select a teacher (optional)" />
          </SelectTrigger>
          <SelectContent>
            {activeTeachers.map((teacher: Teacher) => (
              <SelectItem key={teacher.id} value={teacher.id}>
                {teacher.display_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Date and Time */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>
            Date <span className="text-destructive">*</span>
          </Label>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            min={new Date().toISOString().slice(0, 10)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>
            Time <span className="text-destructive">*</span>
          </Label>
          <Input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </div>
      </div>

      {/* Duration */}
      <div className="space-y-1.5">
        <Label>Duration</Label>
        <Select value={durationMins} onValueChange={setDurationMins}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="15">15 minutes</SelectItem>
            <SelectItem value="30">30 minutes</SelectItem>
            <SelectItem value="45">45 minutes</SelectItem>
            <SelectItem value="60">60 minutes</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Notes */}
      <div className="space-y-1.5">
        <Label>Notes</Label>
        <Textarea
          placeholder="Any additional notes..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
        />
      </div>
    </div>
  );

  const footer = (
    <>
      <Button variant="outline" onClick={handleClose} className="min-h-[44px]">
        Cancel
      </Button>
      <Button
        onClick={handleBook}
        disabled={!canSubmit}
        className="min-h-[44px] gap-1"
      >
        {isSubmitting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Calendar className="h-4 w-4" />
        )}
        Book Trial
      </Button>
    </>
  );

  // ---------------------------------------------------------------------------
  // Responsive rendering
  // ---------------------------------------------------------------------------

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
        <DrawerContent className="max-h-[92vh]">
          <DrawerHeader>
            <DrawerTitle>Book Trial Lesson</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-2">{formBody}</div>
          <DrawerFooter className="flex-row justify-end gap-2">
            {footer}
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Book Trial Lesson</DialogTitle>
        </DialogHeader>
        {formBody}
        <DialogFooter>{footer}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
