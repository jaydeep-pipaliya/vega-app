import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React from 'react';
import {Text, View} from 'react-native';
import {TVFocusable} from '../../../components/tv';
import {useTVFocusBorderColor} from '../../../lib/tv/useTVFocusBorderColor';
import useDownloadsStore, {
  selectMissingDownloads,
} from '../../../lib/zustand/downloadsStore';
import {useM3Colors} from '../../../theme/M3PaletteContext';

const MissingDownloadsSection = ({primary}: {primary: string}) => {
  const colors = useM3Colors();
  const focusBorderColor = useTVFocusBorderColor();
  const missing = useDownloadsStore(selectMissingDownloads);
  const removeDownload = useDownloadsStore(state => state.removeDownload);

  if (missing.length === 0) {
    return null;
  }

  return (
    <View className="mb-5">
      <Text
        className="mb-3 text-xl font-bold"
        style={{color: colors.onBackground}}>
        Missing Downloads
      </Text>
      {missing.map(item => (
        <View
          key={item.id}
          className="mb-3 flex-row items-center p-3"
          style={{
            backgroundColor: colors.errorContainer,
            borderRadius: 20,
          }}>
          <View
            className="h-11 w-11 items-center justify-center"
            style={{
              backgroundColor: colors.error,
              borderRadius: 16,
            }}>
            <MaterialCommunityIcons
              name="file-alert-outline"
              size={24}
              color={colors.onError}
            />
          </View>
          <View className="ml-3 flex-1">
            <Text
              className="font-semibold"
              style={{color: colors.onErrorContainer}}
              numberOfLines={1}>
              {item.title}
            </Text>
            <Text
              className="mt-1 text-xs"
              style={{color: colors.onErrorContainer}}
              numberOfLines={2}>
              {item.errorMessage}
            </Text>
          </View>
          <TVFocusable
            accessibilityRole="button"
            accessibilityLabel={`Remove missing download ${item.title}`}
            onPress={() => removeDownload(item.id)}
            borderRadius={14}
            focusScale={1.05}
            focusBorderColor={focusBorderColor}
            style={{
              backgroundColor: colors.surfaceContainerHighest,
              borderRadius: 14,
              marginLeft: 8,
              paddingHorizontal: 12,
              paddingVertical: 8,
            }}>
            <Text
              className="text-sm font-bold"
              style={{color: colors.onSurface}}>
              Remove
            </Text>
          </TVFocusable>
        </View>
      ))}
    </View>
  );
};

export default MissingDownloadsSection;
