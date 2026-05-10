/**
 * Cookie consent state management.
 *
 * GDPR / UK DPA requires explicit consent for non-essential cookies + tracking.
 * We persist the consent decision in a `ll-consent` cookie (365d expiry) and
 * expose helpers + a custom event for analytics modules to gate themselves.
 *
 * Categories:
 * - essential: always on (auth, RLS-scoped queries, CSRF). Never opt-out.
 * - analytics: opt-in. Currently unused — when added, must check
 *   getConsent().analytics before initialising.
 * - marketing: opt-in. Currently unused; placeholder for future tracking.
 */

const COOKIE_NAME = 'll-consent';
const COOKIE_MAX_AGE_SECS = 365 * 24 * 60 * 60;

export interface CookieConsent {
  essential: true;
  analytics: boolean;
  marketing: boolean;
  ts: string;
}

const DEFAULT_CONSENT: CookieConsent = {
  essential: true,
  analytics: false,
  marketing: false,
  ts: new Date(0).toISOString(),
};

/** Read the current consent from the cookie. Returns null if no decision yet. */
export function getConsent(): CookieConsent | null {
  if (typeof document === 'undefined') return null;
  const raw = document.cookie.split('; ').find((c) => c.startsWith(`${COOKIE_NAME}=`));
  if (!raw) return null;
  try {
    const value = decodeURIComponent(raw.split('=').slice(1).join('='));
    const parsed = JSON.parse(value);
    if (parsed && parsed.essential === true && typeof parsed.analytics === 'boolean' && typeof parsed.marketing === 'boolean') {
      return parsed;
    }
  } catch { /* ignore corrupted cookie */ }
  return null;
}

/** Has the user made a consent decision? */
export function hasConsentDecision(): boolean {
  return getConsent() !== null;
}

/** Persist a consent decision + dispatch a custom event for analytics modules to react. */
export function setConsent(partial: Partial<Omit<CookieConsent, 'essential' | 'ts'>>): void {
  if (typeof document === 'undefined') return;
  const consent: CookieConsent = {
    ...DEFAULT_CONSENT,
    ...partial,
    essential: true,
    ts: new Date().toISOString(),
  };
  const value = encodeURIComponent(JSON.stringify(consent));
  // SameSite=Lax for first-party only; Secure on https; root path so all
  // routes see it.
  const secure = typeof location !== 'undefined' && location.protocol === 'https:';
  document.cookie = `${COOKIE_NAME}=${value}; path=/; max-age=${COOKIE_MAX_AGE_SECS}; SameSite=Lax${secure ? '; Secure' : ''}`;

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ll-consent-changed', { detail: consent }));
  }
}

/** Convenience: accept all categories. */
export function acceptAll(): void {
  setConsent({ analytics: true, marketing: true });
}

/** Convenience: essential only (analytics + marketing off). */
export function essentialOnly(): void {
  setConsent({ analytics: false, marketing: false });
}
