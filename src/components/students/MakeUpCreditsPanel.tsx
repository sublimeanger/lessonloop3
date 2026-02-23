import { useState, useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { useMakeUpCredits, MakeUpCredit } from '@/hooks/useMakeUpCredits';
import { useOrg } from '@/contexts/OrgContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Gift, Calendar, Clock, Trash2, Plus, CheckCircle2 } from 'lucide-react';
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

  const formatCurrency = (minor: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: currentOrg?.currency_code || 'GBP',
    }).format(minor / 100);
  };

  const getCreditStatus = (credit: MakeUpCredit): { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' } => {
    if (credit.redeemed_at) {
      return { label: 'Redeemed', variant: 'secondary' };
    }
    if (credit.expires_at && new Date(credit.expires_at) < new Date()) {
      return { label: 'Expired', variant: 'destructive' };
    }
    return { label: 'Available', variant: 'default' };
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
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
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
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Available Balance</p>
                <p className="text-2xl font-bold text-primary">
                  {formatCurrency(totalAvailableValue)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Available Credits</p>
                <p className="text-2xl font-bold">{availableCredits.length}</p>
              </div>
            </div>
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
                  Credits are issued when a lesson is cancelled by the teacher or when the academy grants a make-up for an eligible absence.
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
                return (
                  <div 
                    key={credit.id} 
                    className="border rounded-lg p-3 flex items-start justify-between gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{formatCurrency(credit.credit_value_minor)}</span>
                        <Badge variant={status.variant}>{status.label}</Badge>
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
                        
                        {credit.expires_at && (
                          <div className="flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5" />
                            Expires {format(parseISO(credit.expires_at), 'dd MMM yyyy')}
                          </div>
                        )}
                        
                        {credit.redeemed_at && credit.redeemed_lesson && (
                          <div className="flex items-center gap-1.5 text-green-600">
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
                    
                    {!credit.redeemed_at && (
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
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
