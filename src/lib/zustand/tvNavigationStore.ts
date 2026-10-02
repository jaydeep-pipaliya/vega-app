import {create} from 'zustand';

interface TVNavigationState {
  /** Route key of the visible tab. */
  activeTabKey: string | null;
  /** Element the navigation rail moves to on D-pad right. */
  activeScreenFocusHandle: number | null;
  /** Tab that was visible when activeScreenFocusHandle was saved. */
  focusHandleTabKey: string | null;
  setActiveTabKey: (key: string | null) => void;
  setActiveScreenFocusHandle: (handle: number | null) => void;
}

const useTVNavigationStore = create<TVNavigationState>(set => ({
  activeTabKey: null,
  activeScreenFocusHandle: null,
  focusHandleTabKey: null,
  setActiveTabKey: key => set({activeTabKey: key}),
  setActiveScreenFocusHandle: handle =>
    set(state => ({
      activeScreenFocusHandle: handle,
      focusHandleTabKey: handle == null ? null : state.activeTabKey,
    })),
}));

/** Rail target for the visible tab; null when the saved one belongs to another tab. */
export const selectRailFocusHandle = (state: TVNavigationState) =>
  state.focusHandleTabKey === state.activeTabKey
    ? state.activeScreenFocusHandle
    : null;

export default useTVNavigationStore;
