import { ReactNode } from 'react';
import { SidebarProvider } from '@/components/ui/sidebar';
import { Header } from './Header';
import { AppSidebar } from './AppSidebar';
import { LoopAssistProvider, useLoopAssistUI } from '@/contexts/LoopAssistContext';
import { LoopAssistDrawer } from '@/components/looopassist/LoopAssistDrawer';
import { useOrg } from '@/contexts/OrgContext';

interface AppLayoutProps {
  children: ReactNode;
}

function AppLayoutInner({ children }: AppLayoutProps) {
  const { isOpen, setIsOpen } = useLoopAssistUI();
  const { currentRole } = useOrg();
  
  // Only show LoopAssist for staff roles (not parents)
  const showLoopAssist = currentRole && currentRole !== 'parent';
  
  return (
    <div className="flex min-h-screen w-full flex-col">
      <Header />
      <div className="flex flex-1">
        <AppSidebar />
        <main className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
      {showLoopAssist && (
        <LoopAssistDrawer open={isOpen} onOpenChange={setIsOpen} />
      )}
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
