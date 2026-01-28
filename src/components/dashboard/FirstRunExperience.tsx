import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Users, Calendar, Building2, UserPlus, Settings, 
  X, Sparkles, ChevronRight, Rocket
} from 'lucide-react';
import { useFirstRunExperience } from '@/hooks/useFirstRunExperience';
import { cn } from '@/lib/utils';

const iconMap = {
  users: Users,
  calendar: Calendar,
  building: Building2,
  'user-plus': UserPlus,
  settings: Settings,
};

const pathLabels = {
  solo: 'Solo Teacher',
  studio: 'Studio',
  academy: 'Academy',
  agency: 'Agency',
};

export function FirstRunExperience() {
  const { 
    isFirstRun, 
    isLoading, 
    path, 
    currentStep, 
    steps,
    dismissFirstRun,
    completeFirstRun,
  } = useFirstRunExperience();

  if (isLoading || !isFirstRun || !currentStep) {
    return null;
  }

  const Icon = iconMap[currentStep.icon];
  const currentIndex = steps.findIndex(s => s.id === currentStep.id);
  const progress = ((currentIndex) / steps.length) * 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="relative overflow-hidden border-primary/20 bg-gradient-to-br from-background via-background to-primary/5">
        {/* Progress bar */}
        <div className="absolute left-0 right-0 top-0 h-1 bg-muted">
          <motion.div
            className="h-full bg-primary"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>

        {/* Decorative elements */}
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/5 blur-2xl" />
        <div className="absolute -bottom-8 -left-8 h-24 w-24 rounded-full bg-teal/5 blur-2xl" />

        {/* Dismiss button */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-2 top-2 h-8 w-8 text-muted-foreground hover:text-foreground z-10"
          onClick={dismissFirstRun}
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </Button>

        <CardHeader className="pb-3 pt-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-teal text-white shadow-lg">
              <Rocket className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg">Let's get you set up</CardTitle>
                {path && (
                  <Badge variant="secondary" className="text-xs">
                    {pathLabels[path]}
                  </Badge>
                )}
              </div>
              <CardDescription>
                Step {currentIndex + 1} of {steps.length}
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pb-5">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <Icon className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1 space-y-3">
              <div>
                <h3 className="font-semibold text-foreground">{currentStep.title}</h3>
                <p className="text-sm text-muted-foreground">{currentStep.description}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button asChild size="sm" className="gap-2">
                  <Link to={currentStep.href}>
                    {currentStep.cta}
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button variant="ghost" size="sm" onClick={completeFirstRun}>
                  Skip setup
                </Button>
              </div>
            </div>
          </div>

          {/* Step indicators */}
          <div className="mt-4 flex items-center gap-2">
            {steps.map((step, i) => {
              const isComplete = i < currentIndex;
              const isCurrent = i === currentIndex;
              return (
                <div
                  key={step.id}
                  className={cn(
                    'h-2 flex-1 rounded-full transition-colors',
                    isComplete ? 'bg-primary' : isCurrent ? 'bg-primary/50' : 'bg-muted'
                  )}
                />
              );
            })}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
