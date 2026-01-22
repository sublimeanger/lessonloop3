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
import { useOrg } from '@/contexts/OrgContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

export default function Settings() {
  const { isOrgAdmin, isOrgOwner, currentOrg, refreshOrganisations } = useOrg();
  const { profile, updateProfile } = useAuth();
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
  const [paymentTerms, setPaymentTerms] = useState('14 days');

  // Sync profile data
  useEffect(() => {
    if (profile) {
      const nameParts = (profile.full_name || '').split(' ');
      setProfileFirstName(nameParts[0] || '');
      setProfileLastName(nameParts.slice(1).join(' ') || '');
      setProfilePhone(profile.phone || '');
      // Email comes from auth, not profile
    }
  }, [profile]);

  // Sync org data
  useEffect(() => {
    if (currentOrg) {
      setOrgName(currentOrg.name || '');
      // Address and billing fields would need to be fetched from org settings if they exist
    }
  }, [currentOrg]);

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
        .update({ name: orgName })
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
              <Separator />
              {vatRegistered && (
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
              )}
              <div className="space-y-2">
                <Label>Default Payment Terms</Label>
                <Input 
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  disabled={!isOrgOwner && !isOrgAdmin}
                />
              </div>
              {(isOrgOwner || isOrgAdmin) && (
                <Button disabled>
                  Save Changes
                </Button>
              )}
              <p className="text-xs text-muted-foreground">
                Billing settings are coming soon. These will be saved automatically.
              </p>
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
              {[
                { title: 'Lesson reminders', description: 'Get notified before upcoming lessons' },
                { title: 'Payment received', description: 'When an invoice is paid' },
                { title: 'New messages', description: 'When you receive a message' },
                { title: 'Cancellations', description: 'When a lesson is cancelled' },
              ].map((item) => (
                <div key={item.title} className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{item.title}</div>
                    <div className="text-sm text-muted-foreground">{item.description}</div>
                  </div>
                  <Switch defaultChecked />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
