import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, ClipboardList, FileText, CalendarPlus } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useOrg } from '@/contexts/OrgContext';
import { cn } from '@/lib/utils';

const FAB_ACTIONS = [
  { id: 'register', label: 'Register', icon: ClipboardList, href: '/register', color: 'bg-blue-500' },
  { id: 'notes', label: 'Add Notes', icon: FileText, href: '/register', color: 'bg-emerald-500' },
  { id: 'quick-lesson', label: 'Quick Lesson', icon: CalendarPlus, href: '/calendar', color: 'bg-violet-500' },
] as const;

export function TeacherFAB() {
  const isMobile = useIsMobile();
  const { currentRole } = useOrg();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);

  const isStaffRole = currentRole === 'owner' || currentRole === 'admin' || currentRole === 'teacher';

  const handleAction = useCallback((href: string) => {
    setIsOpen(false);
    navigate(href);
  }, [navigate]);

  const toggle = useCallback(() => {
    setIsOpen(prev => !prev);
    try {
      if ('vibrate' in navigator) navigator.vibrate(10);
    } catch { /* ignore */ }
  }, []);

  if (!isMobile || !isStaffRole) return null;

  return (
    <>
      {/* Backdrop */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fixed inset-0 z-40 bg-black/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Action buttons */}
      <div className="fixed bottom-20 right-4 z-50 flex flex-col-reverse items-end gap-3">
        <AnimatePresence>
          {isOpen && FAB_ACTIONS.map((action, index) => (
            <motion.button
              key={action.id}
              type="button"
              initial={{ opacity: 0, y: 20, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.8 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25, delay: index * 0.05 }}
              onClick={() => handleAction(action.href)}
              className="flex items-center gap-2.5"
            >
              <span className="rounded-lg bg-background px-3 py-1.5 text-sm font-medium shadow-lg border">
                {action.label}
              </span>
              <div className={cn('flex h-11 w-11 items-center justify-center rounded-full text-white shadow-lg', action.color)}>
                <action.icon className="h-5 w-5" />
              </div>
            </motion.button>
          ))}
        </AnimatePresence>

        {/* Main FAB */}
        <motion.button
          type="button"
          onClick={toggle}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl"
          whileTap={{ scale: 0.9 }}
          animate={{ rotate: isOpen ? 45 : 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          aria-label={isOpen ? 'Close quick actions' : 'Open quick actions'}
        >
          {isOpen ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
        </motion.button>
      </div>
    </>
  );
}
