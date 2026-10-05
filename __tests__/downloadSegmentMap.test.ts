import {describe, expect, it} from '@jest/globals';
import {
  buildSegmentCells,
  parseDownloadRanges,
} from '../src/lib/downloadSegmentMap';

describe('buildSegmentCells', () => {
  it('fills everything outside the ranges still downloading', () => {
    // 4 cells of 100 bytes; bytes 150-300 are missing, a connection at 150.
    const cells = buildSegmentCells(
      400,
      [{start: 150, end: 300, speed: 10, active: true}],
      4,
    );
    expect(cells).toEqual([
      {fill: 1, active: false},
      {fill: 0.5, active: true},
      {fill: 0, active: false},
      {fill: 1, active: false},
    ]);
  });

  it('returns no cells when the size is unknown', () => {
    expect(buildSegmentCells(0, [], 10)).toEqual([]);
  });
});

describe('parseDownloadRanges', () => {
  it('reads native entries and skips malformed ones', () => {
    expect(
      parseDownloadRanges([[0, 10, 5, 1], [10, 20, 0, 0], ['x'], 3]),
    ).toEqual([
      {start: 0, end: 10, speed: 5, active: true},
      {start: 10, end: 20, speed: 0, active: false},
    ]);
  });
});
