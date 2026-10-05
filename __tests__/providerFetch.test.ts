import {beforeEach, describe, expect, it, jest} from '@jest/globals';

jest.mock('axios', () => ({
  __esModule: true,
  default: {request: jest.fn()},
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

import axios from 'axios';
import {providerFetch} from '../src/lib/sandbox/providerFetch';
import {
  getJarCookieMap,
  storeSetCookies,
} from '../src/lib/sandbox/providerCookieJar';

const mockAxiosRequest = jest.mocked(axios.request);

const emptyRequest = {
  method: 'POST',
  headers: [] as Array<[string, string]>,
  body: {kind: 'none' as const},
};

const sentHeaders = () =>
  (mockAxiosRequest.mock.calls[0][0] as {headers: Record<string, string>})
    .headers;

describe('providerFetch cookies', () => {
  beforeEach(() => {
    mockStorageMap.clear();
    mockAxiosRequest.mockReset();
    mockAxiosRequest.mockResolvedValue({
      status: 200,
      statusText: 'OK',
      headers: {},
      data: new Uint8Array(0),
      request: {responseURL: 'https://drive.example.com/form'},
    });
  });

  it("sends the author's cookies and keeps the shared store out", async () => {
    storeSetCookies('alice', 'https://drive.example.com/', ['session=a-token']);

    await providerFetch('alice', 'https://drive.example.com/form', emptyRequest);

    expect(sentHeaders().Cookie).toBe('session=a-token');
    expect(mockAxiosRequest).toHaveBeenCalledWith(
      expect.objectContaining({withCredentials: false}),
    );
  });

  it("never sends another author's cookies", async () => {
    storeSetCookies('alice', 'https://drive.example.com/', ['session=a-token']);

    await providerFetch('bob', 'https://drive.example.com/form', emptyRequest);

    expect(sentHeaders().Cookie).toBeUndefined();
  });

  it('adds jar cookies to a provider supplied cookie, which wins', async () => {
    storeSetCookies('alice', 'https://cinevood.example/', [
      'cf_clearance=old-token',
      'wordpress_test_cookie=WP%20Cookie%20check',
    ]);

    await providerFetch('alice', 'https://cinevood.example/hollywood/', {
      ...emptyRequest,
      headers: [['cookie', 'cf_clearance=provider-token']],
    });

    expect(sentHeaders().Cookie).toBe(
      'cf_clearance=provider-token; wordpress_test_cookie=WP%20Cookie%20check',
    );
    expect(sentHeaders().cookie).toBeUndefined();
  });

  it("saves Set-Cookie to the requesting author's jar only", async () => {
    mockAxiosRequest.mockResolvedValue({
      status: 200,
      statusText: 'OK',
      headers: {'set-cookie': ['sid=new; Path=/; Domain=.example.com']},
      data: new Uint8Array(0),
      request: {responseURL: 'https://drive.example.com/form'},
    });

    await providerFetch('alice', 'https://drive.example.com/form', emptyRequest);

    expect(getJarCookieMap('alice', 'https://www.example.com/')).toEqual({
      sid: 'new',
    });
    expect(getJarCookieMap('bob', 'https://drive.example.com/')).toEqual({});
  });
});

describe('provider cookie jar', () => {
  beforeEach(() => mockStorageMap.clear());

  it('keeps host-only cookies off subdomains and honours expiry', () => {
    storeSetCookies('alice', 'https://example.com/', [
      'host=1',
      'gone=1; Max-Age=0',
      'old=1; Expires=Wed, 21 Oct 2015 07:28:00 GMT',
    ]);

    expect(getJarCookieMap('alice', 'https://example.com/')).toEqual({host: '1'});
    expect(getJarCookieMap('alice', 'https://sub.example.com/')).toEqual({});
  });

  it('splits comma-joined Set-Cookie values without breaking dates', () => {
    storeSetCookies('alice', 'https://example.com/', [
      'a=1; Expires=Wed, 21 Oct 2099 07:28:00 GMT, b=2',
    ]);

    expect(getJarCookieMap('alice', 'https://example.com/')).toEqual({
      a: '1',
      b: '2',
    });
  });

  it('ignores a Domain attribute the host does not belong to', () => {
    storeSetCookies('alice', 'https://evil.example/', ['x=1; Domain=victim.example']);

    expect(getJarCookieMap('alice', 'https://victim.example/')).toEqual({});
  });
});
