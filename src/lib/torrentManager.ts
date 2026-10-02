import {NativeModules, Platform} from 'react-native';

const {TorrentModule} = NativeModules;

export interface TorrentFile {
  index: number;
  name: string;
  path: string;
  size: number;
}

export interface TorrentAddResult {
  infoHash: string;
  state: string;
  hasMetadata: boolean;
  name?: string;
  totalSize?: number;
  files?: TorrentFile[];
}

export interface TorrentStats {
  state: string;
  progress: number;
  downloadRate: number;
  uploadRate: number;
  numPeers: number;
  numSeeds: number;
  totalDone: number;
  totalWanted: number;
  hasMetadata: boolean;
}

export interface TorrentCompleteResult {
  success: boolean;
  outputPath: string;
  fileName: string;
  size: number;
}

class TorrentManager {
  private streamPort: number | null = null;
  private isInitialized = false;

  async init(): Promise<void> {
    if (Platform.OS !== 'android') {
      throw new Error('Torrent streaming is only supported on Android');
    }
    if (this.isInitialized) {
      return;
    }

    try {
      const result = await TorrentModule.initEngine();
      this.streamPort = result.streamPort;
      this.isInitialized = true;
      console.log('TorrentManager initialized, stream port:', this.streamPort);
    } catch (error) {
      console.error('Failed to init TorrentModule:', error);
      throw error;
    }
  }

  async addTorrent(
    magnetOrUrl: string,
    options?: {output_folder?: string; file_name?: string},
  ): Promise<TorrentAddResult> {
    await this.init();
    return await TorrentModule.addTorrent(
      magnetOrUrl,
      options?.output_folder || null,
      options?.file_name || null,
    );
  }

  async getStats(infoHash: string): Promise<TorrentStats> {
    await this.init();
    return await TorrentModule.getStats(infoHash);
  }

  async getFiles(infoHash: string): Promise<TorrentFile[]> {
    await this.init();
    return await TorrentModule.getFiles(infoHash);
  }

  /**
   * Prioritizes the pieces a player reads first. [resuming] skips the opening
   * minutes, since playback starts mid-file. Without [fullDownload], only about
   * a minute ahead of playback downloads.
   */
  async prepareVideoFile(
    infoHash: string,
    fileIndex = 0,
    resuming = false,
    fullDownload = true,
  ): Promise<boolean> {
    await this.init();
    return await TorrentModule.prepareVideoFile(
      infoHash,
      fileIndex,
      resuming,
      fullDownload,
    );
  }

  /** Lets the stream server size its one-minute buffer from the video bitrate. */
  async setStreamDuration(
    infoHash: string,
    durationSeconds: number,
  ): Promise<void> {
    await this.init();
    await TorrentModule.setStreamDuration(infoHash, durationSeconds);
  }

  async getStreamUrl(infoHash: string, fileIndex = 0): Promise<string> {
    await this.init();
    return await TorrentModule.getStreamUrl(infoHash, fileIndex);
  }

  async pauseTorrent(infoHash: string): Promise<void> {
    await this.init();
    await TorrentModule.pauseTorrent(infoHash);
  }

  async resumeTorrent(infoHash: string): Promise<void> {
    await this.init();
    await TorrentModule.resumeTorrent(infoHash);
  }

  async completeTorrent(infoHash: string): Promise<TorrentCompleteResult> {
    await this.init();
    return await TorrentModule.completeTorrent(infoHash);
  }

  async deleteTorrent(infoHash: string, deleteFiles = true): Promise<void> {
    await this.init();
    await TorrentModule.deleteTorrent(infoHash, deleteFiles);
  }
}

export const torrentManager = new TorrentManager();
