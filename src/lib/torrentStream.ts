// Hashes of empty payloads that providers return in place of a real torrent.
const DUMMY_TORRENT_HASHES = [
  'd41d0cfbf8baa3ce04a7074b0c486243dd5fbd00',
  'd41d8cd98f00b204e9800998ecf8427e',
];

export const isTorrentStream = (stream?: {link?: string; type?: string}) =>
  stream?.type === 'torrent' || Boolean(stream?.link?.startsWith('magnet:'));

export const isDummyTorrentLink = (link: string) =>
  !link || DUMMY_TORRENT_HASHES.some(hash => link.includes(hash));

export interface ResolveTorrentStreamOptions {
  addTorrent: (link: string) => Promise<{infoHash: string}>;
  deleteTorrent: (infoHash: string) => Promise<unknown>;
  findVideoFileIndex: (infoHash: string) => Promise<number>;
  prepareVideoFile: (infoHash: string, fileIndex: number) => Promise<unknown>;
  getStreamUrl: (infoHash: string, fileIndex: number) => Promise<string>;
  // Called once the torrent exists, so the caller can track and clean it up.
  onAdded: (infoHash: string) => void;
  isCancelled: () => boolean;
}

// Resolves a torrent link to its local stream URL, or null when the caller
// moved on while a step was pending, so a stale stream is never applied.
export const resolveTorrentStream = async (
  link: string,
  options: ResolveTorrentStreamOptions,
): Promise<{streamUrl: string; preparation: Promise<unknown>} | null> => {
  const {infoHash} = await options.addTorrent(link);
  if (options.isCancelled()) {
    options.deleteTorrent(infoHash).catch(() => {});
    return null;
  }
  options.onAdded(infoHash);

  const fileIndex = await options.findVideoFileIndex(infoHash);
  if (options.isCancelled()) return null;

  const preparation = options.prepareVideoFile(infoHash, fileIndex);
  const streamUrl = await options.getStreamUrl(infoHash, fileIndex);
  if (options.isCancelled()) {
    preparation.catch(() => {});
    return null;
  }
  return {streamUrl, preparation};
};
