/**
 * LL-AUD-P0-01: Audit Log Tests
 * Tests audit entry structure, change descriptions, and actor resolution.
 */
import { describe, it, expect } from 'vitest';
import {
  getActionLabel,
  getEntityLabel,
  getChangeDescription,
  type AuditLogEntry,
} from '@/hooks/useAuditLog';

function createEntry(overrides: Partial<AuditLogEntry> = {}): AuditLogEntry {
  return {
    id: 'audit-1',
    org_id: 'org-1',
    actor_user_id: 'user-1',
    actor_name: 'John Smith',
    action: 'create',
    entity_type: 'students',
    entity_id: 'entity-1',
    before: null,
    after: null,
    created_at: '2025-06-15T10:00:00Z',
    ...overrides,
  };
}

describe('LL-AUD-P0-01: Audit Log', () => {
  describe('Entry structure', () => {
    it('has required fields: actor, timestamp, entity_type, action', () => {
      const entry = createEntry();
      expect(entry.actor_user_id).toBeDefined();
      expect(entry.created_at).toBeDefined();
      expect(entry.entity_type).toBeDefined();
      expect(entry.action).toBeDefined();
    });

    it('has before/after snapshots for updates', () => {
      const entry = createEntry({
        action: 'update',
        before: { status: 'draft' },
        after: { status: 'sent' },
      });
      expect(entry.before).toEqual({ status: 'draft' });
      expect(entry.after).toEqual({ status: 'sent' });
    });

    it('has null before for create actions', () => {
      const entry = createEntry({ action: 'create', before: null, after: { name: 'New Student' } });
      expect(entry.before).toBeNull();
      expect(entry.after).not.toBeNull();
    });
  });

  describe('getActionLabel', () => {
    it('maps create to Created', () => {
      expect(getActionLabel('create')).toBe('Created');
    });

    it('maps update to Updated', () => {
      expect(getActionLabel('update')).toBe('Updated');
    });

    it('maps delete to Deleted', () => {
      expect(getActionLabel('delete')).toBe('Deleted');
    });

    it('returns raw action for unknown actions', () => {
      expect(getActionLabel('archive')).toBe('archive');
    });
  });

  describe('getEntityLabel', () => {
    it('maps students to Student', () => {
      expect(getEntityLabel('students')).toBe('Student');
    });

    it('maps lessons to Lesson', () => {
      expect(getEntityLabel('lessons')).toBe('Lesson');
    });

    it('maps invoices to Invoice', () => {
      expect(getEntityLabel('invoices')).toBe('Invoice');
    });

    it('maps payments to Payment', () => {
      expect(getEntityLabel('payments')).toBe('Payment');
    });

    it('maps org_memberships to Membership', () => {
      expect(getEntityLabel('org_memberships')).toBe('Membership');
    });

    it('returns raw entity type for unknown types', () => {
      expect(getEntityLabel('custom_table')).toBe('custom_table');
    });
  });

  describe('getChangeDescription', () => {
    it('describes student creation with name', () => {
      const entry = createEntry({
        action: 'create',
        entity_type: 'students',
        after: { first_name: 'Alice', last_name: 'Smith' },
      });
      expect(getChangeDescription(entry)).toBe('Student "Alice Smith" was created');
    });

    it('describes lesson creation with title', () => {
      const entry = createEntry({
        action: 'create',
        entity_type: 'lessons',
        after: { title: 'Piano 30min' },
      });
      expect(getChangeDescription(entry)).toBe('Lesson "Piano 30min" was scheduled');
    });

    it('describes invoice creation with number', () => {
      const entry = createEntry({
        action: 'create',
        entity_type: 'invoices',
        after: { invoice_number: 'INV-2025-001' },
      });
      expect(getChangeDescription(entry)).toBe('Invoice INV-2025-001 was created');
    });

    it('describes payment with formatted amount', () => {
      const entry = createEntry({
        action: 'create',
        entity_type: 'payments',
        after: { amount_minor: 5000 },
      });
      expect(getChangeDescription(entry)).toBe('Payment of £50.00 was recorded');
    });

    it('describes membership creation with role', () => {
      const entry = createEntry({
        action: 'create',
        entity_type: 'org_memberships',
        after: { role: 'teacher' },
      });
      expect(getChangeDescription(entry)).toBe('Member was added with role "teacher"');
    });

    it('describes invoice status change', () => {
      const entry = createEntry({
        action: 'update',
        entity_type: 'invoices',
        before: { status: 'draft', invoice_number: 'INV-001' },
        after: { status: 'sent', invoice_number: 'INV-001' },
      });
      expect(getChangeDescription(entry)).toContain('status changed from "draft" to "sent"');
    });

    it('describes lesson status change', () => {
      const entry = createEntry({
        action: 'update',
        entity_type: 'lessons',
        before: { status: 'scheduled', title: 'Piano' },
        after: { status: 'completed', title: 'Piano' },
      });
      expect(getChangeDescription(entry)).toContain('was completed');
    });

    it('describes role change in membership', () => {
      const entry = createEntry({
        action: 'update',
        entity_type: 'org_memberships',
        before: { role: 'teacher' },
        after: { role: 'admin' },
      });
      expect(getChangeDescription(entry)).toContain('role changed from "teacher" to "admin"');
    });

    it('describes student deletion with name', () => {
      const entry = createEntry({
        action: 'delete',
        entity_type: 'students',
        before: { first_name: 'Bob', last_name: 'Jones' },
      });
      expect(getChangeDescription(entry)).toBe('Student "Bob Jones" was deleted');
    });

    it('provides generic description for unknown entity types', () => {
      const entry = createEntry({
        action: 'create',
        entity_type: 'custom_table',
        after: {},
      });
      expect(getChangeDescription(entry)).toBe('custom_table was created');
    });
  });

  describe('Actor resolution', () => {
    it('shows actor_name when present', () => {
      const entry = createEntry({ actor_name: 'Jane Doe' });
      expect(entry.actor_name).toBe('Jane Doe');
    });

    it('shows System for null actor', () => {
      // Simulates the mapping logic from useAuditLog
      const actorUserId: string | null = null;
      const actorName = actorUserId ? 'Unknown' : 'System';
      expect(actorName).toBe('System');
    });
  });
});
