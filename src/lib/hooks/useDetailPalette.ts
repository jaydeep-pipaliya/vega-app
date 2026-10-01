import {useEffect, useMemo, useState} from 'react';
import {extractImageAccent, getCachedImageAccent} from '../imageAccent';
import {settingsStorage} from '../storage';
import {useM3Colors} from '../../theme/M3PaletteContext';
import {buildDetailPalette} from '../../theme/detailPalette';
import type {MaterialColors} from '../../theme/colors';

/**
 * Same accent rule as the Info page: poster accent when dynamic info accent is
 * on, otherwise the app palette (the user's selected accent). Uses Info's cache
 * key, so a title opened from Info resolves without re-extracting.
 */
export const useDetailPalette = (accentImage?: string): MaterialColors => {
  const colors = useM3Colors();
  const dynamicEnabled = settingsStorage.isDynamicInfoAccentEnabled();
  const cacheKey = accentImage ? `detail-bg-accent-v1:${accentImage}` : '';
  const [imageAccent, setImageAccent] = useState<string | undefined>(() =>
    dynamicEnabled && cacheKey ? getCachedImageAccent(cacheKey) : undefined,
  );

  useEffect(() => {
    if (!dynamicEnabled || !accentImage) {
      setImageAccent(undefined);
      return;
    }
    let active = true;
    const cached = getCachedImageAccent(cacheKey);
    if (cached) {
      setImageAccent(cached);
      return;
    }
    extractImageAccent(accentImage, cacheKey).then(color => {
      if (active && color) setImageAccent(color);
    });
    return () => {
      active = false;
    };
  }, [accentImage, cacheKey, dynamicEnabled]);

  return useMemo(
    () => (imageAccent ? buildDetailPalette(colors, imageAccent) : colors),
    [colors, imageAccent],
  );
};
