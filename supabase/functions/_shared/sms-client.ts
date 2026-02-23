/**
 * Twilio SMS client using Account SID + Auth Token authentication.
 * Uses the REST API directly (no SDK — compatible with Deno).
 */

const TWILIO_API_BASE = "https://api.twilio.com/2010-04-01";

export interface SmsResult {
  success: boolean;
  sid?: string;
  error?: string;
}

/**
 * Validate an E.164 phone number.
 */
export function isValidE164(phone: string): boolean {
  return /^\+[1-9]\d{6,14}$/.test(phone);
}

/**
 * Normalize a UK phone number to E.164 format.
 * Returns null if the number cannot be normalized.
 */
export function normalizeUkPhone(raw: string): string | null {
  if (!raw) return null;
  let cleaned = raw.replace(/[\s\-\(\)]/g, "");

  // Already valid E.164
  if (isValidE164(cleaned)) return cleaned;

  // Starts with 0044
  if (cleaned.startsWith("0044") && cleaned.length === 14) {
    cleaned = "+44" + cleaned.slice(4);
  }
  // Starts with 44 (no +)
  else if (cleaned.startsWith("44") && cleaned.length === 12) {
    cleaned = "+" + cleaned;
  }
  // UK number starting with 0
  else if (cleaned.startsWith("0") && cleaned.length === 11) {
    cleaned = "+44" + cleaned.slice(1);
  }

  return isValidE164(cleaned) ? cleaned : null;
}

/**
 * Send an SMS via Twilio REST API.
 *
 * Required env vars:
 *   TWILIO_ACCOUNT_SID — Account SID (AC...)
 *   TWILIO_AUTH_TOKEN  — Auth Token
 */
export async function sendSms(
  to: string,
  from: string,
  body: string,
): Promise<SmsResult> {
  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");

  if (!accountSid || !authToken) {
    return { success: false, error: "Twilio credentials not configured" };
  }

  if (!isValidE164(to)) {
    return { success: false, error: `Invalid recipient phone: ${to}` };
  }

  if (!isValidE164(from)) {
    return { success: false, error: `Invalid sender phone: ${from}` };
  }

  // Twilio uses Basic Auth: base64(AccountSid:AuthToken)
  const credentials = btoa(`${accountSid}:${authToken}`);

  const response = await fetch(
    `${TWILIO_API_BASE}/Accounts/${accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: from, Body: body }),
    },
  );

  const result = await response.json();

  if (response.ok) {
    return { success: true, sid: result.sid };
  }

  return {
    success: false,
    error: `Twilio error ${result.code}: ${result.message}`,
  };
}
