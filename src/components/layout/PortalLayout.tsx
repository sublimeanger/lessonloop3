import { ReactNode, Suspense, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { SidebarProvider } from '@/components/ui/sidebar';
import { PortalSidebar } from './PortalSidebar';
import { PortalBottomNav } from './PortalBottomNav';
import { Header } from './Header';
import { useIsMobile } from '@/hooks/use-mobile';
import { PageTransitionFallback } from '@/components/shared/PageTransitionFallback';
import { ChildFilterProvider } from '@/contexts/ChildFilterContext';
import { ChildSwitcher } from '@/components/portal/ChildSwitcher';
import { ParentLoopAssist, ParentLoopAssistButton } from '@/components/parent-portal/ParentLoopAssist';

interface PortalLayoutProps {
  children: ReactNode;
}

export function PortalLayout({ children }: PortalLayoutProps) {
  const isMobile = useIsMobile();
  const location = useLocation();
  const [loopAssistOpen, setLoopAssistOpen] = useState(false);

  const contentTransition = (
    <Suspense fallback={<PageTransitionFallback />}>
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.15, ease: 'easeOut' }}
      >
        {children}
      </motion.div>
    </Suspense>
  );

  if (isMobile) {
    return (
      <ChildFilterProvider>
        <div className="min-h-screen flex flex-col bg-background">
          <Header />
          <div className="px-6 pt-3">
            <ChildSwitcher compact className="w-full" />
          </div>
          <main className="flex-1 p-6 pb-24 overflow-auto">
            <div className="max-w-4xl mx-auto">
              {contentTransition}
            </div>
          </main>
          <PortalBottomNav />
          <ParentLoopAssistButton onClick={() => setLoopAssistOpen(true)} />
          <ParentLoopAssist open={loopAssistOpen} onOpenChange={setLoopAssistOpen} />
        </div>
      </ChildFilterProvider>
    );
  }

  return (
    <ChildFilterProvider>
      <SidebarProvider>
        <div className="min-h-screen flex w-full bg-background">
          <PortalSidebar />
          <div className="flex-1 flex flex-col">
            <Header />
            <main className="flex-1 p-6 md:p-8 overflow-auto">
              <div className="max-w-4xl mx-auto">
                {contentTransition}
              </div>
            </main>
          </div>
        </div>
        <ParentLoopAssistButton onClick={() => setLoopAssistOpen(true)} />
        <ParentLoopAssist open={loopAssistOpen} onOpenChange={setLoopAssistOpen} />
      </SidebarProvider>
    </ChildFilterProvider>
  );
}
