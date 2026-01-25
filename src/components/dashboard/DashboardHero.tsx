import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Calendar, Plus, Receipt, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface DashboardHeroProps {
  firstName: string;
  todayLessons?: number;
  outstandingAmount?: number;
  currencyCode?: string;
  hasStudents?: boolean;
  className?: string;
}

export function DashboardHero({
  firstName,
  todayLessons = 0,
  outstandingAmount = 0,
  currencyCode = 'GBP',
  hasStudents = false,
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
    const parts: string[] = [];
    
    if (todayLessons > 0) {
      parts.push(`${todayLessons} lesson${todayLessons !== 1 ? 's' : ''} scheduled today`);
    }
    
    if (outstandingAmount > 0) {
      parts.push(`${formatCurrency(outstandingAmount)} outstanding`);
    }
    
    if (parts.length === 0) {
      if (!hasStudents) {
        return "Let's get your teaching business set up!";
      }
      return 'All caught up – your schedule is clear today.';
    }
    
    return parts.join(' and ');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={cn('relative overflow-hidden rounded-2xl gradient-hero p-6 sm:p-8', className)}
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

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-6 flex flex-wrap gap-3"
        >
          {todayLessons > 0 ? (
            <Link to="/calendar">
              <Button className="gap-2 bg-white text-ink hover:bg-white/90">
                <Calendar className="h-4 w-4" />
                View Today's Schedule
              </Button>
            </Link>
          ) : !hasStudents ? (
            <Link to="/students">
              <Button className="gap-2 bg-white text-ink hover:bg-white/90">
                <Plus className="h-4 w-4" />
                Add Your First Student
              </Button>
            </Link>
          ) : (
            <Link to="/calendar">
              <Button className="gap-2 bg-white text-ink hover:bg-white/90">
                <Plus className="h-4 w-4" />
                Schedule a Lesson
              </Button>
            </Link>
          )}
          
          {outstandingAmount > 0 && (
            <Link to="/reports/outstanding">
              <Button variant="outline" className="gap-2 border-white/20 bg-white/10 text-white hover:bg-white/20">
                <Receipt className="h-4 w-4" />
                View Outstanding
              </Button>
            </Link>
          )}
        </motion.div>
      </div>

      {/* Sparkle decoration */}
      <Sparkles className="absolute right-6 top-6 h-6 w-6 text-white/20" />
    </motion.div>
  );
}
