/** Seconds shown before the next episode starts on its own. */
export const AUTO_NEXT_COUNTDOWN_SECONDS = 10;

/**
 * A seek that lands this many seconds or more before the end means the viewer
 * went back to watch something again, so the pending countdown is dropped.
 */
export const AUTO_NEXT_SEEK_BACK_SECONDS = 3;

export interface AutoNextConditions {
  enabled: boolean;
  hasNext: boolean;
  isCasting: boolean;
  isMovie: boolean;
}

export function shouldAutoPlayNext({
  enabled,
  hasNext,
  isCasting,
  isMovie,
}: AutoNextConditions): boolean {
  return enabled && hasNext && !isCasting && !isMovie;
}

/** True when a seek moved playback clearly away from the end of the video. */
export function isSeekAwayFromEnd(seekTime: number, duration: number): boolean {
  if (!Number.isFinite(seekTime) || !Number.isFinite(duration)) {
    return false;
  }
  if (duration <= 0) {
    return false;
  }
  return duration - seekTime >= AUTO_NEXT_SEEK_BACK_SECONDS;
}
