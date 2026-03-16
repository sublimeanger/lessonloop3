// deno-lint-ignore-file no-explicit-any
export type NotifPrefKey =
  | "email_lesson_reminders"
  | "email_invoice_reminders"
  | "email_payment_receipts"
  | "email_marketing"
  | "email_makeup_offers";

/**
 * Marketing notification keys default to opt-OUT (GDPR/PECR compliance).
 * Transactional keys default to opt-IN.
 */
const MARKETING_KEYS: ReadonlySet<string> = new Set(["email_marketing"]);

/**
 * Check if a user has a specific email notification enabled.
 * When no preference row exists, transactional emails default to true
 * and marketing emails default to false (GDPR compliance — MSG-M1).
 */
export async function isNotificationEnabled(
  supabase: any,
  orgId: string,
  userId: string,
  prefKey: NotifPrefKey
): Promise<boolean> {
  const { data } = await supabase
    .from("notification_preferences")
    .select(prefKey)
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!data) return !MARKETING_KEYS.has(prefKey);
  return !!(data as Record<string, unknown>)[prefKey];
}
