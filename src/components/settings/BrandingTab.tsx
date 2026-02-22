import { useState, useEffect, ChangeEvent } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useOrg } from '@/contexts/OrgContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Upload, X } from 'lucide-react';

export function BrandingTab() {
  const { currentOrg, isOrgAdmin, isOrgOwner } = useOrg();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const canEdit = isOrgOwner || isOrgAdmin;

  const queryKey = ['org-branding', currentOrg?.id];

  const { data: brandingData } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organisations')
        .select('name, invoice_from_name, invoice_footer_note, logo_url')
        .eq('id', currentOrg!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!currentOrg?.id,
  });

  const [invoiceFromName, setInvoiceFromName] = useState('');
  const [invoiceFooterNote, setInvoiceFooterNote] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);

  useEffect(() => {
    if (brandingData) {
      setInvoiceFromName(brandingData.invoice_from_name || '');
      setInvoiceFooterNote(brandingData.invoice_footer_note || '');
      setLogoUrl(brandingData.logo_url || null);
    }
  }, [brandingData]);

  const orgName = brandingData?.name || currentOrg?.name || '';

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('organisations')
        .update({
          invoice_from_name: invoiceFromName || null,
          invoice_footer_note: invoiceFooterNote || null,
        })
        .eq('id', currentOrg!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({ title: 'Branding updated', description: 'Your invoice branding has been saved.' });
    },
    onError: (err: Error) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const handleLogoUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !currentOrg) return;

    if (!file.type.startsWith('image/')) {
      toast({ title: 'Invalid file', description: 'Please upload an image file', variant: 'destructive' });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Logo must be under 2MB', variant: 'destructive' });
      return;
    }

    setLogoUploading(true);
    const fileExt = file.name.split('.').pop();
    const filePath = `${currentOrg.id}/logo-${Date.now()}.${fileExt}`;

    // Delete old logo if exists
    if (logoUrl) {
      try {
        const oldPath = logoUrl.split('/org-logos/')[1];
        if (oldPath) {
          await supabase.storage.from('org-logos').remove([decodeURIComponent(oldPath)]);
        }
      } catch {
        // Non-blocking — old file cleanup is best-effort
      }
    }

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
      queryClient.invalidateQueries({ queryKey });
      toast({ title: 'Logo uploaded', description: 'Your logo has been saved.' });
    } catch (error: unknown) {
      toast({ title: 'Upload failed', description: error instanceof Error ? error.message : 'Unknown error', variant: 'destructive' });
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
      queryClient.invalidateQueries({ queryKey });
      toast({ title: 'Logo removed' });
    } catch (error: unknown) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Unknown error', variant: 'destructive' });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invoice Branding</CardTitle>
        <CardDescription>Customise how your invoices look</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Logo */}
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
              {logoUrl && canEdit && (
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
            {canEdit && (
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
                <input id="logo-upload" type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                <p className="text-xs text-muted-foreground mt-1">PNG or JPG, max 2MB</p>
              </div>
            )}
          </div>
        </div>

        {/* Invoice From Name */}
        <div className="space-y-2">
          <Label htmlFor="invoiceFromName">Invoice From Name</Label>
          <Input
            id="invoiceFromName"
            placeholder={orgName || 'Your business name'}
            value={invoiceFromName}
            onChange={(e) => setInvoiceFromName(e.target.value)}
            disabled={!canEdit}
          />
          <p className="text-xs text-muted-foreground">
            Name shown at top of invoices (defaults to organisation name if empty)
          </p>
        </div>

        {/* Footer Note */}
        <div className="space-y-2">
          <Label htmlFor="invoiceFooterNote">Invoice Footer Note</Label>
          <Textarea
            id="invoiceFooterNote"
            placeholder="e.g. Payment instructions, terms, thank you message..."
            value={invoiceFooterNote}
            onChange={(e) => setInvoiceFooterNote(e.target.value)}
            disabled={!canEdit}
            rows={3}
          />
          <p className="text-xs text-muted-foreground">Appears at the bottom of every invoice</p>
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
