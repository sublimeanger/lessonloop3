import { useState } from 'react';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useSearchParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
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
import { ZoomIntegrationTab } from '@/components/settings/ZoomIntegrationTab';
import { LoopAssistPreferencesTab } from '@/components/settings/LoopAssistPreferencesTab';
import { MusicSettingsTab } from '@/components/settings/MusicSettingsTab';
import { MessagingSettingsTab } from '@/components/settings/MessagingSettingsTab';
import { BookingPageTab } from '@/components/settings/BookingPageTab';
import { SettingsLayout } from '@/components/settings/SettingsLayout';
import { useOrg } from '@/contexts/OrgContext';
import { useTeachers } from '@/hooks/useTeachers';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

// ─── Wrapper for availability tab with admin teacher selector ───
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

// ─── Active content renderer ───
function SettingsContent({ activeTab, isOrgAdmin }: { activeTab: string; isOrgAdmin: boolean }) {
  switch (activeTab) {
    case 'profile':
      return <ProfileTab />;
    case 'organisation':
      return <OrganisationTab />;
    case 'branding':
      return <BrandingTab />;
    case 'members':
      return <OrgMembersTab />;
    case 'scheduling':
      return <SchedulingSettingsTab />;
    case 'audit':
      return <AuditLogTab />;
    case 'privacy':
      return <PrivacyTab />;
    case 'rate-cards':
      return <RateCardsTab />;
    case 'music':
      return <MusicSettingsTab />;
    case 'messaging':
      return <MessagingSettingsTab />;
    case 'availability':
      return <AvailabilityTabWithSelector isOrgAdmin={isOrgAdmin} />;
    case 'calendar':
      return <CalendarIntegrationsTab />;
    case 'zoom':
      return <ZoomIntegrationTab />;
    case 'billing':
      return (
        <div className="space-y-8">
          <BillingTab />
          <InvoiceSettingsTab />
        </div>
      );
    case 'booking-page':
      return <BookingPageTab />;
    case 'looopassist':
      return <LoopAssistPreferencesTab />;
    case 'notifications':
      return <NotificationsTab />;
    case 'help-tours':
      return <HelpToursTab />;
    default:
      return <ProfileTab />;
  }
}

export default function Settings() {
  usePageMeta('Settings | LessonLoop', 'Manage your account, organisation, and subscription settings');
  const [searchParams, setSearchParams] = useSearchParams();
  const { isOrgAdmin } = useOrg();
  const adminTabs = ['members', 'scheduling', 'audit', 'privacy', 'rate-cards', 'music', 'messaging', 'booking-page', 'billing', 'looopassist'];

  const rawTab = searchParams.get('tab');
  // On desktop, default to profile. On mobile, null means show nav list.
  const activeTab = rawTab
    ? ((!isOrgAdmin && adminTabs.includes(rawTab)) ? 'profile' : rawTab)
    : null;

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value }, { replace: true });
  };

  const handleBack = () => {
    setSearchParams({}, { replace: true });
  };

  // For desktop, always show content (default to profile)
  const resolvedTab = activeTab ?? 'profile';

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

      <SettingsLayout
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onBack={handleBack}
        isOrgAdmin={isOrgAdmin}
      >
        <SettingsContent activeTab={resolvedTab} isOrgAdmin={isOrgAdmin} />
      </SettingsLayout>
    </AppLayout>
  );
}
