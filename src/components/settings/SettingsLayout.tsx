import { type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { SettingsSidebar, SettingsMobileNav, MobileBackButton, getNavLabel } from './SettingsNav';

interface SettingsLayoutProps {
  activeTab: string | null;
  onTabChange: (value: string) => void;
  onBack: () => void;
  isOrgAdmin: boolean;
  children: ReactNode;
}

export function SettingsLayout({
  activeTab,
  onTabChange,
  onBack,
  isOrgAdmin,
  children,
}: SettingsLayoutProps) {
  const showContent = activeTab !== null;

  return (
    <div className="flex gap-6 min-h-0 max-w-5xl">
      {/* Desktop sidebar — always visible */}
      <SettingsSidebar
        activeTab={activeTab ?? 'profile'}
        onTabChange={onTabChange}
        isOrgAdmin={isOrgAdmin}
      />

      {/* Main content area */}
      <div className="flex-1 min-w-0 max-w-3xl">
        {/* Mobile: show nav list OR content, not both */}
        <div className="md:hidden">
          {!showContent ? (
            <motion.div
              key="mobile-nav"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <SettingsMobileNav onTabChange={onTabChange} isOrgAdmin={isOrgAdmin} />
            </motion.div>
          ) : (
            <motion.div
              key={`mobile-content-${activeTab}`}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            >
              <MobileBackButton label={getNavLabel(activeTab)} onBack={onBack} />
              {children}
            </motion.div>
          )}
        </div>

        {/* Desktop: always show content with fade transition */}
        <div className="hidden md:block">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
