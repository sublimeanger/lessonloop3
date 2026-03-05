import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { X, Edit, Trash2, Loader2 } from 'lucide-react';
import { BulkEditDialog } from './BulkEditDialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import type { BulkEditPayload } from '@/hooks/useBulkLessonActions';

interface BulkSelectBarProps {
  count: number;
  isBulkUpdating: boolean;
  bulkProgress: { done: number; total: number };
  onClear: () => void;
  onExit: () => void;
  onBulkUpdate: (payload: BulkEditPayload) => Promise<void>;
  onBulkCancel: () => Promise<void>;
  teachers: { id: string; name: string }[];
  locations: { id: string; name: string }[];
  rooms: { id: string; name: string; location_id: string }[];
}

export function BulkSelectBar({
  count,
  isBulkUpdating,
  bulkProgress,
  onClear,
  onExit,
  onBulkUpdate,
  onBulkCancel,
  teachers,
  locations,
  rooms,
}: BulkSelectBarProps) {
  const [editOpen, setEditOpen] = useState(false);

  if (count === 0 && !isBulkUpdating) return null;

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-foreground text-background p-3 shadow-elevated flex items-center justify-between gap-3 sm:bottom-4 sm:left-1/2 sm:-translate-x-1/2 sm:w-auto sm:min-w-[420px] sm:max-w-[600px] sm:rounded-xl" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}>
        {isBulkUpdating ? (
          <div className="flex items-center gap-3 flex-1">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm font-medium">
              Updating {bulkProgress.done}/{bulkProgress.total}…
            </span>
            <div className="flex-1 h-1.5 bg-background/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${(bulkProgress.done / bulkProgress.total) * 100}%` }}
              />
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-background hover:text-background/80 hover:bg-background/10" onClick={onExit}>
                <X className="h-4 w-4" />
              </Button>
              <span className="text-sm font-semibold">{count} selected</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Button variant="ghost" size="sm" className="text-background hover:text-background/80 hover:bg-background/10 gap-1.5" onClick={onClear} disabled={count === 0}>
                Clear
              </Button>
              <Button variant="ghost" size="sm" className="text-background hover:text-background/80 hover:bg-background/10 gap-1.5" onClick={() => setEditOpen(true)} disabled={count === 0}>
                <Edit className="h-3.5 w-3.5" />
                Edit
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5" disabled={count === 0}>
                    <Trash2 className="h-3.5 w-3.5" />
                    Cancel All
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancel {count} lessons?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will set all {count} selected lessons to cancelled status. This action can be undone individually.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep</AlertDialogCancel>
                    <AlertDialogAction onClick={onBulkCancel} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Cancel {count} lessons
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </>
        )}
      </div>

      <BulkEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        count={count}
        onSubmit={onBulkUpdate}
        teachers={teachers}
        locations={locations}
        rooms={rooms}
      />
    </>
  );
}
