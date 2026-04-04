import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useOrg } from '@/contexts/OrgContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, X, Bell, Clock, AlertTriangle } from 'lucide-react';
import { currencySymbol } from '@/lib/utils';

interface PaymentReminderSettings {
  pre_due_enabled: boolean;
  pre_due_days: number;
  overdue_enabled: boolean;
  overdue_days: number;
  escalation_enabled: boolean;
  escalation_days: number;
  reminder_tone: 'friendly' | 'firm' | 'final_notice';
}

const DEFAULT_REMINDER_SETTINGS: PaymentReminderSettings = {
  pre_due_enabled: true,
  pre_due_days: 3,
  overdue_enabled: true,
  overdue_days: 1,
  escalation_enabled: true,
  escalation_days: 7,
  reminder_tone: 'friendly',
};

const TONE_LABELS: Record<PaymentReminderSettings['reminder_tone'], string> = {
  friendly: 'Friendly',
  firm: 'Firm',
  final_notice: 'Final notice',
};

const TONE_DESCRIPTIONS: Record<PaymentReminderSettings['reminder_tone'], string> = {
  friendly: 'Gentle reminder with a warm, understanding tone',
  firm: 'Professional and direct — clearly states the amount owed',
  final_notice: 'Urgent language indicating potential consequences',
};

const COMMON_REMINDER_PRESETS = [7, 14, 21, 30, 60, 90];

export function InvoiceSettingsTab() {
  const { currentOrg, isOrgAdmin, isOrgOwner } = useOrg();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const canEdit = isOrgOwner || isOrgAdmin;

  const queryKey = ['org-invoice-settings', currentOrg?.id];

  const { data: settingsData } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('organisations')
        .select('vat_enabled, vat_rate, vat_registration_number, default_payment_terms_days, overdue_reminder_days, default_plan_threshold_minor, default_plan_installments, default_plan_frequency, payment_reminder_settings')
        .eq('id', currentOrg!.id)
        .single();
      if (error) throw error;
      return data as any;
    },
    enabled: !!currentOrg?.id,
  });

  const [vatRegistered, setVatRegistered] = useState(false);
  const [vatNumber, setVatNumber] = useState('');
  const [vatRate, setVatRate] = useState('20');
  const [paymentTermsDays, setPaymentTermsDays] = useState(14);
  const [reminderDays, setReminderDays] = useState<number[]>([7, 14, 30]);
  const [customDay, setCustomDay] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const [planThreshold, setPlanThreshold] = useState('');
  const [planInstallments, setPlanInstallments] = useState('3');
  const [planFrequency, setPlanFrequency] = useState('monthly');
  const [reminderSettings, setReminderSettings] = useState<PaymentReminderSettings>(DEFAULT_REMINDER_SETTINGS);

  if (settingsData && !hydrated) {
    setVatRegistered(settingsData.vat_enabled || false);
    setVatRate(settingsData.vat_rate?.toString() || '20');
    setVatNumber(settingsData.vat_registration_number || '');
    setPaymentTermsDays(settingsData.default_payment_terms_days || 14);
    setReminderDays(
      (settingsData.overdue_reminder_days as number[] | null) || [7, 14, 30]
    );
    const sd = settingsData as any;
    setPlanThreshold(sd.default_plan_threshold_minor ? (sd.default_plan_threshold_minor / 100).toString() : '');
    setPlanInstallments((sd.default_plan_installments || 3).toString());
    setPlanFrequency(sd.default_plan_frequency || 'monthly');
    setReminderSettings({ ...DEFAULT_REMINDER_SETTINGS, ...(sd.payment_reminder_settings || {}) });
    setHydrated(true);
  }

  const updateReminder = <K extends keyof PaymentReminderSettings>(key: K, value: PaymentReminderSettings[K]) => {
    setReminderSettings(prev => ({ ...prev, [key]: value }));
  };

  const buildReminderScheduleText = () => {
    const parts: string[] = [];
    if (reminderSettings.pre_due_enabled) parts.push(`${reminderSettings.pre_due_days} day${reminderSettings.pre_due_days !== 1 ? 's' : ''} before due`);
    if (reminderSettings.overdue_enabled) parts.push(`${reminderSettings.overdue_days} day${reminderSettings.overdue_days !== 1 ? 's' : ''} overdue`);
    if (reminderSettings.escalation_enabled) parts.push(`${reminderSettings.escalation_days} day${reminderSettings.escalation_days !== 1 ? 's' : ''} overdue (escalation)`);
    return parts.length > 0 ? parts.join(' → ') : 'No reminders configured';
  };

  const addReminderDay = (day: number) => {
    if (day < 1 || day > 365) return;
    if (reminderDays.includes(day)) return;
    setReminderDays([...reminderDays, day].sort((a, b) => a - b));
  };

  const removeReminderDay = (day: number) => {
    setReminderDays(reminderDays.filter((d) => d !== day));
  };

  const handleAddCustomDay = () => {
    const day = parseInt(customDay);
    if (!isNaN(day) && day >= 1 && day <= 365) {
      addReminderDay(day);
      setCustomDay('');
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('organisations')
        .update({
          vat_enabled: vatRegistered,
          vat_rate: vatRegistered ? parseFloat(vatRate) : 0,
          vat_registration_number: vatRegistered ? vatNumber : null,
          default_payment_terms_days: paymentTermsDays,
          overdue_reminder_days: reminderDays,
          default_plan_threshold_minor: planThreshold ? Math.round(parseFloat(planThreshold) * 100) : null,
          default_plan_installments: parseInt(planInstallments) || 3,
          default_plan_frequency: planFrequency,
          payment_reminder_settings: reminderSettings,
        } as any)
        .eq('id', currentOrg!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({ title: 'Billing settings saved', description: 'Your billing preferences have been updated.' });
    },
    onError: (err: Error) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const availablePresets = COMMON_REMINDER_PRESETS.filter((d) => !reminderDays.includes(d));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invoice Settings</CardTitle>
        <CardDescription>Manage invoicing and payment preferences</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium">VAT Registered</div>
            <div className="text-sm text-muted-foreground">Include VAT on invoices</div>
          </div>
          <Switch checked={vatRegistered} onCheckedChange={setVatRegistered} disabled={!canEdit} />
        </div>
        {vatRegistered && (
          <>
            <div className="space-y-2">
              <Label htmlFor="vatNumber">VAT Number</Label>
              <Input
                id="vatNumber"
                placeholder="GB123456789"
                value={vatNumber}
                onChange={(e) => setVatNumber(e.target.value)}
                disabled={!canEdit}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vatRate">VAT Rate (%)</Label>
              <Input
                id="vatRate"
                type="number"
                placeholder="20"
                value={vatRate}
                onChange={(e) => setVatRate(e.target.value)}
                disabled={!canEdit}
              />
            </div>
          </>
        )}
        <Separator />
        <div className="space-y-2">
          <Label htmlFor="paymentTerms">Default Payment Terms (days)</Label>
          <Input
            id="paymentTerms"
            type="number"
            value={paymentTermsDays}
            onChange={(e) => setPaymentTermsDays(parseInt(e.target.value) || 14)}
            disabled={!canEdit}
          />
          <p className="text-xs text-muted-foreground">
            Number of days after invoice issue date for payment to be due
          </p>
        </div>

        <Separator />

        {/* Overdue Reminder Schedule */}
        <div className="space-y-3">
          <div>
            <Label className="text-base">Overdue Reminder Schedule</Label>
            <p className="text-sm text-muted-foreground mt-1">
              Automatic email reminders are sent to guardians on these days after an invoice becomes overdue. 
              Remove all to disable automatic reminders.
            </p>
          </div>

          {/* Current reminder days */}
          <div className="flex flex-wrap gap-2">
            {reminderDays.length === 0 && (
              <p className="text-sm text-muted-foreground italic">No reminders configured — guardians will not receive automatic overdue emails.</p>
            )}
            {reminderDays.map((day) => (
              <Badge
                key={day}
                variant="secondary"
                className="gap-1 pl-3 pr-1.5 py-1.5 text-sm"
              >
                Day {day}
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => removeReminderDay(day)}
                    className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20 transition-colors"
                    aria-label={`Remove day ${day} reminder`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </Badge>
            ))}
          </div>

          {/* Quick-add presets */}
          {canEdit && availablePresets.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-xs text-muted-foreground">Quick add:</span>
              <div className="flex flex-wrap gap-1.5">
                {availablePresets.map((day) => (
                  <Button
                    key={day}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 min-h-11 sm:min-h-9 text-xs gap-1"
                    onClick={() => addReminderDay(day)}
                  >
                    <Plus className="h-3 w-3" />
                    Day {day}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Custom day input */}
          {canEdit && (
            <div className="flex items-end gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="customReminderDay" className="text-xs">Custom day</Label>
                <Input
                  id="customReminderDay"
                  type="number"
                  min={1}
                  max={365}
                  placeholder="e.g. 45"
                  value={customDay}
                  onChange={(e) => setCustomDay(e.target.value)}
                  className="w-28 h-8"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddCustomDay();
                    }
                  }}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8"
                onClick={handleAddCustomDay}
                disabled={!customDay || isNaN(parseInt(customDay))}
              >
                Add
              </Button>
            </div>
          )}
        </div>
        <Separator />

        {/* Default Payment Plan */}
        <div className="space-y-3">
          <div>
            <Label className="text-base">Default Payment Plan</Label>
            <p className="text-sm text-muted-foreground mt-1">
              Pre-fill payment plan settings for billing runs and manual invoices.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="planThreshold">Auto-offer for invoices over ({currencySymbol(currentOrg?.currency_code || 'GBP')})</Label>
              <Input
                id="planThreshold"
                type="number"
                min={0}
                step="1"
                placeholder="Leave blank for no auto"
                value={planThreshold}
                onChange={(e) => setPlanThreshold(e.target.value)}
                disabled={!canEdit}
              />
            </div>
            <div className="space-y-2">
              <Label>Default Installments</Label>
              <Select value={planInstallments} onValueChange={setPlanInstallments} disabled={!canEdit}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[2, 3, 4, 6, 8, 10, 12].map((n) => (
                    <SelectItem key={n} value={n.toString()}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Default Frequency</Label>
              <Select value={planFrequency} onValueChange={setPlanFrequency} disabled={!canEdit}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="fortnightly">Fortnightly</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <Separator />

        {/* Payment Reminders */}
        <div className="space-y-4">
          <div>
            <Label className="text-base">Payment Reminders</Label>
            <p className="text-sm text-muted-foreground mt-1">
              Configure automatic email reminders for upcoming and overdue invoices. The cron jobs use these settings to determine when to send each reminder.
            </p>
          </div>

          {/* Pre-due reminder */}
          <div className="rounded-lg border border-border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="font-medium text-sm">Send reminder before due date</div>
                  <p className="text-xs text-muted-foreground">Gives parents a heads-up before payment is due</p>
                </div>
              </div>
              <Switch
                checked={reminderSettings.pre_due_enabled}
                onCheckedChange={(v) => updateReminder('pre_due_enabled', v)}
                disabled={!canEdit}
              />
            </div>
            {reminderSettings.pre_due_enabled && (
              <div className="flex items-center gap-2 pl-6">
                <Input
                  type="number"
                  min={1}
                  max={30}
                  value={reminderSettings.pre_due_days}
                  onChange={(e) => updateReminder('pre_due_days', Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-20 h-8"
                  disabled={!canEdit}
                />
                <span className="text-sm text-muted-foreground">days before due date</span>
              </div>
            )}
          </div>

          {/* Overdue reminder */}
          <div className="rounded-lg border border-border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="font-medium text-sm">Send overdue reminder</div>
                  <p className="text-xs text-muted-foreground">First nudge after the invoice becomes overdue</p>
                </div>
              </div>
              <Switch
                checked={reminderSettings.overdue_enabled}
                onCheckedChange={(v) => updateReminder('overdue_enabled', v)}
                disabled={!canEdit}
              />
            </div>
            {reminderSettings.overdue_enabled && (
              <div className="flex items-center gap-2 pl-6">
                <Input
                  type="number"
                  min={1}
                  max={60}
                  value={reminderSettings.overdue_days}
                  onChange={(e) => updateReminder('overdue_days', Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-20 h-8"
                  disabled={!canEdit}
                />
                <span className="text-sm text-muted-foreground">days after due date</span>
              </div>
            )}
          </div>

          {/* Escalation reminder */}
          <div className="rounded-lg border border-border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="font-medium text-sm">Send escalation reminder</div>
                  <p className="text-xs text-muted-foreground">Stronger follow-up for invoices still unpaid after the first reminder</p>
                </div>
              </div>
              <Switch
                checked={reminderSettings.escalation_enabled}
                onCheckedChange={(v) => updateReminder('escalation_enabled', v)}
                disabled={!canEdit}
              />
            </div>
            {reminderSettings.escalation_enabled && (
              <div className="flex items-center gap-2 pl-6">
                <Input
                  type="number"
                  min={1}
                  max={120}
                  value={reminderSettings.escalation_days}
                  onChange={(e) => updateReminder('escalation_days', Math.max(1, parseInt(e.target.value) || 7))}
                  className="w-20 h-8"
                  disabled={!canEdit}
                />
                <span className="text-sm text-muted-foreground">days after due date</span>
              </div>
            )}
          </div>

          {/* Reminder tone */}
          <div className="space-y-2">
            <Label>Reminder email tone</Label>
            <Select
              value={reminderSettings.reminder_tone}
              onValueChange={(v) => updateReminder('reminder_tone', v as PaymentReminderSettings['reminder_tone'])}
              disabled={!canEdit}
            >
              <SelectTrigger className="w-full max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(TONE_LABELS) as Array<PaymentReminderSettings['reminder_tone']>).map((tone) => (
                  <SelectItem key={tone} value={tone}>
                    <div>
                      <span>{TONE_LABELS[tone]}</span>
                      <span className="text-xs text-muted-foreground ml-2">— {TONE_DESCRIPTIONS[tone]}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Controls the language used in each reminder email template
            </p>
          </div>

          {/* Schedule preview */}
          {(reminderSettings.pre_due_enabled || reminderSettings.overdue_enabled || reminderSettings.escalation_enabled) && (
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-xs font-medium text-muted-foreground mb-1">Your reminder schedule</p>
              <p className="text-sm">{buildReminderScheduleText()}</p>
            </div>
          )}
        </div>

        {canEdit && (
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
