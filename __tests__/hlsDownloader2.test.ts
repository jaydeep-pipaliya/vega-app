import {beforeEach, describe, expect, it, jest} from '@jest/globals';

const mockAxiosGet = jest.fn<(url: string) => Promise<{data: unknown}>>();
// A permanent HTTP error fails at once; network errors would be retried.
const mockDownloadFile = jest.fn((_options: {fromUrl: string}) => ({
  jobId: 1,
  promise: Promise.resolve({statusCode: 404}),
}));

jest.mock('axios', () => ({
  __esModule: true,
  default: {get: (url: string) => mockAxiosGet(url)},
}));
jest.mock('@dr.pogodin/react-native-fs', () => ({
  CachesDirectoryPath: '/cache',
  exists: jest.fn(async () => true),
  mkdir: jest.fn(async () => undefined),
  unlink: jest.fn(async () => undefined),
  downloadFile: (options: {fromUrl: string}) => mockDownloadFile(options),
}));

import {hlsDownloader2} from '../src/lib/hlsDownloader2';

const download = () =>
  hlsDownloader2({
    videoUrl: 'https://example.com/video.m3u8',
    downloadId: 'movie',
    path: '/cache/movie.mp4',
    title: 'Movie',
  });

const playlist = (...tags: string[]) =>
  ['#EXTM3U', ...tags, '#EXTINF:10.0,', 'segment0.ts', '#EXT-X-ENDLIST'].join(
    '\n',
  );

describe('hlsDownloader2 playlist checks', () => {
  beforeEach(() => {
    mockAxiosGet.mockReset();
  });

  it('refuses encrypted playlists', async () => {
    mockAxiosGet.mockResolvedValue({
      data: playlist('#EXT-X-KEY:METHOD=AES-128,URI="key.bin"'),
    });

    await expect(download()).rejects.toThrow('Encrypted HLS (AES-128)');
  });

  it('refuses byte range playlists', async () => {
    mockAxiosGet.mockResolvedValue({
      data: playlist('#EXT-X-BYTERANGE:1000@0'),
    });

    await expect(download()).rejects.toThrow('byte range');
  });

  it('does not refuse a key tag with METHOD=NONE', async () => {
    mockAxiosGet.mockResolvedValue({
      data: playlist('#EXT-X-KEY:METHOD=NONE'),
    });

    await expect(download()).rejects.toThrow('HTTP status 404');
    expect(mockDownloadFile.mock.calls[0][0].fromUrl).toBe(
      'https://example.com/segment0.ts',
    );
  });
});

describe('hlsDownloader2 audio renditions', () => {
  const master = (...media: string[]) =>
    [
      '#EXTM3U',
      ...media,
      '#EXT-X-STREAM-INF:BANDWIDTH=2000000,AUDIO="aud"',
      'video/index.m3u8',
    ].join('\n');

  const fetchedUrls = () => mockAxiosGet.mock.calls.map(call => call[0]);

  beforeEach(() => {
    mockAxiosGet.mockReset();
    mockDownloadFile.mockClear();
  });

  it('keeps the audio inside the video when the default rendition has no URI', async () => {
    mockAxiosGet.mockImplementation(async (url: string) => ({
      data:
        url === 'https://example.com/video.m3u8'
          ? master(
              '#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="aud",NAME="English",LANGUAGE="en",DEFAULT=YES,AUTOSELECT=YES',
              '#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="aud",NAME="Spanish",LANGUAGE="es",URI="audio/es.m3u8"',
            )
          : playlist(),
    }));

    await expect(download()).rejects.toThrow('HTTP status 404');
    expect(fetchedUrls()).not.toContain('https://example.com/audio/es.m3u8');
  });

  it('downloads the default rendition when it has its own playlist', async () => {
    mockAxiosGet.mockImplementation(async (url: string) => ({
      data:
        url === 'https://example.com/video.m3u8'
          ? master(
              '#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="aud",NAME="Spanish",LANGUAGE="es",URI="audio/es.m3u8"',
              '#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="aud",NAME="English",LANGUAGE="en",DEFAULT=YES,URI="audio/en.m3u8"',
            )
          : playlist(),
    }));

    await expect(download()).rejects.toThrow('HTTP status 404');
    expect(fetchedUrls()).toContain('https://example.com/audio/en.m3u8');
    expect(fetchedUrls()).not.toContain('https://example.com/audio/es.m3u8');
  });

  it('falls back to the autoselect rendition when none is default', async () => {
    mockAxiosGet.mockImplementation(async (url: string) => ({
      data:
        url === 'https://example.com/video.m3u8'
          ? master(
              '#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="aud",NAME="Commentary",LANGUAGE="en",URI="audio/commentary.m3u8"',
              '#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="aud",NAME="English",LANGUAGE="en",AUTOSELECT=YES',
            )
          : playlist(),
    }));

    await expect(download()).rejects.toThrow('HTTP status 404');
    expect(fetchedUrls()).not.toContain(
      'https://example.com/audio/commentary.m3u8',
    );
  });
});
