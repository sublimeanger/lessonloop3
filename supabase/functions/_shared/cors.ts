// Shared CORS configuration for production hardening
// Uses ALLOWED_ORIGINS env var or defaults to the preview URL

const DEFAULT_ORIGIN = "https://id-preview--c541d756-90e7-442a-ba85-0c723aeabc14.lovable.app";

function getAllowedOrigins(): string[] {
  const envOrigins = Deno.env.get("ALLOWED_ORIGINS");
  if (envOrigins) {
    return envOrigins.split(",").map((o) => o.trim()).filter(Boolean);
  }
  // Default to preview URL if not configured
  return [DEFAULT_ORIGIN];
}

export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") || "";
  const allowedOrigins = getAllowedOrigins();
  
  // Check if the request origin is allowed
  const isAllowed = allowedOrigins.some((allowed) => {
    // Support wildcard subdomains (e.g., *.lovable.app)
    if (allowed.startsWith("*.")) {
      const domain = allowed.slice(2);
      return origin.endsWith(domain) || origin.endsWith(`.${domain}`);
    }
    return origin === allowed;
  });

  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : allowedOrigins[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  };
}

export function handleCorsPreflightRequest(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }
  return null;
}
