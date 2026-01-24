// Re-export from RecurringActionDialog for backward compatibility
import { RecurringActionDialog, RecurringActionMode } from './RecurringActionDialog';

export type RecurringEditMode = RecurringActionMode;

interface RecurringEditDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (mode: RecurringEditMode) => void;
}

export function RecurringEditDialog({ open, onClose, onSelect }: RecurringEditDialogProps) {
  return (
    <RecurringActionDialog
      open={open}
      onClose={onClose}
      onSelect={onSelect}
      action="edit"
    />
  );
}
