import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Calendar, Receipt, MessageSquare, ClipboardCheck } from 'lucide-react';

interface DashboardHeroProps {
  firstName: string;
  todayLessons?: number;
  needsAttendance?: number;
  outstandingAmount?: number;
  unreadMessages?: number;
  currencyCode?: string;
  hasStudents?: boolean;
  hasLessons?: boolean;
  className?: string;
}

// ─── Animated SVG Sky Scene ──────────────────────────────────────────

function SunScene() {
  return (
    <svg viewBox="0 0 120 120" className="h-full w-full" aria-hidden="true">
      {/* Warm glow */}
      <defs>
        <radialGradient id="sun-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="hsl(45, 100%, 60%)" stopOpacity="0.4" />
          <stop offset="70%" stopColor="hsl(45, 100%, 60%)" stopOpacity="0.1" />
          <stop offset="100%" stopColor="hsl(45, 100%, 60%)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <motion.circle
        cx="60" cy="60" r="55"
        fill="url(#sun-glow)"
        animate={{ scale: [1, 1.15, 1] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      />
      {/* Sun body */}
      <motion.circle
        cx="60" cy="60" r="22"
        fill="hsl(45, 100%, 58%)"
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      />
      {/* Sun rays */}
      {Array.from({ length: 8 }).map((_, i) => {
        const angle = (i * 45) * (Math.PI / 180);
        const x1 = 60 + Math.cos(angle) * 30;
        const y1 = 60 + Math.sin(angle) * 30;
        const x2 = 60 + Math.cos(angle) * 42;
        const y2 = 60 + Math.sin(angle) * 42;
        return (
          <motion.line
            key={i}
            x1={x1} y1={y1} x2={x2} y2={y2}
            stroke="hsl(45, 100%, 58%)"
            strokeWidth="3"
            strokeLinecap="round"
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 2, repeat: Infinity, delay: i * 0.25, ease: 'easeInOut' }}
          />
        );
      })}
      {/* Small cloud */}
      <motion.g
        animate={{ x: [0, 8, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      >
        <ellipse cx="30" cy="90" rx="16" ry="8" fill="white" opacity="0.7" />
        <ellipse cx="22" cy="88" rx="10" ry="7" fill="white" opacity="0.6" />
        <ellipse cx="38" cy="87" rx="12" ry="7" fill="white" opacity="0.65" />
      </motion.g>
    </svg>
  );
}

function AfternoonScene() {
  return (
    <svg viewBox="0 0 120 120" className="h-full w-full" aria-hidden="true">
      <defs>
        <radialGradient id="afternoon-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="hsl(35, 100%, 55%)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="hsl(35, 100%, 55%)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <motion.circle
        cx="60" cy="60" r="55"
        fill="url(#afternoon-glow)"
        animate={{ scale: [1, 1.1, 1] }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
      />
      {/* Warm sun */}
      <motion.circle
        cx="60" cy="65" r="20"
        fill="hsl(35, 95%, 55%)"
        animate={{ y: [0, -2, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      />
      {/* Clouds drifting */}
      <motion.g
        animate={{ x: [0, 12, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      >
        <ellipse cx="85" cy="45" rx="18" ry="9" fill="white" opacity="0.6" />
        <ellipse cx="76" cy="42" rx="12" ry="8" fill="white" opacity="0.5" />
        <ellipse cx="95" cy="43" rx="14" ry="8" fill="white" opacity="0.55" />
      </motion.g>
      <motion.g
        animate={{ x: [0, -10, 0] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
      >
        <ellipse cx="25" cy="80" rx="14" ry="7" fill="white" opacity="0.5" />
        <ellipse cx="18" cy="78" rx="10" ry="6" fill="white" opacity="0.4" />
      </motion.g>
    </svg>
  );
}

function EveningScene() {
  return (
    <svg viewBox="0 0 120 120" className="h-full w-full" aria-hidden="true">
      <defs>
        <radialGradient id="moon-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="hsl(220, 80%, 80%)" stopOpacity="0.3" />
          <stop offset="100%" stopColor="hsl(220, 80%, 80%)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <motion.circle
        cx="60" cy="60" r="55"
        fill="url(#moon-glow)"
        animate={{ scale: [1, 1.08, 1] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      />
      {/* Moon crescent */}
      <circle cx="60" cy="55" r="18" fill="hsl(45, 50%, 90%)" />
      <circle cx="68" cy="48" r="14" fill="hsl(220, 40%, 18%)" opacity="0.85" />
      {/* Stars */}
      {[
        { cx: 25, cy: 30, r: 1.5, delay: 0 },
        { cx: 90, cy: 25, r: 1.2, delay: 0.5 },
        { cx: 15, cy: 70, r: 1, delay: 1 },
        { cx: 100, cy: 65, r: 1.3, delay: 1.5 },
        { cx: 45, cy: 20, r: 0.8, delay: 0.8 },
        { cx: 80, cy: 85, r: 1.1, delay: 2 },
        { cx: 35, cy: 95, r: 0.9, delay: 1.2 },
      ].map((star, i) => (
        <motion.circle
          key={i}
          cx={star.cx} cy={star.cy} r={star.r}
          fill="hsl(45, 80%, 90%)"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 2, repeat: Infinity, delay: star.delay, ease: 'easeInOut' }}
        />
      ))}
    </svg>
  );
}

function SkyScene() {
  const hour = new Date().getHours();
  if (hour < 12) return <SunScene />;
  if (hour < 18) return <AfternoonScene />;
  return <EveningScene />;
}

// ─── Background gradient based on time ───────────────────────────────

function getTimeTheme() {
  const hour = new Date().getHours();
  if (hour < 12) {
    return {
      greeting: 'Good morning',
      bg: 'from-amber-50 via-orange-50/50 to-yellow-50/30',
      border: 'border-amber-200/40',
      accentText: 'text-amber-700',
      wave: '👋',
    };
  }
  if (hour < 18) {
    return {
      greeting: 'Good afternoon',
      bg: 'from-sky-50 via-blue-50/40 to-cyan-50/30',
      border: 'border-sky-200/40',
      accentText: 'text-sky-700',
      wave: '👋',
    };
  }
  return {
    greeting: 'Good evening',
    bg: 'from-indigo-50 via-violet-50/40 to-slate-50/30',
    border: 'border-indigo-200/40',
    accentText: 'text-indigo-700',
    wave: '👋',
  };
}

// ─── Stat Pill ───────────────────────────────────────────────────────

function StatPill({ 
  value, 
  label, 
  href, 
  icon: Icon, 
  highlight 
}: { 
  value: string | number; 
  label: string; 
  href: string; 
  icon: React.ElementType; 
  highlight?: boolean;
}) {
  return (
    <Link to={href}>
      <motion.div
        className={cn(
          'group flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-all',
          'hover:shadow-md hover:border-primary/30 hover:-translate-y-0.5',
          highlight 
            ? 'bg-destructive/5 border-destructive/20 text-destructive' 
            : 'bg-background/80 border-border/60 text-foreground'
        )}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <Icon className="h-3.5 w-3.5 opacity-60" />
        <span className="font-mono font-semibold">{value}</span>
        <span className="text-muted-foreground text-xs">{label}</span>
      </motion.div>
    </Link>
  );
}

// ─── Main Hero Component ─────────────────────────────────────────────

export function DashboardHero({
  firstName,
  todayLessons = 0,
  needsAttendance = 0,
  outstandingAmount = 0,
  unreadMessages = 0,
  currencyCode = 'GBP',
  hasStudents = false,
  hasLessons = false,
  className,
}: DashboardHeroProps) {
  const theme = getTimeTheme();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Build stat pills
  const pills: Array<{ value: string | number; label: string; href: string; icon: React.ElementType; highlight?: boolean }> = [];
  
  if (hasStudents || hasLessons) {
    pills.push({
      value: todayLessons,
      label: todayLessons === 1 ? 'lesson today' : 'lessons today',
      href: '/calendar',
      icon: Calendar,
    });
  }

  if (needsAttendance > 0) {
    pills.push({
      value: needsAttendance,
      label: 'need attendance',
      href: '/register',
      icon: ClipboardCheck,
      highlight: true,
    });
  }

  if (outstandingAmount > 0) {
    pills.push({
      value: formatCurrency(outstandingAmount / 100),
      label: 'outstanding',
      href: '/reports/outstanding',
      icon: Receipt,
      highlight: true,
    });
  }

  if (unreadMessages > 0) {
    pills.push({
      value: unreadMessages,
      label: unreadMessages === 1 ? 'message' : 'messages',
      href: '/messages',
      icon: MessageSquare,
    });
  }

  return (
    <motion.div
      className={cn(
        'relative overflow-hidden rounded-2xl border p-6 md:p-8',
        'bg-gradient-to-br',
        theme.bg,
        theme.border,
        className
      )}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      data-tour="dashboard-hero"
    >
      <div className="relative z-10 flex items-start justify-between gap-4">
        {/* Text content */}
        <div className="flex-1 space-y-3 min-w-0">
          {/* Date badge */}
          <motion.div
            className="inline-flex items-center gap-1.5 rounded-full bg-background/60 border border-border/40 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur-sm"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Calendar className="h-3 w-3" />
            {format(new Date(), 'EEEE, d MMMM yyyy')}
          </motion.div>

          {/* Greeting with animated wave */}
          <motion.h1
            className="text-2xl font-bold tracking-tight md:text-3xl"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            {theme.greeting},{' '}
            <span className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
              {firstName}
            </span>
            {' '}
            <motion.span
              className="inline-block origin-bottom-right"
              animate={{ rotate: [0, 14, -8, 14, -4, 10, 0] }}
              transition={{ duration: 2, delay: 0.5, ease: 'easeInOut' }}
            >
              {theme.wave}
            </motion.span>
          </motion.h1>

          {/* Sub-message for new users */}
          {!hasStudents && (
            <motion.p
              className="text-sm text-muted-foreground"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              Welcome to LessonLoop! Let's add your first student to get started.
            </motion.p>
          )}

          {/* Stat pills */}
          {pills.length > 0 && (
            <motion.div
              className="flex flex-wrap gap-2 pt-1"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              {pills.map((pill, i) => (
                <StatPill key={i} {...pill} />
              ))}
            </motion.div>
          )}

          {/* All clear message */}
          {hasStudents && pills.length === 0 && (
            <motion.p
              className="text-sm text-muted-foreground"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              All caught up — your schedule is clear today. ✨
            </motion.p>
          )}
        </div>

        {/* Animated sky scene */}
        <motion.div
          className="hidden sm:block h-28 w-28 md:h-32 md:w-32 shrink-0"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200, damping: 20 }}
        >
          <SkyScene />
        </motion.div>
      </div>

      {/* Decorative gradient orbs */}
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/5 blur-3xl" />
      <div className="pointer-events-none absolute -left-12 -bottom-12 h-36 w-36 rounded-full bg-primary/3 blur-2xl" />
    </motion.div>
  );
}
