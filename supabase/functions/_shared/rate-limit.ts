// Shared rate limiting utility for edge functions
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface RateLimitConfig {
  maxRequests: number;
  windowMinutes: number;
}

// Default rate limits by action type
export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  "looopassist-chat": { maxRequests: 30, windowMinutes: 5 },
  "send-message": { maxRequests: 20, windowMinutes: 5 },
  "send-invoice-email": { maxRequests: 20, windowMinutes: 5 },
  "csv-import": { maxRequests: 10, windowMinutes: 10 },
};

export interface RateLimitResult {
  allowed: boolean;
  remaining?: number;
  retryAfterSeconds?: number;
}

/**
 * Check if a request is within rate limits.
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

  const limits = config || RATE_LIMITS[actionType] || { maxRequests: 100, windowMinutes: 5 };

  const { data, error } = await supabase.rpc("check_rate_limit", {
    _user_id: userId,
    _action_type: actionType,
    _max_requests: limits.maxRequests,
    _window_minutes: limits.windowMinutes,
  });

  if (error) {
    console.error("Rate limit check failed:", error);
    // Fail open - allow request if rate limit check fails
    return { allowed: true };
  }

  if (!data) {
    // Rate limited
    return {
      allowed: false,
      retryAfterSeconds: limits.windowMinutes * 60,
    };
  }

  return { allowed: true };
}

/**
 * Create a rate limit exceeded response.
 */
export function rateLimitResponse(corsHeaders: Record<string, string>, retryAfterSeconds = 300): Response {
  return new Response(
    JSON.stringify({
      error: "Rate limit exceeded. Please wait before making more requests.",
      retryAfterSeconds,
    }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Retry-After": String(retryAfterSeconds),
      },
    }
  );
}
