import { createContext, useContext, ReactNode } from 'react';
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
  const selectedChildId = searchParams.get('child') || null;

  const setSelectedChildId = (id: string | null) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (id) {
        next.set('child', id);
      } else {
        next.delete('child');
      }
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
