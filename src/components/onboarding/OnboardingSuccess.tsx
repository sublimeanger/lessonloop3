import { motion } from 'framer-motion';
import { CheckCircle2, Calendar, Users, ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface OnboardingSuccessProps {
  orgType: 'solo_teacher' | 'studio' | 'academy' | 'agency';
  onComplete: () => void;
  isLoading: boolean;
}

export function OnboardingSuccess({ orgType, onComplete, isLoading }: OnboardingSuccessProps) {
  const isSolo = orgType === 'solo_teacher' || orgType === 'studio';

  const nextSteps = isSolo
    ? [
        { icon: <Users className="h-5 w-5" />, title: 'Add your first student', description: 'Import existing or add manually' },
        { icon: <Calendar className="h-5 w-5" />, title: 'Schedule a lesson', description: 'Set up your first booking' },
      ]
    : [
        { icon: <Users className="h-5 w-5" />, title: 'Invite your team', description: 'Add teachers and admins' },
        { icon: <Calendar className="h-5 w-5" />, title: 'Set up your schedule', description: 'Configure rooms and time slots' },
      ];

  return (
    <div className="flex flex-col items-center py-8 px-4">
      {/* Celebration animation */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
        className="relative"
      >
        <motion.div
          animate={{ rotate: [0, 10, -10, 0] }}
          transition={{ repeat: 2, duration: 0.5, delay: 0.3 }}
          className="flex h-24 w-24 items-center justify-center rounded-full bg-success/10"
        >
          <CheckCircle2 className="h-12 w-12 text-success" />
        </motion.div>
        
        {/* Sparkles */}
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: [0, 1, 0], scale: [0.5, 1, 0.5] }}
            transition={{ delay: 0.5 + i * 0.1, duration: 0.8 }}
            className="absolute"
            style={{
              top: `${20 + Math.sin(i * 60 * Math.PI / 180) * 50}%`,
              left: `${50 + Math.cos(i * 60 * Math.PI / 180) * 50}%`,
            }}
          >
            <Sparkles className="h-4 w-4 text-warning" />
          </motion.div>
        ))}
      </motion.div>

      {/* Success message */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="mt-6 text-center"
      >
        <h2 className="text-2xl font-bold text-foreground">You're all set!</h2>
        <p className="mt-2 text-muted-foreground max-w-md">
          Your LessonLoop account is ready. Here's what you can do next:
        </p>
      </motion.div>

      {/* Next steps */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="mt-6 w-full max-w-sm space-y-3"
      >
        {nextSteps.map((step, index) => (
          <Card key={index} className="overflow-hidden">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary shrink-0">
                {step.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-foreground">{step.title}</div>
                <div className="text-sm text-muted-foreground">{step.description}</div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </CardContent>
          </Card>
        ))}
      </motion.div>

      {/* CTA button */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="mt-8 w-full max-w-sm"
      >
        <Button size="xl" onClick={onComplete} disabled={isLoading} className="w-full">
          {isLoading ? 'Setting up...' : 'Go to Dashboard'}
        </Button>
      </motion.div>
    </div>
  );
}
