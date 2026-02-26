import { motion } from 'framer-motion';
import { User, Building2, Users, Network, ArrowRight, Music } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { OrgType } from '@/hooks/useOnboardingState';

const ORG_TYPES = [
  {
    value: 'solo_teacher' as const,
    label: 'Solo Teacher',
    description: 'I teach independently',
    icon: User,
  },
  {
    value: 'studio' as const,
    label: 'Music Studio',
    description: 'Small team, 2-10 teachers',
    icon: Building2,
  },
  {
    value: 'academy' as const,
    label: 'Music Academy',
    description: 'Multiple locations & staff',
    icon: Users,
  },
  {
    value: 'agency' as const,
    label: 'Teaching Agency',
    description: 'Managing peripatetic teachers',
    icon: Network,
  },
];

interface WelcomeStepProps {
  fullName: string;
  orgType: OrgType;
  onNameChange: (name: string) => void;
  onOrgTypeChange: (type: OrgType) => void;
  onNext: () => void;
}

export function WelcomeStep({ fullName, orgType, onNameChange, onOrgTypeChange, onNext }: WelcomeStepProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onNext();
  };

  return (
    <motion.div
      key="welcome"
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Hero */}
      <div className="mb-8 sm:mb-10 text-center">
        <motion.div
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.1 }}
          className="mx-auto mb-5 flex h-16 w-16 sm:h-[72px] sm:w-[72px] items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 shadow-sm ring-1 ring-primary/10"
        >
          <Music className="h-8 w-8 sm:h-9 sm:w-9 text-primary" />
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="text-2xl sm:text-3xl font-bold tracking-tight"
        >
          Welcome to LessonLoop
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          className="mt-2 text-muted-foreground text-sm sm:text-base"
        >
          Let's get you set up — it only takes a minute.
        </motion.p>
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="shadow-card">
          <CardContent className="space-y-6 p-5 sm:p-6">
            {/* Name input */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.4 }}
              className="space-y-2"
            >
              <Label htmlFor="fullName" className="text-sm font-medium">Your Name</Label>
              <Input
                id="fullName"
                placeholder="Enter your full name"
                value={fullName}
                maxLength={100}
                onChange={(e) => onNameChange(e.target.value)}
                autoFocus
                autoComplete="name"
                className="h-11 sm:h-12 text-base"
              />
            </motion.div>

            {/* Org type selection */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.4 }}
              className="space-y-3"
            >
              <Label className="text-sm font-medium">How do you teach?</Label>
              <div
                className="grid gap-2.5 sm:gap-3 sm:grid-cols-2"
                role="radiogroup"
                aria-label="Select your teaching type"
                onKeyDown={(e) => {
                  if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
                  e.preventDefault();
                  const radios = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]'));
                  const idx = radios.findIndex(r => r === document.activeElement);
                  if (idx === -1) return;
                  const next = ['ArrowDown', 'ArrowRight'].includes(e.key)
                    ? (idx + 1) % radios.length
                    : (idx - 1 + radios.length) % radios.length;
                  radios[next].focus();
                  onOrgTypeChange(ORG_TYPES[next].value);
                }}
              >
                {ORG_TYPES.map((type, i) => {
                  const Icon = type.icon;
                  const isSelected = orgType === type.value;
                  return (
                    <motion.button
                      key={type.value}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      tabIndex={isSelected ? 0 : -1}
                      aria-label={`${type.label}: ${type.description}`}
                      onClick={() => onOrgTypeChange(type.value)}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.45 + i * 0.06, duration: 0.35 }}
                      whileHover={{ y: -2, transition: { duration: 0.2 } }}
                      whileTap={{ scale: 0.97 }}
                      className={`group flex items-center gap-3.5 rounded-xl border-2 p-3.5 sm:p-4 text-left transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                        isSelected
                          ? 'border-primary bg-primary/5 shadow-md shadow-primary/10'
                          : 'border-border hover:border-primary/30 hover:shadow-card'
                      }`}
                    >
                      <div className={`shrink-0 rounded-lg p-2.5 transition-all duration-200 ${
                        isSelected
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary'
                      }`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-sm sm:text-base leading-tight">{type.label}</div>
                        <div className="text-xs sm:text-sm text-muted-foreground leading-snug">{type.description}</div>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
              className="flex justify-end pt-2"
            >
              <Button
                type="submit"
                size="lg"
                disabled={!fullName.trim()}
                className="min-w-[140px] shadow-sm hover:shadow-md transition-shadow"
              >
                Continue
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Button>
            </motion.div>
          </CardContent>
        </Card>
      </form>
    </motion.div>
  );
}
