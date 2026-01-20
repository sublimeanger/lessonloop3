import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Loader2, FileText, Mail, Calendar, Receipt } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

export interface ActionEntity {
  type: 'invoice' | 'student' | 'lesson' | 'guardian';
  id: string;
  label: string;
}

export interface ActionProposalData {
  action_type: 'generate_billing_run' | 'send_invoice_reminders' | 'reschedule_lessons' | 'draft_email';
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

const ACTION_ICONS = {
  generate_billing_run: Receipt,
  send_invoice_reminders: Mail,
  reschedule_lessons: Calendar,
  draft_email: FileText,
};

const ACTION_LABELS = {
  generate_billing_run: 'Generate Billing Run',
  send_invoice_reminders: 'Send Invoice Reminders',
  reschedule_lessons: 'Reschedule Lessons',
  draft_email: 'Draft Email',
};

const ENTITY_COLORS: Record<string, string> = {
  invoice: 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200',
  student: 'bg-blue-100 text-blue-800 hover:bg-blue-200',
  lesson: 'bg-purple-100 text-purple-800 hover:bg-purple-200',
  guardian: 'bg-amber-100 text-amber-800 hover:bg-amber-200',
};

export function ActionCard({ proposalId, proposal, onConfirm, onCancel, isLoading }: ActionCardProps) {
  const navigate = useNavigate();
  const [isConfirming, setIsConfirming] = useState(false);
  const Icon = ACTION_ICONS[proposal.action_type] || FileText;

  const handleConfirm = async () => {
    setIsConfirming(true);
    onConfirm(proposalId);
  };

  const handleEntityClick = (entity: ActionEntity) => {
    switch (entity.type) {
      case 'invoice':
        // Invoice number might be in label, try to extract ID or navigate to invoices
        navigate('/invoices');
        break;
      case 'student':
        navigate(`/students/${entity.id}`);
        break;
      case 'lesson':
        navigate('/calendar');
        break;
      case 'guardian':
        // No direct guardian page, could go to student or stay
        break;
    }
  };

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
                  className={cn(
                    'cursor-pointer text-xs transition-colors',
                    ENTITY_COLORS[entity.type]
                  )}
                  onClick={() => handleEntityClick(entity)}
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
      <CardFooter className="gap-2 pt-2">
        <Button
          size="sm"
          onClick={handleConfirm}
          disabled={isLoading || isConfirming}
          className="flex-1"
        >
          {isConfirming ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle className="mr-1 h-4 w-4" />
          )}
          Confirm
        </Button>
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
    
    // Validate required fields
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
    console.error('Failed to parse action block:', e);
    return null;
  }
}

// Remove action block from message content for display
export function stripActionBlock(content: string): string {
  return content.replace(/```action\s*[\s\S]*?```/g, '').trim();
}
