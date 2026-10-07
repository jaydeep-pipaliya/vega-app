import React from 'react';
import {ActivityIndicator, View} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Text from '../ui/Text';
import {TVFocusable} from '../tv';
import {useM3Colors} from '../../theme/M3PaletteContext';
import {useTVFocusBorderColor} from '../../lib/tv/useTVFocusBorderColor';
import type {CopyProgress} from './useEpisodeSelection';

interface EpisodeSelectionBarProps {
  selectedCount: number;
  allSelected: boolean;
  progress: CopyProgress | null;
  onExit: () => void;
  onToggleSelectAll: () => void;
  onCopyLinks: () => void;
  onCancelCopy: () => void;
}

const iconButtonStyle = {
  alignItems: 'center',
  borderRadius: 20,
  justifyContent: 'center',
  minHeight: 40,
  minWidth: 40,
  padding: 4,
} as const;

export const EpisodeSelectionBar: React.FC<EpisodeSelectionBarProps> = ({
  selectedCount,
  allSelected,
  progress,
  onExit,
  onToggleSelectAll,
  onCopyLinks,
  onCancelCopy,
}) => {
  const colors = useM3Colors();
  const focusBorderColor = useTVFocusBorderColor();
  const busy = progress !== null;
  const canCopy = selectedCount > 0 && !busy;

  return (
    <View
      style={{
        backgroundColor: colors.surfaceContainerHigh,
        borderColor: colors.outlineVariant,
        borderRadius: 18,
        borderWidth: 1,
        gap: 10,
        marginTop: 8,
        padding: 10,
      }}>
      <View style={{alignItems: 'center', flexDirection: 'row', gap: 8}}>
        <TVFocusable
          accessibilityRole="button"
          accessibilityLabel="Exit selection"
          onPress={onExit}
          borderRadius={20}
          focusScale={1.1}
          focusBorderColor={focusBorderColor}
          style={iconButtonStyle}>
          <MaterialCommunityIcons
            name="close"
            size={24}
            color={colors.onSurface}
          />
        </TVFocusable>
        <Text
          role="titleMediumEmphasized"
          style={{color: colors.onSurface, flex: 1}}>
          {selectedCount} selected
        </Text>
        <TVFocusable
          accessibilityRole="button"
          accessibilityLabel={allSelected ? 'Clear selection' : 'Select all'}
          accessibilityState={{selected: allSelected}}
          onPress={onToggleSelectAll}
          disabled={busy}
          borderRadius={20}
          focusScale={1.1}
          focusBorderColor={focusBorderColor}
          style={iconButtonStyle}>
          <MaterialCommunityIcons
            name="select-all"
            size={24}
            color={allSelected ? colors.primary : colors.onSurface}
          />
        </TVFocusable>
      </View>

      {busy ? (
        <View style={{alignItems: 'center', flexDirection: 'row', gap: 10}}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={{color: colors.onSurfaceVariant, flex: 1}}>
            Getting links {progress.current}/{progress.total}
          </Text>
          <TVFocusable
            accessibilityRole="button"
            accessibilityLabel="Cancel getting links"
            onPress={onCancelCopy}
            borderRadius={18}
            focusScale={1.03}
            focusBorderColor={focusBorderColor}
            style={{
              backgroundColor: colors.secondaryContainer,
              borderRadius: 18,
              paddingHorizontal: 16,
              paddingVertical: 10,
            }}>
            <Text
              role="labelLargeEmphasized"
              style={{color: colors.onSecondaryContainer}}>
              Cancel
            </Text>
          </TVFocusable>
        </View>
      ) : (
        <TVFocusable
          accessibilityRole="button"
          accessibilityLabel="Copy links"
          accessibilityState={{disabled: !canCopy}}
          onPress={onCopyLinks}
          disabled={!canCopy}
          borderRadius={18}
          focusScale={1.02}
          focusBorderColor={focusBorderColor}
          style={{
            alignItems: 'center',
            backgroundColor: colors.primaryContainer,
            borderRadius: 18,
            flexDirection: 'row',
            gap: 8,
            height: 44,
            justifyContent: 'center',
            opacity: canCopy ? 1 : 0.5,
          }}>
          <MaterialCommunityIcons
            name="content-copy"
            size={20}
            color={colors.onPrimaryContainer}
          />
          <Text
            role="labelLargeEmphasized"
            style={{color: colors.onPrimaryContainer}}>
            Copy links
          </Text>
        </TVFocusable>
      )}
    </View>
  );
};

/** Check mark shown in place of the download button while selecting. */
export const EpisodeSelectCheck = ({
  selected,
  color,
}: {
  selected: boolean;
  color: string;
}) => (
  <View
    style={{
      alignItems: 'center',
      height: 48,
      justifyContent: 'center',
      width: 48,
    }}>
    <MaterialCommunityIcons
      name={
        selected ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'
      }
      size={26}
      color={selected ? color : '#D4CBC9'}
    />
  </View>
);

export default EpisodeSelectionBar;
