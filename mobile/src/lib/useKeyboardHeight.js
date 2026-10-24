import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/**
 * Current on-screen keyboard height (0 when hidden).
 *
 * Used to lift bottom-anchored modal sheets above the keyboard — the same technique the
 * shared <BottomSheet> uses (`marginBottom: kb`). Raw <Modal> sheets render in their own
 * native window, outside the app-root KeyboardPan, so they need this to avoid covered inputs.
 */
export default function useKeyboardHeight() {
  const [kb, setKb] = useState(0);
  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const s = Keyboard.addListener(showEvt, (e) => setKb(e.endCoordinates?.height || 0));
    const h = Keyboard.addListener(hideEvt, () => setKb(0));
    return () => { s.remove(); h.remove(); };
  }, []);
  return kb;
}
