import {
  Button as NativeButton,
  FilledTonalButton,
  Host,
  OutlinedButton,
  Text,
  TextButton,
} from '@expo/ui/jetpack-compose';
import {defaultMinSize} from '@expo/ui/jetpack-compose/modifiers';
import React, {ReactNode} from 'react';
import {ColorValue, Pressable, StyleSheet, Text as RNText, View, ViewStyle} from 'react-native';
import {useM3Colors, useM3HostTheme} from '../../theme/M3PaletteContext';
import {isTV} from '../../lib/tv';
import {TVFocusable} from '../tv/TVFocusable';
import {useTVFocusBorderColor} from '../../lib/tv/useTVFocusBorderColor';

type ButtonVariant =
  | 'filled'
  | 'tonal'
  | 'outlined'
  | 'text'
  | 'destructive'
  | 'white';

interface ButtonProps {
  children: ReactNode;
  variant?: ButtonVariant;
  compact?: boolean;
  disabled?: boolean | null;
  onPress?: () => void;
  style?: ViewStyle;
  testID?: string;
  containerColor?: ColorValue;
  contentColor?: ColorValue;
  hasTVPreferredFocus?: boolean;
  nextFocusUp?: number | null;
  nextFocusDown?: number | null;
  nextFocusLeft?: number | null;
  nextFocusRight?: number | null;
  onLayout?: (event: any) => void;
}

const Button = React.forwardRef<View, ButtonProps>(({
  children,
  variant = 'filled',
  compact = false,
  disabled,
  onPress,
  style,
  testID,
  containerColor,
  contentColor,
  hasTVPreferredFocus,
  nextFocusUp,
  nextFocusDown,
  nextFocusLeft,
  nextFocusRight,
  onLayout,
}: ButtonProps, ref) => {
  const colors = useM3Colors();
  const hostTheme = useM3HostTheme();
  const tvFocusBorderColor = useTVFocusBorderColor();
  // Declared before the TV early return so hook order never depends on a
  // branch (React Compiler skips components that call hooks conditionally).
  const [tvFocused, setTvFocused] = React.useState(false);
  const ButtonComponent =
    variant === 'tonal'
      ? FilledTonalButton
      : variant === 'outlined'
        ? OutlinedButton
        : variant === 'text'
          ? TextButton
          : NativeButton;
  const variantColors =
    variant === 'destructive'
      ? {containerColor: colors.error, contentColor: colors.onError}
      : variant === 'white'
        ? {containerColor: '#FFFFFF', contentColor: '#211F1E'}
        : variant === 'filled'
          ? {containerColor: colors.primary, contentColor: colors.onPrimary}
          : variant === 'tonal'
            ? {
                containerColor: colors.secondaryContainer,
                contentColor: colors.onSecondaryContainer,
              }
            : {contentColor: colors.primary};
  const buttonColors = {
    ...variantColors,
    ...(containerColor ? {containerColor} : {}),
    ...(contentColor ? {contentColor} : {}),
  };

  if (isTV) {
    return (
      <TVFocusable
        ref={ref}
        onLayout={onLayout}
        hasTVPreferredFocus={hasTVPreferredFocus}
        nextFocusUp={nextFocusUp}
        nextFocusDown={nextFocusDown}
        nextFocusLeft={nextFocusLeft}
        nextFocusRight={nextFocusRight}
        onPress={onPress}
        disabled={Boolean(disabled)}
        borderRadius={compact ? 20 : 24}
        focusScale={1.05}
        testID={testID}
        accessibilityRole="button"
        style={[
          {
            alignSelf: 'flex-start',
            borderRadius: compact ? 20 : 24,
            backgroundColor: buttonColors.containerColor ?? 'transparent',
            paddingHorizontal: compact ? 16 : 24,
            paddingVertical: compact ? 8 : 12,
            minWidth: compact ? 64 : 80,
            minHeight: compact ? 40 : 48,
            justifyContent: 'center',
            alignItems: 'center',
            borderWidth: variant === 'outlined' ? 1.5 : 0,
            borderColor: variant === 'outlined' ? String(buttonColors.contentColor) : 'transparent',
            opacity: disabled ? 0.4 : 1,
          },
          style,
        ]}>
        {typeof children === 'string' ? (
          <RNText
            style={{
              color: String(buttonColors.contentColor),
              fontSize: compact ? 13 : 15,
              fontWeight: '700',
            }}>
            {children}
          </RNText>
        ) : (
          children
        )}
      </TVFocusable>
    );
  }


  return (
    <View
      style={[
        {
          alignSelf: 'flex-start',
          borderRadius: 999,
          overflow: 'hidden',
          position: 'relative',
          borderWidth: tvFocused ? 2.5 : 0,
          borderColor: tvFocused ? tvFocusBorderColor : 'transparent',
          transform: [{scale: tvFocused ? 1.06 : 1}],
        },
        style,
      ]}>
      <Host
        matchContents
        {...hostTheme}
        pointerEvents="none">
        <ButtonComponent
          enabled={!disabled}
          colors={buttonColors}
          contentPadding={
            compact
              ? {start: 16, top: 8, end: 16, bottom: 8}
              : {start: 24, top: 12, end: 24, bottom: 12}
          }
          modifiers={[
            defaultMinSize({
              minWidth: compact ? 64 : 80,
              minHeight: compact ? 40 : 48,
            }),
          ]}>
          <Text
            color={String(buttonColors.contentColor)}
            style={{typography: 'labelLarge', fontWeight: '700'}}>
            {children}
          </Text>
        </ButtonComponent>
      </Host>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{disabled: Boolean(disabled)}}
        android_ripple={{color: String(colors.onSurfaceVariant)}}
        disabled={Boolean(disabled)}
        focusable={!disabled}
        isTVSelectable={!disabled}
        onFocus={() => setTvFocused(true)}
        onBlur={() => setTvFocused(false)}
        hitSlop={6}
        onPress={onPress}
        testID={testID}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
});

export default Button;
