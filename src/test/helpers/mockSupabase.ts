/**
 * Reusable Supabase client mock factory for Vitest tests.
 * Creates a chainable query builder that resolves to configurable test data.
 */

type MockData = { data: any; error: any; count?: number };

/** Creates a chainable mock that mirrors the Supabase PostgREST builder API */
export function createMockQueryBuilder(resolvedValue: MockData = { data: [], error: null }) {
  const builder: any = {};

  const chainMethods = [
    'select', 'insert', 'update', 'upsert', 'delete',
    'eq', 'neq', 'gt', 'gte', 'lt', 'lte',
    'in', 'is', 'not', 'or', 'and',
    'order', 'limit', 'range', 'single', 'maybeSingle',
    'filter', 'match', 'textSearch',
    'csv', 'head',
  ];

  for (const method of chainMethods) {
    builder[method] = vi.fn().mockReturnValue(builder);
  }

  // Terminal methods - resolve to the configured value
  builder.then = (resolve: any) => resolve(resolvedValue);
  // Make it thenable for await
  Object.defineProperty(builder, Symbol.toStringTag, { value: 'Promise' });

  return builder;
}

/** Creates a mock supabase client with configurable per-table responses */
export function createMockSupabaseClient(tableResponses: Record<string, MockData> = {}) {
  const defaultResponse: MockData = { data: [], error: null };

  return {
    from: vi.fn((table: string) => {
      const response = tableResponses[table] || defaultResponse;
      return createMockQueryBuilder(response);
    }),
    rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
      signUp: vi.fn().mockResolvedValue({ data: {}, error: null }),
      signInWithPassword: vi.fn().mockResolvedValue({ data: {}, error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
    },
    channel: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
    }),
  };
}

/**
 * Convenience helper: set up vi.mock for '@/integrations/supabase/client'
 * Call this at module level in your test file:
 * 
 *   vi.mock('@/integrations/supabase/client', () => ({
 *     supabase: createMockSupabaseClient({ ... }),
 *   }));
 */
