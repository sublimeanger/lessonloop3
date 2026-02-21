import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

export type NotifPrefKey =
  | "email_lesson_reminders"
  | "email_invoice_reminders"
  | "email_payment_receipts"
  | "email_marketing";

/**
 * Check if a user has a specific email notification enabled.
 * Returns true if no preference row exists (opt-in by default).
 */
export async function isNotificationEnabled(
  supabase: SupabaseClient,
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

  if (!data) return true; // No prefs row = defaults (all enabled except marketing)
  return !!data[prefKey];
}
