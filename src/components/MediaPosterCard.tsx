import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React from 'react';
import { Image, Pressable, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { useM3Colors } from '../theme/M3PaletteContext';
import useThemeStore from '../lib/zustand/themeStore';
import { useIsFocused } from '@react-navigation/native';
import AppText from './ui/Text';
import { isTV } from '../lib/tv/constants';
import { useTVFocusBorderColor } from '../lib/tv/useTVFocusBorderColor';
import { useTVRemote } from '../lib/tv/useTVRemote';

export const parseAspectRatio = (
  ratio?: number | string,
  fallback: number = 2 / 3,
): number => {
  if (typeof ratio === 'number' && Number.isFinite(ratio) && ratio > 0) {
    return ratio;
  }
  if (typeof ratio === 'string') {
    const trimmed = ratio.trim();
    if (trimmed.includes(':')) {
      const [w, h] = trimmed.split(':').map(Number);
      if (w > 0 && h > 0) return w / h;
    }
    if (trimmed.includes('/')) {
      const [w, h] = trimmed.split('/').map(Number);
      if (w > 0 && h > 0) return w / h;
    }
    const parsed = Number(trimmed);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return fallback;
};

export const getResponsiveCardWidth = (
  _windowWidth?: number,
  aspectRatio?: number | string,
): number => {
  const ratio = parseAspectRatio(aspectRatio, 2 / 3);
  if (ratio > 1.2) return 220;
  if (ratio > 0.85) return 150;
  return 124;
};

interface MediaPosterCardProps {
  title: string;
  poster?: string;
  width: number;
  subtitle?: string;
  badge?: number | string;
  aspectRatio?: number | string;
  borderRadius?: number;
  tag?: string;
  cornerTag?: string;
  selected?: boolean;
  selectionMode?: boolean;
  hasTVPreferredFocus?: boolean;
  nextFocusUp?: number | null;
  nextFocusDown?: number | null;
  nextFocusLeft?: number | null;
  nextFocusRight?: number | null;
  onPress: () => void;
  onLongPress?: () => void;
  onFocus?: () => void;
  onLayout?: (event: any) => void;
}

const MediaPosterCard = React.forwardRef<View, MediaPosterCardProps>(
  (
    {
      title,
      poster,
      width,
      subtitle,
      badge,
      aspectRatio,
      borderRadius,
      tag,
      cornerTag,
      selected = false,
      selectionMode = false,
      hasTVPreferredFocus = false,
      nextFocusUp,
      nextFocusDown,
      nextFocusLeft,
      nextFocusRight,
      onPress,
      onLongPress,
      onFocus,
      onLayout,
    },
    ref,
  ) => {
    const colors = useM3Colors();
    const themePrimary = useThemeStore(state => state.primary);

    let isNavFocused = true;
    try {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      isNavFocused = useIsFocused();
    } catch {
      isNavFocused = true;
    }

    const isCurrentlyFocusable = isNavFocused;
    const [isFocused, setIsFocused] = React.useState(false);
    const activeAspectRatio = parseAspectRatio(aspectRatio, 2 / 3);
    const activeBorderRadius =
      typeof borderRadius === 'number' && borderRadius >= 0 ? borderRadius : 18;
    const activeTag = cornerTag || tag;
    const focusBorderColor = useTVFocusBorderColor();

    React.useEffect(() => {
      if (!isNavFocused && isFocused) {
        setIsFocused(false);
      }
    }, [isNavFocused, isFocused]);

    const lastPressTime = React.useRef<number>(0);
    const handlePress = React.useCallback(() => {
      if (!isCurrentlyFocusable) return;
      const now = Date.now();
      if (now - lastPressTime.current < 300) return;
      lastPressTime.current = now;
      onPress();
    }, [isCurrentlyFocusable, onPress]);

    useTVRemote(
      evt => {
        if (!isFocused || !isCurrentlyFocusable) return;
        if (
          (evt.eventType === 'longSelect' || evt.eventType === 'menu') &&
          onLongPress &&
          (evt.eventKeyAction === undefined || evt.eventKeyAction === 1)
        ) {
          onLongPress();
        }
      },
      isTV && isFocused && isCurrentlyFocusable,
    );

    return (
      <Animated.View
        entering={FadeInDown.duration(280)}
        style={{
          width,
          paddingVertical: 6,
          overflow: 'visible',
          zIndex: isFocused ? 999 : 1,
        }}>
        <Pressable
          ref={ref as any}
          onLayout={onLayout}
          focusable={isCurrentlyFocusable}
          isTVSelectable={isCurrentlyFocusable}
          hasTVPreferredFocus={hasTVPreferredFocus && isCurrentlyFocusable}
          nextFocusUp={nextFocusUp ?? undefined}
          nextFocusDown={nextFocusDown ?? undefined}
          nextFocusLeft={nextFocusLeft ?? undefined}
          nextFocusRight={nextFocusRight ?? undefined}
          onFocus={() => {
            if (isCurrentlyFocusable) {
              setIsFocused(true);
              onFocus?.();
            }
          }}
          onBlur={() => setIsFocused(false)}
          onPress={isCurrentlyFocusable ? handlePress : undefined}
          onLongPress={isCurrentlyFocusable ? onLongPress : undefined}
          delayLongPress={350}
        style={({ pressed, focused }: any) => {
          const activeFocused = isTV ? isFocused : focused || isFocused;
          return {
            opacity: pressed ? 0.86 : 1,
            transform: [
              {
                scale: pressed
                  ? 0.96
                  : activeFocused
                    ? isTV
                      ? 1.05
                      : 1.04
                    : 1,
              },
            ],
            borderRadius: activeBorderRadius + 4,
            backgroundColor: selected ? colors.primaryContainer : 'transparent',
            padding: selected ? 4 : 0,
            zIndex: activeFocused ? 999 : 1,
          };
        }}>
        {({ focused }: any) => {
          const activeFocused = isTV ? isFocused : focused || isFocused;
          return (
            <>
              <View
                style={{
                  backgroundColor: colors.surfaceContainerHigh,
                  borderRadius: activeBorderRadius,
                  overflow: 'hidden',
                  width: selected ? width - 8 : width,
                  position: 'relative',
                  borderWidth: activeFocused ? 2.5 : selected ? 2 : 0,
                  borderColor: activeFocused
                    ? focusBorderColor
                    : selected
                      ? colors.primary
                      : 'transparent',
                }}>
                {badge != null ? (
                  <View
                    style={{
                      position: 'absolute',
                      top: 6,
                      left: 6,
                      backgroundColor: colors.primaryContainer,
                      borderRadius: Math.min(8, activeBorderRadius),
                      paddingHorizontal: 7,
                      paddingVertical: 2,
                      zIndex: 5,
                      borderWidth: 1,
                      borderColor: colors.outlineVariant,
                    }}>
                    <AppText
                      role="labelSmallEmphasized"
                      style={{
                        color: colors.onPrimaryContainer,
                        fontWeight: '800',
                        fontSize: 11,
                      }}>
                      {badge}
                    </AppText>
                  </View>
                ) : activeTag != null && activeTag.trim().length > 0 ? (
                  <View
                    style={{
                      position: 'absolute',
                      top: 6,
                      right: 6,
                      borderRadius: Math.min(8, activeBorderRadius),
                      overflow: 'hidden',
                      zIndex: 5,
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.35,
                      shadowRadius: 4,
                      elevation: 4,
                    }}>
                    <BlurView
                      intensity={45}
                      tint="systemMaterialDark"
                      style={{
                        backgroundColor: 'rgba(255, 255, 255, 0.20)',
                        paddingHorizontal: 7,
                        paddingVertical: 2.5,
                      }}>
                      <AppText
                        role="labelSmallEmphasized"
                        style={{
                          color: '#FFFFFF',
                          fontWeight: '800',
                          fontSize: 10,
                          letterSpacing: 0.6,
                          textShadowColor: 'rgba(0, 0, 0, 0.85)',
                          textShadowOffset: { width: 0, height: 1 },
                          textShadowRadius: 3,
                        }}>
                        {activeTag.trim().toUpperCase()}
                      </AppText>
                    </BlurView>
                  </View>
                ) : null}

                {selectionMode ? (
                  <View
                    style={{
                      position: 'absolute',
                      top: 6,
                      right: 6,
                      backgroundColor: selected ? colors.primary : 'rgba(0,0,0,0.55)',
                      borderRadius: 12,
                      width: 22,
                      height: 22,
                      alignItems: 'center',
                      justifyContent: 'center',
                      zIndex: 5,
                      borderWidth: 1,
                      borderColor: selected ? colors.primary : 'rgba(255,255,255,0.6)',
                    }}>
                    {selected ? (
                      <MaterialCommunityIcons
                        name="check"
                        size={14}
                        color={colors.onPrimary}
                      />
                    ) : null}
                  </View>
                ) : null}

                {poster ? (
                  <Image
                    source={{ uri: poster }}
                    resizeMode="cover"
                    style={{
                      aspectRatio: activeAspectRatio,
                      width: selected ? width - 8 : width,
                    }}
                  />
                ) : (
                  <View
                    style={{
                      alignItems: 'center',
                      aspectRatio: activeAspectRatio,
                      backgroundColor: colors.surfaceContainerHighest,
                      justifyContent: 'center',
                      width: selected ? width - 8 : width,
                    }}>
                    <AppText
                      role="headlineMediumEmphasized"
                      style={{ color: colors.onSurfaceVariant }}>
                      {title.slice(0, 1).toUpperCase()}
                    </AppText>
                  </View>
                )}
              </View>
              <AppText
                role="labelMediumEmphasized"
                ellipsizeMode="tail"
                numberOfLines={1}
                style={{
                  color: selected ? colors.onPrimaryContainer : colors.onSurface,
                  marginTop: selected ? 4 : 7,
                }}>
                {title}
              </AppText>
              {subtitle ? (
                <AppText
                  role="labelSmall"
                  ellipsizeMode="tail"
                  numberOfLines={1}
                  style={{
                    color: selected
                      ? colors.onPrimaryContainer
                      : colors.onSurfaceVariant,
                    marginTop: 1,
                  }}>
                  {subtitle}
                </AppText>
              ) : null}
            </>
          );
        }}
      </Pressable>
    </Animated.View>
  );
});

export default MediaPosterCard;

