import { useState, useEffect, ChangeEvent, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useOrg } from '@/contexts/OrgContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Upload, X } from 'lucide-react';

const MAX_DIMENSION = 512;

function resizeImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width <= MAX_DIMENSION && height <= MAX_DIMENSION) {
        resolve(file);
        return;
      }
      const scale = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Canvas export failed'))),
        'image/png',
        0.92
      );
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}

function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.width, height: img.height });
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function BrandingTab() {
  const { currentOrg, isOrgAdmin, isOrgOwner } = useOrg();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const canEdit = isOrgOwner || isOrgAdmin;
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Preview dialog state
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewDimensions, setPreviewDimensions] = useState<{ width: number; height: number } | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (brandingData) {
      setInvoiceFromName(brandingData.invoice_from_name || '');
      setInvoiceFooterNote(brandingData.invoice_footer_note || '');
      setLogoUrl(brandingData.logo_url || null);
    }
  }, [brandingData]);

  // Clean up preview URL on unmount / change
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

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

  const handleFileSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    // Reset input so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';

    if (!file.type.startsWith('image/')) {
      toast({ title: 'Invalid file', description: 'Please upload an image file', variant: 'destructive' });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Logo must be under 2MB', variant: 'destructive' });
      return;
    }

    try {
      const dims = await getImageDimensions(file);
      const url = URL.createObjectURL(file);
      setPreviewFile(file);
      setPreviewUrl(url);
      setPreviewDimensions(dims);
      setShowPreview(true);
    } catch {
      toast({ title: 'Error', description: 'Could not read image', variant: 'destructive' });
    }
  };

  const handleConfirmUpload = async () => {
    if (!previewFile || !currentOrg) return;

    setLogoUploading(true);
    setShowPreview(false);

    try {
      // Resize if needed
      const processedBlob = await resizeImage(previewFile);
      const fileExt = previewFile.name.split('.').pop() || 'png';
      const filePath = `${currentOrg.id}/logo-${Date.now()}.${fileExt}`;

      // Delete old logo (best-effort)
      if (logoUrl) {
        try {
          const oldPath = logoUrl.split('/org-logos/')[1];
          if (oldPath) {
            await supabase.storage.from('org-logos').remove([decodeURIComponent(oldPath)]);
          }
        } catch {
          // Non-blocking
        }
      }

      const { error: uploadError } = await supabase.storage
        .from('org-logos')
        .upload(filePath, processedBlob, { upsert: true, contentType: 'image/png' });
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
      setPreviewFile(null);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      setPreviewDimensions(null);
    }
  };

  const handleCancelPreview = () => {
    setShowPreview(false);
    setPreviewFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewDimensions(null);
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

  const willResize = previewDimensions && (previewDimensions.width > MAX_DIMENSION || previewDimensions.height > MAX_DIMENSION);

  return (
    <>
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
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {logoUploading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4 mr-2" />
                    )}
                    Upload Logo
                  </Button>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
                  <p className="text-xs text-muted-foreground mt-1">Recommended: square image, 200×200px or larger. Max 2MB.</p>
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

      {/* Logo Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={(open) => { if (!open) handleCancelPreview(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Preview Logo</DialogTitle>
            <DialogDescription>Check your logo before uploading</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            {previewUrl && (
              <div className="rounded-lg border bg-muted/30 p-4">
                <img
                  src={previewUrl}
                  alt="Logo preview"
                  className="max-h-48 max-w-full object-contain"
                />
              </div>
            )}
            <div className="text-sm text-muted-foreground space-y-1 text-center">
              {previewFile && (
                <p>File size: {formatFileSize(previewFile.size)}</p>
              )}
              {previewDimensions && (
                <p>Dimensions: {previewDimensions.width} × {previewDimensions.height}px</p>
              )}
              {willResize && (
                <p className="text-xs text-warning-foreground">
                  Image will be resized to max {MAX_DIMENSION}×{MAX_DIMENSION}px for performance
                </p>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={handleCancelPreview}>Cancel</Button>
            <Button onClick={handleConfirmUpload}>Upload</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
