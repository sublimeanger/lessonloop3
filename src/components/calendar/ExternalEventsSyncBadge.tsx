import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import type { CalendarSyncInfo } from '@/hooks/useExternalBusyBlocks';

interface ExternalEventsSyncBadgeProps {
  syncInfo: CalendarSyncInfo | null;
  showExternal: boolean;
  onToggle: (v: boolean) => void;
}

export function ExternalEventsSyncBadge({ syncInfo, showExternal, onToggle }: ExternalEventsSyncBadgeProps) {
  if (!syncInfo) return null;

  const isError = syncInfo.sync_status === 'error';
  const lastSync = syncInfo.last_sync_at
    ? formatDistanceToNow(new Date(syncInfo.last_sync_at), { addSuffix: true })
    : 'never';

  return (
    <button
      onClick={() => onToggle(!showExternal)}
      className={cn(
        'inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded transition-colors',
        showExternal
          ? 'bg-muted/60 text-muted-foreground hover:bg-muted'
          : 'bg-transparent text-muted-foreground/40 hover:text-muted-foreground/60',
        isError && 'text-warning',
      )}
      title={showExternal ? 'Click to hide external events' : 'Click to show external events'}
    >
      <span>📅</span>
      <span className="hidden sm:inline">
        {isError ? 'Sync error' : `Synced ${lastSync}`}
      </span>
      <span className={cn(
        'h-1.5 w-1.5 rounded-full',
        showExternal ? 'bg-emerald-500' : 'bg-muted-foreground/30',
        isError && 'bg-warning',
      )} />
    </button>
  );
}
