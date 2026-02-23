import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Users, Calendar, Building2, UserPlus, Settings, 
  X, Sparkles, ChevronRight, Rocket, CheckCircle2, ArrowRight
} from 'lucide-react';
import { useFirstRunExperience } from '@/hooks/useFirstRunExperience';
import { cn } from '@/lib/utils';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  users: Users,
  calendar: Calendar,
  building: Building2,
  'user-plus': UserPlus,
  settings: Settings,
};

const pathLabels: Record<string, string> = {
  solo: 'Solo Teacher',
  studio: 'Studio',
  academy: 'Academy',
  agency: 'Agency',
};

const pathDescriptions: Record<string, string> = {
  solo: "We'll help you add students and schedule your first lessons",
  studio: "Let's set up your studio, invite teachers, and enrol students",
  academy: "We'll guide you through setting up locations, team, and students",
  agency: "Let's add your client schools and build your teaching team",
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

  const Icon = iconMap[currentStep.icon] || Users;
  const currentIndex = steps.findIndex(s => s.id === currentStep.id);
  const progress = ((currentIndex) / steps.length) * 100;
  const completedSteps = currentIndex;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="relative overflow-hidden border-primary/30 bg-gradient-to-br from-background via-background to-primary/5 shadow-lg">
        {/* Progress bar */}
        <div className="absolute left-0 right-0 top-0 h-1.5 bg-muted">
          <motion.div
            className="h-full bg-gradient-to-r from-primary to-teal"
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
          className="absolute right-2 top-2 z-10 h-11 w-11 text-muted-foreground hover:text-foreground"
          onClick={dismissFirstRun}
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </Button>

        <CardHeader className="pb-3 pt-6">
          <div className="flex items-start gap-4">
            <motion.div 
              className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-teal text-white shadow-lg"
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
            >
              <Rocket className="h-6 w-6" />
            </motion.div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <CardTitle className="text-section-title tracking-tight">Let's get you set up 🚀</CardTitle>
                {path && (
                  <Badge variant="secondary" className="text-xs font-medium">
                    {pathLabels[path]}
                  </Badge>
                )}
              </div>
              <CardDescription className="text-body">
                {path ? pathDescriptions[path] : 'Complete these steps to get the most out of LessonLoop'}
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pb-6">
          {/* Current step highlight */}
          <motion.div 
            className="flex items-start gap-4 p-4 rounded-xl bg-primary/5 border border-primary/20 mb-4"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            key={currentStep.id}
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
              <Icon className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1 space-y-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-primary uppercase tracking-wide">
                    Step {currentIndex + 1}
                  </span>
                </div>
                <h3 className="text-section-title tracking-tight text-foreground">{currentStep.title}</h3>
                <p className="text-body text-muted-foreground">{currentStep.description}</p>
              </div>
              <Button asChild className="gap-2 shadow-md">
                <Link to={currentStep.href}>
                  {currentStep.cta}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </motion.div>

          {/* Step indicators with labels */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{completedSteps} of {steps.length} complete</span>
              <Button variant="ghost" size="sm" onClick={completeFirstRun} className="h-11 text-body">
                Skip all
              </Button>
            </div>
            <div 
              className="flex items-center gap-1.5"
              role="progressbar"
              aria-valuenow={completedSteps}
              aria-valuemin={0}
              aria-valuemax={steps.length}
              aria-label={`Setup progress: ${completedSteps} of ${steps.length} steps complete`}
            >
              {steps.map((step, i) => {
                const isComplete = i < currentIndex;
                const isCurrent = i === currentIndex;
                return (
                  <div
                    key={step.id}
                    className={cn(
                      'flex-1 h-2 rounded-full transition-all duration-300',
                      isComplete ? 'bg-primary' : isCurrent ? 'bg-primary/50' : 'bg-muted'
                    )}
                    role="presentation"
                    aria-hidden="true"
                    title={step.title}
                  />
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
