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
  TV_FOCUS_SCALE,
  TV_FOCUS_BORDER_WIDTH,
  TV_FOCUS_ANIMATION_DURATION,
} from '../../lib/tv/constants';
import {useM3Colors} from '../../theme/M3PaletteContext';

import {useIsFocused} from '@react-navigation/native';
import {useTVFocusBorderColor} from '../../lib/tv/useTVFocusBorderColor';

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
    focusScale = TV_FOCUS_SCALE,
    focusBorderColor,
    showFocusBorder = true,
    borderRadius = 8,
    testID,
    accessibilityLabel,
    accessibilityRole,
    accessibilityState,
  },
  forwardedRef,
) => {
  const effectiveFocusBorderColor = useTVFocusBorderColor(focusBorderColor);

  let isNavFocused = true;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    isNavFocused = useIsFocused();
  } catch {
    isNavFocused = true;
  }

  const isCurrentlyFocusable = !disabled && isNavFocused;

  const buttonRef = useRef<View>(null);
  React.useImperativeHandle(forwardedRef, () => buttonRef.current as View);

  const [isFocused, setIsFocused] = React.useState(false);
  const lastPressTime = useRef<number>(0);
  const scale = useSharedValue(1);
  const borderOpacity = useSharedValue(0);

  React.useEffect(() => {
    if (!isNavFocused && isFocused) {
      setIsFocused(false);
      scale.value = withTiming(1, {duration: 150});
      borderOpacity.value = withTiming(0, {duration: 150});
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
    // Keep the TV focus ring within the control's layout bounds.
    scale.value = withTiming(1, {
      duration: TV_FOCUS_ANIMATION_DURATION,
      easing: Easing.out(Easing.ease),
    });
    borderOpacity.value = withTiming(1, {
      duration: TV_FOCUS_ANIMATION_DURATION,
    });
    onFocus?.();
  }, [focusScale, onFocus, scale, borderOpacity, isCurrentlyFocusable]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    scale.value = withTiming(1, {
      duration: TV_FOCUS_ANIMATION_DURATION,
      easing: Easing.out(Easing.ease),
    });
    borderOpacity.value = 0;
    onBlur?.();
  }, [onBlur, scale, borderOpacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{scale: scale.value}],
  }));

  const borderAnimatedStyle = useAnimatedStyle(() => ({
    opacity: showFocusBorder && isFocused ? borderOpacity.value : 0,
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
      disabled={!isCurrentlyFocusable}
      hasTVPreferredFocus={hasTVPreferredFocus && isCurrentlyFocusable}
      nextFocusUp={nextFocusUp ?? undefined}
      nextFocusDown={nextFocusDown ?? undefined}
      nextFocusLeft={nextFocusLeft ?? undefined}
      nextFocusRight={nextFocusRight ?? undefined}
      focusable={isCurrentlyFocusable}
      isTVSelectable={isCurrentlyFocusable}
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

export interface TVFocusableCardProps extends TVFocusableProps {
  width?: number;
  height?: number;
  borderRadius?: number;
}

export const TVFocusableCard: React.FC<TVFocusableCardProps> = ({
  children,
  width = 180,
  height = 270,
  borderRadius = 8,
  style,
  ...props
}) => {
  const cardStyle: ViewStyle = {
    width,
    height,
    borderRadius,
    overflow: 'hidden',
    ...(style as object),
  };

  return (
    <TVFocusable style={cardStyle} {...props}>
      {state => (
        <View style={{width, height, borderRadius, overflow: 'hidden'}}>
          {typeof children === 'function' ? children(state) : children}
        </View>
      )}
    </TVFocusable>
  );
};

export interface TVFocusableButtonProps extends TVFocusableProps {
  variant?: 'primary' | 'secondary' | 'outline';
}

export const TVFocusableButton: React.FC<TVFocusableButtonProps> = ({
  children,
  variant = 'primary',
  style,
  focusBorderColor,
  ...props
}) => {
  const colors = useM3Colors();
  const buttonStyles: Record<'primary' | 'secondary' | 'outline', ViewStyle> = {
    primary: {
      ...styles.primaryButton,
      backgroundColor: colors.primary,
    },
    secondary: styles.secondaryButton,
    outline: styles.outlineButton,
  };

  const combinedStyle: ViewStyle = {
    ...buttonStyles[variant],
    ...(style as object),
  };

  return (
    <TVFocusable
      style={combinedStyle}
      focusBorderColor={focusBorderColor}
      focusScale={1.05}
      {...props}>
      {children}
    </TVFocusable>
  );
};

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
  primaryButton: {
    backgroundColor: 'transparent',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButton: {
    backgroundColor: 'rgba(109, 109, 110, 0.7)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlineButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#ffffff',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default TVFocusable;
