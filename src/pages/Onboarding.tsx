import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useOrg, OrgType } from '@/contexts/OrgContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle2, Loader2, User, Users, Building, Building2, Clock, PoundSterling, MapPin, UserPlus } from 'lucide-react';
import { LogoHorizontal } from '@/components/brand/Logo';

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
  { day: 'monday', label: 'Monday', enabled: true, start: '09:00', end: '18:00' },
  { day: 'tuesday', label: 'Tuesday', enabled: true, start: '09:00', end: '18:00' },
  { day: 'wednesday', label: 'Wednesday', enabled: true, start: '09:00', end: '18:00' },
  { day: 'thursday', label: 'Thursday', enabled: true, start: '09:00', end: '18:00' },
  { day: 'friday', label: 'Friday', enabled: true, start: '09:00', end: '18:00' },
  { day: 'saturday', label: 'Saturday', enabled: false, start: '09:00', end: '13:00' },
  { day: 'sunday', label: 'Sunday', enabled: false, start: '10:00', end: '12:00' },
];

const commonInstruments = [
  'Piano', 'Guitar', 'Violin', 'Drums', 'Voice/Singing', 'Flute', 
  'Saxophone', 'Clarinet', 'Cello', 'Trumpet', 'Music Theory'
];

const orgTypes: { value: OrgType; label: string; description: string; icon: React.ReactNode }[] = [
  { value: 'solo_teacher', label: 'Solo Teacher', description: 'I teach on my own', icon: <User className="h-5 w-5" /> },
  { value: 'studio', label: 'Studio', description: 'Small team, shared space', icon: <Users className="h-5 w-5" /> },
  { value: 'academy', label: 'Academy', description: 'Multiple teachers & locations', icon: <Building className="h-5 w-5" /> },
  { value: 'agency', label: 'Agency', description: 'Manage teachers for clients', icon: <Building2 className="h-5 w-5" /> },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const { user, profile, updateProfile, signOut, isLoading: authLoading, isInitialised } = useAuth();
  const { createOrganisation, refreshOrganisations } = useOrg();
  const { toast } = useToast();
  
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [createdOrgId, setCreatedOrgId] = useState<string | null>(null);
  const [createdOrgType, setCreatedOrgType] = useState<OrgType>('solo_teacher');
  
  // Step 1: Profile
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  
  // Step 2: Organisation
  const [orgName, setOrgName] = useState('');
  const [orgType, setOrgType] = useState<OrgType>('solo_teacher');
  
  // Solo teacher steps
  const [instruments, setInstruments] = useState<string[]>([]);
  const [customInstrument, setCustomInstrument] = useState('');
  const [defaultLessonLength, setDefaultLessonLength] = useState('60');
  const [teachingAddress, setTeachingAddress] = useState('');
  const [availability, setAvailability] = useState<AvailabilityDay[]>(defaultAvailability);
  const [defaultRate, setDefaultRate] = useState('45');
  
  // Academy steps
  const [locationName, setLocationName] = useState('');
  const [locationAddress, setLocationAddress] = useState('');
  const [locationCity, setLocationCity] = useState('');
  const [locationPostcode, setLocationPostcode] = useState('');
  const [billingApproach, setBillingApproach] = useState<BillingApproach>('monthly');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'teacher'>('teacher');

  // Sync form state with profile when it loads
  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setPhone(profile.phone || '');
    }
  }, [profile]);

  // Emergency logout handler
  const handleEmergencyLogout = async () => {
    await signOut();
    navigate('/login');
  };

  // Show loading only during initial auth check
  if (!isInitialised || authLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Loading your profile...</p>
        <Button variant="ghost" size="sm" onClick={handleEmergencyLogout} className="mt-4">
          Stuck? Click to logout
        </Button>
      </div>
    );
  }

  // If not authenticated, redirect to login
  if (!user) {
    navigate('/login');
    return null;
  }

  // If already completed onboarding, redirect to dashboard
  if (profile?.has_completed_onboarding) {
    navigate('/dashboard');
    return null;
  }

  const isSoloTeacher = orgType === 'solo_teacher' || orgType === 'studio';
  const isAcademyOrAgency = orgType === 'academy' || orgType === 'agency';

  const getSteps = () => {
    const baseSteps = [
      { id: 1, title: 'Your details', description: 'Tell us about yourself' },
      { id: 2, title: 'Your organisation', description: 'Set up your teaching business' },
    ];

    if (isSoloTeacher && createdOrgId) {
      return [
        ...baseSteps,
        { id: 3, title: 'Teaching profile', description: 'What do you teach?' },
        { id: 4, title: 'Working hours', description: 'Set your availability' },
        { id: 5, title: 'Rates', description: 'Set your lesson rates' },
        { id: 6, title: 'All set!', description: "You're ready to go" },
      ];
    }

    if (isAcademyOrAgency && createdOrgId) {
      return [
        ...baseSteps,
        { id: 3, title: 'First location', description: 'Add your main venue' },
        { id: 4, title: 'Billing setup', description: 'How do you bill?' },
        { id: 5, title: 'Invite team', description: 'Add your first team members' },
        { id: 6, title: 'All set!', description: "You're ready to go" },
      ];
    }

    return [...baseSteps, { id: 3, title: 'All set!', description: "You're ready to go" }];
  };

  const steps = getSteps();
  const totalSteps = steps.length;

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

  const handleNext = async () => {
    if (currentStep === 1) {
      if (!fullName.trim()) {
        toast({ title: 'Name required', description: 'Please enter your full name.', variant: 'destructive' });
        return;
      }
      setIsLoading(true);
      const { error } = await updateProfile({ full_name: fullName.trim(), phone: phone.trim() || null });
      setIsLoading(false);
      if (error) {
        toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
        return;
      }
      setCurrentStep(2);
    } else if (currentStep === 2) {
      const name = orgName.trim() || `${fullName.trim()}'s Music`;
      setIsLoading(true);
      const { org, error } = await createOrganisation({ name, org_type: orgType });
      setIsLoading(false);
      if (error || !org) {
        toast({ title: 'Failed to create organisation', description: error?.message || 'Unknown error', variant: 'destructive' });
        return;
      }
      setCreatedOrgId(org.id);
      setCreatedOrgType(orgType);
      setCurrentStep(3);
    } else if (currentStep === 3 && isSoloTeacher && createdOrgId) {
      // Save teacher profile
      if (instruments.length === 0) {
        toast({ title: 'Select instruments', description: 'Please select at least one instrument you teach.', variant: 'destructive' });
        return;
      }
      setIsLoading(true);
      const { error } = await supabase.from('teacher_profiles').insert({
        user_id: user!.id,
        org_id: createdOrgId,
        instruments,
        default_lesson_length_mins: parseInt(defaultLessonLength),
        teaching_address: teachingAddress.trim() || null,
      });
      setIsLoading(false);
      if (error) {
        toast({ title: 'Failed to save profile', description: error.message, variant: 'destructive' });
        return;
      }
      setCurrentStep(4);
    } else if (currentStep === 3 && isAcademyOrAgency && createdOrgId) {
      // Save location
      if (!locationName.trim()) {
        toast({ title: 'Location name required', description: 'Please enter a name for your location.', variant: 'destructive' });
        return;
      }
      setIsLoading(true);
      const { error } = await supabase.from('locations').insert({
        org_id: createdOrgId,
        name: locationName.trim(),
        address_line_1: locationAddress.trim() || null,
        city: locationCity.trim() || null,
        postcode: locationPostcode.trim() || null,
        is_primary: true,
      });
      setIsLoading(false);
      if (error) {
        toast({ title: 'Failed to save location', description: error.message, variant: 'destructive' });
        return;
      }
      setCurrentStep(4);
    } else if (currentStep === 4 && isSoloTeacher && createdOrgId) {
      // Save availability
      setIsLoading(true);
      const availabilityToSave = availability
        .filter(day => day.enabled)
        .map(day => ({
          user_id: user!.id,
          org_id: createdOrgId,
          day_of_week: day.day,
          start_time: day.start,
          end_time: day.end,
          is_available: true,
        }));
      
      if (availabilityToSave.length > 0) {
        const { error } = await supabase.from('availability_templates').insert(availabilityToSave);
        if (error) {
          setIsLoading(false);
          toast({ title: 'Failed to save availability', description: error.message, variant: 'destructive' });
          return;
        }
      }
      setIsLoading(false);
      setCurrentStep(5);
    } else if (currentStep === 4 && isAcademyOrAgency && createdOrgId) {
      // Save billing approach
      setIsLoading(true);
      const { error } = await supabase
        .from('organisations')
        .update({ billing_approach: billingApproach })
        .eq('id', createdOrgId);
      setIsLoading(false);
      if (error) {
        toast({ title: 'Failed to save settings', description: error.message, variant: 'destructive' });
        return;
      }
      setCurrentStep(5);
    } else if (currentStep === 5 && isSoloTeacher && createdOrgId) {
      // Save rate card
      setIsLoading(true);
      const { error } = await supabase.from('rate_cards').insert({
        org_id: createdOrgId,
        name: 'Standard Lesson',
        duration_mins: parseInt(defaultLessonLength),
        rate_amount: parseFloat(defaultRate),
        is_default: true,
      });
      setIsLoading(false);
      if (error) {
        toast({ title: 'Failed to save rate', description: error.message, variant: 'destructive' });
        return;
      }
      setCurrentStep(6);
    } else if (currentStep === 5 && isAcademyOrAgency && createdOrgId) {
      // Create invite if email provided
      if (inviteEmail.trim()) {
        setIsLoading(true);
        const { error } = await supabase.from('invites').insert({
          org_id: createdOrgId,
          email: inviteEmail.trim().toLowerCase(),
          role: inviteRole,
        });
        setIsLoading(false);
        if (error && !error.message.includes('duplicate')) {
          toast({ title: 'Failed to create invite', description: error.message, variant: 'destructive' });
          return;
        }
      }
      setCurrentStep(6);
    } else if (currentStep === totalSteps) {
      // Complete onboarding
      setIsLoading(true);
      try {
        await updateProfile({ has_completed_onboarding: true });
        await refreshOrganisations();
        navigate('/dashboard');
      } catch (err) {
        console.error('Error completing onboarding:', err);
        toast({ title: 'Error', description: 'Failed to complete onboarding. Please try again.', variant: 'destructive' });
      } finally {
        setIsLoading(false);
      }
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleSkip = () => {
    setCurrentStep(prev => prev + 1);
  };

  return (
    <div className="flex min-h-screen flex-col gradient-hero-light p-4">
      <div className="mx-auto w-full max-w-2xl pt-8">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <LogoHorizontal size="lg" />
        </div>
        
        {/* Progress */}
        <div className="mb-8 flex justify-center gap-1">
          {steps.map((step) => (
            <div
              key={step.id}
              className={`h-2 flex-1 max-w-16 rounded-full transition-colors ${
                step.id <= currentStep ? 'gradient-accent' : 'bg-muted'
              }`}
            />
          ))}
        </div>

        <Card className="shadow-elevated">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">{steps[currentStep - 1]?.title}</CardTitle>
            <CardDescription>{steps[currentStep - 1]?.description}</CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4">
            {/* Step 1: Profile */}
            {currentStep === 1 && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full name</Label>
                  <Input id="fullName" placeholder="John Smith" value={fullName} onChange={(e) => setFullName(e.target.value)} disabled={isLoading} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={user?.email || profile?.email || ''} disabled className="bg-muted" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone number (optional)</Label>
                  <Input id="phone" type="tel" placeholder="+44 7700 900000" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={isLoading} />
                </div>
              </>
            )}

            {/* Step 2: Organisation */}
            {currentStep === 2 && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="orgName">Organisation name</Label>
                  <Input id="orgName" placeholder={`${fullName.trim() || 'Your'}'s Music`} value={orgName} onChange={(e) => setOrgName(e.target.value)} disabled={isLoading} />
                </div>
                <div className="space-y-3">
                  <Label>What best describes your setup?</Label>
                  <RadioGroup value={orgType} onValueChange={(v) => setOrgType(v as OrgType)} className="grid gap-3">
                    {orgTypes.map((type) => (
                      <div key={type.value}>
                        <RadioGroupItem value={type.value} id={type.value} className="peer sr-only" disabled={isLoading} />
                        <Label htmlFor={type.value} className="flex items-center gap-4 rounded-lg border bg-card p-4 cursor-pointer transition-colors hover:bg-accent peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">{type.icon}</div>
                          <div className="flex-1">
                            <div className="font-medium">{type.label}</div>
                            <div className="text-sm text-muted-foreground">{type.description}</div>
                          </div>
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
              </>
            )}

            {/* Solo Teacher Step 3: Teaching Profile */}
            {currentStep === 3 && isSoloTeacher && createdOrgId && (
              <>
                <div className="space-y-3">
                  <Label>What instruments do you teach?</Label>
                  <div className="flex flex-wrap gap-2">
                    {commonInstruments.map((instrument) => (
                      <button
                        key={instrument}
                        type="button"
                        onClick={() => toggleInstrument(instrument)}
                        className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                          instruments.includes(instrument)
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-background hover:bg-accent'
                        }`}
                      >
                        {instrument}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input placeholder="Add custom..." value={customInstrument} onChange={(e) => setCustomInstrument(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomInstrument())} />
                    <Button type="button" variant="outline" onClick={addCustomInstrument}>Add</Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Default lesson length</Label>
                  <Select value={defaultLessonLength} onValueChange={setDefaultLessonLength}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30 minutes</SelectItem>
                      <SelectItem value="45">45 minutes</SelectItem>
                      <SelectItem value="60">60 minutes</SelectItem>
                      <SelectItem value="90">90 minutes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Teaching address (optional)</Label>
                  <Input id="address" placeholder="123 High Street, London" value={teachingAddress} onChange={(e) => setTeachingAddress(e.target.value)} />
                </div>
              </>
            )}

            {/* Solo Teacher Step 4: Working Hours */}
            {currentStep === 4 && isSoloTeacher && createdOrgId && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>Set your typical working hours</span>
                </div>
                {availability.map((day, index) => (
                  <div key={day.day} className="flex items-center gap-4">
                    <div className="flex items-center gap-2 w-28">
                      <Checkbox checked={day.enabled} onCheckedChange={(checked) => updateAvailability(index, { enabled: !!checked })} />
                      <span className={day.enabled ? 'font-medium' : 'text-muted-foreground'}>{day.label}</span>
                    </div>
                    {day.enabled && (
                      <>
                        <Input type="time" value={day.start} onChange={(e) => updateAvailability(index, { start: e.target.value })} className="w-28" />
                        <span className="text-muted-foreground">to</span>
                        <Input type="time" value={day.end} onChange={(e) => updateAvailability(index, { end: e.target.value })} className="w-28" />
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Solo Teacher Step 5: Rates */}
            {currentStep === 5 && isSoloTeacher && createdOrgId && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <PoundSterling className="h-4 w-4" />
                  <span>Set your default lesson rate</span>
                </div>
                <div className="space-y-2">
                  <Label>Rate per {defaultLessonLength}-minute lesson</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">£</span>
                    <Input type="number" value={defaultRate} onChange={(e) => setDefaultRate(e.target.value)} className="pl-7" placeholder="45" />
                  </div>
                  <p className="text-xs text-muted-foreground">You can add more rate cards later in Settings</p>
                </div>
              </div>
            )}

            {/* Academy Step 3: Location */}
            {currentStep === 3 && isAcademyOrAgency && createdOrgId && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  <span>Add your main teaching location</span>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="locName">Location name</Label>
                  <Input id="locName" placeholder="Main Studio" value={locationName} onChange={(e) => setLocationName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="locAddress">Address</Label>
                  <Input id="locAddress" placeholder="123 High Street" value={locationAddress} onChange={(e) => setLocationAddress(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="locCity">City</Label>
                    <Input id="locCity" placeholder="London" value={locationCity} onChange={(e) => setLocationCity(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="locPostcode">Postcode</Label>
                    <Input id="locPostcode" placeholder="SW1A 1AA" value={locationPostcode} onChange={(e) => setLocationPostcode(e.target.value)} />
                  </div>
                </div>
              </div>
            )}

            {/* Academy Step 4: Billing */}
            {currentStep === 4 && isAcademyOrAgency && createdOrgId && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <PoundSterling className="h-4 w-4" />
                  <span>How do you bill your students?</span>
                </div>
                <RadioGroup value={billingApproach} onValueChange={(v) => setBillingApproach(v as BillingApproach)} className="space-y-3">
                  <div className="flex items-center space-x-3 rounded-lg border p-4">
                    <RadioGroupItem value="monthly" id="monthly" />
                    <Label htmlFor="monthly" className="flex-1 cursor-pointer">
                      <div className="font-medium">Monthly</div>
                      <div className="text-sm text-muted-foreground">Invoice at the end of each month</div>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-3 rounded-lg border p-4">
                    <RadioGroupItem value="termly" id="termly" />
                    <Label htmlFor="termly" className="flex-1 cursor-pointer">
                      <div className="font-medium">Termly</div>
                      <div className="text-sm text-muted-foreground">Invoice at the start of each school term</div>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-3 rounded-lg border p-4">
                    <RadioGroupItem value="custom" id="custom" />
                    <Label htmlFor="custom" className="flex-1 cursor-pointer">
                      <div className="font-medium">Custom</div>
                      <div className="text-sm text-muted-foreground">Define your own billing periods</div>
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            )}

            {/* Academy Step 5: Invite Team */}
            {currentStep === 5 && isAcademyOrAgency && createdOrgId && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <UserPlus className="h-4 w-4" />
                  <span>Invite your first team member (optional)</span>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="inviteEmail">Email address</Label>
                  <Input id="inviteEmail" type="email" placeholder="teacher@example.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
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
                <p className="text-xs text-muted-foreground">They'll receive an email invitation to join your organisation</p>
              </div>
            )}

            {/* Final Step */}
            {currentStep === totalSteps && (
              <div className="flex flex-col items-center py-8">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-success/10">
                  <CheckCircle2 className="h-10 w-10 text-success" />
                </div>
                <h3 className="mt-4 text-xl font-semibold">You're all set!</h3>
                <p className="mt-2 text-center text-muted-foreground">
                  Your LessonLoop account is ready. Start by adding your first student or scheduling a lesson.
                </p>
              </div>
            )}
          </CardContent>

          <CardFooter className="flex justify-between">
            <Button
              variant="outline"
              onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
              disabled={currentStep === 1 || isLoading}
            >
              Back
            </Button>
            <div className="flex gap-2">
              {currentStep === 5 && isAcademyOrAgency && (
                <Button variant="ghost" onClick={handleSkip} disabled={isLoading}>
                  Skip
                </Button>
              )}
              <Button onClick={handleNext} disabled={isLoading}>
                {isLoading ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</>
                ) : currentStep === totalSteps ? (
                  'Go to Dashboard'
                ) : (
                  'Continue'
                )}
              </Button>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
