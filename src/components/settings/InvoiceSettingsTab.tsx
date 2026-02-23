import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useOrg } from '@/contexts/OrgContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, X } from 'lucide-react';

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
      const { data, error } = await supabase
        .from('organisations')
        .select('vat_enabled, vat_rate, vat_registration_number, default_payment_terms_days, overdue_reminder_days')
        .eq('id', currentOrg!.id)
        .single();
      if (error) throw error;
      return data;
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

  if (settingsData && !hydrated) {
    setVatRegistered(settingsData.vat_enabled || false);
    setVatRate(settingsData.vat_rate?.toString() || '20');
    setVatNumber(settingsData.vat_registration_number || '');
    setPaymentTermsDays(settingsData.default_payment_terms_days || 14);
    setReminderDays(
      (settingsData.overdue_reminder_days as number[] | null) || [7, 14, 30]
    );
    setHydrated(true);
  }

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
        })
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
                    className="h-7 text-xs gap-1"
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
