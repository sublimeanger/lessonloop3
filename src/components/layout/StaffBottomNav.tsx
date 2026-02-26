import { useMemo } from 'react';
import {
  LayoutDashboard,
  Calendar,
  Users,
  MessageSquare,
  MoreHorizontal,
  ClipboardList,
  Settings,
  type LucideIcon,
} from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { useOrg } from '@/contexts/OrgContext';
import { useUnreadInternalCount } from '@/hooks/useInternalMessages';
import { usePendingRequestsCount } from '@/hooks/useAdminMessageRequests';
import { cn } from '@/lib/utils';
import { haptics } from '@/lib/native/haptics';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

interface TabItem {
  label: string;
  path: string;
  icon: LucideIcon;
}

// Owner/Admin tabs
const ownerAdminTabs: TabItem[] = [
  { label: 'Home', path: '/dashboard', icon: LayoutDashboard },
  { label: 'Schedule', path: '/calendar', icon: Calendar },
  { label: 'Students', path: '/students', icon: Users },
  { label: 'Messages', path: '/messages', icon: MessageSquare },
];

// Teacher tabs
const teacherTabs: TabItem[] = [
  { label: 'Today', path: '/dashboard', icon: LayoutDashboard },
  { label: 'Schedule', path: '/calendar', icon: Calendar },
  { label: 'Students', path: '/students', icon: Users },
  { label: 'Messages', path: '/messages', icon: MessageSquare },
];

// Finance tabs
const financeTabs: TabItem[] = [
  { label: 'Home', path: '/dashboard', icon: LayoutDashboard },
  { label: 'Invoices', path: '/invoices', icon: ClipboardList },
  { label: 'Messages', path: '/messages', icon: MessageSquare },
];

// "More" menu items per role
const ownerAdminMore: TabItem[] = [
  { label: 'Teachers', path: '/teachers', icon: Users },
  { label: 'Invoices', path: '/invoices', icon: ClipboardList },
  { label: 'Register', path: '/register', icon: ClipboardList },
  { label: 'Settings', path: '/settings', icon: Settings },
];

const teacherMore: TabItem[] = [
  { label: 'Register', path: '/register', icon: ClipboardList },
  { label: 'Settings', path: '/settings', icon: Settings },
];

const financeMore: TabItem[] = [
  { label: 'Reports', path: '/reports', icon: ClipboardList },
  { label: 'Settings', path: '/settings', icon: Settings },
];

function getTabsForRole(role: string | null): { tabs: TabItem[]; more: TabItem[] } {
  switch (role) {
    case 'owner':
    case 'admin':
      return { tabs: ownerAdminTabs, more: ownerAdminMore };
    case 'teacher':
      return { tabs: teacherTabs, more: teacherMore };
    case 'finance':
      return { tabs: financeTabs, more: financeMore };
    default:
      return { tabs: ownerAdminTabs, more: ownerAdminMore };
  }
}

export function StaffBottomNav() {
  const { currentRole } = useOrg();
  const { data: unreadInternal = 0 } = useUnreadInternalCount();
  const { data: pendingRequests = 0 } = usePendingRequestsCount();
  const messageBadge = unreadInternal + pendingRequests;
  const location = useLocation();

  const { tabs, more } = useMemo(() => getTabsForRole(currentRole), [currentRole]);

  // Check if current location is in the "More" section
  const isMoreActive = more.some((item) => location.pathname.startsWith(item.path));

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-50 bg-background/80 backdrop-blur-lg shadow-[0_-1px_8px_0_rgba(0,0,0,0.06)] pb-[env(safe-area-inset-bottom)]"
      role="navigation"
      aria-label="Staff navigation"
    >
      <div className="flex items-stretch justify-around h-16">
        {tabs.map((tab) => {
          const isMessages = tab.path === '/messages';
          const badge = isMessages && messageBadge > 0 ? messageBadge : null;

          return (
            <NavLink
              key={tab.path}
              to={tab.path}
              onClick={() => haptics.tap()}
              aria-label={badge ? `${tab.label}, ${badge} unread` : tab.label}
              className={({ isActive }) =>
                cn(
                  'flex flex-1 flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors relative',
                  isActive ? 'text-primary' : 'text-muted-foreground',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <div className="relative">
                    <tab.icon className={cn('h-5 w-5', isActive && 'stroke-[2.5]')} />
                    {badge && (
                      <span
                        className="absolute -top-1.5 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground"
                        aria-hidden="true"
                      >
                        {badge > 99 ? '99+' : badge}
                      </span>
                    )}
                  </div>
                  <span>{tab.label}</span>
                  {isActive && (
                    <span className="absolute bottom-1 h-1 w-5 rounded-full bg-primary" />
                  )}
                </>
              )}
            </NavLink>
          );
        })}

        {/* More tab with sheet */}
        <Sheet>
          <SheetTrigger asChild>
            <button
              onClick={() => haptics.tap()}
              className={cn(
                'flex flex-1 flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors relative',
                isMoreActive ? 'text-primary' : 'text-muted-foreground',
              )}
              aria-label="More options"
            >
              <MoreHorizontal className={cn('h-5 w-5', isMoreActive && 'stroke-[2.5]')} />
              <span>More</span>
              {isMoreActive && (
                <span className="absolute bottom-1 h-1 w-5 rounded-full bg-primary" />
              )}
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="pb-[env(safe-area-inset-bottom)]">
            <SheetHeader>
              <SheetTitle>More</SheetTitle>
            </SheetHeader>
            <div className="grid grid-cols-3 gap-4 py-4">
              {more.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => haptics.tap()}
                  className={({ isActive }) =>
                    cn(
                      'flex flex-col items-center gap-2 rounded-xl p-3 transition-colors',
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-muted',
                    )
                  }
                >
                  <item.icon className="h-6 w-6" />
                  <span className="text-xs font-medium">{item.label}</span>
                </NavLink>
              ))}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
