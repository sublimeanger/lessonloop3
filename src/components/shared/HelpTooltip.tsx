import { ReactNode } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

interface HelpTooltipProps {
  content: ReactNode;
  articleId?: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
  className?: string;
  iconClassName?: string;
}

export function HelpTooltip({ 
  content, 
  articleId, 
  side = 'top', 
  className,
  iconClassName,
}: HelpTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground',
            className
          )}
        >
          <HelpCircle className={cn('h-4 w-4', iconClassName)} />
          <span className="sr-only">Help</span>
        </button>
      </TooltipTrigger>
      <TooltipContent side={side} className="max-w-[min(20rem,calc(100vw-2rem))]">
        <div className="text-sm">
          {content}
          {articleId && (
            <Link 
              to={`/help?article=${articleId}`}
              className="block mt-2 text-primary text-xs hover:underline"
            >
              Learn more →
            </Link>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

// Inline help text with icon
interface HelpLabelProps {
  label: string;
  helpText: ReactNode;
  articleId?: string;
  className?: string;
}

export function HelpLabel({ label, helpText, articleId, className }: HelpLabelProps) {
  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <span>{label}</span>
      <HelpTooltip content={helpText} articleId={articleId} iconClassName="h-3.5 w-3.5" />
    </div>
  );
}
