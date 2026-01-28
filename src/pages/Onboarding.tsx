import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
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
  
  const [step, setStep] = useState<Step>('profile');
  const [orgType, setOrgType] = useState<OrgType>('solo_teacher');
  const [fullName, setFullName] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan>('academy');
  const [error, setError] = useState<string | null>(null);
  const [profileReady, setProfileReady] = useState(false);

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
        console.log('[Onboarding] Already completed - redirecting to dashboard');
        navigate('/dashboard', { replace: true });
        return;
      }
      
      if (profile) {
        setProfileReady(true);
        return;
      }

      console.log('[Onboarding] Profile missing - calling profile-ensure');
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
          console.log('[Onboarding] Profile ensure result:', data.created ? 'created' : 'exists');
          await refreshProfile();
          
          // After refresh, re-fetch profile to check if onboarding was already completed
          const { data: freshProfile } = await supabase
            .from('profiles')
            .select('has_completed_onboarding')
            .eq('id', user.id)
            .single();
          
          if (freshProfile?.has_completed_onboarding && !isNewOrg) {
            console.log('[Onboarding] Already completed after refresh - redirecting to dashboard');
            navigate('/dashboard', { replace: true });
            return;
          }
        }
      } catch (err) {
        console.warn('[Onboarding] Profile ensure failed:', err);
      }
      
      setProfileReady(true);
    }
    
    ensureProfile();
  }, [user, session, profile, refreshProfile, navigate]);

  // Pre-fill name from user metadata or profile
  useEffect(() => {
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

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const handleNext = () => {
    if (step === 'profile') {
      if (!fullName.trim()) {
        toast({ title: 'Please enter your name', variant: 'destructive' });
        return;
      }
      setStep('plan');
    } else if (step === 'plan') {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (step === 'plan') {
      setStep('profile');
    }
  };

  const handleSubmit = async () => {
    setStep('loading');
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not logged in. Please refresh and try again.');
      }

      const orgName = orgType === 'solo_teacher' 
        ? `${fullName.trim()}'s Teaching` 
        : `${fullName.trim()}'s ${ORG_TYPES.find(t => t.value === orgType)?.label || 'Organisation'}`;

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
            org_name: orgName,
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
      console.log('[Onboarding] Setup complete:', result);

      await refreshProfile();
      setStep('success');
    } catch (err) {
      console.error('[Onboarding] Error:', err);
      const message = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      setError(message);
      setStep('error');
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

  // Initial loading while ensuring profile exists
  if (!profileReady) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-lg font-medium">Preparing your account...</p>
      </div>
    );
  }

  // Loading screen
  if (step === 'loading') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-lg font-medium">Setting up your account...</p>
        <p className="text-sm text-muted-foreground">This should only take a moment</p>
      </div>
    );
  }

  // Success screen
  if (step === 'success') {
    const planName = selectedPlan === 'solo_teacher' ? 'Teacher' : selectedPlan === 'academy' ? 'Studio' : 'Agency';
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background p-4">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', duration: 0.5 }}
        >
          <CheckCircle2 className="h-20 w-20 text-primary" />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-center"
        >
          <h1 className="text-3xl font-bold">You're all set!</h1>
          <p className="mt-2 text-muted-foreground">Welcome to LessonLoop, {fullName}.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Your 30-day {planName} trial has started.
          </p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <Button size="lg" onClick={handleGoToDashboard}>
            Go to Dashboard
          </Button>
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

              <Card>
                <CardContent className="space-y-6 pt-6">
                  {/* Name input */}
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Your Name</Label>
                    <Input
                      id="fullName"
                      placeholder="Enter your full name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      autoFocus
                    />
                  </div>

                  {/* Org type selection */}
                  <div className="space-y-2">
                    <Label>How do you teach?</Label>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {ORG_TYPES.map((type) => {
                        const Icon = type.icon;
                        const isSelected = orgType === type.value;
                        return (
                          <button
                            key={type.value}
                            type="button"
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

                  {/* Navigation */}
                  <div className="flex justify-end pt-4">
                    <Button onClick={handleNext}>
                      Continue
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {step === 'plan' && (
            <motion.div
              key="plan"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
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
