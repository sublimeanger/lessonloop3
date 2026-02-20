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
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center py-20',
        className
      )}
      role="status"
      aria-label={title}
    >
      {previewImage && (
        <div className="mb-6 w-full max-w-xs opacity-60">
          <img 
            src={previewImage} 
            alt={previewAlt || 'Preview of what this will look like'} 
            loading="lazy"
            className="w-full h-auto rounded-lg"
          />
        </div>
      )}
      
      <Icon className="h-12 w-12 text-muted-foreground/30" aria-hidden="true" />
      <h3 className="mt-4 text-lg font-semibold text-foreground">{title}</h3>
      <p className="mt-2 max-w-sm mx-auto text-sm text-muted-foreground">{description}</p>
      
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
