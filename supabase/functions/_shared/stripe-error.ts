/**
 * Shared error-classification helper for Stripe edge functions.
 *
 * History: the s24/s27/s28 throw-into-outer-catch class-bug sweep fixed
 * malformed-body 500s. Sibling concern (deferred from s28, closed s29):
 * 9 stripe-* fns echo `error.message` verbatim in response body via
 * `JSON.stringify({error: error.message})`. The pattern is intentional
 * UX-string control flow (`throw new Error("Invoice already paid")` so
 * the parent portal can display the message), but it also leaks raw
 * Stripe SDK / DB errors when an unexpected exception fires.
 *
 * This helper takes an explicit allow-list of known business-logic
 * messages with their HTTP status, plus optional prefix matchers for
 * templated strings (e.g., "Invoice cannot be paid (status: void)").
 *
 * - Known msg → return msg + mapped status (4xx). Frontend UX preserved.
 * - Templated prefix match → return msg + mapped status. Same.
 * - Unknown msg → return generic + 500. Stripe/DB errors don't leak.
 *
 * All paths log the full original message to console for Sentry capture.
 *
 * Usage in an edge fn:
 *
 *   import { classifyAndRespond, type SafeErrorMap } from "../_shared/stripe-error.ts";
 *
 *   const SAFE_MESSAGES: SafeErrorMap = {
 *     exact: {
 *       "Unauthorized": 401,
 *       "invoiceId is required": 400,
 *       "Invoice not found": 404,
 *       // ...
 *     },
 *     prefix: {
 *       "Invoice cannot be paid (status: ": 400,
 *       "Maximum refundable amount is ": 400,
 *     },
 *   };
 *
 *   } catch (error: unknown) {
 *     return classifyAndRespond(error, SAFE_MESSAGES, corsHeaders, "fn-name");
 *   }
 */

export interface SafeErrorMap {
  /** Exact-match messages → HTTP status. */
  exact: Record<string, number>;
  /** Messages that start with a key → HTTP status. Use for templated throws. */
  prefix?: Record<string, number>;
}

const GENERIC_INTERNAL = "An internal error occurred. Please try again.";

export function classifyAndRespond(
  error: unknown,
  safeMap: SafeErrorMap,
  corsHeaders: Record<string, string>,
  fnName: string,
): Response {
  const message = error instanceof Error ? error.message : "Unknown error";

  // Always log the full message for Sentry / debug visibility.
  console.error(`[${fnName}] Unhandled error:`, message);

  // Exact match — return the business-logic message + appropriate status.
  if (Object.prototype.hasOwnProperty.call(safeMap.exact, message)) {
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: safeMap.exact[message],
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  // Prefix match — for templated throws like "Invoice cannot be paid (status: void)".
  if (safeMap.prefix) {
    for (const [pfx, status] of Object.entries(safeMap.prefix)) {
      if (message.startsWith(pfx)) {
        return new Response(
          JSON.stringify({ error: message }),
          {
            status,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    }
  }

  // Unknown error — could be Stripe SDK, DB, or unexpected runtime error.
  // Return generic 500. The full message is in console.error above.
  return new Response(
    JSON.stringify({ error: GENERIC_INTERNAL }),
    {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}
