import { Keyboard } from '@capacitor/keyboard';
import { platform } from '../platform';

export function initKeyboard() {
  if (!platform.isNative) return;

  Keyboard.addListener('keyboardWillShow', (info) => {
    document.body.style.setProperty('--keyboard-height', `${info.keyboardHeight}px`);
    document.body.classList.add('keyboard-open');
  });

  Keyboard.addListener('keyboardWillHide', () => {
    document.body.style.setProperty('--keyboard-height', '0px');
    document.body.classList.remove('keyboard-open');
  });
}
