import type {MaterialColors} from './colors';
import {mixHex} from './seeds';

/** Palette the Info page derives from a poster accent; shared with the remote player. */
export const buildDetailPalette = (
  colors: MaterialColors,
  imageAccent: string,
): MaterialColors => {
  const paleAccent = mixHex(imageAccent, '#FFFFFF', 0.72);
  const darkContent = '#171717' as const;
  const tintedSurface = (base: string, amount: number) =>
    mixHex(base, imageAccent, amount);
  return {
    ...colors,
    primary: paleAccent,
    onPrimary: darkContent,
    primaryContainer: paleAccent,
    onPrimaryContainer: darkContent,
    secondary: mixHex(imageAccent, '#FFFFFF', 0.66),
    onSecondary: darkContent,
    secondaryContainer: mixHex(imageAccent, '#FFFFFF', 0.78),
    onSecondaryContainer: darkContent,
    tertiary: mixHex(imageAccent, '#FFFFFF', 0.62),
    onTertiary: darkContent,
    tertiaryContainer: mixHex(imageAccent, '#FFFFFF', 0.8),
    onTertiaryContainer: darkContent,
    surfaceTint: paleAccent,
    background: mixHex(imageAccent, '#000000', 0.96),
    surface: tintedSurface('#171717', 0.08),
    surfaceDim: tintedSurface('#141414', 0.06),
    surfaceContainerLowest: tintedSurface('#101010', 0.05),
    surfaceContainerLow: tintedSurface('#1B1B1B', 0.1),
    surfaceContainer: tintedSurface('#222222', 0.12),
    surfaceContainerHigh: tintedSurface('#2A2A2A', 0.14),
    surfaceContainerHighest: tintedSurface('#343434', 0.16),
    surfaceBright: tintedSurface('#3D3D3D', 0.18),
    surfaceVariant: tintedSurface('#303030', 0.14),
    outline: mixHex(imageAccent, '#FFFFFF', 0.48),
    outlineVariant: tintedSurface('#5A5A5A', 0.18),
  };
};
