import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React from 'react';
import {Platform, View} from 'react-native';
import {TVFocusable} from '../../../components/tv';
import AppText from '../../../components/ui/Text';
import {isTV} from '../../../lib/tv';
import {useTVFocusBorderColor} from '../../../lib/tv/useTVFocusBorderColor';
import {useM3Colors} from '../../../theme/M3PaletteContext';

interface DownloadsSelectionHeaderProps {
  selectedCount: number;
  isAllSelected: boolean;
  onExitSelection: () => void;
  onInvertSelection: () => void;
  onToggleSelectAll: () => void;
}

export const DownloadsSelectionHeader: React.FC<DownloadsSelectionHeaderProps> = ({
  selectedCount,
  isAllSelected,
  onExitSelection,
  onInvertSelection,
  onToggleSelectAll,
}) => {
  const colors = useM3Colors();
  const focusBorderColor = useTVFocusBorderColor();

  return (
    <View
      style={{
        alignItems: 'center',
        backgroundColor: colors.surfaceContainerHigh,
        borderBottomColor: colors.outlineVariant,
        borderBottomWidth: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingBottom: 12,
        paddingLeft: isTV ? 20 : 16,
        paddingRight: isTV ? 48 : 16,
        paddingTop: Platform.OS === 'android' ? (isTV ? 20 : 36) : 14,
        zIndex: 10,
      }}>
      <View style={{alignItems: 'center', flexDirection: 'row', gap: 16}}>
        <TVFocusable
          hasTVPreferredFocus={isTV}
          accessibilityRole="button"
          accessibilityLabel="Exit selection"
          onPress={onExitSelection}
          borderRadius={20}
          focusScale={1.1}
          focusBorderColor={focusBorderColor}
          style={{
            alignItems: 'center',
            borderRadius: 20,
            justifyContent: 'center',
            minHeight: 40,
            minWidth: 40,
            padding: 4,
          }}>
          <MaterialCommunityIcons
            name="close"
            size={26}
            color={colors.onSurface}
          />
        </TVFocusable>
        <AppText
          role="titleLargeEmphasized"
          style={{color: colors.onSurface}}>
          {selectedCount} selected
        </AppText>
      </View>

      <View style={{alignItems: 'center', flexDirection: 'row', gap: 12}}>
        <TVFocusable
          accessibilityRole="button"
          accessibilityLabel="Invert selection"
          onPress={onInvertSelection}
          borderRadius={20}
          focusScale={1.1}
          focusBorderColor={focusBorderColor}
          style={{
            alignItems: 'center',
            borderRadius: 20,
            justifyContent: 'center',
            minHeight: 40,
            minWidth: 40,
            padding: 4,
          }}>
          <MaterialCommunityIcons
            name="select-inverse"
            size={24}
            color={colors.onSurfaceVariant}
          />
        </TVFocusable>
        <TVFocusable
          accessibilityRole="button"
          accessibilityLabel="Select all"
          onPress={onToggleSelectAll}
          borderRadius={20}
          focusScale={1.1}
          focusBorderColor={focusBorderColor}
          style={{
            alignItems: 'center',
            borderRadius: 20,
            justifyContent: 'center',
            minHeight: 40,
            minWidth: 40,
            padding: 4,
          }}>
          <MaterialIcons
            name="select-all"
            size={24}
            color={isAllSelected ? colors.primary : colors.onSurface}
          />
        </TVFocusable>
      </View>
    </View>
  );
};

export default React.memo(DownloadsSelectionHeader);
