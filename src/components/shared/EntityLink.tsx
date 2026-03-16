import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

type EntityType = 'student' | 'invoice';

const ROUTE_MAP: Record<EntityType, string> = {
  student: '/students',
  invoice: '/invoices',
};

interface EntityLinkProps {
  type: EntityType;
  id: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Inline navigational link for students and invoices.
 * Renders a subtle text link that navigates to the entity detail page.
 */
export function EntityLink({ type, id, children, className }: EntityLinkProps) {
  return (
    <Link
      to={`${ROUTE_MAP[type]}/${id}`}
      className={cn(
        'text-primary/80 hover:text-primary hover:underline decoration-primary/30 cursor-pointer transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 rounded-sm',
        'inline-flex items-center min-h-[44px] sm:min-h-0',
        className,
      )}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </Link>
  );
}
