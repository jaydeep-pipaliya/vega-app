import {beforeEach, describe, expect, it, jest} from '@jest/globals';

const mockStorageValues = new Map<string, unknown>();

jest.mock('react-native-mmkv-storage', () => ({
  MMKVLoader: class {
    withInstanceID() {
      return this;
    }

    initialize() {
      return {
        getString: (key: string) => mockStorageValues.get(key),
        setString: (key: string, value: string) =>
          mockStorageValues.set(key, value),
        getBool: (key: string) => mockStorageValues.get(key),
        setBool: (key: string, value: boolean) =>
          mockStorageValues.set(key, value),
        getInt: (key: string) => mockStorageValues.get(key),
        setInt: (key: string, value: number) =>
          mockStorageValues.set(key, value),
        getItem: (key: string) => mockStorageValues.get(key) ?? null,
        setItem: (key: string, value: string) =>
          mockStorageValues.set(key, value),
        removeItem: (key: string) => mockStorageValues.delete(key),
        clearStore: () => mockStorageValues.clear(),
      };
    }
  },
}));

jest.mock('../src/lib/downloadLocation', () => ({
  getDownloadLocationDisplayValue: () => 'Not selected',
  parseDownloadLocation: () => null,
  serializeDownloadLocation: () => '',
}));

const loadStores = () => {
  let stores: {
    useContentStore: typeof import('../src/lib/zustand/contentStore').default;
    useThemeStore: typeof import('../src/lib/zustand/themeStore').default;
  };
  jest.isolateModules(() => {
    stores = {
      useContentStore: require('../src/lib/zustand/contentStore').default,
      useThemeStore: require('../src/lib/zustand/themeStore').default,
    };
  });
  return stores!;
};

const provider = {
  value: 'vega',
  display_name: 'Vega',
  type: 'global',
  installed: true,
  disabled: false,
  version: '1.0.0',
  icon: '',
  source: {author: 'vega', url: 'https://example.com'},
  installedAt: 1,
  lastUpdated: 1,
};

describe('theme store', () => {
  beforeEach(() => {
    mockStorageValues.clear();
  });

  it('keeps the selected provider after changing the accent color', () => {
    const first = loadStores();
    first.useContentStore.getState().setProvider(provider);
    first.useThemeStore.getState().setSource('custom');
    first.useThemeStore.getState().setPrimary('#FF0000');

    const next = loadStores();

    expect(next.useContentStore.getState().provider.value).toBe('vega');
    expect(next.useThemeStore.getState().primary).toBe('#FF0000');
    expect(next.useThemeStore.getState().source).toBe('custom');
  });
});
