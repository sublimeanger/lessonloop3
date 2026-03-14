import { motion } from 'framer-motion';
import { AppLayout } from '@/components/layout/AppLayout';
import { useOrg } from '@/contexts/OrgContext';
import { useDashboardStats } from '@/hooks/useReports';
import { GridSkeleton } from '@/components/shared/LoadingState';
import { SectionErrorBoundary } from '@/components/shared/SectionErrorBoundary';
import { StatsGrid } from '@/components/shared/StatsGrid';
import { StatCard } from '@/components/dashboard/StatCard';
import { DashboardHero } from '@/components/dashboard/DashboardHero';
import { PoundSterling, Receipt, AlertTriangle, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] as const } },
};

interface FinanceDashboardProps {
  firstName: string;
}

export function FinanceDashboard({ firstName }: FinanceDashboardProps) {
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
      <motion.div
        className="flex flex-col gap-4 sm:gap-6 max-w-5xl"
        initial="hidden"
        animate="visible"
        variants={{ visible: { transition: { staggerChildren: 0.06 } } }}
      >
        <motion.div variants={itemVariants}>
          <SectionErrorBoundary name="Dashboard Hero">
            <DashboardHero
              firstName={firstName}
              currencyCode={currentOrg?.currency_code}
              outstandingAmount={stats?.outstandingAmount}
            />
          </SectionErrorBoundary>
        </motion.div>

        {/* Stats Grid */}
        <motion.div variants={itemVariants}>
          {isLoading ? (
            <GridSkeleton count={4} columns={4} />
          ) : (
            <StatsGrid>
              <StatCard
                title="Revenue (MTD)"
                value={formatCurrency(stats?.revenueMTD ?? 0)}
                subtitle="Month to date"
                icon={PoundSterling}
                href="/reports/revenue"
                variant="emerald"
              />
              <StatCard
                title="Outstanding"
                value={formatCurrency(stats?.outstandingAmount ?? 0)}
                subtitle="Awaiting payment"
                icon={Receipt}
                href="/invoices"
                variant="violet"
              />
              <StatCard
                title="Overdue"
                value={`${stats?.overdueCount ?? 0} invoices`}
                subtitle="Require follow-up"
                icon={AlertTriangle}
                href="/invoices?status=overdue"
                variant="coral"
              />
              <StatCard
                title="Total Lessons"
                value={stats?.totalLessons ?? 0}
                subtitle="All time"
                icon={FileText}
                href="/reports"
                variant="teal"
              />
            </StatsGrid>
          )}
        </motion.div>

        {/* Quick Links */}
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <CardTitle className="text-section-title">Quick Links</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Button variant="outline" asChild>
                <Link to="/invoices">View All Invoices</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/reports/revenue">Revenue Report</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/reports">All Reports</Link>
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </AppLayout>
  );
}