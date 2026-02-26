import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, CheckCircle2, LogOut, ArrowRight, AlertCircle, Users, BookOpen, Link2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PLAN_DISPLAY_NAMES } from '@/lib/pricing-config';
import type { OrgType, SubscriptionPlan, ImportResult } from '@/hooks/useOnboardingState';

// ── Count-up hook ─────────────────────────────────────────────────────────

function useCountUp(target: number, duration = 1200, delay = 0) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (target <= 0) { setValue(0); return; }
    const timeout = setTimeout(() => {
      const start = performance.now();
      const step = (now: number) => {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        // Ease out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        setValue(Math.round(eased * target));
        if (progress < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }, delay);
    return () => clearTimeout(timeout);
  }, [target, duration, delay]);
  return value;
}

// ── Loading screen ─────────────────────────────────────────────────────────

interface LoadingProps {
  hasImport: boolean;
  progress: number;
  stage: number;
}

const LOADING_STAGES_DEFAULT = [
  'Creating your organisation...',
  'Configuring your plan...',
  'Almost there...',
];

const LOADING_STAGES_IMPORT = [
  'Creating your organisation...',
  'Configuring your plan...',
  'Importing your data...',
  'Almost there...',
];

function LoadingScreen({ hasImport, progress, stage }: LoadingProps) {
  const stages = hasImport ? LOADING_STAGES_IMPORT : LOADING_STAGES_DEFAULT;
  const safeStage = Math.min(stage, stages.length - 1);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-8 px-4">
      {/* Animated spinner with glow */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
        className="relative"
      >
        <div className="absolute inset-0 rounded-full bg-primary/20 blur-xl" />
        <Loader2 className="relative h-12 w-12 animate-spin text-primary" />
      </motion.div>

      <div className="w-full max-w-xs space-y-5">
        <AnimatePresence mode="wait">
          <motion.p
            key={safeStage}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="text-center text-lg font-semibold tracking-tight"
          >
            {stages[safeStage]}
          </motion.p>
        </AnimatePresence>

        {/* Progress bar */}
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-primary to-primary/80"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center text-sm text-muted-foreground"
        >
          This should only take a moment
        </motion.p>
      </div>
    </div>
  );
}

// ── Success screen ─────────────────────────────────────────────────────────

interface SuccessProps {
  fullName: string;
  orgType: OrgType;
  selectedPlan: SubscriptionPlan;
  importResult: ImportResult | null;
  onNavigate: (path: string) => void;
}

function SuccessScreen({ fullName, orgType, selectedPlan, importResult, onNavigate }: SuccessProps) {
  const planName = PLAN_DISPLAY_NAMES[selectedPlan] || 'LessonLoop';
  const firstName = fullName.split(' ')[0];

  const studentsCount = useCountUp(importResult?.studentsCreated || 0, 1000, 500);
  const guardiansCount = useCountUp(importResult?.guardiansCreated || 0, 1000, 650);
  const lessonsCount = useCountUp(importResult?.lessonsCreated || 0, 1000, 800);

  const getFirstAction = (): { action: string; description: string; href: string } => {
    if (importResult && importResult.studentsCreated > 0) {
      return { action: 'View your students', description: `${importResult.studentsCreated} students imported successfully`, href: '/students' };
    }
    switch (orgType) {
      case 'solo_teacher':
        return { action: 'Add your first student', description: 'Start building your student roster', href: '/students' };
      case 'studio':
        return { action: 'Set up your studio', description: 'Add your teaching location and rooms', href: '/locations' };
      case 'academy':
        return { action: 'Add your locations', description: 'Set up your teaching venues', href: '/locations' };
      case 'agency':
        return { action: 'Add client schools', description: 'Set up the schools where your teachers work', href: '/locations' };
      default:
        return { action: 'Explore your dashboard', description: "We'll guide you through the next steps", href: '/dashboard' };
    }
  };

  const firstAction = getFirstAction();

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 sm:gap-8 px-4">
      {/* Celebration checkmark with glow ring */}
      <motion.div
        initial={{ scale: 0, rotate: -15 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.1 }}
        className="relative"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: [0, 0.4, 0] , scale: [0.5, 1.6, 1.8] }}
          transition={{ delay: 0.3, duration: 1.2, ease: 'easeOut' }}
          className="absolute inset-0 rounded-full bg-primary/20"
        />
        <div className="relative flex h-20 w-20 sm:h-24 sm:w-24 items-center justify-center rounded-full bg-gradient-to-br from-primary/15 to-primary/5 ring-1 ring-primary/10">
          <CheckCircle2 className="h-10 w-10 sm:h-12 sm:w-12 text-primary" />
        </div>
        <motion.div
          initial={{ opacity: 0, scale: 0, y: 5 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ delay: 0.5, type: 'spring', stiffness: 350, damping: 15 }}
          className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full bg-background shadow-elevated text-lg"
        >
          🎉
        </motion.div>
      </motion.div>

      {/* Welcome text */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="text-center max-w-md"
      >
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Welcome to LessonLoop!</h1>
        <p className="mt-2 text-sm sm:text-base text-muted-foreground">
          Hey {firstName}, your account is ready.
        </p>
        <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
          Your 30-day {planName} trial has started — no card required.
        </p>
      </motion.div>

      {/* Import stats with count-up */}
      {importResult && importResult.studentsCreated > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="grid grid-cols-3 gap-3 sm:gap-4 w-full max-w-sm"
        >
          {[
            { count: studentsCount, icon: Users, label: 'Students' },
            { count: guardiansCount, icon: Users, label: 'Guardians' },
            { count: lessonsCount, icon: BookOpen, label: 'Lessons' },
          ].filter((_, i) => {
            // Only show stats with actual data
            const vals = [importResult.studentsCreated, importResult.guardiansCreated, importResult.lessonsCreated];
            return vals[i] > 0;
          }).map((stat, i) => {
            const Icon = stat.icon;
            return (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 15, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: 0.5 + i * 0.12, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                className="rounded-xl border bg-card p-3 sm:p-4 text-center shadow-card"
              >
                <div className="mx-auto mb-1.5 flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <div className="text-xl sm:text-2xl font-bold text-primary tabular-nums">{stat.count}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{stat.label}</div>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {/* Import errors notice */}
      {importResult && importResult.errors.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="rounded-xl border border-warning/30 bg-warning/5 p-3 sm:p-4 max-w-sm text-center"
        >
          <p className="text-sm text-warning">
            {importResult.errors.length} row{importResult.errors.length !== 1 ? 's' : ''} had issues.
            You can review them in Settings &gt; Data Import.
          </p>
        </motion.div>
      )}

      {/* What's next card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="rounded-xl bg-gradient-to-br from-primary/5 to-primary/[0.02] border border-primary/20 p-4 sm:p-5 text-center max-w-sm w-full"
      >
        <p className="text-sm font-semibold text-primary">What's next?</p>
        <p className="text-sm text-muted-foreground mt-1">
          {firstAction.description}
        </p>
      </motion.div>

      {/* CTA buttons */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.65, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col gap-3 w-full max-w-xs"
      >
        <Button
          size="lg"
          onClick={() => onNavigate(firstAction.href)}
          className="w-full min-h-[44px] gradient-accent shadow-glow-teal hover:opacity-90 transition-opacity"
        >
          {firstAction.action}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onNavigate('/dashboard')}
          className="w-full min-h-[40px]"
        >
          Go to Dashboard
        </Button>
        <p className="text-xs text-center text-muted-foreground">
          Don't worry, we'll guide you every step of the way
        </p>
      </motion.div>
    </div>
  );
}

// ── Error screen ───────────────────────────────────────────────────────────

interface ErrorProps {
  error: string | null;
  onRetry: () => void;
  onEdit: () => void;
  onLogout: () => void;
}

function ErrorScreen({ error, onRetry, onEdit, onLogout }: ErrorProps) {
  const isNetworkError = error?.includes('Network') || error?.includes('connection') || error?.includes('timeout');

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 sm:gap-8 px-4">
      <motion.div
        initial={{ scale: 0, rotate: 10 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
        className="flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10 ring-1 ring-destructive/20"
      >
        <AlertCircle className="h-10 w-10 text-destructive" />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="text-center max-w-sm"
      >
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-destructive">Setup Failed</h1>
        <p className="mt-2 text-sm sm:text-base text-muted-foreground">{error || 'Something went wrong'}</p>
        {isNetworkError && (
          <p className="mt-2 text-sm text-muted-foreground">
            Make sure you have a stable internet connection.
          </p>
        )}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col gap-3 w-full max-w-xs"
      >
        <Button onClick={onRetry} className="w-full min-h-[44px]" size="lg">
          <RotateCcw className="mr-2 h-4 w-4" />
          Try Again
        </Button>
        <Button variant="outline" onClick={onEdit} className="w-full min-h-[40px]">
          Edit Details
        </Button>
        <Button variant="ghost" size="sm" onClick={onLogout} className="w-full min-h-[40px]">
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </Button>
      </motion.div>
    </div>
  );
}

// ── Composite component ────────────────────────────────────────────────────

interface SetupStepProps {
  step: 'loading' | 'success' | 'error';
  fullName: string;
  orgType: OrgType;
  selectedPlan: SubscriptionPlan;
  hasImport: boolean;
  importResult: ImportResult | null;
  error: string | null;
  loadingProgress: number;
  loadingStage: number;
  onNavigate: (path: string) => void;
  onRetry: () => void;
  onEdit: () => void;
  onLogout: () => void;
}

export function SetupStep({
  step, fullName, orgType, selectedPlan,
  hasImport, importResult, error,
  loadingProgress, loadingStage,
  onNavigate, onRetry, onEdit, onLogout,
}: SetupStepProps) {
  if (step === 'loading') {
    return <LoadingScreen hasImport={hasImport} progress={loadingProgress} stage={loadingStage} />;
  }
  if (step === 'success') {
    return <SuccessScreen fullName={fullName} orgType={orgType} selectedPlan={selectedPlan} importResult={importResult} onNavigate={onNavigate} />;
  }
  return <ErrorScreen error={error} onRetry={onRetry} onEdit={onEdit} onLogout={onLogout} />;
}
