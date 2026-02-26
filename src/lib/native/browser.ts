import { Browser } from '@capacitor/browser';
import { platform } from '../platform';

/** Open a Stripe payment link (or any URL) in the in-app browser */
export async function openPaymentLink(stripeUrl: string) {
  if (!platform.isNative) {
    window.open(stripeUrl, '_blank');
    return;
  }

  await Browser.open({
    url: stripeUrl,
    presentationStyle: 'popover',
    toolbarColor: '#0a1628', // Match LessonLoop brand
  });
}

/** Listen for the browser to close (e.g. user completed or cancelled payment) */
export function onBrowserFinished(callback: () => void) {
  if (!platform.isNative) return;
  Browser.addListener('browserFinished', callback);
}

/** Open any external URL in the in-app browser */
export async function openInAppBrowser(url: string) {
  if (!platform.isNative) {
    window.open(url, '_blank');
    return;
  }

  await Browser.open({ url, toolbarColor: '#0a1628' });
}
