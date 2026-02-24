import { useState, useCallback, useEffect } from 'react';
import { safeGetItem, safeSetItem } from '@/lib/storage';
import { useOrg } from '@/contexts/OrgContext';

const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const SESSION_KEY_PREFIX = 'll_dismissed_session_';
const PERMANENT_KEY_PREFIX = 'll_dismissed_permanent_';

// ─── Low-level helpers (no React context needed) ─────────────────────

type TimestampMap = Record<string, number>;
type PermanentMap = Record<string, true>;

function getSessionMap(orgId: string): TimestampMap {
  try {
    const raw = safeGetItem(`${SESSION_KEY_PREFIX}${orgId}`);
    if (!raw) return {};
    const map: TimestampMap = JSON.parse(raw);
    // Prune expired entries
    const now = Date.now();
    let pruned = false;
    for (const key of Object.keys(map)) {
      if (now - map[key] > SESSION_TTL_MS) {
        delete map[key];
        pruned = true;
      }
    }
    if (pruned) safeSetItem(`${SESSION_KEY_PREFIX}${orgId}`, JSON.stringify(map));
    return map;
  } catch {
    return {};
  }
}

function getPermanentMap(orgId: string): PermanentMap {
  try {
    const raw = safeGetItem(`${PERMANENT_KEY_PREFIX}${orgId}`);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/** Standalone helper — works outside React. Use in mutation callbacks. */
export function dismissBannerForSession(orgId: string, key: string): void {
  const map = getSessionMap(orgId);
  map[key] = Date.now();
  safeSetItem(`${SESSION_KEY_PREFIX}${orgId}`, JSON.stringify(map));
  // Notify any mounted hooks so they re-render
  window.dispatchEvent(new CustomEvent('ll-banner-dismiss'));
}

/** Standalone helper — works outside React. */
export function dismissBannerPermanently(orgId: string, key: string): void {
  const map = getPermanentMap(orgId);
  map[key] = true;
  safeSetItem(`${PERMANENT_KEY_PREFIX}${orgId}`, JSON.stringify(map));
  window.dispatchEvent(new CustomEvent('ll-banner-dismiss'));
}

/** Check if a key is dismissed (session OR permanent) without React. */
export function isBannerDismissed(orgId: string, key: string): boolean {
  const permanent = getPermanentMap(orgId);
  if (permanent[key]) return true;
  const session = getSessionMap(orgId);
  if (session[key] && Date.now() - session[key] < SESSION_TTL_MS) return true;
  return false;
}

// ─── React hook ──────────────────────────────────────────────────────

export function useBannerDismissals() {
  const { currentOrg } = useOrg();
  const orgId = currentOrg?.id ?? '';

  // revision counter to trigger re-render on dismiss events
  const [, setRev] = useState(0);

  useEffect(() => {
    const handler = () => setRev((r) => r + 1);
    window.addEventListener('ll-banner-dismiss', handler);
    return () => window.removeEventListener('ll-banner-dismiss', handler);
  }, []);

  const isDismissed = useCallback(
    (key: string): boolean => {
      if (!orgId) return false;
      return isBannerDismissed(orgId, key);
    },
    [orgId],
  );

  const dismissForSession = useCallback(
    (key: string): void => {
      if (!orgId) return;
      dismissBannerForSession(orgId, key);
    },
    [orgId],
  );

  const dismissPermanently = useCallback(
    (key: string): void => {
      if (!orgId) return;
      dismissBannerPermanently(orgId, key);
    },
    [orgId],
  );

  const undismiss = useCallback(
    (key: string): void => {
      if (!orgId) return;
      // Remove from session
      const session = getSessionMap(orgId);
      delete session[key];
      safeSetItem(`${SESSION_KEY_PREFIX}${orgId}`, JSON.stringify(session));
      // Remove from permanent
      const permanent = getPermanentMap(orgId);
      delete permanent[key];
      safeSetItem(`${PERMANENT_KEY_PREFIX}${orgId}`, JSON.stringify(permanent));
      window.dispatchEvent(new CustomEvent('ll-banner-dismiss'));
    },
    [orgId],
  );

  return { isDismissed, dismissForSession, dismissPermanently, undismiss };
}
