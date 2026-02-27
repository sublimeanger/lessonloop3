import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, CheckCircle2, ArrowRightLeft, LogOut, RefreshCw } from 'lucide-react';
import { useOrg } from '@/contexts/OrgContext';
import { useStudentTermLessons } from '@/hooks/useStudentTermLessons';
import { useTermAdjustmentPreview, useTermAdjustmentConfirm } from '@/hooks/useTermAdjustment';
import type { TermAdjustmentPreview } from '@/hooks/useTermAdjustment';
import { useStudents } from '@/hooks/useStudents';
import { useTeachersAndLocations } from '@/hooks/useCalendarData';
import { useTerms, useCurrentTerm } from '@/hooks/useTerms';
import { formatCurrencyMinor } from '@/lib/utils';
import { AdjustmentPreviewCard } from './AdjustmentPreviewCard';

interface TermAdjustmentWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefillStudentId?: string;
  prefillRecurrenceId?: string;
}

type AdjustmentType = 'withdrawal' | 'day_change';

const DAY_OPTIONS = [
  { value: '1', label: 'Monday' },
  { value: '2', label: 'Tuesday' },
  { value: '3', label: 'Wednesday' },
  { value: '4', label: 'Thursday' },
  { value: '5', label: 'Friday' },
  { value: '6', label: 'Saturday' },
  { value: '0', label: 'Sunday' },
];

export function TermAdjustmentWizard({
  open,
  onOpenChange,
  prefillStudentId,
  prefillRecurrenceId,
}: TermAdjustmentWizardProps) {
  const navigate = useNavigate();
  const { currentOrg } = useOrg();
  const previewMutation = useTermAdjustmentPreview();
  const confirmMutation = useTermAdjustmentConfirm();
  const { data: students = [] } = useStudents();
  const { teachers, locations } = useTeachersAndLocations();
  const { data: terms = [] } = useTerms();
  const currentTerm = useCurrentTerm();
  const stepFocusRef = useRef<HTMLButtonElement>(null);

  const [step, setStep] = useState<'config' | 'preview' | 'complete'>('config');
  const [previewData, setPreviewData] = useState<TermAdjustmentPreview | null>(null);
  const [confirmResult, setConfirmResult] = useState<{
    cancelled_count: number;
    created_count: number;
    credit_note_invoice_id: string | null;
  } | null>(null);

  // Config state
  const [studentId, setStudentId] = useState(prefillStudentId || '');
  const [adjustmentType, setAdjustmentType] = useState<AdjustmentType>('withdrawal');
  const [recurrenceId, setRecurrenceId] = useState(prefillRecurrenceId || '');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [newDayOfWeek, setNewDayOfWeek] = useState('');
  const [newStartTime, setNewStartTime] = useState('');
  const [newTeacherId, setNewTeacherId] = useState('');
  const [newLocationId, setNewLocationId] = useState('');
  const [generateInvoice, setGenerateInvoice] = useState(true);
  const [notes, setNotes] = useState('');

  const { data: seriesList = [], isLoading: seriesLoading } = useStudentTermLessons(
    studentId || undefined,
    currentTerm?.id
  );

  // Auto-populate when series is selected
  useEffect(() => {
    if (recurrenceId && seriesList.length > 0) {
      const series = seriesList.find((s) => s.recurrence_id === recurrenceId);
      if (series) {
        // Default new day/time/teacher/location to current values
        const dayIndex = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].indexOf(series.day_of_week);
        if (!newDayOfWeek) setNewDayOfWeek(String(dayIndex));
        if (!newStartTime) setNewStartTime(series.start_time);
        if (!newTeacherId && series.teacher_user_id) setNewTeacherId(series.teacher_user_id);
        if (!newLocationId && series.location_id) setNewLocationId(series.location_id);
      }
    }
  }, [recurrenceId, seriesList]);

  // Auto-focus step button
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => {
        stepFocusRef.current?.focus();
      });
    }
  }, [open, step]);

  const handleClose = () => {
    setStep('config');
    setPreviewData(null);
    setConfirmResult(null);
    setStudentId(prefillStudentId || '');
    setAdjustmentType('withdrawal');
    setRecurrenceId(prefillRecurrenceId || '');
    setEffectiveDate('');
    setNewDayOfWeek('');
    setNewStartTime('');
    setNewTeacherId('');
    setNewLocationId('');
    setGenerateInvoice(true);
    setNotes('');
    previewMutation.reset();
    confirmMutation.reset();
    onOpenChange(false);
  };

  const handlePreview = async () => {
    const result = await previewMutation.mutateAsync({
      adjustment_type: adjustmentType,
      student_id: studentId,
      recurrence_id: recurrenceId,
      effective_date: effectiveDate,
      ...(adjustmentType === 'day_change' && {
        new_day_of_week: parseInt(newDayOfWeek, 10),
        new_start_time: newStartTime,
        ...(newTeacherId && { new_teacher_id: newTeacherId }),
        ...(newLocationId && { new_location_id: newLocationId }),
      }),
      notes: notes || undefined,
    });

    setPreviewData(result);
    setStep('preview');
  };

  const handleConfirm = async () => {
    if (!previewData) return;

    const result = await confirmMutation.mutateAsync({
      adjustment_id: previewData.adjustment_id,
      adjustment_type: adjustmentType,
      student_id: studentId,
      recurrence_id: recurrenceId,
      effective_date: effectiveDate,
      generate_credit_note: generateInvoice,
      notes: notes || undefined,
    });

    setConfirmResult(result);
    setStep('complete');
  };

  const selectedSeries = seriesList.find((s) => s.recurrence_id === recurrenceId);
  const canPreview = studentId && recurrenceId && effectiveDate && (
    adjustmentType === 'withdrawal' || (adjustmentType === 'day_change' && newDayOfWeek && newStartTime)
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="h-screen w-screen max-w-none overflow-y-auto rounded-none border-0 p-4 sm:h-auto sm:max-w-xl sm:rounded-lg sm:border sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" />
            Term Adjustment
          </DialogTitle>
          <DialogDescription>
            {step === 'config' && 'Configure the adjustment details'}
            {step === 'preview' && 'Review what will change before confirming'}
            {step === 'complete' && 'Adjustment confirmed'}
          </DialogDescription>
        </DialogHeader>

        {/* ── Step 1: Config ────────────────────────────────────── */}
        {step === 'config' && (
          <div className="space-y-4">
            {/* Student selector */}
            {!prefillStudentId && (
              <div className="space-y-2">
                <Label>Student</Label>
                <Select value={studentId} onValueChange={(v) => { setStudentId(v); setRecurrenceId(''); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a student" />
                  </SelectTrigger>
                  <SelectContent>
                    {students.map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.first_name} {s.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {prefillStudentId && (
              <div className="space-y-2">
                <Label className="text-muted-foreground">Student</Label>
                <div className="rounded-lg border bg-muted p-2 text-sm">
                  {students.find((s: any) => s.id === prefillStudentId)
                    ? `${(students.find((s: any) => s.id === prefillStudentId) as any).first_name} ${(students.find((s: any) => s.id === prefillStudentId) as any).last_name}`
                    : 'Loading...'}
                </div>
              </div>
            )}

            {/* Adjustment type */}
            <div className="space-y-2">
              <Label>Adjustment Type</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAdjustmentType('withdrawal')}
                  className={`rounded-lg border p-3 text-left transition-colors ${
                    adjustmentType === 'withdrawal'
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <LogOut className="h-4 w-4" />
                    <span className="text-sm font-medium">Withdrawal</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Student leaving mid-term
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustmentType('day_change')}
                  className={`rounded-lg border p-3 text-left transition-colors ${
                    adjustmentType === 'day_change'
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <RefreshCw className="h-4 w-4" />
                    <span className="text-sm font-medium">Change day/time</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Moving to a new schedule
                  </div>
                </button>
              </div>
            </div>

            {/* Lesson Series */}
            {studentId && (
              <div className="space-y-2">
                <Label>Lesson Series</Label>
                {seriesLoading ? (
                  <div className="flex items-center gap-2 p-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading series...
                  </div>
                ) : seriesList.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-3 text-center text-sm text-muted-foreground">
                    No recurring lesson series with remaining scheduled lessons found for this student.
                  </div>
                ) : (
                  <Select
                    value={recurrenceId}
                    onValueChange={setRecurrenceId}
                    disabled={!!prefillRecurrenceId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a lesson series" />
                    </SelectTrigger>
                    <SelectContent>
                      {seriesList.map((s) => (
                        <SelectItem key={s.recurrence_id} value={s.recurrence_id}>
                          <div className="flex flex-col">
                            <span>
                              {s.day_of_week} {s.start_time} — {s.lesson_title}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {s.teacher_name ? `with ${s.teacher_name}` : ''} — {s.remaining_lessons} remaining
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            {/* Effective Date */}
            {recurrenceId && (
              <div className="space-y-2">
                <Label>Effective From</Label>
                <Input
                  type="date"
                  value={effectiveDate}
                  onChange={(e) => setEffectiveDate(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  First lesson to cancel. All lessons from this date onwards will be affected.
                </p>
              </div>
            )}

            {/* Day change options */}
            {adjustmentType === 'day_change' && recurrenceId && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>New Day</Label>
                    <Select value={newDayOfWeek} onValueChange={setNewDayOfWeek}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select day" />
                      </SelectTrigger>
                      <SelectContent>
                        {DAY_OPTIONS.map((d) => (
                          <SelectItem key={d.value} value={d.value}>
                            {d.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>New Time</Label>
                    <Input
                      type="time"
                      value={newStartTime}
                      onChange={(e) => setNewStartTime(e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Teacher</Label>
                    <Select value={newTeacherId} onValueChange={setNewTeacherId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Keep current" />
                      </SelectTrigger>
                      <SelectContent>
                        {(teachers || []).map((t: any) => (
                          <SelectItem key={t.user_id || t.id} value={t.user_id || t.id}>
                            {t.display_name || t.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Location</Label>
                    <Select value={newLocationId} onValueChange={setNewLocationId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Keep current" />
                      </SelectTrigger>
                      <SelectContent>
                        {(locations || []).map((l: any) => (
                          <SelectItem key={l.id} value={l.id}>
                            {l.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </>
            )}

            {/* Notes */}
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Reason for adjustment..."
                rows={2}
              />
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
                disabled={!canPreview || previewMutation.isPending}
              >
                {previewMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Calculating...
                  </>
                ) : (
                  'Preview'
                )}
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* ── Step 2: Preview ──────────────────────────────────── */}
        {step === 'preview' && previewData && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="font-medium">{previewData.student_name}</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-sm text-muted-foreground">{previewData.term_name}</span>
            </div>

            <AdjustmentPreviewCard
              preview={previewData}
              adjustmentType={adjustmentType}
            />

            {/* Generate invoice checkbox */}
            {previewData.adjustment_amount_minor !== 0 && (
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="generate-invoice"
                  checked={generateInvoice}
                  onCheckedChange={(checked) => setGenerateInvoice(checked as boolean)}
                />
                <label htmlFor="generate-invoice" className="text-sm cursor-pointer">
                  {previewData.adjustment_amount_minor > 0
                    ? 'Generate credit note'
                    : 'Generate supplementary invoice'}
                </label>
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
                onClick={handleConfirm}
                disabled={confirmMutation.isPending}
              >
                {confirmMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Confirming...
                  </>
                ) : (
                  'Confirm Adjustment'
                )}
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* ── Step 3: Complete ─────────────────────────────────── */}
        {step === 'complete' && confirmResult && (
          <div className="space-y-4">
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-center">
              <CheckCircle2 className="mx-auto h-8 w-8 text-primary" />
              <p className="mt-2 font-medium text-primary">
                Adjustment confirmed!
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {confirmResult.cancelled_count > 0 &&
                  `${confirmResult.cancelled_count} lesson${confirmResult.cancelled_count !== 1 ? 's' : ''} cancelled`}
                {confirmResult.cancelled_count > 0 && confirmResult.created_count > 0 && ' · '}
                {confirmResult.created_count > 0 &&
                  `${confirmResult.created_count} new lesson${confirmResult.created_count !== 1 ? 's' : ''} created`}
              </p>
              {confirmResult.credit_note_invoice_id && previewData && (
                <p className="text-sm text-muted-foreground mt-1">
                  {previewData.adjustment_amount_minor > 0 ? 'Credit note' : 'Supplementary invoice'} for{' '}
                  {formatCurrencyMinor(
                    Math.abs(previewData.total_adjustment_minor),
                    previewData.currency_code
                  )}
                </p>
              )}
            </div>

            <DialogFooter className="flex-col gap-2 sm:flex-row">
              {confirmResult.credit_note_invoice_id && (
                <Button
                  variant="outline"
                  className="min-h-11 w-full sm:min-h-9 sm:w-auto"
                  onClick={() => {
                    handleClose();
                    navigate(`/invoices/${confirmResult.credit_note_invoice_id}`);
                  }}
                >
                  {previewData && previewData.adjustment_amount_minor > 0
                    ? 'View Credit Note'
                    : 'View Invoice'}
                </Button>
              )}
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
