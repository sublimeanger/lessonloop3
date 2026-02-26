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
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
    >
      {/* Hero */}
      <div className="mb-8 text-center">
        <motion.div
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
          className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10"
        >
          <Music className="h-8 w-8 text-primary" />
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-2xl sm:text-3xl font-bold"
        >
          Welcome to LessonLoop
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-2 text-muted-foreground"
        >
          Let's get you set up — it only takes a minute.
        </motion.p>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardContent className="space-y-6 pt-6">
            {/* Name input */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="space-y-2"
            >
              <Label htmlFor="fullName">Your Name</Label>
              <Input
                id="fullName"
                placeholder="Enter your full name"
                value={fullName}
                maxLength={100}
                onChange={(e) => onNameChange(e.target.value)}
                autoFocus
                autoComplete="name"
                className="h-11"
              />
            </motion.div>

            {/* Org type selection */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="space-y-2"
            >
              <Label>How do you teach?</Label>
              <div
                className="grid gap-3 sm:grid-cols-2"
                role="radiogroup"
                aria-label="Teaching type"
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
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.45 + i * 0.05 }}
                      whileTap={{ scale: 0.98 }}
                      className={`flex items-center gap-4 rounded-xl border-2 p-4 text-left transition-all duration-200 ${
                        isSelected
                          ? 'border-primary bg-primary/5 shadow-sm'
                          : 'border-border hover:border-primary/40 hover:bg-muted/30'
                      }`}
                    >
                      <div className={`rounded-xl p-2.5 transition-colors ${
                        isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted'
                      }`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="font-medium">{type.label}</div>
                        <div className="text-sm text-muted-foreground">{type.description}</div>
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
              <Button type="submit" size="lg">
                Continue
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </motion.div>
          </CardContent>
        </Card>
      </form>
    </motion.div>
  );
}
