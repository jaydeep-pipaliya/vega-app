import {NativeModules, Platform} from 'react-native';
import {settingsStorage} from './storage';

/**
 * Sends the "Faster playback on slow servers" setting to the native player.
 * The player reads it whenever it opens a video.
 */
export const syncParallelStreaming = (
  enabled: boolean = settingsStorage.getParallelStreaming(),
) => {
  if (Platform.OS !== 'android') {
    return;
  }
  NativeModules.HttpDownloadModule?.setParallelStreaming?.(enabled);
};
