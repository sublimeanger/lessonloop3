import type { LucideIcon } from 'lucide-react';
import {
  User,
  Building2,
  GraduationCap,
  Briefcase,
  ShieldCheck,
  Bell,
  HelpCircle,
  Palette,
  Users,
  Calendar,
  Clock,
  CalendarSync,
  Video,
  Music,
  CreditCard,
  Tags,
  MessageSquare,
  Sparkles,
  Shield,
  FileText,
  ChevronRight,
  ArrowLeft,
  Globe,
  Upload,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ───

export interface NavItem {
  value: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
}

export interface NavGroup {
  title: string;
  icon: LucideIcon;
  items: NavItem[];
}

// ─── Navigation config ───

export const SETTINGS_NAV_GROUPS: NavGroup[] = [
  {
    title: 'Account',
    icon: User,
    items: [
      { value: 'profile', label: 'Profile', icon: User },
      { value: 'notifications', label: 'Notifications', icon: Bell },
      { value: 'help-tours', label: 'Help & Tours', icon: HelpCircle },
    ],
  },
  {
    title: 'Organisation',
    icon: Building2,
    items: [
      { value: 'organisation', label: 'Organisation', icon: Building2 },
      { value: 'branding', label: 'Branding', icon: Palette },
      { value: 'members', label: 'Members', icon: Users, adminOnly: true },
      { value: 'data-import', label: 'Data & Import', icon: Upload, adminOnly: true },
    ],
  },
  {
    title: 'Teaching',
    icon: GraduationCap,
    items: [
      { value: 'scheduling', label: 'Scheduling', icon: Calendar, adminOnly: true },
      { value: 'availability', label: 'Availability', icon: Clock },
      { value: 'calendar', label: 'Calendar Sync', icon: CalendarSync },
      { value: 'zoom', label: 'Zoom Meetings', icon: Video },
      { value: 'music', label: 'Music', icon: Music, adminOnly: true },
    ],
  },
  {
    title: 'Business',
    icon: Briefcase,
    items: [
      { value: 'billing', label: 'Billing', icon: CreditCard, adminOnly: true },
      { value: 'rate-cards', label: 'Rate Cards', icon: Tags, adminOnly: true },
      { value: 'messaging', label: 'Messaging', icon: MessageSquare, adminOnly: true },
      { value: 'booking-page', label: 'Booking Page', icon: Globe, adminOnly: true },
      { value: 'looopassist', label: 'LoopAssist AI', icon: Sparkles, adminOnly: true },
    ],
  },
  {
    title: 'Compliance',
    icon: ShieldCheck,
    items: [
      { value: 'privacy', label: 'Privacy & GDPR', icon: Shield, adminOnly: true },
      { value: 'audit', label: 'Audit Log', icon: FileText, adminOnly: true },
    ],
  },
];

// ─── Helpers ───

function getVisibleGroups(isOrgAdmin: boolean): NavGroup[] {
  return SETTINGS_NAV_GROUPS
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.adminOnly || isOrgAdmin),
    }))
    .filter((group) => group.items.length > 0);
}

export function getNavLabel(value: string): string {
  for (const group of SETTINGS_NAV_GROUPS) {
    const item = group.items.find((i) => i.value === value);
    if (item) return item.label;
  }
  return 'Settings';
}

// ─── Desktop Sidebar ───

interface SettingsSidebarProps {
  activeTab: string;
  onTabChange: (value: string) => void;
  isOrgAdmin: boolean;
}

export function SettingsSidebar({ activeTab, onTabChange, isOrgAdmin }: SettingsSidebarProps) {
  const groups = getVisibleGroups(isOrgAdmin);

  return (
    <nav
      aria-label="Settings navigation"
      className="hidden md:block w-56 shrink-0 border-r border-border/60 pr-4 py-2"
    >
      <div className="sticky top-4 space-y-6">
        {groups.map((group) => (
          <div key={group.title}>
            <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground px-3 mb-1.5">
              {group.title}
            </h2>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.value;

                return (
                  <button
                    key={item.value}
                    onClick={() => onTabChange(item.value)}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors min-h-[44px]',
                      isActive
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </nav>
  );
}

// ─── Mobile Nav List ───

interface SettingsMobileNavProps {
  onTabChange: (value: string) => void;
  isOrgAdmin: boolean;
}

export function SettingsMobileNav({ onTabChange, isOrgAdmin }: SettingsMobileNavProps) {
  const groups = getVisibleGroups(isOrgAdmin);

  return (
    <nav aria-label="Settings navigation" className="space-y-5">
      {groups.map((group) => {
        const GroupIcon = group.icon;
        return (
          <div key={group.title}>
            <h2 className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground px-1 mb-2">
              <GroupIcon className="h-3.5 w-3.5" />
              {group.title}
            </h2>
            <div className="rounded-xl border bg-card divide-y">
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.value}
                    onClick={() => onTabChange(item.value)}
                    className="flex w-full items-center gap-3 px-4 py-3.5 text-sm transition-colors hover:bg-accent min-h-[48px] first:rounded-t-xl last:rounded-b-xl"
                  >
                    <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="flex-1 text-left">{item.label}</span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" />
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </nav>
  );
}

// ─── Mobile Back Button ───

interface MobileBackButtonProps {
  label: string;
  onBack: () => void;
}

export function MobileBackButton({ label, onBack }: MobileBackButtonProps) {
  return (
    <button
      onClick={onBack}
      aria-label="Back to settings navigation"
      className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4 -ml-1 md:hidden"
    >
      <ArrowLeft className="h-4 w-4" />
      <span>Settings</span>
      <span className="text-muted-foreground/40 mx-0.5">/</span>
      <span className="text-foreground font-medium">{label}</span>
    </button>
  );
}
