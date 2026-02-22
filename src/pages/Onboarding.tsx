import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { LogoHorizontal } from '@/components/brand/Logo';
import { Loader2, LogOut, User, Building2, Users, Network, CheckCircle2, ArrowLeft, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { PlanSelector, getRecommendedPlan } from '@/components/onboarding/PlanSelector';
import { OnboardingProgress } from '@/components/onboarding/OnboardingProgress';

type OrgType = 'solo_teacher' | 'studio' | 'academy' | 'agency';
type SubscriptionPlan = 'solo_teacher' | 'academy' | 'agency';
type Step = 'profile' | 'plan' | 'loading' | 'success' | 'error';

const STORAGE_KEY = 'lessonloop-onboarding-state';
interface SavedState { fullName: string; orgName: string; orgType: OrgType; selectedPlan: SubscriptionPlan; step: Step; }
function saveOnboardingState(state: SavedState) {
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
}
function loadOnboardingState(): SavedState | null {
  try { const s = sessionStorage.getItem(STORAGE_KEY); return s ? JSON.parse(s) : null; } catch { return null; }
}
function clearOnboardingState() {
  try { sessionStorage.removeItem(STORAGE_KEY); } catch {}
}

const ORG_TYPES = [
  { value: 'solo_teacher' as const, label: 'Solo Teacher', description: 'Independent music teacher', icon: User },
  { value: 'studio' as const, label: 'Music Studio', description: 'Small studio with a few teachers', icon: Building2 },
  { value: 'academy' as const, label: 'Music Academy', description: 'Larger school with multiple locations', icon: Users },
  { value: 'agency' as const, label: 'Teaching Agency', description: 'Agency managing peripatetic teachers', icon: Network },
];

const STEPS = [
  { id: 'profile', label: 'Your Details' },
  { id: 'plan', label: 'Choose Plan' },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const { user, session, signOut, refreshProfile, profile } = useAuth();
  const { toast } = useToast();
  
  const saved = useRef(loadOnboardingState());
  const [step, setStep] = useState<Step>(() => {
    const s = saved.current?.step;
    return s === 'loading' || s === 'error' ? 'plan' : s || 'profile';
  });
  const [orgType, setOrgType] = useState<OrgType>(saved.current?.orgType || 'solo_teacher');
  const [fullName, setFullName] = useState(saved.current?.fullName || '');
  const [orgName, setOrgName] = useState(saved.current?.orgName || '');
  const hasEditedOrgName = useRef(!!saved.current?.orgName);
  const isSubmitting = useRef(false);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan>(saved.current?.selectedPlan || 'academy');
  const [error, setError] = useState<string | null>(null);
  const [profileReady, setProfileReady] = useState(false);
  const [loadingStage, setLoadingStage] = useState(0);
  const [loadingProgress, setLoadingProgress] = useState(0);

  // Self-healing: ensure profile exists on mount
  // Note: We allow users who have completed onboarding to access this page
  // if they explicitly navigate here (e.g. to create additional orgs in future)
  // Only redirect if they arrive here without explicit intent (e.g. from RouteGuard)
  useEffect(() => {
    async function ensureProfile() {
      if (!user || !session) return;
      
      // Check if user was explicitly sent here or navigated directly
      const searchParams = new URLSearchParams(window.location.search);
      const isNewOrg = searchParams.get('new') === 'true';
      
      // If profile exists and onboarding is complete, and user didn't explicitly request new org
      // redirect them to dashboard (they probably hit this page accidentally)
      if (profile?.has_completed_onboarding && !isNewOrg) {
        logger.debug('[Onboarding] Already completed - redirecting to dashboard');
        navigate('/dashboard', { replace: true });
        return;
      }
      
      if (profile) {
        setProfileReady(true);
        return;
      }

      logger.debug('[Onboarding] Profile missing - calling profile-ensure');
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const response = await fetch(`${supabaseUrl}/functions/v1/profile-ensure`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          signal: AbortSignal.timeout(5000),
        });

        if (response.ok) {
          const data = await response.json();
          logger.debug('[Onboarding] Profile ensure result:', data.created ? 'created' : 'exists');
          await refreshProfile();
          
          // After refresh, re-fetch profile to check if onboarding was already completed
          const { data: freshProfile } = await supabase
            .from('profiles')
            .select('has_completed_onboarding')
            .eq('id', user.id)
            .single();
          
          if (freshProfile?.has_completed_onboarding && !isNewOrg) {
            logger.debug('[Onboarding] Already completed after refresh - redirecting to dashboard');
            navigate('/dashboard', { replace: true });
            return;
          }
        }
      } catch (err) {
        logger.warn('[Onboarding] Profile ensure failed:', err);
      }
      
      setProfileReady(true);
    }
    
    ensureProfile();
  }, [user, session, profile, refreshProfile, navigate]);

  // Pre-fill name from user metadata or profile
  useEffect(() => {
    if (saved.current?.fullName) return; // Don't overwrite restored state
    if (profile?.full_name) {
      setFullName(profile.full_name);
    } else if (user?.user_metadata?.full_name) {
      setFullName(user.user_metadata.full_name);
    }
  }, [user, profile]);

  // Update recommended plan when org type changes
  useEffect(() => {
    setSelectedPlan(getRecommendedPlan(orgType));
  }, [orgType]);

  // Auto-generate org name when name or type changes (unless manually edited)
  useEffect(() => {
    if (hasEditedOrgName.current) return;
    const name = fullName.trim();
    if (!name) {
      setOrgName('');
      return;
    }
    const firstName = name.split(' ')[0];
    switch (orgType) {
      case 'solo_teacher':
        setOrgName(`${firstName}'s Teaching`);
        break;
      case 'studio':
        setOrgName(`${firstName}'s Music Studio`);
        break;
      case 'academy':
        setOrgName(`${firstName}'s Music Academy`);
        break;
      case 'agency':
        setOrgName(`${firstName}'s Teaching Agency`);
        break;
    }
  }, [fullName, orgType]);

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const handleNext = () => {
    if (isSubmitting.current) return;
    if (step === 'profile') {
      if (!fullName.trim()) {
        toast({ title: 'Please enter your name', variant: 'destructive' });
        return;
      }
      if (!orgName.trim()) {
        toast({ title: 'Please enter an organisation name', variant: 'destructive' });
        return;
      }
      if (fullName.trim().length > 100 || orgName.trim().length > 100) {
        toast({ title: 'Name must be 100 characters or fewer', variant: 'destructive' });
        return;
      }
      saveOnboardingState({ fullName, orgName, orgType, selectedPlan, step: 'plan' });
      setStep('plan');
    } else if (step === 'plan') {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (step === 'plan') {
      saveOnboardingState({ fullName, orgName, orgType, selectedPlan, step: 'profile' });
      setStep('profile');
    }
  };

  const handleSubmit = async () => {
    if (isSubmitting.current) return;
    isSubmitting.current = true;
    setStep('loading');
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not logged in. Please refresh and try again.');
      }

      const finalOrgName = orgName.trim();

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      
      // Longer timeout for slow mobile networks
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      
      let response: Response;
      try {
        response = await fetch(`${supabaseUrl}/functions/v1/onboarding-setup`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            org_name: finalOrgName,
            org_type: orgType,
            full_name: fullName.trim(),
            subscription_plan: selectedPlan,
          }),
          signal: controller.signal,
        });
      } catch (fetchErr) {
        // Handle network errors with clearer messages
        if (fetchErr instanceof Error) {
          if (fetchErr.name === 'AbortError' || fetchErr.message === 'Load failed') {
            throw new Error('Network timeout. Please check your connection and try again.');
          }
          if (fetchErr.message.includes('Failed to fetch') || fetchErr.message.includes('NetworkError')) {
            throw new Error('Unable to connect. Please check your internet connection.');
          }
        }
        throw fetchErr;
      } finally {
        clearTimeout(timeoutId);
      }

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Server error (${response.status}). Please try again.`);
      }

      const result = await response.json();
      logger.debug('[Onboarding] Setup complete:', result);

      await refreshProfile();
      clearOnboardingState();
      setStep('success');
    } catch (err) {
      logger.error('[Onboarding] Error:', err);
      const message = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      setError(message);
      setStep('error');
      isSubmitting.current = false;
    }
  };

  const handleGoToDashboard = () => {
    navigate('/dashboard');
  };

  const handleRetry = () => {
    // Don't reset the form - just go back to plan step so they can retry
    setStep('plan');
    setError(null);
  };

  const handleRetrySubmit = () => {
    // Retry the submission directly without going back to the form
    setError(null);
    handleSubmit();
  };

  const currentStepIndex = step === 'profile' ? 0 : step === 'plan' ? 1 : 0;

  // Loading screen staged progress
  const LOADING_STAGES = ['Creating your organisation...', 'Configuring your plan...', 'Almost there...'];

  useEffect(() => {
    if (step !== 'loading') {
      setLoadingStage(0);
      setLoadingProgress(0);
      return;
    }
    const t1 = setTimeout(() => setLoadingStage(1), 500);
    const t2 = setTimeout(() => setLoadingStage(2), 1500);
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      setLoadingProgress(Math.min(90, (elapsed / 5000) * 90));
    }, 50);
    return () => { clearTimeout(t1); clearTimeout(t2); clearInterval(interval); };
  }, [step]);

  useEffect(() => {
    if (step === 'success' || step === 'error') {
      setLoadingProgress(100);
    }
  }, [step]);

  // Initial loading while ensuring profile exists
  if (!profileReady) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-lg font-medium">Preparing your account...</p>
      </div>
    );
  }

  if (step === 'loading') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <div className="w-full max-w-xs space-y-4">
          <AnimatePresence mode="wait">
            <motion.p
              key={loadingStage}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="text-center text-lg font-medium"
            >
              {LOADING_STAGES[loadingStage]}
            </motion.p>
          </AnimatePresence>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <motion.div
              className="h-full rounded-full bg-primary"
              initial={{ width: '0%' }}
              animate={{ width: `${loadingProgress}%` }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            />
          </div>
          <p className="text-center text-sm text-muted-foreground">This should only take a moment</p>
        </div>
      </div>
    );
  }

  // Success screen with clear next steps
  if (step === 'success') {
    const planName = selectedPlan === 'solo_teacher' ? 'Teacher' : selectedPlan === 'academy' ? 'Studio' : 'Agency';
    
    // Org-type specific first action
    const getFirstAction = (): { action: string; description: string; href: string } => {
      switch (orgType) {
        case 'solo_teacher':
          return { action: 'Add your first student', description: 'Start by adding a student to your roster', href: '/students' };
        case 'studio':
          return { action: 'Set up your studio', description: 'Add your teaching location and rooms', href: '/locations' };
        case 'academy':
          return { action: 'Add your locations', description: 'Set up your teaching venues first', href: '/locations' };
        case 'agency':
          return { action: 'Add client schools', description: 'Set up the schools where your teachers work', href: '/locations' };
        default:
          return { action: 'Explore your dashboard', description: 'We\'ll guide you through the next steps', href: '/dashboard' };
      }
    };
    
    const firstAction = getFirstAction();
    
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background p-4">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', duration: 0.5 }}
          className="relative"
        >
          <CheckCircle2 className="h-20 w-20 text-primary" />
          <motion.div
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, type: 'spring' }}
            className="absolute -right-1 -top-1"
          >
            <span className="text-2xl">🎉</span>
          </motion.div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-center max-w-md"
        >
          <h1 className="text-3xl font-bold">Welcome to LessonLoop!</h1>
          <p className="mt-2 text-muted-foreground">
            Hey {fullName.split(' ')[0]}, your account is ready.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Your 30-day {planName} trial has started — no card required.
          </p>
        </motion.div>
        
        {/* Clear next step guidance */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="rounded-xl bg-primary/5 border border-primary/20 p-4 text-center max-w-sm"
        >
          <p className="text-sm font-medium text-primary">What's next?</p>
          <p className="text-sm text-muted-foreground mt-1">
            {firstAction.description}
          </p>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="flex flex-col gap-3 w-full max-w-xs"
        >
          <Button size="lg" onClick={() => navigate(firstAction.href)} className="w-full">
            {firstAction.action} →
          </Button>
          <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')} className="w-full">
            Skip to Dashboard →
          </Button>
          <p className="text-xs text-center text-muted-foreground">
            Don't worry, we'll guide you every step of the way
          </p>
        </motion.div>
      </div>
    );
  }

  // Error screen
  if (step === 'error') {
    const isNetworkError = error?.includes('Network') || error?.includes('connection') || error?.includes('timeout');
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background p-4">
        <div className="text-center max-w-sm">
          <h1 className="text-2xl font-bold text-destructive">Setup Failed</h1>
          <p className="mt-2 text-muted-foreground">{error || 'Something went wrong'}</p>
          {isNetworkError && (
            <p className="mt-2 text-sm text-muted-foreground">
              Tip: Make sure you have a stable internet connection.
            </p>
          )}
        </div>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <Button onClick={handleRetrySubmit} className="w-full">
            Try Again
          </Button>
          <Button variant="outline" onClick={handleRetry} className="w-full">
            Edit Details
          </Button>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="w-full">
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>
      </div>
    );
  }

  // Multi-step form
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="flex items-center justify-between border-b px-6 py-4">
        <LogoHorizontal className="h-8" />
        <Button variant="ghost" size="sm" onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </Button>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-3xl px-4 py-8">
        {/* Progress indicator */}
        <OnboardingProgress 
          steps={STEPS} 
          currentStep={currentStepIndex} 
        />

        <AnimatePresence mode="wait">
          {step === 'profile' && (
            <motion.div
              key="profile"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <div className="mb-8 text-center">
                <h1 className="text-3xl font-bold">Welcome to LessonLoop</h1>
                <p className="mt-2 text-muted-foreground">
                  Let's get your account set up in just a few seconds.
                </p>
              </div>

              <form onSubmit={(e) => { e.preventDefault(); handleNext(); }}>
                <Card>
                  <CardContent className="space-y-6 pt-6">
                    {/* Name input */}
                    <div className="space-y-2">
                      <Label htmlFor="fullName">Your Name</Label>
                      <Input
                        id="fullName"
                        placeholder="Enter your full name"
                        value={fullName}
                        maxLength={100}
                        onChange={(e) => setFullName(e.target.value)}
                        autoFocus
                        autoComplete="name"
                      />
                    </div>

                    {/* Org type selection */}
                    <div className="space-y-2">
                      <Label>How do you teach?</Label>
                      <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Teaching type">
                        {ORG_TYPES.map((type) => {
                          const Icon = type.icon;
                          const isSelected = orgType === type.value;
                          return (
                            <button
                              key={type.value}
                              type="button"
                              role="radio"
                              aria-checked={isSelected}
                              aria-label={`Select ${type.label}: ${type.description}`}
                              onClick={() => setOrgType(type.value)}
                              className={`flex items-center gap-4 rounded-lg border p-4 text-left transition-colors ${
                                isSelected
                                  ? 'border-primary bg-primary/5'
                                  : 'border-border hover:border-primary/50'
                              }`}
                            >
                              <div className={`rounded-full p-2 ${isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                                <Icon className="h-5 w-5" />
                              </div>
                              <div>
                                <div className="font-medium">{type.label}</div>
                                <div className="text-sm text-muted-foreground">{type.description}</div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Organisation name */}
                    <div className="space-y-2">
                      <Label htmlFor="orgName">Organisation Name</Label>
                      <Input
                        id="orgName"
                        placeholder="e.g. Jamie's Music Studio"
                        value={orgName}
                        maxLength={100}
                        onChange={(e) => {
                          hasEditedOrgName.current = true;
                          setOrgName(e.target.value);
                        }}
                        autoComplete="organization"
                      />
                      <p className="text-xs text-muted-foreground">You can change this later in Settings.</p>
                    </div>

                    <div className="flex justify-end pt-4">
                      <Button type="submit">
                        Continue
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </form>
            </motion.div>
          )}

          {step === 'plan' && (
            <motion.div
              key="plan"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleNext(); }}
            >
              <div className="mb-8 text-center">
                <h1 className="text-3xl font-bold">Choose Your Plan</h1>
                <p className="mt-2 text-muted-foreground">
                  Start your 30-day free trial. Cancel anytime.
                </p>
              </div>

              <PlanSelector
                selectedPlan={selectedPlan}
                onSelectPlan={setSelectedPlan}
                recommendedPlan={getRecommendedPlan(orgType)}
              />

              {/* Navigation */}
              <div className="mt-8 flex justify-between">
                <Button variant="outline" onClick={handleBack}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button onClick={handleNext}>
                  Start Free Trial
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
