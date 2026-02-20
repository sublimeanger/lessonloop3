import { useState, useEffect, useRef, ChangeEvent, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { OrgMembersTab } from '@/components/settings/OrgMembersTab';
import { SchedulingSettingsTab } from '@/components/settings/SchedulingSettingsTab';
import AuditLogTab from '@/components/settings/AuditLogTab';
import { PrivacyTab } from '@/components/settings/PrivacyTab';
import { RateCardsTab } from '@/components/settings/RateCardsTab';
import { TeacherAvailabilityTab } from '@/components/settings/TeacherAvailabilityTab';
import { BillingTab } from '@/components/settings/BillingTab';
import { HelpToursTab } from '@/components/settings/HelpToursTab';
import { CalendarIntegrationsTab } from '@/components/settings/CalendarIntegrationsTab';
import { useOrg } from '@/contexts/OrgContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useIsMobile } from '@/hooks/use-mobile';
import { Loader2, Upload, X, LogOut, ShieldAlert } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface NotificationPreferences {
  email_lesson_reminders: boolean;
  email_invoice_reminders: boolean;
  email_payment_receipts: boolean;
  email_marketing: boolean;
}

// ─── Tab bar with horizontal scroll + gradient fade on mobile ───
function MobileTabBar({ initialTab, isOrgAdmin, isOrgOwner }: { initialTab: string; isOrgAdmin: boolean; isOrgOwner: boolean }) {
  const isMobile = useIsMobile();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showFade, setShowFade] = useState(true);

  // Auto-scroll active tab into view on mount
  useEffect(() => {
    if (!isMobile || !scrollRef.current) return;
    const activeTab = scrollRef.current.querySelector('[data-state="active"]') as HTMLElement | null;
    if (activeTab) {
      activeTab.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [isMobile, initialTab]);

  // Track scroll position to show/hide fade
  useEffect(() => {
    if (!isMobile) return;
    const el = scrollRef.current;
    if (!el) return;
    const handleScroll = () => {
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 8;
      setShowFade(!atEnd);
    };
    el.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => el.removeEventListener('scroll', handleScroll);
  }, [isMobile]);

  const tabs = (
    <>
      <TabsTrigger value="profile">Profile</TabsTrigger>
      <TabsTrigger value="organisation">Organisation</TabsTrigger>
      {(isOrgAdmin || isOrgOwner) && <TabsTrigger value="members">Members</TabsTrigger>}
      {(isOrgAdmin || isOrgOwner) && <TabsTrigger value="scheduling">Scheduling</TabsTrigger>}
      {(isOrgAdmin || isOrgOwner) && <TabsTrigger value="audit">Audit Log</TabsTrigger>}
      {(isOrgAdmin || isOrgOwner) && <TabsTrigger value="privacy">Privacy &amp; GDPR</TabsTrigger>}
      {(isOrgAdmin || isOrgOwner) && <TabsTrigger value="rate-cards">Rate Cards</TabsTrigger>}
      <TabsTrigger value="availability">Availability</TabsTrigger>
      <TabsTrigger value="calendar">Calendar Sync</TabsTrigger>
      <TabsTrigger value="billing">Billing</TabsTrigger>
      <TabsTrigger value="notifications">Notifications</TabsTrigger>
      <TabsTrigger value="help-tours">Help &amp; Tours</TabsTrigger>
    </>
  );

  if (!isMobile) {
    return (
      <TabsList className="w-full overflow-x-auto flex-nowrap justify-start h-auto gap-1 scrollbar-hide">
        {tabs}
      </TabsList>
    );
  }

  return (
    <div className="relative">
      <TabsList
        ref={scrollRef}
        className="w-full overflow-x-auto flex-nowrap justify-start h-auto gap-1 scrollbar-hide scroll-smooth snap-x snap-mandatory"
      >
        {tabs}
      </TabsList>
      {/* Right gradient fade indicator */}
      {showFade && (
        <div className="absolute right-0 top-0 bottom-0 w-8 pointer-events-none bg-gradient-to-l from-background to-transparent z-10 rounded-r-md" />
      )}
    </div>
  );
}

export default function Settings() {
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'profile';
  
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
  
  // Branding form state
  const [invoiceFromName, setInvoiceFromName] = useState('');
  const [invoiceFooterNote, setInvoiceFooterNote] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);

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
  const [globalSignOutLoading, setGlobalSignOutLoading] = useState(false);

  // Sync profile data
  useEffect(() => {
    if (profile) {
      const nameParts = (profile.full_name || '').split(' ');
      setProfileFirstName(nameParts[0] || '');
      setProfileLastName(nameParts.slice(1).join(' ') || '');
      setProfilePhone(profile.phone || '');
    }
  }, [profile]);

  // Sync org data including billing and branding fields
  useEffect(() => {
    const fetchOrgDetails = async () => {
      if (!currentOrg) return;
      
      const { data } = await supabase
        .from('organisations')
        .select('name, address, vat_enabled, vat_rate, vat_registration_number, default_payment_terms_days, invoice_from_name, invoice_footer_note, logo_url')
        .eq('id', currentOrg.id)
        .single();
      
      if (data) {
        setOrgName(data.name || '');
        setOrgAddress(data.address || '');
        setVatRegistered(data.vat_enabled || false);
        setVatRate(data.vat_rate?.toString() || '20');
        setVatNumber(data.vat_registration_number || '');
        setPaymentTermsDays(data.default_payment_terms_days || 14);
        setInvoiceFromName(data.invoice_from_name || '');
        setInvoiceFooterNote(data.invoice_footer_note || '');
        setLogoUrl(data.logo_url || null);
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
        .update({ 
          name: orgName, 
          address: orgAddress,
          invoice_from_name: invoiceFromName || null,
          invoice_footer_note: invoiceFooterNote || null,
        })
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

  const handleLogoUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !currentOrg) return;
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Invalid file', description: 'Please upload an image file', variant: 'destructive' });
      return;
    }
    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Logo must be under 2MB', variant: 'destructive' });
      return;
    }

    setLogoUploading(true);
    const fileExt = file.name.split('.').pop();
    const filePath = `${currentOrg.id}/logo-${Date.now()}.${fileExt}`;
    
    try {
      const { error: uploadError } = await supabase.storage
        .from('org-logos')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('org-logos').getPublicUrl(filePath);
      const publicUrl = urlData.publicUrl;

      const { error: updateError } = await supabase
        .from('organisations')
        .update({ logo_url: publicUrl })
        .eq('id', currentOrg.id);

      if (updateError) throw updateError;

      setLogoUrl(publicUrl);
      toast({ title: 'Logo uploaded', description: 'Your logo has been saved.' });
    } catch (error: any) {
      toast({ title: 'Upload failed', description: error.message, variant: 'destructive' });
    } finally {
      setLogoUploading(false);
    }
  };

  const handleRemoveLogo = async () => {
    if (!currentOrg) return;
    try {
      const { error } = await supabase
        .from('organisations')
        .update({ logo_url: null })
        .eq('id', currentOrg.id);

      if (error) throw error;

      setLogoUrl(null);
      toast({ title: 'Logo removed' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
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

  const handleGlobalSignOut = async () => {
    setGlobalSignOutLoading(true);
    try {
      await supabase.auth.signOut({ scope: 'global' });
      // Global sign-out will trigger onAuthStateChange and redirect
    } catch (error: any) {
      toast({ title: 'Error', description: 'Failed to sign out of all devices', variant: 'destructive' });
      setGlobalSignOutLoading(false);
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

      <Tabs defaultValue={initialTab} className="space-y-6">
        <MobileTabBar initialTab={initialTab} isOrgAdmin={isOrgAdmin} isOrgOwner={isOrgOwner} />

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

          {/* Security Section */}
          <Card className="border-destructive/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-destructive" />
                Security
              </CardTitle>
              <CardDescription>
                Manage sessions across your devices
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Sign out of all devices</p>
                  <p className="text-sm text-muted-foreground">
                    This will end all active sessions, including this one. You'll need to log in again.
                  </p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm">
                      <LogOut className="h-4 w-4 mr-2" />
                      Sign Out All
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Sign out of all devices?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will immediately end all your active sessions on every device. You will be signed out and redirected to the login page.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleGlobalSignOut}
                        disabled={globalSignOutLoading}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {globalSignOutLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Yes, sign out everywhere
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
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
              
              <Separator />
              <div>
                <h4 className="mb-4 text-sm font-medium">Invoice Branding</h4>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Organisation Logo</Label>
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <Avatar className="h-16 w-16 rounded-lg">
                          {logoUrl ? (
                            <AvatarImage src={logoUrl} alt="Organisation logo" className="object-contain" />
                          ) : (
                            <AvatarFallback className="rounded-lg bg-muted">
                              {orgName.substring(0, 2).toUpperCase() || 'ORG'}
                            </AvatarFallback>
                          )}
                        </Avatar>
                        {logoUrl && (isOrgOwner || isOrgAdmin) && (
                          <Button
                            variant="destructive"
                            size="icon"
                            className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                            onClick={handleRemoveLogo}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                      {(isOrgOwner || isOrgAdmin) && (
                        <div>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={logoUploading}
                            onClick={() => document.getElementById('logo-upload')?.click()}
                          >
                            {logoUploading ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Upload className="h-4 w-4 mr-2" />
                            )}
                            Upload Logo
                          </Button>
                          <input
                            id="logo-upload"
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleLogoUpload}
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            PNG or JPG, max 2MB
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="invoiceFromName">Invoice From Name</Label>
                    <Input 
                      id="invoiceFromName"
                      placeholder={orgName || "Your business name"}
                      value={invoiceFromName}
                      onChange={(e) => setInvoiceFromName(e.target.value)}
                      disabled={!isOrgOwner && !isOrgAdmin}
                    />
                    <p className="text-xs text-muted-foreground">
                      Name shown at top of invoices (defaults to organisation name if empty)
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="invoiceFooterNote">Invoice Footer Note</Label>
                    <Textarea 
                      id="invoiceFooterNote"
                      placeholder="e.g. Payment instructions, terms, thank you message..."
                      value={invoiceFooterNote}
                      onChange={(e) => setInvoiceFooterNote(e.target.value)}
                      disabled={!isOrgOwner && !isOrgAdmin}
                      rows={3}
                    />
                    <p className="text-xs text-muted-foreground">
                      Appears at the bottom of every invoice
                    </p>
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

        <TabsContent value="availability">
          <TeacherAvailabilityTab />
        </TabsContent>

        <TabsContent value="calendar">
          <CalendarIntegrationsTab />
        </TabsContent>

        <TabsContent value="billing">
          <div className="space-y-8">
            {/* Subscription Management */}
            <BillingTab />
            
            {/* Invoice Settings */}
            <Card>
              <CardHeader>
                <CardTitle>Invoice Settings</CardTitle>
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
          </div>
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

        <TabsContent value="help-tours">
          <HelpToursTab />
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
