import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useOrg } from '@/contexts/OrgContext';
import { useDashboardStats } from '@/hooks/useReports';
import { useTeacherDashboardStats } from '@/hooks/useTeacherDashboard';
import { OnboardingChecklist } from '@/components/shared/OnboardingChecklist';
import { GridSkeleton } from '@/components/shared/LoadingState';
import { SectionErrorBoundary } from '@/components/shared/SectionErrorBoundary';
import { UpgradeBanner } from '@/components/subscription';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  StatCard, 
  DashboardHero, 
  TodayTimeline, 
  QuickActionsGrid,
  FirstRunExperience,
  UrgentActionsBar,
} from '@/components/dashboard';
import { 
  Calendar, Users, Receipt, Clock, TrendingUp, 
  Building2, Loader2, AlertCircle, ChevronRight 
} from 'lucide-react';
import { Link } from 'react-router-dom';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export default function Dashboard() {
  const { profile } = useAuth();
  const { currentOrg, currentRole, hasOrgs, isLoading: orgLoading, hasInitialised } = useOrg();
  const navigate = useNavigate();
  
  const isParent = currentRole === 'parent';
  const isTeacher = currentRole === 'teacher';
  const isSoloTeacher = currentOrg?.org_type === 'solo_teacher' || currentOrg?.org_type === 'studio';
  const isAcademyOrAgency = currentOrg?.org_type === 'academy' || currentOrg?.org_type === 'agency';

  // Redirect parents to portal
  useEffect(() => {
    if (isParent) {
      navigate('/portal/home', { replace: true });
    }
  }, [isParent, navigate]);

  const firstName = profile?.full_name?.split(' ')[0] || 'there';

  // Don't render anything for parents (they'll be redirected)
  if (isParent) {
    return null;
  }

  // Show loading while org context initialises
  if (!hasInitialised || orgLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  // Handle no organisation state
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
                It looks like you haven't set up an organisation yet. Complete the onboarding to get started.
              </p>
            </CardHeader>
            <CardContent className="flex justify-center">
              <Button onClick={() => navigate('/onboarding')}>
                Complete Setup
              </Button>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  // Teacher view within academy/agency
  if (isTeacher && isAcademyOrAgency) {
    return <TeacherDashboard firstName={firstName} />;
  }

  if (isAcademyOrAgency) {
    return <AcademyDashboard firstName={firstName} orgName={currentOrg?.name} />;
  }

  return <SoloTeacherDashboard firstName={firstName} />;
}

// Hook to only animate on first mount, not on re-navigation
function useFirstMount() {
  const hasAnimated = useRef(false);
  const isFirst = !hasAnimated.current;
  useEffect(() => { hasAnimated.current = true; }, []);
  return isFirst;
}

function SoloTeacherDashboard({ firstName }: { firstName: string }) {
  const { currentOrg } = useOrg();
  const { data: stats, isLoading } = useDashboardStats();
  const isFirstMount = useFirstMount();

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
      <motion.div
        variants={containerVariants}
        initial={isFirstMount ? "hidden" : "visible"}
        animate="visible"
        className="space-y-6"
      >
        {/* Hero Section */}
        <motion.div variants={itemVariants}>
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
        </motion.div>

        {/* First Run Experience */}
        <motion.div variants={itemVariants}>
          <SectionErrorBoundary name="First Run Experience">
            <FirstRunExperience />
          </SectionErrorBoundary>
        </motion.div>

        {/* Urgent Actions Bar */}
        <motion.div variants={itemVariants}>
          <SectionErrorBoundary name="Urgent Actions">
            <UrgentActionsBar />
          </SectionErrorBoundary>
        </motion.div>

        {/* Upgrade Banner */}
        <motion.div variants={itemVariants}>
          <SectionErrorBoundary name="Upgrade Banner">
            <UpgradeBanner />
          </SectionErrorBoundary>
        </motion.div>

        {/* Onboarding Checklist */}
        <motion.div variants={itemVariants}>
          <SectionErrorBoundary name="Onboarding Checklist">
            <OnboardingChecklist />
          </SectionErrorBoundary>
        </motion.div>

        {/* Stats Grid */}
        <motion.div variants={itemVariants}>
          {isLoading ? (
            <GridSkeleton count={4} columns={4} />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" data-tour="stat-cards">
              <StatCard
                title="Today's Lessons"
                value={stats?.todayLessons ?? 0}
                subtitle={stats?.todayLessons === 0 ? 'No lessons scheduled' : 'lessons today'}
                icon={Calendar}
                href="/calendar"
                variant="teal"
              />
              <StatCard
                title="Active Students"
                value={stats?.activeStudents ?? 0}
                subtitle={stats?.activeStudents === 0 ? 'Add your first student' : 'enrolled'}
                icon={Users}
                href="/students"
                variant="coral"
              />
              <StatCard
                title="Outstanding"
                value={formatCurrency(stats?.outstandingAmount ?? 0)}
                subtitle={(stats?.outstandingAmount ?? 0) > 0 ? 'View ageing report' : 'All invoices paid'}
                icon={Receipt}
                href="/reports/outstanding"
                variant="violet"
              />
              <StatCard
                title="Hours This Week"
                value={stats?.hoursThisWeek ?? 0}
                subtitle={stats?.hoursThisWeek === 0 ? 'Schedule lessons to track' : 'hours taught'}
                icon={Clock}
                href="/calendar"
                variant="emerald"
              />
            </div>
          )}
        </motion.div>

        {/* Main Content Grid */}
        <motion.div variants={itemVariants} className="grid gap-6 lg:grid-cols-5">
          <SectionErrorBoundary name="Today's Timeline">
            <TodayTimeline className="lg:col-span-3" />
          </SectionErrorBoundary>
          <SectionErrorBoundary name="Quick Actions">
            <QuickActionsGrid variant="solo" className="lg:col-span-2" />
          </SectionErrorBoundary>
        </motion.div>
      </motion.div>
    </AppLayout>
  );
}

function AcademyDashboard({ firstName, orgName }: { firstName: string; orgName?: string }) {
  const { currentOrg } = useOrg();
  const { data: stats, isLoading } = useDashboardStats();
  const isFirstMount = useFirstMount();

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
      <motion.div
        variants={containerVariants}
        initial={isFirstMount ? "hidden" : "visible"}
        animate="visible"
        className="space-y-6"
      >
        {/* Hero Section */}
        <motion.div variants={itemVariants}>
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
        </motion.div>

        {/* First Run Experience */}
        <motion.div variants={itemVariants}>
          <SectionErrorBoundary name="First Run Experience">
            <FirstRunExperience />
          </SectionErrorBoundary>
        </motion.div>

        {/* Urgent Actions Bar */}
        <motion.div variants={itemVariants}>
          <SectionErrorBoundary name="Urgent Actions">
            <UrgentActionsBar />
          </SectionErrorBoundary>
        </motion.div>

        {/* Upgrade Banner */}
        <motion.div variants={itemVariants}>
          <SectionErrorBoundary name="Upgrade Banner">
            <UpgradeBanner />
          </SectionErrorBoundary>
        </motion.div>

        {/* Stats Grid */}
        <motion.div variants={itemVariants}>
          {isLoading ? (
            <GridSkeleton count={4} columns={4} />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                title="Active Students"
                value={stats?.activeStudents ?? 0}
                subtitle={stats?.activeStudents === 0 ? 'Add students to get started' : 'enrolled'}
                icon={Users}
                href="/students"
                variant="teal"
              />
              <StatCard
                title="Lessons This Week"
                value={stats?.lessonsThisWeek ?? 0}
                subtitle="View lessons report"
                icon={Calendar}
                href="/reports/lessons"
                variant="coral"
              />
              <StatCard
                title="Outstanding"
                value={formatCurrency(stats?.outstandingAmount ?? 0)}
                subtitle="View ageing report"
                icon={Receipt}
                href="/reports/outstanding"
                variant="violet"
              />
              <StatCard
                title="Revenue MTD"
                value={formatCurrency(stats?.revenueMTD ?? 0)}
                subtitle="View revenue report"
                icon={TrendingUp}
                href="/reports/revenue"
                variant="emerald"
              />
            </div>
          )}
        </motion.div>

        {/* Main Content Grid */}
        <motion.div variants={itemVariants} className="grid gap-6 lg:grid-cols-5">
          <SectionErrorBoundary name="Today's Timeline">
            <TodayTimeline className="lg:col-span-3" />
          </SectionErrorBoundary>
          
          <div className="space-y-6 lg:col-span-2">
            {/* Cancellation Alert Card */}
            <Link to="/reports/cancellations">
              <Card className="cursor-pointer transition-all hover:shadow-md hover:border-warning/30">
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-warning/10">
                    <AlertCircle className="h-6 w-6 text-warning" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold">Cancellation Tracking</h3>
                    <p className="text-sm text-muted-foreground">Monitor patterns and rates</p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
            
            <SectionErrorBoundary name="Quick Actions">
              <QuickActionsGrid variant="academy" />
            </SectionErrorBoundary>
          </div>
        </motion.div>
      </motion.div>
    </AppLayout>
  );
}

function TeacherDashboard({ firstName }: { firstName: string }) {
  const { data: stats, isLoading } = useTeacherDashboardStats();
  const isFirstMount = useFirstMount();

  return (
    <AppLayout>
      <motion.div
        variants={containerVariants}
        initial={isFirstMount ? "hidden" : "visible"}
        animate="visible"
        className="space-y-6"
      >
        {/* Hero Section */}
        <motion.div variants={itemVariants}>
          <SectionErrorBoundary name="Dashboard Hero">
            <DashboardHero
              firstName={firstName}
              todayLessons={stats?.todayLessons}
              hasStudents={(stats?.myStudentsCount ?? 0) > 0}
            />
          </SectionErrorBoundary>
        </motion.div>

        {/* Urgent Actions Bar */}
        <motion.div variants={itemVariants}>
          <SectionErrorBoundary name="Urgent Actions">
            <UrgentActionsBar />
          </SectionErrorBoundary>
        </motion.div>

        {/* Upgrade Banner */}
        <motion.div variants={itemVariants}>
          <SectionErrorBoundary name="Upgrade Banner">
            <UpgradeBanner variant="compact" />
          </SectionErrorBoundary>
        </motion.div>

        {/* Stats Grid */}
        <motion.div variants={itemVariants}>
          {isLoading ? (
            <GridSkeleton count={4} columns={4} />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                title="Today's Lessons"
                value={stats?.todayLessons ?? 0}
                subtitle={stats?.todayLessons === 0 ? 'No lessons scheduled' : 'lessons today'}
                icon={Calendar}
                href="/calendar"
                variant="teal"
              />
              <StatCard
                title="My Students"
                value={stats?.myStudentsCount ?? 0}
                subtitle="students in your care"
                icon={Users}
                href="/students"
                variant="coral"
              />
              <StatCard
                title="This Month"
                value={stats?.lessonsThisMonth ?? 0}
                subtitle="lessons completed"
                icon={Clock}
                href="/reports/lessons"
                variant="violet"
              />
              <StatCard
                title="Hours This Week"
                value={stats?.hoursThisWeek ?? 0}
                subtitle="teaching hours"
                icon={TrendingUp}
                href="/calendar"
                variant="emerald"
              />
            </div>
          )}
        </motion.div>

        {/* Main Content Grid */}
        <motion.div variants={itemVariants} className="grid gap-6 lg:grid-cols-5">
          <SectionErrorBoundary name="Today's Timeline">
            <TodayTimeline className="lg:col-span-3" />
          </SectionErrorBoundary>
          <SectionErrorBoundary name="Quick Actions">
            <QuickActionsGrid variant="teacher" className="lg:col-span-2" />
          </SectionErrorBoundary>
        </motion.div>
      </motion.div>
    </AppLayout>
  );
}
