// Shared rate limiting utility for edge functions
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface RateLimitConfig {
  maxRequests: number;
  windowMinutes: number;
}

// ── Per-user rate limits by action type ──
export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  // AI / LoopAssist — tight to control costs
  "looopassist-chat":      { maxRequests: 20,  windowMinutes: 1 },
  "looopassist-execute":   { maxRequests: 10,  windowMinutes: 1 },
  "parent-loopassist-chat": { maxRequests: 10, windowMinutes: 60 },

  // Messaging — anti-spam
  "send-message":          { maxRequests: 50,  windowMinutes: 60 },
  "send-parent-reply":     { maxRequests: 20,  windowMinutes: 60 },
  "send-parent-enquiry":   { maxRequests: 10,  windowMinutes: 60 },
  "send-parent-message":   { maxRequests: 20,  windowMinutes: 60 },
  "send-bulk-message":     { maxRequests: 50,  windowMinutes: 60 },
  "send-invite-email":     { maxRequests: 30,  windowMinutes: 60 },
  "send-invoice-email":    { maxRequests: 50,  windowMinutes: 60 },
  "notify-internal-message": { maxRequests: 50, windowMinutes: 60 },

  // Billing operations
  "billing-run":           { maxRequests: 10,  windowMinutes: 60 },
  "stripe-create-checkout": { maxRequests: 10, windowMinutes: 60 },
  "stripe-refund":         { maxRequests: 5,   windowMinutes: 60 },
  "stripe-connect-revenue": { maxRequests: 10, windowMinutes: 60 },
  "record-payment":        { maxRequests: 10,  windowMinutes: 60 },

  // Marketing chat (IP-based)
  "marketing-chat":        { maxRequests: 20,  windowMinutes: 60 },
  "marketing-chat-daily":  { maxRequests: 1000, windowMinutes: 1440 },

  // Data imports
  "csv-import":            { maxRequests: 10,  windowMinutes: 10 },

  // GDPR
  "gdpr-export":           { maxRequests: 5,   windowMinutes: 60 },
  "gdpr-delete":           { maxRequests: 5,   windowMinutes: 60 },

  // Auth flows
  "invite-accept":         { maxRequests: 10,  windowMinutes: 1 },
  "invite_get":            { maxRequests: 5,   windowMinutes: 1 },
  "profile-ensure":        { maxRequests: 5,   windowMinutes: 1 },

  // Default for regular queries
  "default":               { maxRequests: 100, windowMinutes: 1 },
};

// ── Per-org daily cap (LoopAssist) ──
const LOOPASSIST_DAILY_ORG_LIMIT = 200;

export interface RateLimitResult {
  allowed: boolean;
  remaining?: number;
  retryAfterSeconds?: number;
  message?: string;
}

/**
 * Convert a non-UUID identifier (e.g. IP address) to a deterministic UUID.
 * Uses a simple hash-to-UUID approach for rate limiting purposes.
 */
async function toUuid(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = new Uint8Array(hashBuffer);
  // Format first 16 bytes as UUID v4-like
  const hex = Array.from(hashArray.slice(0, 16))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${(parseInt(hex[16], 16) & 0x3 | 0x8).toString(16)}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

/**
 * Check if a request is within rate limits.
 * userId can be a UUID (for authenticated users) or any string like "ip:1.2.3.4"
 * (will be hashed to a deterministic UUID for storage).
 */
export async function checkRateLimit(
  userId: string,
  actionType: string,
  config?: RateLimitConfig
): Promise<RateLimitResult> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const limits = config || RATE_LIMITS[actionType] || RATE_LIMITS["default"];

  // Convert non-UUID identifiers (e.g. IP-based keys) to a deterministic UUID
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);
  const effectiveUserId = isUuid ? userId : await toUuid(userId);

  const { data, error } = await supabase.rpc("check_rate_limit", {
    _user_id: effectiveUserId,
    _action_type: actionType,
    _max_requests: limits.maxRequests,
    _window_minutes: limits.windowMinutes,
  });

  if (error) {
    console.error("Rate limit check failed:", error);
    // Fail closed — deny request if rate limit check fails
    return { allowed: false, retryAfterSeconds: 30, message: "Service temporarily unavailable. Please try again shortly." };
  }

  if (!data) {
    const retryAfterSeconds = limits.windowMinutes * 60;
    return {
      allowed: false,
      retryAfterSeconds,
      message: `Rate limit exceeded for ${actionType}. Try again in ${formatWait(retryAfterSeconds)}.`,
    };
  }

  return { allowed: true };
}

/**
 * Check per-org daily cap for LoopAssist messages.
 * Call this in addition to the per-user check for AI endpoints.
 */
export async function checkLoopAssistDailyCap(
  orgId: string
): Promise<RateLimitResult> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Count today's AI messages for this org
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  const { count, error } = await supabase
    .from("ai_messages")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("role", "user")
    .gte("created_at", startOfDay.toISOString());

  if (error) {
    console.error("LoopAssist daily cap check failed:", error);
    return { allowed: false, retryAfterSeconds: 30, message: "Service temporarily unavailable. Please try again shortly." };
  }

  const used = count ?? 0;
  if (used >= LOOPASSIST_DAILY_ORG_LIMIT) {
    // Seconds until midnight UTC
    const now = new Date();
    const midnight = new Date(now);
    midnight.setUTCHours(24, 0, 0, 0);
    const retryAfterSeconds = Math.ceil((midnight.getTime() - now.getTime()) / 1000);

    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds,
      message: `Your organisation has reached its daily limit of ${LOOPASSIST_DAILY_ORG_LIMIT} LoopAssist messages. Resets at midnight UTC.`,
    };
  }

  return { allowed: true, remaining: LOOPASSIST_DAILY_ORG_LIMIT - used };
}

/**
 * Create a 429 response with Retry-After header and clear message.
 */
export function rateLimitResponse(
  corsHeaders: Record<string, string>,
  result?: RateLimitResult
): Response {
  const retryAfter = result?.retryAfterSeconds ?? 300;
  const message =
    result?.message ??
    `Rate limit exceeded. Please wait ${formatWait(retryAfter)} before making more requests.`;

  return new Response(
    JSON.stringify({ error: message, retryAfterSeconds: retryAfter }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Retry-After": String(retryAfter),
      },
    }
  );
}

// ── Helpers ──

function formatWait(seconds: number): string {
  if (seconds >= 3600) {
    const h = Math.ceil(seconds / 3600);
    return `${h} hour${h > 1 ? "s" : ""}`;
  }
  if (seconds >= 60) {
    const m = Math.ceil(seconds / 60);
    return `${m} minute${m > 1 ? "s" : ""}`;
  }
  return `${seconds} seconds`;
}
