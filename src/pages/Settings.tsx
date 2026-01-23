import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { OrgMembersTab } from '@/components/settings/OrgMembersTab';
import { SchedulingSettingsTab } from '@/components/settings/SchedulingSettingsTab';
import AuditLogTab from '@/components/settings/AuditLogTab';
import { PrivacyTab } from '@/components/settings/PrivacyTab';
import { RateCardsTab } from '@/components/settings/RateCardsTab';
import { useOrg } from '@/contexts/OrgContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

interface NotificationPreferences {
  email_lesson_reminders: boolean;
  email_invoice_reminders: boolean;
  email_payment_receipts: boolean;
  email_marketing: boolean;
}

export default function Settings() {
  const { isOrgAdmin, isOrgOwner, currentOrg, refreshOrganisations } = useOrg();
  const { profile, updateProfile, user } = useAuth();
  const { toast } = useToast();
  
  // Profile form state
  const [profileFirstName, setProfileFirstName] = useState('');
  const [profileLastName, setProfileLastName] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  
  // Organisation form state
  const [orgName, setOrgName] = useState('');
  const [orgAddress, setOrgAddress] = useState('');
  const [orgSaving, setOrgSaving] = useState(false);

  // Billing settings state
  const [vatRegistered, setVatRegistered] = useState(false);
  const [vatNumber, setVatNumber] = useState('');
  const [vatRate, setVatRate] = useState('20');
  const [paymentTermsDays, setPaymentTermsDays] = useState(14);
  const [billingSaving, setBillingSaving] = useState(false);

  // Notification preferences state
  const [notifPrefs, setNotifPrefs] = useState<NotificationPreferences>({
    email_lesson_reminders: true,
    email_invoice_reminders: true,
    email_payment_receipts: true,
    email_marketing: false,
  });
  const [notifSaving, setNotifSaving] = useState(false);

  // Sync profile data
  useEffect(() => {
    if (profile) {
      const nameParts = (profile.full_name || '').split(' ');
      setProfileFirstName(nameParts[0] || '');
      setProfileLastName(nameParts.slice(1).join(' ') || '');
      setProfilePhone(profile.phone || '');
    }
  }, [profile]);

  // Sync org data including billing fields
  useEffect(() => {
    const fetchOrgDetails = async () => {
      if (!currentOrg) return;
      
      const { data } = await supabase
        .from('organisations')
        .select('name, address, vat_enabled, vat_rate, vat_registration_number, default_payment_terms_days')
        .eq('id', currentOrg.id)
        .single();
      
      if (data) {
        setOrgName(data.name || '');
        setOrgAddress(data.address || '');
        setVatRegistered(data.vat_enabled || false);
        setVatRate(data.vat_rate?.toString() || '20');
        setVatNumber(data.vat_registration_number || '');
        setPaymentTermsDays(data.default_payment_terms_days || 14);
      }
    };
    
    fetchOrgDetails();
  }, [currentOrg]);

  // Fetch notification preferences
  useEffect(() => {
    const fetchNotifPrefs = async () => {
      if (!currentOrg || !user) return;
      
      const { data } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('org_id', currentOrg.id)
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (data) {
        setNotifPrefs({
          email_lesson_reminders: data.email_lesson_reminders,
          email_invoice_reminders: data.email_invoice_reminders,
          email_payment_receipts: data.email_payment_receipts,
          email_marketing: data.email_marketing,
        });
      }
    };
    
    fetchNotifPrefs();
  }, [currentOrg, user]);

  // Fetch user email
  useEffect(() => {
    const getEmail = async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user?.email) {
        setProfileEmail(data.user.email);
      }
    };
    getEmail();
  }, []);

  const handleSaveProfile = async () => {
    setProfileSaving(true);
    try {
      const fullName = `${profileFirstName} ${profileLastName}`.trim();
      await updateProfile({ full_name: fullName, phone: profilePhone });
      toast({ title: 'Profile updated', description: 'Your profile has been saved.' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setProfileSaving(false);
    }
  };

  const handleSaveOrganisation = async () => {
    if (!currentOrg) return;
    setOrgSaving(true);
    try {
      const { error } = await supabase
        .from('organisations')
        .update({ name: orgName, address: orgAddress })
        .eq('id', currentOrg.id);
      
      if (error) throw error;
      
      await refreshOrganisations();
      toast({ title: 'Organisation updated', description: 'Your organisation has been saved.' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setOrgSaving(false);
    }
  };

  const handleSaveBilling = async () => {
    if (!currentOrg) return;
    setBillingSaving(true);
    try {
      const { error } = await supabase
        .from('organisations')
        .update({
          vat_enabled: vatRegistered,
          vat_rate: vatRegistered ? parseFloat(vatRate) : null,
          vat_registration_number: vatRegistered ? vatNumber : null,
          default_payment_terms_days: paymentTermsDays,
        })
        .eq('id', currentOrg.id);
      
      if (error) throw error;
      
      toast({ title: 'Billing settings saved', description: 'Your billing preferences have been updated.' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setBillingSaving(false);
    }
  };

  const handleSaveNotifications = async () => {
    if (!currentOrg || !user) return;
    setNotifSaving(true);
    try {
      const { error } = await supabase
        .from('notification_preferences')
        .upsert({
          org_id: currentOrg.id,
          user_id: user.id,
          ...notifPrefs,
        }, { onConflict: 'org_id,user_id' });
      
      if (error) throw error;
      
      toast({ title: 'Notifications saved', description: 'Your notification preferences have been updated.' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setNotifSaving(false);
    }
  };
  
  return (
    <AppLayout>
      <PageHeader
        title="Settings"
        description="Manage your account and preferences"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Settings' },
        ]}
      />

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="organisation">Organisation</TabsTrigger>
          {(isOrgAdmin || isOrgOwner) && (
            <TabsTrigger value="members">Members</TabsTrigger>
          )}
          {(isOrgAdmin || isOrgOwner) && (
            <TabsTrigger value="scheduling">Scheduling</TabsTrigger>
          )}
          {(isOrgAdmin || isOrgOwner) && (
            <TabsTrigger value="audit">Audit Log</TabsTrigger>
          )}
          {(isOrgAdmin || isOrgOwner) && (
            <TabsTrigger value="privacy">Privacy & GDPR</TabsTrigger>
          )}
          {(isOrgAdmin || isOrgOwner) && (
            <TabsTrigger value="rate-cards">Rate Cards</TabsTrigger>
          )}
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>Update your personal details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First name</Label>
                  <Input 
                    id="firstName" 
                    value={profileFirstName}
                    onChange={(e) => setProfileFirstName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last name</Label>
                  <Input 
                    id="lastName" 
                    value={profileLastName}
                    onChange={(e) => setProfileLastName(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input 
                  id="email" 
                  type="email" 
                  value={profileEmail} 
                  disabled 
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  Email cannot be changed here. Contact support if you need to update it.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input 
                  id="phone" 
                  type="tel" 
                  value={profilePhone}
                  onChange={(e) => setProfilePhone(e.target.value)}
                  placeholder="+44 7700 900000"
                />
              </div>
              <Button onClick={handleSaveProfile} disabled={profileSaving}>
                {profileSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save Changes
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="organisation">
          <Card>
            <CardHeader>
              <CardTitle>Organisation Details</CardTitle>
              <CardDescription>Manage your teaching business information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="orgName">Organisation name</Label>
                <Input 
                  id="orgName" 
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  disabled={!isOrgOwner && !isOrgAdmin}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input 
                  id="address" 
                  placeholder="Enter your business address"
                  value={orgAddress}
                  onChange={(e) => setOrgAddress(e.target.value)}
                  disabled={!isOrgOwner && !isOrgAdmin}
                />
              </div>
              <Separator />
              <div>
                <h4 className="mb-4 text-sm font-medium">Regional Settings</h4>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Currency</Label>
                    <Input value={currentOrg?.currency_code || 'GBP'} disabled className="bg-muted" />
                  </div>
                  <div className="space-y-2">
                    <Label>Timezone</Label>
                    <Input value={currentOrg?.timezone || 'Europe/London'} disabled className="bg-muted" />
                  </div>
                </div>
              </div>
              {(isOrgOwner || isOrgAdmin) && (
                <Button onClick={handleSaveOrganisation} disabled={orgSaving}>
                  {orgSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Save Changes
                </Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {(isOrgAdmin || isOrgOwner) && (
          <TabsContent value="members">
            <OrgMembersTab />
          </TabsContent>
        )}

        {(isOrgAdmin || isOrgOwner) && (
          <TabsContent value="scheduling">
            <SchedulingSettingsTab />
          </TabsContent>
        )}

        {(isOrgAdmin || isOrgOwner) && (
          <TabsContent value="audit">
            <AuditLogTab />
          </TabsContent>
        )}

        {(isOrgAdmin || isOrgOwner) && (
          <TabsContent value="privacy">
            <PrivacyTab />
          </TabsContent>
        )}

        {(isOrgAdmin || isOrgOwner) && (
          <TabsContent value="rate-cards">
            <RateCardsTab />
          </TabsContent>
        )}

        <TabsContent value="billing">
          <Card>
            <CardHeader>
              <CardTitle>Billing Settings</CardTitle>
              <CardDescription>Manage invoicing and payment preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">VAT Registered</div>
                  <div className="text-sm text-muted-foreground">
                    Include VAT on invoices
                  </div>
                </div>
                <Switch 
                  checked={vatRegistered}
                  onCheckedChange={setVatRegistered}
                  disabled={!isOrgOwner && !isOrgAdmin}
                />
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
                      disabled={!isOrgOwner && !isOrgAdmin}
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
                      disabled={!isOrgOwner && !isOrgAdmin}
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
                  disabled={!isOrgOwner && !isOrgAdmin}
                />
                <p className="text-xs text-muted-foreground">
                  Number of days after invoice issue date for payment to be due
                </p>
              </div>
              {(isOrgOwner || isOrgAdmin) && (
                <Button onClick={handleSaveBilling} disabled={billingSaving}>
                  {billingSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Save Changes
                </Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>Choose what notifications you receive</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Lesson reminders</div>
                  <div className="text-sm text-muted-foreground">Get notified before upcoming lessons</div>
                </div>
                <Switch 
                  checked={notifPrefs.email_lesson_reminders}
                  onCheckedChange={(checked) => setNotifPrefs(prev => ({ ...prev, email_lesson_reminders: checked }))}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Invoice reminders</div>
                  <div className="text-sm text-muted-foreground">Reminders for unpaid invoices</div>
                </div>
                <Switch 
                  checked={notifPrefs.email_invoice_reminders}
                  onCheckedChange={(checked) => setNotifPrefs(prev => ({ ...prev, email_invoice_reminders: checked }))}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Payment receipts</div>
                  <div className="text-sm text-muted-foreground">Confirmation when an invoice is paid</div>
                </div>
                <Switch 
                  checked={notifPrefs.email_payment_receipts}
                  onCheckedChange={(checked) => setNotifPrefs(prev => ({ ...prev, email_payment_receipts: checked }))}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Marketing emails</div>
                  <div className="text-sm text-muted-foreground">Product updates and tips</div>
                </div>
                <Switch 
                  checked={notifPrefs.email_marketing}
                  onCheckedChange={(checked) => setNotifPrefs(prev => ({ ...prev, email_marketing: checked }))}
                />
              </div>
              <Button onClick={handleSaveNotifications} disabled={notifSaving}>
                {notifSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save Preferences
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
