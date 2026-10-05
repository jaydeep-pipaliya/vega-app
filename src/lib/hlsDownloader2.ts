import * as RNFS from '@dr.pogodin/react-native-fs';
import axios from 'axios';
import {NativeModules} from 'react-native';

interface NativeFileFetcher {
  fetchToFile(
    tag: string,
    url: string,
    path: string,
    headers: Record<string, string>,
  ): Promise<{statusCode: number}>;
  cancelFetches(tag: string): void;
}

// Segments go through the app's OkHttp client so DNS over HTTPS, WARP and
// ByeDPI apply to them, as they do to the playlist. RNFS.downloadFile uses
// HttpURLConnection, which skips all three.
const nativeFetcher = NativeModules.HttpDownloadModule as
  | Partial<NativeFileFetcher>
  | undefined;
const canFetchNatively =
  typeof nativeFetcher?.fetchToFile === 'function' &&
  typeof nativeFetcher?.cancelFetches === 'function';

interface SegmentInfo {
  duration: number;
  url: string;
  index: number;
}

interface M3U8Data {
  segments: SegmentInfo[];
  initSegmentUrl?: string;
  totalDuration: number;
  isLive: boolean;
}

const MAX_SEGMENT_ATTEMPTS = 5;
const SEGMENT_RETRY_BASE_MS = 1000;
const MAX_SEGMENT_RETRY_MS = 16000;

class SegmentHttpError extends Error {
  constructor(readonly status: number) {
    super(`Segment download failed with HTTP status ${status}`);
  }
}

const sleep = (ms: number) =>
  new Promise<void>(resolve => setTimeout(resolve, ms));

const cancelledDownloads = new Set<string>();
const activeDownloads = new Set<string>();

const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36';

const resolveUrl = (targetUrl: string, baseUrl: string): string => {
  try {
    return new URL(targetUrl, baseUrl).toString();
  } catch {
    const base = baseUrl.substring(0, baseUrl.lastIndexOf('/') + 1);
    if (targetUrl.startsWith('http')) {
      return targetUrl;
    }
    if (targetUrl.startsWith('/')) {
      try {
        const u = new URL(baseUrl);
        return `${u.origin}${targetUrl}`;
      } catch {
        return base + targetUrl;
      }
    }
    return base + targetUrl;
  }
};

const normalizeHeaders = (headers?: Record<string, string>): Record<string, string> => {
  const result: Record<string, string> = {
    'User-Agent': DEFAULT_USER_AGENT,
    ...(headers || {}),
  };
  return result;
};

const parseM3U8Playlist = async (
  url: string,
  headers: Record<string, string> = {},
): Promise<M3U8Data> => {
  try {
    console.log('Fetching M3U8 playlist:', url);
    const reqHeaders = normalizeHeaders(headers);
    const response = await axios.get(url, {
      headers: reqHeaders,
      timeout: 15000,
    });

    const content = typeof response.data === 'string' ? response.data : String(response.data);
    console.log('M3U8 content preview:', content.substring(0, 300));
    const lines = content.split('\n').map((line: string) => line.trim());

    const segments: SegmentInfo[] = [];
    let initSegmentUrl: string | undefined;
    let totalDuration = 0;
    let isLive = false;
    let segmentIndex = 0;

    // Check if this is a master playlist (contains #EXT-X-STREAM-INF)
    const hasMasterPlaylist = lines.some((line: string) =>
      line.includes('#EXT-X-STREAM-INF'),
    );

    if (hasMasterPlaylist) {
      console.log(
        'Detected master playlist, looking for best quality stream...',
      );

      let bestQualityUrl: string | null = null;
      let highestBandwidth = 0;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (line.includes('#EXT-X-STREAM-INF')) {
          const bandwidthMatch = line.match(/BANDWIDTH=(\d+)/);
          const bandwidth = bandwidthMatch
            ? parseInt(bandwidthMatch[1], 10)
            : 0;

          // Find the next non-empty, non-comment line which is the stream playlist URL
          let playlistUrl = '';
          for (let j = i + 1; j < lines.length; j++) {
            const candidate = lines[j];
            if (candidate && !candidate.startsWith('#')) {
              playlistUrl = candidate;
              break;
            }
          }

          if (playlistUrl) {
            const resolvedUrl = resolveUrl(playlistUrl, url);
            if (bandwidth > highestBandwidth || !bestQualityUrl) {
              highestBandwidth = bandwidth;
              bestQualityUrl = resolvedUrl;
            }
          }
        }
      }

      if (bestQualityUrl) {
        console.log(
          'Found best quality stream:',
          bestQualityUrl,
          'with bandwidth:',
          highestBandwidth,
        );
        return await parseM3U8Playlist(bestQualityUrl, headers);
      } else {
        throw new Error('No valid stream found in master playlist');
      }
    }

    // Parse regular playlist with segments
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.includes('#EXT-X-ENDLIST')) {
        isLive = false;
      } else if (line.startsWith('#EXT-X-KEY:')) {
        // Segments are joined as raw bytes, so encrypted or byte range
        // playlists would save a file that cannot be played.
        const method = line.match(/METHOD=([^,\s]+)/)?.[1];
        if (method && method !== 'NONE') {
          throw new Error(`Encrypted HLS (${method}) cannot be downloaded`);
        }
      } else if (line.startsWith('#EXT-X-BYTERANGE')) {
        throw new Error('HLS byte range playlists cannot be downloaded');
      } else if (line.includes('#EXT-X-MAP:')) {
        const uriMatch = line.match(/URI=["']?([^"']+)["']?/);
        if (uriMatch && uriMatch[1]) {
          initSegmentUrl = resolveUrl(uriMatch[1], url);
        }
      } else if (line.includes('#EXTINF:')) {
        const durationMatch = line.match(/#EXTINF:([\d.]+)/);
        const duration = durationMatch ? parseFloat(durationMatch[1]) : 0;

        // Scan subsequent lines for the segment URL
        let segmentUrl = '';
        for (let j = i + 1; j < lines.length; j++) {
          const candidate = lines[j];
          if (candidate && !candidate.startsWith('#')) {
            segmentUrl = candidate;
            break;
          }
        }

        if (segmentUrl) {
          const resolvedSegmentUrl = resolveUrl(segmentUrl, url);
          segments.push({
            duration,
            url: resolvedSegmentUrl,
            index: segmentIndex++,
          });
          totalDuration += duration;
        }
      }
    }

    console.log(
      `Parsed ${segments.length} segments, total duration: ${totalDuration}s, hasInit: ${Boolean(initSegmentUrl)}`,
    );

    return {
      segments,
      initSegmentUrl,
      totalDuration,
      isLive,
    };
  } catch (error) {
    console.error('Error parsing M3U8:', error);
    throw error;
  }
};

const downloadSegment = async (
  downloadId: string,
  segmentUrl: string,
  outputPath: string,
  headers: Record<string, string> = {},
): Promise<void> => {
  if (cancelledDownloads.has(downloadId)) {
    throw new Error('Download cancelled');
  }

  const reqHeaders = normalizeHeaders(headers);
  if (canFetchNatively) {
    const {statusCode} = await nativeFetcher!.fetchToFile!(
      downloadId,
      segmentUrl,
      outputPath,
      reqHeaders,
    );
    if (statusCode < 200 || statusCode >= 300) {
      throw new SegmentHttpError(statusCode);
    }
    return;
  }

  const download = RNFS.downloadFile({
    fromUrl: segmentUrl,
    toFile: outputPath,
    headers: reqHeaders,
    background: false,
    discretionary: false,
    cacheable: false,
    progressDivider: 0,
    connectionTimeout: 30000,
    readTimeout: 30000,
  });

  const result = await download.promise;
  if (result.statusCode < 200 || result.statusCode >= 400) {
    if (await RNFS.exists(outputPath)) {
      await RNFS.unlink(outputPath).catch(() => undefined);
    }
    throw new SegmentHttpError(result.statusCode);
  }
};

const mergeSegments = async (
  segmentPaths: string[],
  outputPath: string,
): Promise<void> => {
  let isFirstFile = true;
  let mergedCount = 0;

  for (const segmentPath of segmentPaths) {
    if (!segmentPath) continue;
    if (await RNFS.exists(segmentPath)) {
      if (isFirstFile) {
        await RNFS.copyFile(segmentPath, outputPath);
        isFirstFile = false;
      } else {
        const content = await RNFS.readFile(segmentPath, 'base64');
        await RNFS.appendFile(outputPath, content, 'base64');
      }
      mergedCount++;

      // Clean up segment file immediately
      await RNFS.unlink(segmentPath).catch(() => undefined);
    }
  }

  if (mergedCount === 0 || !(await RNFS.exists(outputPath))) {
    throw new Error('Failed to merge HLS segments: no downloaded segments available');
  }
};

export const hlsDownloader2 = async ({
  videoUrl,
  downloadId,
  path,
  title,
  tempDirectory,
  onJobStarted,
  onProgress,
  onCompleted,
  headers = {},
  connections = 4,
}: {
  videoUrl: string;
  downloadId: string;
  path: string;
  title: string;
  tempDirectory?: string;
  onJobStarted?: (jobId: string) => void;
  onProgress?: (completedSegments: number, totalSegments: number) => void;
  onCompleted?: (outputPath: string) => void | Promise<void>;
  headers?: any;
  /** Segments downloaded at the same time. */
  connections?: number;
}) => {
  cancelledDownloads.delete(downloadId);
  activeDownloads.add(downloadId);
  onJobStarted?.(downloadId);

  const tempDir = tempDirectory || `${RNFS.CachesDirectoryPath}/hls_segments`;

  try {
    // Ensure temp directory exists
    if (!(await RNFS.exists(tempDir))) {
      await RNFS.mkdir(tempDir);
    }

    // Parse the M3U8 playlist
    console.log('Parsing M3U8 playlist...');
    const m3u8Data = await parseM3U8Playlist(videoUrl, headers);

    if (m3u8Data.segments.length === 0) {
      throw new Error('No segments found in playlist');
    }

    console.log(
      `Found ${m3u8Data.segments.length} segments, total duration: ${m3u8Data.totalDuration}s`,
    );

    const segmentPaths: string[] = [];

    // Download init segment (fMP4 EXT-X-MAP) if present
    if (m3u8Data.initSegmentUrl) {
      const initPath = `${tempDir}/init_segment.mp4`;
      console.log('Downloading fMP4 init segment...');
      await downloadSegment(downloadId, m3u8Data.initSegmentUrl, initPath, headers);
      segmentPaths.push(initPath);
    }

    // A pool of workers takes segments in order. Each 429 or 503 removes a
    // worker, so a server that limits connections gets fewer of them.
    const offset = m3u8Data.initSegmentUrl ? 1 : 0;
    let downloadedSegments = 0;
    let nextSegment = 0;
    let workerLimit = Math.max(
      1,
      Math.min(connections, m3u8Data.segments.length),
    );
    let failed = false;

    const downloadWithRetry = async (url: string, segmentPath: string) => {
      for (let attempt = 1; ; attempt++) {
        try {
          await downloadSegment(downloadId, url, segmentPath, headers);
          return;
        } catch (error) {
          if (cancelledDownloads.has(downloadId)) {
            throw error;
          }
          const status = error instanceof SegmentHttpError ? error.status : 0;
          const rateLimited = status === 429 || status === 503;
          const permanent =
            status >= 400 && status < 500 && status !== 408 && !rateLimited;
          if (permanent || attempt >= MAX_SEGMENT_ATTEMPTS) {
            throw error;
          }
          if (rateLimited && workerLimit > 1) {
            workerLimit--;
          }
          await sleep(
            Math.min(
              SEGMENT_RETRY_BASE_MS * 2 ** (attempt - 1),
              MAX_SEGMENT_RETRY_MS,
            ),
          );
        }
      }
    };

    const runWorker = async (workerIndex: number) => {
      while (workerIndex < workerLimit && !failed) {
        if (cancelledDownloads.has(downloadId)) {
          throw new Error('Download cancelled by user');
        }
        const segment = m3u8Data.segments[nextSegment++];
        if (!segment) {
          return;
        }
        const segmentPath = `${tempDir}/segment_${segment.index}.ts`;
        segmentPaths[segment.index + offset] = segmentPath;
        try {
          await downloadWithRetry(segment.url, segmentPath);
        } catch (error) {
          failed = true;
          console.error(`Failed to download segment ${segment.index}:`, error);
          throw error;
        }
        downloadedSegments++;
        onProgress?.(downloadedSegments, m3u8Data.segments.length);
      }
    };

    await Promise.all(
      Array.from({length: workerLimit}, (_, index) => runWorker(index)),
    );

    if (cancelledDownloads.has(downloadId)) {
      throw new Error('Download cancelled by user');
    }

    // Merge all segments into final file
    console.log('Merging segments...');
    await mergeSegments(segmentPaths, path);

    // Clean up temp directory
    if (await RNFS.exists(tempDir)) {
      await RNFS.unlink(tempDir).catch(() => undefined);
    }

    if (cancelledDownloads.has(downloadId)) {
      if (await RNFS.exists(path)) {
        await RNFS.unlink(path).catch(() => undefined);
      }
      throw new Error('Download cancelled by user');
    }

    // Success
    console.log('Download completed successfully');
    await onCompleted?.(path);
  } catch (error) {
    console.error('HLS download failed:', error);

    const cancelled = cancelledDownloads.has(downloadId);

    if (await RNFS.exists(tempDir)) {
      await RNFS.unlink(tempDir).catch(() => undefined);
    }

    if (await RNFS.exists(path)) {
      await RNFS.unlink(path).catch(() => undefined);
    }

    const errorMessage = cancelled
      ? 'Download cancelled'
      : `Failed to download ${title}`;
    console.error(errorMessage);

    throw error;
  } finally {
    if (canFetchNatively) {
      nativeFetcher!.cancelFetches!(downloadId);
    }
    activeDownloads.delete(downloadId);
    cancelledDownloads.delete(downloadId);
  }
};

// Function to cancel ongoing download
export const cancelHlsDownload = (downloadId: string) => {
  if (activeDownloads.has(downloadId)) {
    cancelledDownloads.add(downloadId);
    if (canFetchNatively) {
      nativeFetcher!.cancelFetches!(downloadId);
    }
    console.log(`Cancelling HLS download: ${downloadId}`);
  }
};

// Check if a download is in progress
export const isHlsDownloadInProgress = (downloadId: string): boolean =>
  activeDownloads.has(downloadId) && !cancelledDownloads.has(downloadId);

