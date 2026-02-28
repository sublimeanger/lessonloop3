import { platform } from '../platform';

/**
 * Safely pick an image on native platforms.
 *
 * On Capacitor (iOS/Android), the raw HTML file input can crash —
 * especially on iPad — due to how the WebView presents the picker.
 * This utility wraps the file-input flow with error handling and,
 * when available, uses @capacitor/camera for a more reliable experience.
 *
 * Falls back to a standard file input on web.
 */

interface PickImageOptions {
  /** Max file size in bytes (default 5MB) */
  maxSize?: number;
  /** Accepted MIME types (default image/*) */
  accept?: string[];
}

interface PickImageResult {
  file: File | null;
  error: string | null;
}

/**
 * Attempt to pick an image using @capacitor/camera (native) or
 * a file input (web). Wrapped in try-catch to prevent crashes.
 */
export async function pickImageSafely(options: PickImageOptions = {}): Promise<PickImageResult> {
  const maxSize = options.maxSize ?? 5 * 1024 * 1024;

  // On native, try Capacitor Camera plugin first
  if (platform.isNative) {
    try {
      const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');

      const photo = await Camera.getPhoto({
        resultType: CameraResultType.Uri,
        source: CameraSource.Prompt, // Let user choose camera or gallery
        quality: 90,
        width: 1024,
        height: 1024,
        correctOrientation: true,
      });

      if (!photo.webPath) {
        return { file: null, error: null }; // User cancelled
      }

      // Convert the photo URI to a File object
      const response = await fetch(photo.webPath);
      const blob = await response.blob();

      const ext = photo.format || 'jpeg';
      const file = new File([blob], `photo-${Date.now()}.${ext}`, {
        type: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
      });

      if (file.size > maxSize) {
        return { file: null, error: `Image is too large (max ${Math.round(maxSize / 1024 / 1024)}MB)` };
      }

      return { file, error: null };
    } catch (e: unknown) {
      // Camera plugin not available or user denied permission
      const message = e instanceof Error ? e.message : String(e);

      // User cancelled — not an error
      if (
        message.includes('User cancelled') ||
        message.includes('cancelled') ||
        message.includes('canceled')
      ) {
        return { file: null, error: null };
      }

      // Permission denied
      if (message.includes('permission') || message.includes('denied')) {
        return { file: null, error: 'Camera permission denied. Please enable it in Settings.' };
      }

      // Fall through to file input fallback
      console.warn('[camera] Capacitor Camera failed, falling back to file input:', message);
    }
  }

  // Fallback: use a file input element
  return pickWithFileInput(maxSize, options.accept);
}

/**
 * File input fallback — works on web and as a native fallback.
 * Wrapped in try-catch to prevent crashes on iPad.
 */
function pickWithFileInput(maxSize: number, accept?: string[]): Promise<PickImageResult> {
  return new Promise((resolve) => {
    try {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = accept?.join(',') ?? 'image/*';

      // Prevent crash on iPad by not using capture attribute directly
      // iPad requires the picker to be presented as a popover, which
      // the default file input handles better than capture="environment"

      input.onchange = () => {
        const file = input.files?.[0];
        if (!file) {
          resolve({ file: null, error: null });
          return;
        }
        if (file.size > maxSize) {
          resolve({ file: null, error: `File is too large (max ${Math.round(maxSize / 1024 / 1024)}MB)` });
          return;
        }
        resolve({ file, error: null });
      };

      // Handle cancel — some browsers fire no event, so set a timeout
      input.oncancel = () => resolve({ file: null, error: null });

      // Trigger the file picker
      input.click();

      // Cleanup timeout for browsers that don't fire oncancel
      setTimeout(() => {
        if (!input.files?.length) {
          // Don't resolve here — user might still be picking
        }
      }, 500);
    } catch (e) {
      console.error('[camera] File input failed:', e);
      resolve({ file: null, error: 'Unable to open photo picker. Please try again.' });
    }
  });
}
