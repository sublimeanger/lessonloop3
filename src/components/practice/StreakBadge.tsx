import { Flame, Trophy, Star, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface StreakBadgeProps {
  currentStreak: number;
  longestStreak?: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

function getStreakTier(streak: number) {
  if (streak >= 30) return { tier: 'legendary', color: 'text-amber-500', bg: 'bg-amber-500/10', icon: Trophy, label: 'Legendary!' };
  if (streak >= 14) return { tier: 'blazing', color: 'text-orange-500', bg: 'bg-orange-500/10', icon: Flame, label: 'On fire!' };
  if (streak >= 7) return { tier: 'hot', color: 'text-red-500', bg: 'bg-red-500/10', icon: Flame, label: 'Hot streak!' };
  if (streak >= 3) return { tier: 'building', color: 'text-yellow-500', bg: 'bg-yellow-500/10', icon: Zap, label: 'Building momentum!' };
  if (streak >= 1) return { tier: 'starting', color: 'text-green-500', bg: 'bg-green-500/10', icon: Star, label: 'Great start!' };
  return null;
}

export function StreakBadge({ 
  currentStreak, 
  longestStreak, 
  size = 'md', 
  showLabel = false,
  className 
}: StreakBadgeProps) {
  const tier = getStreakTier(currentStreak);

  if (!tier || currentStreak === 0) {
    return null;
  }

  const Icon = tier.icon;

  const sizes = {
    sm: {
      container: 'px-1.5 py-0.5 text-xs gap-1',
      icon: 'h-3 w-3',
    },
    md: {
      container: 'px-2 py-1 text-sm gap-1.5',
      icon: 'h-4 w-4',
    },
    lg: {
      container: 'px-3 py-1.5 text-base gap-2',
      icon: 'h-5 w-5',
    },
  };

  const s = sizes[size];

  const badge = (
    <div
      className={cn(
        'inline-flex items-center rounded-full font-medium',
        tier.bg,
        tier.color,
        s.container,
        className
      )}
    >
      <Icon className={cn(s.icon, 'transition-transform hover:scale-110 hover:brightness-110')} />
      <span>{currentStreak}</span>
      {showLabel && <span className="font-normal">{tier.label}</span>}
    </div>
  );

  if (!showLabel) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          {badge}
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-center">
            <p className="font-medium">{currentStreak} day streak! {tier.label}</p>
            {longestStreak && longestStreak > currentStreak && (
              <p className="text-xs text-muted-foreground">
                Personal best: {longestStreak} days
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    );
  }

  return badge;
}

// Larger display version for dashboards
interface StreakDisplayProps {
  currentStreak: number;
  longestStreak: number;
  lastPracticeDate?: string | null;
  className?: string;
}

export function StreakDisplay({ 
  currentStreak, 
  longestStreak, 
  lastPracticeDate: _lastPracticeDate,
  className 
}: StreakDisplayProps) {
  const tier = getStreakTier(currentStreak);
  const Icon = tier?.icon || Flame;

  return (
    <div className={cn('flex items-center gap-4', className)}>
      <div className={cn(
        'flex h-16 w-16 items-center justify-center rounded-full',
        tier ? tier.bg : 'bg-muted'
      )}>
        <Icon className={cn(
          'h-8 w-8',
          tier ? tier.color : 'text-muted-foreground',
          'transition-transform hover:scale-110 hover:brightness-110'
        )} />
      </div>
      <div>
        <div className="flex items-baseline gap-2">
          <span className={cn(
            'text-3xl font-bold',
            tier ? tier.color : 'text-muted-foreground'
          )}>
            {currentStreak}
          </span>
          <span className="text-muted-foreground">day streak</span>
        </div>
        {tier && (
          <p className={cn('text-sm font-medium', tier.color)}>
            {tier.label}
          </p>
        )}
        {longestStreak > 0 && (
          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
            <Trophy className="h-3 w-3" />
            Personal best: {longestStreak} days
          </p>
        )}
      </div>
    </div>
  );
}

// Compact inline version
export function StreakInline({ currentStreak }: { currentStreak: number }) {
  if (currentStreak === 0) return null;

  const tier = getStreakTier(currentStreak);
  if (!tier) return null;

  return (
    <span className={cn('inline-flex items-center gap-1', tier.color)}>
      <Flame className="h-3.5 w-3.5" />
      {currentStreak}
    </span>
  );
}
