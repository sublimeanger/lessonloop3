import { useEffect, useState } from 'react';
import { useRealtimeInvoices } from '@/hooks/useRealtimeInvoices';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useOrg } from '@/contexts/OrgContext';
import { useDashboardStats } from '@/hooks/useReports';
import { useTeacherDashboardStats } from '@/hooks/useTeacherDashboard';
import { useUrgentActions } from '@/hooks/useUrgentActions';
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
  LoopAssistWidget,
  LoopAssistAlerts,
  CalendarSyncBanner,
} from '@/components/dashboard';
import { 
  Calendar, Users, Receipt, Clock, TrendingUp, PoundSterling,
  Building2, Loader2, AlertCircle, ChevronRight, BookOpen, X, Settings, CalendarDays
} from 'lucide-react';
import { differenceInDays } from 'date-fns';
import { Link } from 'react-router-dom';

const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] as const } },
};

export default function Dashboard() {
  const { profile } = useAuth();
  const { currentOrg, currentRole, hasOrgs, isLoading: orgLoading, hasInitialised } = useOrg();
  const navigate = useNavigate();
  useRealtimeInvoices();
  
  const isParent = currentRole === 'parent';
  const isTeacher = currentRole === 'teacher';
  const isSoloTeacher = currentOrg?.org_type === 'solo_teacher' || currentOrg?.org_type === 'studio';
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
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!hasOrgs || !currentOrg) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-md py-12 px-4">
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

  if (isTeacher && isAcademyOrAgency) {
    return <TeacherDashboard firstName={firstName} />;
  }

  if (isAcademyOrAgency) {
    return <AcademyDashboard firstName={firstName} orgName={currentOrg.name} />;
  }

  return <SoloTeacherDashboard firstName={firstName} />;
}



function SoloTeacherDashboard({ firstName }: { firstName: string }) {
  const { currentOrg } = useOrg();
  const { data: stats, isLoading } = useDashboardStats();
  const { actions } = useUrgentActions();
  const needsAttendance = actions.find(a => a.type === 'unmarked_lessons')?.count ?? 0;

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
        className="space-y-4 sm:space-y-6"
        initial="hidden"
        animate="visible"
        variants={{ visible: { transition: { staggerChildren: 0.06 } } }}
      >
        <motion.div variants={itemVariants}>
          <SectionErrorBoundary name="Dashboard Hero">
            <DashboardHero
              firstName={firstName}
              todayLessons={stats?.todayLessons}
              needsAttendance={needsAttendance}
              outstandingAmount={stats?.outstandingAmount}
              currencyCode={currentOrg?.currency_code}
              hasStudents={(stats?.activeStudents ?? 0) > 0}
              hasLessons={(stats?.totalLessons ?? 0) > 0}
              timezone={currentOrg?.timezone}
            />
          </SectionErrorBoundary>
        </motion.div>

        <motion.div variants={itemVariants}>
          <SectionErrorBoundary name="First Run Experience">
            <FirstRunExperience />
          </SectionErrorBoundary>
        </motion.div>

        <motion.div variants={itemVariants}>
          <SectionErrorBoundary name="Urgent Actions">
            <UrgentActionsBar />
          </SectionErrorBoundary>
        </motion.div>

        <motion.div variants={itemVariants}>
          <SectionErrorBoundary name="LoopAssist Alerts">
            <LoopAssistAlerts />
          </SectionErrorBoundary>
        </motion.div>

        <motion.div variants={itemVariants}>
          <CalendarSyncBanner />
        </motion.div>

        <motion.div variants={itemVariants}>
          <SectionErrorBoundary name="Upgrade Banner">
            <UpgradeBanner />
          </SectionErrorBoundary>
        </motion.div>

        <motion.div variants={itemVariants}>
          <SectionErrorBoundary name="Onboarding Checklist">
            <OnboardingChecklist />
          </SectionErrorBoundary>
        </motion.div>

        <motion.div variants={itemVariants}>
          <LoopAssistWidget />
        </motion.div>

        {/* Stats Grid — 6 cards, 2 cols mobile, 3 cols desktop */}
        <motion.div variants={itemVariants}>
          {isLoading ? (
            <GridSkeleton count={6} columns={4} />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
              <StatCard title="Today's Lessons" value={stats?.todayLessons ?? 0} subtitle="Across all teachers" icon={Calendar} href="/calendar" variant="teal" />
              <StatCard title="Active Students" value={stats?.activeStudents ?? 0} subtitle="Currently enrolled" icon={Users} href="/students" variant="coral" />
              <StatCard title="This Week" value={`${stats?.lessonsThisWeek ?? 0} lessons`} subtitle={`${stats?.hoursThisWeek ?? 0} teaching hours`} icon={Clock} href="/calendar" variant="emerald" />
              <StatCard title="Revenue (MTD)" value={formatCurrency(stats?.revenueMTD ?? 0)} subtitle="Month to date" icon={PoundSterling} href="/reports/revenue" variant="violet" />
              <StatCard title="Outstanding" value={formatCurrency(stats?.outstandingAmount ?? 0)} subtitle={(stats?.overdueCount ?? 0) > 0 ? `${stats?.overdueCount} overdue` : (stats?.outstandingAmount ?? 0) > 0 ? 'Awaiting payment' : 'All invoices paid'} icon={Receipt} href="/invoices" variant="coral" />
              <StatCard title="Total Lessons" value={stats?.totalLessons ?? 0} subtitle="All time" icon={BookOpen} href="/reports/lessons" variant="teal" />
            </div>
          )}
        </motion.div>

        {/* Main Content Grid — stacked on mobile, side-by-side on lg */}
        <motion.div variants={itemVariants} className="grid gap-4 sm:gap-6 lg:grid-cols-8">
          <SectionErrorBoundary name="Today's Timeline">
            <TodayTimeline className="lg:col-span-5" />
          </SectionErrorBoundary>
          <SectionErrorBoundary name="Quick Actions">
            <QuickActionsGrid variant="solo" className="lg:col-span-3" />
          </SectionErrorBoundary>
        </motion.div>
      </motion.div>
    </AppLayout>
  );
}

function AcademyDashboard({ firstName, orgName }: { firstName: string; orgName?: string }) {
  const { currentOrg } = useOrg();
  const { data: stats, isLoading } = useDashboardStats();
  const { actions } = useUrgentActions();
  const needsAttendance = actions.find(a => a.type === 'unmarked_lessons')?.count ?? 0;

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
        className="space-y-4 sm:space-y-6"
        initial="hidden"
        animate="visible"
        variants={{ visible: { transition: { staggerChildren: 0.06 } } }}
      >
        <motion.div variants={itemVariants}>
          <SectionErrorBoundary name="Dashboard Hero">
            <DashboardHero
              firstName={firstName}
              todayLessons={stats?.todayLessons}
              needsAttendance={needsAttendance}
              outstandingAmount={stats?.outstandingAmount}
              currencyCode={currentOrg?.currency_code}
              hasStudents={(stats?.activeStudents ?? 0) > 0}
              hasLessons={(stats?.totalLessons ?? 0) > 0}
              timezone={currentOrg?.timezone}
            />
          </SectionErrorBoundary>
        </motion.div>

        <motion.div variants={itemVariants}>
          <SectionErrorBoundary name="First Run Experience">
            <FirstRunExperience />
          </SectionErrorBoundary>
        </motion.div>

        <motion.div variants={itemVariants}>
          <SectionErrorBoundary name="Urgent Actions">
            <UrgentActionsBar />
          </SectionErrorBoundary>
        </motion.div>

        <motion.div variants={itemVariants}>
          <SectionErrorBoundary name="LoopAssist Alerts">
            <LoopAssistAlerts />
          </SectionErrorBoundary>
        </motion.div>

        <motion.div variants={itemVariants}>
          <CalendarSyncBanner />
        </motion.div>

        <motion.div variants={itemVariants}>
          <SectionErrorBoundary name="Upgrade Banner">
            <UpgradeBanner />
          </SectionErrorBoundary>
        </motion.div>

        <motion.div variants={itemVariants}>
          <LoopAssistWidget />
        </motion.div>

        {/* Stats Grid — 2 cols mobile, 3 cols desktop */}
        <motion.div variants={itemVariants}>
          {isLoading ? (
            <GridSkeleton count={6} columns={4} />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
              <StatCard title="Today's Lessons" value={stats?.todayLessons ?? 0} subtitle="Across all teachers" icon={Calendar} href="/calendar" variant="teal" />
              <StatCard title="Active Students" value={stats?.activeStudents ?? 0} subtitle="Currently enrolled" icon={Users} href="/students" variant="coral" />
              <StatCard title="This Week" value={`${stats?.lessonsThisWeek ?? 0} lessons`} subtitle={`${stats?.hoursThisWeek ?? 0} teaching hours`} icon={Clock} href="/calendar" variant="emerald" />
              <StatCard title="Revenue (MTD)" value={formatCurrency(stats?.revenueMTD ?? 0)} subtitle="Month to date" icon={PoundSterling} href="/reports/revenue" variant="emerald" />
              <StatCard title="Outstanding" value={formatCurrency(stats?.outstandingAmount ?? 0)} subtitle={(stats?.overdueCount ?? 0) > 0 ? `${stats?.overdueCount} overdue` : (stats?.outstandingAmount ?? 0) > 0 ? 'Awaiting payment' : 'All invoices paid'} icon={Receipt} href="/invoices" variant="violet" />
              <StatCard title="Total Lessons" value={stats?.totalLessons ?? 0} subtitle="All time" icon={BookOpen} href="/reports/lessons" variant="teal" />
            </div>
          )}
        </motion.div>

        {/* Main Content Grid */}
        <motion.div variants={itemVariants} className="grid gap-4 sm:gap-6 lg:grid-cols-9">
          <SectionErrorBoundary name="Today's Timeline">
            <TodayTimeline className="lg:col-span-5" />
          </SectionErrorBoundary>
          
          <div className="lg:col-span-4 space-y-4 sm:space-y-6">
            {/* Cancellation Alert Card */}
            <Card className="border-amber-200/50 bg-amber-50/30">
              <CardContent className="p-3 sm:p-4">
                <Link to="/reports/cancellations" className="flex items-center gap-3 group">
                  <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-amber-100 shrink-0">
                    <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">Cancellation Tracking</p>
                    <p className="text-xs text-muted-foreground">Monitor patterns and rates</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform shrink-0" />
                </Link>
              </CardContent>
            </Card>
            
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
  const { profile } = useAuth();
  const { currentOrg } = useOrg();
  const { data: stats, isLoading } = useTeacherDashboardStats();
  const { actions } = useUrgentActions();
  const needsAttendance = actions.find(a => a.type === 'unmarked_lessons')?.count ?? 0;

  const dismissKey = `teacher-welcome-dismissed-${currentOrg?.id}`;
  const [welcomeDismissed, setWelcomeDismissed] = useState(() => localStorage.getItem(dismissKey) === '1');
  const isNewTeacher = profile?.created_at && differenceInDays(new Date(), new Date(profile.created_at)) < 7;
  const showWelcome = isNewTeacher && !welcomeDismissed;

  const dismissWelcome = () => {
    setWelcomeDismissed(true);
    localStorage.setItem(dismissKey, '1');
  };


  return (
    <AppLayout>
      <motion.div
        className="space-y-4 sm:space-y-6 max-w-4xl"
        initial="hidden"
        animate="visible"
        variants={{ visible: { transition: { staggerChildren: 0.06 } } }}
      >
        <motion.div variants={itemVariants}>
          <SectionErrorBoundary name="Dashboard Hero">
            <DashboardHero
              firstName={firstName}
              todayLessons={stats?.todayLessons}
              needsAttendance={needsAttendance}
              hasStudents={(stats?.myStudentsCount ?? 0) > 0}
              timezone={currentOrg?.timezone}
            />
          </SectionErrorBoundary>
        </motion.div>

        {showWelcome && (
          <motion.div variants={itemVariants}>
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="relative flex flex-col gap-3 p-4 sm:p-5">
                <Button variant="ghost" size="icon" className="absolute right-2 top-2 h-11 w-11" onClick={dismissWelcome}>
                  <X className="h-4 w-4" />
                </Button>
                <h3 className="text-section-title tracking-tight">Welcome to {currentOrg?.name}! 🎵</h3>
                <p className="text-body text-muted-foreground">
                  View your schedule, manage attendance, and communicate with students. Here are some things to get started:
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" className="gap-1.5" asChild>
                    <Link to="/settings?tab=availability"><Settings className="h-3.5 w-3.5" />Set Up Availability</Link>
                  </Button>
                  <Button size="sm" className="gap-1.5" asChild>
                    <Link to="/calendar"><CalendarDays className="h-3.5 w-3.5" />View Calendar</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        <motion.div variants={itemVariants}>
          <SectionErrorBoundary name="Urgent Actions">
            <UrgentActionsBar />
          </SectionErrorBoundary>
        </motion.div>

        <motion.div variants={itemVariants}>
          <SectionErrorBoundary name="LoopAssist Alerts">
            <LoopAssistAlerts />
          </SectionErrorBoundary>
        </motion.div>

        <motion.div variants={itemVariants}>
          <SectionErrorBoundary name="Upgrade Banner">
            <UpgradeBanner variant="compact" />
          </SectionErrorBoundary>
        </motion.div>

        <motion.div variants={itemVariants}>
          <LoopAssistWidget />
        </motion.div>

        {/* Stats Grid — 2 cols mobile, 4 cols desktop */}
        <motion.div variants={itemVariants}>
          {isLoading ? (
            <GridSkeleton count={4} columns={4} />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              <StatCard title="Today" value={stats?.todayLessons ?? 0} subtitle="Lessons today" icon={Calendar} variant="teal" />
              <StatCard title="This Month" value={stats?.lessonsThisMonth ?? 0} subtitle="Lessons this month" icon={Clock} variant="coral" />
              <StatCard title="My Students" value={stats?.myStudentsCount ?? 0} subtitle="Assigned to you" icon={Users} href="/students" variant="violet" />
              <StatCard title="Hours (Week)" value={`${stats?.hoursThisWeek ?? 0}h`} subtitle="Teaching hours" icon={TrendingUp} variant="emerald" />
            </div>
          )}
        </motion.div>

        {/* Main Content Grid */}
        <motion.div variants={itemVariants} className="grid gap-4 sm:gap-6 lg:grid-cols-5">
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
