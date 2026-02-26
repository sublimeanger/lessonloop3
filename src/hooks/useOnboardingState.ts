import { useState, useCallback, useRef, useEffect } from 'react';
import type { ColumnMapping, TargetField } from '@/hooks/useStudentsImport';

// ── Types ──────────────────────────────────────────────────────────────────

export type OrgType = 'solo_teacher' | 'studio' | 'academy' | 'agency';
export type SubscriptionPlan = 'solo_teacher' | 'academy' | 'agency';
export type OnboardingStep = 'welcome' | 'teaching' | 'migration' | 'plan' | 'loading' | 'success' | 'error';
export type MigrationChoice = 'switching' | 'fresh' | 'later';

/** Visible wizard steps (excludes loading/success/error) */
export const VISIBLE_STEPS = [
  { id: 'welcome' as const, label: 'Welcome' },
  { id: 'teaching' as const, label: 'About You' },
  { id: 'migration' as const, label: 'Your Data' },
  { id: 'plan' as const, label: 'Plan' },
];

export interface ImportData {
  sourceSoftware: string;
  headers: string[];
  rows: string[][];
  mappings: ColumnMapping[];
  targetFields: TargetField[];
  warnings: string[];
  detectedSource: string | null;
  importLessons: boolean;
  summary: { students: number; guardians: number; lessons: number } | null;
}

export interface ImportResult {
  studentsCreated: number;
  guardiansCreated: number;
  linksCreated: number;
  lessonsCreated: number;
  errors: string[];
}

export interface OnboardingState {
  // Step 1: Welcome
  fullName: string;
  orgType: OrgType;
  // Step 2: Teaching profile
  orgName: string;
  teamSize: string;
  locationCount: string;
  studentCount: string;
  instruments: string[];
  alsoTeaches: boolean;
  // Step 3: Migration
  migrationChoice: MigrationChoice | null;
  importData: ImportData | null;
  // Step 4: Plan
  selectedPlan: SubscriptionPlan;
  // Navigation
  currentStep: OnboardingStep;
}

// ── Session storage persistence ────────────────────────────────────────────

const STORAGE_KEY = 'lessonloop-onboarding-v2';

/** Serializable subset — excludes large import rows to keep storage small */
interface PersistedState {
  fullName: string;
  orgType: OrgType;
  orgName: string;
  teamSize: string;
  locationCount: string;
  studentCount: string;
  instruments: string[];
  alsoTeaches: boolean;
  migrationChoice: MigrationChoice | null;
  selectedPlan: SubscriptionPlan;
  currentStep: OnboardingStep;
  hasImportData: boolean;
}

function saveState(state: OnboardingState) {
  try {
    const serializable: PersistedState = {
      fullName: state.fullName,
      orgType: state.orgType,
      orgName: state.orgName,
      teamSize: state.teamSize,
      locationCount: state.locationCount,
      studentCount: state.studentCount,
      instruments: state.instruments,
      alsoTeaches: state.alsoTeaches,
      migrationChoice: state.migrationChoice,
      selectedPlan: state.selectedPlan,
      currentStep: state.currentStep,
      hasImportData: !!state.importData,
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
  } catch { /* storage unavailable */ }
}

function loadState(): PersistedState | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function clearOnboardingState() {
  try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useOnboardingState(initialName?: string) {
  const saved = useRef(loadState());
  const hasEditedOrgName = useRef(!!saved.current?.orgName);

  const [state, setState] = useState<OnboardingState>(() => {
    const s = saved.current;
    const validStep = (step: OnboardingStep | undefined): OnboardingStep => {
      if (step === 'loading' || step === 'error' || step === 'success') return 'plan';
      return step || 'welcome';
    };
    return {
      fullName: s?.fullName || initialName || '',
      orgType: s?.orgType || 'solo_teacher',
      orgName: s?.orgName || '',
      teamSize: s?.teamSize || '',
      locationCount: s?.locationCount || '',
      studentCount: s?.studentCount || '',
      instruments: s?.instruments || [],
      alsoTeaches: s?.alsoTeaches || false,
      migrationChoice: s?.migrationChoice || null,
      importData: null, // Never restored from storage (too large)
      selectedPlan: s?.selectedPlan || 'academy',
      currentStep: validStep(s?.currentStep),
    };
  });

  // Pre-fill name from auth when it becomes available
  useEffect(() => {
    if (initialName && !saved.current?.fullName && !state.fullName) {
      setState(prev => ({ ...prev, fullName: initialName }));
    }
  }, [initialName]);

  // Auto-generate org name when name or type changes (unless manually edited)
  useEffect(() => {
    if (hasEditedOrgName.current) return;
    const name = state.fullName.trim();
    if (!name) {
      if (state.orgName) setState(prev => ({ ...prev, orgName: '' }));
      return;
    }
    const firstName = name.split(' ')[0];
    const suffixes: Record<OrgType, string> = {
      solo_teacher: "'s Teaching",
      studio: "'s Music Studio",
      academy: "'s Music Academy",
      agency: "'s Teaching Agency",
    };
    const generated = `${firstName}${suffixes[state.orgType]}`;
    if (generated !== state.orgName) {
      setState(prev => ({ ...prev, orgName: generated }));
    }
  }, [state.fullName, state.orgType]);

  // Persist to session storage on every state change
  useEffect(() => {
    saveState(state);
  }, [state]);

  // ── Updaters ──

  const updateField = useCallback(<K extends keyof OnboardingState>(key: K, value: OnboardingState[K]) => {
    setState(prev => ({ ...prev, [key]: value }));
  }, []);

  const updateFields = useCallback((updates: Partial<OnboardingState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const setOrgNameManual = useCallback((name: string) => {
    hasEditedOrgName.current = true;
    setState(prev => ({ ...prev, orgName: name }));
  }, []);

  const goToStep = useCallback((step: OnboardingStep) => {
    setState(prev => ({ ...prev, currentStep: step }));
  }, []);

  const visibleStepIndex = VISIBLE_STEPS.findIndex(s => s.id === state.currentStep);

  return {
    state,
    updateField,
    updateFields,
    setOrgNameManual,
    goToStep,
    hasEditedOrgName,
    visibleStepIndex: visibleStepIndex >= 0 ? visibleStepIndex : 0,
    clearState: clearOnboardingState,
  };
}
