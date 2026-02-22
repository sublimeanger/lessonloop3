import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { DateRangeFilter } from '@/components/reports/DateRangeFilter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ReportSkeleton } from '@/components/reports/ReportSkeleton';
import { EmptyState } from '@/components/shared/EmptyState';
import { useAgeingReport, exportAgeingToCSV } from '@/hooks/useReports';
import { ReportPagination, paginateArray } from '@/components/reports/ReportPagination';
import { useOrg } from '@/contexts/OrgContext';
import { formatCurrency, formatDateUK } from '@/lib/utils';
import { Download, Clock, AlertTriangle, CheckCircle, ChevronDown, ChevronRight, Send, Megaphone, Printer } from 'lucide-react';
import { useTerms } from '@/hooks/useTerms';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { format, subMonths } from 'date-fns';

export default function OutstandingReport() {
  const { currentOrg } = useOrg();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { data: terms } = useTerms();
  const [startDate, setStartDate] = useState(() => format(subMonths(new Date(), 12), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const { data, isLoading, isFetching, error } = useAgeingReport(startDate, endDate);
  const [expandedBuckets, setExpandedBuckets] = useState<Set<string>>(new Set(['Current (0-7 days)']));
  const [bucketPages, setBucketPages] = useState<Record<string, number>>({});

  const toggleBucket = (label: string) => {
    const newExpanded = new Set(expandedBuckets);
    if (newExpanded.has(label)) {
      newExpanded.delete(label);
    } else {
      newExpanded.add(label);
    }
    setExpandedBuckets(newExpanded);
  };

  const handleExport = () => {
    if (data && currentOrg) {
      try {
        exportAgeingToCSV(data, currentOrg.name.replace(/[^a-zA-Z0-9]/g, '_'), currentOrg.currency_code);
        toast({ title: 'Report exported', description: 'CSV file has been downloaded.' });
      } catch {
        toast({ title: 'Export failed', description: 'Something went wrong. Please try again.', variant: 'destructive' });
      }
    }
  };

  const fmtCurrency = (amount: number) => formatCurrency(amount, currentOrg?.currency_code || 'GBP');

  const getBucketIcon = (label: string) => {
    if (label.includes('0-7')) return <CheckCircle className="h-5 w-5 text-primary" />;
    if (label.includes('8-14')) return <Clock className="h-5 w-5 text-chart-3" />;
    if (label.includes('15-30')) return <AlertTriangle className="h-5 w-5 text-chart-4" />;
    return <AlertTriangle className="h-5 w-5 text-destructive" />;
  };

  const getBucketBadgeVariant = (label: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    if (label.includes('0-7')) return 'secondary';
    if (label.includes('8-14')) return 'outline';
    if (label.includes('15-30')) return 'default';
    return 'destructive';
  };

  return (
    <AppLayout>
      <PageHeader
        title="Outstanding Payments"
        description="Ageing report for unpaid invoices"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Reports', href: '/reports' },
          { label: 'Outstanding' },
        ]}
        actions={
          data && data.totalOutstanding > 0 && (
            <div className="flex items-center gap-2">
              <Button onClick={() => window.print()} variant="outline" className="gap-2 print:hidden">
                <Printer className="h-4 w-4" />
                Print
              </Button>
              <Button onClick={handleExport} variant="outline" className="gap-2 print:hidden">
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
            </div>
          )
        }
      />

      <DateRangeFilter
        startDate={startDate}
        endDate={endDate}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        terms={terms}
      />

      {data?.truncated && (
        <Alert variant="destructive" className="mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Results may be incomplete — you have a large number of outstanding invoices. Try narrowing the date range.
          </AlertDescription>
        </Alert>
      )}

      {isLoading && !data ? (
        <ReportSkeleton variant="summary-table" />
      ) : error && !data ? (
        <EmptyState icon={Clock} title="Error loading report" description={error.message} />
      ) : !data || data.totalOutstanding === 0 ? (
        <EmptyState
          icon={CheckCircle}
          title="All paid up!"
          description="There are no outstanding invoices."
        />
      ) : (
        <div className={`transition-opacity duration-300 ${isFetching ? 'opacity-60 pointer-events-none' : 'opacity-100'}`}>
          {/* Summary Cards */}
          <div className="mb-6 grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Outstanding</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{fmtCurrency(data.totalOutstanding)}</p>
                <p className="text-sm text-muted-foreground">
                  {data.buckets.reduce((sum, b) => sum + b.count, 0)} invoices
                </p>
              </CardContent>
            </Card>
            <Card className={data.totalOverdue > 0 ? 'border-destructive/50' : ''}>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  {data.totalOverdue > 0 && <AlertTriangle className="h-4 w-4 text-destructive" />}
                  Total Overdue
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className={`text-2xl font-bold ${data.totalOverdue > 0 ? 'text-destructive' : ''}`}>
                  {fmtCurrency(data.totalOverdue)}
                </p>
                <p className="text-sm text-muted-foreground">Past due date</p>
              </CardContent>
            </Card>
          </div>

          {/* Ageing Buckets */}
          <div className="space-y-4">
            {data.buckets.map((bucket) => (
              <Card key={bucket.label}>
                <Collapsible
                  open={expandedBuckets.has(bucket.label)}
                  onOpenChange={() => toggleBucket(bucket.label)}
                >
                  <CollapsibleTrigger className="w-full">
                    <CardHeader className="flex flex-row items-center justify-between py-4 hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-3">
                        {getBucketIcon(bucket.label)}
                        <div className="text-left">
                          <CardTitle className="text-base">{bucket.label}</CardTitle>
                          <CardDescription>
                            {bucket.count} invoice{bucket.count !== 1 ? 's' : ''}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {bucket.label.includes('30+') && bucket.count > 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5"
                            onClick={(e) => {
                              e.stopPropagation();
                              toast({ title: 'Coming soon', description: 'Bulk reminders coming soon.' });
                            }}
                          >
                            <Megaphone className="h-3.5 w-3.5" />
                            Chase All
                          </Button>
                        )}
                        <Badge variant={getBucketBadgeVariant(bucket.label)}>
                          {fmtCurrency(bucket.totalAmount)}
                        </Badge>
                        {expandedBuckets.has(bucket.label) ? (
                          <ChevronDown className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    {bucket.invoices.length > 0 && (
                      <CardContent className="pt-0">
                        <div className="overflow-x-auto">
                        <Table className="min-w-[600px]">
                          <TableHeader>
                            <TableRow>
                              <TableHead>Invoice</TableHead>
                              <TableHead>Payer</TableHead>
                              <TableHead>Due Date</TableHead>
                              <TableHead className="text-right">Days Overdue</TableHead>
                              <TableHead className="text-right">Amount</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {paginateArray(bucket.invoices, bucketPages[bucket.label] || 1).map((inv) => (
                              <TableRow key={inv.id}>
                                <TableCell>
                                  <Link 
                                    to={`/invoices/${inv.id}`}
                                    className="font-medium text-primary hover:underline"
                                  >
                                    {inv.invoiceNumber}
                                  </Link>
                                </TableCell>
                                <TableCell>{inv.payerName}</TableCell>
                                <TableCell>{formatDateUK(inv.dueDate, 'd MMM yyyy')}</TableCell>
                                <TableCell className="text-right">
                                  {inv.daysOverdue > 0 ? (
                                    <span className="text-destructive">{inv.daysOverdue} days</span>
                                  ) : (
                                    <span className="text-muted-foreground">Current</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                  {fmtCurrency(inv.totalMinor / 100)}
                                </TableCell>
                                <TableCell className="text-right">
                                  {inv.daysOverdue > 0 && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="gap-1.5 h-8"
                                      onClick={() => navigate(`/invoices/${inv.id}?action=remind`)}
                                    >
                                      <Send className="h-3.5 w-3.5" />
                                      Remind
                                    </Button>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                        </div>
                        <ReportPagination
                          totalItems={bucket.invoices.length}
                          currentPage={bucketPages[bucket.label] || 1}
                          onPageChange={(p) => setBucketPages(prev => ({ ...prev, [bucket.label]: p }))}
                        />
                      </CardContent>
                    )}
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            ))}
          </div>
        </div>
      )}
    </AppLayout>
  );
}
