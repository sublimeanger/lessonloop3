import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useOrg } from '@/contexts/OrgContext';
import { useFeatureGate, Feature, PLAN_NAMES } from '@/hooks/useFeatureGate';
import { Banknote, Clock, TrendingUp, ChevronRight, Calendar, XCircle, MapPin, Lock, Sparkles } from 'lucide-react';

interface Report {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  status: 'available' | 'coming_soon';
  roles: string[];
  requiredFeature?: Feature;
}

const reports: Report[] = [
  {
    id: 'revenue',
    title: 'Revenue',
    description: 'Track income from paid invoices over time',
    icon: TrendingUp,
    href: '/reports/revenue',
    status: 'available',
    roles: ['owner', 'admin', 'finance'],
    requiredFeature: 'advanced_reports',
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
    requiredFeature: 'payroll_reports',
  },
  {
    id: 'utilisation',
    title: 'Room Utilisation',
    description: 'Analyse how effectively your teaching spaces are used',
    icon: MapPin,
    href: '/reports/utilisation',
    status: 'available',
    roles: ['owner', 'admin'],
    requiredFeature: 'multi_location',
  },
];

function ReportCard({ report }: { report: Report }) {
  const featureGate = useFeatureGate(report.requiredFeature || 'advanced_reports');
  const Icon = report.icon;
  const isAvailable = report.status === 'available';
  
  // Check if feature is gated
  const isLocked = report.requiredFeature && !featureGate.hasAccess;

  if (!isAvailable) {
    return (
      <Card className="h-full opacity-60">
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
  }

  if (isLocked) {
    return (
      <Card className="h-full border-dashed opacity-80">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
              <Lock className="h-5 w-5 text-muted-foreground" />
            </div>
            <Badge variant="outline" className="text-xs gap-1">
              <Sparkles className="h-3 w-3" />
              {featureGate.requiredPlanName}
            </Badge>
          </div>
          <CardTitle className="mt-3 text-lg">{report.title}</CardTitle>
          <CardDescription>{report.description}</CardDescription>
          <Link 
            to="/settings?tab=billing" 
            className="mt-2 inline-flex items-center text-xs font-medium text-primary hover:underline"
          >
            Upgrade to unlock
            <ChevronRight className="h-3 w-3 ml-0.5" />
          </Link>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Link to={report.href}>
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
  );
}

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
        {availableReports.map((report) => (
          <ReportCard key={report.id} report={report} />
        ))}
      </div>
    </AppLayout>
  );
}
