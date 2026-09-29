import {create} from 'zustand';

interface TVNavigationState {
  activeScreenFocusHandle: number | null;
  setActiveScreenFocusHandle: (handle: number | null) => void;
}

const useTVNavigationStore = create<TVNavigationState>(set => ({
  activeScreenFocusHandle: null,
  setActiveScreenFocusHandle: handle => set({activeScreenFocusHandle: handle}),
}));

export default useTVNavigationStore;
