import { useState, useEffect, useRef } from 'react';
import { format, subWeeks } from 'date-fns';
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
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Loader2,
  Users,
  PoundSterling,
  CheckCircle2,
  AlertTriangle,
  CalendarClock,
  Mail,
} from 'lucide-react';
import { useOrg } from '@/contexts/OrgContext';
import { useTerms, useCurrentTerm } from '@/hooks/useTerms';
import {
  useCreateContinuationRun,
  useSendContinuationRun,
} from '@/hooks/useTermContinuation';
import type { CreateRunResult, SendResult } from '@/hooks/useTermContinuation';
import { formatCurrencyMinor } from '@/lib/utils';

interface ContinuationRunWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ContinuationRunWizard({
  open,
  onOpenChange,
}: ContinuationRunWizardProps) {
  const { currentOrg } = useOrg();
  const { data: terms = [] } = useTerms();
  const currentTerm = useCurrentTerm();
  const createRun = useCreateContinuationRun();
  const sendRun = useSendContinuationRun();

  const [step, setStep] = useState<'config' | 'preview' | 'sending' | 'complete'>('config');
  const [createResult, setCreateResult] = useState<CreateRunResult | null>(null);
  const [sendResult, setSendResult] = useState<SendResult | null>(null);
  const stepFocusRef = useRef<HTMLButtonElement>(null);

  const orgSettings = currentOrg as any;
  const defaultNoticeWeeks = orgSettings?.continuation_notice_weeks ?? 3;
  const defaultAssumedContinuing = orgSettings?.continuation_assumed_continuing ?? true;
  const defaultReminderDays = orgSettings?.continuation_reminder_days ?? [7, 14];

  const [config, setConfig] = useState({
    currentTermId: '',
    nextTermId: '',
    noticeDeadline: '',
    assumedContinuing: defaultAssumedContinuing,
    reminderSchedule: defaultReminderDays,
  });

  // Set defaults when terms load
  useEffect(() => {
    if (terms.length > 0 && !config.currentTermId) {
      const sorted = [...terms].sort(
        (a, b) => a.start_date.localeCompare(b.start_date)
      );
      const currentId = currentTerm?.id || sorted[sorted.length - 1]?.id || '';
      const current = sorted.find((t) => t.id === currentId);
      const next = current
        ? sorted.find((t) => t.start_date > current.end_date)
        : undefined;

      const deadline = current
        ? format(subWeeks(new Date(current.end_date), defaultNoticeWeeks), 'yyyy-MM-dd')
        : '';

      setConfig((c) => ({
        ...c,
        currentTermId: currentId,
        nextTermId: next?.id || '',
        noticeDeadline: deadline,
      }));
    }
  }, [terms, currentTerm, defaultNoticeWeeks]);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => stepFocusRef.current?.focus());
    }
  }, [open, step]);

  const currentTermObj = terms.find((t) => t.id === config.currentTermId);
  const nextTermOptions = terms.filter(
    (t) => currentTermObj && t.start_date > currentTermObj.end_date
  );
  const currency = currentOrg?.currency_code || 'GBP';

  const handleCurrentTermChange = (termId: string) => {
    const term = terms.find((t) => t.id === termId);
    const next = term
      ? terms.find((t) => t.start_date > term.end_date)
      : undefined;
    const deadline = term
      ? format(subWeeks(new Date(term.end_date), defaultNoticeWeeks), 'yyyy-MM-dd')
      : '';

    setConfig((c) => ({
      ...c,
      currentTermId: termId,
      nextTermId: next?.id || '',
      noticeDeadline: deadline,
    }));
  };

  const handlePreview = async () => {
    const result = await createRun.mutateAsync({
      current_term_id: config.currentTermId,
      next_term_id: config.nextTermId,
      notice_deadline: config.noticeDeadline,
      assumed_continuing: config.assumedContinuing,
      reminder_schedule: config.reminderSchedule,
    });
    setCreateResult(result);
    setStep('preview');
  };

  const handleSend = async () => {
    if (!createResult) return;
    setStep('sending');
    const result = await sendRun.mutateAsync(createResult.run_id);
    setSendResult(result);
    setStep('complete');
  };

  const handleClose = () => {
    setStep('config');
    setCreateResult(null);
    setSendResult(null);
    setConfig({
      currentTermId: currentTerm?.id || '',
      nextTermId: '',
      noticeDeadline: '',
      assumedContinuing: defaultAssumedContinuing,
      reminderSchedule: defaultReminderDays,
    });
    onOpenChange(false);
  };

  const noEmailCount = createResult?.preview?.filter((p) => !p.has_email).length || 0;
  const totalFee = createResult?.preview?.reduce((sum, p) => sum + p.fee_minor, 0) || 0;
  const uniqueGuardians = new Set(createResult?.preview?.map((p) => p.guardian_name)).size;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="h-screen w-screen max-w-none overflow-y-auto rounded-none border-0 p-4 sm:h-auto sm:max-w-xl sm:rounded-lg sm:border sm:p-6">
        <DialogHeader>
          <DialogTitle>Term Continuation Run</DialogTitle>
          <DialogDescription>
            {step === 'config' && 'Configure which term transition to process'}
            {step === 'preview' && 'Review students before sending notifications'}
            {step === 'sending' && 'Sending notifications...'}
            {step === 'complete' && 'Continuation run is live'}
          </DialogDescription>
        </DialogHeader>

        {step === 'config' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Current Term</Label>
              {terms.length === 0 ? (
                <div className="rounded-lg border border-dashed p-3 text-center text-sm text-muted-foreground">
                  No terms defined. Go to Settings to create terms.
                </div>
              ) : (
                <Select
                  value={config.currentTermId}
                  onValueChange={handleCurrentTermChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select current term" />
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
              <Label>Next Term</Label>
              {nextTermOptions.length === 0 && config.currentTermId ? (
                <div className="rounded-lg border border-dashed p-3 text-center text-sm text-muted-foreground">
                  No terms found after the current term. Create the next term first.
                </div>
              ) : (
                <Select
                  value={config.nextTermId}
                  onValueChange={(v) =>
                    setConfig((c) => ({ ...c, nextTermId: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select next term" />
                  </SelectTrigger>
                  <SelectContent>
                    {nextTermOptions.map((term) => (
                      <SelectItem key={term.id} value={term.id}>
                        {term.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2">
              <Label>Notice Deadline</Label>
              <Input
                type="date"
                value={config.noticeDeadline}
                onChange={(e) =>
                  setConfig((c) => ({ ...c, noticeDeadline: e.target.value }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Parents must respond by this date
              </p>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label className="text-sm font-medium">
                  Assumed continuing
                </Label>
                <p className="text-xs text-muted-foreground">
                  Non-responders are treated as continuing per T&Cs
                </p>
              </div>
              <Switch
                checked={config.assumedContinuing}
                onCheckedChange={(v) =>
                  setConfig((c) => ({ ...c, assumedContinuing: v }))
                }
              />
            </div>

            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Mail className="h-4 w-4" />
                Reminder Schedule
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Reminders at day{' '}
                {config.reminderSchedule.join(' and ')} after
                sending
              </p>
            </div>

            <DialogFooter className="flex-col gap-2 sm:flex-row">
              <Button
                variant="outline"
                className="min-h-11 w-full sm:min-h-9 sm:w-auto"
                onClick={handleClose}
              >
                Cancel
              </Button>
              <Button
                className="min-h-11 w-full sm:min-h-9 sm:w-auto"
                ref={step === 'config' ? stepFocusRef : undefined}
                onClick={handlePreview}
                disabled={
                  createRun.isPending ||
                  !config.currentTermId ||
                  !config.nextTermId ||
                  !config.noticeDeadline
                }
              >
                {createRun.isPending ? (
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

        {step === 'preview' && createResult && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Users className="h-4 w-4" />
                    Students
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {createResult.total_students}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    across {uniqueGuardians} families
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <PoundSterling className="h-4 w-4" />
                    Total Fees
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatCurrencyMinor(totalFee, currency)}
                  </div>
                  <p className="text-xs text-muted-foreground">next term</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <CalendarClock className="h-4 w-4" />
                    Deadline
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-lg font-bold">
                    {new Date(
                      config.noticeDeadline + 'T00:00:00'
                    ).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>

            {noEmailCount > 0 && (
              <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <span>
                  {noEmailCount} student{noEmailCount !== 1 ? 's' : ''} have
                  no guardian email and won't receive notifications
                </span>
              </div>
            )}

            {createResult.preview.length > 0 && (
              <div className="space-y-2">
                <Label>Student Preview</Label>
                <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border p-2">
                  {createResult.preview.map((item, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded p-2 hover:bg-muted"
                    >
                      <div>
                        <span className="text-sm font-medium">
                          {item.student_name}
                        </span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          {item.guardian_name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                          {item.lesson_count} lessons
                        </span>
                        <Badge variant="outline">
                          {formatCurrencyMinor(item.fee_minor, currency)}
                        </Badge>
                        {!item.has_email && (
                          <Badge variant="destructive" className="text-xs">
                            No email
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <DialogFooter className="flex-col gap-2 sm:flex-row">
              <Button
                variant="outline"
                className="min-h-11 w-full sm:min-h-9 sm:w-auto"
                onClick={() => setStep('config')}
              >
                Back
              </Button>
              <Button
                className="min-h-11 w-full sm:min-h-9 sm:w-auto"
                ref={step === 'preview' ? stepFocusRef : undefined}
                onClick={handleSend}
                disabled={sendRun.isPending}
              >
                {sendRun.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  'Send Notifications'
                )}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 'sending' && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="mt-4 text-sm text-muted-foreground">
              Sending notifications to families...
            </p>
          </div>
        )}

        {step === 'complete' && (
          <div className="space-y-4">
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-center">
              <CheckCircle2 className="mx-auto h-8 w-8 text-primary" />
              <p className="mt-2 font-medium text-primary">
                Continuation run is live!
              </p>
              <p className="text-sm text-muted-foreground">
                {sendResult
                  ? `Sent to ${sendResult.sent_count} families. ${sendResult.failed?.length || 0} failed.`
                  : 'Notifications sent.'}
              </p>
            </div>

            {sendResult?.failed && sendResult.failed.length > 0 && (
              <div className="space-y-2">
                <Label>Failed</Label>
                <div className="max-h-36 space-y-1 overflow-y-auto rounded-lg border p-2">
                  {sendResult.failed.map((f, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded p-2 text-sm bg-destructive/5"
                    >
                      <span className="font-medium">{f.guardian_name}</span>
                      <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                        {f.error}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <DialogFooter className="flex-col gap-2 sm:flex-row">
              <Button
                className="min-h-11 w-full sm:min-h-9 sm:w-auto"
                ref={step === 'complete' ? stepFocusRef : undefined}
                onClick={handleClose}
              >
                Done
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
