import {
  isTV,
  TV_CARD_WIDTH,
  TV_CARD_HEIGHT,
  TV_CARD_MARGIN,
  TV_FONT_SIZES,
  TV_SPACING,
  TV_FOCUS_SCALE,
  TV_FOCUS_BORDER_WIDTH,
  TV_FOCUS_ANIMATION_DURATION,
  TV_REMOTE_KEYS,
} from '../src/lib/tv/constants';

describe('TV Constants and Utilities', () => {
  it('exports expected layout dimensions and sizing', () => {
    expect(typeof isTV).toBe('boolean');
    expect(TV_FOCUS_SCALE).toBe(1.08);
    expect(TV_FOCUS_BORDER_WIDTH).toBe(3);
    expect(TV_FOCUS_ANIMATION_DURATION).toBe(150);
    expect(TV_CARD_WIDTH).toBeGreaterThan(0);
    expect(TV_CARD_HEIGHT).toBeGreaterThan(0);
  });

  it('exports valid typography scale', () => {
    expect(TV_FONT_SIZES.title).toBeGreaterThan(TV_FONT_SIZES.subtitle);
    expect(TV_FONT_SIZES.subtitle).toBeGreaterThan(TV_FONT_SIZES.body);
    expect(TV_FONT_SIZES.body).toBeGreaterThan(TV_FONT_SIZES.small);
  });

  it('exports valid spacing scale', () => {
    expect(TV_SPACING.xl).toBeGreaterThan(TV_SPACING.lg);
    expect(TV_SPACING.lg).toBeGreaterThan(TV_SPACING.md);
    expect(TV_SPACING.md).toBeGreaterThan(TV_SPACING.sm);
    expect(TV_SPACING.sm).toBeGreaterThan(TV_SPACING.xs);
  });

  it('exports complete set of remote control keys', () => {
    expect(TV_REMOTE_KEYS.SELECT).toBe('select');
    expect(TV_REMOTE_KEYS.PLAY_PAUSE).toBe('playPause');
    expect(TV_REMOTE_KEYS.UP).toBe('up');
    expect(TV_REMOTE_KEYS.DOWN).toBe('down');
    expect(TV_REMOTE_KEYS.LEFT).toBe('left');
    expect(TV_REMOTE_KEYS.RIGHT).toBe('right');
    expect(TV_REMOTE_KEYS.MENU).toBe('menu');
    expect(TV_REMOTE_KEYS.BACK).toBe('back');
  });
});
