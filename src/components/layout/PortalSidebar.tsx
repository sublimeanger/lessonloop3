import {
  Home,
  Calendar,
  CreditCard,
  MessageSquare,
  LogOut,
  Music,
  FolderOpen,
  User,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { NavLink } from '@/components/NavLink';
import { useAuth } from '@/contexts/AuthContext';
import { useOrg } from '@/contexts/OrgContext';
import { useUnreadMessagesCount } from '@/hooks/useUnreadMessages';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuBadge,
  SidebarFooter,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

const portalNav = [
  { title: 'Home', url: '/portal/home', icon: Home },
  { title: 'Schedule', url: '/portal/schedule', icon: Calendar },
  { title: 'Practice', url: '/portal/practice', icon: Music },
  { title: 'Resources', url: '/portal/resources', icon: FolderOpen },
  { title: 'Invoices', url: '/portal/invoices', icon: CreditCard },
  { title: 'Messages', url: '/portal/messages', icon: MessageSquare },
  { title: 'Profile', url: '/portal/profile', icon: User },
];

function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// Generate a soft colour from a name for student avatars
function nameToSoftColour(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 55%, 88%)`;
}

export function PortalSidebar() {
  const { profile, signOut } = useAuth();
  const { currentOrg } = useOrg();
  const { data: unreadCount } = useUnreadMessagesCount();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  return (
    <Sidebar className="border-r bg-white dark:bg-card">
      <SidebarContent className="pt-5 px-3">
        {/* Org / school branding */}
        <div className="mb-4 px-2">
          <span className="text-sm font-semibold text-foreground tracking-tight">
            {currentOrg?.name || 'Parent Portal'}
          </span>
        </div>



        {/* Navigation */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {portalNav.map((item) => {
                const isMessages = item.url === '/portal/messages';
                const showBadge = isMessages && unreadCount && unreadCount > 0;
                
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                        activeClassName="bg-primary/10 text-primary font-medium"
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        <span className="flex-1">{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                    {showBadge && (
                      <SidebarMenuBadge className="bg-destructive text-destructive-foreground">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </SidebarMenuBadge>
                    )}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t p-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
              {getInitials(profile?.full_name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 overflow-hidden">
            <div className="truncate text-sm font-medium">
              {profile?.full_name || 'Parent'}
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
