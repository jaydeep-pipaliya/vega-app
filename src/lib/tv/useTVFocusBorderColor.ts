import {useMemo} from 'react';
import useThemeStore from '../zustand/themeStore';
import {useM3Colors} from '../../theme/M3PaletteContext';
import {isTV} from './constants';

const WHITE_ACCENT_FOCUS_GRAY = '#9E9E9E';

const FORBIDDEN_FOCUS_HEXES = new Set([
  '#E50914',
  '#FFB4A8',
  '#EF4444',
  '#FF6347',
  '#FFA07A',
  '#FF5722',
  '#FF7043',
  '#F97316',
  '#EA580C',
  '#FFA500',
  '#FF4500',
]);

const isForbiddenColor = (color?: string): boolean => {
  if (!color || typeof color !== 'string') return true;
  const clean = color.trim().toUpperCase();
  if (FORBIDDEN_FOCUS_HEXES.has(clean)) return true;

  const hex = clean.replace('#', '');
  if (hex.length !== 6 && hex.length !== 3) return false;
  const full = hex.length === 3 ? hex.split('').map(c => c + c).join('') : hex;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return false;

  // Dominant red/orange channel
  return r > 180 && r - b > 65 && g < 175;
};

export const useTVFocusBorderColor = (overrideColor?: string): string => {
  const m3Colors = useM3Colors();
  const themePrimary = useThemeStore(state => state.primary);
  const accentSource = useThemeStore(state => state.source);

  return useMemo(() => {
    if (
      isTV &&
      accentSource === 'custom' &&
      themePrimary?.trim().toUpperCase() === '#FFFFFF'
    ) {
      return WHITE_ACCENT_FOCUS_GRAY;
    }

    if (overrideColor && !isForbiddenColor(overrideColor)) {
      return overrideColor.trim();
    }

    if (themePrimary && !isForbiddenColor(themePrimary)) {
      return themePrimary.trim();
    }

    if (m3Colors?.primary && !isForbiddenColor(m3Colors.primary)) {
      return m3Colors.primary.trim();
    }

    return '#FFFFFF';
  }, [overrideColor, themePrimary, accentSource, m3Colors?.primary]);
};

export default useTVFocusBorderColor;
