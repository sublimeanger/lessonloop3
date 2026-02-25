import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';

export interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  href?: string;
  trend?: {
    value: number;
    label?: string;
  };
  variant?: 'teal' | 'coral' | 'violet' | 'emerald' | 'default';
  className?: string;
}

const variantStyles = {
  teal: {
    iconBg: 'bg-teal/10',
    iconColor: 'text-teal',
    trendUp: 'text-teal',
  },
  coral: {
    iconBg: 'bg-coral/10',
    iconColor: 'text-coral',
    trendUp: 'text-coral',
  },
  violet: {
    iconBg: 'bg-violet/10',
    iconColor: 'text-violet',
    trendUp: 'text-violet',
  },
  emerald: {
    iconBg: 'bg-emerald/10',
    iconColor: 'text-emerald',
    trendUp: 'text-emerald',
  },
  default: {
    iconBg: 'bg-primary/10',
    iconColor: 'text-primary',
    trendUp: 'text-primary',
  },
};

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  href,
  trend,
  variant = 'default',
  className,
}: StatCardProps) {
  const styles = variantStyles[variant];
  
  const content = (
    <motion.div
      whileHover={href ? { y: -2 } : undefined}
      transition={{ type: 'spring', stiffness: 400, damping: 17 }}
    >
      <Card
        className={cn(
          'relative overflow-hidden transition-all duration-200',
          href && 'cursor-pointer hover:shadow-card-hover hover:border-primary/20',
          className
        )}
      >
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-start justify-between">
            {/* Icon */}
            <div
              className={cn(
                'flex h-9 w-9 sm:h-10 sm:w-10 md:h-12 md:w-12 items-center justify-center rounded-lg sm:rounded-xl',
                styles.iconBg
              )}
            >
              <Icon className={cn('h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6', styles.iconColor)} />
            </div>

            {/* Trend indicator */}
            {trend && trend.value !== 0 && (
              <div
                className={cn(
                  'flex items-center gap-1 text-caption',
                  trend.value > 0 ? 'text-success' : 'text-destructive'
                )}
              >
                {trend.value > 0 ? (
                  <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                )}
                <span>{Math.abs(trend.value)}%</span>
              </div>
            )}
          </div>

          {/* Value */}
          <div className="mt-3 sm:mt-4">
            <p className="text-page-title truncate">{value}</p>
            <p className="mt-0.5 sm:mt-1 text-body-strong text-muted-foreground truncate">
              {title}
            </p>
          </div>

          {/* Subtitle */}
          {subtitle && (
            <p className="mt-1.5 sm:mt-2 text-caption text-muted-foreground truncate">{subtitle}</p>
          )}
        </CardContent>

        {/* Decorative gradient corner */}
        <div
          className={cn(
            'absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-20 blur-2xl',
            variant === 'teal' && 'bg-teal',
            variant === 'coral' && 'bg-coral',
            variant === 'violet' && 'bg-violet',
            variant === 'emerald' && 'bg-emerald',
            variant === 'default' && 'bg-primary'
          )}
        />
      </Card>
    </motion.div>
  );

  if (href) {
    return <Link to={href} aria-label={`${title}: ${value}${subtitle ? `. ${subtitle}` : ''}`}>{content}</Link>;
  }

  return content;
}
