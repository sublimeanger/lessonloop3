/**
 * Centralised environment variable validation.
 * Imported early in main.tsx so missing vars are caught at startup.
 *
 * IMPORTANT: Vite statically replaces `import.meta.env.VITE_*` at build time.
 * Dynamic access like `import.meta.env[name]` does NOT work in production —
 * the VITE_* keys are stripped from the runtime object. Always use direct
 * property access for each variable.
 */

const missing: string[] = [];

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL ?? '').trim();
if (!supabaseUrl) {
  missing.push('VITE_SUPABASE_URL');
} else {
  try {
    new URL(supabaseUrl);
  } catch {
    missing.push('VITE_SUPABASE_URL (invalid URL)');
  }
}

const supabaseKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '').trim();
if (!supabaseKey) missing.push('VITE_SUPABASE_PUBLISHABLE_KEY');

const supabaseProjectId = (import.meta.env.VITE_SUPABASE_PROJECT_ID ?? '').trim();
if (!supabaseProjectId) missing.push('VITE_SUPABASE_PROJECT_ID');

if (missing.length > 0) {
  const msg = `[LessonLoop] Missing or invalid environment variables:\n  - ${missing.join('\n  - ')}\n\nCheck your .env file or deployment configuration.`;

  // Show the error visibly instead of throwing before React can render
  const root = document.getElementById('root');
  if (root) {
    root.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;padding:2rem;font-family:system-ui,sans-serif">
        <div style="max-width:480px;text-align:center">
          <h1 style="font-size:1.25rem;font-weight:600;margin-bottom:1rem;color:#dc2626">Configuration Error</h1>
          <p style="color:#666;font-size:0.875rem;white-space:pre-wrap">${msg}</p>
        </div>
      </div>`;
  }

  // Also log to console for debugging
  console.error(msg);

  // Throw to halt module loading — but now the user sees a message, not a blank page
  throw new Error(msg);
}

/** Validated Supabase URL */
export const SUPABASE_URL: string = supabaseUrl;

/** Validated Supabase anon/publishable key */
export const SUPABASE_PUBLISHABLE_KEY: string = supabaseKey;

/** Validated Supabase project ID */
export const SUPABASE_PROJECT_ID: string = supabaseProjectId;

/** Optional Sentry DSN — empty string if not configured */
export const SENTRY_DSN: string = (import.meta.env.VITE_SENTRY_DSN ?? '').trim();
