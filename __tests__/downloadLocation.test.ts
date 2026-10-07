import {beforeEach, describe, expect, it, jest} from '@jest/globals';

jest.mock('@dr.pogodin/react-native-fs', () => ({
  ExternalDirectoryPath: '/app-files',
  pickFile: jest.fn(),
  readDir: jest.fn(),
  exists: jest.fn(),
  mkdir: jest.fn(),
  unlink: jest.fn(async () => undefined),
}));

jest.mock('expo-file-system/legacy', () => ({
  StorageAccessFramework: {
    readDirectoryAsync: jest.fn(async () => []),
    deleteAsync: jest.fn(async () => undefined),
    requestDirectoryPermissionsAsync: jest.fn(async () => ({
      granted: true,
      directoryUri: 'content://downloads/tree/primary%3AMovies',
    })),
  },
}));

jest.mock('react-native', () => ({
  NativeModules: {},
  Platform: {OS: 'android', isTV: false},
}));

import {
  deleteDownloadedFileByBaseName,
  ensureDownloadLocationAccess,
  findDownloadedFileByBaseName,
  LEGACY_SUBTITLE_EXTENSIONS,
  parseDownloadLocation,
  serializeDownloadLocation,
} from '../src/lib/downloadLocation';
import * as FileSystem from 'expo-file-system/legacy';
import {Platform} from 'react-native';
import * as RNFS from '@dr.pogodin/react-native-fs';

const mockReadDirectory = FileSystem.StorageAccessFramework
  .readDirectoryAsync as jest.Mock;
const mockRequestDirectory = FileSystem.StorageAccessFramework
  .requestDirectoryPermissionsAsync as jest.Mock;

describe('Android SAF download location', () => {
  beforeEach(() => {
    (Platform as any).isTV = false;
    mockReadDirectory.mockClear();
    mockRequestDirectory.mockClear();
  });

  it('does not activate a legacy raw path', () => {
    expect(
      parseDownloadLocation('/storage/emulated/0/Download/vega'),
    ).toBeNull();
  });

  it('uses Vega app storage by default on TV without opening SAF', async () => {
    (Platform as any).isTV = true;
    const location = parseDownloadLocation(null);
    expect(location).toEqual({
      type: 'path',
      path: '/app-files/Vega Downloads',
      label: 'Vega app storage',
    });
    expect(parseDownloadLocation('/old/phone/downloads')).toEqual(location);
    await expect(ensureDownloadLocationAccess(location)).resolves.toEqual(location);
    expect(mockRequestDirectory).not.toHaveBeenCalled();
  });

  it('restores a persisted SAF tree', () => {
    const location = {
      type: 'saf' as const,
      uri: 'content://downloads/tree',
      label: 'Downloads',
    };
    expect(parseDownloadLocation(serializeDownloadLocation(location))).toEqual(
      location,
    );
  });

  it('opens SAF when no valid location exists', async () => {
    await expect(ensureDownloadLocationAccess(null)).resolves.toEqual({
      type: 'saf',
      uri: 'content://downloads/tree/primary%3AMovies',
      label: 'Internal storage/Movies',
    });
    expect(mockRequestDirectory).toHaveBeenCalledTimes(1);
  });
});

describe('legacy downloaded file lookup by base name', () => {
  const pathLocation = {type: 'path' as const, path: '/downloads'};
  const safLocation = {
    type: 'saf' as const,
    uri: 'content://downloads/tree/primary%3AMovies',
    label: 'Movies',
  };
  const mockReadDir = RNFS.readDir as jest.Mock;
  const mockUnlink = RNFS.unlink as jest.Mock;
  const mockDeleteAsync = FileSystem.StorageAccessFramework
    .deleteAsync as jest.Mock;
  const safEntry = (name: string) =>
    `content://downloads/tree/primary%3AMovies/document/primary%3AMovies%2F${encodeURIComponent(name)}`;
  const pathEntries = (...names: string[]) =>
    names.map(name => ({name, path: `/downloads/${name}`}));

  beforeEach(() => {
    mockReadDir.mockReset();
    mockUnlink.mockClear();
    mockDeleteAsync.mockClear();
    mockReadDirectory.mockReset();
  });

  it('ignores unrelated files that only share the base name', async () => {
    mockReadDir.mockResolvedValue(
      pathEntries('Inception.nfo', 'Inception.jpg', 'Inception.mkv.part'),
    );
    await expect(
      findDownloadedFileByBaseName(pathLocation, 'Inception'),
    ).resolves.toBe(false);

    mockReadDirectory.mockResolvedValue([
      safEntry('Inception.nfo'),
      safEntry('Inception.jpg'),
    ]);
    await expect(
      findDownloadedFileByBaseName(safLocation, 'Inception'),
    ).resolves.toBe(false);
  });

  it('matches only an exact video file name', async () => {
    mockReadDir.mockResolvedValue(
      pathEntries('Inception.nfo', 'Inception_2.mp4', 'Inception.mkv'),
    );
    await expect(
      findDownloadedFileByBaseName(pathLocation, 'Inception'),
    ).resolves.toBe('/downloads/Inception.mkv');

    mockReadDirectory.mockResolvedValue([
      safEntry('Inception.jpg'),
      safEntry('Inception.mp4'),
    ]);
    await expect(
      findDownloadedFileByBaseName(safLocation, 'Inception'),
    ).resolves.toBe(safEntry('Inception.mp4'));
  });

  it('never deletes non-video files that share the base name', async () => {
    mockReadDir.mockResolvedValue(pathEntries('Inception.nfo'));
    await expect(
      deleteDownloadedFileByBaseName(pathLocation, 'Inception'),
    ).resolves.toBe(false);
    expect(mockUnlink).not.toHaveBeenCalled();

    mockReadDirectory.mockResolvedValue([safEntry('Inception.jpg')]);
    await expect(
      deleteDownloadedFileByBaseName(safLocation, 'Inception'),
    ).resolves.toBe(false);
    expect(mockDeleteAsync).not.toHaveBeenCalled();
  });

  it('deletes legacy subtitles only when subtitle extensions are requested', async () => {
    mockReadDirectory.mockResolvedValue([
      safEntry('Inception_English.txt'),
      safEntry('Inception_English.srt'),
    ]);
    await expect(
      deleteDownloadedFileByBaseName(safLocation, 'Inception_English'),
    ).resolves.toBe(false);
    expect(mockDeleteAsync).not.toHaveBeenCalled();

    await expect(
      deleteDownloadedFileByBaseName(
        safLocation,
        'Inception_English',
        LEGACY_SUBTITLE_EXTENSIONS,
      ),
    ).resolves.toBe(true);
    expect(mockDeleteAsync).toHaveBeenCalledWith(
      safEntry('Inception_English.srt'),
    );
  });
});
