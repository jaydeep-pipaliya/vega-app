import {useCallback, useEffect, useRef} from 'react';
import {findNodeHandle, UIManager} from 'react-native';
import {useIsFocused} from '@react-navigation/native';
import {isTV} from './constants';
import useTVNavigationStore from '../zustand/tvNavigationStore';

// Retry once because the screen being popped can pull focus back while its
// exit animation still runs.
const RESTORE_DELAYS_MS = [60, 350];
// Wait for the replacement UI to mount and claim focus before rescuing.
const RESCUE_DELAY_MS = 120;
const RECENT_LIMIT = 12;

interface FocusEntry {
  handle: number;
  isNavFocused: () => boolean;
}

/** Handle of the hook-managed element that has focus, else null. */
let currentFocusedHandle: number | null = null;
/** Recently focused, still mounted elements, newest last. */
const recentFocus: FocusEntry[] = [];

const dropRecent = (handle: number) => {
  const index = recentFocus.findIndex(entry => entry.handle === handle);
  if (index >= 0) recentFocus.splice(index, 1);
};

const requestFocus = (handle: number) => {
  UIManager.dispatchViewManagerCommand(handle, 'requestTVFocus', []);
};

/**
 * The focused element unmounted (list item removed, button swapped out).
 * Android leaves nothing focused, so move focus to the newest mounted element
 * on a visible screen, unless something else took focus first.
 */
const rescueLostFocus = () => {
  setTimeout(() => {
    if (currentFocusedHandle != null) return;
    for (let i = recentFocus.length - 1; i >= 0; i--) {
      const entry = recentFocus[i];
      if (entry.isNavFocused()) {
        requestFocus(entry.handle);
        return;
      }
    }
  }, RESCUE_DELAY_MS);
};

/** Test helper. */
export const __resetTVFocusTracking = () => {
  currentFocusedHandle = null;
  recentFocus.length = 0;
};

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
  const handleRef = useRef<number | null>(null);
  const lastBlurAtRef = useRef(0);
  const isNavFocusedRef = useRef(isNavFocused);
  isNavFocusedRef.current = isNavFocused;

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

  useEffect(() => {
    if (!isTV) return;
    handleRef.current = findNodeHandle(ref.current);
    return () => {
      const handle = handleRef.current;
      if (handle == null) return;
      dropRecent(handle);
      // Forget this element as the rail target. A stale handle makes "move
      // right" from the tab bar lead nowhere.
      const store = useTVNavigationStore.getState();
      if (store.activeScreenFocusHandle === handle) {
        store.setActiveScreenFocusHandle(null);
      }
      // Android may send blur just before the view goes away.
      const justBlurred = Date.now() - lastBlurAtRef.current < 200;
      const ownsFocus =
        currentFocusedHandle === handle ||
        (justBlurred && currentFocusedHandle == null);
      if ((focusedRef.current || justBlurred) && ownsFocus) {
        currentFocusedHandle = null;
        rescueLostFocus();
      }
    };
  }, [ref]);

  const onFocus = useCallback(() => {
    focusedRef.current = true;
    restoreRef.current = false;
    const ownHandle = findNodeHandle(ref.current);
    if (ownHandle) {
      handleRef.current = ownHandle;
      currentFocusedHandle = ownHandle;
      dropRecent(ownHandle);
      recentFocus.push({
        handle: ownHandle,
        isNavFocused: () => isNavFocusedRef.current,
      });
      if (recentFocus.length > RECENT_LIMIT) recentFocus.shift();
    }
    if (registerScreenFocus && isNavFocused) {
      const handle = findNodeHandle(ref.current);
      if (handle) {
        useTVNavigationStore.getState().setActiveScreenFocusHandle(handle);
      }
    }
  }, [isNavFocused, ref, registerScreenFocus]);

  const onBlur = useCallback(() => {
    focusedRef.current = false;
    lastBlurAtRef.current = Date.now();
    if (currentFocusedHandle === handleRef.current) {
      currentFocusedHandle = null;
    }
  }, []);

  return {preferredFocus: preferredRef.current, onFocus, onBlur};
};
