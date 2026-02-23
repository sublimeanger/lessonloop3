import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useLoopAssistUI } from '@/contexts/LoopAssistContext';

export interface Shortcut {
  key: string;
  description: string;
  category: 'Global' | 'Calendar' | 'Navigation';
  action: () => void;
  displayKey?: string;
}

export function useKeyboardShortcuts() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setIsOpen: setLoopAssistOpen, isOpen: isLoopAssistOpen } = useLoopAssistUI();
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // Define shortcuts
  const shortcuts: Shortcut[] = [
    // Global
    {
      key: '?',
      description: 'Show keyboard shortcuts',
      category: 'Global',
      action: () => setShowShortcuts(prev => !prev),
      displayKey: '?'
    },
    {
      key: 'k',
      description: 'Open command palette',
      category: 'Global',
      action: () => setSearchOpen(true),
      displayKey: '⌘K'
    },
    {
      key: 'j',
      description: 'Toggle LoopAssist',
      category: 'Global',
      action: () => setLoopAssistOpen(!isLoopAssistOpen),
      displayKey: '⌘J'
    },
    {
      key: 's',
      description: 'Focus search bar',
      category: 'Global',
      action: () => {
        setLoopAssistOpen(false);
        // Implementation depends on search bar availability
        const searchInput = document.querySelector('input[type="search"]') as HTMLInputElement;
        if (searchInput) searchInput.focus();
      },
      displayKey: 'S'
    },
    {
      key: 'Escape',
      description: 'Close modals/drawers',
      category: 'Global',
      action: () => {
        setShowShortcuts(false);
        setSearchOpen(false);
        setLoopAssistOpen(false);
        // Dispatch custom event for other components to listen to
        window.dispatchEvent(new CustomEvent('close-modals'));
      },
      displayKey: 'Esc'
    },
    
    // Navigation
    {
      key: 'g h',
      description: 'Go to Dashboard',
      category: 'Navigation',
      action: () => navigate('/dashboard'),
      displayKey: 'G then H'
    },
    {
      key: 'g c',
      description: 'Go to Calendar',
      category: 'Navigation',
      action: () => navigate('/calendar'),
      displayKey: 'G then C'
    },
    {
      key: 'g s',
      description: 'Go to Students',
      category: 'Navigation',
      action: () => navigate('/students'),
      displayKey: 'G then S'
    },
    {
      key: 'g i',
      description: 'Go to Invoices',
      category: 'Navigation',
      action: () => navigate('/invoices'),
      displayKey: 'G then I'
    },

    // Calendar specific (only active on calendar page)
    {
      key: 'n',
      description: 'New Lesson',
      category: 'Calendar',
      action: () => {
        if (location.pathname === '/calendar') {
          window.dispatchEvent(new CustomEvent('calendar-new-lesson'));
        } else {
          navigate('/calendar?action=new');
        }
      },
      displayKey: 'N'
    },
    {
      key: 't',
      description: 'Jump to Today',
      category: 'Calendar',
      action: () => {
        if (location.pathname === '/calendar') {
          window.dispatchEvent(new CustomEvent('calendar-today'));
        }
      },
      displayKey: 'T'
    },
    {
      key: 'ArrowLeft',
      description: 'Previous day/week',
      category: 'Calendar',
      action: () => {
        if (location.pathname === '/calendar') {
          window.dispatchEvent(new CustomEvent('calendar-prev'));
        }
      },
      displayKey: '←'
    },
    {
      key: 'ArrowRight',
      description: 'Next day/week',
      category: 'Calendar',
      action: () => {
        if (location.pathname === '/calendar') {
          window.dispatchEvent(new CustomEvent('calendar-next'));
        }
      },
      displayKey: '→'
    },
    {
      key: 'w',
      description: 'Week View',
      category: 'Calendar',
      action: () => {
        if (location.pathname === '/calendar') {
          window.dispatchEvent(new CustomEvent('calendar-view-week'));
        }
      },
      displayKey: 'W'
    },
    {
      key: 'm',
      description: 'Month/Stacked View',
      category: 'Calendar',
      action: () => {
        if (location.pathname === '/calendar') {
          window.dispatchEvent(new CustomEvent('calendar-view-stacked'));
        }
      },
      displayKey: 'M'
    }
  ];

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Ignore if input, textarea, or contentEditable is focused
    const target = event.target as HTMLElement;
    const isInput = 
      target.tagName === 'INPUT' || 
      target.tagName === 'TEXTAREA' || 
      target.tagName === 'SELECT' ||
      target.isContentEditable;

    // Exception for Escape, Cmd+K, Cmd+J which should work even in inputs
    const isGlobalShortcut = 
      event.key === 'Escape' || 
      ((event.metaKey || event.ctrlKey) && (event.key === 'k' || event.key === 'j'));

    if (isInput && !isGlobalShortcut) return;

    // Handle Cmd+K
    if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
      event.preventDefault();
      setSearchOpen(true);
      return;
    }

    // Handle Cmd+Shift+J — open with new conversation
    if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key === 'j') {
      event.preventDefault();
      setLoopAssistOpen(true);
      window.dispatchEvent(new CustomEvent('loopassist-new-conversation'));
      return;
    }

    // Handle Cmd+J
    if ((event.metaKey || event.ctrlKey) && event.key === 'j') {
      event.preventDefault();
      setLoopAssistOpen(!isLoopAssistOpen);
      return;
    }

    // Handle single key shortcuts
    const shortcut = shortcuts.find(s => s.key.toLowerCase() === event.key.toLowerCase());
    
    if (shortcut) {
      // For calendar shortcuts, only trigger if on calendar page
      if (shortcut.category === 'Calendar' && !location.pathname.startsWith('/calendar')) {
        return;
      }
      
      event.preventDefault();
      shortcut.action();
    }
  }, [location.pathname, navigate, isLoopAssistOpen]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return {
    showShortcuts,
    setShowShortcuts,
    searchOpen,
    setSearchOpen,
    shortcuts
  };
}