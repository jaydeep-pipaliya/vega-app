import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React, {useEffect, useRef, useState} from 'react';
import {ActivityIndicator, Image, Text, View} from 'react-native';
import {TVFocusable} from '../../../components/tv';
import {formatDownloadBytes} from '../../../lib/downloadFormatting';
import {getDownloadedVideoThumbnail} from '../../../lib/downloadThumbnailCache';
import {useTVFocusBorderColor} from '../../../lib/tv/useTVFocusBorderColor';
import type {DownloadItem} from '../../../lib/zustand/downloadsStore';
import {useM3Colors} from '../../../theme/M3PaletteContext';

const DownloadedItemThumbnail = ({item}: {item: DownloadItem}) => {
  const colors = useM3Colors();
  const [thumbnailUri, setThumbnailUri] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setThumbnailUri(null);
    getDownloadedVideoThumbnail(item.filePath)
      .then(uri => {
        if (active) setThumbnailUri(uri);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [item.filePath]);

  return (
    <View
      style={{
        alignItems: 'center',
        backgroundColor: colors.secondaryContainer,
        borderRadius: 12,
        height: 45,
        justifyContent: 'center',
        overflow: 'hidden',
        width: 80,
      }}>
      {thumbnailUri ? (
        <Image
          source={{uri: thumbnailUri}}
          resizeMode="cover"
          style={{
            bottom: 0,
            left: 0,
            position: 'absolute',
            right: 0,
            top: 0,
          }}
        />
      ) : null}
      <Ionicons name="play" size={18} color="#ffffff" />
    </View>
  );
};

interface DownloadedEpisodeRowProps {
  item: DownloadItem;
  index: number;
  totalItems: number;
  isDeleting: boolean;
  onPlay: (item: DownloadItem) => void;
  onBeforePlay?: (control: View | null) => void;
  onDelete: (item: DownloadItem) => void;
}

export const DownloadedEpisodeRow: React.FC<DownloadedEpisodeRowProps> = ({
  item,
  index,
  totalItems,
  isDeleting,
  onPlay,
  onBeforePlay,
  onDelete,
}) => {
  const colors = useM3Colors();
  const focusBorderColor = useTVFocusBorderColor();
  const playControlRef = useRef<View>(null);

  return (
    <View className="mb-3 w-full flex-row items-stretch gap-2">
      <TVFocusable
        ref={playControlRef}
        accessibilityRole="button"
        accessibilityLabel={`Play ${item.episodeName || item.title}`}
        onPress={() => {
          onBeforePlay?.(playControlRef.current);
          onPlay(item);
        }}
        borderRadius={20}
        focusScale={1.02}
        focusBorderColor={focusBorderColor}
        style={{
          flex: 1,
          height: 64,
          backgroundColor: colors.surfaceContainerHigh,
          borderColor: colors.outlineVariant,
          borderRadius: 20,
          borderWidth: 1,
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
        }}>
        <DownloadedItemThumbnail item={item} />
        <View className="ml-3 flex-1">
          <Text
            className="font-semibold"
            style={{color: colors.onSurface}}
            numberOfLines={1}>
            {item.episodeName || item.title}
          </Text>
          <Text
            className="mt-1 text-xs"
            style={{color: colors.onSurfaceVariant}}>
            {totalItems > 1 ? `Episode ${index + 1}  ·  ` : ''}
            {formatDownloadBytes(item.totalBytes)}
          </Text>
        </View>
        <MaterialCommunityIcons
          name="chevron-right"
          size={22}
          color={colors.onSurfaceVariant}
        />
      </TVFocusable>

      <TVFocusable
        accessibilityLabel={`Delete ${item.episodeName || item.title}`}
        accessibilityRole="button"
        disabled={isDeleting}
        onPress={() => onDelete(item)}
        borderRadius={20}
        focusScale={1.08}
        focusBorderColor="#FFFFFF"
        style={{
          height: 64,
          width: 64,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.errorContainer,
          borderRadius: 20,
          opacity: isDeleting ? 0.45 : 1,
        }}>
        {isDeleting ? (
          <ActivityIndicator size="small" color={colors.onErrorContainer} />
        ) : (
          <MaterialCommunityIcons
            name="delete-outline"
            size={26}
            color={colors.onErrorContainer}
          />
        )}
      </TVFocusable>
    </View>
  );
};

export default React.memo(DownloadedEpisodeRow);
