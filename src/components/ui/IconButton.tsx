import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React, {useState, useRef, useEffect} from 'react';
import {ColorValue, Pressable, View, findNodeHandle} from 'react-native';
import {useM3Colors} from '../../theme/M3PaletteContext';
import {isTV, useTVRemote} from '../../lib/tv';
import {useTVFocusBorderColor} from '../../lib/tv/useTVFocusBorderColor';

interface IconButtonProps {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string;
  selected?: boolean;
  filled?: boolean;
  size?: number;
  buttonSize?: number;
  buttonWidth?: number;
  containerColor?: ColorValue;
  contentColor?: ColorValue;
  disabled?: boolean | null;
  onPress?: () => void;
  testID?: string;
  nextFocusUp?: number | null;
  nextFocusDown?: number | null;
  nextFocusLeft?: number | null;
  nextFocusRight?: number | null;
  onNodeHandle?: (handle: number | null) => void;
}

const IconButton = ({
  icon,
  label,
  selected = false,
  filled = false,
  size = 22,
  buttonSize = 40,
  buttonWidth,
  containerColor,
  contentColor,
  disabled,
  onPress,
  testID,
  nextFocusUp,
  nextFocusDown,
  nextFocusLeft,
  nextFocusRight,
  onNodeHandle,
}: IconButtonProps) => {
  const colors = useM3Colors();
  const focusBorderColor = useTVFocusBorderColor();
  const [isFocused, setIsFocused] = useState(false);
  const buttonRef = useRef<View>(null);

  useEffect(() => {
    if (isTV && buttonRef.current && onNodeHandle) {
      const handle = findNodeHandle(buttonRef.current);
      onNodeHandle(handle);
    }
  }, [onNodeHandle]);
  const hasContainer = selected || filled;
  const resolvedContentColor =
    contentColor || (selected ? colors.onSecondaryContainer : colors.primary);
  const resolvedButtonWidth = buttonWidth || buttonSize;
  const touchWidth = Math.max(resolvedButtonWidth, 48);
  const touchHeight = Math.max(buttonSize, 48);
  const lastPressTime = React.useRef<number>(0);
  const handlePress = React.useCallback(() => {
    if (disabled || !onPress) return;
    if (!isTV) {
      onPress();
      return;
    }
    const now = Date.now();
    if (now - lastPressTime.current < 300) return;
    lastPressTime.current = now;
    onPress();
  }, [disabled, onPress]);

  useTVRemote(
    evt => {
      if (
        isFocused &&
        onPress &&
        !disabled &&
        (evt.eventType === 'select' || evt.eventType === 'playPause') &&
        (evt.eventKeyAction === undefined || evt.eventKeyAction === 1)
      ) {
        handlePress();
      }
    },
    isTV && isFocused && Boolean(onPress),
  );

  return (
    <Pressable
      ref={buttonRef as any}
      testID={testID}
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{disabled: Boolean(disabled), selected}}
      // On TV keep a focused button focusable when it turns disabled, or focus
      // is lost. handlePress still ignores presses while disabled.
      disabled={Boolean(disabled) && !(isTV && isFocused)}
      focusable={isTV ? !disabled || isFocused : undefined}
      isTVSelectable={isTV ? !disabled || isFocused : undefined}
      nextFocusUp={isTV ? nextFocusUp ?? undefined : undefined}
      nextFocusDown={isTV ? nextFocusDown ?? undefined : undefined}
      nextFocusLeft={isTV ? nextFocusLeft ?? undefined : undefined}
      nextFocusRight={isTV ? nextFocusRight ?? undefined : undefined}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      hitSlop={8}
      onPress={handlePress}
      pressRetentionOffset={24}
      android_ripple={{
        borderless: !buttonWidth,
        color: colors.onSurfaceVariant,
        radius: Math.max(touchWidth, touchHeight) / 2,
      }}
      style={({pressed}) => ({
        alignItems: 'center',
        backgroundColor: hasContainer
          ? containerColor || colors.secondaryContainer
          : isTV && isFocused
            ? colors.surfaceContainerHighest
            : pressed
              ? colors.surfaceContainerHigh
              : 'transparent',
        borderColor: isTV && isFocused ? focusBorderColor : 'transparent',
        borderWidth: isTV && isFocused ? 2 : 0,
        borderRadius: buttonWidth ? buttonSize / 2.8 : touchHeight / 2,
        height: touchHeight,
        justifyContent: 'center',
        opacity: disabled ? 0.38 : pressed ? 0.8 : 1,
        ...(isTV ? {transform: [{scale: isFocused ? 1.15 : pressed ? 0.9 : 1}]} : {}),
        width: touchWidth,
      })}>
      <MaterialCommunityIcons
        name={icon}
        size={size}
        color={resolvedContentColor}
        pointerEvents="none"
      />
    </Pressable>
  );
};

export default IconButton;
