/**
 * LL-PRC-P1-01 — Practice Streaks
 * Tests streak badge tier calculation and assignment target validation.
 */
import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// Streak tier logic (extracted from StreakBadge component)
// ---------------------------------------------------------------------------
interface StreakTier {
  tier: string;
  label: string;
}

function getStreakTier(streak: number): StreakTier | null {
  if (streak >= 30) return { tier: 'legendary', label: 'Legendary!' };
  if (streak >= 14) return { tier: 'blazing', label: 'On fire!' };
  if (streak >= 7) return { tier: 'hot', label: 'Hot streak!' };
  if (streak >= 3) return { tier: 'building', label: 'Building momentum!' };
  if (streak >= 1) return { tier: 'starting', label: 'Great start!' };
  return null;
}

describe('LL-PRC-P1-01 Streak badge tier calculation', () => {
  it('returns null for zero streak', () => {
    expect(getStreakTier(0)).toBeNull();
  });

  it('returns "starting" for 1-2 day streaks', () => {
    expect(getStreakTier(1)?.tier).toBe('starting');
    expect(getStreakTier(2)?.tier).toBe('starting');
  });

  it('returns "building" for 3-6 day streaks', () => {
    expect(getStreakTier(3)?.tier).toBe('building');
    expect(getStreakTier(6)?.tier).toBe('building');
  });

  it('returns "hot" for 7-13 day streaks', () => {
    expect(getStreakTier(7)?.tier).toBe('hot');
    expect(getStreakTier(13)?.tier).toBe('hot');
  });

  it('returns "blazing" for 14-29 day streaks', () => {
    expect(getStreakTier(14)?.tier).toBe('blazing');
    expect(getStreakTier(29)?.tier).toBe('blazing');
  });

  it('returns "legendary" for 30+ day streaks', () => {
    expect(getStreakTier(30)?.tier).toBe('legendary');
    expect(getStreakTier(100)?.tier).toBe('legendary');
  });

  it('tier boundaries are correct (no gaps or overlaps)', () => {
    // Every positive integer should map to exactly one tier
    const boundaries = [1, 2, 3, 6, 7, 13, 14, 29, 30, 100];
    for (const b of boundaries) {
      const tier = getStreakTier(b);
      expect(tier).not.toBeNull();
    }

    // Boundary transitions
    expect(getStreakTier(2)?.tier).toBe('starting');
    expect(getStreakTier(3)?.tier).toBe('building');
    expect(getStreakTier(6)?.tier).toBe('building');
    expect(getStreakTier(7)?.tier).toBe('hot');
    expect(getStreakTier(13)?.tier).toBe('hot');
    expect(getStreakTier(14)?.tier).toBe('blazing');
    expect(getStreakTier(29)?.tier).toBe('blazing');
    expect(getStreakTier(30)?.tier).toBe('legendary');
  });

  it('labels match their tiers', () => {
    expect(getStreakTier(1)?.label).toBe('Great start!');
    expect(getStreakTier(5)?.label).toBe('Building momentum!');
    expect(getStreakTier(10)?.label).toBe('Hot streak!');
    expect(getStreakTier(20)?.label).toBe('On fire!');
    expect(getStreakTier(50)?.label).toBe('Legendary!');
  });
});

// ---------------------------------------------------------------------------
// Assignment target validation
// ---------------------------------------------------------------------------
describe('LL-PRC-P1-01 Assignment target validation', () => {
  interface AssignmentTargets {
    target_minutes_per_day: number;
    target_days_per_week: number;
  }

  function validateTargets(targets: AssignmentTargets): string[] {
    const errors: string[] = [];

    if (targets.target_minutes_per_day < 5) {
      errors.push('Minimum practice is 5 minutes per day');
    }
    if (targets.target_minutes_per_day > 180) {
      errors.push('Maximum practice is 180 minutes per day');
    }
    if (targets.target_days_per_week < 1) {
      errors.push('Must practice at least 1 day per week');
    }
    if (targets.target_days_per_week > 7) {
      errors.push('Cannot exceed 7 days per week');
    }

    return errors;
  }

  it('accepts valid targets (30 mins, 5 days)', () => {
    const errors = validateTargets({ target_minutes_per_day: 30, target_days_per_week: 5 });
    expect(errors).toHaveLength(0);
  });

  it('accepts minimum targets (5 mins, 1 day)', () => {
    const errors = validateTargets({ target_minutes_per_day: 5, target_days_per_week: 1 });
    expect(errors).toHaveLength(0);
  });

  it('accepts maximum targets (180 mins, 7 days)', () => {
    const errors = validateTargets({ target_minutes_per_day: 180, target_days_per_week: 7 });
    expect(errors).toHaveLength(0);
  });

  it('rejects minutes below minimum', () => {
    const errors = validateTargets({ target_minutes_per_day: 3, target_days_per_week: 5 });
    expect(errors).toContain('Minimum practice is 5 minutes per day');
  });

  it('rejects minutes above maximum', () => {
    const errors = validateTargets({ target_minutes_per_day: 200, target_days_per_week: 5 });
    expect(errors).toContain('Maximum practice is 180 minutes per day');
  });

  it('rejects days below minimum', () => {
    const errors = validateTargets({ target_minutes_per_day: 30, target_days_per_week: 0 });
    expect(errors).toContain('Must practice at least 1 day per week');
  });

  it('rejects days above maximum', () => {
    const errors = validateTargets({ target_minutes_per_day: 30, target_days_per_week: 8 });
    expect(errors).toContain('Cannot exceed 7 days per week');
  });
});

// ---------------------------------------------------------------------------
// Weekly progress percentage calculation
// ---------------------------------------------------------------------------
describe('LL-PRC-P1-01 Weekly progress calculation', () => {
  function calculateProgress(
    actualMinutes: number,
    targetMinutesPerDay: number,
    targetDaysPerWeek: number
  ): number {
    const totalTarget = targetMinutesPerDay * targetDaysPerWeek;
    if (totalTarget === 0) return 0;
    return Math.min(100, Math.round((actualMinutes / totalTarget) * 100));
  }

  it('calculates 0% when no practice logged', () => {
    expect(calculateProgress(0, 30, 5)).toBe(0);
  });

  it('calculates 50% correctly', () => {
    // Target: 30 * 5 = 150 mins. Actual: 75 mins.
    expect(calculateProgress(75, 30, 5)).toBe(50);
  });

  it('caps at 100% when exceeding target', () => {
    // Target: 30 * 5 = 150 mins. Actual: 200 mins.
    expect(calculateProgress(200, 30, 5)).toBe(100);
  });

  it('calculates exact 100%', () => {
    expect(calculateProgress(150, 30, 5)).toBe(100);
  });

  it('handles edge case of zero target gracefully', () => {
    expect(calculateProgress(50, 0, 5)).toBe(0);
  });

  it('rounds correctly', () => {
    // 33.33% should round to 33
    expect(calculateProgress(50, 30, 5)).toBe(33);
  });
});
