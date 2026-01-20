import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { LoadingState } from '@/components/shared/LoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { useAgeingReport, exportAgeingToCSV } from '@/hooks/useReports';
import { useOrg } from '@/contexts/OrgContext';
import { Download, Clock, AlertTriangle, CheckCircle, ChevronDown, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { useState } from 'react';
import { Link } from 'react-router-dom';

export default function OutstandingReport() {
  const { currentOrg } = useOrg();
  const { data, isLoading, error } = useAgeingReport();
  const [expandedBuckets, setExpandedBuckets] = useState<Set<string>>(new Set(['Current (0-7 days)']));

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
      exportAgeingToCSV(data, currentOrg.name.replace(/[^a-zA-Z0-9]/g, '_'));
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: currentOrg?.currency_code || 'GBP',
    }).format(amount);
  };

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
            <Button onClick={handleExport} variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          )
        }
      />

      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <EmptyState icon={Clock} title="Error loading report" description={error.message} />
      ) : !data || data.totalOutstanding === 0 ? (
        <EmptyState
          icon={CheckCircle}
          title="All paid up!"
          description="There are no outstanding invoices."
        />
      ) : (
        <>
          {/* Summary Cards */}
          <div className="mb-6 grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Outstanding</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{formatCurrency(data.totalOutstanding)}</p>
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
                  {formatCurrency(data.totalOverdue)}
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
                        <Badge variant={getBucketBadgeVariant(bucket.label)}>
                          {formatCurrency(bucket.totalAmount)}
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
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Invoice</TableHead>
                              <TableHead>Payer</TableHead>
                              <TableHead>Due Date</TableHead>
                              <TableHead className="text-right">Days Overdue</TableHead>
                              <TableHead className="text-right">Amount</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {bucket.invoices.map((inv) => (
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
                                <TableCell>{format(new Date(inv.dueDate), 'd MMM yyyy')}</TableCell>
                                <TableCell className="text-right">
                                  {inv.daysOverdue > 0 ? (
                                    <span className="text-destructive">{inv.daysOverdue} days</span>
                                  ) : (
                                    <span className="text-muted-foreground">Current</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                  {formatCurrency(inv.totalMinor / 100)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    )}
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            ))}
          </div>
        </>
      )}
    </AppLayout>
  );
}
