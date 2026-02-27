import { useState, useEffect } from 'react';
import { useOrg } from '@/contexts/OrgContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { ArrowRightLeft, Loader2 } from 'lucide-react';

export function ContinuationSettingsTab() {
  const { currentOrg, refreshOrganisations } = useOrg();
  const { toast } = useToast();

  const [noticeWeeks, setNoticeWeeks] = useState(
    (currentOrg as any)?.continuation_notice_weeks ?? 3
  );
  const [assumedContinuing, setAssumedContinuing] = useState(
    (currentOrg as any)?.continuation_assumed_continuing ?? true
  );
  const [reminderDays, setReminderDays] = useState(
    ((currentOrg as any)?.continuation_reminder_days ?? [7, 14]).join(', ')
  );
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (currentOrg) {
      setNoticeWeeks((currentOrg as any)?.continuation_notice_weeks ?? 3);
      setAssumedContinuing((currentOrg as any)?.continuation_assumed_continuing ?? true);
      setReminderDays(
        ((currentOrg as any)?.continuation_reminder_days ?? [7, 14]).join(', ')
      );
    }
  }, [currentOrg]);

  const parsedReminderDays = reminderDays
    .split(',')
    .map((s) => parseInt(s.trim()))
    .filter((n) => !isNaN(n) && n > 0);

  const hasChanges =
    noticeWeeks !== ((currentOrg as any)?.continuation_notice_weeks ?? 3) ||
    assumedContinuing !== ((currentOrg as any)?.continuation_assumed_continuing ?? true) ||
    JSON.stringify(parsedReminderDays) !==
      JSON.stringify((currentOrg as any)?.continuation_reminder_days ?? [7, 14]);

  const handleSave = async () => {
    if (!currentOrg) return;
    if (noticeWeeks < 1 || noticeWeeks > 12) {
      toast({ title: 'Notice period must be between 1 and 12 weeks', variant: 'destructive' });
      return;
    }
    if (parsedReminderDays.length === 0) {
      toast({ title: 'Please enter at least one reminder day', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    const { error } = await (supabase as any)
      .from('organisations')
      .update({
        continuation_notice_weeks: noticeWeeks,
        continuation_assumed_continuing: assumedContinuing,
        continuation_reminder_days: parsedReminderDays,
      })
      .eq('id', currentOrg.id);

    setIsSaving(false);
    if (error) {
      toast({ title: 'Error saving settings', variant: 'destructive' });
    } else {
      toast({ title: 'Continuation settings updated' });
      refreshOrganisations();
    }
  };

  const handleAssumedContinuingChange = async (checked: boolean) => {
    if (!currentOrg) return;
    setAssumedContinuing(checked);

    const { error } = await (supabase as any)
      .from('organisations')
      .update({ continuation_assumed_continuing: checked })
      .eq('id', currentOrg.id);

    if (error) {
      toast({ title: 'Error saving setting', variant: 'destructive' });
      setAssumedContinuing(!checked);
    } else {
      toast({ title: 'Setting updated' });
      refreshOrganisations();
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" />
            Continuation Defaults
          </CardTitle>
          <CardDescription>
            Configure default settings for term continuation runs. These can be overridden
            when creating individual runs.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Notice period */}
          <div className="space-y-2">
            <Label htmlFor="notice-weeks" className="font-medium">
              Default notice period
            </Label>
            <p className="text-sm text-muted-foreground">
              How many weeks before the end of term should the notice deadline default to?
            </p>
            <div className="flex items-center gap-2 mt-2">
              <Input
                id="notice-weeks"
                type="number"
                min={1}
                max={12}
                value={noticeWeeks}
                onChange={(e) => setNoticeWeeks(parseInt(e.target.value) || 3)}
                className="w-20"
              />
              <span className="text-sm text-muted-foreground">weeks before term ends</span>
            </div>
          </div>

          <Separator />

          {/* Assumed continuing */}
          <div className="flex items-center justify-between">
            <div>
              <Label className="font-medium">Assumed continuing</Label>
              <p className="text-sm text-muted-foreground mt-0.5">
                When enabled, students who don't respond by the deadline are assumed to be
                continuing. When disabled, they're marked as "no response".
              </p>
            </div>
            <Switch
              checked={assumedContinuing}
              onCheckedChange={handleAssumedContinuingChange}
            />
          </div>

          <Separator />

          {/* Reminder schedule */}
          <div className="space-y-2">
            <Label htmlFor="reminder-days" className="font-medium">
              Reminder schedule
            </Label>
            <p className="text-sm text-muted-foreground">
              Days after initial send to send reminders (comma-separated). For example, "7, 14"
              sends reminders 7 and 14 days after the initial notification.
            </p>
            <div className="flex items-center gap-2 mt-2">
              <Input
                id="reminder-days"
                value={reminderDays}
                onChange={(e) => setReminderDays(e.target.value)}
                placeholder="7, 14"
                className="w-40"
              />
              <span className="text-sm text-muted-foreground">days</span>
            </div>
            {parsedReminderDays.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Reminders at: {parsedReminderDays.join(', ')} days after initial send
              </p>
            )}
          </div>

          {/* Save button */}
          {hasChanges && (
            <>
              <Separator />
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
