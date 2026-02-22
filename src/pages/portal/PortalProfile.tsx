import { useState, useEffect } from 'react';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Loader2, LogOut, Save, Bell } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useOrg } from '@/contexts/OrgContext';
import { useGuardianInfo } from '@/hooks/useParentPortal';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

interface NotificationPrefs {
  email_lesson_reminders: boolean;
  email_invoice_reminders: boolean;
  email_payment_receipts: boolean;
  email_makeup_offers: boolean;
  email_marketing: boolean;
}

const defaultPrefs: NotificationPrefs = {
  email_lesson_reminders: true,
  email_invoice_reminders: true,
  email_payment_receipts: true,
  email_makeup_offers: true,
  email_marketing: true,
};

const prefLabels: { key: keyof NotificationPrefs; label: string; description: string }[] = [
  { key: 'email_lesson_reminders', label: 'Lesson reminders', description: 'Get reminded before upcoming lessons' },
  { key: 'email_invoice_reminders', label: 'Invoice alerts', description: 'Notifications about new and overdue invoices' },
  { key: 'email_payment_receipts', label: 'Payment receipts', description: 'Confirmation emails when payments are recorded' },
  { key: 'email_makeup_offers', label: 'Make-up lesson offers', description: 'Alerts when a make-up slot becomes available' },
  { key: 'email_marketing', label: 'News & updates', description: 'Occasional updates from the academy' },
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
  const [saving, setSaving] = useState(false);

  // Notification prefs state
  const [prefs, setPrefs] = useState<NotificationPrefs>(defaultPrefs);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [prefsDirty, setPrefsDirty] = useState(false);

  useEffect(() => {
    if (guardian) {
      setFullName(guardian.full_name || '');
      setPhone(guardian.phone || '');
    }
  }, [guardian]);

  // Fetch notification preferences
  const { data: savedPrefs, isLoading: prefsLoading } = useQuery({
    queryKey: ['notification-preferences', user?.id, currentOrg?.id],
    queryFn: async () => {
      if (!user || !currentOrg) return null;
      const { data, error } = await supabase
        .from('notification_preferences')
        .select('email_lesson_reminders, email_invoice_reminders, email_payment_receipts, email_makeup_offers, email_marketing')
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

    setSaving(true);
    try {
      const { error: guardianErr } = await supabase
        .from('guardians')
        .update({ full_name: fullName.trim(), phone: phone.trim() || null })
        .eq('id', guardian.id);
      if (guardianErr) throw guardianErr;

      const { error: profileErr } = await supabase
        .from('profiles')
        .update({ full_name: fullName.trim() })
        .eq('id', user.id);
      if (profileErr) throw profileErr;

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
        }, { onConflict: 'org_id,user_id' });
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
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 07700 900123"
              />
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

        {/* Notification Preferences */}
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
                {prefLabels.map(({ key, label, description }, i) => (
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
                    {i < prefLabels.length - 1 && <Separator />}
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
