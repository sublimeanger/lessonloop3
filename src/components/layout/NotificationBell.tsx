import { Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { useUnreadInternalCount, useInternalMessages } from '@/hooks/useInternalMessages';
import { usePendingRequestsCount } from '@/hooks/useAdminMessageRequests';
import { cn } from '@/lib/utils';

export function NotificationBell() {
  const navigate = useNavigate();
  const { data: unreadInternal = 0 } = useUnreadInternalCount();
  const { data: pendingRequests = 0 } = usePendingRequestsCount();
  const { data: inboxMessages } = useInternalMessages('inbox');

  const totalCount = unreadInternal + pendingRequests;
  const unreadMessages = (inboxMessages || [])
    .filter((m) => !m.read_at)
    .slice(0, 5);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="relative h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          {totalCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-0.5 text-[9px] font-bold text-destructive-foreground">
              {totalCount > 9 ? '9+' : totalCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 bg-popover z-50">
        <div className="px-3 py-2 border-b">
          <p className="text-sm font-medium">Notifications</p>
          {totalCount > 0 && (
            <p className="text-xs text-muted-foreground">
              {unreadInternal > 0 && `${unreadInternal} unread message${unreadInternal !== 1 ? 's' : ''}`}
              {unreadInternal > 0 && pendingRequests > 0 && ' · '}
              {pendingRequests > 0 && `${pendingRequests} pending request${pendingRequests !== 1 ? 's' : ''}`}
            </p>
          )}
        </div>

        {unreadMessages.length > 0 ? (
          unreadMessages.map((msg) => (
            <DropdownMenuItem
              key={msg.id}
              className="flex flex-col items-start gap-0.5 py-2.5 cursor-pointer"
              onClick={() => navigate('/messages?tab=internal')}
            >
              <div className="flex items-center gap-2 w-full">
                <span className="text-sm font-medium truncate flex-1">
                  {msg.sender_profile?.full_name || 'Unknown'}
                </span>
                <span className="text-[10px] text-muted-foreground flex-shrink-0">
                  {format(new Date(msg.created_at), 'dd MMM, HH:mm')}
                </span>
              </div>
              <span className="text-xs text-muted-foreground truncate w-full">
                {msg.subject}
              </span>
            </DropdownMenuItem>
          ))
        ) : (
          <div className="px-3 py-6 text-center text-sm text-muted-foreground">
            No unread messages
          </div>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="justify-center text-sm text-primary cursor-pointer"
          onClick={() => navigate('/messages')}
        >
          View all messages
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
