import React from 'react';
import { View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import AppText from '../../../../components/ui/Text';
import { TVFocusable } from '../../../../components/tv';
import { isTV } from '../../../../lib/tv/constants';
import type { MaterialColors } from '../../../../theme/colors';
import type { StoryPage } from './storyUtils';

interface StoryControlsProps {
  pages: StoryPage[];
  pageIndex: number;
  colors: MaterialColors;
  insetsTop: number;
  insetsBottom: number;
  onClose: () => void;
  goToPage: (index: number) => void;
}

export const StoryControls: React.FC<StoryControlsProps> = ({
  pages,
  pageIndex,
  colors,
  insetsTop,
  insetsBottom,
  onClose,
  goToPage,
}) => {
  return (
    <>
      {/* Story Progress Indicators */}
      <View
        style={{
          flexDirection: 'row',
          gap: 7,
          left: 20,
          position: 'absolute',
          right: 74,
          top: insetsTop + 14,
        }}>
        {pages.map((page, index) => (
          <View
            key={page.key}
            style={{
              backgroundColor:
                index === pageIndex ? colors.primary : colors.outlineVariant,
              borderRadius: 2,
              flex: 1,
              height: 6,
              opacity: index < pageIndex ? 0.65 : 1,
            }}
          />
        ))}
      </View>

      {/* Close Button */}
      <TVFocusable
        accessibilityRole="button"
        accessibilityLabel="Close story"
        hasTVPreferredFocus={isTV}
        borderRadius={24}
        focusScale={1.1}
        onPress={onClose}
        style={{
          alignItems: 'center',
          height: 48,
          justifyContent: 'center',
          position: 'absolute',
          right: 10,
          top: insetsTop - 1,
          width: 48,
          zIndex: 100,
        }}>
        <MaterialCommunityIcons
          name="close"
          size={34}
          color={colors.onBackground}
        />
      </TVFocusable>

      {/* TV On-Screen Navigation Controls */}
      {isTV && pageIndex > 0 && (
        <TVFocusable
          accessibilityRole="button"
          accessibilityLabel="Previous story page"
          borderRadius={24}
          focusScale={1.15}
          onPress={() => goToPage(pageIndex - 1)}
          style={{
            position: 'absolute',
            left: 16,
            top: '50%',
            marginTop: -24,
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: 'rgba(23, 23, 23, 0.85)',
            borderWidth: 1,
            borderColor: colors.outlineVariant,
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 90,
          }}>
          <MaterialCommunityIcons
            name="chevron-left"
            size={32}
            color={colors.onSurface}
          />
        </TVFocusable>
      )}

      {isTV && pageIndex < pages.length - 1 && (
        <TVFocusable
          accessibilityRole="button"
          accessibilityLabel="Next story page"
          borderRadius={24}
          focusScale={1.15}
          onPress={() => goToPage(pageIndex + 1)}
          style={{
            position: 'absolute',
            right: 16,
            top: '50%',
            marginTop: -24,
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: 'rgba(23, 23, 23, 0.85)',
            borderWidth: 1,
            borderColor: colors.outlineVariant,
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 90,
          }}>
          <MaterialCommunityIcons
            name="chevron-right"
            size={32}
            color={colors.onSurface}
          />
        </TVFocusable>
      )}

      {/* TV Navigation Hint */}
      {isTV && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            bottom: insetsBottom + 12,
            alignSelf: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            borderRadius: 16,
            paddingHorizontal: 16,
            paddingVertical: 6,
            borderWidth: 1,
            borderColor: 'rgba(255, 255, 255, 0.1)',
          }}>
          <AppText role="labelSmall" style={{ color: colors.onSurfaceVariant }}>
            ◀ / ▶ Story Page • ▲ / ▼ Scroll • Back Close
          </AppText>
        </View>
      )}
    </>
  );
};

export default StoryControls;
