import { useState } from 'react';
import { format, startOfDay, endOfDay, isBefore } from 'date-fns';
import { useOrg } from '@/contexts/OrgContext';
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
    if (!currentOrg || eligibleLessons.length === 0) return;
    
    setIsProcessing(true);
    setConfirmOpen(false);

    try {
      const lessonIds = eligibleLessons.map(l => l.id);
      
      const { error } = await supabase
        .from('lessons')
        .update({ status: 'completed' })
        .in('id', lessonIds);

      if (error) throw error;

      toast({
        title: 'Lessons marked complete',
        description: `${eligibleLessons.length} lesson${eligibleLessons.length > 1 ? 's' : ''} marked as completed.`,
      });
      
      onComplete();
    } catch (error: any) {
      toast({
        title: 'Error marking lessons complete',
        description: error.message,
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
            <AlertDialogDescription>
              This will mark {eligibleLessons.length} past scheduled lesson{eligibleLessons.length > 1 ? 's' : ''} as completed.
              
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
                  <div className="text-muted-foreground text-xs text-center py-1">
                    ...and {eligibleLessons.length - 10} more
                  </div>
                )}
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
