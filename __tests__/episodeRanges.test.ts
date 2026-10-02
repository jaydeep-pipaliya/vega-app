import {buildEpisodeRanges, rangeForIndex} from '../src/lib/utils/episodeRanges';

const labels = (count: number) =>
  buildEpisodeRanges(count).map(r => `${r.start + 1}-${r.end}`);

describe('buildEpisodeRanges', () => {
  it('does not split lists that fit in one range', () => {
    expect(labels(10)).toEqual([]);
    expect(labels(50)).toEqual([]);
  });

  it('merges a short trailing range into the previous one', () => {
    expect(labels(58)).toEqual([]);
    expect(labels(74)).toEqual([]);
    expect(labels(120)).toEqual(['1-50', '51-120']);
  });

  it('keeps a trailing range that is long enough', () => {
    expect(labels(75)).toEqual(['1-50', '51-75']);
    expect(labels(140)).toEqual(['1-50', '51-100', '101-140']);
  });

  it('finds the range for an episode', () => {
    const ranges = buildEpisodeRanges(140);
    expect(rangeForIndex(ranges, 0)?.start).toBe(0);
    expect(rangeForIndex(ranges, 99)?.start).toBe(50);
    expect(rangeForIndex(ranges, 139)?.start).toBe(100);
  });
});
