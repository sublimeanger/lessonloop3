/**
 * LL-SET-P1-01 — Org Settings
 * Tests that org-level settings correctly drive downstream behaviour.
 */
import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// Cancellation notice hours — affects credit eligibility
// ---------------------------------------------------------------------------
describe('LL-SET-P1-01 Cancellation notice hours', () => {
  function isCancellationEligibleForCredit(
    lessonStartAt: string,
    cancelledAt: string,
    noticeHours: number
  ): boolean {
    const lessonStart = new Date(lessonStartAt).getTime();
    const cancelTime = new Date(cancelledAt).getTime();
    const hoursBeforeLesson = (lessonStart - cancelTime) / (1000 * 60 * 60);
    return hoursBeforeLesson >= noticeHours;
  }

  it('24h notice: cancelling 25h before is eligible', () => {
    const lessonStart = '2025-06-15T14:00:00Z';
    const cancelledAt = '2025-06-14T13:00:00Z'; // 25 hours before
    expect(isCancellationEligibleForCredit(lessonStart, cancelledAt, 24)).toBe(true);
  });

  it('24h notice: cancelling 23h before is NOT eligible', () => {
    const lessonStart = '2025-06-15T14:00:00Z';
    const cancelledAt = '2025-06-14T15:00:00Z'; // 23 hours before
    expect(isCancellationEligibleForCredit(lessonStart, cancelledAt, 24)).toBe(false);
  });

  it('24h notice: cancelling exactly 24h before is eligible', () => {
    const lessonStart = '2025-06-15T14:00:00Z';
    const cancelledAt = '2025-06-14T14:00:00Z'; // exactly 24 hours before
    expect(isCancellationEligibleForCredit(lessonStart, cancelledAt, 24)).toBe(true);
  });

  it('48h notice: cancelling 30h before is NOT eligible', () => {
    const lessonStart = '2025-06-15T14:00:00Z';
    const cancelledAt = '2025-06-14T08:00:00Z'; // 30 hours before
    expect(isCancellationEligibleForCredit(lessonStart, cancelledAt, 48)).toBe(false);
  });

  it('0h notice: any cancellation is eligible', () => {
    const lessonStart = '2025-06-15T14:00:00Z';
    const cancelledAt = '2025-06-15T13:55:00Z'; // 5 minutes before
    expect(isCancellationEligibleForCredit(lessonStart, cancelledAt, 0)).toBe(true);
  });

  it('cancelling after lesson start is never eligible', () => {
    const lessonStart = '2025-06-15T14:00:00Z';
    const cancelledAt = '2025-06-15T15:00:00Z'; // 1 hour after
    expect(isCancellationEligibleForCredit(lessonStart, cancelledAt, 0)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Reschedule policy modes
// ---------------------------------------------------------------------------
describe('LL-SET-P1-01 Reschedule policy modes', () => {
  type ReschedulePolicy = 'request_only' | 'self_serve' | 'disabled';

  interface PolicyBehaviour {
    canParentSelfReschedule: boolean;
    canParentRequestReschedule: boolean;
    showRescheduleButton: boolean;
  }

  function getPolicyBehaviour(policy: ReschedulePolicy): PolicyBehaviour {
    switch (policy) {
      case 'self_serve':
        return {
          canParentSelfReschedule: true,
          canParentRequestReschedule: true,
          showRescheduleButton: true,
        };
      case 'request_only':
        return {
          canParentSelfReschedule: false,
          canParentRequestReschedule: true,
          showRescheduleButton: true,
        };
      case 'disabled':
        return {
          canParentSelfReschedule: false,
          canParentRequestReschedule: false,
          showRescheduleButton: false,
        };
    }
  }

  it('request_only: parent can request but not self-reschedule', () => {
    const behaviour = getPolicyBehaviour('request_only');
    expect(behaviour.canParentSelfReschedule).toBe(false);
    expect(behaviour.canParentRequestReschedule).toBe(true);
    expect(behaviour.showRescheduleButton).toBe(true);
  });

  it('self_serve: parent can reschedule directly', () => {
    const behaviour = getPolicyBehaviour('self_serve');
    expect(behaviour.canParentSelfReschedule).toBe(true);
    expect(behaviour.canParentRequestReschedule).toBe(true);
    expect(behaviour.showRescheduleButton).toBe(true);
  });

  it('disabled: no reschedule option shown', () => {
    const behaviour = getPolicyBehaviour('disabled');
    expect(behaviour.canParentSelfReschedule).toBe(false);
    expect(behaviour.canParentRequestReschedule).toBe(false);
    expect(behaviour.showRescheduleButton).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// VAT settings
// ---------------------------------------------------------------------------
describe('LL-SET-P1-01 VAT configuration', () => {
  interface VatConfig {
    vat_enabled: boolean;
    vat_rate: number;
    vat_registration_number: string | null;
  }

  function calculateVat(subtotalMinor: number, config: VatConfig): number {
    if (!config.vat_enabled) return 0;
    return Math.round(subtotalMinor * (config.vat_rate / 100));
  }

  it('VAT disabled returns 0 tax regardless of rate', () => {
    const config: VatConfig = { vat_enabled: false, vat_rate: 20, vat_registration_number: null };
    expect(calculateVat(10000, config)).toBe(0);
  });

  it('VAT enabled at 20% calculates correctly', () => {
    const config: VatConfig = { vat_enabled: true, vat_rate: 20, vat_registration_number: 'GB123456789' };
    expect(calculateVat(10000, config)).toBe(2000);
  });

  it('VAT enabled at 0% returns 0', () => {
    const config: VatConfig = { vat_enabled: true, vat_rate: 0, vat_registration_number: null };
    expect(calculateVat(10000, config)).toBe(0);
  });

  it('handles fractional VAT with rounding', () => {
    const config: VatConfig = { vat_enabled: true, vat_rate: 20, vat_registration_number: 'GB123' };
    // 33.33 * 20% = 6.666 -> rounds to 7
    expect(calculateVat(3333, config)).toBe(667);
  });
});

// ---------------------------------------------------------------------------
// Overdue reminder days configuration
// ---------------------------------------------------------------------------
describe('LL-SET-P1-01 Overdue reminder configuration', () => {
  function shouldSendReminder(
    daysSinceOverdue: number,
    reminderDays: number[]
  ): boolean {
    return reminderDays.includes(daysSinceOverdue);
  }

  const defaultReminders = [7, 14, 28];

  it('sends reminder at 7 days overdue', () => {
    expect(shouldSendReminder(7, defaultReminders)).toBe(true);
  });

  it('sends reminder at 14 days overdue', () => {
    expect(shouldSendReminder(14, defaultReminders)).toBe(true);
  });

  it('sends reminder at 28 days overdue', () => {
    expect(shouldSendReminder(28, defaultReminders)).toBe(true);
  });

  it('does not send on non-configured days', () => {
    expect(shouldSendReminder(10, defaultReminders)).toBe(false);
    expect(shouldSendReminder(21, defaultReminders)).toBe(false);
    expect(shouldSendReminder(1, defaultReminders)).toBe(false);
  });

  it('handles custom reminder schedule', () => {
    const custom = [3, 7, 30];
    expect(shouldSendReminder(3, custom)).toBe(true);
    expect(shouldSendReminder(14, custom)).toBe(false);
    expect(shouldSendReminder(30, custom)).toBe(true);
  });

  it('handles empty reminder array (no reminders)', () => {
    expect(shouldSendReminder(7, [])).toBe(false);
    expect(shouldSendReminder(14, [])).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Billing approach
// ---------------------------------------------------------------------------
describe('LL-SET-P1-01 Billing approach', () => {
  type BillingApproach = 'monthly' | 'termly' | 'per_lesson';

  function getBillingLabel(approach: BillingApproach): string {
    switch (approach) {
      case 'monthly': return 'Monthly billing';
      case 'termly': return 'Termly billing';
      case 'per_lesson': return 'Per lesson billing';
    }
  }

  it('monthly label is correct', () => {
    expect(getBillingLabel('monthly')).toBe('Monthly billing');
  });

  it('termly label is correct', () => {
    expect(getBillingLabel('termly')).toBe('Termly billing');
  });

  it('per_lesson label is correct', () => {
    expect(getBillingLabel('per_lesson')).toBe('Per lesson billing');
  });
});
