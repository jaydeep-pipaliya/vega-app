import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React from 'react';
import {Text, View} from 'react-native';
import {isLibraryIconKey, LIBRARY_ICONS} from '../../lib/library/libraryIcons';
import {useM3Colors} from '../../theme/M3PaletteContext';
import {readableOnColor} from '../../theme/seeds';

interface LibraryIconProps {
  icon: string;
  color?: string;
  /** Glyph size. The tile is about 1.8x this. */
  size?: number;
  /** Draw the icon on a colored rounded tile. */
  tile?: boolean;
  /** Glyph color when there is no tile. */
  glyphColor?: string;
}

/** Category icon: an icon key from LIBRARY_ICONS or an emoji. */
const LibraryIcon = ({
  icon,
  color,
  size = 20,
  tile = false,
  glyphColor,
}: LibraryIconProps) => {
  const colors = useM3Colors();
  const background = color || colors.primaryContainer;
  const foreground = tile
    ? color
      ? readableOnColor(color)
      : colors.onPrimaryContainer
    : glyphColor || color || colors.onSurface;

  const glyph = isLibraryIconKey(icon) ? (
    <MaterialCommunityIcons
      name={LIBRARY_ICONS[icon]}
      size={size}
      color={foreground}
    />
  ) : (
    <Text style={{fontSize: size * 0.9, lineHeight: size * 1.15}}>
      {icon}
    </Text>
  );

  if (!tile) {
    return glyph;
  }
  const tileSize = Math.round(size * 1.8);
  return (
    <View
      style={{
        alignItems: 'center',
        backgroundColor: background,
        borderRadius: Math.round(tileSize * 0.32),
        height: tileSize,
        justifyContent: 'center',
        width: tileSize,
      }}>
      {glyph}
    </View>
  );
};

export default LibraryIcon;
