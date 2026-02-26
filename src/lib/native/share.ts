import { Share } from '@capacitor/share';
import { platform } from '../platform';

export async function shareInvoice(invoiceUrl: string, studentName: string) {
  if (!platform.isNative) {
    // Fallback to clipboard
    try {
      await navigator.clipboard.writeText(invoiceUrl);
    } catch { /* unavailable */ }
    return;
  }

  await Share.share({
    title: `Invoice for ${studentName}`,
    text: `View invoice for ${studentName} on LessonLoop`,
    url: invoiceUrl,
    dialogTitle: 'Share Invoice',
  });
}

export async function shareContent(options: { title?: string; text?: string; url?: string }) {
  if (!platform.isNative) {
    if (options.url) {
      try {
        await navigator.clipboard.writeText(options.url);
      } catch { /* unavailable */ }
    }
    return;
  }

  await Share.share(options);
}
