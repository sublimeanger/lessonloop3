/**
 * LL-CRM-P1-02 — Delete Validation
 * Tests that entity deletion is properly blocked when dependencies exist,
 * and warnings are raised for data that would be lost.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock Supabase — we control query responses per-call
// ---------------------------------------------------------------------------
const mockSelectResponse = vi.fn();
const mockSingleResponse = vi.fn();

function createChain() {
  const chain: any = {};
  const methods = [
    'select', 'insert', 'update', 'delete',
    'eq', 'neq', 'gt', 'gte', 'lt', 'lte',
    'in', 'is', 'not', 'or', 'and',
    'order', 'limit', 'range', 'maybeSingle',
    'filter', 'match', 'head',
  ];
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  // Terminal — returns whatever mockSelectResponse currently returns
  chain.single = vi.fn().mockImplementation(() => mockSingleResponse());
  // Thenable — returns whatever mockSelectResponse currently returns
  chain.then = (resolve: any) => resolve(mockSelectResponse());
  Object.defineProperty(chain, Symbol.toStringTag, { value: 'Promise' });
  return chain;
}

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => createChain()),
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null }) },
  },
}));

vi.mock('@/contexts/OrgContext', () => ({
  useOrg: () => ({
    currentOrg: {
      id: 'org-1',
      name: 'Test Org',
      block_scheduling_on_closures: true,
    },
  }),
}));

import { useDeleteValidation } from '@/hooks/useDeleteValidation';

// Helper — since it's a hook we call it at top-level in a describe,
// but useDeleteValidation only uses useOrg (mocked) so it's safe outside React.
// We just need the returned functions.
let validation: ReturnType<typeof useDeleteValidation>;

beforeEach(() => {
  vi.clearAllMocks();
  validation = useDeleteValidation();
});

// ---------------------------------------------------------------------------
// Student deletion
// ---------------------------------------------------------------------------
describe('LL-CRM-P1-02 checkStudentDeletion', () => {
  it('warns when future lessons exist (soft-delete allows deletion)', async () => {
    mockSelectResponse
      .mockReturnValueOnce({ data: [{ id: 'lp1' }], error: null, count: 3 }) // future lessons
      .mockReturnValueOnce({ data: [], error: null, count: 0 })  // unpaid invoices
      .mockReturnValueOnce({ data: [], error: null, count: 0 }); // credits

    const result = await validation.checkStudentDeletion('student-1');

    expect(result.canDelete).toBe(true);
    expect(result.blocks).toHaveLength(0);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('upcoming lesson');
    expect(result.warnings[0]).toContain('3');
  });

  it('warns when unpaid invoices exist (soft-delete allows deletion)', async () => {
    mockSelectResponse
      .mockReturnValueOnce({ data: [], error: null, count: 0 })  // no future lessons
      .mockReturnValueOnce({ data: [{ id: 'inv1' }], error: null, count: 2 }) // unpaid invoices
      .mockReturnValueOnce({ data: [], error: null, count: 0 }); // credits

    const result = await validation.checkStudentDeletion('student-1');

    expect(result.canDelete).toBe(true);
    expect(result.blocks).toHaveLength(0);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('unpaid invoice');
  });

  it('warns about unredeemed credits but allows deletion', async () => {
    mockSelectResponse
      .mockReturnValueOnce({ data: [], error: null, count: 0 })  // no lessons
      .mockReturnValueOnce({ data: [], error: null, count: 0 })  // no invoices
      .mockReturnValueOnce({ data: [], error: null, count: 4 }); // 4 credits

    const result = await validation.checkStudentDeletion('student-1');

    expect(result.canDelete).toBe(true);
    expect(result.blocks).toHaveLength(0);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('unredeemed make-up credit');
    expect(result.warnings[0]).toContain('4');
  });

  it('allows deletion when no dependencies', async () => {
    mockSelectResponse
      .mockReturnValueOnce({ data: [], error: null, count: 0 })
      .mockReturnValueOnce({ data: [], error: null, count: 0 })
      .mockReturnValueOnce({ data: [], error: null, count: 0 });

    const result = await validation.checkStudentDeletion('student-1');

    expect(result.canDelete).toBe(true);
    expect(result.blocks).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  it('warns about both lessons and invoices when both exist', async () => {
    mockSelectResponse
      .mockReturnValueOnce({ data: [{ id: 'l1' }], error: null, count: 1 }) // 1 lesson
      .mockReturnValueOnce({ data: [{ id: 'i1' }], error: null, count: 1 }) // 1 invoice
      .mockReturnValueOnce({ data: [], error: null, count: 0 });

    const result = await validation.checkStudentDeletion('student-1');

    expect(result.canDelete).toBe(true);
    expect(result.blocks).toHaveLength(0);
    expect(result.warnings).toHaveLength(2);
    expect(result.warnings[0]).toContain('upcoming lesson');
    expect(result.warnings[1]).toContain('unpaid invoice');
  });
});

// ---------------------------------------------------------------------------
// Guardian deletion
// ---------------------------------------------------------------------------
describe('LL-CRM-P1-02 checkGuardianDeletion', () => {
  it('blocks when guardian is payer on unpaid invoices', async () => {
    mockSelectResponse
      .mockReturnValueOnce({ data: [], error: null, count: 2 }) // 2 unpaid invoices
      .mockReturnValueOnce({ data: [], error: null }); // no linked students

    const result = await validation.checkGuardianDeletion('guardian-1');

    expect(result.canDelete).toBe(false);
    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0].reason).toContain('payer');
    expect(result.blocks[0].count).toBe(2);
  });

  it('warns when student would have no remaining guardians', async () => {
    mockSelectResponse
      .mockReturnValueOnce({ data: [], error: null, count: 0 }) // no unpaid invoices
      .mockReturnValueOnce({ data: [{ student_id: 's1' }], error: null }); // 1 linked student

    // For the "other guardians" check:
    mockSelectResponse
      .mockReturnValueOnce({ data: [], error: null, count: 0 }); // no other guardians

    // For the student name lookup:
    mockSingleResponse.mockReturnValueOnce({
      data: { first_name: 'Alice', last_name: 'Smith' },
      error: null,
    });

    const result = await validation.checkGuardianDeletion('guardian-1');

    expect(result.canDelete).toBe(true);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('Alice Smith');
    expect(result.warnings[0]).toContain('no remaining guardians');
  });
});

// ---------------------------------------------------------------------------
// Teacher removal
// ---------------------------------------------------------------------------
describe('LL-CRM-P1-02 checkTeacherRemoval', () => {
  it('blocks when teacher has upcoming lessons', async () => {
    mockSelectResponse
      .mockReturnValueOnce({ data: [], error: null, count: 5 })  // 5 upcoming lessons
      .mockReturnValueOnce({ data: [], error: null, count: 0 }); // 0 assignments

    const result = await validation.checkTeacherRemoval('t1');

    expect(result.canDelete).toBe(false);
    expect(result.blocks[0].count).toBe(5);
    expect(result.blocks[0].reason).toContain('upcoming lesson');
  });

  it('allows removal when no dependencies and warns about unassigned students', async () => {
    mockSelectResponse
      .mockReturnValueOnce({ data: [], error: null, count: 0 })  // no upcoming lessons
      .mockReturnValueOnce({ data: [], error: null, count: 3 }); // 3 student assignments

    const result = await validation.checkTeacherRemoval('t1');

    expect(result.canDelete).toBe(true);
    expect(result.warnings[0]).toContain('3 student');
  });
});

// ---------------------------------------------------------------------------
// Location deletion
// ---------------------------------------------------------------------------
describe('LL-CRM-P1-02 checkLocationDeletion', () => {
  it('blocks when location has scheduled lessons', async () => {
    mockSelectResponse
      .mockReturnValueOnce({ data: [], error: null, count: 7 }) // 7 future lessons at location
      .mockReturnValueOnce({ data: [], error: null });           // no rooms at location

    mockSingleResponse.mockReturnValueOnce({
      data: { is_primary: false },
      error: null,
    });

    const result = await validation.checkLocationDeletion('loc-1');

    expect(result.canDelete).toBe(false);
    expect(result.blocks[0].count).toBe(7);
    expect(result.blocks[0].reason).toContain('upcoming lesson');
  });

  it('warns when deleting primary location', async () => {
    mockSelectResponse
      .mockReturnValueOnce({ data: [], error: null, count: 0 }) // no lessons
      .mockReturnValueOnce({ data: [], error: null });           // no rooms

    mockSingleResponse.mockReturnValueOnce({
      data: { is_primary: true },
      error: null,
    });

    const result = await validation.checkLocationDeletion('loc-1');

    expect(result.canDelete).toBe(true);
    expect(result.warnings[0]).toContain('primary location');
  });
});

// ---------------------------------------------------------------------------
// Room deletion
// ---------------------------------------------------------------------------
describe('LL-CRM-P1-02 checkRoomDeletion', () => {
  it('blocks when room has scheduled lessons', async () => {
    mockSelectResponse
      .mockReturnValueOnce({ data: [], error: null, count: 2 });

    const result = await validation.checkRoomDeletion('room-1');

    expect(result.canDelete).toBe(false);
    expect(result.blocks[0].count).toBe(2);
  });

  it('allows deletion when room has no lessons', async () => {
    mockSelectResponse
      .mockReturnValueOnce({ data: [], error: null, count: 0 });

    const result = await validation.checkRoomDeletion('room-1');

    expect(result.canDelete).toBe(true);
    expect(result.blocks).toHaveLength(0);
  });
});
