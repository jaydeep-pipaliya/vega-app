/**
 * Android ripple color for a pressable row: the given color at about 16%
 * opacity, like Material's pressed state. Colors that are not #RRGGBB are
 * returned unchanged.
 */
export const rippleColor = (color: string): string =>
  /^#[0-9a-f]{6}$/i.test(color) ? `${color}29` : color;
