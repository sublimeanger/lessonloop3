import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'lessonloop_onboarding_draft';

export interface OnboardingDraft {
  currentStep: number;
  fullName: string;
  phone: string;
  orgName: string;
  orgType: 'solo_teacher' | 'studio' | 'academy' | 'agency';
  instruments: string[];
  defaultLessonLength: string;
  teachingAddress: string;
  defaultRate: string;
  locationName: string;
  locationAddress: string;
  locationCity: string;
  locationPostcode: string;
  billingApproach: 'monthly' | 'termly' | 'custom';
  lastSaved: number;
}

const defaultDraft: OnboardingDraft = {
  currentStep: 0,
  fullName: '',
  phone: '',
  orgName: '',
  orgType: 'solo_teacher',
  instruments: [],
  defaultLessonLength: '60',
  teachingAddress: '',
  defaultRate: '45',
  locationName: '',
  locationAddress: '',
  locationCity: '',
  locationPostcode: '',
  billingApproach: 'monthly',
  lastSaved: 0,
};

export function useOnboardingDraft() {
  const [draft, setDraftState] = useState<OnboardingDraft>(defaultDraft);
  const [hasRestoredDraft, setHasRestoredDraft] = useState(false);

  // Load draft from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as OnboardingDraft;
        // Only restore if saved within last 24 hours
        const isRecent = Date.now() - parsed.lastSaved < 24 * 60 * 60 * 1000;
        if (isRecent && parsed.currentStep > 0) {
          setDraftState(parsed);
          setHasRestoredDraft(true);
        }
      }
    } catch (e) {
      console.warn('Failed to restore onboarding draft:', e);
    }
  }, []);

  // Save draft to localStorage whenever it changes
  const setDraft = useCallback((updates: Partial<OnboardingDraft>) => {
    setDraftState((prev) => {
      const updated = { ...prev, ...updates, lastSaved: Date.now() };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        console.warn('Failed to save onboarding draft:', e);
      }
      return updated;
    });
  }, []);

  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.warn('Failed to clear onboarding draft:', e);
    }
    setDraftState(defaultDraft);
    setHasRestoredDraft(false);
  }, []);

  const dismissRestoredNotice = useCallback(() => {
    setHasRestoredDraft(false);
  }, []);

  return {
    draft,
    setDraft,
    clearDraft,
    hasRestoredDraft,
    dismissRestoredNotice,
  };
}
