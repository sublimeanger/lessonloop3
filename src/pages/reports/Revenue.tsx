import { useState } from 'react';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LoadingState } from '@/components/shared/LoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { useRevenueReport, exportRevenueToCSV } from '@/hooks/useReports';
import { useOrg } from '@/contexts/OrgContext';
import { formatCurrency } from '@/lib/utils';
import { Download, TrendingUp, PoundSterling, FileSpreadsheet, Receipt } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function RevenueReport() {
  const { currentOrg } = useOrg();
  
  // Default to last 12 months
  const [startDate, setStartDate] = useState(format(subMonths(new Date(), 11), 'yyyy-MM-01'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));

  const { data, isLoading, error } = useRevenueReport(startDate, endDate);

  const handleExport = () => {
    if (data && currentOrg) {
      exportRevenueToCSV(data, currentOrg.name.replace(/[^a-zA-Z0-9]/g, '_'));
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

      {/* Date Range */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <Label htmlFor="start-date">Start Date</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-[180px]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-date">End Date</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-[180px]"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setStartDate(format(subMonths(new Date(), 11), 'yyyy-MM-01'));
                  setEndDate(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
                }}
              >
                Last 12 Months
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const year = new Date().getFullYear();
                  setStartDate(`${year}-01-01`);
                  setEndDate(`${year}-12-31`);
                }}
              >
                This Year
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <EmptyState icon={FileSpreadsheet} title="Error loading report" description={error.message} />
      ) : !data || data.months.length === 0 ? (
        <EmptyState
          icon={PoundSterling}
          title="Not enough data for reports yet"
          description="Reports will populate as you complete lessons and generate invoices."
        />
      ) : (
        <>
          {/* Summary Cards */}
          <div className="mb-6 grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <PoundSterling className="h-4 w-4" />
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
                      tickFormatter={(value) => `£${value}`}
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
