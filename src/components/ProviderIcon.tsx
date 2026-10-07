import React, {useEffect, useState} from 'react';
import {Image, Text, View} from 'react-native';

interface ProviderIconProps {
  uri?: string;
  name: string;
  size?: number;
  /** Tile behind the letter fallback only; a logo has no tile of its own. */
  background: string;
  /** Colour of the letter fallback. */
  color: string;
}

/**
 * Provider logo in a fixed rounded square. Logos come in any shape, size and
 * format (png, webp, jpg, some with transparent edges), so the image always
 * fills the same square and is clipped to its corners. A missing or broken
 * logo shows the provider's first letter on a faint tile of the same size, so
 * every row lines up.
 */
const ProviderIcon = ({
  uri,
  name,
  size = 32,
  background,
  color,
}: ProviderIconProps) => {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [uri]);
  const showImage = Boolean(uri) && !failed;

  return (
    <View
      style={{
        alignItems: 'center',
        // A logo sits straight on the drawer; only the letter needs a tile,
        // or it would read as plain text.
        backgroundColor: showImage ? 'transparent' : background,
        borderRadius: Math.round(size * 0.3),
        height: size,
        justifyContent: 'center',
        overflow: 'hidden',
        width: size,
      }}>
      {showImage ? (
        <Image
          source={{uri}}
          style={{height: '100%', width: '100%'}}
          resizeMode="cover"
          resizeMethod="resize"
          onError={() => setFailed(true)}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <Text
          style={{
            color,
            fontSize: Math.round(size * 0.45),
            fontWeight: '700',
          }}>
          {(name.trim()[0] || '?').toUpperCase()}
        </Text>
      )}
    </View>
  );
};

export default ProviderIcon;
