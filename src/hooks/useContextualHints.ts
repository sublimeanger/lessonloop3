import { useState, useCallback, useEffect } from 'react';
import { safeGetItem, safeSetItem, safeRemoveItem } from '@/lib/storage';

const HINTS_STORAGE_KEY = 'lessonloop_seen_hints';

interface SeenHints {
  [hintId: string]: boolean;
}

export function useContextualHints() {
  const [seenHints, setSeenHints] = useState<SeenHints>(() => {
    try {
      const stored = safeGetItem(HINTS_STORAGE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  const hasSeenHint = useCallback((hintId: string): boolean => {
    return !!seenHints[hintId];
  }, [seenHints]);

  const markHintAsSeen = useCallback((hintId: string) => {
    setSeenHints(prev => {
      const updated = { ...prev, [hintId]: true };
      try {
        safeSetItem(HINTS_STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // Storage full or unavailable
      }
      return updated;
    });
  }, []);

  const resetAllHints = useCallback(() => {
    setSeenHints({});
    try {
      safeRemoveItem(HINTS_STORAGE_KEY);
    } catch {
      // Storage unavailable
    }
  }, []);

  const resetHint = useCallback((hintId: string) => {
    setSeenHints(prev => {
      const updated = { ...prev };
      delete updated[hintId];
      try {
        safeSetItem(HINTS_STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // Storage unavailable
      }
      return updated;
    });
  }, []);

  return {
    hasSeenHint,
    markHintAsSeen,
    resetAllHints,
    resetHint,
  };
}

// Hook for a single hint with auto-dismiss
export function useHint(hintId: string, autoDismissMs = 5000) {
  const { hasSeenHint, markHintAsSeen } = useContextualHints();
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Only show if not seen before
    if (!hasSeenHint(hintId)) {
      // Small delay before showing hint
      const showTimer = setTimeout(() => {
        setIsVisible(true);
      }, 500);

      return () => clearTimeout(showTimer);
    }
  }, [hintId, hasSeenHint]);

  const handleDismiss = useCallback(() => {
    setIsDismissed(true);
    setIsVisible(false);
    markHintAsSeen(hintId);
  }, [hintId, markHintAsSeen]);

  useEffect(() => {
    if (isVisible && autoDismissMs > 0) {
      const hideTimer = setTimeout(() => {
        handleDismiss();
      }, autoDismissMs);

      return () => clearTimeout(hideTimer);
    }
  }, [isVisible, autoDismissMs, handleDismiss]);

  return {
    isVisible: isVisible && !isDismissed,
    dismiss: handleDismiss,
  };
}
