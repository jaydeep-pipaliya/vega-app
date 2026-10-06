import {beforeEach, describe, expect, it, jest} from '@jest/globals';

jest.mock('react-native-mmkv-storage', () => ({
  MMKVLoader: class {
    withInstanceID() {
      return this;
    }

    initialize() {
      return {
        getString: () => undefined,
        setString: () => undefined,
        getBool: () => undefined,
        setBool: () => undefined,
        getInt: () => undefined,
        setInt: () => undefined,
        removeItem: () => undefined,
        clearStore: () => undefined,
      };
    }
  },
}));

import useContinueWatchingStore, {
  type ContinueWatchingItem,
} from '../src/lib/zustand/continueWatchingStore';

const createItem = (id: string, updatedAt: number): ContinueWatchingItem => ({
  id,
  title: id,
  episode: {title: 'Episode 1', link: `https://example.com/${id}`},
  type: 'series',
  providerValue: 'vega',
  infoUrl: id,
  position: 0,
  duration: 0,
  updatedAt,
});

describe('continue watching store', () => {
  beforeEach(() => {
    useContinueWatchingStore.setState({items: []});
  });

  it('keeps a new show when the list is already full', () => {
    useContinueWatchingStore.setState({
      items: Array.from({length: 30}, (_, index) =>
        createItem(`old-${index}`, 1000 - index),
      ),
    });

    const {upsertItem, updateProgress} = useContinueWatchingStore.getState();
    upsertItem(createItem('new-show', 0));
    updateProgress('new-show', 60, 1200);

    const items = useContinueWatchingStore.getState().items;
    expect(items).toHaveLength(30);
    expect(items[0]).toMatchObject({id: 'new-show', position: 60});
    expect(items.some(item => item.id === 'old-29')).toBe(false);
  });

  it('replaces an existing entry for the same show', () => {
    const {upsertItem} = useContinueWatchingStore.getState();
    upsertItem(createItem('show', 10));
    upsertItem(createItem('show', 20));

    expect(useContinueWatchingStore.getState().items).toEqual([
      createItem('show', 20),
    ]);
  });

  it('does not write progress onto a different episode', () => {
    const {upsertItem, updateProgress} = useContinueWatchingStore.getState();
    upsertItem({
      ...createItem('show', 10),
      episode: {title: 'Episode 3', link: 'https://example.com/e3'},
      position: 1200,
      duration: 2400,
    });

    updateProgress('show', 900, 2400, {
      title: 'Episode 4',
      link: 'https://example.com/e4',
    });

    expect(useContinueWatchingStore.getState().items[0]).toMatchObject({
      episode: {link: 'https://example.com/e3'},
      position: 1200,
      updatedAt: 10,
    });

    updateProgress('show', 1300, 2400, {
      title: 'Episode 3',
      link: 'https://example.com/e3',
    });

    expect(useContinueWatchingStore.getState().items[0]).toMatchObject({
      position: 1300,
    });
  });
});
