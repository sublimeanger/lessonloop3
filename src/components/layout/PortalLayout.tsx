import { ReactNode } from 'react';
import { SidebarProvider } from '@/components/ui/sidebar';
import { PortalSidebar } from './PortalSidebar';
import { PortalBottomNav } from './PortalBottomNav';
import { Header } from './Header';
import { useIsMobile } from '@/hooks/use-mobile';

interface PortalLayoutProps {
  children: ReactNode;
}

export function PortalLayout({ children }: PortalLayoutProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 p-6 pb-24 overflow-auto">
          <div className="max-w-4xl mx-auto">
            {children}
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
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
