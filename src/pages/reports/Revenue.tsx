import { useState } from 'react';
import { Link } from 'react-router-dom';
import { format, subMonths, endOfMonth } from 'date-fns';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DateRangeFilter } from '@/components/reports/DateRangeFilter';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ReportSkeleton } from '@/components/reports/ReportSkeleton';
import { EmptyState } from '@/components/shared/EmptyState';
import { useRevenueReport, exportRevenueToCSV } from '@/hooks/useReports';
import { useOrg } from '@/contexts/OrgContext';
import { formatCurrency, currencySymbol } from '@/lib/utils';
import { Download, TrendingUp, PoundSterling, FileSpreadsheet, Receipt } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useToast } from '@/hooks/use-toast';

export default function RevenueReport() {
  const { currentOrg } = useOrg();
  const { toast } = useToast();
  
  // Default to last 12 months
  const [startDate, setStartDate] = useState(format(subMonths(new Date(), 11), 'yyyy-MM-01'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));

  const { data, isLoading, error } = useRevenueReport(startDate, endDate);

  const handleExport = () => {
    if (data && currentOrg) {
      try {
        exportRevenueToCSV(data, currentOrg.name.replace(/[^a-zA-Z0-9]/g, '_'), currentOrg.currency_code);
        toast({ title: 'Report exported', description: 'CSV file has been downloaded.' });
      } catch {
        toast({ title: 'Export failed', description: 'Something went wrong. Please try again.', variant: 'destructive' });
      }
    }
  };

  const fmtCurrency = (amount: number) => formatCurrency(amount, currentOrg?.currency_code || 'GBP');

  return (
    <AppLayout>
      <PageHeader
        title="Revenue Report"
        description="Track income from paid invoices over time"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Reports', href: '/reports' },
          { label: 'Revenue' },
        ]}
        actions={
          data && data.months.length > 0 && (
            <Button onClick={handleExport} variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          )
        }
      />

      <DateRangeFilter
        startDate={startDate}
        endDate={endDate}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
      />

      {isLoading ? (
        <ReportSkeleton variant="summary-chart-table" />
      ) : error ? (
        <EmptyState icon={FileSpreadsheet} title="Error loading report" description={error.message} />
      ) : !data || data.months.length === 0 ? (
        <EmptyState
          icon={TrendingUp}
          title="Not enough data for reports yet"
          description="Reports will populate as you complete lessons and generate invoices."
        >
          <Button asChild>
            <Link to="/invoices">Create your first invoice →</Link>
          </Button>
        </EmptyState>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="mb-6 grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Total Revenue
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-primary">{fmtCurrency(data.totalRevenue)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Average Monthly
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{fmtCurrency(data.averageMonthly)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <Receipt className="h-4 w-4" />
                  Invoices Paid
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  {data.months.reduce((sum, m) => sum + m.invoiceCount, 0)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Chart */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Revenue by Month</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.months}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="monthLabel" className="text-xs" />
                    <YAxis 
                      tickFormatter={(value) => `${currencySymbol(currentOrg?.currency_code || 'GBP')}${value}`}
                      className="text-xs"
                    />
                    <Tooltip 
                      formatter={(value: number) => [fmtCurrency(value), 'Revenue']}
                      labelClassName="font-medium"
                    />
                    <Bar dataKey="paidAmount" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Table */}
          <Card>
            <CardHeader>
              <CardTitle>Monthly Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Month</TableHead>
                    <TableHead className="text-right">Invoices Paid</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.months.map((month) => (
                    <TableRow key={month.month}>
                      <TableCell className="font-medium">{month.monthLabel}</TableCell>
                      <TableCell className="text-right">{month.invoiceCount}</TableCell>
                      <TableCell className="text-right font-medium">{fmtCurrency(month.paidAmount)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell>Total</TableCell>
                    <TableCell className="text-right">
                      {data.months.reduce((sum, m) => sum + m.invoiceCount, 0)}
                    </TableCell>
                    <TableCell className="text-right text-primary">{fmtCurrency(data.totalRevenue)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </AppLayout>
  );
}
