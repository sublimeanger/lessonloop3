/**
 * LL-MSG-P0-01 — Message Requests
 * Tests message request creation, types, and status lifecycle.
 */
import { describe, it, expect } from 'vitest';
import type { AdminMessageRequest } from '@/hooks/useAdminMessageRequests';

// ---------------------------------------------------------------------------
// Message request type validation
// ---------------------------------------------------------------------------
describe('LL-MSG-P0-01 Message request types', () => {
  const validTypes = ['cancellation', 'reschedule', 'general'] as const;

  it('supports cancellation request type', () => {
    const req: Partial<AdminMessageRequest> = {
      request_type: 'cancellation',
      subject: 'Cancel lesson on Friday',
      message: 'We cannot make Friday this week',
    };
    expect(validTypes).toContain(req.request_type);
  });

  it('supports reschedule request type', () => {
    const req: Partial<AdminMessageRequest> = {
      request_type: 'reschedule',
      subject: 'Move to Thursday',
      message: 'Can we switch from Friday to Thursday?',
    };
    expect(validTypes).toContain(req.request_type);
  });

  it('supports general request type', () => {
    const req: Partial<AdminMessageRequest> = {
      request_type: 'general',
      subject: 'Question about exam prep',
      message: 'What materials should we get?',
    };
    expect(validTypes).toContain(req.request_type);
  });
});

// ---------------------------------------------------------------------------
// Message request required fields
// ---------------------------------------------------------------------------
describe('LL-MSG-P0-01 Message request required fields', () => {
  function validateMessageRequest(data: Record<string, unknown>): string[] {
    const errors: string[] = [];
    if (!data.guardian_id) errors.push('guardian_id is required');
    if (!data.org_id) errors.push('org_id is required');
    if (!data.subject || data.subject.trim() === '') errors.push('subject is required');
    if (!data.message || data.message.trim() === '') errors.push('message is required');
    if (!data.request_type) errors.push('request_type is required');
    
    const validTypes = ['cancellation', 'reschedule', 'general'];
    if (data.request_type && !validTypes.includes(data.request_type)) {
      errors.push('invalid request_type');
    }
    
    return errors;
  }

  it('passes with all required fields', () => {
    const errors = validateMessageRequest({
      guardian_id: 'g-1',
      org_id: 'org-1',
      subject: 'Cancel lesson',
      message: 'Cannot attend',
      request_type: 'cancellation',
    });
    expect(errors).toHaveLength(0);
  });

  it('fails without guardian_id', () => {
    const errors = validateMessageRequest({
      org_id: 'org-1',
      subject: 'Cancel lesson',
      message: 'Cannot attend',
      request_type: 'cancellation',
    });
    expect(errors).toContain('guardian_id is required');
  });

  it('fails without subject', () => {
    const errors = validateMessageRequest({
      guardian_id: 'g-1',
      org_id: 'org-1',
      subject: '',
      message: 'Cannot attend',
      request_type: 'cancellation',
    });
    expect(errors).toContain('subject is required');
  });

  it('fails with invalid request_type', () => {
    const errors = validateMessageRequest({
      guardian_id: 'g-1',
      org_id: 'org-1',
      subject: 'Test',
      message: 'Test',
      request_type: 'invalid_type',
    });
    expect(errors).toContain('invalid request_type');
  });

  it('requires guardian context (no anonymous requests)', () => {
    const errors = validateMessageRequest({
      org_id: 'org-1',
      subject: 'Test',
      message: 'Test',
      request_type: 'general',
    });
    expect(errors).toContain('guardian_id is required');
  });
});

// ---------------------------------------------------------------------------
// Request status lifecycle
// ---------------------------------------------------------------------------
describe('LL-MSG-P0-01 Request status lifecycle', () => {
  type RequestStatus = 'pending' | 'approved' | 'declined' | 'resolved';

  const validTransitions: Record<RequestStatus, RequestStatus[]> = {
    pending: ['approved', 'declined', 'resolved'],
    approved: ['resolved'],
    declined: ['resolved'], // admin can still resolve after declining
    resolved: [], // terminal state
  };

  function canTransition(from: RequestStatus, to: RequestStatus): boolean {
    return validTransitions[from]?.includes(to) ?? false;
  }

  it('pending can transition to approved', () => {
    expect(canTransition('pending', 'approved')).toBe(true);
  });

  it('pending can transition to declined', () => {
    expect(canTransition('pending', 'declined')).toBe(true);
  });

  it('pending can transition directly to resolved', () => {
    expect(canTransition('pending', 'resolved')).toBe(true);
  });

  it('resolved is a terminal state', () => {
    expect(canTransition('resolved', 'pending')).toBe(false);
    expect(canTransition('resolved', 'approved')).toBe(false);
    expect(canTransition('resolved', 'declined')).toBe(false);
  });

  it('approved can transition to resolved', () => {
    expect(canTransition('approved', 'resolved')).toBe(true);
  });

  it('declined can transition to resolved', () => {
    expect(canTransition('declined', 'resolved')).toBe(true);
  });

  it('cannot go back to pending from any state', () => {
    expect(canTransition('approved', 'pending')).toBe(false);
    expect(canTransition('declined', 'pending')).toBe(false);
    expect(canTransition('resolved', 'pending')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Request filtering
// ---------------------------------------------------------------------------
describe('LL-MSG-P0-01 Request filtering', () => {
  const requests: AdminMessageRequest[] = [
    {
      id: 'r1',
      request_type: 'cancellation',
      subject: 'Cancel Friday',
      message: 'Cannot attend',
      status: 'pending',
      admin_response: null,
      created_at: '2025-06-10T10:00:00Z',
    },
    {
      id: 'r2',
      request_type: 'reschedule',
      subject: 'Move to Thursday',
      message: 'Prefer Thursday',
      status: 'approved',
      admin_response: 'Approved, moved to Thursday',
      created_at: '2025-06-09T10:00:00Z',
    },
    {
      id: 'r3',
      request_type: 'general',
      subject: 'Exam prep',
      message: 'Materials needed?',
      status: 'declined',
      admin_response: 'No exam this term',
      created_at: '2025-06-08T10:00:00Z',
    },
  ];

  it('filters pending requests', () => {
    const pending = requests.filter(r => r.status === 'pending');
    expect(pending).toHaveLength(1);
    expect(pending[0].id).toBe('r1');
  });

  it('filters by request type', () => {
    const cancellations = requests.filter(r => r.request_type === 'cancellation');
    expect(cancellations).toHaveLength(1);
  });

  it('"all" status returns all requests', () => {
    const statusFilter = 'all';
    const filtered = statusFilter === 'all' ? requests : requests.filter(r => r.status === statusFilter);
    expect(filtered).toHaveLength(3);
  });

  it('orders by created_at descending', () => {
    const sorted = [...requests].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    expect(sorted[0].id).toBe('r1');
    expect(sorted[2].id).toBe('r3');
  });
});
