import { useState, useEffect } from 'react';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Loader2, LogOut, Save, Bell, Smartphone, AlertCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useOrg } from '@/contexts/OrgContext';
import { useGuardianInfo } from '@/hooks/useParentPortal';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { normalizeUkPhone, formatPhoneDisplay } from '@/lib/phone-utils';

interface NotificationPrefs {
  email_lesson_reminders: boolean;
  email_invoice_reminders: boolean;
  email_payment_receipts: boolean;
  email_makeup_offers: boolean;
  email_marketing: boolean;
  sms_lesson_reminders: boolean;
  sms_invoice_reminders: boolean;
  sms_payment_receipts: boolean;
  sms_lesson_cancellations: boolean;
}

const defaultPrefs: NotificationPrefs = {
  email_lesson_reminders: true,
  email_invoice_reminders: true,
  email_payment_receipts: true,
  email_makeup_offers: true,
  email_marketing: true,
  sms_lesson_reminders: false,
  sms_invoice_reminders: false,
  sms_payment_receipts: false,
  sms_lesson_cancellations: false,
};

const emailPrefLabels: { key: keyof NotificationPrefs; label: string; description: string }[] = [
  { key: 'email_lesson_reminders', label: 'Lesson reminders', description: 'Get reminded before upcoming lessons' },
  { key: 'email_invoice_reminders', label: 'Invoice alerts', description: 'Notifications about new and overdue invoices' },
  { key: 'email_payment_receipts', label: 'Payment receipts', description: 'Confirmation emails when payments are recorded' },
  { key: 'email_makeup_offers', label: 'Make-up lesson offers', description: 'Alerts when a make-up slot becomes available' },
  { key: 'email_marketing', label: 'News & updates', description: 'Occasional updates from the academy' },
];

const smsPrefLabels: { key: keyof NotificationPrefs; label: string; description: string }[] = [
  { key: 'sms_lesson_reminders', label: 'Lesson reminders', description: 'Text 24 hours before each lesson' },
  { key: 'sms_invoice_reminders', label: 'Invoice reminders', description: 'Text alerts for overdue invoices' },
  { key: 'sms_payment_receipts', label: 'Payment confirmations', description: 'Text when payments are recorded' },
  { key: 'sms_lesson_cancellations', label: 'Cancellation alerts', description: 'Immediate text when a lesson is cancelled' },
];

export default function PortalProfile() {
  const { user, profile, signOut } = useAuth();
  const { currentOrg } = useOrg();
  const { data: guardian, isLoading: guardianLoading } = useGuardianInfo();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Contact details state
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [saving, setSaving] = useState(false);

  // SMS opt-in state
  const [smsOptedIn, setSmsOptedIn] = useState(false);
  const [savingSmsOptin, setSavingSmsOptin] = useState(false);

  // Notification prefs state
  const [prefs, setPrefs] = useState<NotificationPrefs>(defaultPrefs);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [prefsDirty, setPrefsDirty] = useState(false);

  // Check if org has SMS enabled
  const { data: smsSettings } = useQuery({
    queryKey: ['org-sms-settings', currentOrg?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('org_sms_settings')
        .select('sms_enabled')
        .eq('org_id', currentOrg!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!currentOrg?.id,
  });

  const orgSmsEnabled = smsSettings?.sms_enabled === true;

  useEffect(() => {
    if (guardian) {
      setFullName(guardian.full_name || '');
      setPhone(guardian.phone ? formatPhoneDisplay(guardian.phone) : '');
      setSmsOptedIn((guardian as Record<string, unknown>).sms_opted_in === true);
    }
  }, [guardian]);

  // Fetch notification preferences
  const { data: savedPrefs, isLoading: prefsLoading } = useQuery({
    queryKey: ['notification-preferences', user?.id, currentOrg?.id],
    queryFn: async () => {
      if (!user || !currentOrg) return null;
      const { data, error } = await supabase
        .from('notification_preferences')
        .select('email_lesson_reminders, email_invoice_reminders, email_payment_receipts, email_makeup_offers, email_marketing, sms_lesson_reminders, sms_invoice_reminders, sms_payment_receipts, sms_lesson_cancellations')
        .eq('user_id', user.id)
        .eq('org_id', currentOrg.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!currentOrg,
  });

  // Hydrate prefs from server data
  useEffect(() => {
    if (savedPrefs) {
      setPrefs({
        email_lesson_reminders: savedPrefs.email_lesson_reminders,
        email_invoice_reminders: savedPrefs.email_invoice_reminders,
        email_payment_receipts: savedPrefs.email_payment_receipts,
        email_makeup_offers: savedPrefs.email_makeup_offers,
        email_marketing: savedPrefs.email_marketing,
        sms_lesson_reminders: savedPrefs.sms_lesson_reminders ?? false,
        sms_invoice_reminders: savedPrefs.sms_invoice_reminders ?? false,
        sms_payment_receipts: savedPrefs.sms_payment_receipts ?? false,
        sms_lesson_cancellations: savedPrefs.sms_lesson_cancellations ?? false,
      });
      setPrefsDirty(false);
    }
  }, [savedPrefs]);

  const togglePref = (key: keyof NotificationPrefs) => {
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
    setPrefsDirty(true);
  };

  const handleSave = async () => {
    if (!user || !guardian) return;
    if (!fullName.trim()) {
      toast({ title: 'Name is required', variant: 'destructive' });
      return;
    }

    // Validate phone if provided
    let normalizedPhone: string | null = null;
    const rawPhone = phone.trim();
    if (rawPhone) {
      normalizedPhone = normalizeUkPhone(rawPhone);
      if (!normalizedPhone) {
        setPhoneError('Invalid phone number. Use format: 07700 900123 or +447700900123');
        return;
      }
    }
    setPhoneError('');

    setSaving(true);
    try {
      const { error: guardianErr } = await supabase
        .from('guardians')
        .update({ full_name: fullName.trim(), phone: normalizedPhone })
        .eq('id', guardian.id);
      if (guardianErr) throw guardianErr;

      const { error: profileErr } = await supabase
        .from('profiles')
        .update({ full_name: fullName.trim() })
        .eq('id', user.id);
      if (profileErr) throw profileErr;

      if (normalizedPhone) {
        setPhone(formatPhoneDisplay(normalizedPhone));
      }

      queryClient.invalidateQueries({ queryKey: ['guardian-info'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast({ title: 'Profile updated' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast({ title: 'Failed to update profile', description: message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleSmsOptinToggle = async (value: boolean) => {
    if (!guardian) return;
    setSavingSmsOptin(true);
    try {
      const { error } = await supabase
        .from('guardians')
        .update({
          sms_opted_in: value,
          sms_opted_in_at: value ? new Date().toISOString() : null,
        } as Record<string, unknown>)
        .eq('id', guardian.id);
      if (error) throw error;
      setSmsOptedIn(value);
      queryClient.invalidateQueries({ queryKey: ['guardian-info'] });
      toast({ title: value ? 'SMS notifications enabled' : 'SMS notifications disabled' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast({ title: 'Failed to update SMS preference', description: message, variant: 'destructive' });
    } finally {
      setSavingSmsOptin(false);
    }
  };

  const handleSavePrefs = async () => {
    if (!user || !currentOrg) return;
    setSavingPrefs(true);
    try {
      const { error } = await supabase
        .from('notification_preferences')
        .upsert({
          user_id: user.id,
          org_id: currentOrg.id,
          ...prefs,
        } as Record<string, unknown>, { onConflict: 'org_id,user_id' });
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['notification-preferences'] });
      setPrefsDirty(false);
      toast({ title: 'Notification preferences saved' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast({ title: 'Failed to save preferences', description: message, variant: 'destructive' });
    } finally {
      setSavingPrefs(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  if (guardianLoading) {
    return (
      <PortalLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout>
      <PageHeader title="Profile" description="Manage your details and preferences" />

      <div className="max-w-lg space-y-6">
        {/* Contact Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Contact Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your full name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                value={profile?.email || guardian?.email || ''}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                Contact your academy to change your email address.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  setPhoneError('');
                }}
                placeholder="e.g. 07700 900123"
              />
              {phoneError && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {phoneError}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                UK mobile, e.g. 07700 900123 or +447700900123
              </p>
            </div>

            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save Changes
            </Button>
          </CardContent>
        </Card>

        {/* SMS Opt-in (only when org has SMS enabled and guardian has a phone) */}
        {orgSmsEnabled && phone.trim() && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Smartphone className="h-4 w-4" />
                SMS Notifications
              </CardTitle>
              <CardDescription>
                Receive text message alerts for lessons and invoices
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between py-2">
                <div className="space-y-0.5 pr-4">
                  <Label htmlFor="sms-optin" className="text-sm font-medium cursor-pointer">
                    Receive SMS notifications
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Get text message alerts to your phone number. Standard message rates may apply.
                  </p>
                </div>
                <Switch
                  id="sms-optin"
                  checked={smsOptedIn}
                  onCheckedChange={handleSmsOptinToggle}
                  disabled={savingSmsOptin}
                />
              </div>

              {smsOptedIn && (
                <>
                  <Separator />
                  <p className="text-xs text-muted-foreground">
                    Choose which SMS notifications you'd like to receive:
                  </p>
                  {smsPrefLabels.map(({ key, label, description }, i) => (
                    <div key={key}>
                      <div className="flex items-center justify-between py-2">
                        <div className="space-y-0.5 pr-4">
                          <Label htmlFor={key} className="text-sm font-medium cursor-pointer">
                            {label}
                          </Label>
                          <p className="text-xs text-muted-foreground">{description}</p>
                        </div>
                        <Switch
                          id={key}
                          checked={prefs[key]}
                          onCheckedChange={() => togglePref(key)}
                        />
                      </div>
                      {i < smsPrefLabels.length - 1 && <Separator />}
                    </div>
                  ))}
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Email Notification Preferences */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Email Notifications
            </CardTitle>
            <CardDescription>
              Choose which emails you'd like to receive
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            {prefsLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                {emailPrefLabels.map(({ key, label, description }, i) => (
                  <div key={key}>
                    <div className="flex items-center justify-between py-3">
                      <div className="space-y-0.5 pr-4">
                        <Label htmlFor={key} className="text-sm font-medium cursor-pointer">
                          {label}
                        </Label>
                        <p className="text-xs text-muted-foreground">{description}</p>
                      </div>
                      <Switch
                        id={key}
                        checked={prefs[key]}
                        onCheckedChange={() => togglePref(key)}
                      />
                    </div>
                    {i < emailPrefLabels.length - 1 && <Separator />}
                  </div>
                ))}

                <Button
                  onClick={handleSavePrefs}
                  disabled={savingPrefs || !prefsDirty}
                  variant={prefsDirty ? 'default' : 'outline'}
                  className="w-full mt-4"
                >
                  {savingPrefs ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  {prefsDirty ? 'Save Preferences' : 'Preferences Saved'}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Sign Out */}
        <Card>
          <CardContent className="pt-6">
            <Button
              variant="outline"
              onClick={handleSignOut}
              className="w-full text-destructive hover:text-destructive"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </CardContent>
        </Card>
      </div>
    </PortalLayout>
  );
}
