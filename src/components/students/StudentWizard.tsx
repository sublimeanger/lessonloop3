import { useState, useEffect } from 'react';
import { logger } from '@/lib/logger';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useOrg } from '@/contexts/OrgContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { logAudit } from '@/lib/auditLog';
import { Check, ChevronLeft, ChevronRight, Loader2, User, Users, GraduationCap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { studentSchema, newGuardianSchema } from '@/lib/schemas';
import { stripHtml } from '@/lib/sanitize';
import { StudentInfoStep, StudentInfoData } from './wizard/StudentInfoStep';
import { GuardianStep, GuardianData } from './wizard/GuardianStep';
import { TeachingDefaultsStep, TeachingDefaultsData } from './wizard/TeachingDefaultsStep';
import { WizardSuccess, CreatedData } from './wizard/WizardSuccess';

interface StudentWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

type WizardStep = 1 | 2 | 3 | 'success';

const STEPS = [
  { step: 1, label: 'Student Details', icon: User },
  { step: 2, label: 'Guardian', icon: Users },
  { step: 3, label: 'Teaching Setup', icon: GraduationCap },
] as const;

export function StudentWizard({ open, onOpenChange, onSuccess }: StudentWizardProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentOrg } = useOrg();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [isSaving, setIsSaving] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<{ show: boolean; matches: { id: string; first_name: string; last_name: string; email: string | null }[] }>({ show: false, matches: [] });
  const [skipDuplicateCheck, setSkipDuplicateCheck] = useState(false);
  
  // Form data for each step
  const [studentData, setStudentData] = useState<StudentInfoData>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    dob: '',
    notes: '',
    instrumentId: '',
    examBoardId: '',
    currentGradeId: '',
  });
  
  const [guardianData, setGuardianData] = useState<GuardianData>({
    addGuardian: false,
    mode: 'existing',
    existingGuardianId: '',
    newGuardianName: '',
    newGuardianEmail: '',
    newGuardianPhone: '',
    relationship: 'guardian',
    isPrimaryPayer: true,
  });
  
  const [teachingData, setTeachingData] = useState<TeachingDefaultsData>({
    locationId: '',
    teacherId: '',
    rateCardId: '',
  });
  
  // Created data for success screen
  const [createdData, setCreatedData] = useState<CreatedData | null>(null);
  
  // Reset wizard when closed
  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setCurrentStep(1);
        setDuplicateWarning({ show: false, matches: [] });
        setSkipDuplicateCheck(false);
        setStudentData({ firstName: '', lastName: '', email: '', phone: '', dob: '', notes: '', instrumentId: '', examBoardId: '', currentGradeId: '' });
        setGuardianData({
          addGuardian: false,
          mode: 'existing',
          existingGuardianId: '',
          newGuardianName: '',
          newGuardianEmail: '',
          newGuardianPhone: '',
          relationship: 'guardian',
          isPrimaryPayer: true,
        });
        setTeachingData({ locationId: '', teacherId: '', rateCardId: '' });
        setCreatedData(null);
      }, 200);
    }
  }, [open]);
  
  const validateStep1 = (): boolean => {
    const result = studentSchema.safeParse(studentData);
    if (!result.success) {
      const firstError = result.error.errors[0];
      toast({ title: 'Validation error', description: firstError.message, variant: 'destructive' });
      return false;
    }
    return true;
  };
  
  const validateStep2 = (): boolean => {
    if (guardianData.addGuardian) {
      if (guardianData.mode === 'existing' && !guardianData.existingGuardianId) {
        toast({ title: 'Select guardian', description: 'Please select an existing guardian.', variant: 'destructive' });
        return false;
      }
      if (guardianData.mode === 'new') {
        const result = newGuardianSchema.safeParse({
          full_name: guardianData.newGuardianName,
          email: guardianData.newGuardianEmail,
          phone: guardianData.newGuardianPhone,
        });
        if (!result.success) {
          const firstError = result.error.errors[0];
          toast({ title: 'Validation error', description: firstError.message, variant: 'destructive' });
          return false;
        }
      }
    }
    return true;
  };
  
  const handleNext = () => {
    if (currentStep === 1 && validateStep1()) {
      setCurrentStep(2);
    } else if (currentStep === 2 && validateStep2()) {
      setCurrentStep(3);
    }
  };
  
  const handleBack = () => {
    if (currentStep === 2) setCurrentStep(1);
    else if (currentStep === 3) setCurrentStep(2);
  };
  
  const handleCreate = async () => {
    if (!currentOrg) return;
    
    // Duplicate detection
    if (!skipDuplicateCheck) {
      const newFirst = studentData.firstName.trim().toLowerCase();
      const newLast = studentData.lastName.trim().toLowerCase();
      const newEmail = studentData.email.trim().toLowerCase();
      
      const { data: existing } = await supabase
        .from('students')
        .select('id, first_name, last_name, email')
        .eq('org_id', currentOrg.id)
        .is('deleted_at', null);
      
      const matches = (existing || []).filter((s) => {
        const nameMatch = s.first_name.toLowerCase() === newFirst && s.last_name.toLowerCase() === newLast;
        const emailMatch = newEmail && s.email && s.email.toLowerCase() === newEmail;
        return nameMatch || emailMatch;
      });
      
      if (matches.length > 0) {
        setDuplicateWarning({ show: true, matches });
        return;
      }
    }
    setSkipDuplicateCheck(false);
    setIsSaving(true);
    
    try {
      // 1. Create the student
      const studentPayload = {
        org_id: currentOrg.id,
        first_name: studentData.firstName.trim(),
        last_name: studentData.lastName.trim(),
        email: studentData.email.trim() || null,
        phone: studentData.phone.trim() || null,
        dob: studentData.dob || null,
        notes: studentData.notes.trim() ? stripHtml(studentData.notes.trim()) : null,
        default_location_id: teachingData.locationId || null,
        default_teacher_id: teachingData.teacherId || null,
        default_rate_card_id: teachingData.rateCardId || null,
      };
      
      const { data: createdStudent, error: studentError } = await supabase
        .from('students')
        .insert(studentPayload)
        .select()
        .single();
      
      if (studentError) throw studentError;

      // 1b. Create student_instruments record if instrument selected
      if (studentData.instrumentId && studentData.instrumentId !== 'none') {
        const { error: instrError } = await (supabase as any)
          .from('student_instruments')
          .insert({
            student_id: createdStudent.id,
            org_id: currentOrg.id,
            instrument_id: studentData.instrumentId,
            exam_board_id: studentData.examBoardId && studentData.examBoardId !== 'none' ? studentData.examBoardId : null,
            current_grade_id: studentData.currentGradeId && studentData.currentGradeId !== 'none' ? studentData.currentGradeId : null,
            is_primary: true,
          });
        if (instrError) {
          logger.error('Student instrument creation failed:', instrError);
        }
      }

      let guardianInfo: CreatedData['guardian'] = undefined;
      
      // 2. Handle guardian if requested
      if (guardianData.addGuardian) {
        let guardianId = guardianData.existingGuardianId;
        let guardianName = '';
        
        if (guardianData.mode === 'new') {
          // Create new guardian
          const { data: newGuardian, error: guardianError } = await supabase
            .from('guardians')
            .insert({
              org_id: currentOrg.id,
              full_name: guardianData.newGuardianName.trim(),
              email: guardianData.newGuardianEmail.trim() || null,
              phone: guardianData.newGuardianPhone.trim() || null,
            })
            .select()
            .single();
          
          if (guardianError) {
            logger.error('Guardian creation failed:', guardianError);
            toast({ 
              title: 'Student created, guardian failed', 
              description: 'The student was created but we couldn\'t add the guardian. You can add them later.',
              variant: 'destructive' 
            });
          } else {
            guardianId = newGuardian.id;
            guardianName = newGuardian.full_name;
          }
        } else if (guardianId) {
          // Get existing guardian name
          const { data: existingG } = await supabase
            .from('guardians')
            .select('full_name')
            .eq('id', guardianId)
            .single();
          guardianName = existingG?.full_name || '';
        }
        
        // Link guardian to student
        if (guardianId) {
          const { error: linkError } = await supabase
            .from('student_guardians')
            .insert({
              org_id: currentOrg.id,
              student_id: createdStudent.id,
              guardian_id: guardianId,
              relationship: guardianData.relationship,
              is_primary_payer: guardianData.isPrimaryPayer,
            });
          
          if (linkError) {
            logger.error('Guardian link failed:', linkError);
          } else {
            guardianInfo = {
              name: guardianName,
              relationship: guardianData.relationship,
            };
          }
        }
      }
      
      // 3. Get location name for success display
      let locationName: string | undefined;
      if (teachingData.locationId) {
        const { data: loc } = await supabase
          .from('locations')
          .select('name')
          .eq('id', teachingData.locationId)
          .single();
        locationName = loc?.name;
      }
      
      // Set success data
      setCreatedData({
        studentId: createdStudent.id,
        studentName: `${createdStudent.first_name} ${createdStudent.last_name}`,
        guardian: guardianInfo,
        locationName,
      });
      
      setCurrentStep('success');
      toast({ title: 'Student created' });
      queryClient.invalidateQueries({ queryKey: ['usage-counts'] });
      if (currentOrg && user) {
        logAudit(currentOrg.id, user.id, 'student.created', 'student', createdStudent.id, {
          after: { first_name: createdStudent.first_name, last_name: createdStudent.last_name, email: createdStudent.email },
        });
      }
      onSuccess?.();
      
    } catch (error: unknown) {
      logger.error('Student creation error:', error);
      toast({ 
        title: 'Failed to create student', 
        description: error instanceof Error ? error.message : 'Unknown error', 
        variant: 'destructive' 
      });
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleViewStudent = () => {
    if (createdData) {
      navigate(`/students/${createdData.studentId}`);
      onOpenChange(false);
    }
  };
  
  const handleAddAnother = () => {
    setCurrentStep(1);
    setStudentData({ firstName: '', lastName: '', email: '', phone: '', dob: '', notes: '', instrumentId: '', examBoardId: '', currentGradeId: '' });
    setGuardianData({
      addGuardian: false,
      mode: 'existing',
      existingGuardianId: '',
      newGuardianName: '',
      newGuardianEmail: '',
      newGuardianPhone: '',
      relationship: 'guardian',
      isPrimaryPayer: true,
    });
    setTeachingData({ locationId: '', teacherId: '', rateCardId: '' });
    setCreatedData(null);
  };
  
  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[100dvh] w-full max-w-none overflow-y-auto rounded-none p-4 sm:h-auto sm:max-h-[90vh] sm:max-w-2xl sm:rounded-lg sm:p-6">
        <DialogHeader>
          <DialogTitle>
            {currentStep === 'success' ? 'Student Created!' : 'Add Student'}
          </DialogTitle>
          <DialogDescription>
            {currentStep === 'success' 
              ? 'Your new student has been added successfully.'
              : 'Create a complete student profile in a few steps.'}
          </DialogDescription>
        </DialogHeader>
        
        {/* Step indicator */}
        {currentStep !== 'success' && (
          <div className="flex items-center justify-center gap-4 sm:justify-between py-4 px-2">
            {STEPS.map(({ step, label, icon: Icon }, index) => (
              <div key={step} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors",
                      currentStep === step
                        ? "border-primary bg-primary text-primary-foreground"
                        : (typeof currentStep === 'number' && typeof step === 'number' && currentStep > step)
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-muted-foreground/30 text-muted-foreground"
                    )}
                  >
                    {(typeof currentStep === 'number' && currentStep > (step as number)) ? (
                      <Check className="h-5 w-5" />
                    ) : (
                      <Icon className="h-5 w-5" />
                    )}
                  </div>
                  <span className={cn(
                    "mt-2 text-xs font-medium text-center max-w-[60px] sm:max-w-none truncate",
                    currentStep === step ? "text-primary" : "text-muted-foreground"
                  )}>
                    {label}
                  </span>
                </div>
                {index < STEPS.length - 1 && (
                  <div 
                    className={cn(
                      "mx-1 sm:mx-2 h-0.5 w-8 sm:w-16 md:w-24 hidden sm:block",
                      (typeof currentStep === 'number' && typeof step === 'number' && currentStep > step)
                        ? "bg-primary"
                        : "bg-muted-foreground/30"
                    )}
                  />
                )}
              </div>
            ))}
          </div>
        )}
        
        {currentStep === 'success' && createdData ? (
          <div className="py-4">
            <WizardSuccess 
              data={createdData} 
              onViewStudent={handleViewStudent}
              onAddAnother={handleAddAnother}
            />
          </div>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); if (typeof currentStep === 'number' && currentStep < 3) handleNext(); else handleCreate(); }}>
            <div className="py-4">
              {currentStep === 1 && (
                <StudentInfoStep data={studentData} onChange={setStudentData} />
              )}
              {currentStep === 2 && (
                <GuardianStep data={guardianData} onChange={setGuardianData} />
              )}
              {currentStep === 3 && (
                <TeachingDefaultsStep data={teachingData} onChange={setTeachingData} />
              )}
            </div>
            <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={currentStep === 1 ? () => onOpenChange(false) : handleBack}
              >
                {currentStep === 1 ? 'Cancel' : (
                  <>
                    <ChevronLeft className="mr-1 h-4 w-4" />
                    Back
                  </>
                )}
              </Button>
              {typeof currentStep === 'number' && currentStep < 3 ? (
                <Button type="submit">
                  Next
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              ) : (
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Student'
                  )}
                </Button>
              )}
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
    
    <Dialog open={duplicateWarning.show} onOpenChange={(open) => { if (!open) setDuplicateWarning({ show: false, matches: [] }); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Possible duplicate student</DialogTitle>
          <DialogDescription>
            A student with a similar name or email already exists:
          </DialogDescription>
        </DialogHeader>
        <ul className="my-2 space-y-1 text-sm">
          {duplicateWarning.matches.map((m) => (
            <li key={m.id} className="rounded border p-2">
              <span className="font-medium">{m.first_name} {m.last_name}</span>
              {m.email && <span className="ml-2 text-muted-foreground">({m.email})</span>}
            </li>
          ))}
        </ul>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => setDuplicateWarning({ show: false, matches: [] })}>Cancel</Button>
          <Button onClick={() => { setDuplicateWarning({ show: false, matches: [] }); setSkipDuplicateCheck(true); setTimeout(() => handleCreate(), 0); }}>Continue Anyway</Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
