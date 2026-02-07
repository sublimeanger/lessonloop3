import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <div className="bg-primary/5 border-b border-border px-6 pt-6 pb-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5 text-lg">
              <div className="flex items-center justify-center h-9 w-9 rounded-full bg-primary/10">
                <Repeat className="h-4.5 w-4.5 text-primary" />
              </div>
              {titles[action]}
            </DialogTitle>
            <DialogDescription className="mt-2 text-muted-foreground">
              {descriptions[action]}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="flex flex-col gap-3 px-6 py-5">
          <button
            className="group flex items-start gap-4 rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-primary/40 hover:bg-accent/50 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => onSelect('this_only')}
          >
            <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-muted shrink-0 transition-colors group-hover:bg-primary/10">
              <CalendarDays className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-primary" />
            </div>
            <div className="space-y-0.5">
              <div className="font-semibold text-foreground">This lesson only</div>
              <div className="text-sm text-muted-foreground leading-snug">
                {thisOnlyLabels[action]}
              </div>
            </div>
          </button>

          <button
            className="group flex items-start gap-4 rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-destructive/40 hover:bg-destructive/5 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => onSelect('this_and_future')}
          >
            <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-muted shrink-0 transition-colors group-hover:bg-destructive/10">
              <CalendarRange className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-destructive" />
            </div>
            <div className="space-y-0.5">
              <div className="font-semibold text-foreground">This and all future lessons</div>
              <div className="text-sm text-muted-foreground leading-snug">
                {futureLabels[action]}
              </div>
            </div>
          </button>
        </div>

        <DialogFooter className="border-t border-border px-6 py-4 bg-muted/30">
          <Button variant="ghost" onClick={onClose} className="w-full sm:w-auto">
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}