import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, ChevronRight, ChevronLeft, CheckCircle, Users } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useConvertLead, type ConvertLeadInput } from '@/hooks/useLeads';
import { useTeachers } from '@/hooks/useTeachers';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ConvertLeadWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: any;
  students: any[];
}

interface StudentFormState {
  lead_student_id: string;
  first_name: string;
  last_name: string;
  age: number | null;
  instrument: string | null;
  experience_level: string | null;
  selected: boolean;
  teacher_id: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STEP_LABELS = ['Review Students', 'Assign Teachers', 'Confirm & Convert'] as const;
const TOTAL_STEPS = STEP_LABELS.length;

// ---------------------------------------------------------------------------
// Step Indicator
// ---------------------------------------------------------------------------

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-4">
      {STEP_LABELS.map((label, idx) => (
        <div key={label} className="flex items-center gap-1.5">
          <div
            className={cn(
              'flex items-center justify-center h-6 w-6 rounded-full text-xs font-medium transition-colors',
              idx < currentStep
                ? 'bg-primary text-primary-foreground'
                : idx === currentStep
                  ? 'bg-primary text-primary-foreground ring-2 ring-primary/30'
                  : 'bg-muted text-muted-foreground',
            )}
          >
            {idx < currentStep ? (
              <CheckCircle className="h-3.5 w-3.5" />
            ) : (
              idx + 1
            )}
          </div>
          <span
            className={cn(
              'text-xs hidden sm:inline',
              idx === currentStep ? 'font-medium' : 'text-muted-foreground',
            )}
          >
            {label}
          </span>
          {idx < TOTAL_STEPS - 1 && (
            <ChevronRight className="h-3 w-3 text-muted-foreground mx-0.5" />
          )}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function ConvertLeadWizard({
  open,
  onOpenChange,
  lead,
  students: leadStudents,
}: ConvertLeadWizardProps) {
  const isMobile = useIsMobile();
  const { data: teachers } = useTeachers();
  const convertLead = useConvertLead();

  // Filter out already-converted students
  const convertibleStudents = leadStudents.filter(
    (s: any) => !s.converted_student_id,
  );
  const allAlreadyConverted = convertibleStudents.length === 0;

  // ---------------------------------------------------------------------------
  // Form state
  // ---------------------------------------------------------------------------

  const [step, setStep] = useState(0);
  const [formStudents, setFormStudents] = useState<StudentFormState[]>(() =>
    convertibleStudents.map((s: any) => ({
      lead_student_id: s.id,
      first_name: s.first_name || '',
      last_name: s.last_name || '',
      age: s.age ?? null,
      instrument: s.instrument ?? null,
      experience_level: s.experience_level ?? null,
      selected: true,
      teacher_id: '',
    })),
  );

  const activeTeachers = (teachers || []).filter((t) => t.status === 'active');
  const selectedStudents = formStudents.filter((s) => s.selected);

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  const resetState = () => {
    setStep(0);
    setFormStudents(
      convertibleStudents.map((s: any) => ({
        lead_student_id: s.id,
        first_name: s.first_name || '',
        last_name: s.last_name || '',
        age: s.age ?? null,
        instrument: s.instrument ?? null,
        experience_level: s.experience_level ?? null,
        selected: true,
        teacher_id: '',
      })),
    );
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      onOpenChange(false);
      setTimeout(resetState, 200);
    } else {
      onOpenChange(true);
    }
  };

  const updateStudent = (
    idx: number,
    field: keyof StudentFormState,
    value: string | boolean,
  ) => {
    setFormStudents((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s)),
    );
  };

  // ---------------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------------

  const canProceed = (() => {
    if (step === 0) {
      // At least one student must be selected and all selected must have first + last name
      if (selectedStudents.length === 0) return false;
      return selectedStudents.every(
        (s) => s.first_name.trim() && s.last_name.trim(),
      );
    }
    // Steps 1 and 2 can always proceed (teacher assignment is optional)
    return true;
  })();

  // ---------------------------------------------------------------------------
  // Convert handler
  // ---------------------------------------------------------------------------

  const handleConvert = async () => {
    const input: ConvertLeadInput = {
      leadId: lead.id,
      students: selectedStudents.map((s) => ({
        lead_student_id: s.lead_student_id,
        first_name: s.first_name.trim(),
        last_name: s.last_name.trim(),
        teacher_id: s.teacher_id || undefined,
      })),
    };

    await convertLead.mutateAsync(input);
    onOpenChange(false);
    setTimeout(resetState, 200);
  };

  // ---------------------------------------------------------------------------
  // Step content
  // ---------------------------------------------------------------------------

  const stepContent = (
    <div className="space-y-4 max-h-[60vh] overflow-y-auto px-1">
      <StepIndicator currentStep={step} />

      <p className="text-xs text-muted-foreground text-center">
        Step {step + 1} of {TOTAL_STEPS}
      </p>

      {/* ----------------------------------------------------------------- */}
      {/* Step 0: Review Students                                           */}
      {/* ----------------------------------------------------------------- */}
      {step === 0 && (
        <div className="space-y-3">
          {allAlreadyConverted ? (
            <div className="rounded-lg border border-dashed p-6 text-center space-y-2">
              <Users className="h-8 w-8 text-muted-foreground mx-auto" />
              <p className="text-sm font-medium">
                All students have already been enrolled
              </p>
              <p className="text-xs text-muted-foreground">
                Every student from this lead has already been converted.
              </p>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Select the students you want to convert and review their details.
              </p>
              {formStudents.map((student, idx) => (
                <div
                  key={student.lead_student_id}
                  className={cn(
                    'rounded-lg border bg-card p-3 space-y-2 transition-opacity',
                    !student.selected && 'opacity-50',
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={student.selected}
                      onCheckedChange={(checked) =>
                        updateStudent(idx, 'selected', !!checked)
                      }
                    />
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-xs font-medium text-muted-foreground">
                        Child {idx + 1}
                      </span>
                      {student.instrument && (
                        <Badge
                          variant="secondary"
                          className="text-[10px] px-1.5 py-0 h-5"
                        >
                          {student.instrument}
                        </Badge>
                      )}
                      {student.experience_level && (
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0 h-5"
                        >
                          {student.experience_level}
                        </Badge>
                      )}
                      {student.age != null && (
                        <span className="text-[10px] text-muted-foreground">
                          Age {student.age}
                        </span>
                      )}
                    </div>
                  </div>

                  {student.selected && (
                    <div className="grid grid-cols-2 gap-2 pl-6">
                      <div className="space-y-1">
                        <Label className="text-xs">
                          First Name{' '}
                          <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          value={student.first_name}
                          onChange={(e) =>
                            updateStudent(idx, 'first_name', e.target.value)
                          }
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">
                          Last Name{' '}
                          <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          value={student.last_name}
                          onChange={(e) =>
                            updateStudent(idx, 'last_name', e.target.value)
                          }
                          placeholder={
                            lead.contact_name?.split(' ').slice(-1)[0] || ''
                          }
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Step 1: Assign Teachers                                           */}
      {/* ----------------------------------------------------------------- */}
      {step === 1 && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Optionally assign a teacher to each student. You can skip this and
            assign teachers later.
          </p>
          {selectedStudents.map((student) => {
            const formIdx = formStudents.findIndex(
              (s) => s.lead_student_id === student.lead_student_id,
            );
            return (
              <div
                key={student.lead_student_id}
                className="rounded-lg border bg-card p-3 space-y-2"
              >
                <div className="flex items-center gap-2">
                  <Users className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    {student.first_name} {student.last_name}
                  </span>
                  {student.instrument && (
                    <Badge
                      variant="secondary"
                      className="text-[10px] px-1.5 py-0 h-5"
                    >
                      {student.instrument}
                    </Badge>
                  )}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Teacher</Label>
                  <Select
                    value={student.teacher_id}
                    onValueChange={(v) =>
                      updateStudent(formIdx, 'teacher_id', v)
                    }
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Select teacher (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeTeachers.map((teacher) => (
                        <SelectItem key={teacher.id} value={teacher.id}>
                          {teacher.display_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Step 2: Confirm & Convert                                         */}
      {/* ----------------------------------------------------------------- */}
      {step === 2 && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Review the details below and confirm the conversion.
          </p>

          {/* Guardian info */}
          <div className="rounded-lg border bg-muted/50 p-3 space-y-1.5">
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Guardian
            </h4>
            <p className="text-sm font-medium">{lead.contact_name}</p>
            {lead.contact_email && (
              <p className="text-xs text-muted-foreground">
                {lead.contact_email}
              </p>
            )}
            {lead.contact_phone && (
              <p className="text-xs text-muted-foreground">
                {lead.contact_phone}
              </p>
            )}
          </div>

          {/* Students summary */}
          <div className="rounded-lg border bg-muted/50 p-3 space-y-2">
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Students ({selectedStudents.length})
            </h4>
            {selectedStudents.map((student) => {
              const teacher = activeTeachers.find(
                (t) => t.id === student.teacher_id,
              );
              return (
                <div
                  key={student.lead_student_id}
                  className="flex items-center justify-between text-sm"
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                    <span>
                      {student.first_name} {student.last_name}
                    </span>
                  </div>
                  <span className="text-muted-foreground text-xs">
                    {teacher ? teacher.display_name : 'No teacher assigned'}
                  </span>
                </div>
              );
            })}
          </div>

          {/* What will happen */}
          <div className="space-y-1.5">
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              This will
            </h4>
            <ul className="space-y-1 text-sm">
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                <span>
                  Create{' '}
                  <strong>{selectedStudents.length}</strong> student
                  record{selectedStudents.length !== 1 ? 's' : ''}
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                <span>
                  Create a guardian record for{' '}
                  <strong>{lead.contact_name}</strong>
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                <span>
                  Mark this lead as <strong>Enrolled</strong>
                </span>
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );

  // ---------------------------------------------------------------------------
  // Footer
  // ---------------------------------------------------------------------------

  const footer = (
    <>
      {step > 0 && (
        <Button
          variant="outline"
          onClick={() => setStep((s) => s - 1)}
          className="min-h-[44px] gap-1"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </Button>
      )}
      <div className="flex-1" />
      {step < TOTAL_STEPS - 1 ? (
        <Button
          onClick={() => setStep((s) => s + 1)}
          disabled={!canProceed || allAlreadyConverted}
          className="min-h-[44px] gap-1"
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      ) : (
        <Button
          onClick={handleConvert}
          disabled={convertLead.isPending || selectedStudents.length === 0}
          className="min-h-[44px] gap-1"
        >
          {convertLead.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle className="h-4 w-4" />
          )}
          Convert
        </Button>
      )}
    </>
  );

  // ---------------------------------------------------------------------------
  // Responsive rendering: Drawer on mobile, Dialog on desktop
  // ---------------------------------------------------------------------------

  if (isMobile) {
    return (
      <Drawer
        open={open}
        onOpenChange={handleOpenChange}
      >
        <DrawerContent className="max-h-[92vh]">
          <DrawerHeader>
            <DrawerTitle>Convert Lead to Students</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-2">{stepContent}</div>
          <DrawerFooter className="flex-row gap-2">
            {footer}
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Convert Lead to Students</DialogTitle>
        </DialogHeader>
        {stepContent}
        <DialogFooter className="flex-row gap-2 sm:justify-between">
          {footer}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
