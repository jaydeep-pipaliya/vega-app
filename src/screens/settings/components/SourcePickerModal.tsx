import {MaterialCommunityIcons} from '@expo/vector-icons';
import React from 'react';
import {ScrollView, View} from 'react-native';
import Text from '../../../components/ui/Text';
import {TVFocusable, TVFocusGuide} from '../../../components/tv';
import MaterialDialogSurface from '../../../components/ui/MaterialDialogSurface';
import type {ProviderSource} from '../../../lib/storage/extensionStorage';
import {sourceTokenStorage} from '../../../lib/storage/sourceTokenStorage';
import {useM3Colors} from '../../../theme/M3PaletteContext';

interface SourcePickerModalProps {
  visible: boolean;
  sources: ProviderSource[];
  defaultSource?: ProviderSource;
  onDismiss: () => void;
  onSelectSource: (source: ProviderSource) => void;
  onRequestRemoveSource: (author: string) => void;
}

export const SourcePickerModal: React.FC<SourcePickerModalProps> = ({
  visible,
  sources,
  defaultSource,
  onDismiss,
  onSelectSource,
  onRequestRemoveSource,
}) => {
  const colors = useM3Colors();

  return (
    <MaterialDialogSurface
      visible={visible}
      onDismiss={onDismiss}
      style={{maxHeight: 560}}>
      <TVFocusGuide autoFocus={true} trapFocusRight={true}>
        <View className="mb-3 flex-row items-center justify-between">
          <View>
            <Text
              className="text-lg font-semibold"
              style={{color: colors.onSurface}}>
              Provider source
            </Text>
            <Text
              className="mt-1 text-xs"
              style={{color: colors.onSurfaceVariant}}>
              Select or remove a source
            </Text>
          </View>
          <TVFocusable
            accessibilityLabel="Close source picker"
            onPress={onDismiss}
            borderRadius={14}
            focusScale={1.1}
            style={{
              height: 40,
              width: 40,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.surfaceContainerHighest,
              borderRadius: 14,
            }}>
            <MaterialCommunityIcons
              name="close"
              size={24}
              color={colors.onSurfaceVariant}
            />
          </TVFocusable>
        </View>

        <ScrollView focusable={false} accessible={false} nestedScrollEnabled>
        {sources.map(source => {
          const isSelected = source.author === defaultSource?.author;
          return (
            <View
              key={source.author}
              className="mb-2 flex-row items-center border px-3 py-3"
              style={{
                backgroundColor: colors.surfaceContainerHighest,
                borderColor: isSelected
                  ? colors.primary
                  : colors.outlineVariant,
                borderRadius: 16,
                borderWidth: isSelected ? 2 : 1,
              }}>
              <TVFocusable
                hasTVPreferredFocus={isSelected}
                accessibilityRole="button"
                accessibilityLabel={`Use ${source.author} source`}
                onPress={() => onSelectSource(source)}
                borderRadius={12}
                focusScale={1.02}
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingRight: 8,
                  padding: 4,
                }}>
                <View className="flex-1">
                  <View className="flex-row items-center gap-1">
                    <Text
                      className="font-semibold"
                      style={{color: colors.onSurface}}>
                      {source.author}
                    </Text>
                    {sourceTokenStorage.has(source.author) && (
                      <MaterialCommunityIcons
                        name="lock"
                        size={14}
                        color={colors.onSurfaceVariant}
                        accessibilityLabel="Private source"
                      />
                    )}
                  </View>
                  <Text
                    className="mt-1 text-xs"
                    style={{color: colors.onSurfaceVariant}}
                    numberOfLines={1}>
                    {source.url}
                  </Text>
                </View>
                {isSelected && (
                  <MaterialCommunityIcons
                    name="check-circle"
                    size={22}
                    color={colors.primary}
                  />
                )}
              </TVFocusable>
              <TVFocusable
                accessibilityLabel={`Remove ${source.author} source`}
                onPress={() => onRequestRemoveSource(source.author)}
                borderRadius={14}
                focusScale={1.1}
                style={{
                  height: 40,
                  width: 40,
                  marginLeft: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colors.errorContainer,
                  borderRadius: 14,
                }}>
                <MaterialCommunityIcons
                  name="trash-can-outline"
                  size={20}
                  color={colors.onErrorContainer}
                />
              </TVFocusable>
            </View>
          );
        })}
        </ScrollView>
      </TVFocusGuide>
    </MaterialDialogSurface>
  );
};
