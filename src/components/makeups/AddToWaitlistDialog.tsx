import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useOrg } from '@/contexts/OrgContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const schema = z.object({
  student_id: z.string().min(1, 'Student is required'),
  lesson_title: z.string().min(1, 'Lesson title is required'),
  missed_lesson_date: z.string().min(1, 'Date is required'),
  lesson_duration_minutes: z.coerce.number().min(15),
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
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { lesson_duration_minutes: 30, absence_reason: 'other' },
  });

  const onSubmit = async (formData: FormData) => {
    if (!currentOrg?.id) return;
    setIsSubmitting(true);
    try {
      // We need a valid missed_lesson_id — for manual entries we'll create a placeholder
      // For now, we use a dummy approach: find the latest lesson for the student
      const { data: recentLesson } = await supabase
        .from('lessons')
        .select('id')
        .eq('org_id', currentOrg.id)
        .order('start_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const missedLessonId = recentLesson?.id;
      if (!missedLessonId) {
        toast({ title: 'No lessons found to reference', variant: 'destructive' });
        setIsSubmitting(false);
        return;
      }

      const { error } = await supabase
        .from('make_up_waitlist')
        .insert({
          org_id: currentOrg.id,
          student_id: formData.student_id,
          missed_lesson_id: missedLessonId,
          missed_lesson_date: formData.missed_lesson_date,
          lesson_title: formData.lesson_title,
          lesson_duration_minutes: formData.lesson_duration_minutes,
          absence_reason: formData.absence_reason as any,
          notes: formData.notes || null,
          status: 'waiting',
        });

      if (error) throw error;

      toast({ title: 'Added to waitlist' });
      queryClient.invalidateQueries({ queryKey: ['make_up_waitlist'] });
      reset();
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add to Waitlist</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Student</Label>
            <Select onValueChange={(v) => setValue('student_id', v)} value={watch('student_id')}>
              <SelectTrigger>
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
            <Label>Lesson Title</Label>
            <Input {...register('lesson_title')} placeholder="e.g. Piano - 30min" />
            {errors.lesson_title && <p className="text-xs text-destructive">{errors.lesson_title.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Missed Date</Label>
              <Input type="date" {...register('missed_lesson_date')} />
              {errors.missed_lesson_date && <p className="text-xs text-destructive">{errors.missed_lesson_date.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Duration (mins)</Label>
              <Input type="number" {...register('lesson_duration_minutes')} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Absence Reason</Label>
            <Select onValueChange={(v) => setValue('absence_reason', v)} value={watch('absence_reason')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sick">Sick</SelectItem>
                <SelectItem value="family_emergency">Family Emergency</SelectItem>
                <SelectItem value="school_event">School Event</SelectItem>
                <SelectItem value="holiday">Holiday</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Notes (optional)</Label>
            <Textarea {...register('notes')} placeholder="Admin notes…" rows={2} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Adding…' : 'Add to Waitlist'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
