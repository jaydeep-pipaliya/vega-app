import React, {useRef, useCallback} from 'react';
import * as RN from 'react-native';
import {
  TouchableOpacity,
  Pressable,
  View,
  ViewStyle,
  StyleProp,
  StyleSheet,
  findNodeHandle,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import {
  isTV,
  TV_FOCUS_BORDER_WIDTH,
  TV_FOCUS_ANIMATION_DURATION,
} from '../../lib/tv/constants';

import {useTVFocusBorderColor} from '../../lib/tv/useTVFocusBorderColor';
import {
  useSafeIsNavFocused,
  useTVNavFocusMemory,
} from '../../lib/tv/useTVNavFocusMemory';

const TVFocusGuideView = (RN as any).TVFocusGuideView;
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface TVFocusableProps {
  children: React.ReactNode | ((state: {focused: boolean}) => React.ReactNode);
  onPress?: () => void;
  onLongPress?: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
  style?: StyleProp<ViewStyle>;
  focusedStyle?: ViewStyle;
  disabled?: boolean;
  hasTVPreferredFocus?: boolean;
  nextFocusUp?: number | null;
  nextFocusDown?: number | null;
  nextFocusLeft?: number | null;
  nextFocusRight?: number | null;
  focusScale?: number;
  focusBorderColor?: string;
  showFocusBorder?: boolean;
  borderRadius?: number;
  /** Save this element as the navigation rail's D-pad right target. */
  registerScreenFocus?: boolean;
  testID?: string;
  accessibilityLabel?: string;
  accessibilityRole?: RN.AccessibilityRole | string;
  accessibilityState?: RN.AccessibilityState;
  onLayout?: (event: RN.LayoutChangeEvent) => void;
}

export const TVFocusable = React.forwardRef<View, TVFocusableProps>((
  {
    children,
    onPress,
    onLongPress,
    onFocus,
    onBlur,
    onLayout,
    style,
    focusedStyle,
    disabled = false,
    hasTVPreferredFocus = false,
    nextFocusUp,
    nextFocusDown,
    nextFocusLeft,
    nextFocusRight,
    focusBorderColor,
    showFocusBorder = true,
    borderRadius = 8,
    registerScreenFocus = true,
    testID,
    accessibilityLabel,
    accessibilityRole,
    accessibilityState,
  },
  forwardedRef,
) => {
  const effectiveFocusBorderColor = useTVFocusBorderColor(focusBorderColor);

  const isNavFocused = useSafeIsNavFocused();
  const isCurrentlyFocusable = !disabled && isNavFocused;

  const buttonRef = useRef<View>(null);
  React.useImperativeHandle(forwardedRef, () => buttonRef.current as View);
  const {
    preferredFocus,
    onFocus: rememberFocus,
    onBlur: forgetFocus,
  } = useTVNavFocusMemory({
    ref: buttonRef,
    isNavFocused,
    hasTVPreferredFocus,
    registerScreenFocus,
  });

  const [isFocused, setIsFocused] = React.useState(false);
  // A view that turns disabled while focused (loading, busy, deleting) drops
  // TV focus and nothing takes it. Keep it focusable until focus moves away;
  // presses stay blocked.
  const nativeFocusable =
    isCurrentlyFocusable || (isTV && isNavFocused && disabled && isFocused);
  const lastPressTime = useRef<number>(0);
  const scale = useSharedValue(1);
  const borderOpacity = useSharedValue(0);

  React.useEffect(() => {
    if (!isNavFocused && isFocused) {
      setIsFocused(false);
      scale.set(withTiming(1, {duration: 150}));
      borderOpacity.set(withTiming(0, {duration: 150}));
    }
  }, [isNavFocused, isFocused, scale, borderOpacity]);

  const handlePress = useCallback(() => {
    if (!isCurrentlyFocusable) return;
    if (isTV) {
      const now = Date.now();
      if (now - lastPressTime.current < 400) return;
      lastPressTime.current = now;
    }
    onPress?.();
  }, [isCurrentlyFocusable, onPress]);

  const handleFocus = useCallback(() => {
    if (!isCurrentlyFocusable) return;
    setIsFocused(true);
    rememberFocus();
    // Keep the TV focus ring within the control's layout bounds.
    scale.set(withTiming(1, {
      duration: TV_FOCUS_ANIMATION_DURATION,
      easing: Easing.out(Easing.ease),
    }));
    borderOpacity.set(withTiming(1, {
      duration: TV_FOCUS_ANIMATION_DURATION,
    }));
    onFocus?.();
  }, [onFocus, scale, borderOpacity, isCurrentlyFocusable, rememberFocus]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    forgetFocus();
    scale.set(withTiming(1, {
      duration: TV_FOCUS_ANIMATION_DURATION,
      easing: Easing.out(Easing.ease),
    }));
    borderOpacity.set(0);
    onBlur?.();
  }, [onBlur, scale, borderOpacity, forgetFocus]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{scale: scale.get()}],
  }));

  const borderAnimatedStyle = useAnimatedStyle(() => ({
    opacity: showFocusBorder && isFocused ? borderOpacity.get() : 0,
  }));

  if (!isTV) {
    const renderedChildren =
      typeof children === 'function' ? children({focused: false}) : children;

    return (
      <TouchableOpacity
        ref={forwardedRef as any}
        onLayout={onLayout}
        onPress={handlePress}
        onLongPress={onLongPress}
        disabled={disabled}
        style={style}
        activeOpacity={0.7}
        testID={testID}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole={accessibilityRole as any}
        accessibilityState={accessibilityState}>
        {renderedChildren}
      </TouchableOpacity>
    );
  }

  const renderedChildren =
    typeof children === 'function' ? children({focused: isFocused}) : children;

  return (
    <AnimatedPressable
      ref={buttonRef as any}
      onLayout={onLayout}
      onPress={isCurrentlyFocusable ? handlePress : undefined}
      onLongPress={isCurrentlyFocusable ? onLongPress : undefined}
      onFocus={handleFocus}
      onBlur={handleBlur}
      disabled={!nativeFocusable}
      hasTVPreferredFocus={preferredFocus && !disabled}
      nextFocusUp={nextFocusUp ?? undefined}
      nextFocusDown={nextFocusDown ?? undefined}
      nextFocusLeft={nextFocusLeft ?? undefined}
      nextFocusRight={nextFocusRight ?? undefined}
      focusable={nativeFocusable}
      isTVSelectable={nativeFocusable}
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole as any}
      accessibilityState={accessibilityState}
      style={[
        style,
        animatedStyle,
        isFocused && focusedStyle,
        isFocused ? {zIndex: 999} : undefined,
      ]}>
      {renderedChildren}
      {showFocusBorder && isFocused && (
        <Animated.View
          style={[
            styles.focusBorder,
            {
              borderColor: effectiveFocusBorderColor,
              borderRadius: borderRadius,
            },
            borderAnimatedStyle,
          ]}
          pointerEvents="none"
        />
      )}
    </AnimatedPressable>
  );
});

export interface TVFocusGuideProps {
  children: React.ReactNode;
  destinations?: React.RefObject<any>[];
  autoFocus?: boolean;
  trapFocusLeft?: boolean;
  trapFocusRight?: boolean;
  trapFocusUp?: boolean;
  trapFocusDown?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const TVFocusGuide: React.FC<TVFocusGuideProps> = ({
  children,
  destinations,
  autoFocus = false,
  trapFocusLeft = false,
  trapFocusRight = false,
  trapFocusUp = false,
  trapFocusDown = false,
  style,
}) => {
  if (!isTV || !TVFocusGuideView) {
    return <View style={style}>{children}</View>;
  }

  const destinationHandles =
    destinations && destinations.length > 0
      ? (destinations
          .map(ref => (ref.current ? findNodeHandle(ref.current) : null))
          .filter(Boolean) as any)
      : undefined;

  return (
    <TVFocusGuideView
      style={style}
      destinations={destinationHandles}
      autoFocus={autoFocus}
      trapFocusLeft={trapFocusLeft}
      trapFocusRight={trapFocusRight}
      trapFocusUp={trapFocusUp}
      trapFocusDown={trapFocusDown}>
      {children}
    </TVFocusGuideView>
  );
};

const styles = StyleSheet.create({
  focusBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: TV_FOCUS_BORDER_WIDTH,
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
});

export default TVFocusable;
