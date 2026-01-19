import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useRole } from '@/contexts/RoleContext';
import { Calendar, Users, Receipt, Clock } from 'lucide-react';

const stats = [
  { label: 'Today\'s Lessons', value: '8', icon: Calendar, change: '+2 from yesterday' },
  { label: 'Active Students', value: '47', icon: Users, change: '+3 this month' },
  { label: 'Outstanding Invoices', value: '£1,240', icon: Receipt, change: '5 unpaid' },
  { label: 'Hours This Week', value: '32', icon: Clock, change: 'On track' },
];

export default function Dashboard() {
  const { role, isOwnerOrAdmin, isTeacher, isParent } = useRole();

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <AppLayout>
      <PageHeader
        title={`${getGreeting()}!`}
        description={
          isParent
            ? 'View your upcoming lessons and manage payments'
            : 'Here\'s what\'s happening with your teaching today'
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.label}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">{stat.change}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Today's Schedule</CardTitle>
            <CardDescription>Your upcoming lessons for today</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { time: '09:00', student: 'Emma Wilson', subject: 'Piano - Grade 5' },
                { time: '10:00', student: 'James Brown', subject: 'Guitar - Beginner' },
                { time: '11:30', student: 'Sophie Taylor', subject: 'Violin - Grade 3' },
              ].map((lesson) => (
                <div
                  key={lesson.time}
                  className="flex items-center gap-4 rounded-lg border p-3"
                >
                  <div className="text-sm font-medium text-primary">{lesson.time}</div>
                  <div className="flex-1">
                    <div className="font-medium">{lesson.student}</div>
                    <div className="text-sm text-muted-foreground">{lesson.subject}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks at your fingertips</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                'Add New Student',
                'Schedule Lesson',
                'Create Invoice',
                'Send Message',
              ].map((action) => (
                <button
                  key={action}
                  className="rounded-lg border p-3 text-left text-sm font-medium transition-colors hover:bg-accent"
                >
                  {action}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
