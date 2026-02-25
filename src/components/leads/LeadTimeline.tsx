import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Loader2,
  MessageSquarePlus,
  Phone,
  UserPlus,
  ArrowRightLeft,
  CheckCircle2,
  CalendarCheck,
  CalendarClock,
  StickyNote,
  Send,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { useLeadActivities, useAddLeadNote } from '@/hooks/useLeadActivities';
import type { LeadActivity } from '@/hooks/useLeads';

// ---------------------------------------------------------------------------
// Activity type config
// ---------------------------------------------------------------------------

const ACTIVITY_CONFIG: Record<
  string,
  { icon: typeof MessageSquarePlus; color: string; label: string }
> = {
  created: {
    icon: UserPlus,
    color: 'text-blue-500 bg-blue-500/10',
    label: 'Created',
  },
  note_added: {
    icon: StickyNote,
    color: 'text-amber-500 bg-amber-500/10',
    label: 'Note',
  },
  call_logged: {
    icon: Phone,
    color: 'text-green-500 bg-green-500/10',
    label: 'Call',
  },
  stage_changed: {
    icon: ArrowRightLeft,
    color: 'text-indigo-500 bg-indigo-500/10',
    label: 'Stage Changed',
  },
  converted: {
    icon: CheckCircle2,
    color: 'text-emerald-500 bg-emerald-500/10',
    label: 'Converted',
  },
  follow_up_scheduled: {
    icon: CalendarClock,
    color: 'text-purple-500 bg-purple-500/10',
    label: 'Follow-up Scheduled',
  },
  follow_up_completed: {
    icon: CalendarCheck,
    color: 'text-teal-500 bg-teal-500/10',
    label: 'Follow-up Done',
  },
  trial_booked: {
    icon: CalendarCheck,
    color: 'text-orange-500 bg-orange-500/10',
    label: 'Trial Booked',
  },
};

const DEFAULT_CONFIG = {
  icon: MessageSquarePlus,
  color: 'text-muted-foreground bg-muted',
  label: 'Activity',
};

// ---------------------------------------------------------------------------
// Timeline Item
// ---------------------------------------------------------------------------

function TimelineItem({ activity }: { activity: LeadActivity }) {
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
// Inline "Add Note" form
// ---------------------------------------------------------------------------

function AddNoteForm({ leadId }: { leadId: string }) {
  const [note, setNote] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const addNote = useAddLeadNote();

  const handleSubmit = useCallback(async () => {
    if (!note.trim()) return;
    await addNote.mutateAsync({ leadId, note: note.trim() });
    setNote('');
    setIsExpanded(false);
  }, [note, leadId, addNote]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  if (!isExpanded) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="w-full justify-start gap-2 text-muted-foreground font-normal h-9"
        onClick={() => setIsExpanded(true)}
      >
        <StickyNote className="h-3.5 w-3.5" />
        Add a note...
      </Button>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border bg-card p-3">
      <Textarea
        autoFocus
        placeholder="Type your note..."
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={2}
        className="text-sm resize-none"
      />
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">
          Ctrl+Enter to send
        </span>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => {
              setIsExpanded(false);
              setNote('');
            }}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={handleSubmit}
            disabled={!note.trim() || addNote.isPending}
          >
            {addNote.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Send className="h-3 w-3" />
            )}
            Add Note
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Timeline
// ---------------------------------------------------------------------------

interface LeadTimelineProps {
  leadId: string;
}

export function LeadTimeline({ leadId }: LeadTimelineProps) {
  const { data: activities, isLoading } = useLeadActivities(leadId);

  return (
    <div className="space-y-4">
      {/* Inline note form at top */}
      <AddNoteForm leadId={leadId} />

      {/* Activities list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : activities && activities.length > 0 ? (
        <div className="relative">
          {activities.map((activity) => (
            <TimelineItem key={activity.id} activity={activity} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-6">
          No activity yet
        </p>
      )}
    </div>
  );
}
