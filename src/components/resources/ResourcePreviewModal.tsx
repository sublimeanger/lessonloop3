import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Loader2, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ResourcePreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filePath: string;
  fileName: string;
  fileType: string;
  title: string;
}

function isPreviewable(fileType: string): 'image' | 'pdf' | 'none' {
  if (fileType.startsWith('image/')) return 'image';
  if (fileType === 'application/pdf') return 'pdf';
  return 'none';
}

export function ResourcePreviewModal({
  open,
  onOpenChange,
  filePath,
  fileName: _fileName,
  fileType,
  title,
}: ResourcePreviewModalProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast: _toast } = useToast();

  const previewType = isPreviewable(fileType);

  const fetchUrl = async () => {
    if (signedUrl) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase.storage
        .from('teaching-resources')
        .createSignedUrl(filePath, 3600);
      if (err) throw err;
      setSignedUrl(data.signedUrl);
    } catch {
      setError('Could not load preview.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = (isOpen: boolean) => {
    if (isOpen && previewType !== 'none') {
      fetchUrl();
    }
    if (!isOpen) {
      setSignedUrl(null);
      setError(null);
    }
    onOpenChange(isOpen);
  };

  const handleDownload = () => {
    if (signedUrl) {
      window.open(signedUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const dialogSize =
    previewType === 'pdf'
      ? 'h-screen w-screen max-w-none rounded-none border-0 p-3 sm:h-[85vh] sm:max-w-[900px] sm:rounded-lg sm:border sm:p-6'
      : previewType === 'image'
        ? 'h-screen w-screen max-w-none rounded-none border-0 p-3 sm:max-h-[90vh] sm:max-w-[90vw] sm:rounded-lg sm:border sm:p-6'
        : 'h-screen w-screen max-w-none rounded-none border-0 p-3 sm:max-w-[450px] sm:rounded-lg sm:border sm:p-6';

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className={`${dialogSize} flex flex-col`}>
        <DialogHeader className="shrink-0">
          <DialogTitle className="truncate pr-8">{title}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 flex items-center justify-center">
          {loading ? (
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : previewType === 'image' && signedUrl ? (
            <img
              src={signedUrl}
              alt={title}
              className="max-h-[calc(100vh-11rem)] max-w-full rounded-md object-contain sm:max-h-[75vh]"
            />
          ) : previewType === 'pdf' && signedUrl ? (
            <iframe
              src={signedUrl}
              title={title}
              className="h-full w-full rounded-md border"
            />
          ) : (
            <div className="text-center space-y-3 py-8">
              <Eye className="h-10 w-10 mx-auto text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                Preview not available for this file type.
              </p>
              <Button className="min-h-11 sm:min-h-9" variant="outline" onClick={handleDownload} disabled={!signedUrl}>
                <Download className="h-4 w-4 mr-2" />
                Download to view
              </Button>
            </div>
          )}
        </div>

        {previewType !== 'none' && signedUrl && (
          <div className="shrink-0 flex justify-end border-t pt-2">
            <Button variant="outline" size="sm" className="min-h-11 sm:min-h-9" onClick={handleDownload}>
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export { isPreviewable };
