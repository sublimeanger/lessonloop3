import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export function useInvoicePdf() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const downloadPdf = async (invoiceId: string, invoiceNumber: string) => {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: 'Authentication Required',
          description: 'Please log in to download invoices.',
          variant: 'destructive',
        });
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/invoice-pdf?invoiceId=${invoiceId}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('PDF generation is temporarily unavailable. Please try again in a few minutes or contact support.');
        }
        if (response.status === 500) {
          throw new Error('PDF generation encountered an error. Please try again or contact support.');
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to generate PDF');
      }

      // Get the blob from the response
      const blob = await response.blob();

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${invoiceNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: 'Download Complete',
        description: `Invoice ${invoiceNumber} downloaded successfully.`,
      });
    } catch (error: any) {
      console.error('PDF download error:', error);
      toast({
        title: 'Download Failed',
        description: error.message || 'Failed to download invoice PDF.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return { downloadPdf, isLoading };
}
