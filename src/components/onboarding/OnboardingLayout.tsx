import { Button } from '@/components/ui/button';
import { LogoHorizontal } from '@/components/brand/Logo';
import { LogOut } from 'lucide-react';
import { OnboardingProgress } from './OnboardingProgress';
import { VISIBLE_STEPS } from '@/hooks/useOnboardingState';

interface OnboardingLayoutProps {
  currentStepIndex: number;
  showProgress?: boolean;
  onLogout: () => void;
  children: React.ReactNode;
}

export function OnboardingLayout({ currentStepIndex, showProgress = true, onLogout, children }: OnboardingLayoutProps) {
  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-background via-background to-muted/30 flex flex-col">
      {/* Header with subtle shadow */}
      <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-background/95 backdrop-blur-sm px-4 py-3 sm:px-6 sm:py-4 shrink-0 shadow-sm">
        <LogoHorizontal className="h-7 sm:h-8" />
        <Button
          variant="ghost"
          size="sm"
          onClick={onLogout}
          className="text-muted-foreground hover:text-foreground transition-colors min-h-[36px]"
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span className="hidden sm:inline">Logout</span>
        </Button>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col">
        {showProgress && (
          <div className="px-4 pt-6 sm:px-6 sm:pt-8">
            <div className="mx-auto max-w-2xl">
              <OnboardingProgress
                steps={VISIBLE_STEPS}
                currentStep={currentStepIndex}
              />
            </div>
          </div>
        )}
        <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 sm:px-6 sm:py-8 pb-[env(safe-area-inset-bottom,24px)]">
          {children}
        </div>
      </main>
    </div>
  );
}
