/**
 * Higher-level SMS helpers: eligibility checks, logging, and sending.
 */
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { sendSms, isValidE164 } from "./sms-client.ts";

export type SmsPrefKey =
  | "sms_lesson_reminders"
  | "sms_invoice_reminders"
  | "sms_payment_receipts"
  | "sms_lesson_cancellations";

/**
 * Check if SMS is eligible for an org and return the sending number.
 *
 * Checks:
 * 1. Organisation subscription is active or trialing (not expired)
 * 2. org_sms_settings.sms_enabled = true
 * 3. twilio_phone_number is set and valid E.164
 */
export async function getOrgSmsConfig(
  supabase: SupabaseClient,
  orgId: string,
): Promise<{ enabled: false } | { enabled: true; fromNumber: string }> {
  // Check subscription is active or trialing
  const { data: org } = await supabase
    .from("organisations")
    .select("subscription_status, trial_ends_at")
    .eq("id", orgId)
    .single();

  if (!org) return { enabled: false };

  const isActive = org.subscription_status === "active";
  const isTrialing =
    org.subscription_status === "trialing" &&
    org.trial_ends_at &&
    new Date(org.trial_ends_at) > new Date();

  if (!isActive && !isTrialing) {
    return { enabled: false };
  }

  const { data: smsSettings } = await supabase
    .from("org_sms_settings")
    .select("sms_enabled, twilio_phone_number")
    .eq("org_id", orgId)
    .single();

  if (
    !smsSettings?.sms_enabled ||
    !smsSettings.twilio_phone_number ||
    !isValidE164(smsSettings.twilio_phone_number)
  ) {
    return { enabled: false };
  }

  return { enabled: true, fromNumber: smsSettings.twilio_phone_number };
}

/**
 * Check if a guardian has opted into SMS for a specific notification type.
 * Returns false if no prefs row exists (opt-in model for SMS).
 */
export async function isSmsOptedIn(
  supabase: SupabaseClient,
  orgId: string,
  userId: string | null,
  prefKey: SmsPrefKey,
): Promise<boolean> {
  if (!userId) return false;

  const { data } = await supabase
    .from("notification_preferences")
    .select(prefKey)
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!data) return false; // No prefs row = SMS defaults to off
  return !!data[prefKey];
}

/**
 * Send an SMS, log it to message_log, and update the monthly counter.
 * Appends a UK Ofcom-compliant opt-out footer.
 */
export async function logAndSendSms(
  supabase: SupabaseClient,
  opts: {
    orgId: string;
    fromNumber: string;
    recipientPhone: string;
    recipientName: string;
    recipientEmail?: string;
    recipientId: string;
    relatedId: string;
    messageType: string;
    body: string;
  },
): Promise<boolean> {
  // Append opt-out footer (UK Ofcom compliance)
  const fullBody = `${opts.body}\n\nReply STOP to opt out.`;

  // Insert pending log entry
  const { data: logEntry, error: logError } = await supabase
    .from("message_log")
    .insert({
      org_id: opts.orgId,
      channel: "sms",
      subject: opts.messageType,
      body: fullBody,
      sender_user_id: null,
      recipient_phone: opts.recipientPhone,
      recipient_email: opts.recipientEmail || null,
      recipient_name: opts.recipientName,
      recipient_type: "guardian",
      recipient_id: opts.recipientId,
      related_id: opts.relatedId,
      message_type: opts.messageType,
      status: "pending",
    })
    .select("id")
    .single();

  if (logError) {
    console.error("Failed to log SMS:", logError);
  }

  const result = await sendSms(opts.recipientPhone, opts.fromNumber, fullBody);

  if (logEntry) {
    await supabase
      .from("message_log")
      .update({
        status: result.success ? "sent" : "failed",
        sent_at: result.success ? new Date().toISOString() : null,
        error_message: result.success ? null : result.error,
      })
      .eq("id", logEntry.id);
  }

  // Increment monthly counter on success
  if (result.success) {
    await supabase.rpc("increment_sms_counter", { _org_id: opts.orgId }).catch(
      (err: Error) => console.error("Failed to increment SMS counter:", err),
    );
  }

  if (!result.success) {
    console.error(
      `SMS send failed to ${opts.recipientPhone}: ${result.error}`,
    );
  }

  return result.success;
}

/**
 * Full SMS eligibility check + send orchestrator.
 * Checks: org config → guardian phone valid → guardian sms_opted_in → pref → send.
 */
export async function maybeSendSms(
  supabase: SupabaseClient,
  opts: {
    orgId: string;
    guardianId: string;
    guardianPhone: string | null | undefined;
    guardianEmail?: string | null;
    guardianUserId: string | null | undefined;
    guardianName: string;
    guardianSmsOptedIn?: boolean;
    smsPrefKey: SmsPrefKey;
    relatedId: string;
    messageType: string;
    body: string;
  },
): Promise<{ sent: boolean; reason?: string }> {
  // 1. Check org SMS config
  const smsConfig = await getOrgSmsConfig(supabase, opts.orgId);
  if (!smsConfig.enabled) {
    return { sent: false, reason: "org_sms_disabled" };
  }

  // 2. Check guardian has valid phone
  if (!opts.guardianPhone || !isValidE164(opts.guardianPhone)) {
    return { sent: false, reason: "invalid_phone" };
  }

  // 3. Check guardian master SMS opt-in (if provided)
  if (opts.guardianSmsOptedIn === false) {
    return { sent: false, reason: "guardian_not_opted_in" };
  }

  // 4. Check notification preference
  const optedIn = await isSmsOptedIn(
    supabase,
    opts.orgId,
    opts.guardianUserId ?? null,
    opts.smsPrefKey,
  );
  if (!optedIn) {
    return { sent: false, reason: "pref_disabled" };
  }

  // 5. Send
  const success = await logAndSendSms(supabase, {
    orgId: opts.orgId,
    fromNumber: smsConfig.fromNumber,
    recipientPhone: opts.guardianPhone,
    recipientName: opts.guardianName,
    recipientEmail: opts.guardianEmail ?? undefined,
    recipientId: opts.guardianId,
    relatedId: opts.relatedId,
    messageType: opts.messageType,
    body: opts.body,
  });

  return { sent: success, reason: success ? undefined : "send_failed" };
}
