import { useState, useEffect, ChangeEvent, useRef, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useOrg } from '@/contexts/OrgContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Upload, X, Eye, Hash, Palette } from 'lucide-react';
import { InvoicePreview } from '@/components/invoices/InvoicePreview';

const MAX_DIMENSION = 512;

const BRAND_PRESETS = [
  { name: 'Midnight', brand: '#1a1a2e', accent: '#6366f1' },
  { name: 'Ocean', brand: '#0f172a', accent: '#0ea5e9' },
  { name: 'Forest', brand: '#14532d', accent: '#22c55e' },
  { name: 'Berry', brand: '#4a1942', accent: '#d946ef' },
  { name: 'Coral', brand: '#7f1d1d', accent: '#f97316' },
  { name: 'Slate', brand: '#334155', accent: '#64748b' },
];

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

function isValidHex(color: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(color);
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
        .select(`
          name, logo_url,
          invoice_from_name, invoice_from_address_line1, invoice_from_address_line2,
          invoice_from_city, invoice_from_postcode, invoice_footer_note,
          brand_color, accent_color,
          invoice_number_prefix, invoice_number_digits,
          vat_registration_number,
          bank_account_name, bank_sort_code, bank_account_number, bank_reference_prefix
        `)
        .eq('id', currentOrg!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!currentOrg?.id,
  });

  // Form state
  const [invoiceFromName, setInvoiceFromName] = useState('');
  const [invoiceFooterNote, setInvoiceFooterNote] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [brandColor, setBrandColor] = useState('#1a1a2e');
  const [accentColor, setAccentColor] = useState('#6366f1');
  const [invoiceNumberPrefix, setInvoiceNumberPrefix] = useState('');
  const [invoiceNumberDigits, setInvoiceNumberDigits] = useState('5');

  // Logo preview dialog state
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewDimensions, setPreviewDimensions] = useState<{ width: number; height: number } | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // Hydrate from server
  useEffect(() => {
    if (brandingData) {
      setInvoiceFromName(brandingData.invoice_from_name || '');
      setInvoiceFooterNote(brandingData.invoice_footer_note || '');
      setLogoUrl(brandingData.logo_url || null);
      setBrandColor(brandingData.brand_color || '#1a1a2e');
      setAccentColor(brandingData.accent_color || '#6366f1');
      setInvoiceNumberPrefix(brandingData.invoice_number_prefix || '');
      setInvoiceNumberDigits(String(brandingData.invoice_number_digits || 5));
    }
  }, [brandingData]);

  // Clean up preview URL on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const orgName = brandingData?.name || currentOrg?.name || '';

  // Live preview branding object
  const previewBranding = useMemo(() => ({
    orgName,
    invoiceFromName,
    logoUrl,
    brandColor: isValidHex(brandColor) ? brandColor : '#1a1a2e',
    accentColor: isValidHex(accentColor) ? accentColor : '#6366f1',
    addressLine1: brandingData?.invoice_from_address_line1 || '',
    addressLine2: brandingData?.invoice_from_address_line2 || '',
    city: brandingData?.invoice_from_city || '',
    postcode: brandingData?.invoice_from_postcode || '',
    vatNumber: brandingData?.vat_registration_number || '',
    footerNote: invoiceFooterNote,
    invoiceNumberPrefix: invoiceNumberPrefix || 'LL',
    invoiceNumberDigits: parseInt(invoiceNumberDigits) || 5,
    bankAccountName: brandingData?.bank_account_name || '',
    bankSortCode: brandingData?.bank_sort_code || '',
    bankAccountNumber: brandingData?.bank_account_number || '',
    bankReferencePrefix: brandingData?.bank_reference_prefix || '',
  }), [
    orgName, invoiceFromName, logoUrl, brandColor, accentColor,
    invoiceFooterNote, invoiceNumberPrefix, invoiceNumberDigits, brandingData,
  ]);

  // Sample invoice number preview
  const sampleInvoiceNumber = useMemo(() => {
    const prefix = invoiceNumberPrefix || 'LL';
    const year = new Date().getFullYear();
    const digits = Math.max(3, Math.min(8, parseInt(invoiceNumberDigits) || 5));
    return `${prefix}-${year}-${'1'.padStart(digits, '0')}`;
  }, [invoiceNumberPrefix, invoiceNumberDigits]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('organisations')
        .update({
          invoice_from_name: invoiceFromName || null,
          invoice_footer_note: invoiceFooterNote || null,
          brand_color: isValidHex(brandColor) ? brandColor : '#1a1a2e',
          accent_color: isValidHex(accentColor) ? accentColor : '#6366f1',
          invoice_number_prefix: invoiceNumberPrefix || null,
          invoice_number_digits: Math.max(3, Math.min(8, parseInt(invoiceNumberDigits) || 5)),
        })
        .eq('id', currentOrg!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({ title: 'Branding saved', description: 'Your invoice branding and preferences have been updated.' });
    },
    onError: (err: Error) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  // ─── Logo handlers ───

  const handleFileSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
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
      const processedBlob = await resizeImage(previewFile);
      const fileExt = previewFile.name.split('.').pop() || 'png';
      const filePath = `${currentOrg.id}/logo-${Date.now()}.${fileExt}`;

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
      <div className="space-y-6">
        {/* ─── Settings + Live Preview side by side on desktop ─── */}
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          {/* Left: Controls */}
          <div className="space-y-6">
            {/* Logo & Identity */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="h-4 w-4" />
                  Brand Identity
                </CardTitle>
                <CardDescription>Your logo and business name shown on all invoices</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Logo upload */}
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
                          aria-label="Upload logo"
                        >
                          {logoUploading ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Upload className="h-4 w-4 mr-2" />
                          )}
                          Upload Logo
                        </Button>
                        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
                        <p className="text-xs text-muted-foreground mt-1">Square, 200x200px+. Max 2MB.</p>
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
                    Shown at top of invoices. Defaults to org name if empty.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Brand Colours */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="h-4 w-4" />
                  Brand Colours
                </CardTitle>
                <CardDescription>Theme your invoices with your brand colours</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Quick presets */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Quick Presets</Label>
                  <div className="flex flex-wrap gap-2">
                    {BRAND_PRESETS.map((preset) => {
                      const isActive = brandColor === preset.brand && accentColor === preset.accent;
                      return (
                        <button
                          key={preset.name}
                          type="button"
                          disabled={!canEdit}
                          onClick={() => {
                            setBrandColor(preset.brand);
                            setAccentColor(preset.accent);
                          }}
                          className={`group flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-all hover:shadow-sm ${
                            isActive
                              ? 'border-primary bg-primary/5 ring-1 ring-primary/30 font-medium'
                              : 'border-border hover:border-primary/40'
                          }`}
                        >
                          <span className="flex gap-0.5">
                            <span
                              className="h-4 w-4 rounded-full border border-white/20 shadow-sm"
                              style={{ backgroundColor: preset.brand }}
                            />
                            <span
                              className="h-4 w-4 rounded-full border border-white/20 shadow-sm"
                              style={{ backgroundColor: preset.accent }}
                            />
                          </span>
                          {preset.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <Separator />

                {/* Custom colour pickers */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="brandColor">Header / Primary Colour</Label>
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <input
                          type="color"
                          id="brandColor"
                          value={brandColor}
                          onChange={(e) => setBrandColor(e.target.value)}
                          disabled={!canEdit}
                          className="h-9 w-9 cursor-pointer rounded-lg border border-border p-0.5"
                        />
                      </div>
                      <Input
                        value={brandColor}
                        onChange={(e) => setBrandColor(e.target.value)}
                        disabled={!canEdit}
                        className="w-28 font-mono text-xs"
                        maxLength={7}
                        placeholder="#1a1a2e"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">Invoice header background</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="accentColor">Accent Colour</Label>
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <input
                          type="color"
                          id="accentColor"
                          value={accentColor}
                          onChange={(e) => setAccentColor(e.target.value)}
                          disabled={!canEdit}
                          className="h-9 w-9 cursor-pointer rounded-lg border border-border p-0.5"
                        />
                      </div>
                      <Input
                        value={accentColor}
                        onChange={(e) => setAccentColor(e.target.value)}
                        disabled={!canEdit}
                        className="w-28 font-mono text-xs"
                        maxLength={7}
                        placeholder="#6366f1"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">Totals, highlights, and accents</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Invoice Number Pattern */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Hash className="h-4 w-4" />
                  Invoice Numbering
                </CardTitle>
                <CardDescription>Customise how your invoice numbers are formatted</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="invoicePrefix">Prefix</Label>
                    <Input
                      id="invoicePrefix"
                      placeholder="LL"
                      value={invoiceNumberPrefix}
                      onChange={(e) => {
                        // Only allow letters, numbers, max 6 chars
                        const v = e.target.value.replace(/[^a-zA-Z0-9]/g, '').substring(0, 6);
                        setInvoiceNumberPrefix(v);
                      }}
                      disabled={!canEdit}
                      maxLength={6}
                      className="uppercase"
                    />
                    <p className="text-xs text-muted-foreground">
                      Letters/numbers before the year. Defaults to "LL".
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="invoiceDigits">Number Digits</Label>
                    <Select
                      value={invoiceNumberDigits}
                      onValueChange={setInvoiceNumberDigits}
                      disabled={!canEdit}
                    >
                      <SelectTrigger id="invoiceDigits">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="3">3 digits (001)</SelectItem>
                        <SelectItem value="4">4 digits (0001)</SelectItem>
                        <SelectItem value="5">5 digits (00001)</SelectItem>
                        <SelectItem value="6">6 digits (000001)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Zero-padded sequence number length
                    </p>
                  </div>
                </div>

                {/* Preview of the number format */}
                <div className="flex items-center gap-3 rounded-lg border border-dashed border-primary/30 bg-primary/5 px-4 py-3">
                  <Hash className="h-4 w-4 text-primary shrink-0" />
                  <div>
                    <div className="text-xs text-muted-foreground">Next invoice will look like</div>
                    <div className="font-mono text-sm font-medium text-primary">{sampleInvoiceNumber}</div>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">
                  Format: PREFIX-YEAR-NUMBER. The sequence number auto-increments and resets each year.
                  Existing invoices keep their original numbers.
                </p>
              </CardContent>
            </Card>

            {/* Footer Note */}
            <Card>
              <CardHeader>
                <CardTitle>Invoice Footer</CardTitle>
                <CardDescription>Custom message printed at the bottom of every invoice</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  id="invoiceFooterNote"
                  placeholder="e.g. Thank you for your business! Payment terms: 14 days..."
                  value={invoiceFooterNote}
                  onChange={(e) => setInvoiceFooterNote(e.target.value)}
                  disabled={!canEdit}
                  rows={3}
                />
              </CardContent>
            </Card>

            {/* Save button */}
            {canEdit && (
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                size="lg"
                className="w-full sm:w-auto"
              >
                {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save Branding
              </Button>
            )}
          </div>

          {/* Right: Live Invoice Preview */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Eye className="h-4 w-4" />
              Live Preview
            </div>
            <div className="sticky top-4">
              <InvoicePreview branding={previewBranding} />
              <p className="text-xs text-muted-foreground text-center mt-3">
                Changes update in real-time. Save to apply to future invoices.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Logo Preview/Confirm Dialog */}
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
                <p>Dimensions: {previewDimensions.width} x {previewDimensions.height}px</p>
              )}
              {willResize && (
                <p className="text-xs text-warning-foreground">
                  Image will be resized to max {MAX_DIMENSION}x{MAX_DIMENSION}px for performance
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
