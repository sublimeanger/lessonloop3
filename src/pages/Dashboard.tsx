import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useOrg } from '@/contexts/OrgContext';
import { Calendar, Users, Receipt, Clock, TrendingUp, AlertCircle, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const { profile } = useAuth();
  const { currentOrg, currentRole } = useOrg();
  
  const isParent = currentRole === 'parent';
  const isSoloTeacher = currentOrg?.org_type === 'solo_teacher' || currentOrg?.org_type === 'studio';
  const isAcademyOrAgency = currentOrg?.org_type === 'academy' || currentOrg?.org_type === 'agency';

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const firstName = profile?.full_name?.split(' ')[0] || 'there';

  if (isParent) {
    return <ParentDashboard firstName={firstName} greeting={getGreeting()} />;
  }

  if (isAcademyOrAgency) {
    return <AcademyDashboard firstName={firstName} greeting={getGreeting()} orgName={currentOrg?.name} />;
  }

  return <SoloTeacherDashboard firstName={firstName} greeting={getGreeting()} />;
}

function SoloTeacherDashboard({ firstName, greeting }: { firstName: string; greeting: string }) {
  return (
    <AppLayout>
      <PageHeader
        title={`${greeting}, ${firstName}!`}
        description="Here's what's happening with your teaching today"
      />

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Today's Lessons</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">No lessons scheduled yet</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Students</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">Add your first student</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Outstanding</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">£0</div>
            <p className="text-xs text-muted-foreground">All invoices paid</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Hours This Week</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">Schedule lessons to track</p>
          </CardContent>
        </Card>
      </div>

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
              <p className="mt-3 font-medium">No lessons scheduled yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Click "Add Lesson" to schedule your first lesson
              </p>
              <Link to="/calendar">
                <Button className="mt-4 gap-2">
                  <Plus className="h-4 w-4" />
                  Add Lesson
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
              <Link to="/messages">
                <Button variant="outline" className="w-full justify-start gap-2">
                  <Clock className="h-4 w-4" />
                  Send Reminder
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
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">Add students to get started</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Lessons This Week</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">No lessons scheduled</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Outstanding</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">£0</div>
            <p className="text-xs text-muted-foreground">All invoices paid</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Revenue MTD</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">£0</div>
            <p className="text-xs text-muted-foreground">Month to date</p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {/* Cancellations */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-warning" />
              Cancellations Needing Action
            </CardTitle>
            <CardDescription>Lessons cancelled or needing rescheduling</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <AlertCircle className="h-10 w-10 text-muted-foreground/40" />
              <p className="mt-3 font-medium">No pending cancellations</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Cancelled lessons will appear here for review
              </p>
            </div>
          </CardContent>
        </Card>

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
              <Link to="/reports">
                <Button variant="outline" className="w-full justify-start gap-2">
                  <TrendingUp className="h-4 w-4" />
                  View Reports
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
            <p className="mt-3 font-medium">No lessons today</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Schedule lessons to see them here
            </p>
          </div>
        </CardContent>
      </Card>
    </AppLayout>
  );
}

function ParentDashboard({ firstName, greeting }: { firstName: string; greeting: string }) {
  return (
    <AppLayout>
      <PageHeader
        title={`${greeting}, ${firstName}!`}
        description="View your upcoming lessons and manage payments"
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Upcoming Lessons */}
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Lessons</CardTitle>
            <CardDescription>Your scheduled lessons</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Calendar className="h-10 w-10 text-muted-foreground/40" />
              <p className="mt-3 font-medium">No upcoming lessons</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Contact your teacher to schedule lessons
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Outstanding Invoices */}
        <Card>
          <CardHeader>
            <CardTitle>Outstanding Invoices</CardTitle>
            <CardDescription>Invoices awaiting payment</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Receipt className="h-10 w-10 text-muted-foreground/40" />
              <p className="mt-3 font-medium">No outstanding invoices</p>
              <p className="mt-1 text-sm text-muted-foreground">
                You're all paid up!
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
