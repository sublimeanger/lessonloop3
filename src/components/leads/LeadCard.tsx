import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Music } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import {
  type LeadListItem,
  type LeadStage,
  STAGE_COLORS,
  SOURCE_LABELS,
} from '@/hooks/useLeads';

interface LeadCardProps {
  lead: LeadListItem;
  /** When true, renders a drag-friendly handle style. */
  isDragging?: boolean;
}

export function LeadCard({ lead, isDragging }: LeadCardProps) {
  const navigate = useNavigate();
  const stageColor = STAGE_COLORS[lead.stage as LeadStage] || '#6b7280';

  const daysInStage = formatDistanceToNow(new Date(lead.updated_at), { addSuffix: false });

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={() => navigate(`/leads/${lead.id}`)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          navigate(`/leads/${lead.id}`);
        }
      }}
      className={cn(
        'relative cursor-pointer select-none overflow-hidden rounded-lg border bg-card p-3 transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
        isDragging && 'rotate-2 shadow-lg ring-2 ring-primary/30',
      )}
    >
      {/* Colored left border */}
      <div
        className="absolute inset-y-0 left-0 w-1 rounded-l-lg"
        style={{ backgroundColor: stageColor }}
      />

      <div className="pl-2 space-y-2">
        {/* Contact name */}
        <p className="font-medium text-sm leading-tight truncate" title={lead.contact_name}>
          {lead.contact_name}
        </p>

        {/* Info row: child count + instrument */}
        <div className="flex items-center gap-2 flex-wrap">
          {lead.student_count > 0 && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="h-3 w-3" />
              {lead.student_count}
            </span>
          )}

          {lead.preferred_instrument && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 gap-0.5">
              <Music className="h-2.5 w-2.5" />
              {lead.preferred_instrument}
            </Badge>
          )}
        </div>

        {/* Bottom row: source + days in stage */}
        <div className="flex items-center justify-between gap-2">
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 font-normal">
            {SOURCE_LABELS[lead.source] || lead.source}
          </Badge>

          <span className="text-[10px] text-muted-foreground whitespace-nowrap">
            {daysInStage}
          </span>
        </div>
      </div>
    </Card>
  );
}
