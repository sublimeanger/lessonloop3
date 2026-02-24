// Hardened CORS configuration for Supabase Edge Functions
// Reads ALLOWED_ORIGINS from env, falls back to known production/preview domains

const DEFAULT_ORIGINS = [
  "https://lessonloop.net",
  "https://www.lessonloop.net",
  "https://app.lessonloop.net",
  "https://lessonloop3.lovable.app",
  "https://id-preview--c541d756-90e7-442a-ba85-0c723aeabc14.lovable.app",
];

// Localhost origins only allowed when explicitly enabled via environment variable
const DEV_ORIGINS = Deno.env.get("ALLOW_LOCALHOST_CORS") === "true"
  ? ["http://localhost:5173", "http://localhost:8080"]
  : [];

// Wildcard suffixes that are always allowed (Lovable preview/project domains)
const WILDCARD_SUFFIXES = [
  ".lovable.app",
  ".lovableproject.com",
];

function getAllowedOrigins(): string[] {
  const envOrigins = Deno.env.get("ALLOWED_ORIGINS");
  if (envOrigins) {
    return envOrigins.split(",").map((o) => o.trim()).filter(Boolean);
  }
  return [...DEFAULT_ORIGINS, ...DEV_ORIGINS];
}

function isOriginAllowed(origin: string): boolean {
  if (!origin) return false;

  const allowed = getAllowedOrigins();
  if (allowed.includes(origin)) return true;

  // Check wildcard suffixes (must be full https:// URLs ending with the suffix)
  for (const suffix of WILDCARD_SUFFIXES) {
    if (origin.startsWith("https://") && origin.endsWith(suffix)) {
      return true;
    }
  }

  return false;
}

const STANDARD_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Max-Age": "86400",
  "Vary": "Origin",
};

/**
 * Returns CORS headers for the given request.
 * If the origin is not in the allow-list, Access-Control-Allow-Origin is omitted,
 * which causes the browser to block the response.
 */
export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") || "";

  if (isOriginAllowed(origin)) {
    return {
      "Access-Control-Allow-Origin": origin,
      ...STANDARD_HEADERS,
    };
  }

  // Origin not allowed — return headers without Allow-Origin so the browser rejects it
  return { ...STANDARD_HEADERS };
}

/**
 * If the request is an OPTIONS preflight, return a 204 with CORS headers.
 * Otherwise returns null so the caller can continue processing.
 */
export function handleCorsPreflightRequest(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: getCorsHeaders(req) });
  }
  return null;
}
