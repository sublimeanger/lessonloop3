/**
 * Phone number validation and formatting utilities.
 */

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
  let cleaned = raw.replace(/[\s\-()]/g, '');

  // Already valid E.164
  if (isValidE164(cleaned)) return cleaned;

  // Starts with 0044
  if (cleaned.startsWith('0044') && cleaned.length === 14) {
    cleaned = '+44' + cleaned.slice(4);
  }
  // Starts with 44 (no +)
  else if (cleaned.startsWith('44') && cleaned.length === 12) {
    cleaned = '+' + cleaned;
  }
  // UK number starting with 0
  else if (cleaned.startsWith('0') && cleaned.length === 11) {
    cleaned = '+44' + cleaned.slice(1);
  }

  return isValidE164(cleaned) ? cleaned : null;
}

/**
 * Format an E.164 phone number for display.
 * +447700900123 → +44 7700 900123
 */
export function formatPhoneDisplay(e164: string): string {
  if (e164.startsWith('+44') && e164.length === 13) {
    return `+44 ${e164.slice(3, 7)} ${e164.slice(7)}`;
  }
  return e164;
}
