import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useOrg } from '@/contexts/OrgContext';
import { Banknote, BarChart3, Clock, Users, TrendingUp, ChevronRight } from 'lucide-react';

const reports = [
  {
    id: 'payroll',
    title: 'Payroll',
    description: 'Calculate gross pay for teachers based on completed lessons',
    icon: Banknote,
    href: '/reports/payroll',
    status: 'available',
    roles: ['owner', 'admin', 'teacher'],
  },
  {
    id: 'revenue',
    title: 'Revenue',
    description: 'Track income from invoices and payments over time',
    icon: TrendingUp,
    href: '/reports/revenue',
    status: 'coming_soon',
    roles: ['owner', 'admin', 'finance'],
  },
  {
    id: 'outstanding',
    title: 'Outstanding Payments',
    description: 'View ageing report for unpaid invoices',
    icon: Clock,
    href: '/reports/outstanding',
    status: 'coming_soon',
    roles: ['owner', 'admin', 'finance'],
  },
  {
    id: 'utilisation',
    title: 'Room Utilisation',
    description: 'Analyse how effectively your teaching spaces are being used',
    icon: BarChart3,
    href: '/reports/utilisation',
    status: 'coming_soon',
    roles: ['owner', 'admin'],
  },
  {
    id: 'students',
    title: 'Student Activity',
    description: 'Track lesson attendance and student engagement',
    icon: Users,
    href: '/reports/students',
    status: 'coming_soon',
    roles: ['owner', 'admin', 'teacher'],
  },
];

export default function Reports() {
  const { currentRole } = useOrg();

  // Filter reports by role
  const availableReports = reports.filter((report) =>
    report.roles.includes(currentRole || '')
  );

  return (
    <AppLayout>
      <PageHeader
        title="Reports"
        description="Analytics and insights for your teaching business"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Reports' },
        ]}
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {availableReports.map((report) => {
          const Icon = report.icon;
          const isAvailable = report.status === 'available';

          return isAvailable ? (
            <Link key={report.id} to={report.href}>
              <Card className="h-full transition-all hover:border-primary/50 hover:shadow-md cursor-pointer">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <CardTitle className="mt-3 text-lg">{report.title}</CardTitle>
                  <CardDescription>{report.description}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ) : (
            <Card key={report.id} className="h-full opacity-60">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <Badge variant="secondary" className="text-xs">Coming Soon</Badge>
                </div>
                <CardTitle className="mt-3 text-lg">{report.title}</CardTitle>
                <CardDescription>{report.description}</CardDescription>
              </CardHeader>
            </Card>
          );
        })}
      </div>
    </AppLayout>
  );
}
