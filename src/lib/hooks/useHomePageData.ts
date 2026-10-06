import {useCallback, useEffect, useState} from 'react';
import {Image, InteractionManager} from 'react-native';
import {QueryClient, useQuery, useQueryClient} from '@tanstack/react-query';
import {getHomePageData, HomePageData} from '../getHomepagedata';
import {Content} from '../zustand/contentStore';
import {cacheStorage} from '../storage';
import {deduplicatePosts} from '../providers/deduplicatePosts';
import type {Post} from '../providers/types';

const normalizeHomePosts = (data: HomePageData[]) =>
  data.map(category => ({...category, Posts: deduplicatePosts(category.Posts || [])}));

interface UseHomePageDataOptions {
  provider: Content['provider'];
  enabled?: boolean;
}

export const useHomePageData = ({
  provider,
  enabled = true,
}: UseHomePageDataOptions) => {
  const cacheKey = 'homeData' + (provider?.value || '');
  const query = useQuery<HomePageData[], Error>({
    queryKey: ['homePageData', provider.value],
    select: normalizeHomePosts,
    queryFn: async ({signal}) => {
      // Fetch fresh data from provider
      const data = await getHomePageData(provider, signal);
      return data;
    },
    enabled: enabled && !!provider?.value,
    staleTime: 0, // Mark stale immediately so it revalidates in the background
    gcTime: 60 * 60 * 1000, // 1 hour
    retry: (failureCount, error) => {
      if (error.name === 'AbortError') {
        return false;
      }
      return failureCount < 3;
    },
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
    // Add initial data from cache for instant loading without loading screen
    initialData: () => {
      const cache = cacheStorage.getString(cacheKey);
      if (cache) {
        try {
          return JSON.parse(cache);
        } catch {
          return undefined;
        }
      }
      return undefined;
    },
    initialDataUpdatedAt: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
    refetchOnReconnect: 'always',
  });

  useEffect(() => {
    if (query.data && query.data.length > 0 && provider?.value) {
      cacheStorage.setString(cacheKey, JSON.stringify(query.data));
    }
  }, [cacheKey, provider?.value, query.data]);

  return query;
};

export const HERO_COUNT = 4;
const HERO_ROTATE_MS = 8000;
// Extra wait after interactions settle before the other heroes load.
const HERO_PREFETCH_DELAY_MS = 1000;
// Prefetched hero details stay fresh this long, so rotating back does not refetch.
const HERO_PREFETCH_STALE_MS = 10 * 60 * 1000;

// Hero links per provider, so tab switches and catalog refetches keep the same heroes.
const heroSelectionCache = new Map<string, string[]>();

const shuffle = <T,>(items: T[]): T[] => {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

/** Picks up to HERO_COUNT random posts from all catalogs, kept per provider. */
export const getRandomHeroPosts = (
  homeData: HomePageData[],
  providerValue?: string,
): Post[] => {
  const pool = new Map<string, Post>();
  for (const category of homeData || []) {
    for (const post of category.Posts || []) {
      if (post?.link && !pool.has(post.link)) {
        pool.set(post.link, post);
      }
    }
  }
  if (pool.size === 0) {
    return [];
  }

  const cacheKey = providerValue || 'default';
  const cached = (heroSelectionCache.get(cacheKey) || [])
    .map(link => pool.get(link))
    .filter((post): post is Post => !!post);
  if (cached.length > 0) {
    return cached;
  }

  const links = shuffle(Array.from(pool.keys())).slice(0, HERO_COUNT);
  heroSelectionCache.set(cacheKey, links);
  return links.map(link => pool.get(link)!);
};

// Function to clear hero cache when explicitly refreshing
export const clearHeroCache = (providerValue?: string) => {
  if (providerValue) {
    heroSelectionCache.delete(providerValue);
  } else {
    heroSelectionCache.clear();
  }
};

const heroMetadataKey = (heroLink: string, providerValue: string) => [
  'heroMetadata',
  heroLink,
  providerValue,
];

const heroStorageKey = (heroLink: string, providerValue: string) =>
  `heroMeta:${providerValue}:${heroLink}`;

const readStoredHeroMetadata = (heroLink: string, providerValue: string) => {
  const cached = cacheStorage.getString(heroStorageKey(heroLink, providerValue));
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch {
      return undefined;
    }
  }
  return undefined;
};

const fetchHeroMetadata = async (heroLink: string, providerValue: string) => {
  const {providerManager} = await import('../services/ProviderManager');
  const {default: axios} = await import('axios');

  const info = await providerManager.getMetaData({
    link: heroLink,
    provider: providerValue,
  });

  let result = info;
  // Only enrich providers that explicitly opt in to Cinemeta metadata.
  if (info.populateMeta === true && info.imdbId && info.type) {
    try {
      const response = await axios.get(
        `https://v3-cinemeta.strem.io/meta/${info.type}/${info.imdbId}.json`,
        {timeout: 5000},
      );
      result = response.data?.meta || info;
    } catch {
      result = info; // Fallback to original info if Stremio fails
    }
  }

  cacheStorage.setString(
    heroStorageKey(heroLink, providerValue),
    JSON.stringify(result),
  );
  return result;
};

// Hook for hero metadata with React Query, instant cache load & background revalidation
export const useHeroMetadata = (heroLink: string, providerValue: string) =>
  useQuery({
    queryKey: heroMetadataKey(heroLink, providerValue),
    queryFn: () => fetchHeroMetadata(heroLink, providerValue),
    enabled: !!heroLink && !!providerValue,
    staleTime: 0, // Instantly revalidate in background
    gcTime: 60 * 60 * 1000, // 1 hour
    retry: 2,
    // Use cached data as initial data
    initialData: () => readStoredHeroMetadata(heroLink, providerValue),
    initialDataUpdatedAt: 0,
    refetchOnMount: 'always',
  });

/**
 * Loads one hero's details in the background. Stored details make the hero
 * ready at once and are refreshed quietly. Resolves false when nothing could
 * be loaded.
 */
const prefetchHeroMetadata = async (
  queryClient: QueryClient,
  heroLink: string,
  providerValue: string,
): Promise<boolean> => {
  const queryKey = heroMetadataKey(heroLink, providerValue);
  const stored = readStoredHeroMetadata(heroLink, providerValue);
  if (stored !== undefined && queryClient.getQueryData(queryKey) === undefined) {
    queryClient.setQueryData(queryKey, stored, {updatedAt: 0});
  }
  try {
    await queryClient.fetchQuery({
      queryKey,
      queryFn: () => fetchHeroMetadata(heroLink, providerValue),
      staleTime: HERO_PREFETCH_STALE_MS,
      retry: 1,
    });
    // Measure the artwork too, so the hero shows at its final layout at once.
    const data: any = queryClient.getQueryData(queryKey);
    prefetchArtworkShape(data?.background || data?.image || data?.poster);
    return true;
  } catch {
    return queryClient.getQueryData(queryKey) !== undefined;
  }
};

/**
 * Rotates the hero through `posts`. The first hero's details load right after
 * the catalog; once that request is done and the app is idle, the others load
 * one at a time in the background. Only heroes whose details have loaded join
 * the rotation, so a slide never shows up half empty.
 */
/**
 * True when an image would look poor stretched across the hero: portrait or
 * square posters and small images.
 */
export const isPosterLikeArtwork = (width: number, height: number) =>
  width / height < 1.2 || width < 1000;

// Image URL to whether it is poster-like, so a hero shown again is not
// measured again.
const artworkShapeCache = new Map<string, boolean>();

/**
 * Measures an image to decide how to show it as a backdrop. `ready` turns
 * true once the size is known, so callers can wait instead of drawing the
 * image sharp and then switching it to blurred.
 */
export const useArtworkShape = (uri: string | undefined) => {
  const [shape, setShape] = useState<{uri: string; posterLike: boolean}>();
  const cached = uri ? artworkShapeCache.get(uri) : undefined;
  useEffect(() => {
    if (!uri || artworkShapeCache.has(uri)) {
      return;
    }
    let cancelled = false;
    const done = (posterLike: boolean) => {
      artworkShapeCache.set(uri, posterLike);
      if (!cancelled) {
        setShape({uri, posterLike});
      }
    };
    Image.getSize(
      uri,
      (width, height) => done(isPosterLikeArtwork(width, height)),
      () => done(false),
    );
    return () => {
      cancelled = true;
    };
  }, [uri]);
  if (cached !== undefined) {
    return {ready: true, posterLike: cached};
  }
  const ready = !!uri && shape?.uri === uri;
  return {ready, posterLike: ready && shape?.posterLike === true};
};

/** Measures an image ahead of time so useArtworkShape answers at once. */
export const prefetchArtworkShape = (uri: string | undefined) => {
  if (!uri || artworkShapeCache.has(uri)) {
    return;
  }
  Image.getSize(
    uri,
    (width, height) =>
      artworkShapeCache.set(uri, isPosterLikeArtwork(width, height)),
    () => artworkShapeCache.set(uri, false),
  );
};

export const useHeroRotation = (
  posts: Post[],
  providerValue: string,
  paused: boolean,
) => {
  const queryClient = useQueryClient();
  const linksKey = posts.map(post => post.link).join('\n');
  const firstLink = posts[0]?.link || '';
  const [index, setIndex] = useState(0);
  const [readyLinks, setReadyLinks] = useState<string[]>([]);

  const firstQuery = useHeroMetadata(firstLink, providerValue);
  const firstDone =
    !!firstLink &&
    !firstQuery.isFetching &&
    (firstQuery.data !== undefined || firstQuery.isError);

  useEffect(() => {
    setIndex(0);
    setReadyLinks(firstLink ? [firstLink] : []);
  }, [linksKey, firstLink, providerValue]);

  useEffect(() => {
    if (!firstDone || posts.length < 2) {
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const rest = posts.slice(1);
    const task = InteractionManager.runAfterInteractions(() => {
      timer = setTimeout(async () => {
        for (const post of rest) {
          if (cancelled) {
            return;
          }
          const ready = await prefetchHeroMetadata(
            queryClient,
            post.link,
            providerValue,
          );
          if (!cancelled && ready) {
            setReadyLinks(current =>
              current.includes(post.link) ? current : [...current, post.link],
            );
          }
        }
      }, HERO_PREFETCH_DELAY_MS);
    });
    return () => {
      cancelled = true;
      task.cancel();
      if (timer) {
        clearTimeout(timer);
      }
    };
    // linksKey stands for posts: the list is rebuilt on every catalog refetch.
  }, [firstDone, linksKey, providerValue, queryClient]);

  // Moves to the next (1) or previous (-1) hero that has loaded.
  const step = useCallback(
    (direction: 1 | -1) => {
      setIndex(current => {
        for (let offset = 1; offset <= posts.length; offset++) {
          const next =
            (current + direction * offset + posts.length * offset) %
            posts.length;
          if (readyLinks.includes(posts[next].link)) {
            return next;
          }
        }
        return current;
      });
    },
    [posts, readyLinks],
  );

  // The timer restarts on every change, so a swipe gets the full interval.
  useEffect(() => {
    if (paused || readyLinks.length < 2) {
      return;
    }
    const timer = setTimeout(() => step(1), HERO_ROTATE_MS);
    return () => clearTimeout(timer);
  }, [paused, readyLinks.length, step, index]);

  const activeIndex = index < posts.length ? index : 0;
  return {
    post: posts[activeIndex] as Post | undefined,
    activeIndex,
    readyLinks,
    step,
  };
};
