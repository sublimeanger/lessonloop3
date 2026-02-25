import { logger } from '@/lib/logger';
import { toast } from '@/hooks/use-toast';

interface HandledError {
  message: string;
  isRetryable: boolean;
}

// Common Supabase PostgrestError codes → user-friendly messages
const POSTGREST_ERROR_MAP: Record<string, string> = {
  '42501': "You don't have permission to perform this action.",
  '23505': 'This record already exists.',
  '23503': 'This record is referenced elsewhere and cannot be modified.',
  '23502': 'A required field is missing.',
  '42P01': 'The requested resource was not found.',
  'PGRST301': 'Your session has expired. Please sign in again.',
};

function isPostgrestError(error: unknown): error is { code: string; message: string; details?: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as Record<string, unknown>).code === 'string'
  );
}

function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError && error.message.toLowerCase().includes('fetch')) return true;
  if (error instanceof TypeError && error.message.toLowerCase().includes('network')) return true;
  return false;
}

function isAuthError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const msg = ('message' in error ? String((error as Record<string, unknown>).message) : '').toLowerCase();
  return (
    msg.includes('jwt expired') ||
    msg.includes('jwt') ||
    msg.includes('not authenticated') ||
    msg.includes('session') ||
    msg.includes('refresh_token')
  );
}

function isSubscriptionError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return msg.includes('subscription is inactive') || msg.includes('trial has expired');
}

/**
 * Normalises any error into a user-friendly message + retryable flag.
 * Always logs the raw error via logger.error.
 */
export function handleError(error: unknown, context?: string): HandledError {
  const label = context ? `[${context}]` : '';
  logger.error(label, error);

  // 1. Supabase PostgrestError
  if (isPostgrestError(error)) {
    const friendly = POSTGREST_ERROR_MAP[error.code];
    if (friendly) {
      return { message: friendly, isRetryable: false };
    }
    // Fall through to use the raw message if code is unmapped
    return { message: error.message || 'A database error occurred.', isRetryable: false };
  }

  // 2. Network / fetch errors
  if (isNetworkError(error)) {
    return {
      message: 'Network error — please check your connection and try again.',
      isRetryable: true,
    };
  }

  // 3. Auth / session errors
  if (isAuthError(error)) {
    return {
      message: 'Your session has expired. Please sign in again.',
      isRetryable: false,
    };
  }

  // 4. Subscription errors
  if (isSubscriptionError(error)) {
    const msg = error instanceof Error ? error.message : String(error);
    return { message: msg, isRetryable: false };
  }

  // 5. Standard Error with a message
  if (error instanceof Error && error.message) {
    return { message: error.message, isRetryable: false };
  }

  // 6. Fallback
  return {
    message: 'Something went wrong. Please try again.',
    isRetryable: true,
  };
}

/**
 * Convenience: handleError + show a destructive toast.
 */
export function toastError(error: unknown, context?: string): HandledError {
  const result = handleError(error, context);
  toast({
    title: context || 'Error',
    description: result.message,
    variant: 'destructive',
  });
  return result;
}
