/**
 * Shadow-mode email interception layer.
 *
 * When an organisation has `shadow_mode = true`, all outbound emails
 * are routed to SHADOW_RECIPIENTS (currently Jamie + Lauren only)
 * with a visible "would have sent to" banner. This lets Lauren drive
 * the app end-to-end with real Resend delivery during the shadow
 * programme, without ever risking a real email reaching a real
 * student/guardian seeded into the shadow org.
 *
 * For non-shadow orgs (the vast majority): pass-through, no change.
 *
 * SAFETY:
 * - Default behaviour for any error path is pass-through. A bug
 *   that breaks the org lookup must NOT silently route a real org's
 *   emails to shadow recipients.
 * - SHADOW_RECIPIENTS env unset → pass-through. No accidental
 *   email blackhole during dev.
 * - orgId null/undefined → pass-through. No way to determine shadow
 *   status without it.
 */

const SHADOW_RECIPIENTS = (Deno.env.get("SHADOW_RECIPIENTS") || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export interface ShadowableEmailPayload {
  to: string[];
  subject: string;
  html: string;
  from?: string;
  reply_to?: string;
  // Pass-through any other Resend fields without touching them.
  [key: string]: unknown;
}

export interface ShadowContext {
  orgId: string | null | undefined;
  // deno-lint-ignore no-explicit-any
  supabase: any; // service-role client
}

/** Returns true if shadow recipients are configured (helper for callers
 *  that want to know up-front whether shadow interception is even
 *  possible without doing the DB lookup). */
export function shadowConfigured(): boolean {
  return SHADOW_RECIPIENTS.length > 0;
}

/**
 * Intercept an email payload for shadow-mode orgs.
 *
 * - orgId resolves to non-shadow org (default) → return payload unchanged.
 * - orgId resolves to shadow_mode=true → return rewritten payload with
 *   to=SHADOW_RECIPIENTS, subject prefixed [SHADOW: <org-prefix>],
 *   and a banner div prepended to the HTML body showing the original
 *   recipients + org_id.
 *
 * Always pass-through on any error.
 */
export async function transformEmailForShadow(
  payload: ShadowableEmailPayload,
  ctx: ShadowContext,
): Promise<ShadowableEmailPayload> {
  if (!ctx.orgId) return payload;
  if (SHADOW_RECIPIENTS.length === 0) return payload;

  let isShadow = false;
  try {
    const { data } = await ctx.supabase
      .from("organisations")
      .select("shadow_mode")
      .eq("id", ctx.orgId)
      .maybeSingle();
    isShadow = data?.shadow_mode === true;
  } catch {
    return payload;
  }

  if (!isShadow) return payload;

  const orgPrefix = String(ctx.orgId).slice(0, 8);
  const originalTo = payload.to.join(", ");

  const banner = `<div style="background:#fffbe6;padding:14px;border:2px solid #f59e0b;margin-bottom:16px;border-radius:6px;font-family:system-ui,sans-serif;">
  <strong style="color:#92400e;font-size:16px;">📧 SHADOW MODE — INTERCEPTED</strong>
  <div style="color:#78350f;margin-top:6px;font-size:14px;line-height:1.5;">
    This email would have been sent to: <strong>${originalTo}</strong><br>
    Routed to shadow recipients only.<br>
    Org ID: <code style="background:#fef3c7;padding:2px 6px;border-radius:3px;">${ctx.orgId}</code>
  </div>
</div>`;

  return {
    ...payload,
    to: SHADOW_RECIPIENTS,
    subject: `[SHADOW: ${orgPrefix}] ${payload.subject}`,
    html: banner + payload.html,
  };
}
