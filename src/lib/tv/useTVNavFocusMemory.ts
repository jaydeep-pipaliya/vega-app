import {useCallback, useEffect, useRef} from 'react';
import {findNodeHandle, UIManager} from 'react-native';
import {useIsFocused} from '@react-navigation/native';
import {isTV} from './constants';
import useTVNavigationStore from '../zustand/tvNavigationStore';

// Retry once because the screen being popped can pull focus back while its
// exit animation still runs.
const RESTORE_DELAYS_MS = [60, 350];

/** useIsFocused that also works outside a navigator (tab bar, modals). */
export const useSafeIsNavFocused = (): boolean => {
  try {
    return useIsFocused();
  } catch {
    return true;
  }
};

interface Options {
  ref: React.RefObject<any>;
  isNavFocused: boolean;
  hasTVPreferredFocus: boolean;
  /** Remember this element as the rail's "move right" target. */
  registerScreenFocus?: boolean;
}

/**
 * Focus memory for one focusable element on a navigation screen.
 *
 * - Preferred focus fires only the first time the screen shows the element.
 *   Native code requests focus whenever `hasTVPreferredFocus` turns true, so
 *   passing it through on every return to the screen steals focus.
 * - An element focused when its screen lost navigation focus takes focus back
 *   when the screen is shown again.
 */
export const useTVNavFocusMemory = ({
  ref,
  isNavFocused,
  hasTVPreferredFocus,
  registerScreenFocus = true,
}: Options) => {
  const focusedRef = useRef(false);
  const restoreRef = useRef(false);
  const preferredRef = useRef(false);

  // Freeze the value while the screen is hidden. A value that was true before
  // leaving is still true on return, so native code sees no change.
  if (isNavFocused) {
    preferredRef.current = hasTVPreferredFocus;
  }

  useEffect(() => {
    if (!isTV) return;
    if (!isNavFocused) {
      if (focusedRef.current) restoreRef.current = true;
      return;
    }
    if (!restoreRef.current) return;
    const timers = RESTORE_DELAYS_MS.map(delay =>
      setTimeout(() => {
        if (focusedRef.current) {
          restoreRef.current = false;
          return;
        }
        const handle = findNodeHandle(ref.current);
        if (handle) {
          UIManager.dispatchViewManagerCommand(handle, 'requestTVFocus', []);
        }
      }, delay),
    );
    return () => timers.forEach(clearTimeout);
  }, [isNavFocused, ref]);

  const onFocus = useCallback(() => {
    focusedRef.current = true;
    restoreRef.current = false;
    if (registerScreenFocus && isNavFocused) {
      const handle = findNodeHandle(ref.current);
      if (handle) {
        useTVNavigationStore.getState().setActiveScreenFocusHandle(handle);
      }
    }
  }, [isNavFocused, ref, registerScreenFocus]);

  const onBlur = useCallback(() => {
    focusedRef.current = false;
  }, []);

  return {preferredFocus: preferredRef.current, onFocus, onBlur};
};
