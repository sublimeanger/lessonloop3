import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Repeat, CalendarDays, CalendarRange } from 'lucide-react';

export type RecurringEditMode = 'this_only' | 'this_and_future';

interface RecurringEditDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (mode: RecurringEditMode) => void;
}

export function RecurringEditDialog({ open, onClose, onSelect }: RecurringEditDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onClose}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Repeat className="h-5 w-5 text-primary" />
            Edit Recurring Lesson
          </AlertDialogTitle>
          <AlertDialogDescription>
            This lesson is part of a recurring series. How would you like to apply your changes?
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
                Only edit this specific occurrence
              </div>
            </div>
          </Button>
          
          <Button
            variant="outline"
            className="justify-start h-auto p-4 text-left"
            onClick={() => onSelect('this_and_future')}
          >
            <CalendarRange className="h-5 w-5 mr-3 flex-shrink-0 text-muted-foreground" />
            <div>
              <div className="font-medium">This and all future lessons</div>
              <div className="text-sm text-muted-foreground font-normal">
                Apply changes to this and all upcoming lessons in the series
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
