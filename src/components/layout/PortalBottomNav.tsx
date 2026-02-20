import { Home, Calendar, Music, CreditCard, MessageSquare } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useUnreadMessagesCount } from '@/hooks/useUnreadMessages';
import { cn } from '@/lib/utils';

const tabs = [
  { label: 'Home', path: '/portal/home', icon: Home },
  { label: 'Schedule', path: '/portal/schedule', icon: Calendar },
  { label: 'Practice', path: '/portal/practice', icon: Music },
  { label: 'Invoices', path: '/portal/invoices', icon: CreditCard },
  { label: 'Messages', path: '/portal/messages', icon: MessageSquare },
];

export function PortalBottomNav() {
  const { data: unreadCount } = useUnreadMessagesCount();

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 border-t bg-white dark:bg-card pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-stretch justify-around h-14">
        {tabs.map((tab) => {
          const isMessages = tab.path === '/portal/messages';
          const badge = isMessages && unreadCount && unreadCount > 0 ? unreadCount : null;

          return (
            <NavLink
              key={tab.path}
              to={tab.path}
              className={({ isActive }) =>
                cn(
                  'flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors',
                  isActive ? 'text-primary' : 'text-muted-foreground',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <div className="relative">
                    <tab.icon className={cn('h-5 w-5', isActive && 'stroke-[2.5]')} />
                    {badge && (
                      <span className="absolute -top-1.5 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground">
                        {badge > 99 ? '99+' : badge}
                      </span>
                    )}
                  </div>
                  <span>{tab.label}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
