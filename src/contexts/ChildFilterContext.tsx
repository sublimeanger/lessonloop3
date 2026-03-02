import { createContext, useContext, ReactNode, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

interface ChildFilterContextValue {
  selectedChildId: string | null;
  setSelectedChildId: (id: string | null) => void;
}

const ChildFilterContext = createContext<ChildFilterContextValue>({
  selectedChildId: null,
  setSelectedChildId: () => {},
});

export function ChildFilterProvider({ children }: { children: ReactNode }) {
  const [searchParams, setSearchParams] = useSearchParams();

  // Support both `child` and legacy `student` param
  const childParam = searchParams.get('child');
  const studentParam = searchParams.get('student');
  const selectedChildId = childParam || studentParam || null;

  // Auto-normalize legacy `student` → `child`
  useEffect(() => {
    if (!childParam && studentParam) {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('child', studentParam);
        next.delete('student');
        return next;
      }, { replace: true });
    }
  }, [childParam, studentParam, setSearchParams]);

  const setSelectedChildId = (id: string | null) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (id) {
        next.set('child', id);
      } else {
        next.delete('child');
      }
      // Always clean up legacy param
      next.delete('student');
      return next;
    }, { replace: true });
  };

  return (
    <ChildFilterContext.Provider value={{ selectedChildId, setSelectedChildId }}>
      {children}
    </ChildFilterContext.Provider>
  );
}

export function useChildFilter() {
  return useContext(ChildFilterContext);
}
