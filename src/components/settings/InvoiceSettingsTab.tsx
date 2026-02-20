import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { useOrg } from '@/contexts/OrgContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';

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
        .select('vat_enabled, vat_rate, vat_registration_number, default_payment_terms_days')
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
  const [hydrated, setHydrated] = useState(false);

  if (settingsData && !hydrated) {
    setVatRegistered(settingsData.vat_enabled || false);
    setVatRate(settingsData.vat_rate?.toString() || '20');
    setVatNumber(settingsData.vat_registration_number || '');
    setPaymentTermsDays(settingsData.default_payment_terms_days || 14);
    setHydrated(true);
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('organisations')
        .update({
          vat_enabled: vatRegistered,
          vat_rate: vatRegistered ? parseFloat(vatRate) : null,
          vat_registration_number: vatRegistered ? vatNumber : null,
          default_payment_terms_days: paymentTermsDays,
        })
        .eq('id', currentOrg!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({ title: 'Billing settings saved', description: 'Your billing preferences have been updated.' });
    },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

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
