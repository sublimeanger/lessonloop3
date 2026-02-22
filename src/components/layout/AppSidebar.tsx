import {
  Calendar,
  Users,
  GraduationCap,
  MapPin,
  Receipt,
  BarChart3,
  MessageSquare,
  Settings,
  LayoutDashboard,
  Home,
  CreditCard,
  LogOut,
  Music,
  FolderOpen,
  ClipboardList,
  UserCheck,
  HelpCircle,
  Sparkles,
  RefreshCw,
  type LucideIcon,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { NavLink } from '@/components/NavLink';
import { useAuth, AppRole } from '@/contexts/AuthContext';
import { useOrg } from '@/contexts/OrgContext';
import { useLoopAssistUI } from '@/contexts/LoopAssistContext';
import { useProactiveAlerts } from '@/hooks/useProactiveAlerts';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarSeparator,
  useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Logo, LogoWordmark } from '@/components/brand/Logo';
import { cn } from '@/lib/utils';

interface NavItem {
  title: string;
  url: string;
  icon: LucideIcon;
}

interface NavGroup {
  label?: string;
  items: NavItem[];
}

// ─── Owner / Admin grouped nav ───
const ownerAdminGroups: NavGroup[] = [
  {
    items: [
      { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard },
      { title: 'Calendar', url: '/calendar', icon: Calendar },
    ],
  },
  {
    label: 'Teaching',
    items: [
      { title: 'Students', url: '/students', icon: Users },
      { title: 'Teachers', url: '/teachers', icon: GraduationCap },
      { title: 'Register', url: '/register', icon: ClipboardList },
      { title: 'Batch Attendance', url: '/batch-attendance', icon: UserCheck },
      { title: 'Practice', url: '/practice', icon: Music },
      { title: 'Resources', url: '/resources', icon: FolderOpen },
    ],
  },
  {
    label: 'Business',
    items: [
      { title: 'Invoices', url: '/invoices', icon: Receipt },
      { title: 'Make-Ups', url: '/make-ups', icon: RefreshCw },
      { title: 'Reports', url: '/reports', icon: BarChart3 },
      { title: 'Locations', url: '/locations', icon: MapPin },
    ],
  },
  {
    label: 'Communication',
    items: [
      { title: 'Messages', url: '/messages', icon: MessageSquare },
    ],
  },
];

const financeGroups: NavGroup[] = [
  {
    items: [
      { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Business',
    items: [
      { title: 'Invoices', url: '/invoices', icon: Receipt },
      { title: 'Reports', url: '/reports', icon: BarChart3 },
    ],
  },
  {
    label: 'Communication',
    items: [
      { title: 'Messages', url: '/messages', icon: MessageSquare },
    ],
  },
];

const teacherGroups: NavGroup[] = [
  {
    items: [
      { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard },
      { title: 'My Calendar', url: '/calendar', icon: Calendar },
    ],
  },
  {
    label: 'Teaching',
    items: [
      { title: 'My Students', url: '/students', icon: Users },
      { title: 'Register', url: '/register', icon: ClipboardList },
      { title: 'Batch Attendance', url: '/batch-attendance', icon: UserCheck },
      { title: 'Practice', url: '/practice', icon: Music },
      { title: 'Resources', url: '/resources', icon: FolderOpen },
    ],
  },
  {
    label: 'Communication',
    items: [
      { title: 'Messages', url: '/messages', icon: MessageSquare },
    ],
  },
];

const parentGroups: NavGroup[] = [
  {
    items: [
      { title: 'Home', url: '/portal/home', icon: Home },
      { title: 'Schedule', url: '/portal/schedule', icon: Calendar },
      { title: 'Practice', url: '/portal/practice', icon: Music },
      { title: 'Resources', url: '/portal/resources', icon: FolderOpen },
      { title: 'Invoices & Payments', url: '/portal/invoices', icon: CreditCard },
      { title: 'Messages', url: '/portal/messages', icon: MessageSquare },
    ],
  },
];

const footerNav: NavItem[] = [
  { title: 'Settings', url: '/settings', icon: Settings },
  { title: 'Help', url: '/help', icon: HelpCircle },
];

function getNavGroups(role: AppRole | null): NavGroup[] {
  if (!role) return [];
  switch (role) {
    case 'owner':
    case 'admin':
      return ownerAdminGroups;
    case 'finance':
      return financeGroups;
    case 'teacher':
      return teacherGroups;
    case 'parent':
      return parentGroups;
    default:
      return ownerAdminGroups;
  }
}

function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function getRoleLabel(role: AppRole | null): string {
  if (!role) return 'User';
  const labels: Record<AppRole, string> = {
    owner: 'Owner',
    admin: 'Admin',
    teacher: 'Teacher',
    finance: 'Finance',
    parent: 'Parent',
  };
  return labels[role];
}

function SidebarNavItem({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const button = (
    <SidebarMenuButton asChild>
      <NavLink
        to={item.url}
        className="flex items-center gap-3 rounded-lg px-3 py-2 text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        activeClassName="bg-sidebar-primary text-sidebar-primary-foreground font-medium"
      >
        <item.icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.5} />
        {!collapsed && <span className="text-sm font-medium">{item.title}</span>}
      </NavLink>
    </SidebarMenuButton>
  );

  if (collapsed) {
    return (
      <SidebarMenuItem>
        <Tooltip>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent side="right" className="text-xs">
            {item.title}
          </TooltipContent>
        </Tooltip>
      </SidebarMenuItem>
    );
  }

  return <SidebarMenuItem>{button}</SidebarMenuItem>;
}

export function AppSidebar() {
  const { profile, signOut } = useAuth();
  const { currentRole, currentOrg } = useOrg();
  const navigate = useNavigate();
  const { state } = useSidebar();
  const { setIsOpen: openLoopAssist } = useLoopAssistUI();
  const { totalActionable, hasCritical } = useProactiveAlerts();
  const collapsed = state === 'collapsed';
  const navGroups = getNavGroups(currentRole);
  const showLoopAssist = currentRole && currentRole !== 'parent';

  const handleSignOut = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  return (
    <Sidebar className="border-r border-sidebar-border" data-tour="sidebar">
      <SidebarContent className="pt-3">
        {/* Logo area */}
        <div className={cn('px-4 pb-2', collapsed && 'px-2 flex justify-center')}>
          {collapsed ? (
            <Logo size="sm" />
          ) : (
            <div className="flex items-center gap-2">
                <Logo size="sm" />
                <LogoWordmark variant="white" className="text-base" />
              </div>
          )}
        </div>
        <SidebarSeparator className="bg-sidebar-border mb-1" />

        {/* Nav groups */}
        {navGroups.map((group, gi) => (
          <SidebarGroup key={gi} className="py-1">
            {group.label && !collapsed && (
              <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/60 px-4 mb-0.5">
                {group.label}
              </SidebarGroupLabel>
            )}
            {group.label && collapsed && (
              <SidebarSeparator className="bg-sidebar-border mx-2 my-1" />
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarNavItem key={item.url} item={item} collapsed={collapsed} />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-2 space-y-1">
        {/* LoopAssist button */}
        {showLoopAssist && (
          <>
            {collapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => openLoopAssist(true)}
                    className="relative flex items-center justify-center rounded-lg p-2 text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  >
                    <Sparkles className="h-[18px] w-[18px]" strokeWidth={1.5} />
                    {totalActionable > 0 && (
                      <span className={cn(
                        'absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-0.5 text-[9px] font-bold text-destructive-foreground',
                        hasCritical ? 'bg-destructive' : 'bg-warning'
                      )}>
                        {totalActionable > 9 ? '9+' : totalActionable}
                      </span>
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="text-xs">LoopAssist</TooltipContent>
              </Tooltip>
            ) : (
              <button
                onClick={() => openLoopAssist(true)}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground ring-1 ring-sidebar-border"
              >
                <Sparkles className="h-[18px] w-[18px] text-sidebar-primary" strokeWidth={1.5} />
                <span className="flex-1 text-left">LoopAssist</span>
                {totalActionable > 0 && (
                  <span className={cn(
                    'flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold text-destructive-foreground',
                    hasCritical ? 'bg-destructive' : 'bg-warning'
                  )}>
                    {totalActionable > 9 ? '9+' : totalActionable}
                  </span>
                )}
                {totalActionable === 0 && (
                  <span className="text-[10px] text-sidebar-foreground/40">⌘J</span>
                )}
              </button>
            )}
            <SidebarSeparator className="bg-sidebar-border" />
          </>
        )}

        {/* Settings & Help */}
        <SidebarMenu>
          {footerNav.map((item) => (
            <SidebarNavItem key={item.url} item={item} collapsed={collapsed} />
          ))}
        </SidebarMenu>

        <SidebarSeparator className="bg-sidebar-border" />

        {/* User profile */}
        <div className={cn('flex items-center gap-3 px-1', collapsed && 'justify-center')}>
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-xs font-semibold">
              {getInitials(profile?.full_name)}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex-1 overflow-hidden">
              <div className="truncate text-sm font-medium text-sidebar-foreground">
                {profile?.full_name || 'User'}
              </div>
              <div className="truncate text-[11px] text-sidebar-foreground/60">
                {getRoleLabel(currentRole)}
              </div>
            </div>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleSignOut}
                className="h-7 w-7 shrink-0 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                title="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs">Sign out</TooltipContent>
          </Tooltip>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
