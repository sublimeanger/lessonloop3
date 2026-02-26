import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, CheckCircle2, LogOut, ArrowRight, AlertCircle, Users, BookOpen, Link2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PLAN_DISPLAY_NAMES } from '@/lib/pricing-config';
import type { OrgType, SubscriptionPlan, ImportResult } from '@/hooks/useOnboardingState';

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
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6">
      <Loader2 className="h-10 w-10 animate-spin text-primary" />
      <div className="w-full max-w-xs space-y-4">
        <AnimatePresence mode="wait">
          <motion.p
            key={safeStage}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="text-center text-lg font-medium"
          >
            {stages[safeStage]}
          </motion.p>
        </AnimatePresence>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <motion.div
            className="h-full rounded-full bg-primary"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          />
        </div>
        <p className="text-center text-sm text-muted-foreground">This should only take a moment</p>
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
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4">
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
          className="absolute -right-1 -top-1 text-2xl"
        >
          🎉
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
          Hey {firstName}, your account is ready.
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Your 30-day {planName} trial has started — no card required.
        </p>
      </motion.div>

      {/* Import stats */}
      {importResult && importResult.studentsCreated > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="grid grid-cols-3 gap-4 w-full max-w-xs"
        >
          <div className="rounded-xl border bg-card p-3 text-center shadow-sm">
            <Users className="h-4 w-4 mx-auto mb-1 text-primary" />
            <div className="text-lg font-bold text-primary">{importResult.studentsCreated}</div>
            <div className="text-xs text-muted-foreground">Students</div>
          </div>
          <div className="rounded-xl border bg-card p-3 text-center shadow-sm">
            <Users className="h-4 w-4 mx-auto mb-1 text-primary" />
            <div className="text-lg font-bold text-primary">{importResult.guardiansCreated}</div>
            <div className="text-xs text-muted-foreground">Guardians</div>
          </div>
          <div className="rounded-xl border bg-card p-3 text-center shadow-sm">
            <BookOpen className="h-4 w-4 mx-auto mb-1 text-primary" />
            <div className="text-lg font-bold text-primary">{importResult.lessonsCreated}</div>
            <div className="text-xs text-muted-foreground">Lessons</div>
          </div>
        </motion.div>
      )}

      {/* Import errors notice */}
      {importResult && importResult.errors.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="rounded-lg border border-warning/30 bg-warning/5 p-3 max-w-sm text-center"
        >
          <p className="text-sm text-warning">
            {importResult.errors.length} row{importResult.errors.length !== 1 ? 's' : ''} had issues.
            You can review them in Settings &gt; Data Import.
          </p>
        </motion.div>
      )}

      {/* What's next */}
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
        <Button size="lg" onClick={() => onNavigate(firstAction.href)} className="w-full">
          {firstAction.action}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={() => onNavigate('/dashboard')} className="w-full">
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
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4">
      <AlertCircle className="h-16 w-16 text-destructive" />
      <div className="text-center max-w-sm">
        <h1 className="text-2xl font-bold text-destructive">Setup Failed</h1>
        <p className="mt-2 text-muted-foreground">{error || 'Something went wrong'}</p>
        {isNetworkError && (
          <p className="mt-2 text-sm text-muted-foreground">
            Make sure you have a stable internet connection.
          </p>
        )}
      </div>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <Button onClick={onRetry} className="w-full">
          <RotateCcw className="mr-2 h-4 w-4" />
          Try Again
        </Button>
        <Button variant="outline" onClick={onEdit} className="w-full">
          Edit Details
        </Button>
        <Button variant="ghost" size="sm" onClick={onLogout} className="w-full">
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </Button>
      </div>
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
