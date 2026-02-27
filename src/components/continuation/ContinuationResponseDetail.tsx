import { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { useRespondToContinuation } from '@/hooks/useTermContinuation';
import type {
  ContinuationResponseEntry,
  ContinuationResponseType,
} from '@/hooks/useTermContinuation';
import { formatCurrencyMinor } from '@/lib/utils';

interface ContinuationResponseDetailProps {
  response: ContinuationResponseEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currency?: string;
}

const RESPONSE_BADGE: Record<
  ContinuationResponseType,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  pending: { label: 'Pending', variant: 'secondary' },
  continuing: { label: 'Continuing', variant: 'default' },
  withdrawing: { label: 'Withdrawing', variant: 'destructive' },
  assumed_continuing: { label: 'Assumed Continuing', variant: 'outline' },
  no_response: { label: 'No Response', variant: 'secondary' },
};

export function ContinuationResponseDetail({
  response,
  open,
  onOpenChange,
  currency = 'GBP',
}: ContinuationResponseDetailProps) {
  const respondMutation = useRespondToContinuation();
  const [overrideResponse, setOverrideResponse] = useState<string>('');
  const [notes, setNotes] = useState('');

  if (!response) return null;

  const student = response.student;
  const guardian = response.guardian;
  const badge = RESPONSE_BADGE[response.response];

  const handleOverride = async () => {
    if (!overrideResponse) return;

    await respondMutation.mutateAsync({
      response_id: response.id,
      response: overrideResponse as ContinuationResponseType,
      withdrawal_notes: notes || undefined,
    });

    setOverrideResponse('');
    setNotes('');
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {student ? `${student.first_name} ${student.last_name}` : 'Student'}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Status */}
          <div className="flex items-center justify-between">
            <Label className="text-muted-foreground">Response</Label>
            <Badge variant={badge.variant}>{badge.label}</Badge>
          </div>

          {response.response_at && (
            <div className="flex items-center justify-between">
              <Label className="text-muted-foreground">Responded</Label>
              <span className="text-sm">
                {new Date(response.response_at).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          )}

          {response.response_method && (
            <div className="flex items-center justify-between">
              <Label className="text-muted-foreground">Method</Label>
              <span className="text-sm capitalize">
                {response.response_method.replace('_', ' ')}
              </span>
            </div>
          )}

          {/* Guardian Info */}
          <div className="rounded-lg border p-3 space-y-2">
            <Label className="text-sm font-medium">Guardian</Label>
            <p className="text-sm">{guardian?.full_name || 'Unknown'}</p>
            {guardian?.email && (
              <p className="text-xs text-muted-foreground">{guardian.email}</p>
            )}
          </div>

          {/* Lesson Summary */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Lessons</Label>
            {(response.lesson_summary || []).map((lesson, i) => (
              <div key={i} className="rounded-lg border p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {lesson.day} at {lesson.time}
                  </span>
                  <Badge variant="outline">{lesson.instrument || 'Music'}</Badge>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {lesson.lessons_next_term} lessons, {lesson.duration_mins}min
                  </span>
                  <span>
                    {formatCurrencyMinor(
                      lesson.rate_minor * lesson.lessons_next_term,
                      currency
                    )}
                  </span>
                </div>
                {lesson.teacher_name && (
                  <p className="text-xs text-muted-foreground">
                    Teacher: {lesson.teacher_name}
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Total Fee */}
          {response.next_term_fee_minor != null && (
            <div className="flex items-center justify-between rounded-lg bg-muted p-3">
              <Label className="font-medium">Total Next Term Fee</Label>
              <span className="text-lg font-bold">
                {formatCurrencyMinor(response.next_term_fee_minor, currency)}
              </span>
            </div>
          )}

          {/* Withdrawal Info */}
          {response.response === 'withdrawing' && (
            <div className="space-y-2">
              {response.withdrawal_reason && (
                <div>
                  <Label className="text-muted-foreground">Reason</Label>
                  <p className="text-sm capitalize">
                    {response.withdrawal_reason.replace(/_/g, ' ')}
                  </p>
                </div>
              )}
              {response.withdrawal_notes && (
                <div>
                  <Label className="text-muted-foreground">Notes</Label>
                  <p className="text-sm">{response.withdrawal_notes}</p>
                </div>
              )}
            </div>
          )}

          {/* Notification Info */}
          <div className="rounded-lg border p-3 space-y-1">
            <Label className="text-sm font-medium">Notifications</Label>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Initial sent</span>
              <span>
                {response.initial_sent_at
                  ? new Date(response.initial_sent_at).toLocaleDateString('en-GB')
                  : 'Not sent'}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Reminders sent</span>
              <span>{response.reminder_count}</span>
            </div>
          </div>

          {/* Processing Info */}
          {response.is_processed && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
              <Label className="text-sm font-medium text-primary">
                Processed
              </Label>
              <p className="text-xs text-muted-foreground">
                {response.processed_at
                  ? new Date(response.processed_at).toLocaleDateString('en-GB')
                  : ''}
              </p>
            </div>
          )}

          {/* Admin Override */}
          {response.response === 'pending' && (
            <div className="space-y-3 border-t pt-4">
              <Label className="text-sm font-medium">Admin Override</Label>
              <Select value={overrideResponse} onValueChange={setOverrideResponse}>
                <SelectTrigger>
                  <SelectValue placeholder="Set response..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="continuing">Mark as Continuing</SelectItem>
                  <SelectItem value="withdrawing">
                    Mark as Withdrawing
                  </SelectItem>
                </SelectContent>
              </Select>
              <Textarea
                placeholder="Notes (optional)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
              <Button
                className="w-full"
                disabled={!overrideResponse || respondMutation.isPending}
                onClick={handleOverride}
              >
                {respondMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Override'
                )}
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
