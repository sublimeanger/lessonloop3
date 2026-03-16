import { useState, useMemo } from 'react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { useMakeUpCredits, MakeUpCredit } from '@/hooks/useMakeUpCredits';
import { useOrg } from '@/contexts/OrgContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Gift, Calendar, Clock, Trash2, Plus, CheckCircle2, AlertTriangle } from 'lucide-react';
import { formatCurrencyMinor } from '@/lib/utils';
import { IssueCreditModal } from './IssueCreditModal';

interface MakeUpCreditsPanelProps {
  studentId: string;
  studentName: string;
}

export function MakeUpCreditsPanel({ studentId, studentName }: MakeUpCreditsPanelProps) {
  const { currentOrg } = useOrg();
  const { credits, availableCredits, totalAvailableValue, isLoading, deleteCredit } = useMakeUpCredits(studentId);
  const [issueModalOpen, setIssueModalOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(10);

  const visibleCredits = useMemo(() => (credits || []).slice(0, visibleCount), [credits, visibleCount]);
  const hasMore = (credits?.length || 0) > visibleCount;

  const fmtCurrency = (minor: number) => formatCurrencyMinor(minor, currentOrg?.currency_code);

  const maxCredits = (currentOrg as any)?.max_credits_per_term ?? null;

  const getCreditStatus = (credit: MakeUpCredit): { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' } => {
    if (credit.redeemed_at) {
      return { label: 'Redeemed', variant: 'secondary' };
    }
    if (credit.applied_to_invoice_id) {
      return { label: 'Applied to Invoice', variant: 'secondary' };
    }
    if (credit.expired_at || (credit.expires_at && new Date(credit.expires_at) < new Date())) {
      return { label: 'Expired', variant: 'destructive' };
    }
    return { label: 'Available', variant: 'default' };
  };

  const isExpiringSoon = (credit: MakeUpCredit): boolean => {
    if (!credit.expires_at || credit.redeemed_at || credit.expired_at || credit.applied_to_invoice_id) return false;
    const daysLeft = differenceInDays(parseISO(credit.expires_at), new Date());
    return daysLeft >= 0 && daysLeft <= 7;
  };

  const isExpired = (credit: MakeUpCredit): boolean => {
    return !!(credit.expired_at || (credit.expires_at && new Date(credit.expires_at) < new Date()));
  };

  const handleDelete = async () => {
    if (deleteConfirmId) {
      await deleteCredit.mutateAsync(deleteConfirmId);
      setDeleteConfirmId(null);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5" />
            Make-Up Credits
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-1/3" />
            <div className="h-10 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5" />
            Make-Up Credits
          </CardTitle>
          <Button size="sm" onClick={() => setIssueModalOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Issue Credit
          </Button>
        </CardHeader>
        <CardContent>
          {/* Summary */}
          <div className="bg-primary/5 rounded-lg p-4 mb-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Available Balance</p>
                <p className="text-section-title text-primary">
                  {fmtCurrency(totalAvailableValue)}
                </p>
              </div>
              <div className="text-left sm:text-right">
                <p className="text-sm text-muted-foreground">Available Credits</p>
                <p className="text-section-title">
                  {availableCredits.length}
                  {maxCredits != null && (
                    <span className="text-sm font-normal text-muted-foreground"> / {maxCredits} per term</span>
                  )}
                </p>
              </div>
            </div>
            {/* Max credits warning */}
            {maxCredits != null && availableCredits.length >= maxCredits && (
              <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-destructive">
                <AlertTriangle className="h-3.5 w-3.5" />
                Credit limit reached for this term
              </div>
            )}
            {maxCredits != null && availableCredits.length >= maxCredits - 1 && availableCredits.length < maxCredits && (
              <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-3.5 w-3.5" />
                Approaching credit limit ({availableCredits.length} of {maxCredits} used)
              </div>
            )}
          </div>

          {/* Credits List */}
          {(!credits || credits.length === 0) ? (
            <div className="flex flex-col items-center text-center py-8 space-y-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Gift className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <p className="font-medium text-sm">No make-up credits</p>
                <p className="text-xs text-muted-foreground max-w-xs">
                  Credits are issued when a lesson is cancelled by the teacher or when the organisation grants a make-up for an eligible absence.
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => setIssueModalOpen(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" />
                Issue Credit
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {visibleCredits.map((credit) => {
                const status = getCreditStatus(credit);
                const expired = isExpired(credit) && !credit.redeemed_at;
                const expiringSoon = isExpiringSoon(credit);
                const daysLeft = credit.expires_at ? differenceInDays(parseISO(credit.expires_at), new Date()) : null;

                return (
                  <div 
                    key={credit.id} 
                    className={`flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-start sm:justify-between ${
                      expired ? 'opacity-50 bg-muted/30' : ''
                    } ${expiringSoon ? 'border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/10' : ''}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span className={`font-medium ${expired ? 'line-through text-muted-foreground' : ''}`}>
                          {fmtCurrency(credit.credit_value_minor)}
                        </span>
                        <Badge variant={status.variant}>{status.label}</Badge>
                        {expiringSoon && (
                          <Badge variant="outline" className="border-amber-400 text-amber-700 dark:text-amber-400 gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            {daysLeft === 0 ? 'Expires today' : `${daysLeft}d left`}
                          </Badge>
                        )}
                      </div>
                      
                      <div className="text-sm text-muted-foreground space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5" />
                          Issued {format(parseISO(credit.issued_at), 'dd MMM yyyy')}
                        </div>
                        
                        {credit.issued_for_lesson && (
                          <div className="text-xs">
                            For: {credit.issued_for_lesson.title} on{' '}
                            {format(parseISO(credit.issued_for_lesson.start_at), 'dd MMM')}
                          </div>
                        )}
                        
                        {credit.expires_at && !expired && (
                          <div className={`flex items-center gap-1.5 ${expiringSoon ? 'text-amber-600 dark:text-amber-400 font-medium' : ''}`}>
                            <Clock className="h-3.5 w-3.5" />
                            Expires {format(parseISO(credit.expires_at), 'dd MMM yyyy')}
                          </div>
                        )}
                        
                        {credit.redeemed_at && credit.redeemed_lesson && (
                          <div className="flex items-center gap-1.5 text-success">
                            <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                            Used for {credit.redeemed_lesson.title} on{' '}
                            {format(parseISO(credit.redeemed_lesson.start_at), 'dd MMM')}
                          </div>
                        )}
                        
                        {credit.notes && (
                          <div className="italic mt-1">{credit.notes}</div>
                        )}
                      </div>
                    </div>
                    
                    {!credit.redeemed_at && !credit.applied_to_invoice_id && !expired && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setDeleteConfirmId(credit.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                );
              })}
              {hasMore && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => setVisibleCount((c) => c + 10)}
                >
                  Show older credits ({(credits?.length || 0) - visibleCount} more)
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <IssueCreditModal
        open={issueModalOpen}
        onClose={() => setIssueModalOpen(false)}
        studentId={studentId}
        studentName={studentName}
      />

      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Credit</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this make-up credit? This cannot be undone.
              {(() => {
                const credit = credits?.find(c => c.id === deleteConfirmId);
                return credit ? ` This credit is worth ${fmtCurrency(credit.credit_value_minor)}.` : '';
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteCredit.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteCredit.isPending ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
