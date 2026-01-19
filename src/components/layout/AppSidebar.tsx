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
} from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useRole, UserRole } from '@/contexts/RoleContext';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface NavItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
}

const ownerAdminNav: NavItem[] = [
  { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard },
  { title: 'Calendar', url: '/calendar', icon: Calendar },
  { title: 'Students', url: '/students', icon: Users },
  { title: 'Teachers', url: '/teachers', icon: GraduationCap },
  { title: 'Locations', url: '/locations', icon: MapPin },
  { title: 'Invoices', url: '/invoices', icon: Receipt },
  { title: 'Reports', url: '/reports', icon: BarChart3 },
  { title: 'Messages', url: '/messages', icon: MessageSquare },
  { title: 'Settings', url: '/settings', icon: Settings },
];

const teacherNav: NavItem[] = [
  { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard },
  { title: 'My Calendar', url: '/calendar', icon: Calendar },
  { title: 'My Students', url: '/students', icon: Users },
  { title: 'Messages', url: '/messages', icon: MessageSquare },
];

const parentNav: NavItem[] = [
  { title: 'Home', url: '/dashboard', icon: Home },
  { title: 'Schedule', url: '/calendar', icon: Calendar },
  { title: 'Invoices & Payments', url: '/invoices', icon: CreditCard },
  { title: 'Messages', url: '/messages', icon: MessageSquare },
];

function getNavItems(role: UserRole): NavItem[] {
  switch (role) {
    case 'owner':
    case 'admin':
      return ownerAdminNav;
    case 'teacher':
      return teacherNav;
    case 'parent':
      return parentNav;
    default:
      return ownerAdminNav;
  }
}

function getRoleLabel(role: UserRole): string {
  const labels: Record<UserRole, string> = {
    owner: 'Owner',
    admin: 'Admin',
    teacher: 'Teacher',
    parent: 'Parent',
  };
  return labels[role];
}

export function AppSidebar() {
  const { role, setRole } = useRole();
  const navItems = getNavItems(role);

  return (
    <Sidebar className="border-r">
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
                      className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                      activeClassName="bg-accent text-accent-foreground font-medium"
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
        <div className="space-y-2">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Demo: Switch Role
          </span>
          <Select value={role} onValueChange={(value) => setRole(value as UserRole)}>
            <SelectTrigger className="w-full">
              <SelectValue>{getRoleLabel(role)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="owner">Owner</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="teacher">Teacher</SelectItem>
              <SelectItem value="parent">Parent</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
