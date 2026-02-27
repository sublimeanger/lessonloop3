import {
  UserPlus,
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  UserMinus,
  StickyNote,
  AlertTriangle,
  ArrowRightLeft,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import type { WaitlistActivity } from '@/hooks/useEnrolmentWaitlist';

// ---------------------------------------------------------------------------
// Activity type config
// ---------------------------------------------------------------------------

const ACTIVITY_CONFIG: Record<
  string,
  { icon: LucideIcon; color: string; label: string }
> = {
  created: {
    icon: UserPlus,
    color: 'text-blue-500 bg-blue-500/10',
    label: 'Added to List',
  },
  offered: {
    icon: Send,
    color: 'text-amber-500 bg-amber-500/10',
    label: 'Slot Offered',
  },
  offer_sent: {
    icon: Send,
    color: 'text-amber-500 bg-amber-500/10',
    label: 'Offer Email Sent',
  },
  accepted: {
    icon: CheckCircle2,
    color: 'text-emerald-500 bg-emerald-500/10',
    label: 'Offer Accepted',
  },
  declined: {
    icon: XCircle,
    color: 'text-red-500 bg-red-500/10',
    label: 'Offer Declined',
  },
  enrolled: {
    icon: CheckCircle2,
    color: 'text-green-500 bg-green-500/10',
    label: 'Enrolled',
  },
  withdrawn: {
    icon: UserMinus,
    color: 'text-gray-500 bg-gray-500/10',
    label: 'Withdrawn',
  },
  offer_expired: {
    icon: Clock,
    color: 'text-orange-500 bg-orange-500/10',
    label: 'Offer Expired',
  },
  note_added: {
    icon: StickyNote,
    color: 'text-indigo-500 bg-indigo-500/10',
    label: 'Note Added',
  },
  priority_changed: {
    icon: AlertTriangle,
    color: 'text-purple-500 bg-purple-500/10',
    label: 'Priority Changed',
  },
  position_changed: {
    icon: ArrowRightLeft,
    color: 'text-teal-500 bg-teal-500/10',
    label: 'Position Changed',
  },
};

const DEFAULT_CONFIG = {
  icon: StickyNote,
  color: 'text-muted-foreground bg-muted',
  label: 'Activity',
};

// ---------------------------------------------------------------------------
// Timeline Item
// ---------------------------------------------------------------------------

function TimelineItem({ activity }: { activity: WaitlistActivity }) {
  const config = ACTIVITY_CONFIG[activity.activity_type] || DEFAULT_CONFIG;
  const Icon = config.icon;
  const timeAgo = formatDistanceToNow(new Date(activity.created_at), { addSuffix: true });

  return (
    <div className="relative flex gap-3 pb-6 last:pb-0">
      {/* Vertical line connector */}
      <div className="absolute left-[15px] top-8 bottom-0 w-px bg-border last:hidden" />

      {/* Icon */}
      <div
        className={cn(
          'relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
          config.color,
        )}
      >
        <Icon className="h-3.5 w-3.5" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pt-0.5">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-sm font-medium">{config.label}</span>
          <span className="text-xs text-muted-foreground">{timeAgo}</span>
        </div>
        {activity.description && (
          <p className="mt-0.5 text-sm text-muted-foreground whitespace-pre-wrap break-words">
            {activity.description}
          </p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Timeline Component
// ---------------------------------------------------------------------------

interface WaitlistActivityTimelineProps {
  activities: WaitlistActivity[];
  isLoading?: boolean;
}

export function WaitlistActivityTimeline({ activities, isLoading }: WaitlistActivityTimelineProps) {
  if (isLoading) {
    return (
      <div className="space-y-4 py-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex gap-3">
            <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-24 rounded bg-muted animate-pulse" />
              <div className="h-3 w-48 rounded bg-muted animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">No activity yet.</p>
    );
  }

  return (
    <div className="py-2">
      {activities.map((activity) => (
        <TimelineItem key={activity.id} activity={activity} />
      ))}
    </div>
  );
}
