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
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useOrg } from '@/contexts/OrgContext';
import { cn } from '@/lib/utils';
import type { AppRole } from '@/contexts/AuthContext';

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
    | 'send_progress_report';
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

const ACTION_ICONS: Record<string, typeof FileText> = {
  generate_billing_run: Receipt,
  send_invoice_reminders: Mail,
  reschedule_lessons: Calendar,
  draft_email: FileText,
  mark_attendance: ClipboardCheck,
  cancel_lesson: Ban,
  complete_lessons: CheckCircle2,
  send_progress_report: FileText,
};

const ACTION_LABELS: Record<string, string> = {
  generate_billing_run: 'Generate Billing Run',
  send_invoice_reminders: 'Send Invoice Reminders',
  reschedule_lessons: 'Reschedule Lessons',
  draft_email: 'Draft Email',
  mark_attendance: 'Mark Attendance',
  cancel_lesson: 'Cancel Lesson',
  complete_lessons: 'Mark Lessons Complete',
  send_progress_report: 'Send Progress Report',
};

const ACTION_ROLE_PERMISSIONS: Record<string, AppRole[]> = {
  generate_billing_run: ['owner', 'admin', 'finance'],
  send_invoice_reminders: ['owner', 'admin', 'finance'],
  reschedule_lessons: ['owner', 'admin', 'teacher'],
  draft_email: ['owner', 'admin', 'teacher'],
  mark_attendance: ['owner', 'admin', 'teacher'],
  cancel_lesson: ['owner', 'admin'],
  complete_lessons: ['owner', 'admin', 'teacher'],
  send_progress_report: ['owner', 'admin', 'teacher'],
};

const ENTITY_COLORS: Record<string, string> = {
  invoice: 'bg-success/10 text-success hover:bg-success/20 dark:bg-success/20 dark:text-success dark:hover:bg-success/30',
  student: 'bg-primary/10 text-primary hover:bg-primary/20 dark:bg-primary/20 dark:text-primary dark:hover:bg-primary/30',
  lesson: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
  guardian: 'bg-warning/10 text-warning hover:bg-warning/20 dark:bg-warning/20 dark:text-warning dark:hover:bg-warning/30',
};

export function ActionCard({ proposalId, proposal, onConfirm, onCancel, isLoading }: ActionCardProps) {
  const navigate = useNavigate();
  const { currentRole } = useOrg();
  const [isConfirming, setIsConfirming] = useState(false);
  const Icon = ACTION_ICONS[proposal.action_type] || FileText;

  const allowedRoles = ACTION_ROLE_PERMISSIONS[proposal.action_type] || ['owner', 'admin'];
  const hasPermission = currentRole ? allowedRoles.includes(currentRole) : false;

  const handleConfirm = async () => {
    setIsConfirming(true);
    onConfirm(proposalId);
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

  const confirmButton = (
    <Button
      size="sm"
      onClick={handleConfirm}
      disabled={isLoading || isConfirming || !hasPermission}
      className="flex-1"
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
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-background">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <div className="rounded-full bg-primary/10 p-2">
            <Icon className="h-4 w-4 text-primary" />
          </div>
          <CardTitle className="text-sm font-semibold">
            {ACTION_LABELS[proposal.action_type] || proposal.action_type}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{proposal.description}</p>
        
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
          onClick={() => onCancel(proposalId)}
          disabled={isLoading || isConfirming}
        >
          <XCircle className="mr-1 h-4 w-4" />
          Cancel
        </Button>
      </CardFooter>
    </Card>
  );
}

// Parse action block from AI response
export function parseActionFromResponse(content: string): ActionProposalData | null {
  const actionBlockMatch = content.match(/```action\s*([\s\S]*?)```/);
  
  if (!actionBlockMatch) {
    return null;
  }

  try {
    const jsonStr = actionBlockMatch[1].trim();
    const parsed = JSON.parse(jsonStr);
    
    if (!parsed.action_type || !parsed.description) {
      return null;
    }

    return {
      action_type: parsed.action_type,
      description: parsed.description,
      entities: Array.isArray(parsed.entities) ? parsed.entities : [],
      params: parsed.params || {},
    };
  } catch (e) {
    logger.error('Failed to parse action block:', e);
    return null;
  }
}

// Remove action block from message content for display
export function stripActionBlock(content: string): string {
  return content.replace(/```action\s*[\s\S]*?```/g, '').trim();
}
