/**
 * Test wrapper component providing all necessary providers for rendering
 * components in tests. Uses mock contexts by default.
 */
import React, { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';

interface WrapperOptions {
  initialRoute?: string;
}

/**
 * Creates a fresh wrapper for each test to avoid state leaking.
 * Usage:
 *   render(<MyComponent />, { wrapper: createTestWrapper() });
 */
export function createTestWrapper(options: WrapperOptions = {}) {
  const { initialRoute = '/' } = options;

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  return function TestWrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[initialRoute]}>
          <TooltipProvider>
            {children}
          </TooltipProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );
  };
}
