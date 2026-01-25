import { motion } from 'framer-motion';
import { User, Users, Building, Building2, Clock, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LogoHorizontal } from '@/components/brand/Logo';
import type { OrgType } from '@/contexts/OrgContext';

interface OnboardingWelcomeProps {
  selectedType: OrgType;
  onSelectType: (type: OrgType) => void;
  onContinue: () => void;
  onLogout: () => void;
  userName?: string;
}

const orgTypes: { value: OrgType; label: string; description: string; icon: React.ReactNode }[] = [
  { value: 'solo_teacher', label: 'Solo Teacher', description: 'I teach independently', icon: <User className="h-6 w-6" /> },
  { value: 'studio', label: 'Small Studio', description: 'Small team, shared space', icon: <Users className="h-6 w-6" /> },
  { value: 'academy', label: 'Academy', description: 'Multiple teachers & locations', icon: <Building className="h-6 w-6" /> },
  { value: 'agency', label: 'Agency', description: 'Managing teachers for clients', icon: <Building2 className="h-6 w-6" /> },
];

export function OnboardingWelcome({ selectedType, onSelectType, onContinue, onLogout, userName }: OnboardingWelcomeProps) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-4 py-12 gradient-hero-light">
      {/* Logout button - always accessible */}
      <div className="absolute top-4 right-4">
        <Button variant="ghost" size="sm" onClick={onLogout} className="text-muted-foreground hover:text-foreground">
          <LogOut className="h-4 w-4 mr-2" />
          Logout
        </Button>
      </div>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-lg text-center"
      >
        {/* Logo animation */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="flex justify-center mb-8"
        >
          <LogoHorizontal size="xl" />
        </motion.div>

        {/* Welcome text */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="space-y-2 mb-8"
        >
          <h1 className="text-3xl font-bold text-foreground">
            {userName ? `Welcome, ${userName.split(' ')[0]}!` : 'Welcome to LessonLoop'}
          </h1>
          <p className="text-lg text-muted-foreground flex items-center justify-center gap-2">
            <Clock className="h-5 w-5" />
            Let's get you set up in under 2 minutes
          </p>
        </motion.div>

        {/* Type selection */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="space-y-4 mb-8"
        >
          <p className="text-sm font-medium text-foreground">How do you teach?</p>
          <div className="grid grid-cols-2 gap-3">
            {orgTypes.map((type, index) => (
              <motion.button
                key={type.value}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 + index * 0.1 }}
                onClick={() => onSelectType(type.value)}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all hover:border-primary/50 ${
                  selectedType === type.value
                    ? 'border-primary bg-primary/5 shadow-md'
                    : 'border-border bg-card hover:bg-accent/50'
                }`}
              >
                <div className={`p-3 rounded-full transition-colors ${
                  selectedType === type.value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}>
                  {type.icon}
                </div>
                <div>
                  <div className="font-medium text-foreground">{type.label}</div>
                  <div className="text-xs text-muted-foreground">{type.description}</div>
                </div>
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* Continue button */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          <Button size="xl" onClick={onContinue} className="w-full">
            Get Started →
          </Button>
        </motion.div>
      </motion.div>
    </div>
  );
}
