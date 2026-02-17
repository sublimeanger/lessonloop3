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
  ClipboardCheck,
  HelpCircle,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { NavLink } from '@/components/NavLink';
import { useAuth, AppRole } from '@/contexts/AuthContext';
import { useOrg } from '@/contexts/OrgContext';
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
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface NavItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
}

const ownerAdminNav: NavItem[] = [
  { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard },
  { title: 'Calendar', url: '/calendar', icon: Calendar },
  { title: 'Register', url: '/register', icon: ClipboardList },
  { title: 'Batch Attendance', url: '/batch-attendance', icon: ClipboardCheck },
  { title: 'Students', url: '/students', icon: Users },
  { title: 'Teachers', url: '/teachers', icon: GraduationCap },
  { title: 'Locations', url: '/locations', icon: MapPin },
  { title: 'Practice', url: '/practice', icon: Music },
  { title: 'Resources', url: '/resources', icon: FolderOpen },
  { title: 'Invoices', url: '/invoices', icon: Receipt },
  { title: 'Reports', url: '/reports', icon: BarChart3 },
  { title: 'Messages', url: '/messages', icon: MessageSquare },
  { title: 'Settings', url: '/settings', icon: Settings },
  { title: 'Help', url: '/help', icon: HelpCircle },
];

const financeNav: NavItem[] = [
  { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard },
  { title: 'Invoices', url: '/invoices', icon: Receipt },
  { title: 'Reports', url: '/reports', icon: BarChart3 },
  { title: 'Messages', url: '/messages', icon: MessageSquare },
  { title: 'Settings', url: '/settings', icon: Settings },
  { title: 'Help', url: '/help', icon: HelpCircle },
];

const teacherNav: NavItem[] = [
  { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard },
  { title: 'My Calendar', url: '/calendar', icon: Calendar },
  { title: 'Register', url: '/register', icon: ClipboardList },
  { title: 'Batch Attendance', url: '/batch-attendance', icon: ClipboardCheck },
  { title: 'My Students', url: '/students', icon: Users },
  { title: 'Practice', url: '/practice', icon: Music },
  { title: 'Resources', url: '/resources', icon: FolderOpen },
  { title: 'Messages', url: '/messages', icon: MessageSquare },
  { title: 'Settings', url: '/settings', icon: Settings },
  { title: 'Help', url: '/help', icon: HelpCircle },
];

const parentNav: NavItem[] = [
  { title: 'Home', url: '/portal/home', icon: Home },
  { title: 'Schedule', url: '/portal/schedule', icon: Calendar },
  { title: 'Practice', url: '/portal/practice', icon: Music },
  { title: 'Resources', url: '/portal/resources', icon: FolderOpen },
  { title: 'Invoices & Payments', url: '/portal/invoices', icon: CreditCard },
  { title: 'Messages', url: '/portal/messages', icon: MessageSquare },
];

function getNavItems(role: AppRole | null): NavItem[] {
  if (!role) return []; // Empty until role is known - prevents showing admin nav during loading
  
  switch (role) {
    case 'owner':
    case 'admin':
      return ownerAdminNav;
    case 'finance':
      return financeNav;
    case 'teacher':
      return teacherNav;
    case 'parent':
      return parentNav;
    default:
      return ownerAdminNav;
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

export function AppSidebar() {
  const { profile, signOut } = useAuth();
  const { currentRole } = useOrg();
  const navigate = useNavigate();
  const navItems = getNavItems(currentRole);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  return (
    <Sidebar className="border-r" data-tour="sidebar">
      <SidebarContent className="pt-4">
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      activeClassName="bg-primary/10 text-primary font-medium"
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t p-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-primary text-primary-foreground text-sm">
              {getInitials(profile?.full_name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 overflow-hidden">
            <div className="truncate text-sm font-medium">
              {profile?.full_name || 'User'}
            </div>
            <div className="truncate text-xs text-muted-foreground">
              {getRoleLabel(currentRole)}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleSignOut}
            className="h-8 w-8 shrink-0"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
