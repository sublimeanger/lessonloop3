import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { LogOut, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { LogoHorizontal } from '@/components/brand/Logo';
import { OnboardingProgress } from './OnboardingProgress';

interface Step {
  id: number;
  title: string;
}

interface OnboardingLayoutProps {
  children: ReactNode;
  steps: Step[];
  currentStep: number;
  onBack: () => void;
  onNext: () => void;
  onSkip?: () => void;
  onLogout: () => void;
  onStartOver: () => void;
  isLoading: boolean;
  canGoBack: boolean;
  showSkip?: boolean;
  nextLabel?: string;
  hasRestoredDraft?: boolean;
  onDismissRestore?: () => void;
}

export function OnboardingLayout({
  children,
  steps,
  currentStep,
  onBack,
  onNext,
  onSkip,
  onLogout,
  onStartOver,
  isLoading,
  canGoBack,
  showSkip = false,
  nextLabel = 'Continue',
  hasRestoredDraft = false,
  onDismissRestore,
}: OnboardingLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col gradient-hero-light">
      {/* Header with logout */}
      <header className="flex items-center justify-between p-4 max-w-3xl mx-auto w-full">
        <LogoHorizontal size="md" />
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onStartOver}
            className="text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="h-4 w-4 mr-1" />
            Start Over
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onLogout}
            className="text-muted-foreground hover:text-foreground"
          >
            <LogOut className="h-4 w-4 mr-1" />
            Logout
          </Button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 pb-8">
        <div className="w-full max-w-2xl space-y-6">
          {/* Progress indicator */}
          <OnboardingProgress steps={steps} currentStep={currentStep} />

          {/* Restored draft notice */}
          {hasRestoredDraft && onDismissRestore && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-between p-3 rounded-lg bg-primary/10 text-sm text-primary border border-primary/20"
            >
              <span>Welcome back! We've restored your progress.</span>
              <Button variant="ghost" size="sm" onClick={onDismissRestore}>
                Dismiss
              </Button>
            </motion.div>
          )}

          {/* Card */}
          <Card className="shadow-elevated">
            <CardContent className="pt-6 pb-4">
              {children}
            </CardContent>

            <CardFooter className="flex justify-between border-t pt-4">
              <Button
                variant="outline"
                onClick={onBack}
                disabled={!canGoBack || isLoading}
              >
                Back
              </Button>
              <div className="flex gap-2">
                {showSkip && onSkip && (
                  <Button variant="ghost" onClick={onSkip} disabled={isLoading}>
                    Skip
                  </Button>
                )}
                <Button onClick={onNext} disabled={isLoading}>
                  {isLoading ? 'Saving...' : nextLabel}
                </Button>
              </div>
            </CardFooter>
          </Card>

          {/* Step indicator */}
          <p className="text-center text-sm text-muted-foreground">
            Step {currentStep} of {steps.length}
          </p>
        </div>
      </main>
    </div>
  );
}
