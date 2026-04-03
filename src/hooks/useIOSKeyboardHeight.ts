import { useState, useEffect } from 'react';
import { platform } from '@/lib/platform';

/**
 * Returns the current iOS keyboard height in pixels.
 * Works in both Capacitor native and mobile Safari (via VisualViewport API).
 * Returns 0 when no keyboard is visible or on non-iOS platforms.
 */
export function useIOSKeyboardHeight() {
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    // Capacitor native path
    if (platform.isNative) {
      let showHandle: { remove: () => void } | null = null;
      let hideHandle: { remove: () => void } | null = null;

      import('@capacitor/keyboard').then(({ Keyboard }) => {
        Keyboard.addListener('keyboardWillShow', (info) => {
          setKeyboardHeight(info.keyboardHeight);
        }).then((h) => { showHandle = h; });

        Keyboard.addListener('keyboardWillHide', () => {
          setKeyboardHeight(0);
        }).then((h) => { hideHandle = h; });
      });

      return () => {
        showHandle?.remove();
        hideHandle?.remove();
      };
    }

    // Mobile Safari path via VisualViewport API
    if (platform.isWeb && window.visualViewport) {
      const vv = window.visualViewport;
      const onResize = () => {
        // When keyboard opens, visualViewport.height shrinks
        const diff = window.innerHeight - vv.height;
        setKeyboardHeight(diff > 50 ? diff : 0);
      };
      vv.addEventListener('resize', onResize);
      return () => vv.removeEventListener('resize', onResize);
    }
  }, []);

  return keyboardHeight;
}
