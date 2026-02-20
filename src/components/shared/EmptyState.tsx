import { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  children?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  // New: Visual preview of what the populated state looks like
  previewImage?: string;
  previewAlt?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  children,
  size = 'md',
  className,
  previewImage,
  previewAlt,
}: EmptyStateProps) {
  const sizes = {
    sm: {
      container: 'min-h-[200px] p-4',
      iconWrapper: 'h-12 w-12',
      icon: 'h-6 w-6',
      title: 'text-base',
      description: 'text-sm',
    },
    md: {
      container: 'min-h-[400px] p-8',
      iconWrapper: 'h-16 w-16',
      icon: 'h-8 w-8',
      title: 'text-lg',
      description: 'text-sm',
    },
    lg: {
      container: 'min-h-[500px] p-12',
      iconWrapper: 'h-20 w-20',
      icon: 'h-10 w-10',
      title: 'text-xl',
      description: 'text-base',
    },
  };

  const s = sizes[size];

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 text-center transition-colors',
        s.container,
        className
      )}
      role="status"
      aria-label={title}
    >
      {/* Preview image if provided */}
      {previewImage && (
        <div className="mb-4 w-full max-w-xs opacity-60">
          <img 
            src={previewImage} 
            alt={previewAlt || 'Preview of what this will look like'} 
            loading="lazy"
            className="w-full h-auto rounded-lg"
          />
        </div>
      )}
      
      <div 
        className={cn(
          'mx-auto flex items-center justify-center rounded-full bg-muted transition-transform',
          s.iconWrapper
        )}
        aria-hidden="true"
      >
        <Icon className={cn('text-muted-foreground', s.icon)} />
      </div>
      <h3 className={cn('mt-4 font-semibold text-foreground', s.title)}>{title}</h3>
      <p className={cn('mt-2 max-w-sm text-muted-foreground', s.description)}>{description}</p>
      
      {(actionLabel || secondaryActionLabel) && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {actionLabel && onAction && (
            <Button onClick={onAction} size={size === 'sm' ? 'sm' : 'default'}>
              {actionLabel}
            </Button>
          )}
          {secondaryActionLabel && onSecondaryAction && (
            <Button 
              onClick={onSecondaryAction} 
              variant="outline" 
              size={size === 'sm' ? 'sm' : 'default'}
            >
              {secondaryActionLabel}
            </Button>
          )}
        </div>
      )}
      
      {children && <div className="mt-6">{children}</div>}
    </div>
  );
}

// Inline empty state for tables and lists
interface InlineEmptyStateProps {
  icon: LucideIcon;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function InlineEmptyState({
  icon: Icon,
  message,
  actionLabel,
  onAction,
  className,
}: InlineEmptyStateProps) {
  return (
    <div 
      className={cn(
        'flex flex-col items-center justify-center py-8 text-center',
        className
      )}
      role="status"
    >
      <Icon className="h-8 w-8 text-muted-foreground/50" aria-hidden="true" />
      <p className="mt-2 text-sm text-muted-foreground">{message}</p>
      {actionLabel && onAction && (
        <Button onClick={onAction} variant="link" size="sm" className="mt-1">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
