import { useState } from 'react';
import { format, endOfDay, isBefore } from 'date-fns';
import { useOrg } from '@/contexts/OrgContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { LessonWithDetails } from './types';

interface MarkDayCompleteButtonProps {
  currentDate: Date;
  lessons: LessonWithDetails[];
  onComplete: () => void;
}

export function MarkDayCompleteButton({ currentDate, lessons, onComplete }: MarkDayCompleteButtonProps) {
  const { currentOrg } = useOrg();
  const { user } = useAuth();
  const { toast } = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Find lessons that are scheduled, in the past, and on/before the current date
  const now = new Date();
  const dayEnd = endOfDay(currentDate);
  
  const eligibleLessons = lessons.filter(lesson => {
    const lessonEnd = new Date(lesson.end_at);
    return (
      lesson.status === 'scheduled' &&
      isBefore(lessonEnd, now) &&
      isBefore(lessonEnd, dayEnd)
    );
  });

  const handleMarkComplete = async () => {
    if (!currentOrg || !user || eligibleLessons.length === 0) return;
    
    setIsProcessing(true);
    setConfirmOpen(false);

    try {
      const lessonIds = eligibleLessons.map(l => l.id);
      
      // 1. Mark lessons as completed
      const { error } = await supabase
        .from('lessons')
        .update({ status: 'completed' })
        .in('id', lessonIds);

      if (error) throw error;

      // 2. Fetch participants for these lessons
      const { data: participants } = await supabase
        .from('lesson_participants')
        .select('lesson_id, student_id')
        .in('lesson_id', lessonIds);

      // 3. Check existing attendance records
      const { data: existing } = await supabase
        .from('attendance_records')
        .select('lesson_id, student_id')
        .in('lesson_id', lessonIds);

      const existingSet = new Set(
        (existing || []).map(e => `${e.lesson_id}-${e.student_id}`)
      );

      // 4. Insert 'present' for participants without records
      const newRecords = (participants || [])
        .filter(p => !existingSet.has(`${p.lesson_id}-${p.student_id}`))
        .map(p => ({
          lesson_id: p.lesson_id,
          student_id: p.student_id,
          org_id: currentOrg.id,
          attendance_status: 'present' as const,
          recorded_by: user.id,
        }));

      if (newRecords.length > 0) {
        const { error: attError } = await supabase
          .from('attendance_records')
          .upsert(newRecords, { onConflict: 'lesson_id,student_id' });
        if (attError) throw attError;
      }

      toast({
        title: 'Lessons marked complete',
        description: `${eligibleLessons.length} lesson${eligibleLessons.length > 1 ? 's' : ''} completed with ${newRecords.length} attendance record${newRecords.length !== 1 ? 's' : ''} created.`,
      });
      
      onComplete();
    } catch (error: unknown) {
      toast({
        title: 'Error marking lessons complete',
        description: error instanceof Error ? error.message : "Unknown error",
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (eligibleLessons.length === 0) {
    return null;
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setConfirmOpen(true)}
        disabled={isProcessing}
        className="gap-2"
      >
        {isProcessing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <CheckCircle2 className="h-4 w-4" />
        )}
        Mark Day Complete ({eligibleLessons.length})
      </Button>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark Lessons Complete</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p>This will mark {eligibleLessons.length} past scheduled lesson{eligibleLessons.length > 1 ? 's' : ''} as completed.</p>
                <div className="mt-3 max-h-48 overflow-y-auto space-y-1.5 text-sm">
                  {eligibleLessons.slice(0, 10).map(lesson => (
                    <div key={lesson.id} className="flex justify-between items-center py-1 px-2 bg-muted rounded">
                      <span className="font-medium truncate">{lesson.title}</span>
                      <span className="text-muted-foreground text-xs whitespace-nowrap ml-2">
                        {format(new Date(lesson.start_at), 'HH:mm')}
                      </span>
                    </div>
                  ))}
                  {eligibleLessons.length > 10 && (
                    <p className="text-muted-foreground text-xs text-center py-1">
                      ...and {eligibleLessons.length - 10} more
                    </p>
                  )}
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleMarkComplete} className="gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Mark Complete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
