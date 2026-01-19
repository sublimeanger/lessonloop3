import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useOrg } from '@/contexts/OrgContext';
import { Calendar, Users, Receipt, Clock } from 'lucide-react';

const stats = [
  { label: 'Today\'s Lessons', value: '0', icon: Calendar, change: 'No lessons scheduled' },
  { label: 'Active Students', value: '0', icon: Users, change: 'Add your first student' },
  { label: 'Outstanding Invoices', value: '£0', icon: Receipt, change: 'All paid up' },
  { label: 'Hours This Week', value: '0', icon: Clock, change: 'Schedule lessons to track' },
];

export default function Dashboard() {
  const { profile } = useAuth();
  const { currentOrg, currentRole } = useOrg();
  const isParent = currentRole === 'parent';

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const firstName = profile?.full_name?.split(' ')[0] || 'there';

  return (
    <AppLayout>
      <PageHeader
        title={`${getGreeting()}, ${firstName}!`}
        description={
          isParent
            ? 'View your upcoming lessons and manage payments'
            : currentOrg 
              ? `Managing ${currentOrg.name}`
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
            <div className="flex items-center justify-center py-8 text-center">
              <div>
                <Calendar className="mx-auto h-8 w-8 text-muted-foreground/50" />
                <p className="mt-2 text-sm text-muted-foreground">
                  No lessons scheduled for today
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Go to Calendar to schedule your first lesson
                </p>
              </div>
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
