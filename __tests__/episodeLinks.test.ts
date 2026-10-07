import {
  copiedLinksMessage,
  pickDownloadStream,
  resolveEpisodeLinks,
} from '../src/lib/episodeLinks';
import {Stream} from '../src/lib/providers/types';

const stream = (link: string, server = 'S'): Stream => ({
  server,
  link,
  type: 'mp4',
});

const episodes = [
  {link: 'ep1', title: 'Episode 1'},
  {link: 'ep2', title: 'Episode 2'},
  {link: 'ep3', title: 'Episode 3'},
];

describe('pickDownloadStream', () => {
  it('takes the first server with an http link', () => {
    expect(
      pickDownloadStream([
        stream(''),
        stream('magnet:?xt=abc'),
        stream(' https://cdn.example/a.mp4 ', 'First'),
        stream('https://cdn.example/b.mp4', 'Second'),
      ])?.server,
    ).toBe('First');
  });

  it('returns nothing when no server is downloadable', () => {
    expect(pickDownloadStream([])).toBeUndefined();
    expect(pickDownloadStream([stream('ftp://x')])).toBeUndefined();
  });
});

describe('resolveEpisodeLinks', () => {
  it('resolves episodes one at a time in order', async () => {
    const calls: string[] = [];
    let inFlight = 0;
    const fetchStreams = jest.fn(async (link: string) => {
      inFlight++;
      expect(inFlight).toBe(1);
      calls.push(link);
      await Promise.resolve();
      inFlight--;
      return [stream(`https://cdn.example/${link}.mp4`)];
    });
    const progress: string[] = [];

    const result = await resolveEpisodeLinks({
      episodes,
      fetchStreams,
      signal: new AbortController().signal,
      onProgress: (current, total) => progress.push(`${current}/${total}`),
    });

    expect(calls).toEqual(['ep1', 'ep2', 'ep3']);
    expect(progress).toEqual(['1/3', '2/3', '3/3']);
    expect(result).toEqual({
      links: [
        'https://cdn.example/ep1.mp4',
        'https://cdn.example/ep2.mp4',
        'https://cdn.example/ep3.mp4',
      ],
      skipped: [],
      cancelled: false,
    });
  });

  it('skips episodes with no stream or a failed request', async () => {
    const fetchStreams = jest.fn(async (link: string) => {
      if (link === 'ep1') return [];
      if (link === 'ep2') throw new Error('rate limited');
      return [stream('https://cdn.example/ep3.mp4')];
    });
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await resolveEpisodeLinks({
      episodes,
      fetchStreams,
      signal: new AbortController().signal,
    });
    warn.mockRestore();

    expect(result.links).toEqual(['https://cdn.example/ep3.mp4']);
    expect(result.skipped.map(e => e.link)).toEqual(['ep1', 'ep2']);
    expect(result.cancelled).toBe(false);
  });

  it('stops when cancelled and passes the signal to the fetch', async () => {
    const controller = new AbortController();
    const fetchStreams = jest.fn(async (link: string, signal: AbortSignal) => {
      expect(signal).toBe(controller.signal);
      if (link === 'ep2') controller.abort();
      return [stream(`https://cdn.example/${link}.mp4`)];
    });

    const result = await resolveEpisodeLinks({
      episodes,
      fetchStreams,
      signal: controller.signal,
    });

    expect(fetchStreams).toHaveBeenCalledTimes(2);
    expect(result.cancelled).toBe(true);
    expect(result.links).toEqual(['https://cdn.example/ep1.mp4']);
  });

  it('does nothing when already cancelled', async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchStreams = jest.fn();

    const result = await resolveEpisodeLinks({
      episodes,
      fetchStreams,
      signal: controller.signal,
    });

    expect(fetchStreams).not.toHaveBeenCalled();
    expect(result).toEqual({links: [], skipped: [], cancelled: true});
  });

  it('uses the given server choice', async () => {
    const result = await resolveEpisodeLinks({
      episodes: [episodes[0]],
      fetchStreams: async () => [
        stream('https://a.example/1.mp4', 'A'),
        stream('https://b.example/1.mp4', 'B'),
      ],
      pickStream: streams => streams.find(s => s.server === 'B'),
      signal: new AbortController().signal,
    });

    expect(result.links).toEqual(['https://b.example/1.mp4']);
  });
});

describe('copiedLinksMessage', () => {
  it('reports copied and skipped counts', () => {
    expect(copiedLinksMessage(1, 0)).toBe('Copied 1 link');
    expect(copiedLinksMessage(10, 2)).toBe('Copied 10 links, 2 skipped');
  });
});
