import {beforeEach, describe, expect, it, jest} from '@jest/globals';

const mockNativeFetch = jest.fn<(url: string, options: any) => Promise<any>>();

jest.mock('react-native', () => ({
  Platform: {OS: 'android'},
  NativeModules: {
    ProviderHttpModule: {
      fetch: (url: string, options: any) => mockNativeFetch(url, options),
    },
  },
}));

jest.mock('../src/lib/sandbox/rateLimiter', () => ({
  providerRateLimiter: {
    acquire: jest.fn(async () => jest.fn()),
  },
}));

const mockStorageMap = new Map<string, unknown>();

jest.mock('react-native-mmkv-storage', () => ({
  MMKVLoader: class {
    private instanceId = 'default';

    withInstanceID(instanceId: string) {
      this.instanceId = instanceId;
      return this;
    }

    initialize() {
      const prefix = `${this.instanceId}::`;
      return {
        clearStore: () => mockStorageMap.clear(),
        getString: (key: string) => mockStorageMap.get(prefix + key),
        setString: (key: string, value: string) =>
          mockStorageMap.set(prefix + key, value),
        removeItem: (key: string) => mockStorageMap.delete(prefix + key),
        getBool: jest.fn(),
        getInt: jest.fn(),
        setBool: jest.fn(),
        setInt: jest.fn(),
      };
    }
  },
}));

import {providerFetch} from '../src/lib/sandbox/providerFetch';
import {storeSetCookies} from '../src/lib/sandbox/providerCookieJar';

const redirectTo = (url: string, location: string, status = 302) => ({
  status,
  statusText: 'Found',
  url,
  headers: [['Location', location]],
  bodyBase64: '',
  cookies: [],
});

const ok = (url: string) => ({
  status: 200,
  statusText: 'OK',
  url,
  headers: [],
  bodyBase64: '',
  cookies: [],
});

const getRequest = {
  method: 'GET',
  headers: [] as Array<[string, string]>,
  body: {kind: 'none' as const},
};

const calledUrls = () => mockNativeFetch.mock.calls.map(call => call[0]);
const calledOptions = (index: number) => mockNativeFetch.mock.calls[index][1];

describe('providerFetch redirects (android)', () => {
  beforeEach(() => {
    mockStorageMap.clear();
    mockNativeFetch.mockReset();
  });

  it('never lets native follow redirects itself', async () => {
    mockNativeFetch.mockResolvedValueOnce(ok('https://a.example/'));

    await providerFetch('alice', 'https://a.example/', getRequest);

    expect(calledOptions(0).redirect).toBe('manual');
  });

  it('refuses a redirect hop into the local network', async () => {
    mockNativeFetch.mockResolvedValueOnce(
      redirectTo('https://a.example/', 'http://127.0.0.1:8080/admin'),
    );
    mockNativeFetch.mockResolvedValue(ok('https://cdn.example/'));

    await expect(
      providerFetch('alice', 'https://a.example/', getRequest),
    ).rejects.toThrow('blocked host');
    expect(calledUrls()).toEqual(['https://a.example/']);
  });

  it('refuses a private hop even when the chain ends on a public host', async () => {
    mockNativeFetch
      .mockResolvedValueOnce(
        redirectTo('https://a.example/', 'http://192.168.1.1/reboot'),
      )
      .mockResolvedValueOnce(
        redirectTo('http://192.168.1.1/reboot', 'https://b.example/'),
      )
      .mockResolvedValueOnce(ok('https://b.example/'));

    await expect(
      providerFetch('alice', 'https://a.example/', getRequest),
    ).rejects.toThrow('blocked host');
    expect(calledUrls()).not.toContain('http://192.168.1.1/reboot');
  });

  it('follows public redirects, resolving relative locations', async () => {
    mockNativeFetch
      .mockResolvedValueOnce(redirectTo('https://a.example/x/', '../y'))
      .mockResolvedValueOnce(
        redirectTo('https://a.example/y', 'https://b.example/z', 301),
      )
      .mockResolvedValueOnce(ok('https://b.example/z'));

    const res = await providerFetch(
      'alice',
      'https://a.example/x/',
      getRequest,
    );

    expect(calledUrls()).toEqual([
      'https://a.example/x/',
      'https://a.example/y',
      'https://b.example/z',
    ]);
    expect(res.status).toBe(200);
    expect(res.url).toBe('https://b.example/z');
  });

  it('returns the redirect untouched when the provider asked for manual', async () => {
    mockNativeFetch.mockResolvedValueOnce(
      redirectTo('https://a.example/', 'http://127.0.0.1/'),
    );

    const res = await providerFetch('alice', 'https://a.example/', {
      ...getRequest,
      redirect: 'manual',
    });

    expect(res.status).toBe(302);
    expect(calledUrls()).toEqual(['https://a.example/']);
  });

  it('turns POST into GET on 302 and keeps it on 307', async () => {
    mockNativeFetch
      .mockResolvedValueOnce(redirectTo('https://a.example/', '/b', 307))
      .mockResolvedValueOnce(redirectTo('https://a.example/b', '/c', 302))
      .mockResolvedValueOnce(ok('https://a.example/c'));

    await providerFetch('alice', 'https://a.example/', {
      method: 'POST',
      headers: [],
      body: {kind: 'text', value: 'q=1'},
    });

    expect(calledOptions(1).method).toBe('POST');
    expect(calledOptions(1).bodyText).toBe('q=1');
    expect(calledOptions(2).method).toBe('GET');
    expect(calledOptions(2).bodyText).toBeUndefined();
  });

  it('sends jar cookies for each hop host only', async () => {
    storeSetCookies('alice', 'https://a.example/', ['a=1']);
    storeSetCookies('alice', 'https://b.example/', ['b=2']);
    mockNativeFetch
      .mockResolvedValueOnce(
        redirectTo('https://a.example/', 'https://b.example/'),
      )
      .mockResolvedValueOnce(ok('https://b.example/'));

    await providerFetch('alice', 'https://a.example/', getRequest);

    const cookieOf = (index: number) =>
      (calledOptions(index).headers as Array<[string, string]>).find(
        ([key]) => key.toLowerCase() === 'cookie',
      )?.[1];
    expect(cookieOf(0)).toBe('a=1');
    expect(cookieOf(1)).toBe('b=2');
  });

  it('gives up after too many redirects', async () => {
    mockNativeFetch.mockImplementation(async (url: string) =>
      redirectTo(url, url + 'x'),
    );

    await expect(
      providerFetch('alice', 'https://a.example/', getRequest),
    ).rejects.toThrow('Too many');
    expect(mockNativeFetch.mock.calls.length).toBe(11);
  });
});
