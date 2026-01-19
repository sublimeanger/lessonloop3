import { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { format, addDays } from 'date-fns';
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
import { Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { useCreateInvoice, useUnbilledLessons } from '@/hooks/useInvoices';
import { Checkbox } from '@/components/ui/checkbox';

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

interface Guardian {
  id: string;
  full_name: string;
}

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
}

export function CreateInvoiceModal({ open, onOpenChange }: CreateInvoiceModalProps) {
  const { currentOrg } = useOrg();
  const createInvoice = useCreateInvoice();
  const [tab, setTab] = useState<'manual' | 'lessons'>('manual');
  const [guardians, setGuardians] = useState<Guardian[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [lessonDateRange, setLessonDateRange] = useState({
    from: format(addDays(new Date(), -30), 'yyyy-MM-dd'),
    to: format(new Date(), 'yyyy-MM-dd'),
  });
  const [selectedLessons, setSelectedLessons] = useState<Set<string>>(new Set());

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

  useEffect(() => {
    if (!currentOrg?.id) return;

    const fetchPayers = async () => {
      const { data: guardiansData } = await supabase
        .from('guardians')
        .select('id, full_name')
        .eq('org_id', currentOrg.id)
        .order('full_name');

      const { data: studentsData } = await supabase
        .from('students')
        .select('id, first_name, last_name, email')
        .eq('org_id', currentOrg.id)
        .not('email', 'is', null)
        .order('first_name');

      setGuardians(guardiansData || []);
      setStudents(studentsData || []);
    };

    fetchPayers();
  }, [currentOrg?.id]);

  const onSubmit = async (data: InvoiceFormData) => {
    if (tab === 'manual') {
      await createInvoice.mutateAsync({
        due_date: data.dueDate,
        payer_guardian_id: data.payerType === 'guardian' ? data.payerId : undefined,
        payer_student_id: data.payerType === 'student' ? data.payerId : undefined,
        notes: data.notes,
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

      // For simplicity, use first selected payer
      await createInvoice.mutateAsync({
        due_date: data.dueDate,
        payer_guardian_id: data.payerType === 'guardian' ? data.payerId : undefined,
        payer_student_id: data.payerType === 'student' ? data.payerId : undefined,
        notes: data.notes,
        items: selectedLessonData.map((lesson) => ({
          description: lesson.title,
          quantity: 1,
          unit_price_minor: (currentOrg?.default_lesson_length_mins || 60) * 50, // Default rate
          linked_lesson_id: lesson.id,
        })),
      });
    }

    reset();
    setSelectedLessons(new Set());
    onOpenChange(false);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
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
                    <div key={field.id} className="flex gap-2">
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
                        className="w-20"
                      />
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Price"
                        {...register(`items.${index}.unitPrice`, {
                          required: true,
                          valueAsNumber: true,
                          min: 0,
                        })}
                        className="w-24"
                      />
                      {fields.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
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

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="Any additional notes..."
                {...register('notes')}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  createInvoice.isPending ||
                  (tab === 'lessons' && selectedLessons.size === 0)
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
