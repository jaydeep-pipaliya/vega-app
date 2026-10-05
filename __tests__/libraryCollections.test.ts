import {beforeEach, describe, expect, it, jest} from '@jest/globals';

const mockStore = new Map<string, unknown>();

jest.mock('react-native-mmkv-storage', () => ({
  MMKVLoader: class {
    withInstanceID() {
      return this;
    }

    initialize() {
      return {
        getString: (key: string) => mockStore.get(key),
        setString: (key: string, value: string) => mockStore.set(key, value),
        getBool: (key: string) => mockStore.get(key),
        setBool: (key: string, value: boolean) => mockStore.set(key, value),
        getInt: (key: string) => mockStore.get(key),
        setInt: (key: string, value: number) => mockStore.set(key, value),
        removeItem: (key: string) => mockStore.delete(key),
        clearStore: () => mockStore.clear(),
      };
    }
  },
}));

import {
  DEFAULT_COLLECTION_ID,
  getItemCollectionIds,
  watchListStorage,
  WatchListKeys,
} from '../src/lib/storage/WatchListStorage';

const item = (link: string, collections?: string[]) => ({
  title: link,
  poster: '',
  link,
  provider: 'p',
  collections,
});

const ids = () =>
  new Set(watchListStorage.getCollections().map(c => c.id));

describe('library categories', () => {
  beforeEach(() => mockStore.clear());

  it('adds Watchlist once for existing libraries', () => {
    expect(watchListStorage.getCollections().map(c => c.id)).toEqual([
      DEFAULT_COLLECTION_ID,
    ]);
    watchListStorage.deleteCollection(DEFAULT_COLLECTION_ID);
    expect(watchListStorage.getCollections()).toEqual([]);
  });

  it('keeps old titles in Watchlist and shows them under All once it is deleted', () => {
    const old = item('a');
    expect(getItemCollectionIds(old, ids())).toEqual([DEFAULT_COLLECTION_ID]);
    watchListStorage.deleteCollection(DEFAULT_COLLECTION_ID);
    expect(getItemCollectionIds(old, ids())).toEqual([]);
  });

  it('moves titles of a deleted category to Watchlist, or to none without it', () => {
    watchListStorage.getCollections();
    watchListStorage.saveCollections([
      ...watchListStorage.getCollections(),
      {id: 'x', name: 'X', icon: 'star', createdAt: 1, updatedAt: 1},
      {id: 'y', name: 'Y', icon: 'star', createdAt: 2, updatedAt: 2},
    ]);
    watchListStorage.addToWatchList(item('a', ['x']));
    let result = watchListStorage.deleteCollection('x');
    expect(result.watchList[0].collections).toEqual([DEFAULT_COLLECTION_ID]);

    watchListStorage.setItemCollections(item('a'), ['y']);
    watchListStorage.deleteCollection(DEFAULT_COLLECTION_ID);
    result = watchListStorage.deleteCollection('y');
    expect(result.watchList[0].collections).toEqual([]);
    expect(result.watchList).toHaveLength(1);
  });

  it('saves to the only category when Watchlist is gone', () => {
    watchListStorage.getCollections();
    watchListStorage.deleteCollection(DEFAULT_COLLECTION_ID);
    watchListStorage.saveCollections([
      {id: 'x', name: 'X', icon: 'star', createdAt: 1, updatedAt: 1},
    ]);
    const list = watchListStorage.addToWatchList(item('a'));
    expect(list[0].collections).toEqual(['x']);
    expect(mockStore.get(WatchListKeys.DEFAULT_COLLECTION_ADDED)).toBe(true);
  });
});
