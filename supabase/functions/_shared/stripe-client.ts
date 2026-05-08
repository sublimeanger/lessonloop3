/**
 * Org-scoped Stripe client resolver.
 *
 * `getStripeClient(orgId, supabase)` looks up the org's
 * `stripe_test_mode` flag and returns a Stripe SDK instance configured
 * with the appropriate API key.
 *
 * Defaults
 * --------
 * - `stripe_test_mode = true`  → uses `STRIPE_TEST_SECRET_KEY` (test mode).
 * - `stripe_test_mode = false` → uses `STRIPE_SECRET_KEY` (live mode).
 * - column missing            → live (graceful fallback during pre-migration deploys).
 * - lookup error              → live (defensive — never silently use test key for a live org).
 * - test key missing while flag is true → throws (caller should surface to operator).
 *
 * The defensive fallback to live is **mandatory**. The expected
 * behaviour for every org that hasn't been explicitly opted in is
 * "keep working with the live key exactly as before". A bug here
 * could either break live payments or, worse, accidentally route a
 * live org through the test key (silently failing real charges).
 *
 * Returned object
 * ---------------
 * `{ stripe, mode }` — `stripe` is the configured SDK instance,
 * `mode` is `'live' | 'test'` so callers can branch (e.g. webhook
 * downstream RPCs, audit log entries) without re-querying.
 *
 * Usage
 * -----
 * ```ts
 * import Stripe from "https://esm.sh/stripe@14.21.0";
 * import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
 * import { getStripeClient } from "../_shared/stripe-client.ts";
 *
 * const supabase = createClient(...);
 * const orgId = "..."; // resolved from invoice / org_membership / etc.
 * const { stripe, mode } = await getStripeClient(orgId, supabase);
 * // stripe is a fully-configured Stripe SDK; mode is 'live' or 'test'.
 * ```
 *
 * For shared modules (e.g. `_shared/auto-pay-reminder-core.ts`) that
 * already receive a `supabase` client and an `orgId`, just call this
 * helper instead of doing `new Stripe(Deno.env.get("STRIPE_SECRET_KEY"))`.
 */
import Stripe from "https://esm.sh/stripe@14.21.0";

export type StripeMode = "live" | "test";

export interface ResolvedStripeClient {
  stripe: Stripe;
  mode: StripeMode;
}

const STRIPE_API_VERSION = "2023-10-16" as const;

/**
 * Resolve the Stripe client for an org. See module docstring for
 * fallback semantics. `orgId` may be null/undefined when the calling
 * context has no org (rare — typically only the platform billing
 * subscription endpoints which never run for end-customer money).
 * In that case we always return live, since the platform's own
 * Stripe account is the live one.
 */
export async function getStripeClient(
  orgId: string | null | undefined,
  // deno-lint-ignore no-explicit-any
  supabase: any,
): Promise<ResolvedStripeClient> {
  const liveKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!liveKey) {
    // Live key is the bedrock — without it we can't do anything Stripe-related.
    throw new Error("STRIPE_SECRET_KEY not configured");
  }

  // Helper to build a live-mode client — used in every fallback path.
  const buildLive = (): ResolvedStripeClient => ({
    stripe: new Stripe(liveKey, { apiVersion: STRIPE_API_VERSION }),
    mode: "live",
  });

  // No orgId → can't determine test mode; default to live.
  if (!orgId) return buildLive();

  // Look up the flag. Defensive on every error path — never raise to
  // caller, never silently use test key for unknown org.
  let stripeTestMode = false;
  try {
    const { data, error } = await supabase
      .from("organisations")
      .select("stripe_test_mode")
      .eq("id", orgId)
      .maybeSingle();

    if (error) {
      // PostgREST may return error code 42703 (column does not exist)
      // during the brief window between code deploy and migration apply.
      // Treat any error as "use live".
      console.warn(
        `[stripe-client] flag lookup failed for org ${orgId} — using live: ${error.message}`,
      );
      return buildLive();
    }

    // `null` (column nullable but unset) and `false` both map to live.
    stripeTestMode = data?.stripe_test_mode === true;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "unknown";
    console.warn(
      `[stripe-client] flag lookup threw for org ${orgId} — using live: ${msg}`,
    );
    return buildLive();
  }

  if (!stripeTestMode) return buildLive();

  // Test mode requested.
  const testKey = Deno.env.get("STRIPE_TEST_SECRET_KEY");
  if (!testKey) {
    // Misconfigured — flag is true but secret missing. Don't silently
    // fall back to live (that would charge a real card under what the
    // operator believed was test mode); error explicitly so the
    // problem is visible.
    throw new Error(
      `Org ${orgId} has stripe_test_mode=true but STRIPE_TEST_SECRET_KEY is not configured`,
    );
  }

  return {
    stripe: new Stripe(testKey, { apiVersion: STRIPE_API_VERSION }),
    mode: "test",
  };
}
