import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Loader2, Smartphone, AlertCircle, CheckCircle2, MessageSquare } from 'lucide-react';
import { useSmsSettings } from '@/hooks/useSmsSettings';
import { useFeatureGate } from '@/hooks/useFeatureGate';
import { useOrg } from '@/contexts/OrgContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { isValidE164, normalizeUkPhone, formatPhoneDisplay } from '@/lib/phone-utils';

export function SmsSettingsTab() {
  const { hasAccess, requiredPlanName } = useFeatureGate('sms_notifications');
  const { settings, isLoading, updateSettings, isSaving } = useSmsSettings();
  const { currentOrg } = useOrg();
  const [phoneInput, setPhoneInput] = useState('');
  const [phoneError, setPhoneError] = useState('');

  // Fetch recent SMS log
  const { data: smsLog = [] } = useQuery({
    queryKey: ['sms-log', currentOrg?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('message_log')
        .select('id, recipient_phone, recipient_name, message_type, status, created_at, error_message')
        .eq('org_id', currentOrg!.id)
        .eq('channel', 'sms')
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!currentOrg?.id && settings.sms_enabled,
    staleTime: 30_000,
  });

  if (!hasAccess) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Smartphone className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">SMS Notifications</h3>
          <p className="text-muted-foreground mb-4">
            Send text message reminders and alerts to parents. Available on the{' '}
            <strong>{requiredPlanName}</strong> plan and above.
          </p>
          <Button variant="outline" onClick={() => window.location.href = '/settings?tab=billing'}>
            Upgrade Plan
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const usagePercent = settings.monthly_sms_limit > 0
    ? Math.round((settings.sms_sent_this_month / settings.monthly_sms_limit) * 100)
    : 0;

  const handlePhoneSave = () => {
    if (!phoneInput.trim()) {
      updateSettings({ twilio_phone_number: null });
      setPhoneError('');
      return;
    }
    const normalized = normalizeUkPhone(phoneInput);
    if (!normalized) {
      setPhoneError('Invalid phone number. Use E.164 format, e.g. +447868277099');
      return;
    }
    setPhoneError('');
    updateSettings({ twilio_phone_number: normalized });
    setPhoneInput(formatPhoneDisplay(normalized));
  };

  return (
    <div className="space-y-6">
      {/* Enable / Disable SMS */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">SMS Notifications</CardTitle>
          </div>
          <CardDescription>
            Send text message reminders and alerts to parents and guardians.
            SMS is complementary to email — parents must opt in.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-0.5">
              <Label htmlFor="sms-enabled" className="text-sm font-medium cursor-pointer">
                Enable SMS notifications
              </Label>
              <p className="text-xs text-muted-foreground">
                When enabled, parents can opt into receiving text messages for lesson reminders,
                invoice alerts, and cancellation notices.
              </p>
            </div>
            <Switch
              id="sms-enabled"
              checked={settings.sms_enabled}
              onCheckedChange={(v) => updateSettings({ sms_enabled: v })}
              disabled={isSaving}
            />
          </div>

          {settings.sms_enabled && (
            <>
              {/* Twilio Phone Number */}
              <div className="space-y-2">
                <Label htmlFor="twilio-phone">Twilio sending phone number</Label>
                <div className="flex gap-2">
                  <Input
                    id="twilio-phone"
                    value={phoneInput || (settings.twilio_phone_number ? formatPhoneDisplay(settings.twilio_phone_number) : '')}
                    onChange={(e) => {
                      setPhoneInput(e.target.value);
                      setPhoneError('');
                    }}
                    placeholder="+447868277099"
                    className="max-w-xs"
                  />
                  <Button
                    variant="outline"
                    onClick={handlePhoneSave}
                    disabled={isSaving}
                  >
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
                  </Button>
                </div>
                {phoneError && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {phoneError}
                  </p>
                )}
                {settings.twilio_phone_number && !phoneError && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                    Sending from {formatPhoneDisplay(settings.twilio_phone_number)}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Enter the Twilio phone number purchased for your organisation in E.164 format.
                </p>
              </div>

              {/* Monthly Usage */}
              <div className="space-y-2">
                <Label>Monthly SMS usage</Label>
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span>{settings.sms_sent_this_month} / {settings.monthly_sms_limit} messages</span>
                    <span className="text-muted-foreground">{usagePercent}%</span>
                  </div>
                  <Progress value={usagePercent} className="h-2" />
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Recent SMS Log */}
      {settings.sms_enabled && smsLog.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Recent SMS Messages</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {smsLog.map((msg) => (
                <div key={msg.id} className="flex items-center justify-between py-2 border-b last:border-b-0">
                  <div className="space-y-0.5">
                    <div className="text-sm font-medium">{msg.recipient_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {msg.recipient_phone} &middot; {msg.message_type.replace(/_/g, ' ')}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={msg.status === 'sent' ? 'default' : msg.status === 'failed' ? 'destructive' : 'secondary'}>
                      {msg.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(msg.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
