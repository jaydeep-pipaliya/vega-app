import {beforeEach, describe, expect, it, jest} from '@jest/globals';

const mockEnqueue = jest.fn<(request: any) => void>();

jest.mock('../src/lib/providers/headers', () => ({
  headers: {'User-Agent': 'test-ua'},
}));
jest.mock('../src/lib/zustand/wafStore', () => ({
  useWafStore: {getState: () => ({enqueue: mockEnqueue})},
}));
jest.mock('../src/lib/services/cookieManager', () => ({
  buildCookieString: (map: Record<string, string>) =>
    Object.entries(map)
      .map(([k, v]) => `${k}=${v}`)
      .join('; '),
  pickUserAgent: () => undefined,
}));
jest.mock('../src/lib/sandbox/providerScope', () => ({
  providerAuthor: (author?: string) => author?.trim() || 'local',
}));
jest.mock('../src/lib/sandbox/providerCookieJar', () => ({
  deleteJarCookie: jest.fn(),
  getJarCookieMap: jest.fn(() => ({})),
}));

import {openWebView} from '../src/lib/services/wafResolver';

const flush = () => new Promise(resolve => setImmediate(resolve));

describe('openWebView request coalescing', () => {
  beforeEach(() => {
    mockEnqueue.mockReset();
  });

  it('opens a separate dialog for each path on the same site', async () => {
    const a = openWebView('https://site.test/a');
    const b = openWebView('https://site.test/b');
    await flush();

    expect(mockEnqueue).toHaveBeenCalledTimes(2);
    for (const call of mockEnqueue.mock.calls) {
      const req = call[0];
      req.resolve({data: `page ${req.url}`, cookies: '', url: req.url});
    }

    expect((await a).data).toBe('page https://site.test/a');
    expect((await b).data).toBe('page https://site.test/b');
  });

  it('shares one dialog for the same author and url', async () => {
    const a = openWebView('https://site.test/a', undefined, 'x');
    const b = openWebView('https://site.test/a', undefined, 'x');
    expect(b).toBe(a);
    await flush();
    expect(mockEnqueue).toHaveBeenCalledTimes(1);
    mockEnqueue.mock.calls[0][0].resolve({data: 'ok', cookies: ''});
    await a;
  });

  it('does not share a dialog between authors', async () => {
    const a = openWebView('https://site.test/a', undefined, 'x');
    const b = openWebView('https://site.test/a', undefined, 'y');
    expect(b).not.toBe(a);
    await flush();
    expect(mockEnqueue).toHaveBeenCalledTimes(2);
    mockEnqueue.mock.calls.forEach(call => call[0].resolve({data: ''}));
    await Promise.all([a, b]);
  });

  it('shares one dialog per site while waiting for a cookie', async () => {
    const opts = {waitForCookie: 'cf_clearance'};
    const a = openWebView('https://site.test/a', opts);
    const b = openWebView('https://site.test/b', opts);
    expect(b).toBe(a);
    await flush();
    expect(mockEnqueue).toHaveBeenCalledTimes(1);
    mockEnqueue.mock.calls[0][0].resolve({data: '', cookies: ''});
    await a;
  });

  it('does not leave an unhandled rejection when the dialog is cancelled', async () => {
    const unhandled = jest.fn();
    process.on('unhandledRejection', unhandled);
    try {
      const a = openWebView('https://cancel.test/page');
      await flush();
      mockEnqueue.mock.calls[0][0].reject(new Error('cancelled'));
      await expect(a).rejects.toThrow('cancelled');
      await flush();
      await flush();
      expect(unhandled).not.toHaveBeenCalled();

      // The entry is cleared, so a retry opens a new dialog.
      const retry = openWebView('https://cancel.test/page');
      expect(retry).not.toBe(a);
      await flush();
      mockEnqueue.mock.calls[1][0].resolve({data: ''});
      await retry;
    } finally {
      process.off('unhandledRejection', unhandled);
    }
  });
});
