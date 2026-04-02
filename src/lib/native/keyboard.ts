import { Keyboard } from '@capacitor/keyboard';
import { platform } from '../platform';

export function initKeyboard() {
  if (!platform.isNative) return;

  Keyboard.addListener('keyboardWillShow', (info) => {
    document.body.style.setProperty('--keyboard-height', `${info.keyboardHeight}px`);
    document.body.classList.add('keyboard-open');

    // Auto-scroll focused input into view above keyboard
    const focused = document.activeElement as HTMLElement;
    if (focused?.tagName === 'INPUT' || focused?.tagName === 'TEXTAREA' || focused?.tagName === 'SELECT') {
      setTimeout(() => {
        focused.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  });

  Keyboard.addListener('keyboardWillHide', () => {
    document.body.style.setProperty('--keyboard-height', '0px');
    document.body.classList.remove('keyboard-open');
  });
}
