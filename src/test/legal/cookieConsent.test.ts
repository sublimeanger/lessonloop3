/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { acceptAll, essentialOnly, getConsent, hasConsentDecision, setConsent } from '@/lib/cookieConsent';

function clearCookie() {
  document.cookie = 'll-consent=; path=/; max-age=0';
}

describe('cookieConsent — read/write contract', () => {
  beforeEach(() => clearCookie());
  afterEach(() => clearCookie());

  it('returns null when no consent cookie set', () => {
    expect(getConsent()).toBeNull();
    expect(hasConsentDecision()).toBe(false);
  });

  it('acceptAll persists analytics + marketing on', () => {
    acceptAll();
    const c = getConsent();
    expect(c).not.toBeNull();
    expect(c?.essential).toBe(true);
    expect(c?.analytics).toBe(true);
    expect(c?.marketing).toBe(true);
    expect(hasConsentDecision()).toBe(true);
  });

  it('essentialOnly persists analytics + marketing off', () => {
    essentialOnly();
    const c = getConsent();
    expect(c?.essential).toBe(true);
    expect(c?.analytics).toBe(false);
    expect(c?.marketing).toBe(false);
  });

  it('setConsent partial preserves essential=true', () => {
    setConsent({ analytics: true, marketing: false });
    const c = getConsent();
    expect(c?.essential).toBe(true);
    expect(c?.analytics).toBe(true);
    expect(c?.marketing).toBe(false);
  });

  it('dispatches ll-consent-changed CustomEvent on setConsent', () => {
    let received: any = null;
    const handler = (e: Event) => { received = (e as CustomEvent).detail; };
    window.addEventListener('ll-consent-changed', handler);
    try {
      acceptAll();
      expect(received).not.toBeNull();
      expect(received.analytics).toBe(true);
    } finally {
      window.removeEventListener('ll-consent-changed', handler);
    }
  });

  it('returns null on corrupted cookie value', () => {
    document.cookie = 'll-consent=not-valid-json; path=/';
    expect(getConsent()).toBeNull();
  });

  it('returns null on missing required field', () => {
    const bad = encodeURIComponent(JSON.stringify({ essential: true, analytics: true })); // missing marketing
    document.cookie = `ll-consent=${bad}; path=/`;
    expect(getConsent()).toBeNull();
  });
});
