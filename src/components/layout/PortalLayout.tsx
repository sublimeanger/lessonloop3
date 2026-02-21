import { ReactNode, Suspense } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { SidebarProvider } from '@/components/ui/sidebar';
import { PortalSidebar } from './PortalSidebar';
import { PortalBottomNav } from './PortalBottomNav';
import { Header } from './Header';
import { useIsMobile } from '@/hooks/use-mobile';
import { PageTransitionFallback } from '@/components/shared/PageTransitionFallback';

interface PortalLayoutProps {
  children: ReactNode;
}

export function PortalLayout({ children }: PortalLayoutProps) {
  const isMobile = useIsMobile();
  const location = useLocation();

  const contentTransition = (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      >
        <Suspense fallback={<PageTransitionFallback />}>
          {children}
        </Suspense>
      </motion.div>
    </AnimatePresence>
  );

  if (isMobile) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 p-6 pb-24 overflow-auto">
          <div className="max-w-4xl mx-auto">
            {contentTransition}
          </div>
        </main>
        <PortalBottomNav />
      </div>
    );
  }

  return (
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
    </SidebarProvider>
  );
}
