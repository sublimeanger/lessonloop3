import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';
import { Loader2 } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useOnboardingState, clearOnboardingState } from '@/hooks/useOnboardingState';
import { getSmartRecommendation } from '@/lib/plan-recommendation';
import { OnboardingLayout } from '@/components/onboarding/OnboardingLayout';
import { WelcomeStep } from '@/components/onboarding/WelcomeStep';
import { TeachingProfileStep } from '@/components/onboarding/TeachingProfileStep';
import { MigrationStep } from '@/components/onboarding/MigrationStep';
import { PlanRecommendationStep } from '@/components/onboarding/PlanRecommendationStep';
import { SetupStep } from '@/components/onboarding/SetupStep';
import type { ImportResult } from '@/hooks/useOnboardingState';

export default function Onboarding() {
  usePageMeta('Get Started | LessonLoop', 'Set up your LessonLoop account');
  const navigate = useNavigate();
  const { user, session, signOut, refreshProfile, profile } = useAuth();
  const { toast } = useToast();

  // Derive initial name from auth context
  const initialName = profile?.full_name || user?.user_metadata?.full_name || '';
  const { state, updateField, updateFields, setOrgNameManual, goToStep, visibleStepIndex } = useOnboardingState(initialName);

  const isSubmitting = useRef(false);
  const [profileReady, setProfileReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingStage, setLoadingStage] = useState(0);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  // ── Self-healing: ensure profile exists on mount ──

  useEffect(() => {
    async function ensureProfile() {
      if (!user || !session) return;

      const urlParams = new URLSearchParams(window.location.search);
      const isNewOrg = urlParams.get('new') === 'true';

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
          await refreshProfile();
          const { data: freshProfile } = await supabase
            .from('profiles')
            .select('has_completed_onboarding')
            .eq('id', user.id)
            .single();

          if (freshProfile?.has_completed_onboarding && !isNewOrg) {
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

  // ── Update recommended plan when relevant data changes ──

  useEffect(() => {
    const rec = getSmartRecommendation({
      orgType: state.orgType,
      teamSize: state.teamSize || undefined,
      locationCount: state.locationCount || undefined,
      studentCount: state.studentCount || undefined,
      isSwitching: state.migrationChoice === 'switching',
    });
    if (rec.plan !== state.selectedPlan && state.currentStep !== 'plan') {
      updateField('selectedPlan', rec.plan);
    }
  }, [state.orgType, state.teamSize, state.locationCount, state.studentCount, state.migrationChoice]);

  // ── Loading progress animation ──

  useEffect(() => {
    if (state.currentStep !== 'loading') {
      setLoadingStage(0);
      setLoadingProgress(0);
      return;
    }
    const hasImport = !!state.importData;
    const t1 = setTimeout(() => setLoadingStage(1), 600);
    const t2 = setTimeout(() => setLoadingStage(2), hasImport ? 2000 : 1500);
    const t3 = hasImport ? setTimeout(() => setLoadingStage(3), 3500) : undefined;
    const start = Date.now();
    const maxDuration = hasImport ? 8000 : 5000;
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      setLoadingProgress(Math.min(90, (elapsed / maxDuration) * 90));
    }, 50);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      if (t3) clearTimeout(t3);
      clearInterval(interval);
    };
  }, [state.currentStep, state.importData]);

  useEffect(() => {
    if (state.currentStep === 'success' || state.currentStep === 'error') {
      setLoadingProgress(100);
    }
  }, [state.currentStep]);

  // ── Navigation handlers ──

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const handleWelcomeNext = () => {
    if (!state.fullName.trim()) {
      toast({ title: 'Please enter your name', variant: 'destructive' });
      return;
    }
    goToStep('teaching');
  };

  const handleTeachingNext = () => {
    if (state.orgType !== 'solo_teacher' && !state.orgName.trim()) {
      toast({ title: 'Please enter your organisation name', variant: 'destructive' });
      return;
    }
    if (state.orgName.trim().length > 100) {
      toast({ title: 'Name must be 100 characters or fewer', variant: 'destructive' });
      return;
    }
    goToStep('migration');
  };

  const handleMigrationNext = () => {
    goToStep('plan');
  };

  const handlePlanNext = () => {
    handleSubmit();
  };

  // ── Submission ──

  const handleSubmit = useCallback(async () => {
    if (isSubmitting.current) return;
    isSubmitting.current = true;
    goToStep('loading');
    setError(null);
    setImportResult(null);

    try {
      const [, result] = await Promise.all([
        new Promise(resolve => setTimeout(resolve, 1500)),
        (async () => {
          const { data: { session: currentSession } } = await supabase.auth.getSession();
          if (!currentSession) {
            throw new Error('Not logged in. Please refresh and try again.');
          }

          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000);

          // ── Step 1: Create org via onboarding-setup ──
          let onboardingResponse: Response;
          try {
            onboardingResponse = await fetch(`${supabaseUrl}/functions/v1/onboarding-setup`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${currentSession.access_token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                org_name: state.orgName.trim() || `${state.fullName.trim().split(' ')[0]}'s Teaching`,
                org_type: state.orgType,
                full_name: state.fullName.trim(),
                subscription_plan: state.selectedPlan,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/London',
                also_teaches: state.alsoTeaches,
              }),
              signal: controller.signal,
            });
          } catch (fetchErr) {
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

          if (!onboardingResponse.ok) {
            const data = await onboardingResponse.json().catch(() => ({}));
            throw new Error(data.error || `Server error (${onboardingResponse.status}). Please try again.`);
          }

          const onboardingResult = await onboardingResponse.json();
          logger.debug('[Onboarding] Setup complete:', onboardingResult);
          const orgId = onboardingResult.org_id;

          // ── Step 2: Execute import if data prepared ──
          if (state.importData && orgId) {
            logger.debug('[Onboarding] Starting import for org:', orgId);
            setLoadingStage(2);

            try {
              // Build transformed rows from mappings
              const transformedRows = state.importData.rows.map(row => {
                const obj: Record<string, string> = {};
                state.importData!.mappings.forEach((mapping, idx) => {
                  if (mapping.target_field && row[idx]) {
                    if (mapping.transform === 'split_name') {
                      const parts = row[idx].trim().split(/\s+/);
                      obj['first_name'] = parts[0] || '';
                      obj['last_name'] = parts.slice(1).join(' ') || '';
                    } else if (mapping.transform === 'combine_guardian_name' && mapping.combine_with) {
                      const lastIdx = state.importData!.headers.indexOf(mapping.combine_with);
                      const lastName = lastIdx >= 0 ? (row[lastIdx] || '') : '';
                      obj['guardian_name'] = `${row[idx]} ${lastName}`.trim();
                    } else if (mapping.transform === 'combine_guardian2_name' && mapping.combine_with) {
                      const lastIdx = state.importData!.headers.indexOf(mapping.combine_with);
                      const lastName = lastIdx >= 0 ? (row[lastIdx] || '') : '';
                      obj['guardian2_name'] = `${row[idx]} ${lastName}`.trim();
                    } else {
                      obj[mapping.target_field!] = row[idx];
                    }
                  }
                });
                return obj;
              });

              const mappingsMap = Object.fromEntries(
                state.importData.mappings
                  .filter(m => m.target_field)
                  .map(m => [m.csv_header, m.target_field])
              );

              const importResponse = await fetch(
                `${supabaseUrl}/functions/v1/csv-import-execute`,
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${currentSession.access_token}`,
                  },
                  body: JSON.stringify({
                    rows: transformedRows,
                    mappings: mappingsMap,
                    orgId,
                    sourceSoftware: state.importData.sourceSoftware !== 'auto' ? state.importData.sourceSoftware : undefined,
                    importLessons: state.importData.importLessons,
                    skipDuplicates: true,
                  }),
                }
              );

              if (importResponse.ok) {
                const importData = await importResponse.json();
                logger.debug('[Onboarding] Import complete:', importData);
                setImportResult({
                  studentsCreated: importData.studentsCreated || 0,
                  guardiansCreated: importData.guardiansCreated || 0,
                  linksCreated: importData.linksCreated || 0,
                  lessonsCreated: importData.lessonsCreated || 0,
                  errors: importData.errors || [],
                });
              } else {
                const err = await importResponse.json().catch(() => ({}));
                logger.warn('[Onboarding] Import failed (non-fatal):', err);
                setImportResult({
                  studentsCreated: 0,
                  guardiansCreated: 0,
                  linksCreated: 0,
                  lessonsCreated: 0,
                  errors: [err.error || 'Import failed — you can retry from Settings > Data Import.'],
                });
              }
            } catch (importErr) {
              logger.warn('[Onboarding] Import error (non-fatal):', importErr);
              setImportResult({
                studentsCreated: 0,
                guardiansCreated: 0,
                linksCreated: 0,
                lessonsCreated: 0,
                errors: ['Import failed — you can retry from Settings > Data Import.'],
              });
            }
          }

          setLoadingProgress(100);
          return onboardingResult;
        })(),
      ]);

      await refreshProfile();
      clearOnboardingState();
      isSubmitting.current = false;
      goToStep('success');
    } catch (err) {
      logger.error('[Onboarding] Error:', err);
      const message = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      setError(message);
      goToStep('error');
      isSubmitting.current = false;
    }
  }, [state, goToStep, refreshProfile, toast]);

  // ── Render ──

  // Initial loading while ensuring profile exists
  if (!profileReady) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-gradient-to-b from-background via-background to-muted/30">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-primary/20 blur-xl" />
          <Loader2 className="relative h-10 w-10 animate-spin text-primary" />
        </div>
        <p className="text-lg font-semibold tracking-tight">Preparing your account...</p>
      </div>
    );
  }

  // Loading / success / error screens (full-screen, no layout chrome)
  if (state.currentStep === 'loading' || state.currentStep === 'success' || state.currentStep === 'error') {
    return (
      <div className="min-h-[100dvh] bg-gradient-to-b from-background via-background to-muted/30">
        <SetupStep
          step={state.currentStep}
          fullName={state.fullName}
          orgType={state.orgType}
          selectedPlan={state.selectedPlan}
          hasImport={!!state.importData}
          importResult={importResult}
          error={error}
          loadingProgress={loadingProgress}
          loadingStage={loadingStage}
          onNavigate={(path) => navigate(path)}
          onRetry={() => {
            setError(null);
            handleSubmit();
          }}
          onEdit={() => {
            goToStep('plan');
            setError(null);
          }}
          onLogout={handleLogout}
        />
      </div>
    );
  }

  // Multi-step form
  return (
    <OnboardingLayout
      currentStepIndex={visibleStepIndex}
      onLogout={handleLogout}
    >
      <AnimatePresence mode="wait">
        {state.currentStep === 'welcome' && (
          <WelcomeStep
            fullName={state.fullName}
            orgType={state.orgType}
            onNameChange={(name) => updateField('fullName', name)}
            onOrgTypeChange={(type) => updateField('orgType', type)}
            onNext={handleWelcomeNext}
          />
        )}

        {state.currentStep === 'teaching' && (
          <TeachingProfileStep
            orgType={state.orgType}
            orgName={state.orgName}
            studentCount={state.studentCount}
            teamSize={state.teamSize}
            locationCount={state.locationCount}
            instruments={state.instruments}
            alsoTeaches={state.alsoTeaches}
            onOrgNameChange={setOrgNameManual}
            onStudentCountChange={(v) => updateField('studentCount', v)}
            onTeamSizeChange={(v) => updateField('teamSize', v)}
            onLocationCountChange={(v) => updateField('locationCount', v)}
            onInstrumentsChange={(v) => updateField('instruments', v)}
            onAlsoTeachesChange={(v) => updateField('alsoTeaches', v)}
            onNext={handleTeachingNext}
            onBack={() => goToStep('welcome')}
          />
        )}

        {state.currentStep === 'migration' && (
          <MigrationStep
            migrationChoice={state.migrationChoice}
            importData={state.importData}
            onMigrationChoiceChange={(choice) => updateField('migrationChoice', choice)}
            onImportDataChange={(data) => updateField('importData', data)}
            onNext={handleMigrationNext}
            onBack={() => goToStep('teaching')}
          />
        )}

        {state.currentStep === 'plan' && (
          <PlanRecommendationStep
            orgType={state.orgType}
            teamSize={state.teamSize}
            locationCount={state.locationCount}
            studentCount={state.studentCount}
            migrationChoice={state.migrationChoice}
            selectedPlan={state.selectedPlan}
            onSelectPlan={(plan) => updateField('selectedPlan', plan)}
            onNext={handlePlanNext}
            onBack={() => goToStep('migration')}
          />
        )}
      </AnimatePresence>
    </OnboardingLayout>
  );
}
