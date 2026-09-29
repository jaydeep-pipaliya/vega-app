import React from 'react';
import { View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Host, LoadingIndicator } from '@expo/ui/jetpack-compose';
import { size as indicatorSize } from '@expo/ui/jetpack-compose/modifiers';
import AppText from '../../../../components/ui/Text';
import { TVFocusable } from '../../../../components/tv';
import type { MaterialColors } from '../../../../theme/colors';

interface StoryFallbackViewProps {
  isFetching: boolean;
  error: unknown;
  colors: MaterialColors;
  hostTheme: any;
  refetch: () => void;
}

export const StoryFallbackView: React.FC<StoryFallbackViewProps> = ({
  isFetching,
  error,
  colors,
  hostTheme,
  refetch,
}) => {
  return (
    <View
      style={{
        alignItems: 'center',
        flex: 1,
        justifyContent: 'center',
        padding: 28,
      }}>
      {isFetching ? (
        <Host matchContents {...hostTheme}>
          <LoadingIndicator
            color={colors.primary}
            modifiers={[indicatorSize(56, 56)]}
          />
        </Host>
      ) : (
        <>
          <MaterialCommunityIcons
            name="book-alert-outline"
            size={54}
            color={colors.error}
          />
          <AppText
            role="titleLargeEmphasized"
            style={{
              color: colors.onSurface,
              marginTop: 18,
              textAlign: 'center',
            }}>
            Story unavailable
          </AppText>
          <AppText
            role="bodyMedium"
            style={{
              color: colors.onSurfaceVariant,
              marginTop: 8,
              textAlign: 'center',
            }}>
            {error instanceof Error
              ? error.message
              : 'TMDB metadata could not be loaded.'}
          </AppText>
          <TVFocusable
            onPress={() => refetch()}
            borderRadius={24}
            style={{
              backgroundColor: colors.primary,
              borderRadius: 24,
              marginTop: 22,
              paddingHorizontal: 22,
              paddingVertical: 12,
            }}>
            <AppText
              role="labelLargeEmphasized"
              style={{ color: colors.onPrimary }}>
              Try again
            </AppText>
          </TVFocusable>
        </>
      )}
    </View>
  );
};

export default StoryFallbackView;
