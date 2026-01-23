import { Button } from '@/components/ui/button';
import { Send, XCircle, X } from 'lucide-react';

interface BulkActionsBarProps {
  selectedCount: number;
  draftCount: number;
  voidableCount: number;
  onBulkSend: () => void;
  onBulkVoid: () => void;
  onClearSelection: () => void;
  isSending?: boolean;
}

export function BulkActionsBar({
  selectedCount,
  draftCount,
  voidableCount,
  onBulkSend,
  onBulkVoid,
  onClearSelection,
  isSending,
}: BulkActionsBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border bg-muted/50 px-4 py-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">
          {selectedCount} invoice{selectedCount !== 1 ? 's' : ''} selected
        </span>
        <Button variant="ghost" size="sm" onClick={onClearSelection} className="h-7 px-2">
          <X className="h-3 w-3 mr-1" />
          Clear
        </Button>
      </div>
      <div className="flex items-center gap-2">
        {draftCount > 0 && (
          <Button
            size="sm"
            variant="default"
            onClick={onBulkSend}
            disabled={isSending}
            className="gap-1.5"
          >
            <Send className="h-3.5 w-3.5" />
            Send {draftCount} Draft{draftCount !== 1 ? 's' : ''}
          </Button>
        )}
        {voidableCount > 0 && (
          <Button
            size="sm"
            variant="destructive"
            onClick={onBulkVoid}
            className="gap-1.5"
          >
            <XCircle className="h-3.5 w-3.5" />
            Void {voidableCount}
          </Button>
        )}
      </div>
    </div>
  );
}
