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

  // Messaging — anti-spam
  "send-message":          { maxRequests: 50,  windowMinutes: 60 },
  "send-bulk-message":     { maxRequests: 50,  windowMinutes: 60 },
  "send-invoice-email":    { maxRequests: 50,  windowMinutes: 60 },
  "notify-internal-message": { maxRequests: 50, windowMinutes: 60 },

  // Billing operations
  "billing-run":           { maxRequests: 10,  windowMinutes: 60 },
  "stripe-create-checkout": { maxRequests: 10, windowMinutes: 60 },
  "record-payment":        { maxRequests: 10,  windowMinutes: 60 },

  // Data imports
  "csv-import":            { maxRequests: 10,  windowMinutes: 10 },

  // GDPR
  "gdpr-export":           { maxRequests: 5,   windowMinutes: 60 },
  "gdpr-delete":           { maxRequests: 5,   windowMinutes: 60 },

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
 * Check if a request is within per-user rate limits.
 * Uses the check_rate_limit database function for atomic operations.
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

  const { data, error } = await supabase.rpc("check_rate_limit", {
    _user_id: userId,
    _action_type: actionType,
    _max_requests: limits.maxRequests,
    _window_minutes: limits.windowMinutes,
  });

  if (error) {
    console.error("Rate limit check failed:", error);
    // Fail open — allow request if rate limit check fails
    return { allowed: true };
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
    return { allowed: true }; // fail open
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
