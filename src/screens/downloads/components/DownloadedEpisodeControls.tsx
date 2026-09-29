import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React from 'react';
import {TextInput, View} from 'react-native';
import {TVFocusable} from '../../../components/tv';
import {useTVFocusBorderColor} from '../../../lib/tv/useTVFocusBorderColor';
import {useM3Colors} from '../../../theme/M3PaletteContext';

interface DownloadedEpisodeControlsProps {
  searchText: string;
  onSearchChange: (text: string) => void;
  sortOrder: 'asc' | 'desc';
  onToggleSort: () => void;
}

export const DownloadedEpisodeControls: React.FC<
  DownloadedEpisodeControlsProps
> = ({searchText, onSearchChange, sortOrder, onToggleSort}) => {
  const colors = useM3Colors();
  const focusBorderColor = useTVFocusBorderColor();

  return (
    <View className="mt-3 flex-row items-center">
      <View
        style={{
          backgroundColor: colors.surfaceContainerHigh,
          borderColor: colors.outlineVariant,
          borderRadius: 18,
          borderWidth: 1,
          flex: 1,
          flexDirection: 'row',
          height: 48,
          marginRight: 10,
          overflow: 'hidden',
        }}>
        <View
          style={{
            alignItems: 'center',
            justifyContent: 'center',
            paddingLeft: 14,
          }}>
          <MaterialCommunityIcons
            name="magnify"
            size={22}
            color={colors.primary}
          />
        </View>
        <TextInput
          accessibilityLabel="Find episode"
          placeholder="Find episode"
          placeholderTextColor={colors.onSurfaceVariant}
          selectionColor={colors.primary}
          returnKeyType="search"
          style={{
            color: colors.onSurface,
            flex: 1,
            fontSize: 16,
            paddingHorizontal: 10,
            paddingVertical: 0,
          }}
          value={searchText}
          onChangeText={onSearchChange}
        />
      </View>
      <TVFocusable
        accessibilityLabel={
          sortOrder === 'asc'
            ? 'Sort episodes descending'
            : 'Sort episodes ascending'
        }
        accessibilityRole="button"
        onPress={onToggleSort}
        borderRadius={18}
        focusScale={1.1}
        focusBorderColor={focusBorderColor}
        style={{
          alignItems: 'center',
          backgroundColor: colors.secondaryContainer,
          borderRadius: 18,
          height: 48,
          justifyContent: 'center',
          width: 48,
        }}>
        <MaterialCommunityIcons
          name={sortOrder === 'asc' ? 'sort-ascending' : 'sort-descending'}
          size={24}
          color={colors.onSecondaryContainer}
        />
      </TVFocusable>
    </View>
  );
};

export default React.memo(DownloadedEpisodeControls);
