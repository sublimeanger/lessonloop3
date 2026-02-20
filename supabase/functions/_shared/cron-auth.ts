/**
 * Validates that a request comes from the internal cron scheduler.
 * Returns a 401 Response if unauthorized, or null if valid.
 */
export function validateCronAuth(req: Request): Response | null {
  const expectedSecret = Deno.env.get("INTERNAL_CRON_SECRET");
  const providedSecret = req.headers.get("x-cron-secret");

  if (!expectedSecret || providedSecret !== expectedSecret) {
    console.error("Unauthorized cron call attempt");
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  return null;
}
