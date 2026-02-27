import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { usePageMeta } from '@/hooks/usePageMeta';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Music,
  Calendar,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useOrg } from '@/contexts/OrgContext';
import {
  useParentContinuationPending,
  useParentRespondToContinuation,
} from '@/hooks/useTermContinuation';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { formatCurrencyMinor } from '@/lib/utils';

// Token-based response component (for email links, possibly unauthenticated)
function TokenResponse() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const presetAction = searchParams.get('action') as 'continuing' | 'withdrawing' | null;
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [responseData, setResponseData] = useState<any>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [withdrawalReason, setWithdrawalReason] = useState('');
  const [withdrawalNotes, setWithdrawalNotes] = useState('');
  const [showWithdrawForm, setShowWithdrawForm] = useState(false);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (!token || fetchedRef.current) return;
    fetchedRef.current = true;

    // Fetch token details by attempting a "lookup" via the respond endpoint
    // We'll submit directly if preset action is provided, or show the form
    setLoading(false);

    if (presetAction === 'withdrawing') {
      setShowWithdrawForm(true);
    }
  }, [token, presetAction]);

  const handleSubmit = async (action: 'continuing' | 'withdrawing') => {
    if (!token) return;
    setSubmitting(true);

    try {
      const { data, error } = await supabase.functions.invoke(
        'continuation-respond',
        {
          body: {
            token,
            response: action,
            withdrawal_reason: action === 'withdrawing' ? withdrawalReason : undefined,
            withdrawal_notes: action === 'withdrawing' ? withdrawalNotes : undefined,
          },
        }
      );

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.already_responded) {
        setResponseData(data);
        setSubmitted(true);
        toast({
          title: 'Already responded',
          description: data.message,
        });
      } else {
        setResponseData(data);
        setSubmitted(true);
        toast({
          title: action === 'continuing'
            ? `${data.student_name} confirmed for ${data.next_term_name}`
            : `Withdrawal recorded for ${data.student_name}`,
        });
      }
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to submit response',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (submitted && responseData) {
    return (
      <Card className="max-w-md mx-auto">
        <CardContent className="py-8 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-green-600" />
          <h2 className="mt-4 text-lg font-semibold">
            {responseData.already_responded
              ? 'Already Responded'
              : 'Response Recorded'}
          </h2>
          <p className="mt-2 text-muted-foreground">
            {responseData.response === 'continuing'
              ? `${responseData.student_name} is confirmed for ${responseData.next_term_name}.`
              : `Withdrawal recorded for ${responseData.student_name}.`}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (showWithdrawForm) {
    return (
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Withdraw from Lessons
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Reason for withdrawal</Label>
            <Select value={withdrawalReason} onValueChange={setWithdrawalReason}>
              <SelectTrigger>
                <SelectValue placeholder="Select a reason..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="moving_away">Moving away</SelectItem>
                <SelectItem value="financial">Financial reasons</SelectItem>
                <SelectItem value="not_enjoying">Not enjoying lessons</SelectItem>
                <SelectItem value="scheduling">Scheduling conflict</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Additional notes (optional)</Label>
            <Textarea
              value={withdrawalNotes}
              onChange={(e) => setWithdrawalNotes(e.target.value)}
              placeholder="Any additional information..."
              rows={3}
            />
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
            Per our terms and conditions, notice must be received before the deadline. After this date, you may be liable for next term's fees.
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setShowWithdrawForm(false)}
            >
              Back
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={() => handleSubmit('withdrawing')}
              disabled={submitting}
            >
              {submitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Confirm Withdrawal
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Default: show continue/withdraw buttons
  return (
    <Card className="max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Term Continuation</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Please confirm whether your child will be continuing music lessons next term.
        </p>
        <div className="flex flex-col gap-3">
          <Button
            size="lg"
            className="w-full bg-green-600 hover:bg-green-700"
            onClick={() => handleSubmit('continuing')}
            disabled={submitting}
          >
            {submitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="mr-2 h-5 w-5" />
            )}
            Confirm Continuing
          </Button>
          <Button
            size="lg"
            variant="destructive"
            className="w-full"
            onClick={() => setShowWithdrawForm(true)}
          >
            <AlertTriangle className="mr-2 h-5 w-5" />
            I Need to Withdraw
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// Portal-based continuation view (authenticated parent)
function PortalContinuationList() {
  const { currentOrg } = useOrg();
  const {
    data: pendingResponses = [],
    isLoading,
  } = useParentContinuationPending();
  const respondMutation = useParentRespondToContinuation();

  const [withdrawingStudentId, setWithdrawingStudentId] = useState<string | null>(null);
  const [withdrawalReason, setWithdrawalReason] = useState('');
  const [withdrawalNotes, setWithdrawalNotes] = useState('');

  const currency = currentOrg?.currency_code || 'GBP';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (pendingResponses.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-green-600" />
          <p className="mt-4 text-muted-foreground">
            No pending continuation requests.
          </p>
        </CardContent>
      </Card>
    );
  }

  const handleContinue = async (resp: any) => {
    await respondMutation.mutateAsync({
      run_id: resp.run_id,
      student_id: resp.student_id,
      response: 'continuing',
    });
  };

  const handleWithdraw = async (studentId: string, runId: string) => {
    await respondMutation.mutateAsync({
      run_id: runId,
      student_id: studentId,
      response: 'withdrawing',
      withdrawal_reason: withdrawalReason,
      withdrawal_notes: withdrawalNotes,
    });
    setWithdrawingStudentId(null);
    setWithdrawalReason('');
    setWithdrawalNotes('');
  };

  return (
    <div className="space-y-4">
      {pendingResponses.map((resp: any) => {
        const student = resp.student;
        const run = resp.run;
        const nextTerm = run?.next_term;
        const lessons = resp.lesson_summary || [];
        const isWithdrawing = withdrawingStudentId === resp.student_id;

        return (
          <Card key={resp.id}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Music className="h-4 w-4" />
                {student?.first_name} {student?.last_name}
              </CardTitle>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {nextTerm?.name || 'Next Term'}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Lesson details */}
              {lessons.map((lesson: any, i: number) => (
                <div
                  key={i}
                  className="flex items-center justify-between text-sm"
                >
                  <div>
                    <span className="font-medium">{lesson.instrument || 'Music'}</span>
                    <span className="text-muted-foreground ml-2">
                      {lesson.day}s at {lesson.time}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-muted-foreground">
                      {lesson.lessons_next_term} lessons
                    </span>
                  </div>
                </div>
              ))}

              {resp.next_term_fee_minor != null && (
                <div className="flex items-center justify-between rounded-lg bg-muted p-3">
                  <span className="text-sm font-medium">
                    Total for {nextTerm?.name || 'next term'}
                  </span>
                  <span className="font-bold">
                    {formatCurrencyMinor(resp.next_term_fee_minor, currency)}
                  </span>
                </div>
              )}

              {run?.notice_deadline && (
                <p className="text-xs text-muted-foreground">
                  Please respond by{' '}
                  {new Date(
                    run.notice_deadline + 'T00:00:00'
                  ).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
              )}

              {isWithdrawing ? (
                <div className="space-y-3 border-t pt-3">
                  <div className="space-y-2">
                    <Label>Reason for withdrawal</Label>
                    <Select
                      value={withdrawalReason}
                      onValueChange={setWithdrawalReason}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a reason..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="moving_away">Moving away</SelectItem>
                        <SelectItem value="financial">
                          Financial reasons
                        </SelectItem>
                        <SelectItem value="not_enjoying">
                          Not enjoying lessons
                        </SelectItem>
                        <SelectItem value="scheduling">
                          Scheduling conflict
                        </SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Textarea
                    placeholder="Additional notes (optional)"
                    value={withdrawalNotes}
                    onChange={(e) => setWithdrawalNotes(e.target.value)}
                    rows={2}
                  />
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
                    Per our T&Cs, notice must be received by the deadline.
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => setWithdrawingStudentId(null)}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="flex-1"
                      onClick={() =>
                        handleWithdraw(resp.student_id, resp.run_id)
                      }
                      disabled={respondMutation.isPending}
                    >
                      {respondMutation.isPending && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Confirm Withdrawal
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button
                    className="flex-1 bg-green-600 hover:bg-green-700"
                    onClick={() => handleContinue(resp)}
                    disabled={respondMutation.isPending}
                  >
                    {respondMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                    )}
                    Continue
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={() => setWithdrawingStudentId(resp.student_id)}
                  >
                    <AlertTriangle className="mr-2 h-4 w-4" />
                    Withdraw
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export default function PortalContinuation() {
  usePageMeta('Term Continuation | Parent Portal', 'Confirm your child\'s lessons for next term');
  const [searchParams] = useSearchParams();
  const hasToken = !!searchParams.get('token');
  const { user } = useAuth();

  // Token-based flow (email link — may or may not be logged in)
  if (hasToken) {
    // If logged in, wrap in PortalLayout. Otherwise, show standalone.
    if (user) {
      return (
        <PortalLayout>
          <div className="px-4 py-6 max-w-2xl mx-auto">
            <TokenResponse />
          </div>
        </PortalLayout>
      );
    }

    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <TokenResponse />
      </div>
    );
  }

  // Authenticated portal view
  return (
    <PortalLayout>
      <div className="px-4 py-6 max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-semibold">Term Continuation</h1>
          <p className="text-sm text-muted-foreground">
            Confirm whether your child will be continuing lessons next term
          </p>
        </div>
        <PortalContinuationList />
      </div>
    </PortalLayout>
  );
}
