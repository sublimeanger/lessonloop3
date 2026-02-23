import { useState, useEffect, useRef } from 'react';
import { format, startOfMonth, endOfMonth, subMonths, differenceInMinutes } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, FileText, PoundSterling, Users, CheckCircle2, AlertTriangle, RotateCcw } from 'lucide-react';
import { useOrg } from '@/contexts/OrgContext';
import { useUnbilledLessons } from '@/hooks/useInvoices';
import { useCreateBillingRun, useRetryBillingRunPayers } from '@/hooks/useBillingRuns';
import type { BillingRunSummary } from '@/hooks/useBillingRuns';
import { useRateCards, findRateForDuration } from '@/hooks/useRateCards';
import { useTerms } from '@/hooks/useTerms';
import type { Database } from '@/integrations/supabase/types';
import { formatCurrencyMinor } from '@/lib/utils';

type BillingRunType = Database['public']['Enums']['billing_run_type'];
type BillingMode = 'delivered' | 'upfront';

interface BillingRunWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BillingRunWizard({ open, onOpenChange }: BillingRunWizardProps) {
  const { currentOrg } = useOrg();
  const createBillingRun = useCreateBillingRun();
  const retryPayers = useRetryBillingRunPayers();
  const { data: rateCards = [], isLoading: loadingRateCards } = useRateCards();
  const { data: terms = [] } = useTerms();
  const [step, setStep] = useState<'config' | 'preview' | 'complete'>('config');
  const [billingResult, setBillingResult] = useState<{ billingRunId: string; status: string; summary: BillingRunSummary } | null>(null);
  const lastMonth = subMonths(new Date(), 1);
  const stepFocusRef = useRef<HTMLButtonElement>(null);

  // Auto-focus the first interactive element when step changes
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => {
        stepFocusRef.current?.focus();
      });
    }
  }, [open, step]);

  const [config, setConfig] = useState({
    runType: 'monthly' as BillingRunType,
    startDate: format(startOfMonth(lastMonth), 'yyyy-MM-dd'),
    endDate: format(endOfMonth(lastMonth), 'yyyy-MM-dd'),
    termId: '' as string,
    billingMode: 'delivered' as BillingMode,
  });

  const { data: unbilledLessons = [], isLoading: loadingLessons } = useUnbilledLessons(
    { from: config.startDate, to: config.endDate },
    undefined,
    config.runType === 'term' ? config.billingMode : 'delivered'
  );

  const hasRateCards = rateCards.length > 0;

  const getLessonRate = (lesson: any): number => {
    const durationMins = differenceInMinutes(new Date(lesson.end_at), new Date(lesson.start_at));
    return findRateForDuration(durationMins, rateCards, 3000);
  };

  // Group lessons by payer for preview
  const payerGroups = new Map<string, { name: string; lessonCount: number; totalMinor: number; addedLessonIds: Set<string> }>();

  unbilledLessons.forEach((lesson: any) => {
    const lessonRate = getLessonRate(lesson);
    const participants = lesson.lesson_participants || [];

    participants.forEach((p: any) => {
      const student = p.student;
      if (!student) return;

      const guardianLinks = student.student_guardians || [];
      const primaryGuardianLink = guardianLinks.find((sg: any) => sg.is_primary_payer);
      const primaryGuardian = primaryGuardianLink?.guardian;

      const payerName = primaryGuardian
        ? primaryGuardian.full_name
        : `${student.first_name} ${student.last_name}`;

      const payerId = primaryGuardian ? primaryGuardian.id : student.id;
      const key = primaryGuardian ? `guardian-${payerId}` : `student-${payerId}`;
      if (!payerGroups.has(key)) {
        payerGroups.set(key, { name: payerName, lessonCount: 0, totalMinor: 0, addedLessonIds: new Set() });
      }
      const group = payerGroups.get(key)!;
      if (!group.addedLessonIds.has(lesson.id)) {
        group.addedLessonIds.add(lesson.id);
        group.lessonCount++;
        group.totalMinor += lessonRate;
      }
    });
  });

  const totalInvoices = payerGroups.size;
  const totalAmount = Array.from(payerGroups.values()).reduce((sum, p) => sum + p.totalMinor, 0);
  const currency = currentOrg?.currency_code || 'GBP';

  const handleRunTypeChange = (type: BillingRunType) => {
    setConfig((c) => {
      let startDate = c.startDate;
      let endDate = c.endDate;
      const termId = '';
      let billingMode = c.billingMode;

      if (type === 'monthly') {
        startDate = format(startOfMonth(lastMonth), 'yyyy-MM-dd');
        endDate = format(endOfMonth(lastMonth), 'yyyy-MM-dd');
        billingMode = 'delivered';
      }

      return { ...c, runType: type, startDate, endDate, termId, billingMode };
    });
  };

  const handleTermChange = (termId: string) => {
    const term = terms.find((t) => t.id === termId);
    if (term) {
      setConfig((c) => ({
        ...c,
        termId,
        startDate: term.start_date,
        endDate: term.end_date,
      }));
    }
  };

  const handleGenerate = async () => {
    const result = await createBillingRun.mutateAsync({
      run_type: config.runType,
      start_date: config.startDate,
      end_date: config.endDate,
      generate_invoices: true,
      billing_mode: config.billingMode,
      term_id: config.termId || undefined,
    });

    setBillingResult({
      billingRunId: result.id,
      status: result.status,
      summary: result.summary as BillingRunSummary,
    });
    setStep('complete');
  };

  const handleRetry = async () => {
    if (!billingResult?.summary.failedPayers?.length) return;

    const result = await retryPayers.mutateAsync({
      billingRunId: billingResult.billingRunId,
      failedPayers: billingResult.summary.failedPayers,
    });

    setBillingResult((prev) => prev ? {
      ...prev,
      status: result.finalStatus,
      summary: {
        ...prev.summary,
        invoiceCount: (prev.summary.invoiceCount || 0) + result.newInvoiceCount,
        failedPayers: result.stillFailed.length > 0 ? result.stillFailed : undefined,
      },
    } : null);
  };

  const handleClose = () => {
    setStep('config');
    setBillingResult(null);
    setConfig({
      runType: 'monthly' as BillingRunType,
      startDate: format(startOfMonth(lastMonth), 'yyyy-MM-dd'),
      endDate: format(endOfMonth(lastMonth), 'yyyy-MM-dd'),
      termId: '',
      billingMode: 'delivered' as BillingMode,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-xl mx-4 sm:mx-auto">
        <DialogHeader>
          <DialogTitle>Billing Run</DialogTitle>
          <DialogDescription>
            {step === 'config' && 'Configure the billing period and generate invoices'}
            {step === 'preview' && 'Review before generating invoices'}
            {step === 'complete' && 'Billing run completed'}
          </DialogDescription>
        </DialogHeader>

        {step === 'config' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Billing Type</Label>
              <Select value={config.runType} onValueChange={(v) => handleRunTypeChange(v as BillingRunType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="term">Termly</SelectItem>
                  <SelectItem value="custom">Custom Period</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Term selector for termly billing */}
            {config.runType === 'term' && (
              <>
                <div className="space-y-2">
                  <Label>Select Term</Label>
                  {terms.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-3 text-center text-sm text-muted-foreground">
                      No terms defined. Go to Settings → Scheduling to create terms.
                    </div>
                  ) : (
                    <Select value={config.termId} onValueChange={handleTermChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a term" />
                      </SelectTrigger>
                      <SelectContent>
                        {terms.map((term) => (
                          <SelectItem key={term.id} value={term.id}>
                            {term.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Billing Mode</Label>
                  <Select
                    value={config.billingMode}
                    onValueChange={(v) => setConfig((c) => ({ ...c, billingMode: v as BillingMode }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="delivered">Bill for delivered lessons</SelectItem>
                      <SelectItem value="upfront">Bill upfront for scheduled lessons</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {config.billingMode === 'delivered'
                      ? 'Only completed lessons will be included in the invoice.'
                      : 'All scheduled, confirmed, and completed lessons will be included.'}
                  </p>
                </div>
              </>
            )}

            {/* Date pickers - shown for monthly/custom, or read-only for term */}
            {config.runType !== 'term' ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input
                    type="date"
                    value={config.startDate}
                    onChange={(e) => setConfig((c) => ({ ...c, startDate: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input
                    type="date"
                    value={config.endDate}
                    onChange={(e) => setConfig((c) => ({ ...c, endDate: e.target.value }))}
                  />
                </div>
              </div>
            ) : config.termId ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Start Date</Label>
                  <Input type="date" value={config.startDate} disabled className="bg-muted" />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">End Date</Label>
                  <Input type="date" value={config.endDate} disabled className="bg-muted" />
                </div>
              </div>
            ) : null}

            {/* Rate Cards Status */}
            <div className="rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium flex items-center gap-2">
                    <PoundSterling className="h-4 w-4" />
                    Pricing
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {hasRateCards
                      ? `Using ${rateCards.length} rate card${rateCards.length !== 1 ? 's' : ''} for pricing`
                      : 'No rate cards configured - using default £30/lesson'}
                  </p>
                </div>
                {hasRateCards && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Active
                  </Badge>
                )}
              </div>
              {hasRateCards && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {rateCards.map((card) => (
                    <Badge key={card.id} variant="outline" className="text-xs">
                      {card.duration_mins}min: {formatCurrencyMinor(card.rate_amount, card.currency_code)}
                      {card.is_default && ' (default)'}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                ref={step === 'config' ? stepFocusRef : undefined}
                onClick={() => setStep('preview')}
                disabled={
                  loadingLessons ||
                  loadingRateCards ||
                  (config.runType === 'term' && !config.termId)
                }
              >
                {(loadingLessons || loadingRateCards) ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  'Preview'
                )}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4">
            {/* Billing mode badge for termly */}
            {config.runType === 'term' && (
              <div className="flex items-center gap-2">
                <Badge variant="outline">
                  {terms.find((t) => t.id === config.termId)?.name}
                </Badge>
                <Badge variant={config.billingMode === 'upfront' ? 'default' : 'secondary'}>
                  {config.billingMode === 'upfront' ? 'Upfront' : 'Delivered'}
                </Badge>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <FileText className="h-4 w-4" />
                    Invoices
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalInvoices}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Users className="h-4 w-4" />
                    Lessons
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{unbilledLessons.length}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <PoundSterling className="h-4 w-4" />
                    Total
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatCurrencyMinor(totalAmount, currency)}
                  </div>
                </CardContent>
              </Card>
            </div>

            {payerGroups.size > 0 && (
              <div className="space-y-2">
                <Label>Invoice Preview</Label>
                <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border p-2">
                  {Array.from(payerGroups.entries()).map(([key, payer]) => (
                    <div
                      key={key}
                      className="flex items-center justify-between rounded p-2 hover:bg-muted"
                    >
                      <span className="text-sm font-medium">{payer.name}</span>
                      <span className="text-sm text-muted-foreground">
                        {payer.lessonCount} lesson{payer.lessonCount !== 1 ? 's' : ''} •{' '}
                        {formatCurrencyMinor(payer.totalMinor, currency)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {payerGroups.size === 0 && (
              <div className="rounded-lg border bg-muted/50 p-4 text-center">
                <p className="text-muted-foreground">
                  No unbilled lessons found for this period
                </p>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep('config')}>
                Back
              </Button>
              <Button
                ref={step === 'preview' ? stepFocusRef : undefined}
                onClick={handleGenerate}
                disabled={createBillingRun.isPending || payerGroups.size === 0}
              >
                {createBillingRun.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  `Generate ${totalInvoices} Invoice${totalInvoices !== 1 ? 's' : ''}`
                )}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 'complete' && (
          <div className="space-y-4">
            {billingResult?.status === 'completed' ? (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-center">
                <div className="text-2xl">✓</div>
                <p className="mt-2 font-medium text-primary">
                  Billing run completed successfully!
                </p>
                <p className="text-sm text-muted-foreground">
                  {billingResult.summary.invoiceCount} invoice{billingResult.summary.invoiceCount !== 1 ? 's' : ''} created as drafts
                </p>
              </div>
            ) : billingResult?.status === 'partial' ? (
              <div className="space-y-3">
                <div className="rounded-lg border border-accent bg-accent/10 p-4 text-center">
                  <AlertTriangle className="mx-auto h-6 w-6 text-accent-foreground" />
                  <p className="mt-2 font-medium text-accent-foreground">
                    Billing run partially completed
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {billingResult.summary.invoiceCount} invoice{billingResult.summary.invoiceCount !== 1 ? 's' : ''} created, {billingResult.summary.failedPayers?.length || 0} payer{(billingResult.summary.failedPayers?.length || 0) !== 1 ? 's' : ''} failed
                  </p>
                </div>

                {billingResult.summary.failedPayers && billingResult.summary.failedPayers.length > 0 && (
                  <div className="space-y-2">
                    <Label>Failed Payers</Label>
                    <div className="max-h-36 space-y-1 overflow-y-auto rounded-lg border p-2">
                      {billingResult.summary.failedPayers.map((fp, i) => (
                        <div key={i} className="flex items-center justify-between rounded p-2 text-sm bg-destructive/5">
                          <span className="font-medium">{fp.payerName}</span>
                          <span className="text-xs text-muted-foreground truncate max-w-[200px]">{fp.error}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-center">
                <AlertTriangle className="mx-auto h-6 w-6 text-destructive" />
                <p className="mt-2 font-medium text-destructive">
                  Billing run failed
                </p>
                <p className="text-sm text-muted-foreground">
                  No invoices could be created
                </p>
              </div>
            )}

            <DialogFooter className="gap-2">
              {billingResult?.summary.failedPayers && billingResult.summary.failedPayers.length > 0 && (
                <Button
                  variant="outline"
                  onClick={handleRetry}
                  disabled={retryPayers.isPending}
                >
                  {retryPayers.isPending ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Retrying...</>
                  ) : (
                    <><RotateCcw className="mr-2 h-4 w-4" />Retry Failed ({billingResult.summary.failedPayers.length})</>
                  )}
                </Button>
              )}
              <Button ref={step === 'complete' ? stepFocusRef : undefined} onClick={handleClose}>Done</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
