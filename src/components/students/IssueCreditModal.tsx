import { useState } from 'react';
import { addMonths, format } from 'date-fns';
import { useMakeUpCredits } from '@/hooks/useMakeUpCredits';
import { useOrg } from '@/contexts/OrgContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

interface IssueCreditModalProps {
  open: boolean;
  onClose: () => void;
  studentId: string;
  studentName: string;
  defaultLessonId?: string;
  defaultValue?: number;
}

export function IssueCreditModal({ 
  open, 
  onClose, 
  studentId, 
  studentName,
  defaultLessonId,
  defaultValue,
}: IssueCreditModalProps) {
  const { currentOrg } = useOrg();
  const { createCredit } = useMakeUpCredits(studentId);
  
  const [amount, setAmount] = useState(defaultValue ? (defaultValue / 100).toFixed(2) : '');
  const [expiryOption, setExpiryOption] = useState<string>('3months');
  const [notes, setNotes] = useState('');

  const currencySymbol = currentOrg?.currency_code === 'GBP' ? '£' : '$';

  const getExpiryDate = (): string | undefined => {
    const now = new Date();
    switch (expiryOption) {
      case '1month':
        return addMonths(now, 1).toISOString();
      case '3months':
        return addMonths(now, 3).toISOString();
      case '6months':
        return addMonths(now, 6).toISOString();
      case '12months':
        return addMonths(now, 12).toISOString();
      case 'never':
        return undefined;
      default:
        return addMonths(now, 3).toISOString();
    }
  };

  const handleSubmit = async () => {
    const valueMinor = Math.round(parseFloat(amount) * 100);
    if (isNaN(valueMinor) || valueMinor <= 0) return;

    await createCredit.mutateAsync({
      student_id: studentId,
      issued_for_lesson_id: defaultLessonId,
      credit_value_minor: valueMinor,
      expires_at: getExpiryDate(),
      notes: notes || undefined,
    });

    // Reset and close
    setAmount('');
    setExpiryOption('3months');
    setNotes('');
    onClose();
  };

  const isValid = parseFloat(amount) > 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="h-[100dvh] w-full max-w-none overflow-y-auto rounded-none p-4 sm:h-auto sm:max-h-[90vh] sm:max-w-lg sm:rounded-lg sm:p-6">
        <DialogHeader>
          <DialogTitle>Issue Make-Up Credit</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">
            Issue a make-up credit to <strong>{studentName}</strong> that can be redeemed 
            against future lessons.
          </p>

          <div className="space-y-2">
            <Label htmlFor="amount">Credit Amount</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {currencySymbol}
              </span>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pl-7"
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="expiry">Expires</Label>
            <Select value={expiryOption} onValueChange={setExpiryOption}>
              <SelectTrigger id="expiry">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1month">In 1 month</SelectItem>
                <SelectItem value="3months">In 3 months</SelectItem>
                <SelectItem value="6months">In 6 months</SelectItem>
                <SelectItem value="12months">In 12 months</SelectItem>
                <SelectItem value="never">Never expires</SelectItem>
              </SelectContent>
            </Select>
            {expiryOption !== 'never' && (
              <p className="text-xs text-muted-foreground">
                Expires on {format(getExpiryDate() ? new Date(getExpiryDate()!) : new Date(), 'dd MMM yyyy')}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Reason for issuing credit..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!isValid || createCredit.isPending}
          >
            {createCredit.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Issue Credit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
