import { useState } from 'react';
import { logger } from '@/lib/logger';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  CheckCircle, 
  XCircle, 
  Loader2, 
  FileText, 
  Mail, 
  Calendar, 
  Receipt,
  ClipboardCheck,
  CheckCircle2,
  Ban,
  ShieldAlert,
  AlertTriangle,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useOrg } from '@/contexts/OrgContext';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { ACTION_REGISTRY, isDestructiveAction, getAllowedRoles, getActionLabel } from '@/lib/action-registry';

export interface ActionEntity {
  type: 'invoice' | 'student' | 'lesson' | 'guardian';
  id: string;
  label: string;
}

export interface ActionProposalData {
  action_type: 
    | 'generate_billing_run' 
    | 'send_invoice_reminders' 
    | 'reschedule_lessons' 
    | 'draft_email'
    | 'mark_attendance'
    | 'cancel_lesson'
    | 'complete_lessons'
    | 'send_progress_report'
    | 'bulk_complete_lessons'
    | 'send_bulk_reminders';
  description: string;
  entities: ActionEntity[];
  params: Record<string, unknown>;
}

interface ActionCardProps {
  proposalId: string;
  proposal: ActionProposalData;
  onConfirm: (proposalId: string) => void;
  onCancel: (proposalId: string) => void;
  isLoading?: boolean;
}

const ICON_COMPONENT_MAP: Record<string, typeof FileText> = {
  Receipt, Mail, Calendar, FileText, ClipboardCheck, Ban, CheckCircle2,
};

function getActionIcon(actionType: string): typeof FileText {
  const def = ACTION_REGISTRY[actionType];
  return (def ? ICON_COMPONENT_MAP[def.iconName] : null) || FileText;
}

const ENTITY_COLORS: Record<string, string> = {
  invoice: 'bg-success/10 text-success hover:bg-success/20 dark:bg-success/20 dark:text-success dark:hover:bg-success/30',
  student: 'bg-primary/10 text-primary hover:bg-primary/20 dark:bg-primary/20 dark:text-primary dark:hover:bg-primary/30',
  lesson: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
  guardian: 'bg-warning/10 text-warning hover:bg-warning/20 dark:bg-warning/20 dark:text-warning dark:hover:bg-warning/30',
};

function getPreviewText(proposal: ActionProposalData): string | null {
  const { action_type, entities, params } = proposal;

  switch (action_type) {
    case 'cancel_lesson': {
      const lesson = entities.find(e => e.type === 'lesson');
      if (lesson && params.date) {
        const dateStr = typeof params.date === 'string' ? safeFormatDate(params.date) : '';
        const timeStr = typeof params.time === 'string' ? params.time : '';
        return `This will cancel "${lesson.label}"${dateStr ? ` on ${dateStr}` : ''}${timeStr ? ` at ${timeStr}` : ''}`;
      }
      return lesson ? `This will cancel "${lesson.label}"` : null;
    }
    case 'generate_billing_run': {
      const lessonCount = typeof params.lesson_count === 'number' ? params.lesson_count : entities.filter(e => e.type === 'lesson').length;
      const start = typeof params.start_date === 'string' ? safeFormatDate(params.start_date) : null;
      const end = typeof params.end_date === 'string' ? safeFormatDate(params.end_date) : null;
      const countStr = lessonCount > 0 ? `${lessonCount} lessons` : 'lessons';
      if (start && end) {
        return `This will create invoices for ${countStr} from ${start} to ${end}`;
      }
      return `This will create invoices for ${countStr}`;
    }
    case 'mark_attendance': {
      const studentCount = entities.filter(e => e.type === 'student').length;
      const status = typeof params.status === 'string' ? params.status : 'present';
      const lesson = entities.find(e => e.type === 'lesson');
      const lessonLabel = lesson ? ` for "${lesson.label}"` : '';
      return `This will mark ${studentCount} student${studentCount !== 1 ? 's' : ''} as ${status}${lessonLabel}`;
    }
    case 'send_invoice_reminders': {
      const invoiceCount = typeof params.invoice_count === 'number' ? params.invoice_count : entities.filter(e => e.type === 'invoice').length;
      return `This will send reminders for ${invoiceCount} overdue invoice${invoiceCount !== 1 ? 's' : ''}`;
    }
    case 'send_bulk_reminders': {
      const invoiceCount = entities.filter(e => e.type === 'invoice').length;
      return `This will send reminders for ${invoiceCount > 0 ? invoiceCount : 'all'} overdue invoice${invoiceCount !== 1 ? 's' : ''}`;
    }
    case 'bulk_complete_lessons': {
      const lessonCount = entities.filter(e => e.type === 'lesson').length;
      const beforeDate = typeof params.before_date === 'string' ? safeFormatDate(params.before_date) : 'today';
      return `This will mark ${lessonCount > 0 ? lessonCount : 'all'} past lesson${lessonCount !== 1 ? 's' : ''} before ${beforeDate} as completed`;
    }
    default:
      return null;
  }
}

function safeFormatDate(dateStr: string): string {
  try {
    return format(parseISO(dateStr), 'd MMM yyyy');
  } catch {
    return dateStr;
  }
}

export function ActionCard({ proposalId, proposal, onConfirm, onCancel, isLoading }: ActionCardProps) {
  const navigate = useNavigate();
  const { currentRole } = useOrg();
  const [isConfirming, setIsConfirming] = useState(false);
  const [awaitingSecondConfirm, setAwaitingSecondConfirm] = useState(false);
  const Icon = getActionIcon(proposal.action_type);

  const allowedRoles = getAllowedRoles(proposal.action_type);
  const hasPermission = currentRole ? allowedRoles.includes(currentRole) : false;
  const isDestructive = isDestructiveAction(proposal.action_type);
  const previewText = getPreviewText(proposal);

  const handleConfirm = async () => {
    if (isDestructive && !awaitingSecondConfirm) {
      setAwaitingSecondConfirm(true);
      return;
    }
    setIsConfirming(true);
    onConfirm(proposalId);
  };

  const handleCancelSecondStep = () => {
    setAwaitingSecondConfirm(false);
  };

  const handleEntityClick = (entity: ActionEntity) => {
    switch (entity.type) {
      case 'invoice':
        navigate('/invoices');
        break;
      case 'student':
        navigate(`/students/${entity.id}`);
        break;
      case 'lesson':
        navigate('/calendar');
        break;
      case 'guardian':
        break;
    }
  };

  const actionLabel = getActionLabel(proposal.action_type);

  const confirmButton = awaitingSecondConfirm ? (
    <Button
      size="sm"
      variant="destructive"
      onClick={handleConfirm}
      disabled={isLoading || isConfirming}
      className="flex-1"
      aria-label={`Confirm ${actionLabel}`}
    >
      {isConfirming ? (
        <Loader2 className="mr-1 h-4 w-4 animate-spin" />
      ) : (
        <AlertTriangle className="mr-1 h-4 w-4" />
      )}
      Yes, I'm sure
    </Button>
  ) : (
    <Button
      size="sm"
      onClick={handleConfirm}
      disabled={isLoading || isConfirming || !hasPermission}
      className="flex-1"
      variant={isDestructive ? 'destructive' : 'default'}
      aria-label={`Confirm ${actionLabel}`}
    >
      {isConfirming ? (
        <Loader2 className="mr-1 h-4 w-4 animate-spin" />
      ) : !hasPermission ? (
        <ShieldAlert className="mr-1 h-4 w-4" />
      ) : (
        <CheckCircle className="mr-1 h-4 w-4" />
      )}
      Confirm
    </Button>
  );

  return (
    <Card className={cn(
      'border-primary/20 bg-gradient-to-br from-primary/5 to-background',
      awaitingSecondConfirm && 'border-destructive/30 bg-gradient-to-br from-destructive/5 to-background'
    )}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <div className={cn(
            'rounded-full p-2',
            awaitingSecondConfirm ? 'bg-destructive/10' : 'bg-primary/10'
          )}>
            <Icon className={cn(
              'h-4 w-4',
              awaitingSecondConfirm ? 'text-destructive' : 'text-primary'
            )} />
          </div>
          <CardTitle className="text-sm font-semibold">
            {getActionLabel(proposal.action_type)}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{proposal.description}</p>

        {/* Detailed preview */}
        {previewText && (
          <div className={cn(
            'rounded-md border px-3 py-2 text-xs',
            isDestructive
              ? 'border-destructive/20 bg-destructive/5 text-destructive'
              : 'border-primary/20 bg-primary/5 text-foreground'
          )}>
            {previewText}
          </div>
        )}

        {/* 2-step confirmation warning */}
        {awaitingSecondConfirm && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <p className="text-xs text-destructive">
              This action cannot be undone. Are you sure you want to proceed?
            </p>
          </div>
        )}
        
        {proposal.entities.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Affected entities:</p>
            <div className="flex flex-wrap gap-1">
              {proposal.entities.slice(0, 8).map((entity, i) => (
                <Badge
                  key={`${entity.type}-${entity.id}-${i}`}
                  variant="secondary"
                  tabIndex={0}
                  role="button"
                  className={cn(
                    'cursor-pointer text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
                    ENTITY_COLORS[entity.type]
                  )}
                  onClick={() => handleEntityClick(entity)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleEntityClick(entity);
                    }
                  }}
                >
                  {entity.label}
                </Badge>
              ))}
              {proposal.entities.length > 8 && (
                <Badge variant="outline" className="text-xs">
                  +{proposal.entities.length - 8} more
                </Badge>
              )}
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter className="gap-3 pt-2">
        {!hasPermission ? (
          <Tooltip>
            <TooltipTrigger asChild>
              {confirmButton}
            </TooltipTrigger>
            <TooltipContent>
              <p>Your role does not have permission to execute this action</p>
            </TooltipContent>
          </Tooltip>
        ) : (
          confirmButton
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={awaitingSecondConfirm ? handleCancelSecondStep : () => onCancel(proposalId)}
          disabled={isLoading || isConfirming}
          aria-label={awaitingSecondConfirm ? 'Go back to review action' : `Cancel ${actionLabel}`}
        >
          <XCircle className="mr-1 h-4 w-4" />
          {awaitingSecondConfirm ? 'Go Back' : 'Cancel'}
        </Button>
      </CardFooter>
    </Card>
  );
}

// Parse ALL action blocks from AI response (supports multi-action responses)
export function parseActionsFromResponse(content: string): ActionProposalData[] {
  const matches = [...content.matchAll(/```action\s*([\s\S]*?)```/g)];

  if (matches.length === 0) {
    return [];
  }

  const actions: ActionProposalData[] = [];

  for (const match of matches) {
    try {
      const jsonStr = match[1].trim();
      const parsed = JSON.parse(jsonStr);

      if (!parsed.action_type || !parsed.description) {
        continue;
      }

      actions.push({
        action_type: parsed.action_type,
        description: parsed.description,
        entities: Array.isArray(parsed.entities) ? parsed.entities : [],
        params: parsed.params || {},
      });
    } catch (e) {
      logger.error('Failed to parse action block:', e);
    }
  }

  return actions;
}

/** @deprecated Use parseActionsFromResponse instead */
export function parseActionFromResponse(content: string): ActionProposalData | null {
  const actions = parseActionsFromResponse(content);
  return actions.length > 0 ? actions[0] : null;
}

// Remove action block from message content for display
export function stripActionBlock(content: string): string {
  return content.replace(/```action\s*[\s\S]*?```/g, '').trim();
}
