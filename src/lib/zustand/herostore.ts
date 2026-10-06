import {create} from 'zustand';
import {Post} from '../providers/types';

export interface Hero {
  /** Heroes the home screen rotates through; see useHeroRotation. */
  heroes: Post[];
  setHeroes: (heroes: Post[]) => void;
}

const useHeroStore = create<Hero>(set => ({
  heroes: [],
  setHeroes: heroes => set({heroes}),
}));

export default useHeroStore;
