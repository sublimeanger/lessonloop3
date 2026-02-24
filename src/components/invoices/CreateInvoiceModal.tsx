import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useForm, useFieldArray } from 'react-hook-form';
import { format, addDays, differenceInMinutes } from 'date-fns';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Trash2, Gift } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { useCreateInvoice, useUnbilledLessons } from '@/hooks/useInvoices';
import { useRateCards, findRateForDuration } from '@/hooks/useRateCards';
import { Checkbox } from '@/components/ui/checkbox';
import { useAvailableCreditsForPayer, AvailableCredit } from '@/hooks/useAvailableCredits';
import { Badge } from '@/components/ui/badge';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

interface CreateInvoiceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface InvoiceFormData {
  payerType: 'guardian' | 'student';
  payerId: string;
  dueDate: string;
  notes: string;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    lessonId?: string;
    studentId?: string;
  }>;
}


export function CreateInvoiceModal({ open, onOpenChange }: CreateInvoiceModalProps) {
  const { currentOrg } = useOrg();
  const createInvoice = useCreateInvoice();
  const { data: rateCards = [] } = useRateCards();
  const { isOnline, guardOffline } = useOnlineStatus();
  const [tab, setTab] = useState<'manual' | 'lessons'>('manual');
  const [lessonDateRange, setLessonDateRange] = useState({
    from: format(addDays(new Date(), -30), 'yyyy-MM-dd'),
    to: format(new Date(), 'yyyy-MM-dd'),
  });
  const [selectedLessons, setSelectedLessons] = useState<Set<string>>(new Set());
  const [selectedCredits, setSelectedCredits] = useState<Set<string>>(new Set());

  const { data: unbilledLessons = [] } = useUnbilledLessons(lessonDateRange);

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<InvoiceFormData>({
    defaultValues: {
      payerType: 'guardian',
      payerId: '',
      dueDate: format(addDays(new Date(), 14), 'yyyy-MM-dd'),
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

  // Fetch available credits for the selected payer
  const { data: availableCredits = [] } = useAvailableCreditsForPayer(payerType, payerId);

  // Calculate total credit value that can be applied
  const totalSelectedCredit = useMemo(() => {
    return availableCredits
      .filter((c) => selectedCredits.has(c.id))
      .reduce((sum, c) => sum + c.credit_value_minor, 0);
  }, [availableCredits, selectedCredits]);

  // Reset selected credits when payer changes
  useEffect(() => {
    setSelectedCredits(new Set());
  }, [payerId, payerType]);

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

  const { toast } = useToast();

  const onSubmit = async (data: InvoiceFormData) => {
    if (guardOffline()) return;

    if (!data.payerId) {
      toast({ title: 'Please select a payer', variant: 'destructive' });
      return;
    }

    if (tab === 'manual') {
      const invalidItems = data.items.filter(item => item.unitPrice <= 0 || item.quantity <= 0);
      if (invalidItems.length > 0) {
        toast({
          title: 'Invalid amounts',
          description: 'All items must have a price and quantity greater than zero.',
          variant: 'destructive',
        });
        return;
      }
    }

    const creditIdsToApply = Array.from(selectedCredits);
    
    if (tab === 'manual') {
      await createInvoice.mutateAsync({
        due_date: data.dueDate,
        payer_guardian_id: data.payerType === 'guardian' ? data.payerId : undefined,
        payer_student_id: data.payerType === 'student' ? data.payerId : undefined,
        notes: data.notes,
        credit_ids: creditIdsToApply.length > 0 ? creditIdsToApply : undefined,
        items: data.items.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          unit_price_minor: Math.round(item.unitPrice * 100),
        })),
      });
    } else {
      // Create from lessons
      const selectedLessonData = unbilledLessons.filter((l) => selectedLessons.has(l.id));
      if (selectedLessonData.length === 0) return;

      await createInvoice.mutateAsync({
        due_date: data.dueDate,
        payer_guardian_id: data.payerType === 'guardian' ? data.payerId : undefined,
        payer_student_id: data.payerType === 'student' ? data.payerId : undefined,
        notes: data.notes,
        credit_ids: creditIdsToApply.length > 0 ? creditIdsToApply : undefined,
        items: selectedLessonData.map((lesson) => {
          // Calculate lesson duration in minutes
          const durationMins = differenceInMinutes(
            new Date(lesson.end_at),
            new Date(lesson.start_at)
          );
          // Use rate cards to find correct price
          const unitPriceMinor = findRateForDuration(durationMins, rateCards);
          
          // Get student ID from first participant if available
          const firstParticipant = lesson.lesson_participants?.[0];
          const studentId = firstParticipant?.student?.id;

          return {
            description: lesson.title,
            quantity: 1,
            unit_price_minor: unitPriceMinor,
            linked_lesson_id: lesson.id,
            student_id: studentId,
          };
        }),
      });
    }

    handleOpenChange(false);
  };

  const toggleLesson = (lessonId: string) => {
    const newSelected = new Set(selectedLessons);
    if (newSelected.has(lessonId)) {
      newSelected.delete(lessonId);
    } else {
      newSelected.add(lessonId);
    }
    setSelectedLessons(newSelected);
  };

  const selectAllLessons = () => {
    setSelectedLessons(new Set(unbilledLessons.map((l) => l.id)));
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
      setSelectedLessons(new Set());
      setSelectedCredits(new Set());
      setTab('manual');
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="h-screen w-screen max-w-none overflow-y-auto rounded-none border-0 p-4 sm:h-auto sm:max-h-[90vh] sm:max-w-2xl sm:rounded-lg sm:border sm:p-6">
        <DialogHeader>
          <DialogTitle>Create Invoice</DialogTitle>
          <DialogDescription>
            Create a new invoice manually or generate from lessons
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as 'manual' | 'lessons')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="manual">Manual Entry</TabsTrigger>
            <TabsTrigger value="lessons">From Lessons</TabsTrigger>
          </TabsList>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-4">
            {/* Common payer selection */}
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

            <div className="space-y-2">
              <Label htmlFor="dueDate">Due Date</Label>
              <Input id="dueDate" type="date" {...register('dueDate', { required: true })} />
            </div>

            <TabsContent value="manual" className="mt-0 space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Line Items</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => append({ description: '', quantity: 1, unitPrice: 0 })}
                  >
                    <Plus className="mr-1 h-3 w-3" />
                    Add Item
                  </Button>
                </div>

                <div className="space-y-2">
                  {fields.map((field, index) => (
                    <div key={field.id} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
                      <Input
                        placeholder="Description"
                        {...register(`items.${index}.description`, { required: true })}
                        className="flex-1"
                      />
                      <Input
                        type="number"
                        placeholder="Qty"
                        {...register(`items.${index}.quantity`, {
                          required: true,
                          valueAsNumber: true,
                          min: 1,
                        })}
                        className="w-full sm:w-20"
                      />
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Price"
                        {...register(`items.${index}.unitPrice`, {
                          required: true,
                          valueAsNumber: true,
                          min: 0.01,
                        })}
                        className="w-full sm:w-24"
                      />
                      {fields.length > 1 && (
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
            </TabsContent>

            <TabsContent value="lessons" className="mt-0 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>From Date</Label>
                  <Input
                    type="date"
                    value={lessonDateRange.from}
                    onChange={(e) =>
                      setLessonDateRange((r) => ({ ...r, from: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>To Date</Label>
                  <Input
                    type="date"
                    value={lessonDateRange.to}
                    onChange={(e) =>
                      setLessonDateRange((r) => ({ ...r, to: e.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Unbilled Lessons ({unbilledLessons.length})</Label>
                  {unbilledLessons.length > 0 && (
                    <Button type="button" variant="link" size="sm" onClick={selectAllLessons}>
                      Select All
                    </Button>
                  )}
                </div>

                <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border p-2">
                  {unbilledLessons.length === 0 ? (
                    <p className="py-4 text-center text-sm text-muted-foreground">
                      No unbilled lessons found
                    </p>
                  ) : (
                    unbilledLessons.map((lesson) => (
                      <label
                        key={lesson.id}
                        className="flex cursor-pointer items-center gap-2 rounded p-2 hover:bg-muted"
                      >
                        <Checkbox
                          checked={selectedLessons.has(lesson.id)}
                          onCheckedChange={() => toggleLesson(lesson.id)}
                        />
                        <div className="flex-1">
                          <div className="text-sm font-medium">{lesson.title}</div>
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(lesson.start_at), 'dd MMM yyyy HH:mm')}
                          </div>
                        </div>
                      </label>
                    ))
                  )}
                </div>
              </div>
            </TabsContent>

            {/* Credit Application Section */}
            {payerId && availableCredits.length > 0 && (
              <div className="rounded-lg border border-dashed border-primary/30 bg-primary/5 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Gift className="h-4 w-4 text-primary" />
                    <Label className="text-primary font-medium">
                      Apply Make-Up Credits ({availableCredits.length} available)
                    </Label>
                  </div>
                  {availableCredits.length > 1 && (
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
                      -{formatCurrencyMinor(totalSelectedCredit)}
                    </Badge>
                  </div>
                )}
                {totalSelectedCredit > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Credits exceeding the invoice total will be capped at the total amount. Any excess is not deducted.
                  </p>
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
                  createInvoice.isPending ||
                  !watch('payerId') ||
                  (tab === 'lessons' && selectedLessons.size === 0) ||
                  !isOnline
                }
              >
                {createInvoice.isPending ? 'Creating...' : 'Create Invoice'}
              </Button>
            </DialogFooter>
          </form>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
