import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
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
import { Loader2, AlertTriangle } from 'lucide-react';

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
        .select('name, address, timezone, currency_code')
        .eq('id', currentOrg!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!currentOrg?.id,
  });

  const [orgName, setOrgName] = useState('');
  const [orgAddress, setOrgAddress] = useState('');
  const [timezone, setTimezone] = useState('Europe/London');
  const [currencyCode, setCurrencyCode] = useState('GBP');
  const [showTimezoneWarning, setShowTimezoneWarning] = useState(false);
  const [pendingTimezone, setPendingTimezone] = useState<string | null>(null);

  useEffect(() => {
    if (orgData) {
      setOrgName(orgData.name || '');
      setOrgAddress(orgData.address || '');
      setTimezone(orgData.timezone || 'Europe/London');
      setCurrencyCode(orgData.currency_code || 'GBP');
    }
  }, [orgData]);

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
      if (!orgName.trim()) throw new Error('Organisation name is required');
      const { error } = await supabase
        .from('organisations')
        .update({ 
          name: orgName, 
          address: orgAddress,
          timezone,
          currency_code: currencyCode,
        })
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
          <div className="space-y-2">
            <Label htmlFor="orgName">Organisation name</Label>
            <Input id="orgName" value={orgName} onChange={(e) => setOrgName(e.target.value)} disabled={!canEdit} />
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
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !orgName.trim()}>
              {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          )}
        </CardContent>
      </Card>
    </>
  );
}
