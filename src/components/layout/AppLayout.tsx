import { ReactNode, Suspense, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { PageTransitionFallback } from '@/components/shared/PageTransitionFallback';
import { SidebarProvider } from '@/components/ui/sidebar';
import { Header } from './Header';
import { AppSidebar } from './AppSidebar';
import { StaffBottomNav } from './StaffBottomNav';
import { useLoopAssistUI } from '@/contexts/LoopAssistContext';
import { LoopAssistDrawer } from '@/components/loopassist/LoopAssistDrawer';
import { TrialExpiredModal, TrialExpiredBanner } from '@/components/subscription';
import { TourTrigger } from '@/components/tours/TourTrigger';
import { useOrg } from '@/contexts/OrgContext';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { KeyboardShortcutsDialog, CommandPalette } from '@/components/shared/KeyboardShortcuts';
import { SectionErrorBoundary } from '@/components/shared/SectionErrorBoundary';
import { AutoBreadcrumbs } from '@/components/shared/AutoBreadcrumbs';
import { TeacherFAB } from '@/components/shared/TeacherFAB';
import { useIsMobile } from '@/hooks/use-mobile';
import { platform } from '@/lib/platform';

interface AppLayoutProps {
  children: ReactNode;
}

function AppLayoutInner({ children }: AppLayoutProps) {
  const { isOpen, setIsOpen } = useLoopAssistUI();
  const { currentRole } = useOrg();
  const location = useLocation();
  const prevPathRef = useRef(location.pathname);
  const isMobile = useIsMobile();
  const [trialModalDismissed, setTrialModalDismissed] = useState(false);

  const {
    showShortcuts,
    setShowShortcuts,
    searchOpen,
    setSearchOpen,
    shortcuts
  } = useKeyboardShortcuts();

  const showLoopAssist = currentRole && ['owner', 'admin', 'teacher'].includes(currentRole);
  const showBottomNav = isMobile && platform.isNative;

  const pathChanged = prevPathRef.current !== location.pathname;
  if (pathChanged) prevPathRef.current = location.pathname;

  return (
    <div className="flex min-h-screen w-full flex-col">
      <TrialExpiredBanner show={trialModalDismissed} />
      <Header />
      <div className="flex flex-1">
        <AppSidebar />
        <main className={`flex-1 overflow-auto px-4 py-4 md:px-6 md:py-5 lg:px-8 lg:py-6 ${showBottomNav ? 'pb-24' : ''}`}>
          <AutoBreadcrumbs />
          <SectionErrorBoundary name="Page" key={location.pathname}>
            <Suspense fallback={<PageTransitionFallback />}>
              <div className="animate-page-enter">
                {children}
              </div>
            </Suspense>
          </SectionErrorBoundary>
        </main>
      </div>
      {showLoopAssist && (
        <LoopAssistDrawer open={isOpen} onOpenChange={setIsOpen} />
      )}
      <TeacherFAB />
      {showBottomNav && <StaffBottomNav />}
      <TrialExpiredModal onDismissed={() => setTrialModalDismissed(true)} />
      <TourTrigger />

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
      <AppLayoutInner>{children}</AppLayoutInner>
    </SidebarProvider>
  );
}
