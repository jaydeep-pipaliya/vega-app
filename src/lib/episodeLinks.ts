import {Stream} from './providers/types';

export interface EpisodeLinkTarget {
  link: string;
  title?: string;
}

export type FetchEpisodeStreams = (
  link: string,
  signal: AbortSignal,
) => Promise<Stream[] | undefined>;

export type PickDownloadStream = (streams: Stream[]) => Stream | undefined;

export interface ResolveEpisodeLinksOptions {
  episodes: EpisodeLinkTarget[];
  fetchStreams: FetchEpisodeStreams;
  pickStream?: PickDownloadStream;
  signal: AbortSignal;
  /** Called before each episode is fetched, with its 1-based position. */
  onProgress?: (current: number, total: number) => void;
}

export interface ResolveEpisodeLinksResult {
  links: string[];
  skipped: EpisodeLinkTarget[];
  cancelled: boolean;
}

const isHttpLink = (link: unknown): link is string =>
  typeof link === 'string' && /^https?:\/\//i.test(link.trim());

/**
 * Same choice as a quick download: the first server the provider returned
 * for a download request, as long as it is a plain http(s) URL.
 */
export const pickDownloadStream: PickDownloadStream = streams =>
  streams.find(stream => isHttpLink(stream?.link));

/**
 * Resolves one download link per episode, one episode at a time so provider
 * rate limits are respected. Episodes without a usable stream are skipped.
 */
export const resolveEpisodeLinks = async ({
  episodes,
  fetchStreams,
  pickStream = pickDownloadStream,
  signal,
  onProgress,
}: ResolveEpisodeLinksOptions): Promise<ResolveEpisodeLinksResult> => {
  const links: string[] = [];
  const skipped: EpisodeLinkTarget[] = [];
  const cancelled = () => ({links, skipped, cancelled: true});

  for (let index = 0; index < episodes.length; index++) {
    if (signal.aborted) return cancelled();
    const episode = episodes[index];
    onProgress?.(index + 1, episodes.length);
    let stream: Stream | undefined;
    try {
      const streams = await fetchStreams(episode.link, signal);
      stream = pickStream(Array.isArray(streams) ? streams : []);
    } catch (error) {
      if (signal.aborted) return cancelled();
      console.warn('Could not get a link for', episode.title, error);
    }
    if (signal.aborted) return cancelled();
    if (stream && isHttpLink(stream.link)) {
      links.push(stream.link.trim());
    } else {
      skipped.push(episode);
    }
  }

  return {links, skipped, cancelled: false};
};

export const copiedLinksMessage = (copied: number, skipped: number) =>
  `Copied ${copied} link${copied === 1 ? '' : 's'}` +
  (skipped > 0 ? `, ${skipped} skipped` : '');
