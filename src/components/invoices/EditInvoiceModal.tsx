import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useForm, useFieldArray } from 'react-hook-form';
import { format, parseISO, isBefore, startOfToday } from 'date-fns';
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
import { DatePicker } from '@/components/ui/date-picker';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2, Gift, AlertTriangle, Lock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { useUpdateInvoice, type InvoiceWithDetails } from '@/hooks/useInvoices';
import { Checkbox } from '@/components/ui/checkbox';
import { useAvailableCreditsForPayer } from '@/hooks/useAvailableCredits';
import { Badge } from '@/components/ui/badge';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { formatCurrencyMinor, currencySymbol } from '@/lib/utils';

interface EditInvoiceModalProps {
  invoice: InvoiceWithDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface InvoiceFormData {
  payerType: 'guardian' | 'student';
  payerId: string;
  issueDate: string;
  dueDate: string;
  notes: string;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    linkedLessonId?: string | null;
    studentId?: string | null;
  }>;
}

export function EditInvoiceModal({ invoice, open, onOpenChange }: EditInvoiceModalProps) {
  const { currentOrg } = useOrg();
  const updateInvoice = useUpdateInvoice();
  const { isOnline, guardOffline } = useOnlineStatus();
  const { toast } = useToast();
  const [selectedCredits, setSelectedCredits] = useState<Set<string>>(new Set());

  const planAttached = invoice?.payment_plan_enabled === true;
  const itemsLocked = planAttached;

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    reset,
  } = useForm<InvoiceFormData>({
    defaultValues: {
      payerType: 'guardian',
      payerId: '',
      issueDate: format(new Date(), 'yyyy-MM-dd'),
      dueDate: format(new Date(), 'yyyy-MM-dd'),
      notes: '',
      items: [{ description: '', quantity: 1, unitPrice: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  });

  const payerType = watch('payerType');
  const payerId = watch('payerId');
  const dueDate = watch('dueDate');

  // Prefill on invoice change / open
  useEffect(() => {
    if (invoice && open) {
      const initialPayerType: 'guardian' | 'student' = invoice.payer_guardian_id ? 'guardian' : 'student';
      const initialPayerId = invoice.payer_guardian_id || invoice.payer_student_id || '';
      const initialItems = (invoice.items && invoice.items.length > 0)
        ? invoice.items.map((item: any) => ({
            description: item.description || '',
            quantity: item.quantity || 1,
            unitPrice: (item.unit_price_minor || 0) / 100,
            linkedLessonId: item.linked_lesson_id || null,
            studentId: item.student_id || null,
          }))
        : [{ description: '', quantity: 1, unitPrice: 0 }];

      reset({
        payerType: initialPayerType,
        payerId: initialPayerId,
        issueDate: invoice.issue_date || format(new Date(), 'yyyy-MM-dd'),
        dueDate: invoice.due_date || format(new Date(), 'yyyy-MM-dd'),
        notes: invoice.notes || '',
        items: initialItems,
      });

      // Note: server returns credit_applied_minor but not individual IDs.
      // UI starts with no credits ticked; user re-selects.
      setSelectedCredits(new Set());
    }
  }, [invoice, open, reset]);

  const { data: availableCredits = [] } = useAvailableCreditsForPayer(payerType, payerId);

  const totalSelectedCredit = useMemo(() => {
    return availableCredits
      .filter((c) => selectedCredits.has(c.id))
      .reduce((sum, c) => sum + c.credit_value_minor, 0);
  }, [availableCredits, selectedCredits]);

  const items = watch('items');
  const computedTotalMinor = useMemo(() => {
    const subtotal = (items || []).reduce(
      (sum, item) => sum + Math.round((item.unitPrice || 0) * 100) * (item.quantity || 0),
      0,
    );
    return Math.max(0, subtotal - totalSelectedCredit);
  }, [items, totalSelectedCredit]);

  const isPastDue = useMemo(() => {
    if (!dueDate) return false;
    try {
      return isBefore(parseISO(dueDate), startOfToday());
    } catch {
      return false;
    }
  }, [dueDate]);

  const currency = currentOrg?.currency_code || 'GBP';

  const { data: guardians = [] } = useQuery({
    queryKey: ['guardians-for-invoice', currentOrg?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('guardians')
        .select('id, full_name')
        .eq('org_id', currentOrg!.id)
        .is('deleted_at', null)
        .order('full_name');
      return data || [];
    },
    enabled: !!currentOrg?.id && open,
  });

  const { data: students = [] } = useQuery({
    queryKey: ['students-for-invoice', currentOrg?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('students')
        .select('id, first_name, last_name, email')
        .eq('org_id', currentOrg!.id)
        .eq('status', 'active' as any)
        .is('deleted_at', null)
        .order('first_name');
      return data || [];
    },
    enabled: !!currentOrg?.id && open,
  });

  const onSubmit = async (data: InvoiceFormData) => {
    if (!invoice) return;
    if (guardOffline()) return;

    if (!data.payerId) {
      toast({ title: 'Please select a payer', variant: 'destructive' });
      return;
    }

    const invalidItems = data.items.filter(item =>
      item.unitPrice <= 0 ||
      item.quantity <= 0 ||
      !Number.isInteger(item.quantity)
    );
    if (invalidItems.length > 0) {
      toast({
        title: 'Invalid line items',
        description: 'Each item needs a price greater than zero and a whole-number quantity.',
        variant: 'destructive',
      });
      return;
    }

    const creditIdsToApply = Array.from(selectedCredits);
    try {
      await updateInvoice.mutateAsync({
        invoice_id: invoice.id,
        due_date: data.dueDate,
        payer_guardian_id: data.payerType === 'guardian' ? data.payerId : undefined,
        payer_student_id: data.payerType === 'student' ? data.payerId : undefined,
        issue_date: data.issueDate,
        notes: data.notes,
        credit_ids: creditIdsToApply.length > 0 ? creditIdsToApply : undefined,
        items: data.items.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          unit_price_minor: Math.round(item.unitPrice * 100),
          linked_lesson_id: item.linkedLessonId,
          student_id: item.studentId,
        })),
      });
      onOpenChange(false);
    } catch {
      // Hook's onError already shows appropriate toast
      return;
    }
  };

  const toggleCredit = (creditId: string) => {
    const newSelected = new Set(selectedCredits);
    if (newSelected.has(creditId)) {
      newSelected.delete(creditId);
    } else {
      newSelected.add(creditId);
    }
    setSelectedCredits(newSelected);
  };

  const selectAllCredits = () => {
    setSelectedCredits(new Set(availableCredits.map((c) => c.id)));
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      reset();
      setSelectedCredits(new Set());
    }
    onOpenChange(isOpen);
  };

  if (!invoice) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="h-screen w-screen max-w-none overflow-y-auto rounded-none border-0 p-4 pt-safe pb-safe left-0 right-0 sm:h-auto sm:max-h-[90vh] sm:max-w-2xl sm:rounded-lg sm:border sm:p-6 sm:left-[50%] sm:right-auto">
        <DialogHeader>
          <DialogTitle>Edit Invoice {invoice.invoice_number}</DialogTitle>
          <DialogDescription>
            Edit the details of this draft invoice. Changes are saved atomically.
          </DialogDescription>
        </DialogHeader>

        {planAttached && (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 flex items-start gap-2 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-700">
            <Lock className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <div>
              <strong>Items locked:</strong> This invoice has a payment plan attached.
              You can edit the payer, dates, and notes — but to change line items
              or totals, remove the payment plan first.
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Payer Type</Label>
              <Select
                value={payerType}
                onValueChange={(v) => {
                  setValue('payerType', v as 'guardian' | 'student');
                  setValue('payerId', '');
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="guardian">Guardian</SelectItem>
                  <SelectItem value="student">Student (Adult)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Payer</Label>
              <Select
                value={watch('payerId')}
                onValueChange={(v) => setValue('payerId', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select payer" />
                </SelectTrigger>
                <SelectContent>
                  {payerType === 'guardian'
                    ? guardians.map((g) => (
                        <SelectItem key={g.id} value={g.id}>
                          {g.full_name}
                        </SelectItem>
                      ))
                    : students.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.first_name} {s.last_name}
                        </SelectItem>
                      ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="issueDate">Issue Date</Label>
              <DatePicker
                id="issueDate"
                value={watch('issueDate') || ''}
                onChange={(v) => setValue('issueDate', v, { shouldValidate: true })}
                placeholder="Select issue date"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dueDate">Due Date</Label>
              <DatePicker
                id="dueDate"
                value={watch('dueDate') || ''}
                onChange={(v) => setValue('dueDate', v, { shouldValidate: true })}
                placeholder="Select due date"
              />
              {isPastDue && (
                <p className="text-xs text-amber-600 dark:text-amber-500 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  This due date is in the past — the invoice will be immediately overdue.
                </p>
              )}
            </div>
          </div>

          <div className={`space-y-2 ${itemsLocked ? 'opacity-60 pointer-events-none' : ''}`}>
            <div className="flex items-center justify-between">
              <Label>Line Items</Label>
              {!itemsLocked && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ description: '', quantity: 1, unitPrice: 0 })}
                >
                  <Plus className="mr-1 h-3 w-3" />
                  Add Item
                </Button>
              )}
            </div>

            <div className="space-y-2">
              <div className="hidden sm:grid sm:grid-cols-[1fr_auto_auto_auto] gap-2 px-1">
                <Label className="text-xs text-muted-foreground">Description</Label>
                <Label className="text-xs text-muted-foreground w-20">Qty</Label>
                <Label className="text-xs text-muted-foreground w-24">Price ({currencySymbol(currentOrg?.currency_code || 'GBP')})</Label>
                <div className="w-10" />
              </div>
              {fields.map((field, index) => (
                <div key={field.id} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
                  <div className="space-y-1 sm:space-y-0">
                    <Label className="text-xs text-muted-foreground sm:hidden">Description</Label>
                    <Input
                      placeholder="Description"
                      disabled={itemsLocked}
                      {...register(`items.${index}.description`, { required: true })}
                      className="flex-1"
                    />
                  </div>
                  <div className="space-y-1 sm:space-y-0">
                    <Label className="text-xs text-muted-foreground sm:hidden">Qty</Label>
                    <Input
                      type="number"
                      placeholder="Qty"
                      step="1"
                      min="1"
                      disabled={itemsLocked}
                      {...register(`items.${index}.quantity`, {
                        required: true,
                        valueAsNumber: true,
                        min: 1,
                        validate: (v) => Number.isInteger(v) || 'Quantity must be a whole number',
                      })}
                      className="w-full sm:w-20"
                    />
                  </div>
                  <div className="space-y-1 sm:space-y-0">
                    <Label className="text-xs text-muted-foreground sm:hidden">Price ({currencySymbol(currentOrg?.currency_code || 'GBP')})</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Price"
                      disabled={itemsLocked}
                      {...register(`items.${index}.unitPrice`, {
                        required: true,
                        valueAsNumber: true,
                        min: 0.01,
                      })}
                      className="w-full sm:w-24"
                    />
                  </div>
                  {fields.length > 1 && !itemsLocked && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-11 w-11 sm:h-10 sm:w-10"
                      onClick={() => remove(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {payerId && availableCredits.length > 0 && (
            <div className={`rounded-lg border border-dashed border-primary/30 bg-primary/5 p-4 space-y-3 ${itemsLocked ? 'opacity-60 pointer-events-none' : ''}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Gift className="h-4 w-4 text-primary" />
                  <Label className="text-primary font-medium">
                    Apply Make-Up Credits ({availableCredits.length} available)
                  </Label>
                </div>
                {availableCredits.length > 1 && !itemsLocked && (
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    onClick={selectAllCredits}
                    className="text-primary"
                  >
                    Select All
                  </Button>
                )}
              </div>

              <div className="max-h-32 space-y-1 overflow-y-auto">
                {availableCredits.map((credit) => (
                  <label
                    key={credit.id}
                    className="flex cursor-pointer items-center gap-2 rounded p-2 hover:bg-primary/10"
                  >
                    <Checkbox
                      checked={selectedCredits.has(credit.id)}
                      onCheckedChange={() => toggleCredit(credit.id)}
                      disabled={itemsLocked}
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          {formatCurrencyMinor(credit.credit_value_minor, currency)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          for {credit.student?.first_name} {credit.student?.last_name}
                        </span>
                      </div>
                      {credit.expires_at && (
                        <div className="text-xs text-muted-foreground">
                          Expires {format(new Date(credit.expires_at), 'dd MMM yyyy')}
                        </div>
                      )}
                    </div>
                  </label>
                ))}
              </div>

              {totalSelectedCredit > 0 && (
                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="text-sm text-muted-foreground">Credit to apply:</span>
                  <Badge variant="secondary" className="gap-1">
                    <Gift className="h-3 w-3" />
                    -{formatCurrencyMinor(totalSelectedCredit, currency)}
                  </Badge>
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Any additional notes..."
              {...register('notes')}
            />
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button type="button" variant="outline" className="min-h-11 w-full sm:min-h-9 sm:w-auto" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button
              className="min-h-11 w-full sm:min-h-9 sm:w-auto"
              type="submit"
              disabled={
                updateInvoice.isPending ||
                !watch('payerId') ||
                !isOnline
              }
            >
              {updateInvoice.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
