import { useState, useCallback, useEffect, useRef } from 'react';
import { safeGetItem, safeSetItem, safeRemoveItem } from '@/lib/storage';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOrg } from '@/contexts/OrgContext';

const HINTS_STORAGE_KEY = 'lessonloop_seen_hints';

interface HintConfig {
  /** Roles that should see this hint. Empty = all roles. */
  roles?: string[];
  /** Feature gate — hint only shows if user has access to this feature */
  feature?: string;
  /** Minimum delay after page load before showing (ms) */
  delayMs?: number;
  /** Auto-dismiss after this many ms. 0 = manual dismiss only */
  autoDismissMs?: number;
  /** Condition function — hint only shows when this returns true */
  condition?: () => boolean;
}

// Central hint registry — all hints defined here
export const HINT_REGISTRY: Record<string, HintConfig> = {
  // Dashboard hints
  'dashboard-welcome': { roles: ['owner', 'admin'], delayMs: 1000, autoDismissMs: 0 },
  'dashboard-quick-actions': { roles: ['owner', 'admin', 'teacher'], delayMs: 500, autoDismissMs: 8000 },
  'dashboard-loopassist': { roles: ['owner', 'admin', 'teacher'], delayMs: 2000, autoDismissMs: 0 },

  // Calendar hints
  'calendar-create-lesson': { roles: ['owner', 'admin', 'teacher'], delayMs: 800, autoDismissMs: 0 },
  'calendar-drag-reschedule': { roles: ['owner', 'admin', 'teacher'], delayMs: 1500, autoDismissMs: 8000 },
  'calendar-filters': { roles: ['owner', 'admin'], delayMs: 2000, autoDismissMs: 8000 },
  'calendar-slot-generator': { roles: ['owner', 'admin', 'teacher'], delayMs: 2500, autoDismissMs: 0 },

  // Register hints
  'register-keyboard-shortcuts': { roles: ['owner', 'admin', 'teacher'], delayMs: 1000, autoDismissMs: 0 },
  'register-batch-mode': { roles: ['owner', 'admin'], delayMs: 1500, autoDismissMs: 8000 },

  // Students hints
  'students-add-first': { roles: ['owner', 'admin'], delayMs: 800, autoDismissMs: 0 },
  'students-import': { roles: ['owner', 'admin'], delayMs: 1500, autoDismissMs: 8000 },
  'students-guardian-link': { roles: ['owner', 'admin'], delayMs: 2000, autoDismissMs: 8000 },

  // Invoice hints
  'invoices-billing-run': { roles: ['owner', 'admin'], feature: 'billing_runs', delayMs: 1000, autoDismissMs: 0 },
  'invoices-send': { roles: ['owner', 'admin', 'finance'], delayMs: 1500, autoDismissMs: 8000 },

  // Locations hints
  'locations-add-room': { roles: ['owner', 'admin'], delayMs: 1000, autoDismissMs: 8000 },

  // Teacher-specific hints
  'teacher-my-schedule': { roles: ['teacher'], delayMs: 800, autoDismissMs: 0 },
  'teacher-attendance': { roles: ['teacher'], delayMs: 1000, autoDismissMs: 0 },
  'teacher-notes': { roles: ['teacher'], delayMs: 1500, autoDismissMs: 8000 },

  // Parent portal hints
  'portal-welcome': { roles: ['parent'], delayMs: 800, autoDismissMs: 0 },
  'portal-schedule': { roles: ['parent'], delayMs: 1000, autoDismissMs: 0 },
  'portal-practice': { roles: ['parent'], feature: 'practice_tracking', delayMs: 1500, autoDismissMs: 8000 },
  'portal-messages': { roles: ['parent'], delayMs: 2000, autoDismissMs: 8000 },
  'portal-child-switcher': { roles: ['parent'], delayMs: 1000, autoDismissMs: 0 },

  // Settings hints (owner only)
  'settings-terms': { roles: ['owner', 'admin'], delayMs: 1000, autoDismissMs: 0 },
  'settings-make-up-policy': { roles: ['owner', 'admin'], delayMs: 1500, autoDismissMs: 8000 },

  // LoopAssist hint
  'loopassist-first-use': { roles: ['owner', 'admin', 'teacher'], delayMs: 500, autoDismissMs: 0 },

  // Practice hints
  'practice-assignments': { roles: ['owner', 'admin', 'teacher'], feature: 'practice_tracking', delayMs: 1000, autoDismissMs: 0 },
};

export function useContextualHints() {
  const { user } = useAuth();
  const { currentRole } = useOrg();
  const [seenHints, setSeenHints] = useState<Record<string, boolean>>(() => {
    try {
      const stored = safeGetItem(HINTS_STORAGE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch { return {}; }
  });
  const supabaseSynced = useRef(false);

  // Sync from Supabase on mount (merge with localStorage)
  useEffect(() => {
    if (!user || supabaseSynced.current) return;
    supabaseSynced.current = true;

    supabase
      .from('hint_completions')
      .select('hint_id')
      .eq('user_id', user.id)
      .then(({ data }) => {
        if (data && data.length > 0) {
          setSeenHints(prev => {
            const merged = { ...prev };
            data.forEach(row => { merged[row.hint_id] = true; });
            safeSetItem(HINTS_STORAGE_KEY, JSON.stringify(merged));
            return merged;
          });
        }
      });
  }, [user]);

  const hasSeenHint = useCallback((hintId: string): boolean => {
    return !!seenHints[hintId];
  }, [seenHints]);

  const markHintAsSeen = useCallback((hintId: string) => {
    setSeenHints(prev => {
      const updated = { ...prev, [hintId]: true };
      safeSetItem(HINTS_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });

    // Fire-and-forget Supabase persist
    if (user) {
      supabase
        .from('hint_completions')
        .upsert({ user_id: user.id, hint_id: hintId }, { onConflict: 'user_id,hint_id' })
        .then(() => {});
    }
  }, [user]);

  const shouldShowHint = useCallback((hintId: string): boolean => {
    if (hasSeenHint(hintId)) return false;

    const config = HINT_REGISTRY[hintId];
    if (!config) return true; // Unknown hint — show by default

    // Role check
    if (config.roles && config.roles.length > 0 && currentRole) {
      if (!config.roles.includes(currentRole)) return false;
    }

    // Condition check
    if (config.condition && !config.condition()) return false;

    return true;
  }, [hasSeenHint, currentRole]);

  const resetAllHints = useCallback(() => {
    setSeenHints({});
    safeRemoveItem(HINTS_STORAGE_KEY);

    if (user) {
      supabase
        .from('hint_completions')
        .delete()
        .eq('user_id', user.id)
        .then(() => {});
    }
  }, [user]);

  return {
    hasSeenHint,
    markHintAsSeen,
    shouldShowHint,
    resetAllHints,
    seenHints,
  };
}

// Single-hint hook (used by ContextualHint component)
export function useHint(hintId: string, autoDismissMs?: number) {
  const { shouldShowHint, markHintAsSeen } = useContextualHints();
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  const config = HINT_REGISTRY[hintId];
  const delay = config?.delayMs ?? 500;
  const autoMs = autoDismissMs ?? config?.autoDismissMs ?? 0;

  useEffect(() => {
    if (!shouldShowHint(hintId)) return;

    const showTimer = setTimeout(() => {
      setIsVisible(true);
    }, delay);

    return () => clearTimeout(showTimer);
  }, [hintId, shouldShowHint, delay]);

  useEffect(() => {
    if (isVisible && autoMs > 0) {
      const hideTimer = setTimeout(() => {
        handleDismiss();
      }, autoMs);
      return () => clearTimeout(hideTimer);
    }
  }, [isVisible, autoMs]);

  const handleDismiss = useCallback(() => {
    setIsDismissed(true);
    setIsVisible(false);
    markHintAsSeen(hintId);
  }, [hintId, markHintAsSeen]);

  return {
    isVisible: isVisible && !isDismissed,
    dismiss: handleDismiss,
  };
}
