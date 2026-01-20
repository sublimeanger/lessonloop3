import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useOrg } from '@/contexts/OrgContext';
import { Banknote, Clock, TrendingUp, ChevronRight, Calendar, XCircle, MapPin } from 'lucide-react';

const reports = [
  {
    id: 'revenue',
    title: 'Revenue',
    description: 'Track income from paid invoices over time',
    icon: TrendingUp,
    href: '/reports/revenue',
    status: 'available',
    roles: ['owner', 'admin', 'finance'],
  },
  {
    id: 'outstanding',
    title: 'Outstanding Payments',
    description: 'Ageing report for unpaid invoices (0-7, 8-14, 15-30, 30+ days)',
    icon: Clock,
    href: '/reports/outstanding',
    status: 'available',
    roles: ['owner', 'admin', 'finance'],
  },
  {
    id: 'lessons',
    title: 'Lessons Delivered',
    description: 'Analyse lessons by teacher and location',
    icon: Calendar,
    href: '/reports/lessons',
    status: 'available',
    roles: ['owner', 'admin', 'teacher'],
  },
  {
    id: 'cancellations',
    title: 'Cancellation Rate',
    description: 'Track cancellations and identify patterns',
    icon: XCircle,
    href: '/reports/cancellations',
    status: 'available',
    roles: ['owner', 'admin'],
  },
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
    id: 'utilisation',
    title: 'Room Utilisation',
    description: 'Analyse how effectively your teaching spaces are used',
    icon: MapPin,
    href: '/reports/utilisation',
    status: 'coming_soon',
    roles: ['owner', 'admin'],
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
