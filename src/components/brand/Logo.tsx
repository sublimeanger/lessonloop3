import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'default' | 'white';
}

const sizeMap = {
  sm: 'h-6 w-6',
  md: 'h-8 w-8',
  lg: 'h-10 w-10',
  xl: 'h-12 w-12',
};

const horizontalSizeMap = {
  sm: 'h-6',
  md: 'h-8',
  lg: 'h-10',
  xl: 'h-12',
};

// Icon-only logo (favicon style)
export function Logo({ className, size = 'md' }: LogoProps) {
  return (
    <img
      src="/favicon.svg"
      alt="LessonLoop"
      className={cn(sizeMap[size], className)}
    />
  );
}

// Horizontal logo with wordmark
export function LogoHorizontal({ className, size = 'md' }: LogoProps) {
  return (
    <img
      src="/logo-horizontal.svg"
      alt="LessonLoop"
      className={cn(horizontalSizeMap[size], 'w-auto', className)}
    />
  );
}

// Simple text wordmark (no icon)
export function LogoWordmark({ className, variant = 'default' }: Omit<LogoProps, 'size'>) {
  const textColor = variant === 'white' ? 'text-white' : 'text-ink';
  const accentColor = variant === 'white' ? 'text-white/90' : 'text-teal';
  
  return (
    <span className={cn('text-xl font-semibold tracking-tight', className)}>
      <span className={textColor}>Lesson</span>
      <span className={accentColor}>Loop</span>
    </span>
  );
}

export default Logo;
