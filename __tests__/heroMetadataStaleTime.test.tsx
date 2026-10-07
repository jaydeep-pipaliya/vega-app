import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';

const mockCache = new Map<string, string>();

jest.mock('../src/lib/storage', () => ({
  cacheStorage: {
    getString: (key: string) => mockCache.get(key),
    setString: (key: string, value: string) => mockCache.set(key, value),
  },
}));
jest.mock('../src/lib/getHomepagedata', () => ({getHomePageData: jest.fn()}));
jest.mock('../src/lib/zustand/contentStore', () => ({}));

import {useHeroMetadata} from '../src/lib/hooks/useHomePageData';

const heroA = 'https://example.com/a';
const heroB = 'https://example.com/b';

const flush = () =>
  act(async () => {
    // React Query notifies through setTimeout, so wait past it.
    await new Promise(resolve => setTimeout(resolve, 20));
  });

describe('useHeroMetadata', () => {
  beforeEach(() => mockCache.clear());

  it('does not refetch a hero shown again within the stale window', async () => {
    const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
    // Both heroes were just loaded, as the rotation prefetch does.
    client.setQueryData(['heroMetadata', heroA, 'vega'], {title: 'A'});
    client.setQueryData(['heroMetadata', heroB, 'vega'], {title: 'B'});
    const fetchedLinks: unknown[] = [];
    const unsubscribe = client.getQueryCache().subscribe(event => {
      if (event.type === 'updated' && event.action.type === 'fetch') {
        fetchedLinks.push(event.query.queryKey[1]);
      }
    });

    let data: any;
    const Probe = ({link}: {link: string}) => {
      data = useHeroMetadata(link, 'vega').data;
      return null;
    };
    const tree = (link: string) => (
      <QueryClientProvider client={client}>
        <Probe link={link} />
      </QueryClientProvider>
    );

    // Start with no hero so the rotation below is not a fresh mount.
    let root: renderer.ReactTestRenderer | undefined;
    await act(async () => {
      root = renderer.create(tree(''));
    });
    for (const link of [heroA, heroB, heroA]) {
      await act(async () => root?.update(tree(link)));
      await flush();
    }

    expect(data).toEqual({title: 'A'});
    expect(fetchedLinks).toEqual([]);

    unsubscribe();
    act(() => root?.unmount());
    await flush();
    client.clear();
  });
});
