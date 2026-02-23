import { useState, useEffect, useRef } from 'react';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useSearchParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProfileTab } from '@/components/settings/ProfileTab';
import { OrganisationTab } from '@/components/settings/OrganisationTab';
import { BrandingTab } from '@/components/settings/BrandingTab';
import { NotificationsTab } from '@/components/settings/NotificationsTab';
import { InvoiceSettingsTab } from '@/components/settings/InvoiceSettingsTab';
import { OrgMembersTab } from '@/components/settings/OrgMembersTab';
import { SchedulingSettingsTab } from '@/components/settings/SchedulingSettingsTab';
import AuditLogTab from '@/components/settings/AuditLogTab';
import { PrivacyTab } from '@/components/settings/PrivacyTab';
import { RateCardsTab } from '@/components/settings/RateCardsTab';
import { TeacherAvailabilityTab } from '@/components/settings/TeacherAvailabilityTab';
import { BillingTab } from '@/components/settings/BillingTab';
import { HelpToursTab } from '@/components/settings/HelpToursTab';
import { CalendarIntegrationsTab } from '@/components/settings/CalendarIntegrationsTab';
import { LoopAssistPreferencesTab } from '@/components/settings/LoopAssistPreferencesTab';
import { MusicSettingsTab } from '@/components/settings/MusicSettingsTab';
import { MessagingSettingsTab } from '@/components/settings/MessagingSettingsTab';
import { useOrg } from '@/contexts/OrgContext';

import { useTeachers } from '@/hooks/useTeachers';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

// ─── Tab bar with horizontal scroll + gradient fades ───
function ScrollableTabBar({ initialTab, isOrgAdmin }: { initialTab: string; isOrgAdmin: boolean }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showFadeRight, setShowFadeRight] = useState(true);
  const [showFadeLeft, setShowFadeLeft] = useState(false);

  useEffect(() => {
    if (!scrollRef.current) return;
    const activeTab = scrollRef.current.querySelector('[data-state="active"]') as HTMLElement | null;
    if (activeTab) {
      activeTab.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [initialTab]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handleScroll = () => {
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 8;
      const atStart = el.scrollLeft <= 8;
      setShowFadeRight(!atEnd);
      setShowFadeLeft(!atStart);
    };
    el.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => el.removeEventListener('scroll', handleScroll);
  }, []);

  const tabs = (
    <>
      <TabsTrigger value="profile">Profile</TabsTrigger>
      <TabsTrigger value="organisation">Organisation</TabsTrigger>
      <TabsTrigger value="branding">Branding</TabsTrigger>
      {isOrgAdmin && <TabsTrigger value="members">Members</TabsTrigger>}
      {isOrgAdmin && <TabsTrigger value="scheduling">Scheduling</TabsTrigger>}
      {isOrgAdmin && <TabsTrigger value="audit">Audit Log</TabsTrigger>}
      {isOrgAdmin && <TabsTrigger value="privacy">Privacy &amp; GDPR</TabsTrigger>}
      {isOrgAdmin && <TabsTrigger value="rate-cards">Rate Cards</TabsTrigger>}
      {isOrgAdmin && <TabsTrigger value="music">Music</TabsTrigger>}
      {isOrgAdmin && <TabsTrigger value="messaging">Messaging</TabsTrigger>}
      <TabsTrigger value="availability">Availability</TabsTrigger>
      <TabsTrigger value="calendar">Calendar Sync</TabsTrigger>
      {isOrgAdmin && <TabsTrigger value="billing">Billing</TabsTrigger>}
      {isOrgAdmin && <TabsTrigger value="looopassist">LoopAssist AI</TabsTrigger>}
      <TabsTrigger value="notifications">Notifications</TabsTrigger>
      <TabsTrigger value="help-tours">Help &amp; Tours</TabsTrigger>
    </>
  );

  return (
    <div className="relative">
      {showFadeLeft && (
        <div className="absolute left-0 top-0 bottom-0 w-8 pointer-events-none bg-gradient-to-r from-muted to-transparent z-10 rounded-l-md" />
      )}
      <TabsList
        ref={scrollRef}
        className="w-full overflow-x-auto flex-nowrap justify-start h-auto gap-1 scrollbar-hide scroll-smooth"
        aria-label="Settings navigation"
      >
        {tabs}
      </TabsList>
      {showFadeRight && (
        <div className="absolute right-0 top-0 bottom-0 w-8 pointer-events-none bg-gradient-to-l from-muted to-transparent z-10 rounded-r-md" />
      )}
    </div>
  );
}

// Wrapper for availability tab with admin teacher selector
function AvailabilityTabWithSelector({ isOrgAdmin }: { isOrgAdmin: boolean }) {
  const { data: teachers = [] } = useTeachers();
  const activeTeachers = teachers.filter(t => t.status === 'active');
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('__self__');

  const selectedTeacher = selectedTeacherId === '__self__'
    ? undefined
    : activeTeachers.find(t => t.id === selectedTeacherId);

  if (!isOrgAdmin || activeTeachers.length === 0) {
    return <TeacherAvailabilityTab />;
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5 w-full max-w-xs">
        <Label className="text-sm text-muted-foreground">Viewing availability for</Label>
        <Select value={selectedTeacherId} onValueChange={setSelectedTeacherId}>
          <SelectTrigger>
            <SelectValue placeholder="My availability" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__self__">My availability</SelectItem>
            {activeTeachers.map(t => (
              <SelectItem key={t.id} value={t.id}>{t.display_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <TeacherAvailabilityTab
        teacherId={selectedTeacher?.id}
        teacherUserId={selectedTeacher?.user_id ?? undefined}
      />
    </div>
  );
}

export default function Settings() {
  usePageMeta('Settings — LessonLoop', 'Manage your account, organisation, and subscription settings');
  const [searchParams, setSearchParams] = useSearchParams();
  const { isOrgAdmin } = useOrg();
  const adminTabs = ['members', 'scheduling', 'audit', 'privacy', 'rate-cards', 'music', 'messaging', 'billing', 'looopassist'];
  const rawTab = searchParams.get('tab') || 'profile';
  const activeTab = (!isOrgAdmin && adminTabs.includes(rawTab)) ? 'profile' : rawTab;

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value }, { replace: true });
  };

  return (
    <AppLayout>
      <PageHeader
        title="Settings"
        description="Manage your account and preferences"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Settings' },
        ]}
      />

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <ScrollableTabBar initialTab={activeTab} isOrgAdmin={isOrgAdmin} />

        <TabsContent value="profile"><ProfileTab /></TabsContent>
        <TabsContent value="organisation"><OrganisationTab /></TabsContent>
        <TabsContent value="branding"><BrandingTab /></TabsContent>

        {isOrgAdmin && <TabsContent value="members"><OrgMembersTab /></TabsContent>}
        {isOrgAdmin && <TabsContent value="scheduling"><SchedulingSettingsTab /></TabsContent>}
        {isOrgAdmin && <TabsContent value="audit"><AuditLogTab /></TabsContent>}
        {isOrgAdmin && <TabsContent value="privacy"><PrivacyTab /></TabsContent>}
        {isOrgAdmin && <TabsContent value="rate-cards"><RateCardsTab /></TabsContent>}
        {isOrgAdmin && <TabsContent value="music"><MusicSettingsTab /></TabsContent>}
        {isOrgAdmin && <TabsContent value="messaging"><MessagingSettingsTab /></TabsContent>}

        <TabsContent value="availability">
          <AvailabilityTabWithSelector isOrgAdmin={isOrgAdmin} />
        </TabsContent>
        <TabsContent value="calendar"><CalendarIntegrationsTab /></TabsContent>

        {isOrgAdmin && (
          <TabsContent value="billing">
            <div className="space-y-8">
              <BillingTab />
              <InvoiceSettingsTab />
            </div>
          </TabsContent>
        )}

        {isOrgAdmin && <TabsContent value="looopassist"><LoopAssistPreferencesTab /></TabsContent>}

        <TabsContent value="notifications"><NotificationsTab /></TabsContent>
        <TabsContent value="help-tours"><HelpToursTab /></TabsContent>
      </Tabs>
    </AppLayout>
  );
}
