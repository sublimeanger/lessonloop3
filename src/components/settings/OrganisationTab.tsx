import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useOrg } from '@/contexts/OrgContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';

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
        .select('name, address')
        .eq('id', currentOrg!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!currentOrg?.id,
  });

  const [orgName, setOrgName] = useState('');
  const [orgAddress, setOrgAddress] = useState('');

  useEffect(() => {
    if (orgData) {
      setOrgName(orgData.name || '');
      setOrgAddress(orgData.address || '');
    }
  }, [orgData]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!orgName.trim()) throw new Error('Organisation name is required');
      const { error } = await supabase
        .from('organisations')
        .update({ name: orgName, address: orgAddress })
        .eq('id', currentOrg!.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await refreshOrganisations();
      queryClient.invalidateQueries({ queryKey: ['org-details', currentOrg?.id] });
      toast({ title: 'Organisation updated', description: 'Your organisation has been saved.' });
    },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  return (
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
              <Input value={currentOrg?.currency_code || 'GBP'} disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label>Timezone</Label>
              <Input value={currentOrg?.timezone || 'Europe/London'} disabled className="bg-muted" />
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
  );
}
