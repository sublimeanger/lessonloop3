import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LogoHorizontal } from '@/components/brand/Logo';
import { Loader2, LogOut, User, Building2, Users, Network, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type OrgType = 'solo_teacher' | 'studio' | 'academy' | 'agency';
type Step = 'welcome' | 'loading' | 'success' | 'error';

const ORG_TYPES = [
  { value: 'solo_teacher' as const, label: 'Solo Teacher', description: 'Independent music teacher', icon: User },
  { value: 'studio' as const, label: 'Music Studio', description: 'Small studio with a few teachers', icon: Building2 },
  { value: 'academy' as const, label: 'Music Academy', description: 'Larger school with multiple locations', icon: Users },
  { value: 'agency' as const, label: 'Teaching Agency', description: 'Agency managing peripatetic teachers', icon: Network },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const { user, signOut, refreshProfile } = useAuth();
  const { toast } = useToast();
  
  const [step, setStep] = useState<Step>('welcome');
  const [orgType, setOrgType] = useState<OrgType>('solo_teacher');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Pre-fill name from user metadata if available
  useEffect(() => {
    if (user?.user_metadata?.full_name) {
      setFullName(user.user_metadata.full_name);
    }
  }, [user]);

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const handleSubmit = async () => {
    if (!fullName.trim()) {
      toast({ title: 'Please enter your name', variant: 'destructive' });
      return;
    }

    setStep('loading');
    setError(null);

    try {
      // Get current session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not logged in');
      }

      // Determine org name based on type
      const orgName = orgType === 'solo_teacher' 
        ? `${fullName.trim()}'s Teaching` 
        : `${fullName.trim()}'s ${ORG_TYPES.find(t => t.value === orgType)?.label || 'Organisation'}`;

      // Call edge function with 15s timeout
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/onboarding-setup`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          org_name: orgName,
          org_type: orgType,
          full_name: fullName.trim(),
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Request failed with status ${response.status}`);
      }

      const result = await response.json();
      console.log('[Onboarding] Setup complete:', result);

      // Refresh profile to get updated data
      await refreshProfile();

      setStep('success');
    } catch (err) {
      console.error('[Onboarding] Error:', err);
      const message = err instanceof Error ? err.message : 'Something went wrong';
      setError(message);
      setStep('error');
    }
  };

  const handleGoToDashboard = () => {
    navigate('/dashboard');
  };

  const handleRetry = () => {
    setStep('welcome');
    setError(null);
  };

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
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-destructive">Setup Failed</h1>
          <p className="mt-2 text-muted-foreground">{error || 'Something went wrong'}</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
          <Button onClick={handleRetry}>Try Again</Button>
        </div>
      </div>
    );
  }

  // Welcome/form screen
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
      <main className="mx-auto max-w-lg px-4 py-12">
        <AnimatePresence mode="wait">
          <motion.div
            key="welcome"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <div className="mb-8 text-center">
              <h1 className="text-3xl font-bold">Welcome to LessonLoop</h1>
              <p className="mt-2 text-muted-foreground">
                Let's get your account set up in just a few seconds.
              </p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Your Details</CardTitle>
                <CardDescription>Tell us a bit about yourself</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
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
                  <div className="grid gap-3">
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

                {/* Submit button */}
                <Button className="w-full" size="lg" onClick={handleSubmit}>
                  Create My Account
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
