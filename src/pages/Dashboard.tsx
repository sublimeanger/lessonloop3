import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useOrg } from '@/contexts/OrgContext';
import { useDashboardStats } from '@/hooks/useReports';
import { useTeacherDashboardStats } from '@/hooks/useTeacherDashboard';
import { SectionErrorBoundary } from '@/components/shared/SectionErrorBoundary';
import { UpgradeBanner } from '@/components/subscription';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  DashboardHero, 
  TodayTimeline, 
  QuickActionsGrid,
  FirstRunExperience,
  UrgentActionsBar,
} from '@/components/dashboard';
import { Building2 } from 'lucide-react';
import { DashboardSkeleton } from '@/components/shared/LoadingState';

export default function Dashboard() {
  const { profile } = useAuth();
  const { currentOrg, currentRole, hasOrgs, isLoading: orgLoading, hasInitialised } = useOrg();
  const navigate = useNavigate();
  
  const isParent = currentRole === 'parent';
  const isTeacher = currentRole === 'teacher';
  const isAcademyOrAgency = currentOrg?.org_type === 'academy' || currentOrg?.org_type === 'agency';

  useEffect(() => {
    if (isParent) {
      navigate('/portal/home', { replace: true });
    }
  }, [isParent, navigate]);

  const firstName = profile?.full_name?.split(' ')[0] || 'there';

  if (isParent) return null;

  if (!hasInitialised || orgLoading) {
    return (
      <AppLayout>
        <DashboardSkeleton />
      </AppLayout>
    );
  }

  if (!hasOrgs || !currentOrg) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-md py-12">
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <Building2 className="h-8 w-8 text-muted-foreground" />
              </div>
              <CardTitle>No Organisation Found</CardTitle>
              <p className="mt-2 text-sm text-muted-foreground">
                Complete the onboarding to get started.
              </p>
            </CardHeader>
            <CardContent className="flex justify-center">
              <Button onClick={() => navigate('/onboarding')}>Complete Setup</Button>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  if (isTeacher && isAcademyOrAgency) {
    return <TeacherDashboard firstName={firstName} />;
  }

  if (isAcademyOrAgency) {
    return <StaffDashboard firstName={firstName} />;
  }

  return <StaffDashboard firstName={firstName} />;
}

function StaffDashboard({ firstName }: { firstName: string }) {
  const { currentOrg } = useOrg();
  const { data: stats, isLoading } = useDashboardStats();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: currentOrg?.currency_code || 'GBP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl">
        {/* Urgent actions — top of page */}
        <SectionErrorBoundary name="Urgent Actions">
          <UrgentActionsBar />
        </SectionErrorBoundary>

        {/* Hero — greeting + inline stats */}
        <SectionErrorBoundary name="Dashboard Hero">
          <DashboardHero
            firstName={firstName}
            todayLessons={stats?.todayLessons}
            outstandingAmount={stats?.outstandingAmount}
            currencyCode={currentOrg?.currency_code}
            hasStudents={(stats?.activeStudents ?? 0) > 0}
            hasLessons={(stats?.totalLessons ?? 0) > 0}
          />
        </SectionErrorBoundary>

        {/* First Run Experience (only shows for brand new users) */}
        <SectionErrorBoundary name="First Run Experience">
          <FirstRunExperience />
        </SectionErrorBoundary>

        {/* Upgrade Banner */}
        <SectionErrorBoundary name="Upgrade Banner">
          <UpgradeBanner />
        </SectionErrorBoundary>

        {/* Main content: Timeline + Quick Actions */}
        <div className="grid gap-6 lg:grid-cols-5">
          <SectionErrorBoundary name="Today's Timeline">
            <TodayTimeline className="lg:col-span-3" />
          </SectionErrorBoundary>
          <SectionErrorBoundary name="Quick Actions">
            <QuickActionsGrid
              variant={currentOrg?.org_type === 'academy' || currentOrg?.org_type === 'agency' ? 'academy' : 'solo'}
              className="lg:col-span-2"
            />
          </SectionErrorBoundary>
        </div>
      </div>
    </AppLayout>
  );
}

function TeacherDashboard({ firstName }: { firstName: string }) {
  const { data: stats, isLoading } = useTeacherDashboardStats();

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl">
        {/* Urgent actions */}
        <SectionErrorBoundary name="Urgent Actions">
          <UrgentActionsBar />
        </SectionErrorBoundary>

        {/* Hero */}
        <SectionErrorBoundary name="Dashboard Hero">
          <DashboardHero
            firstName={firstName}
            todayLessons={stats?.todayLessons}
            hasStudents={(stats?.myStudentsCount ?? 0) > 0}
          />
        </SectionErrorBoundary>

        {/* Upgrade Banner */}
        <SectionErrorBoundary name="Upgrade Banner">
          <UpgradeBanner variant="compact" />
        </SectionErrorBoundary>

        {/* Main content */}
        <div className="grid gap-6 lg:grid-cols-5">
          <SectionErrorBoundary name="Today's Timeline">
            <TodayTimeline className="lg:col-span-3" />
          </SectionErrorBoundary>
          <SectionErrorBoundary name="Quick Actions">
            <QuickActionsGrid variant="teacher" className="lg:col-span-2" />
          </SectionErrorBoundary>
        </div>
      </div>
    </AppLayout>
  );
}
