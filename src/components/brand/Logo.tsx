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

// Icon-only logo (favicon style) - circular with loop arcs
export function Logo({ className, size = 'md', variant = 'default' }: LogoProps) {
  const isWhite = variant === 'white';
  
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn(sizeMap[size], className)}
      aria-label="LessonLoop logo"
    >
      <defs>
        <linearGradient id="bg-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={isWhite ? 'rgba(255,255,255,0.15)' : '#0a1628'} />
          <stop offset="100%" stopColor={isWhite ? 'rgba(255,255,255,0.25)' : '#1a2a44'} />
        </linearGradient>
        <linearGradient id="accent-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#14b8a6" />
          <stop offset="100%" stopColor="#0d9488" />
        </linearGradient>
      </defs>
      <circle cx="24" cy="24" r="24" fill="url(#bg-gradient)" />
      {/* Left arc - teal */}
      <path
        d="M24 6C13.507 6 5 14.507 5 25s8.507 19 19 19"
        stroke="url(#accent-gradient)"
        strokeWidth="3.5"
        strokeLinecap="round"
        fill="none"
      />
      {/* Right arc - white/light */}
      <path
        d="M24 44c10.493 0 19-8.507 19-19S34.493 6 24 6"
        stroke={isWhite ? 'rgba(255,255,255,0.9)' : '#ffffff'}
        strokeWidth="3.5"
        strokeLinecap="round"
        fill="none"
        opacity="0.9"
      />
      {/* Center L shape */}
      <path
        d="M17 14v20h14"
        stroke="url(#accent-gradient)"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

// Horizontal logo with wordmark - loop arcs + text
export function LogoHorizontal({ className, size = 'md', variant = 'default' }: LogoProps) {
  const isWhite = variant === 'white';
  const textColor = isWhite ? '#ffffff' : '#0a1628';
  const accentColor = '#14b8a6';
  
  return (
    <svg
      viewBox="0 0 230 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn(horizontalSizeMap[size], 'w-auto', className)}
      aria-label="LessonLoop logo"
    >
      <defs>
        <linearGradient id="horiz-accent-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#14b8a6" />
          <stop offset="100%" stopColor="#0d9488" />
        </linearGradient>
      </defs>
      
      {/* Icon group */}
      <g>
        {/* Background circle (subtle) */}
        <circle 
          cx="24" 
          cy="24" 
          r="22" 
          fill={isWhite ? 'rgba(255,255,255,0.1)' : '#0a1628'} 
          fillOpacity={isWhite ? 0.1 : 0.08}
        />
        {/* Outer loop - left arc (teal) */}
        <path
          d="M24 4C12.954 4 4 12.954 4 24s8.954 20 20 20"
          stroke={accentColor}
          strokeWidth="3.5"
          strokeLinecap="round"
          fill="none"
        />
        {/* Outer loop - right arc (dark/white) */}
        <path
          d="M24 44c11.046 0 20-8.954 20-20S35.046 4 24 4"
          stroke={isWhite ? '#ffffff' : '#0a1628'}
          strokeWidth="3.5"
          strokeLinecap="round"
          fill="none"
        />
        {/* Center L shape */}
        <path
          d="M18 15v18h12"
          stroke={accentColor}
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </g>
      
      {/* Wordmark */}
      <text
        x="58"
        y="32"
        fontFamily="Inter, system-ui, sans-serif"
        fontSize="24"
        fontWeight="600"
        fill={textColor}
      >
        Lesson
      </text>
      <text
        x="134"
        y="32"
        fontFamily="Inter, system-ui, sans-serif"
        fontSize="24"
        fontWeight="600"
        fill={accentColor}
      >
        Loop
      </text>
    </svg>
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
