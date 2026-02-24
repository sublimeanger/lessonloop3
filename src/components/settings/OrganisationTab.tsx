import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useOrg } from '@/contexts/OrgContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, AlertTriangle, Eye } from 'lucide-react';

const COMMON_TIMEZONES = [
  'Europe/London',
  'Europe/Dublin',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Amsterdam',
  'Europe/Brussels',
  'Europe/Madrid',
  'Europe/Rome',
  'Europe/Zurich',
  'Europe/Vienna',
  'Europe/Stockholm',
  'Europe/Oslo',
  'Europe/Copenhagen',
  'Europe/Helsinki',
  'Europe/Warsaw',
  'Europe/Prague',
  'Europe/Bucharest',
  'Europe/Athens',
  'Europe/Istanbul',
  'Europe/Moscow',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Toronto',
  'America/Vancouver',
  'America/Halifax',
  'America/Sao_Paulo',
  'America/Argentina/Buenos_Aires',
  'America/Mexico_City',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Hong_Kong',
  'Asia/Singapore',
  'Asia/Kolkata',
  'Asia/Dubai',
  'Asia/Seoul',
  'Asia/Bangkok',
  'Australia/Sydney',
  'Australia/Melbourne',
  'Australia/Perth',
  'Australia/Brisbane',
  'Pacific/Auckland',
  'Africa/Johannesburg',
  'Africa/Cairo',
  'Africa/Lagos',
];

const CURRENCIES = [
  { code: 'GBP', label: 'GBP (£) — British Pound' },
  { code: 'EUR', label: 'EUR (€) — Euro' },
  { code: 'USD', label: 'USD ($) — US Dollar' },
  { code: 'AUD', label: 'AUD ($) — Australian Dollar' },
  { code: 'CAD', label: 'CAD ($) — Canadian Dollar' },
  { code: 'NZD', label: 'NZD ($) — New Zealand Dollar' },
];

export function OrganisationTab() {
  const { currentOrg, isOrgAdmin, isOrgOwner, refreshOrganisations } = useOrg();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const canEdit = isOrgOwner || isOrgAdmin;

  const { data: orgData } = useQuery({
    queryKey: ['org-details', currentOrg?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organisations')
        .select('name, address, timezone, currency_code, teacher_payment_notifications_enabled, teacher_payment_analytics_enabled')
        .eq('id', currentOrg!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!currentOrg?.id,
  });

  const [orgName, setOrgName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameTouched, setNameTouched] = useState(false);
  const [orgAddress, setOrgAddress] = useState('');
  const [timezone, setTimezone] = useState('Europe/London');
  const [currencyCode, setCurrencyCode] = useState('GBP');
  const [showTimezoneWarning, setShowTimezoneWarning] = useState(false);
  const [pendingTimezone, setPendingTimezone] = useState<string | null>(null);
  const [teacherPaymentNotifications, setTeacherPaymentNotifications] = useState(true);
  const [teacherPaymentAnalytics, setTeacherPaymentAnalytics] = useState(true);

  const isMultiTeacherOrg = currentOrg?.org_type === 'academy' || currentOrg?.org_type === 'agency';

  useEffect(() => {
    if (orgData) {
      setOrgName(orgData.name || '');
      setOrgAddress(orgData.address || '');
      setTimezone(orgData.timezone || 'Europe/London');
      setCurrencyCode(orgData.currency_code || 'GBP');
      setTeacherPaymentNotifications(orgData.teacher_payment_notifications_enabled !== false);
      setTeacherPaymentAnalytics(orgData.teacher_payment_analytics_enabled !== false);
    }
  }, [orgData]);

  const validateName = (value: string): string | null => {
    const trimmed = value.trim();
    if (!trimmed) return 'Organisation name is required';
    if (trimmed.length < 2) return 'Name must be at least 2 characters';
    if (trimmed.length > 100) return 'Name must be 100 characters or fewer';
    return null;
  };

  const handleNameChange = (value: string) => {
    setOrgName(value);
    if (nameTouched) setNameError(validateName(value));
  };

  const handleNameBlur = () => {
    setNameTouched(true);
    setNameError(validateName(orgName));
  };

  const isNameValid = !validateName(orgName);

  const handleTimezoneChange = (value: string) => {
    if (value !== orgData?.timezone) {
      setPendingTimezone(value);
      setShowTimezoneWarning(true);
    } else {
      setTimezone(value);
    }
  };

  const confirmTimezoneChange = () => {
    if (pendingTimezone) {
      setTimezone(pendingTimezone);
      setPendingTimezone(null);
    }
    setShowTimezoneWarning(false);
  };

  const cancelTimezoneChange = () => {
    setPendingTimezone(null);
    setShowTimezoneWarning(false);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const nameErr = validateName(orgName);
      if (nameErr) throw new Error(nameErr);
      const updatePayload: Record<string, unknown> = {
        name: orgName.trim(),
        address: orgAddress,
        timezone,
        currency_code: currencyCode,
      };
      if (isMultiTeacherOrg) {
        updatePayload.teacher_payment_notifications_enabled = teacherPaymentNotifications;
        updatePayload.teacher_payment_analytics_enabled = teacherPaymentAnalytics;
      }
      const { error } = await supabase
        .from('organisations')
        .update(updatePayload)
        .eq('id', currentOrg!.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await refreshOrganisations();
      queryClient.invalidateQueries({ queryKey: ['org-details', currentOrg?.id] });
      toast({ title: 'Organisation updated', description: 'Your organisation has been saved.' });
    },
    onError: (err: Error) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  return (
    <>
      <AlertDialog open={showTimezoneWarning} onOpenChange={(open) => !open && cancelTimezoneChange()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Change timezone?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  Changing your timezone will affect how lesson times are displayed across the platform.
                </p>
                <p>
                  Existing lessons will keep their original times but will show in the new timezone. This may cause confusion for teachers and parents.
                </p>
                <p className="font-medium text-foreground">Are you sure you want to continue?</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelTimezoneChange}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmTimezoneChange}>
              Change Timezone
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card>
        <CardHeader>
          <CardTitle>Organisation Details</CardTitle>
          <CardDescription>Manage your teaching business information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-1">
            <Label htmlFor="orgName">Organisation name</Label>
            <Input
              id="orgName"
              value={orgName}
              onChange={(e) => handleNameChange(e.target.value)}
              onBlur={handleNameBlur}
              maxLength={100}
              disabled={!canEdit}
            />
            {nameTouched && nameError && (
              <p className="text-xs text-destructive mt-1">{nameError}</p>
            )}
            {orgName.trim().length > 80 && (
              <p className="text-xs text-muted-foreground mt-1">
                {100 - orgName.trim().length} characters remaining
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              placeholder="Enter your business address"
              value={orgAddress}
              onChange={(e) => setOrgAddress(e.target.value)}
              disabled={!canEdit}
            />
          </div>
          <Separator />
          <div>
            <h4 className="mb-4 text-sm font-medium">Regional Settings</h4>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Currency</Label>
                {canEdit ? (
                  <Select value={currencyCode} onValueChange={setCurrencyCode}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((c) => (
                        <SelectItem key={c.code} value={c.code}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input value={currencyCode} disabled className="bg-muted" />
                )}
              </div>
              <div className="space-y-2">
                <Label>Timezone</Label>
                {canEdit ? (
                  <Select value={timezone} onValueChange={handleTimezoneChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COMMON_TIMEZONES.map((tz) => (
                        <SelectItem key={tz} value={tz}>
                          {tz.replace(/_/g, ' ')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input value={timezone} disabled className="bg-muted" />
                )}
              </div>
            </div>
          </div>
          {canEdit && (
            <Button onClick={() => { setNameTouched(true); setNameError(validateName(orgName)); if (isNameValid) saveMutation.mutate(); }} disabled={saveMutation.isPending || !isNameValid}>
              {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Teacher Visibility — only for multi-teacher orgs, visible to owners/admins */}
      {canEdit && isMultiTeacherOrg && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              Teacher Visibility
            </CardTitle>
            <CardDescription>
              Control what financial information teachers can see
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start justify-between gap-4 py-2">
              <div className="space-y-0.5">
                <div className="text-sm font-medium">Payment notifications</div>
                <div className="text-xs text-muted-foreground leading-relaxed">
                  When a parent pays, teachers see a real-time notification toast
                </div>
              </div>
              <Switch
                checked={teacherPaymentNotifications}
                onCheckedChange={setTeacherPaymentNotifications}
                className="shrink-0 mt-0.5"
              />
            </div>
            <Separator />
            <div className="flex items-start justify-between gap-4 py-2">
              <div className="space-y-0.5">
                <div className="text-sm font-medium">Payment analytics</div>
                <div className="text-xs text-muted-foreground leading-relaxed">
                  Show the payment analytics dashboard card to teachers on their dashboard
                </div>
              </div>
              <Switch
                checked={teacherPaymentAnalytics}
                onCheckedChange={setTeacherPaymentAnalytics}
                className="shrink-0 mt-0.5"
              />
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
