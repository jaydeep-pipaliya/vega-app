import {beforeEach, describe, expect, it, jest} from '@jest/globals';

// One shared SAF folder; every phone gets its own modules and storage.
const mockFiles = new Map<string, string>();
const mockDirectories = new Set<string>(['content://tree']);
let mockUuid = 0;

jest.mock('expo-crypto', () => ({
  randomUUID: () => `device-${++mockUuid}`,
}));

jest.mock('expo-file-system/legacy', () => ({
  StorageAccessFramework: {
    readDirectoryAsync: async (uri: string) =>
      [...mockDirectories, ...mockFiles.keys()].filter(
        child => child.slice(0, child.lastIndexOf('/')) === uri,
      ),
    makeDirectoryAsync: async (uri: string, name: string) => {
      mockDirectories.add(`${uri}/${name}`);
      return `${uri}/${name}`;
    },
    createFileAsync: async (uri: string, name: string) => {
      mockFiles.set(`${uri}/${name}`, '');
      return `${uri}/${name}`;
    },
    writeAsStringAsync: async (uri: string, content: string) => {
      mockFiles.set(uri, content);
    },
    readAsStringAsync: async (uri: string) => mockFiles.get(uri) ?? '',
  },
}));

jest.mock('../src/lib/storage/StorageService', () => {
  const makeStorage = () => {
    const values = new Map<string, unknown>();
    const get = (key: string) => values.get(key);
    const set = (key: string, value: unknown) => {
      values.set(key, JSON.parse(JSON.stringify(value)));
    };
    return {
      values,
      getString: get,
      setString: set,
      getNumber: get,
      setNumber: set,
      getObject: get,
      setObject: set,
      getArray: get,
      setArray: set,
    };
  };
  return {mainStorage: makeStorage(), cacheStorage: makeStorage()};
});

jest.mock('../src/lib/storage/WatchListStorage', () => {
  const {mainStorage} = require('../src/lib/storage/StorageService');
  return {
    WatchListKeys: {WATCH_LIST: 'watchlist'},
    watchListStorage: {
      getWatchList: () => mainStorage.getArray('watchlist') || [],
      getCollections: () => [],
      saveCollections: () => undefined,
    },
  };
});

jest.mock('../src/lib/storage', () => ({
  settingsStorage: {
    getDownloadLocationConfig: () => ({type: 'saf', uri: 'content://tree'}),
  },
}));

jest.mock('../src/lib/downloadLocation', () => ({
  getSafEntryName: (uri?: string) => uri?.split('/').pop() || '',
  isSafDownloadLocation: () => true,
}));

jest.mock('../src/lib/zustand/downloadsStore', () => ({
  __esModule: true,
  default: {getState: () => ({downloads: {}})},
}));

jest.mock('../src/lib/zustand/continueWatchingStore', () => ({
  __esModule: true,
  default: {getState: () => ({items: []})},
}));

jest.mock('../src/lib/zustand/watchListStore', () => ({
  __esModule: true,
  default: {getState: () => ({watchList: [], collections: []})},
}));

type Phone = {
  storage: {values: Map<string, unknown>};
  publish: () => Promise<void>;
  setWatchList: (links: string[]) => void;
};

// A fresh module registry stands for one installed app.
const installApp = (): Phone => {
  let phone: Phone | undefined;
  jest.isolateModules(() => {
    const storage = require('../src/lib/storage/StorageService').mainStorage;
    phone = {
      storage,
      publish: require('../src/lib/sync/syncService').publishSyncManifest,
      setWatchList: links =>
        storage.setArray(
          'watchlist',
          links.map(link => ({
            title: link,
            link,
            provider: 'p',
            poster: '',
            updatedAt: 1,
          })),
        ),
    };
  });
  return phone!;
};

// Android Auto Backup copies the MMKV files of one phone onto another.
const restoreBackup = (from: Map<string, unknown>) => {
  const phone = installApp();
  from.forEach((value, key) => phone.storage.values.set(key, value));
  return phone;
};

const manifests = () =>
  [...mockFiles.entries()].map(([uri, content]) => ({
    name: uri.split('/').pop(),
    ...(JSON.parse(content) as {
      deviceId: string;
      watchlist: Record<string, unknown>;
    }),
  }));

describe('sync device id restored onto a second phone', () => {
  beforeEach(() => {
    mockFiles.clear();
    mockDirectories.clear();
    mockDirectories.add('content://tree');
    mockUuid = 0;
  });

  it('does not let the restored phone overwrite the manifest of the first', async () => {
    const phoneA = installApp();
    phoneA.setWatchList(['a-old']);
    await phoneA.publish();
    const backup = new Map(phoneA.storage.values);

    phoneA.setWatchList(['a-new']);
    await phoneA.publish();

    const phoneB = restoreBackup(backup);
    phoneB.setWatchList(['b']);
    await phoneB.publish();

    const files = manifests();
    expect(files).toHaveLength(2);
    const fileA = files.find(file => file.deviceId === 'device-1')!;
    expect(fileA.name).toBe('vega-device-1.json');
    expect(Object.keys(fileA.watchlist)).toEqual(['a-new']);
    const fileB = files.find(file => file.deviceId !== 'device-1')!;
    expect(fileB.name).toBe(`vega-${fileB.deviceId}.json`);
    expect(Object.keys(fileB.watchlist)).toEqual(['b']);
    expect(phoneB.storage.values.get('vega-sync-device-id')).toBe(
      fileB.deviceId,
    );
    expect(phoneA.storage.values.get('vega-sync-device-id')).toBe('device-1');
  });

  it('lets the first phone take a new id when the restored one wrote first', async () => {
    const phoneA = installApp();
    phoneA.setWatchList(['a']);
    await phoneA.publish();

    const phoneB = restoreBackup(new Map(phoneA.storage.values));
    phoneB.setWatchList(['b']);
    await phoneB.publish();
    phoneA.setWatchList(['a', 'a-2']);
    await phoneA.publish();

    const files = manifests();
    expect(files).toHaveLength(2);
    expect(
      Object.keys(files.find(file => file.deviceId === 'device-1')!.watchlist),
    ).toEqual(['b']);
    expect(
      Object.keys(files.find(file => file.deviceId !== 'device-1')!.watchlist),
    ).toEqual(['a', 'a-2']);
  });

  it('keeps writing the same file on a single phone', async () => {
    const phone = installApp();
    phone.setWatchList(['a']);
    await phone.publish();
    await phone.publish();
    // An install from before the check has no published revision yet.
    phone.storage.values.delete('vega-sync-published-revision');
    await phone.publish();
    await Promise.all([phone.publish(), phone.publish(), phone.publish()]);

    expect(manifests().map(file => file.name)).toEqual(['vega-device-1.json']);
  });
});
