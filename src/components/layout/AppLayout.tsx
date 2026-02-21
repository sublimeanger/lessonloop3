import { ReactNode, Suspense } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { PageTransitionFallback } from '@/components/shared/PageTransitionFallback';
import { SidebarProvider } from '@/components/ui/sidebar';
import { Header } from './Header';
import { AppSidebar } from './AppSidebar';
import { LoopAssistProvider, useLoopAssistUI } from '@/contexts/LoopAssistContext';
import { LoopAssistDrawer } from '@/components/loopassist/LoopAssistDrawer';
import { TrialExpiredModal, TrialExpiredBanner } from '@/components/subscription';
import { TourTrigger } from '@/components/tours/TourTrigger';
import { useOrg } from '@/contexts/OrgContext';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { KeyboardShortcutsDialog, CommandPalette } from '@/components/shared/KeyboardShortcuts';

interface AppLayoutProps {
  children: ReactNode;
}

function AppLayoutInner({ children }: AppLayoutProps) {
  const { isOpen, setIsOpen } = useLoopAssistUI();
  const { currentRole } = useOrg();
  const location = useLocation();
  
  // Initialize keyboard shortcuts
  const { 
    showShortcuts, 
    setShowShortcuts, 
    searchOpen, 
    setSearchOpen, 
    shortcuts 
  } = useKeyboardShortcuts();
  
  // Only show LoopAssist for staff roles (not parents)
  const showLoopAssist = currentRole && currentRole !== 'parent';
  
  return (
    <div className="flex min-h-screen w-full flex-col">
      <TrialExpiredBanner />
      <Header />
      <div className="flex flex-1">
        <AppSidebar />
        <main className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">
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
        </main>
      </div>
      {showLoopAssist && (
        <LoopAssistDrawer open={isOpen} onOpenChange={setIsOpen} />
      )}
      <TrialExpiredModal />
      <TourTrigger />
      
      {/* Keyboard Shortcuts UI */}
      <KeyboardShortcutsDialog 
        open={showShortcuts} 
        onOpenChange={setShowShortcuts} 
        shortcuts={shortcuts} 
      />
      <CommandPalette 
        open={searchOpen} 
        onOpenChange={setSearchOpen} 
      />
    </div>
  );
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <SidebarProvider>
      <LoopAssistProvider>
        <AppLayoutInner>{children}</AppLayoutInner>
      </LoopAssistProvider>
    </SidebarProvider>
  );
}
