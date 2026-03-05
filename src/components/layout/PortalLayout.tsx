import { ReactNode, Suspense } from 'react';
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
import { ParentLoopAssist } from '@/components/parent-portal/ParentLoopAssist';
import { useLoopAssistUI } from '@/contexts/LoopAssistContext';

interface PortalLayoutProps {
  children: ReactNode;
}

export function PortalLayout({ children }: PortalLayoutProps) {
  const isMobile = useIsMobile();
  const location = useLocation();
  const { isOpen, setIsOpen } = useLoopAssistUI();

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
        <SidebarProvider>
            <div className="min-h-screen flex flex-col bg-background overflow-x-hidden">
            <Header />
            <div className="px-4 pt-3 md:px-6">
              <ChildSwitcher compact className="w-full" />
            </div>
            <main className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-4 pb-24">
              <div className="max-w-4xl mx-auto w-full">
                {contentTransition}
              </div>
            </main>
            <PortalBottomNav />
            <ParentLoopAssist open={isOpen} onOpenChange={setIsOpen} />
          </div>
        </SidebarProvider>
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
            <main className="flex-1 overflow-auto px-4 py-4 md:px-6 md:py-5 lg:px-8 lg:py-6">
              <div className="max-w-4xl mx-auto">
                {contentTransition}
              </div>
            </main>
          </div>
        </div>
        <ParentLoopAssist open={isOpen} onOpenChange={setIsOpen} />
      </SidebarProvider>
    </ChildFilterProvider>
  );
}
