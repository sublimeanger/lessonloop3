/**
 * Centralised environment variable validation.
 * Imported early in main.tsx so missing vars throw immediately at startup.
 */

function requireEnv(name: string): string {
  const value = import.meta.env[name];
  if (!value || typeof value !== 'string' || value.trim() === '') {
    return ''; // will be caught below
  }
  return value.trim();
}

const missing: string[] = [];

const supabaseUrl = requireEnv('VITE_SUPABASE_URL');
if (!supabaseUrl) missing.push('VITE_SUPABASE_URL');
else {
  try {
    new URL(supabaseUrl);
  } catch {
    missing.push('VITE_SUPABASE_URL (invalid URL)');
  }
}

const supabaseKey = requireEnv('VITE_SUPABASE_PUBLISHABLE_KEY');
if (!supabaseKey) missing.push('VITE_SUPABASE_PUBLISHABLE_KEY');

const supabaseProjectId = requireEnv('VITE_SUPABASE_PROJECT_ID');
if (!supabaseProjectId) missing.push('VITE_SUPABASE_PROJECT_ID');

if (missing.length > 0) {
  throw new Error(
    `[LessonLoop] Missing or invalid environment variables:\n  - ${missing.join('\n  - ')}\n\nCheck your .env file or deployment configuration.`
  );
}

/** Validated Supabase URL */
export const SUPABASE_URL: string = supabaseUrl;

/** Validated Supabase anon/publishable key */
export const SUPABASE_PUBLISHABLE_KEY: string = supabaseKey;

/** Validated Supabase project ID */
export const SUPABASE_PROJECT_ID: string = supabaseProjectId;

/** Optional Sentry DSN — empty string if not configured */
export const SENTRY_DSN: string = requireEnv('VITE_SENTRY_DSN');
