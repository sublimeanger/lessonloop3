/**
 * Safely extracts an error message from an unknown thrown value.
 * Useful in catch blocks where the error is typed as `unknown`.
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'An unexpected error occurred';
}
