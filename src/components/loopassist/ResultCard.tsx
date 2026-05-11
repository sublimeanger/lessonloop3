import { CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EntityChip } from './EntityChip';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

interface ResultEntity {
  type: 'invoice' | 'student' | 'lesson' | 'guardian';
  id: string;
  label: string;
  detail?: string;
}

export interface ActionResult {
  action_type: string;
  status: string;
  summary: string;
  entities: ResultEntity[];
}

export function parseResultFromResponse(content: string): ActionResult | null {
  const match = content.match(/```result\s*([\s\S]*?)```/);
  if (!match) return null;
  try {
    return JSON.parse(match[1].trim());
  } catch {
    return null;
  }
}

export function stripResultBlock(content: string): string {
  return content.replace(/```result\s*[\s\S]*?```/g, '').trim();
}

// Explicit action_type → { url, label } map. The previous .includes-chain made
// send_invoice_reminders match `'invoice'` before `'reminder'`, so the "Review"
// button went to /invoices — but the messages are at /messages. World-class is
// each action knows exactly where its outcome lives.
const ACTION_CTA: Record<string, { url: string; label: string }> = {
  send_invoice_reminders: { url: '/messages?type=invoice_reminder', label: 'View in Messages →' },
  send_bulk_reminders:    { url: '/messages?type=invoice_reminder', label: 'View in Messages →' },
  draft_email:            { url: '/messages?status=draft',          label: 'Review draft in Messages →' },
  send_progress_report:   { url: '/messages?status=draft',          label: 'Review draft in Messages →' },
  generate_billing_run:   { url: '/invoices',                       label: 'View invoices →' },
  reschedule_lessons:     { url: '/calendar',                       label: 'View calendar →' },
  cancel_lesson:          { url: '/calendar',                       label: 'View calendar →' },
  complete_lessons:       { url: '/calendar',                       label: 'View calendar →' },
  bulk_complete_lessons:  { url: '/calendar',                       label: 'View calendar →' },
  mark_attendance:        { url: '/calendar',                       label: 'View calendar →' },
};

export function ResultCard({ result }: { result: ActionResult }) {
  const navigate = useNavigate();

  const cta = ACTION_CTA[result.action_type] ?? null;
  const ctaUrl = cta?.url ?? null;
  const ctaLabel = cta?.label ?? 'View →';

  return (
    <Card className="border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20">
      <CardHeader className="pb-2 pt-3 px-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
          <span className="text-foreground">{result.summary}</span>
        </CardTitle>
      </CardHeader>
      {result.entities.length > 0 && (
        <CardContent className="px-3 pb-3 pt-0">
          <div className="space-y-1.5">
            {result.entities.slice(0, 8).map((entity, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <EntityChip
                  type={entity.type}
                  id={entity.id}
                  label={entity.label}
                  className="text-micro"
                />
                {entity.detail && (
                  <span className="text-muted-foreground truncate">{entity.detail}</span>
                )}
              </div>
            ))}
            {result.entities.length > 8 && (
              <p className="text-xs text-muted-foreground pl-1">
                +{result.entities.length - 8} more
              </p>
            )}
            {ctaUrl && (
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0 text-xs"
                onClick={() => navigate(ctaUrl)}
              >
                {ctaLabel}
              </Button>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
