import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { PageContext } from '@/hooks/useLoopAssist';

interface LoopAssistContextType {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  openDrawer: () => void;
  closeDrawer: () => void;
  pageContext: PageContext;
  setPageContext: (context: PageContext) => void;
}

const LoopAssistContext = createContext<LoopAssistContextType | undefined>(undefined);

export function LoopAssistProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [pageContext, setPageContext] = useState<PageContext>({ type: 'general' });
  const location = useLocation();

  // Auto-detect context from URL
  useEffect(() => {
    const path = location.pathname;
    
    if (path.startsWith('/calendar')) {
      setPageContext({ type: 'calendar' });
    } else if (path.match(/\/students\/([a-f0-9-]+)/)) {
      const id = path.match(/\/students\/([a-f0-9-]+)/)?.[1];
      setPageContext({ type: 'student', id });
    } else if (path.match(/\/invoices\/([a-f0-9-]+)/)) {
      const id = path.match(/\/invoices\/([a-f0-9-]+)/)?.[1];
      setPageContext({ type: 'invoice', id });
    } else if (path.startsWith('/students')) {
      setPageContext({ type: 'student' });
    } else if (path.startsWith('/invoices')) {
      setPageContext({ type: 'invoice' });
    } else {
      setPageContext({ type: 'general' });
    }
  }, [location.pathname]);

  const openDrawer = () => setIsOpen(true);
  const closeDrawer = () => setIsOpen(false);

  return (
    <LoopAssistContext.Provider value={{ isOpen, setIsOpen, openDrawer, closeDrawer, pageContext, setPageContext }}>
      {children}
    </LoopAssistContext.Provider>
  );
}

export function useLoopAssistUI() {
  const context = useContext(LoopAssistContext);
  if (!context) {
    throw new Error('useLoopAssistUI must be used within LoopAssistProvider');
  }
  return context;
}
