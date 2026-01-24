import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Repeat, CalendarDays, CalendarRange } from 'lucide-react';

export type RecurringActionMode = 'this_only' | 'this_and_future';

interface RecurringActionDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (mode: RecurringActionMode) => void;
  action: 'edit' | 'cancel' | 'delete';
}

export function RecurringActionDialog({ open, onClose, onSelect, action }: RecurringActionDialogProps) {
  const titles = {
    edit: 'Edit Recurring Lesson',
    cancel: 'Cancel Recurring Lesson',
    delete: 'Delete Recurring Lesson',
  };

  const descriptions = {
    edit: 'This lesson is part of a recurring series. How would you like to apply your changes?',
    cancel: 'This lesson is part of a recurring series. Which lessons would you like to cancel?',
    delete: 'This lesson is part of a recurring series. Which lessons would you like to delete?',
  };

  const thisOnlyLabels = {
    edit: 'Only edit this specific occurrence',
    cancel: 'Only cancel this specific lesson',
    delete: 'Only delete this specific lesson',
  };

  const futureLabels = {
    edit: 'Apply changes to this and all upcoming lessons in the series',
    cancel: 'Cancel this and all future lessons in the series',
    delete: 'Delete this and all future lessons in the series',
  };

  return (
    <AlertDialog open={open} onOpenChange={onClose}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Repeat className="h-5 w-5 text-primary" />
            {titles[action]}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {descriptions[action]}
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <div className="flex flex-col gap-3 py-4">
          <Button
            variant="outline"
            className="justify-start h-auto p-4 text-left"
            onClick={() => onSelect('this_only')}
          >
            <CalendarDays className="h-5 w-5 mr-3 flex-shrink-0 text-muted-foreground" />
            <div>
              <div className="font-medium">This lesson only</div>
              <div className="text-sm text-muted-foreground font-normal">
                {thisOnlyLabels[action]}
              </div>
            </div>
          </Button>
          
          <Button
            variant="outline"
            className="justify-start h-auto p-4 text-left border-destructive/50 hover:border-destructive hover:bg-destructive/5"
            onClick={() => onSelect('this_and_future')}
          >
            <CalendarRange className="h-5 w-5 mr-3 flex-shrink-0 text-destructive" />
            <div>
              <div className="font-medium">This and all future lessons</div>
              <div className="text-sm text-muted-foreground font-normal">
                {futureLabels[action]}
              </div>
            </div>
          </Button>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}