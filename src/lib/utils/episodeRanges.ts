export interface EpisodeRange {
  /** Index of the first episode, inclusive. */
  start: number;
  /** Index after the last episode, exclusive. */
  end: number;
}

export const EPISODE_RANGE_SIZE = 50;
/** A trailing range shorter than this is merged into the one before it. */
export const MIN_LAST_RANGE = 25;

/**
 * Splits a long episode list into ranges of 50. Returns an empty array when
 * the list fits in one range, so no range picker is shown.
 */
export function buildEpisodeRanges(count: number): EpisodeRange[] {
  if (count <= EPISODE_RANGE_SIZE) return [];
  const ranges: EpisodeRange[] = [];
  for (let start = 0; start < count; start += EPISODE_RANGE_SIZE) {
    ranges.push({start, end: Math.min(start + EPISODE_RANGE_SIZE, count)});
  }
  const last = ranges[ranges.length - 1];
  if (ranges.length > 1 && last.end - last.start < MIN_LAST_RANGE) {
    ranges.pop();
    ranges[ranges.length - 1].end = count;
  }
  return ranges.length > 1 ? ranges : [];
}

/** The range holding the episode at [index], or the first range. */
export function rangeForIndex(
  ranges: EpisodeRange[],
  index: number,
): EpisodeRange | undefined {
  return ranges.find(r => index >= r.start && index < r.end) ?? ranges[0];
}
