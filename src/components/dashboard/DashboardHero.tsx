import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Calendar, Plus, Receipt, Sparkles, Users, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface DashboardHeroProps {
  firstName: string;
  todayLessons?: number;
  outstandingAmount?: number;
  currencyCode?: string;
  hasStudents?: boolean;
  hasLessons?: boolean;
  className?: string;
}

export function DashboardHero({
  firstName,
  todayLessons = 0,
  outstandingAmount = 0,
  currencyCode = 'GBP',
  hasStudents = false,
  hasLessons = false,
  className,
}: DashboardHeroProps) {
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const getEmoji = () => {
    const hour = new Date().getHours();
    if (hour < 12) return '☀️';
    if (hour < 18) return '🌤️';
    return '🌙';
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getSummary = () => {
    // Brand new user - no students yet
    if (!hasStudents) {
      return "Welcome! Let's add your first student to get started.";
    }
    
    // Has students but no lessons scheduled
    if (!hasLessons && todayLessons === 0) {
      return "You've added students. Now let's schedule some lessons!";
    }
    
    const parts: string[] = [];
    
    if (todayLessons > 0) {
      parts.push(`${todayLessons} lesson${todayLessons !== 1 ? 's' : ''} scheduled today`);
    }
    
    if (outstandingAmount > 0) {
      parts.push(`${formatCurrency(outstandingAmount)} outstanding`);
    }
    
    if (parts.length === 0) {
      return 'All caught up – your schedule is clear today.';
    }
    
    return parts.join(' and ');
  };

  // Determine the primary CTA based on user state
  const getPrimaryCTA = () => {
    if (!hasStudents) {
      return {
        label: 'Add Your First Student',
        href: '/students',
        icon: Users,
        description: 'Start by adding a student to your roster',
      };
    }
    
    if (todayLessons === 0 && !hasLessons) {
      return {
        label: 'Schedule Your First Lesson',
        href: '/calendar',
        icon: Calendar,
        description: 'Create a lesson in the calendar',
      };
    }
    
    if (todayLessons > 0) {
      return {
        label: "View Today's Schedule",
        href: '/calendar',
        icon: Calendar,
        description: null,
      };
    }
    
    return {
      label: 'Schedule a Lesson',
      href: '/calendar',
      icon: Plus,
      description: null,
    };
  };

  const primaryCTA = getPrimaryCTA();
  const isNewUser = !hasStudents;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={cn('relative overflow-hidden rounded-2xl gradient-hero p-6 sm:p-8', className)}
      data-tour="dashboard-hero"
    >
      {/* Background decoration */}
      <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/5 blur-3xl" />
      <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-teal/10 blur-3xl" />
      
      <div className="relative z-10">
        {/* Date badge */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm font-medium text-white/80 backdrop-blur-sm"
        >
          <Calendar className="h-4 w-4" />
          {format(new Date(), 'EEEE, d MMMM yyyy')}
        </motion.div>

        {/* Greeting */}
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-4 text-2xl font-bold text-white sm:text-3xl"
        >
          {getGreeting()}, {firstName}! {getEmoji()}
        </motion.h1>

        {/* Summary */}
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-2 text-base text-white/70 sm:text-lg"
        >
          {getSummary()}
        </motion.p>

        {/* CTAs - Enhanced for new users */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-6 flex flex-wrap gap-3"
        >
          <Link to={primaryCTA.href}>
            <Button className={cn(
              "gap-2 bg-white text-ink hover:bg-white/90",
              isNewUser && "shadow-lg ring-2 ring-white/50"
            )}>
              <primaryCTA.icon className="h-4 w-4" />
              {primaryCTA.label}
              {isNewUser && <ChevronRight className="h-4 w-4" />}
            </Button>
          </Link>
          
          {outstandingAmount > 0 && (
            <Link to="/reports/outstanding">
              <Button variant="outline" className="gap-2 border-white/20 bg-white/10 text-white hover:bg-white/20">
                <Receipt className="h-4 w-4" />
                View Outstanding
              </Button>
            </Link>
          )}
        </motion.div>
        
        {/* New user hint */}
        {isNewUser && primaryCTA.description && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="mt-3 text-sm text-white/50"
          >
            {primaryCTA.description}
          </motion.p>
        )}
      </div>

      {/* Sparkle decoration */}
      <Sparkles className="absolute right-6 top-6 h-6 w-6 text-white/20" />
    </motion.div>
  );
}
