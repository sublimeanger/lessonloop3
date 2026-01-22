import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useOrg } from '@/contexts/OrgContext';
import { useDashboardStats } from '@/hooks/useReports';
import { useTeacherDashboardStats } from '@/hooks/useTeacherDashboard';
import { OnboardingChecklist } from '@/components/shared/OnboardingChecklist';
import { GridSkeleton } from '@/components/shared/LoadingState';
import { Calendar, Users, Receipt, Clock, TrendingUp, AlertCircle, Plus, ChevronRight, Building2, Loader2, BookOpen } from 'lucide-react';
import { format, parseISO } from 'date-fns';

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

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

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
        <PageHeader
          title={`${getGreeting()}, ${firstName}!`}
          description="Let's get you set up"
        />
        <Card className="max-w-md mx-auto mt-8">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <Building2 className="h-8 w-8 text-muted-foreground" />
            </div>
            <CardTitle>No Organisation Found</CardTitle>
            <CardDescription>
              It looks like you haven't set up an organisation yet. Complete the onboarding to get started.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button onClick={() => navigate('/onboarding')}>
              Complete Setup
            </Button>
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  // Teacher view within academy/agency
  if (isTeacher && isAcademyOrAgency) {
    return <TeacherDashboard firstName={firstName} greeting={getGreeting()} />;
  }

  if (isAcademyOrAgency) {
    return <AcademyDashboard firstName={firstName} greeting={getGreeting()} orgName={currentOrg?.name} />;
  }

  return <SoloTeacherDashboard firstName={firstName} greeting={getGreeting()} />;
}

function SoloTeacherDashboard({ firstName, greeting }: { firstName: string; greeting: string }) {
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
      <PageHeader
        title={`${greeting}, ${firstName}!`}
        description="Here's what's happening with your teaching today"
      />

      {/* Onboarding Checklist */}
      <OnboardingChecklist className="mb-6" />

      {/* Stats */}
      {isLoading ? (
        <GridSkeleton count={4} columns={4} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Today's Lessons</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.todayLessons ?? 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.todayLessons === 0 ? 'No lessons scheduled' : 'lessons today'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Students</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.activeStudents ?? 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.activeStudents === 0 ? 'Add your first student' : 'enrolled'}
            </p>
          </CardContent>
        </Card>
        <Link to="/reports/outstanding">
          <Card className="cursor-pointer transition-colors hover:bg-muted/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Outstanding</CardTitle>
              <Receipt className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats?.outstandingAmount ?? 0)}</div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                {stats?.outstandingAmount === 0 ? 'All invoices paid' : 'View ageing report'}
                {(stats?.outstandingAmount ?? 0) > 0 && <ChevronRight className="h-3 w-3" />}
              </p>
            </CardContent>
          </Card>
        </Link>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Hours This Week</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.hoursThisWeek ?? 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.hoursThisWeek === 0 ? 'Schedule lessons to track' : 'hours taught'}
            </p>
          </CardContent>
        </Card>
        </div>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {/* Today's Schedule */}
        <Card>
          <CardHeader>
            <CardTitle>Today's Schedule</CardTitle>
            <CardDescription>Your lessons for today</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Calendar className="h-10 w-10 text-muted-foreground/40" />
              <p className="mt-3 font-medium">
                {stats?.todayLessons === 0 ? 'No lessons scheduled yet' : `${stats?.todayLessons} lessons today`}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {stats?.todayLessons === 0 
                  ? 'Click "Add Lesson" to schedule your first lesson'
                  : 'View your calendar for details'}
              </p>
              <Link to="/calendar">
                <Button className="mt-4 gap-2">
                  {stats?.todayLessons === 0 ? (
                    <>
                      <Plus className="h-4 w-4" />
                      Add Lesson
                    </>
                  ) : (
                    <>
                      <Calendar className="h-4 w-4" />
                      View Calendar
                    </>
                  )}
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks at your fingertips</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2">
              <Link to="/students">
                <Button variant="outline" className="w-full justify-start gap-2">
                  <Users className="h-4 w-4" />
                  Add New Student
                </Button>
              </Link>
              <Link to="/calendar">
                <Button variant="outline" className="w-full justify-start gap-2">
                  <Calendar className="h-4 w-4" />
                  Schedule Lesson
                </Button>
              </Link>
              <Link to="/invoices">
                <Button variant="outline" className="w-full justify-start gap-2">
                  <Receipt className="h-4 w-4" />
                  Create Invoice
                </Button>
              </Link>
              <Link to="/reports/revenue">
                <Button variant="outline" className="w-full justify-start gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Revenue Report
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

function AcademyDashboard({ firstName, greeting, orgName }: { firstName: string; greeting: string; orgName?: string }) {
  const { currentOrg } = useOrg();
  const { data: stats } = useDashboardStats();

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
      <PageHeader
        title={`${greeting}, ${firstName}!`}
        description={orgName ? `Managing ${orgName}` : 'Academy dashboard'}
      />

      {/* KPI Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Students</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.activeStudents ?? 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.activeStudents === 0 ? 'Add students to get started' : 'enrolled'}
            </p>
          </CardContent>
        </Card>
        <Link to="/reports/lessons">
          <Card className="cursor-pointer transition-colors hover:bg-muted/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Lessons This Week</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.lessonsThisWeek ?? 0}</div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                View lessons report <ChevronRight className="h-3 w-3" />
              </p>
            </CardContent>
          </Card>
        </Link>
        <Link to="/reports/outstanding">
          <Card className="cursor-pointer transition-colors hover:bg-muted/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Outstanding</CardTitle>
              <Receipt className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats?.outstandingAmount ?? 0)}</div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                View ageing report <ChevronRight className="h-3 w-3" />
              </p>
            </CardContent>
          </Card>
        </Link>
        <Link to="/reports/revenue">
          <Card className="cursor-pointer transition-colors hover:bg-muted/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Revenue MTD</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{formatCurrency(stats?.revenueMTD ?? 0)}</div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                View revenue report <ChevronRight className="h-3 w-3" />
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {/* Cancellations */}
        <Link to="/reports/cancellations">
          <Card className="cursor-pointer transition-colors hover:bg-muted/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-chart-4" />
                Cancellation Tracking
              </CardTitle>
              <CardDescription>Monitor cancellation rates and patterns</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between py-4">
                <p className="text-sm text-muted-foreground">View cancellation report</p>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Admin tasks at your fingertips</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2">
              <Link to="/students">
                <Button variant="outline" className="w-full justify-start gap-2">
                  <Users className="h-4 w-4" />
                  Add Student
                </Button>
              </Link>
              <Link to="/teachers">
                <Button variant="outline" className="w-full justify-start gap-2">
                  <Users className="h-4 w-4" />
                  Invite Teacher
                </Button>
              </Link>
              <Link to="/invoices">
                <Button variant="outline" className="w-full justify-start gap-2">
                  <Receipt className="h-4 w-4" />
                  Run Billing
                </Button>
              </Link>
              <Link to="/reports/payroll">
                <Button variant="outline" className="w-full justify-start gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Payroll Report
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Today Across Locations */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Today Across Locations</CardTitle>
          <CardDescription>Overview of lessons happening today</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Calendar className="h-10 w-10 text-muted-foreground/40" />
            <p className="mt-3 font-medium">
              {stats?.todayLessons === 0 ? 'No lessons today' : `${stats?.todayLessons} lessons scheduled`}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {stats?.todayLessons === 0 
                ? 'Schedule lessons to see them here'
                : 'View your calendar for details'}
            </p>
            <Link to="/calendar">
              <Button variant="outline" className="mt-4 gap-2">
                <Calendar className="h-4 w-4" />
                View Calendar
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </AppLayout>
  );
}

function TeacherDashboard({ firstName, greeting }: { firstName: string; greeting: string }) {
  const { data: stats, isLoading } = useTeacherDashboardStats();

  return (
    <AppLayout>
      <PageHeader
        title={`${greeting}, ${firstName}!`}
        description="Your teaching schedule and students"
      />

      {/* Stats */}
      {isLoading ? (
        <GridSkeleton count={4} columns={4} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Today's Lessons</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.todayLessons ?? 0}</div>
              <p className="text-xs text-muted-foreground">
                {stats?.todayLessons === 0 ? 'No lessons today' : 'lessons scheduled'}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">My Students</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.myStudentsCount ?? 0}</div>
              <p className="text-xs text-muted-foreground">assigned to you</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Hours This Week</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.hoursThisWeek ?? 0}</div>
              <p className="text-xs text-muted-foreground">teaching hours</p>
            </CardContent>
          </Card>
          <Link to="/reports/lessons">
            <Card className="cursor-pointer transition-colors hover:bg-muted/50 h-full">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Lessons This Month</CardTitle>
                <BookOpen className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.lessonsThisMonth ?? 0}</div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  completed <ChevronRight className="h-3 w-3" />
                </p>
              </CardContent>
            </Card>
          </Link>
        </div>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {/* Upcoming Lessons */}
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Lessons</CardTitle>
            <CardDescription>Your next scheduled lessons</CardDescription>
          </CardHeader>
          <CardContent>
            {!stats?.upcomingLessons || stats.upcomingLessons.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Calendar className="h-10 w-10 text-muted-foreground/40" />
                <p className="mt-3 font-medium">No upcoming lessons</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Check back when new lessons are scheduled
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {stats.upcomingLessons.map((lesson) => (
                  <div key={lesson.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="font-medium">{lesson.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {format(parseISO(lesson.start_at), 'EEE d MMM, HH:mm')}
                        {lesson.location_name && ` • ${lesson.location_name}`}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                ))}
              </div>
            )}
            <Link to="/calendar" className="block mt-4">
              <Button variant="outline" className="w-full gap-2">
                <Calendar className="h-4 w-4" />
                View Full Calendar
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks at your fingertips</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2">
              <Link to="/calendar">
                <Button variant="outline" className="w-full justify-start gap-2">
                  <Calendar className="h-4 w-4" />
                  View Calendar
                </Button>
              </Link>
              <Link to="/students">
                <Button variant="outline" className="w-full justify-start gap-2">
                  <Users className="h-4 w-4" />
                  My Students
                </Button>
              </Link>
              <Link to="/reports/lessons">
                <Button variant="outline" className="w-full justify-start gap-2">
                  <BookOpen className="h-4 w-4" />
                  Lessons Report
                </Button>
              </Link>
              <Link to="/reports/payroll">
                <Button variant="outline" className="w-full justify-start gap-2">
                  <Receipt className="h-4 w-4" />
                  My Payroll
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
