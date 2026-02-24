import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useOrg } from '@/contexts/OrgContext';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ABSENCE_REASON_LABELS, type AbsenceReason } from '@/hooks/useMakeUpPolicies';
import { format } from 'date-fns';

interface StudentLesson {
  id: string;
  title: string;
  start_at: string;
  end_at: string;
  teacher: { id: string; display_name: string } | null;
  location: { name: string } | null;
}

const schema = z.object({
  student_id: z.string().min(1, 'Student is required'),
  missed_lesson_id: z.string().min(1, 'Missed lesson is required'),
  absence_reason: z.string().min(1, 'Reason is required'),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface AddToWaitlistDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddToWaitlistDialog({ open, onOpenChange }: AddToWaitlistDialogProps) {
  const { currentOrg } = useOrg();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { absence_reason: 'other' },
  });

  const selectedStudentId = watch('student_id');

  const { data: students } = useQuery({
    queryKey: ['students_for_waitlist', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg?.id) return [];
      const { data, error } = await supabase
        .from('students')
        .select('id, first_name, last_name')
        .eq('org_id', currentOrg.id)
        .eq('status', 'active')
        .order('first_name');
      if (error) throw error;
      return data;
    },
    enabled: !!currentOrg?.id && open,
  });

  // Fetch recent lessons for the selected student
  const { data: studentLessons, isLoading: lessonsLoading } = useQuery({
    queryKey: ['student_lessons_for_waitlist', currentOrg?.id, selectedStudentId],
    queryFn: async () => {
      if (!currentOrg?.id || !selectedStudentId) return [];
      const { data, error } = await supabase
        .from('lesson_participants')
        .select(`
          lesson_id,
          lesson:lessons!inner (
            id, title, start_at, end_at,
            teacher:teachers!lessons_teacher_id_fkey (id, display_name),
            location:locations!lessons_location_id_fkey (name)
          )
        `)
        .eq('student_id', selectedStudentId)
        .eq('lesson.org_id', currentOrg.id)
        .order('lesson(start_at)', { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data || []).map((row: Record<string, unknown>) => row.lesson).filter(Boolean) as StudentLesson[];
    },
    enabled: !!currentOrg?.id && !!selectedStudentId && open,
  });

  const selectedLesson = studentLessons?.find((l) => l.id === watch('missed_lesson_id'));

  const onSubmit = async (formData: FormData) => {
    if (!currentOrg?.id || !selectedLesson) return;
    setIsSubmitting(true);
    try {
      const durationMs = new Date(selectedLesson.end_at).getTime() - new Date(selectedLesson.start_at).getTime();
      const durationMins = Math.round(durationMs / 60000);

      const { error } = await supabase
        .from('make_up_waitlist')
        .insert({
          org_id: currentOrg.id,
          student_id: formData.student_id,
          missed_lesson_id: formData.missed_lesson_id,
          missed_lesson_date: selectedLesson.start_at.split('T')[0],
          lesson_title: selectedLesson.title,
          lesson_duration_minutes: durationMins,
          teacher_id: selectedLesson.teacher?.id || null,
          location_id: null,
          absence_reason: formData.absence_reason as AbsenceReason,
          notes: formData.notes || null,
          status: 'waiting',
        });

      if (error) throw error;

      toast({ title: 'Added to waitlist' });
      queryClient.invalidateQueries({ queryKey: ['make_up_waitlist'] });
      reset();
      onOpenChange(false);
    } catch (err: unknown) {
      toast({ title: 'Failed to add to waitlist', description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStudentChange = (v: string) => {
    setValue('student_id', v);
    setValue('missed_lesson_id', '');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-screen w-screen max-w-none overflow-y-auto rounded-none border-0 p-4 sm:h-auto sm:max-w-md sm:rounded-lg sm:border sm:p-6">
        <DialogHeader>
          <DialogTitle>Add to Waitlist</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Student</Label>
            <Select onValueChange={handleStudentChange} value={watch('student_id')}>
              <SelectTrigger className="min-h-11 sm:min-h-9">
                <SelectValue placeholder="Select student" />
              </SelectTrigger>
              <SelectContent>
                {students?.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.first_name} {s.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.student_id && <p className="text-xs text-destructive">{errors.student_id.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Missed Lesson</Label>
            {selectedStudentId ? (
              lessonsLoading ? (
                <p className="text-sm text-muted-foreground">Loading lessons…</p>
              ) : studentLessons && studentLessons.length > 0 ? (
                <Select onValueChange={(v) => setValue('missed_lesson_id', v)} value={watch('missed_lesson_id')}>
                  <SelectTrigger className="min-h-11 sm:min-h-9">
                    <SelectValue placeholder="Select missed lesson" />
                  </SelectTrigger>
                  <SelectContent>
                    {studentLessons.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.title} — {format(new Date(l.start_at), 'dd/MM/yyyy HH:mm')}
                        {l.teacher?.display_name ? ` (${l.teacher.display_name})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm text-muted-foreground">No lessons found for this student</p>
              )
            ) : (
              <p className="text-sm text-muted-foreground">Select a student first</p>
            )}
            {errors.missed_lesson_id && <p className="text-xs text-destructive">{errors.missed_lesson_id.message}</p>}
          </div>

          {selectedLesson && (
            <div className="rounded-md bg-muted p-3 text-sm space-y-1">
              <p><span className="text-muted-foreground">Title:</span> {selectedLesson.title}</p>
              <p><span className="text-muted-foreground">Date:</span> {format(new Date(selectedLesson.start_at), 'dd/MM/yyyy')}</p>
              <p><span className="text-muted-foreground">Duration:</span> {Math.round((new Date(selectedLesson.end_at).getTime() - new Date(selectedLesson.start_at).getTime()) / 60000)} mins</p>
              {selectedLesson.teacher?.display_name && (
                <p><span className="text-muted-foreground">Teacher:</span> {selectedLesson.teacher.display_name}</p>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Absence Reason</Label>
            <Select onValueChange={(v) => setValue('absence_reason', v)} value={watch('absence_reason')}>
              <SelectTrigger className="min-h-11 sm:min-h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ABSENCE_REASON_LABELS).map(([value, { emoji, label }]) => (
                  <SelectItem key={value} value={value}>
                    {emoji} {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Notes (optional)</Label>
            <Textarea {...register('notes')} placeholder="Admin notes…" rows={2} />
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button type="button" variant="outline" className="min-h-11 w-full sm:min-h-9 sm:w-auto" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" className="min-h-11 w-full sm:min-h-9 sm:w-auto" disabled={isSubmitting || !selectedLesson}>
              {isSubmitting ? 'Adding…' : 'Add to Waitlist'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
