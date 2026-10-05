const mockClearDefaultStore = jest.fn();
const mockClearCacheStore = jest.fn();
const mockClearProviderKvStore = jest.fn();
const mockClearProviderCookieStore = jest.fn();

jest.mock('react-native-mmkv-storage', () => ({
  MMKVLoader: class {
    private instanceId = 'default';

    withInstanceID(instanceId: string) {
      this.instanceId = instanceId;
      return this;
    }

    initialize() {
      const instanceId = this.instanceId;
      return {
        clearStore: () => {
          if (instanceId === 'cache') {
            mockClearCacheStore();
            return;
          }
          if (instanceId === 'provider_kv') {
            mockClearProviderKvStore();
            return;
          }
          if (instanceId === 'provider_cookies') {
            mockClearProviderCookieStore();
            return;
          }
          mockClearDefaultStore();
        },
        getBool: jest.fn(),
        getInt: jest.fn(),
        getString: jest.fn(),
        removeItem: jest.fn(),
        setBool: jest.fn(),
        setInt: jest.fn(),
        setString: jest.fn(),
      };
    }
  },
}));

import {clearAllMMKVStorage} from '../src/lib/storage/StorageService';

describe('clearAllMMKVStorage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('clears the default, cache, and provider KV MMKV instances', () => {
    clearAllMMKVStorage();

    expect(mockClearDefaultStore).toHaveBeenCalledTimes(1);
    expect(mockClearCacheStore).toHaveBeenCalledTimes(1);
    expect(mockClearProviderKvStore).toHaveBeenCalledTimes(1);
    expect(mockClearProviderCookieStore).toHaveBeenCalledTimes(1);
  });
});
