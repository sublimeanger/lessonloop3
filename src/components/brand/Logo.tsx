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
export function Logo({ className, size = 'md', variant = 'default' }: LogoProps) {
  const fillColor = variant === 'white' ? '#ffffff' : 'currentColor';
  
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn(sizeMap[size], 'text-primary', className)}
      aria-label="LessonLoop logo"
    >
      <rect width="64" height="64" rx="14" fill={variant === 'white' ? 'rgba(255,255,255,0.1)' : 'hsl(var(--primary))'} />
      <path
        d="M18 18V46H38"
        stroke={variant === 'white' ? '#ffffff' : 'hsl(var(--primary-foreground))'}
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx="38"
        cy="32"
        r="10"
        stroke={variant === 'white' ? '#ffffff' : 'hsl(var(--primary-foreground))'}
        strokeWidth="5"
        fill="none"
      />
    </svg>
  );
}

// Horizontal logo with wordmark
export function LogoHorizontal({ className, size = 'md', variant = 'default' }: LogoProps) {
  const textColor = variant === 'white' ? '#ffffff' : 'hsl(var(--foreground))';
  const accentColor = variant === 'white' ? '#ffffff' : 'hsl(var(--primary))';
  
  return (
    <svg
      viewBox="0 0 180 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn(horizontalSizeMap[size], 'w-auto', className)}
      aria-label="LessonLoop logo"
    >
      {/* Icon */}
      <rect width="40" height="40" rx="8" fill="hsl(var(--primary))" />
      <path
        d="M11 11V29H24"
        stroke={variant === 'white' ? 'hsl(var(--primary))' : 'hsl(var(--primary-foreground))'}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx="24"
        cy="20"
        r="6"
        stroke={variant === 'white' ? 'hsl(var(--primary))' : 'hsl(var(--primary-foreground))'}
        strokeWidth="3"
        fill="none"
      />
      
      {/* Wordmark */}
      <text
        x="48"
        y="27"
        fontFamily="Inter, system-ui, sans-serif"
        fontSize="18"
        fontWeight="600"
        letterSpacing="-0.02em"
      >
        <tspan fill={textColor}>Lesson</tspan>
        <tspan fill={accentColor}>Loop</tspan>
      </text>
    </svg>
  );
}

// Simple text wordmark (no icon)
export function LogoWordmark({ className, variant = 'default' }: Omit<LogoProps, 'size'>) {
  const textColor = variant === 'white' ? 'text-white' : 'text-foreground';
  const accentColor = variant === 'white' ? 'text-white/90' : 'text-primary';
  
  return (
    <span className={cn('text-xl font-semibold tracking-tight', className)}>
      <span className={textColor}>Lesson</span>
      <span className={accentColor}>Loop</span>
    </span>
  );
}

export default Logo;
