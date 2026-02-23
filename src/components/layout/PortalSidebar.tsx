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
import { ChildSwitcher } from '@/components/portal/ChildSwitcher';
import { usePortalFeatures } from '@/hooks/usePortalFeatures';
import { Logo, LogoWordmark } from '@/components/brand/Logo';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuBadge,
  SidebarFooter,
  SidebarSeparator,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

const allPortalNav = [
  { title: 'Home', url: '/portal/home', icon: Home, key: 'always' as const },
  { title: 'Schedule', url: '/portal/schedule', icon: Calendar, key: 'always' as const },
  { title: 'Practice', url: '/portal/practice', icon: Music, key: 'practice' as const },
  { title: 'Resources', url: '/portal/resources', icon: FolderOpen, key: 'resources' as const },
  { title: 'Invoices', url: '/portal/invoices', icon: CreditCard, key: 'invoices' as const },
  { title: 'Messages', url: '/portal/messages', icon: MessageSquare, key: 'always' as const },
  { title: 'Profile', url: '/portal/profile', icon: User, key: 'always' as const },
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

export function PortalSidebar() {
  const { profile, signOut } = useAuth();
  const { currentOrg } = useOrg();
  const { data: unreadCount } = useUnreadMessagesCount();
  const navigate = useNavigate();
  const { practiceEnabled, resourcesEnabled, invoicesEnabled } = usePortalFeatures();

  const portalNav = allPortalNav.filter((item) => {
    if (item.key === 'always') return true;
    if (item.key === 'practice') return practiceEnabled;
    if (item.key === 'resources') return resourcesEnabled;
    if (item.key === 'invoices') return invoicesEnabled;
    return true;
  });

  const handleSignOut = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  return (
    <Sidebar className="border-r border-sidebar-border">
      <SidebarContent className="pt-3">
        {/* Spacer — logo is in Header, matching main dashboard */}

        {/* Child filter */}
        <div className="mb-2 px-3">
          <ChildSwitcher className="w-full" />
        </div>

        {/* Navigation */}
        <SidebarGroup className="py-1">
          <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/60 px-4 mb-0.5">
            Portal
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {portalNav.map((item) => {
                const isMessages = item.url === '/portal/messages';
                const showBadge = isMessages && !!unreadCount && unreadCount > 0;

                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        className="flex items-center gap-3 rounded-lg px-3 py-2 text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        activeClassName="bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                      >
                        <item.icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.5} />
                        <span className="text-sm font-medium">{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                    {showBadge && (
                      <SidebarMenuBadge className="bg-destructive text-destructive-foreground" aria-label={`${unreadCount} unread messages`}>
                        <span aria-hidden="true">{unreadCount > 99 ? '99+' : unreadCount}</span>
                      </SidebarMenuBadge>
                    )}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-2">
        <div className="flex items-center gap-3 px-1">
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-xs font-semibold">
              {getInitials(profile?.full_name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 overflow-hidden">
            <div className="truncate text-sm font-medium text-sidebar-foreground">
              {profile?.full_name || 'Parent'}
            </div>
            <div className="truncate text-[11px] text-sidebar-foreground/60">
              {currentOrg?.name || 'Parent Portal'}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleSignOut}
            className="h-7 w-7 shrink-0 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
