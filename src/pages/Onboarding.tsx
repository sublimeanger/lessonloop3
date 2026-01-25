import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useOrg, OrgType } from '@/contexts/OrgContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { Loader2, PoundSterling, MapPin, UserPlus, Music, Clock } from 'lucide-react';
import { useOnboardingDraft } from '@/hooks/useOnboardingDraft';
import { OnboardingWelcome } from '@/components/onboarding/OnboardingWelcome';
import { OnboardingLayout } from '@/components/onboarding/OnboardingLayout';
import { OnboardingStep } from '@/components/onboarding/OnboardingStep';
import { OnboardingSuccess } from '@/components/onboarding/OnboardingSuccess';

type BillingApproach = 'monthly' | 'termly' | 'custom';
type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

interface AvailabilityDay {
  day: DayOfWeek;
  label: string;
  enabled: boolean;
  start: string;
  end: string;
}

const defaultAvailability: AvailabilityDay[] = [
  { day: 'monday', label: 'Mon', enabled: true, start: '09:00', end: '18:00' },
  { day: 'tuesday', label: 'Tue', enabled: true, start: '09:00', end: '18:00' },
  { day: 'wednesday', label: 'Wed', enabled: true, start: '09:00', end: '18:00' },
  { day: 'thursday', label: 'Thu', enabled: true, start: '09:00', end: '18:00' },
  { day: 'friday', label: 'Fri', enabled: true, start: '09:00', end: '18:00' },
  { day: 'saturday', label: 'Sat', enabled: false, start: '09:00', end: '13:00' },
  { day: 'sunday', label: 'Sun', enabled: false, start: '10:00', end: '12:00' },
];

const commonInstruments = [
  'Piano', 'Guitar', 'Violin', 'Drums', 'Voice', 'Flute', 
  'Saxophone', 'Clarinet', 'Cello', 'Trumpet', 'Theory'
];

export default function Onboarding() {
  const navigate = useNavigate();
  const { user, profile, updateProfile, signOut, isLoading: authLoading, isInitialised } = useAuth();
  const { createOrganisation, refreshOrganisations } = useOrg();
  const { toast } = useToast();
  const { draft, setDraft, clearDraft, hasRestoredDraft, dismissRestoredNotice } = useOnboardingDraft();
  
  // Flow state
  const [showWelcome, setShowWelcome] = useState(true);
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [stepError, setStepError] = useState<string | null>(null);
  const [createdOrgId, setCreatedOrgId] = useState<string | null>(null);
  
  // Form state
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [orgName, setOrgName] = useState('');
  const [orgType, setOrgType] = useState<OrgType>('solo_teacher');
  const [instruments, setInstruments] = useState<string[]>([]);
  const [customInstrument, setCustomInstrument] = useState('');
  const [defaultLessonLength, setDefaultLessonLength] = useState('60');
  const [defaultRate, setDefaultRate] = useState('45');
  const [availability, setAvailability] = useState<AvailabilityDay[]>(defaultAvailability);
  const [locationName, setLocationName] = useState('');
  const [locationAddress, setLocationAddress] = useState('');
  const [locationCity, setLocationCity] = useState('');
  const [locationPostcode, setLocationPostcode] = useState('');
  const [billingApproach, setBillingApproach] = useState<BillingApproach>('monthly');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'teacher'>('teacher');

  // Sync form state with profile and draft
  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setPhone(profile.phone || '');
    }
  }, [profile]);

  useEffect(() => {
    if (draft.currentStep > 0 && hasRestoredDraft) {
      setShowWelcome(false);
      setCurrentStep(draft.currentStep);
      setOrgType(draft.orgType);
      setFullName(draft.fullName || profile?.full_name || '');
      setPhone(draft.phone || profile?.phone || '');
      setOrgName(draft.orgName);
      setInstruments(draft.instruments);
      setDefaultLessonLength(draft.defaultLessonLength);
      setDefaultRate(draft.defaultRate);
      setLocationName(draft.locationName);
      setLocationAddress(draft.locationAddress);
      setLocationCity(draft.locationCity);
      setLocationPostcode(draft.locationPostcode);
      setBillingApproach(draft.billingApproach);
    }
  }, [draft, hasRestoredDraft, profile]);

  // Save draft on form changes
  useEffect(() => {
    if (!showWelcome && currentStep > 0) {
      setDraft({
        currentStep,
        fullName,
        phone,
        orgName,
        orgType,
        instruments,
        defaultLessonLength,
        defaultRate,
        locationName,
        locationAddress,
        locationCity,
        locationPostcode,
        billingApproach,
      });
    }
  }, [currentStep, fullName, phone, orgName, orgType, instruments, defaultLessonLength, defaultRate, locationName, locationAddress, locationCity, locationPostcode, billingApproach, showWelcome, setDraft]);

  const handleLogout = async () => {
    clearDraft();
    await signOut();
    navigate('/login');
  };

  const handleStartOver = () => {
    clearDraft();
    setShowWelcome(true);
    setCurrentStep(1);
    setCreatedOrgId(null);
    setStepError(null);
  };

  // Loading state
  if (!isInitialised || authLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Loading your profile...</p>
        <Button variant="ghost" size="sm" onClick={handleLogout} className="mt-4">
          Stuck? Click to logout
        </Button>
      </div>
    );
  }

  if (!user) {
    navigate('/login');
    return null;
  }

  if (profile?.has_completed_onboarding) {
    navigate('/dashboard');
    return null;
  }

  const isSoloTeacher = orgType === 'solo_teacher' || orgType === 'studio';
  const isAcademyOrAgency = orgType === 'academy' || orgType === 'agency';

  // Define steps based on org type
  const getSteps = () => {
    if (isSoloTeacher) {
      return [
        { id: 1, title: 'Your Details' },
        { id: 2, title: 'Teaching' },
        { id: 3, title: 'Schedule' },
        { id: 4, title: 'Done!' },
      ];
    }
    return [
      { id: 1, title: 'Your Details' },
      { id: 2, title: 'Location' },
      { id: 3, title: 'Billing' },
      { id: 4, title: 'Done!' },
    ];
  };

  const steps = getSteps();
  const totalSteps = steps.length;
  const isLastStep = currentStep === totalSteps;

  const toggleInstrument = (instrument: string) => {
    setInstruments(prev => 
      prev.includes(instrument) 
        ? prev.filter(i => i !== instrument)
        : [...prev, instrument]
    );
  };

  const addCustomInstrument = () => {
    if (customInstrument.trim() && !instruments.includes(customInstrument.trim())) {
      setInstruments(prev => [...prev, customInstrument.trim()]);
      setCustomInstrument('');
    }
  };

  const updateAvailability = (index: number, updates: Partial<AvailabilityDay>) => {
    setAvailability(prev => prev.map((day, i) => i === index ? { ...day, ...updates } : day));
  };

  // Welcome screen handler
  const handleWelcomeContinue = () => {
    console.log('[Onboarding] Welcome complete, org type:', orgType);
    setShowWelcome(false);
    setCurrentStep(1);
  };

  // Step navigation
  const handleNext = async () => {
    setStepError(null);
    console.log('[Onboarding] handleNext called, step:', currentStep, 'orgType:', orgType);

    try {
      if (currentStep === 1) {
        // Save profile
        if (!fullName.trim()) {
          setStepError('Please enter your full name');
          return;
        }
        setIsLoading(true);
        
        // Validate session before any database operations
        console.log('[Onboarding] Step 1: Validating session...');
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (!session || sessionError) {
          console.error('[Onboarding] No valid session:', sessionError);
          setStepError('Your session has expired. Please log in again.');
          setIsLoading(false);
          await signOut();
          navigate('/login');
          return;
        }
        console.log('[Onboarding] Session valid, user:', session.user.id);
        
        // Refresh session to ensure fresh token
        const { error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError) {
          console.warn('[Onboarding] Session refresh warning:', refreshError.message);
        }
        
        console.log('[Onboarding] Step 1: Starting profile save...');
        
        // Use AbortController for proper request cancellation
        const profileController = new AbortController();
        const profileTimeoutId = setTimeout(() => profileController.abort(), 10000);
        
        try {
          const { error: profileError } = await supabase
            .from('profiles')
            .update({ 
              full_name: fullName.trim(), 
              phone: phone.trim() || null 
            })
            .eq('id', user.id)
            .abortSignal(profileController.signal);
          
          clearTimeout(profileTimeoutId);
          
          if (profileError) {
            console.error('[Onboarding] Profile save failed:', profileError);
            if (profileError.message?.includes('JWT')) {
              setStepError('Session expired. Please log in again.');
              await signOut();
              navigate('/login');
              return;
            }
            setStepError(profileError.message);
            setIsLoading(false);
            return;
          }
          console.log('[Onboarding] Step 1: Profile saved successfully');
        } catch (err: any) {
          clearTimeout(profileTimeoutId);
          console.error('[Onboarding] Profile save error:', err);
          
          if (err.name === 'AbortError') {
            setStepError('Profile save timed out. Please check your connection and try again.');
          } else if (err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError')) {
            setStepError('Network error. Please check your internet connection and try again.');
          } else if (err.message?.includes('JWT')) {
            setStepError('Session expired. Please log in again.');
            await signOut();
            navigate('/login');
            return;
          } else {
            setStepError(err.message || 'Failed to save profile. Please try again.');
          }
          setIsLoading(false);
          return;
        }

        // Create organisation - generate ID client-side to avoid RLS race condition
        const name = orgName.trim() || `${fullName.trim()}'s Music`;
        const newOrgId = crypto.randomUUID();
        console.log('[Onboarding] Step 1: Creating organisation:', name, orgType, 'ID:', newOrgId);
        
        const orgController = new AbortController();
        const orgTimeoutId = setTimeout(() => orgController.abort(), 10000);
        
        try {
          const { error: orgError } = await supabase
            .from('organisations')
            .insert({
              id: newOrgId,
              name,
              org_type: orgType,
              country_code: 'GB',
              currency_code: 'GBP',
              timezone: 'Europe/London',
              created_by: user.id,
            })
            .abortSignal(orgController.signal);
          
          clearTimeout(orgTimeoutId);
          
          if (orgError) {
            console.error('[Onboarding] Org creation failed:', orgError);
            setStepError(orgError.message || 'Failed to create organisation. Please try again.');
            setIsLoading(false);
            return;
          }
          
          console.log('[Onboarding] Step 1: Organisation created successfully');
          setCreatedOrgId(newOrgId);
          
          // Wait briefly for trigger to complete, then refresh org context
          await new Promise(resolve => setTimeout(resolve, 300));
          refreshOrganisations().catch(console.error);
          
          setIsLoading(false);
          setCurrentStep(2);
        } catch (err: any) {
          clearTimeout(orgTimeoutId);
          console.error('[Onboarding] Org creation error:', err);
          
          if (err.name === 'AbortError') {
            setStepError('Organisation creation timed out. Please check your connection and try again.');
          } else if (err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError')) {
            setStepError('Network error. Please check your internet connection and try again.');
          } else {
            setStepError(err.message || 'Failed to create organisation. Please try again.');
          }
          setIsLoading(false);
          return;
        }
      } else if (currentStep === 2 && isSoloTeacher && createdOrgId) {
        // Save teaching profile
        if (instruments.length === 0) {
          setStepError('Please select at least one instrument');
          return;
        }
        setIsLoading(true);
        console.log('[Onboarding] Saving teacher profile...');
        
        // Create teacher profile
        const { error: teacherError } = await supabase.from('teacher_profiles').insert({
          user_id: user.id,
          org_id: createdOrgId,
          instruments,
          default_lesson_length_mins: parseInt(defaultLessonLength),
        });
        if (teacherError) {
          console.error('[Onboarding] Teacher profile failed:', teacherError);
          setStepError(teacherError.message);
          setIsLoading(false);
          return;
        }

        // Create rate card
        const { error: rateError } = await supabase.from('rate_cards').insert({
          org_id: createdOrgId,
          name: 'Standard Lesson',
          duration_mins: parseInt(defaultLessonLength),
          rate_amount: parseFloat(defaultRate),
          is_default: true,
        });
        if (rateError) {
          console.error('[Onboarding] Rate card failed:', rateError);
          // Non-critical, continue
        }

        setIsLoading(false);
        setCurrentStep(3);
      } else if (currentStep === 2 && isAcademyOrAgency && createdOrgId) {
        // Save location
        if (!locationName.trim()) {
          setStepError('Please enter a location name');
          return;
        }
        setIsLoading(true);
        console.log('[Onboarding] Saving location...');
        const { error } = await supabase.from('locations').insert({
          org_id: createdOrgId,
          name: locationName.trim(),
          address_line_1: locationAddress.trim() || null,
          city: locationCity.trim() || null,
          postcode: locationPostcode.trim() || null,
          is_primary: true,
        });
        if (error) {
          console.error('[Onboarding] Location failed:', error);
          setStepError(error.message);
          setIsLoading(false);
          return;
        }
        setIsLoading(false);
        setCurrentStep(3);
      } else if (currentStep === 3 && isSoloTeacher && createdOrgId) {
        // Save availability
        setIsLoading(true);
        console.log('[Onboarding] Saving availability...');
        const availabilityToSave = availability
          .filter(day => day.enabled)
          .map(day => ({
            user_id: user.id,
            org_id: createdOrgId,
            day_of_week: day.day,
            start_time: day.start,
            end_time: day.end,
            is_available: true,
          }));
        
        if (availabilityToSave.length > 0) {
          const { error } = await supabase.from('availability_templates').insert(availabilityToSave);
          if (error) {
            console.error('[Onboarding] Availability failed:', error);
            // Non-critical, continue
          }
        }
        setIsLoading(false);
        setCurrentStep(4);
      } else if (currentStep === 3 && isAcademyOrAgency && createdOrgId) {
        // Save billing approach + invite
        setIsLoading(true);
        console.log('[Onboarding] Saving billing approach...');
        const { error: billingError } = await supabase
          .from('organisations')
          .update({ billing_approach: billingApproach })
          .eq('id', createdOrgId);
        if (billingError) {
          console.error('[Onboarding] Billing update failed:', billingError);
          // Non-critical, continue
        }

        // Create invite if email provided
        if (inviteEmail.trim()) {
          const { error: inviteError } = await supabase.from('invites').insert({
            org_id: createdOrgId,
            email: inviteEmail.trim().toLowerCase(),
            role: inviteRole,
          });
          if (inviteError && !inviteError.message.includes('duplicate')) {
            console.error('[Onboarding] Invite failed:', inviteError);
            // Non-critical, continue
          }
        }
        setIsLoading(false);
        setCurrentStep(4);
      }
    } catch (err) {
      console.error('[Onboarding] Unexpected error:', err);
      setStepError('Something went wrong. Please try again.');
      setIsLoading(false);
    }
  };

  const handleComplete = async () => {
    setIsLoading(true);
    console.log('[Onboarding] Completing onboarding...');
    try {
      await updateProfile({ has_completed_onboarding: true });
      await refreshOrganisations();
      clearDraft();
      toast({ title: 'Welcome to LessonLoop!', description: "You're all set up and ready to go." });
      navigate('/dashboard');
    } catch (err) {
      console.error('[Onboarding] Complete failed:', err);
      setStepError('Failed to complete setup. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    setStepError(null);
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    } else {
      setShowWelcome(true);
    }
  };

  // Render welcome screen
  if (showWelcome) {
    return (
      <OnboardingWelcome
        selectedType={orgType}
        onSelectType={setOrgType}
        onContinue={handleWelcomeContinue}
        onLogout={handleLogout}
        userName={profile?.full_name || fullName}
      />
    );
  }

  // Render success screen
  if (isLastStep) {
    return (
      <OnboardingLayout
        steps={steps}
        currentStep={currentStep}
        onBack={handleBack}
        onNext={handleComplete}
        onLogout={handleLogout}
        onStartOver={handleStartOver}
        isLoading={isLoading}
        canGoBack={true}
        nextLabel="Go to Dashboard"
        hasRestoredDraft={hasRestoredDraft}
        onDismissRestore={dismissRestoredNotice}
      >
        <OnboardingSuccess
          orgType={orgType}
          onComplete={handleComplete}
          isLoading={isLoading}
        />
      </OnboardingLayout>
    );
  }

  // Render step content
  const renderStepContent = () => {
    // Step 1: Your Details (same for both paths)
    if (currentStep === 1) {
      return (
        <OnboardingStep
          stepKey={1}
          title="Tell us about yourself"
          subtitle="This is how students and parents will see you"
          error={stepError}
        >
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full name *</Label>
              <Input 
                id="fullName" 
                placeholder="John Smith" 
                value={fullName} 
                onChange={(e) => setFullName(e.target.value)} 
                disabled={isLoading}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email" 
                type="email" 
                value={user?.email || ''} 
                disabled 
                className="bg-muted" 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone number (optional)</Label>
              <Input 
                id="phone" 
                type="tel" 
                placeholder="+44 7700 900000" 
                value={phone} 
                onChange={(e) => setPhone(e.target.value)} 
                disabled={isLoading} 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="orgName">Business name</Label>
              <Input 
                id="orgName" 
                placeholder={`${fullName.trim() || 'Your'}'s Music`} 
                value={orgName} 
                onChange={(e) => setOrgName(e.target.value)} 
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">This appears on invoices and messages</p>
            </div>
          </div>
        </OnboardingStep>
      );
    }

    // Solo Teacher Step 2: Teaching Profile
    if (currentStep === 2 && isSoloTeacher) {
      return (
        <OnboardingStep
          stepKey="solo-2"
          title="What do you teach?"
          subtitle="Select the instruments and subjects you offer"
          hint="You can add more later in Settings"
          error={stepError}
        >
          <div className="space-y-6">
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Music className="h-4 w-4" />
                Instruments & subjects
              </Label>
              <div className="flex flex-wrap gap-2">
                {commonInstruments.map((instrument) => (
                  <button
                    key={instrument}
                    type="button"
                    onClick={() => toggleInstrument(instrument)}
                    className={`px-3 py-1.5 text-sm rounded-full border transition-all ${
                      instruments.includes(instrument)
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background hover:bg-accent border-border'
                    }`}
                  >
                    {instrument}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <Input 
                  placeholder="Add custom..." 
                  value={customInstrument} 
                  onChange={(e) => setCustomInstrument(e.target.value)} 
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomInstrument())} 
                />
                <Button type="button" variant="outline" onClick={addCustomInstrument}>Add</Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Lesson length</Label>
                <Select value={defaultLessonLength} onValueChange={setDefaultLessonLength}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 mins</SelectItem>
                    <SelectItem value="45">45 mins</SelectItem>
                    <SelectItem value="60">60 mins</SelectItem>
                    <SelectItem value="90">90 mins</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Rate per lesson</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">£</span>
                  <Input 
                    type="number" 
                    value={defaultRate} 
                    onChange={(e) => setDefaultRate(e.target.value)} 
                    className="pl-7" 
                    placeholder="45" 
                  />
                </div>
              </div>
            </div>
          </div>
        </OnboardingStep>
      );
    }

    // Solo Teacher Step 3: Schedule
    if (currentStep === 3 && isSoloTeacher) {
      return (
        <OnboardingStep
          stepKey="solo-3"
          title="When do you teach?"
          subtitle="Set your typical working hours"
          hint="This helps prevent booking conflicts"
          error={stepError}
        >
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <Clock className="h-4 w-4" />
              <span>Toggle days and set your hours</span>
            </div>
            {availability.map((day, index) => (
              <div key={day.day} className="flex items-center gap-3 py-2 border-b last:border-0">
                <div className="flex items-center gap-2 w-16">
                  <Checkbox 
                    checked={day.enabled} 
                    onCheckedChange={(checked) => updateAvailability(index, { enabled: !!checked })} 
                  />
                  <span className={`text-sm font-medium ${day.enabled ? '' : 'text-muted-foreground'}`}>
                    {day.label}
                  </span>
                </div>
                {day.enabled ? (
                  <div className="flex items-center gap-2 flex-1">
                    <Input 
                      type="time" 
                      value={day.start} 
                      onChange={(e) => updateAvailability(index, { start: e.target.value })} 
                      className="w-24 text-sm" 
                    />
                    <span className="text-muted-foreground text-sm">to</span>
                    <Input 
                      type="time" 
                      value={day.end} 
                      onChange={(e) => updateAvailability(index, { end: e.target.value })} 
                      className="w-24 text-sm" 
                    />
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">Not working</span>
                )}
              </div>
            ))}
          </div>
        </OnboardingStep>
      );
    }

    // Academy Step 2: Location
    if (currentStep === 2 && isAcademyOrAgency) {
      return (
        <OnboardingStep
          stepKey="academy-2"
          title="Add your main location"
          subtitle="Where do lessons take place?"
          hint="You can add more locations later"
          error={stepError}
        >
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span>Primary teaching venue</span>
            </div>
            <div className="space-y-2">
              <Label htmlFor="locName">Location name *</Label>
              <Input 
                id="locName" 
                placeholder="Main Studio" 
                value={locationName} 
                onChange={(e) => setLocationName(e.target.value)} 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="locAddress">Address</Label>
              <Input 
                id="locAddress" 
                placeholder="123 High Street" 
                value={locationAddress} 
                onChange={(e) => setLocationAddress(e.target.value)} 
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="locCity">City</Label>
                <Input 
                  id="locCity" 
                  placeholder="London" 
                  value={locationCity} 
                  onChange={(e) => setLocationCity(e.target.value)} 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="locPostcode">Postcode</Label>
                <Input 
                  id="locPostcode" 
                  placeholder="SW1A 1AA" 
                  value={locationPostcode} 
                  onChange={(e) => setLocationPostcode(e.target.value)} 
                />
              </div>
            </div>
          </div>
        </OnboardingStep>
      );
    }

    // Academy Step 3: Billing
    if (currentStep === 3 && isAcademyOrAgency) {
      return (
        <OnboardingStep
          stepKey="academy-3"
          title="How do you bill?"
          subtitle="Choose your default billing cycle"
          hint="You can customise this per student later"
          error={stepError}
        >
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <PoundSterling className="h-4 w-4" />
              <span>Billing frequency</span>
            </div>
            <RadioGroup 
              value={billingApproach} 
              onValueChange={(v) => setBillingApproach(v as BillingApproach)} 
              className="space-y-3"
            >
              <label className="flex items-center gap-3 rounded-lg border p-4 cursor-pointer hover:bg-accent/50 transition-colors [&:has([data-state=checked])]:border-primary [&:has([data-state=checked])]:bg-primary/5">
                <RadioGroupItem value="monthly" id="monthly" />
                <div className="flex-1">
                  <div className="font-medium">Monthly</div>
                  <div className="text-sm text-muted-foreground">Invoice at the end of each month</div>
                </div>
              </label>
              <label className="flex items-center gap-3 rounded-lg border p-4 cursor-pointer hover:bg-accent/50 transition-colors [&:has([data-state=checked])]:border-primary [&:has([data-state=checked])]:bg-primary/5">
                <RadioGroupItem value="termly" id="termly" />
                <div className="flex-1">
                  <div className="font-medium">Termly</div>
                  <div className="text-sm text-muted-foreground">Invoice at the start of each school term</div>
                </div>
              </label>
              <label className="flex items-center gap-3 rounded-lg border p-4 cursor-pointer hover:bg-accent/50 transition-colors [&:has([data-state=checked])]:border-primary [&:has([data-state=checked])]:bg-primary/5">
                <RadioGroupItem value="custom" id="custom" />
                <div className="flex-1">
                  <div className="font-medium">Custom</div>
                  <div className="text-sm text-muted-foreground">Define your own billing periods</div>
                </div>
              </label>
            </RadioGroup>

            <div className="pt-4 border-t space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <UserPlus className="h-4 w-4" />
                <span>Invite a team member (optional)</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="inviteEmail">Email</Label>
                  <Input 
                    id="inviteEmail" 
                    type="email" 
                    placeholder="teacher@example.com" 
                    value={inviteEmail} 
                    onChange={(e) => setInviteEmail(e.target.value)} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as 'admin' | 'teacher')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="teacher">Teacher</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
        </OnboardingStep>
      );
    }

    return null;
  };

  return (
    <OnboardingLayout
      steps={steps}
      currentStep={currentStep}
      onBack={handleBack}
      onNext={handleNext}
      onLogout={handleLogout}
      onStartOver={handleStartOver}
      isLoading={isLoading}
      canGoBack={currentStep > 1 || true}
      nextLabel={currentStep === totalSteps - 1 ? 'Finish Setup' : 'Save & Continue'}
      hasRestoredDraft={hasRestoredDraft}
      onDismissRestore={dismissRestoredNotice}
    >
      {renderStepContent()}
    </OnboardingLayout>
  );
}
