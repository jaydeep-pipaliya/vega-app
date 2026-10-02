import type {VideoAnimations} from '../../types';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {Animated as NativeAnimated, Text, View} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
  cancelAnimation,
} from 'react-native-reanimated';
import Svg, {G, Path} from 'react-native-svg';
import {Control} from '../Control';

const VIEWBOX_WIDTH = 64;
const VIEWBOX_HEIGHT = 68;

// Centre of the circle the arc is drawn on, solved from the arc path below.
// The arrow head pushes the drawing above the ring, so the ring centre is not
// the centre of the viewBox and the label has to be offset to land inside it.
const ARC_CENTER_X = 31.5;
const ARC_CENTER_Y = 37.9;

const SeekArcIcon = ({
  size,
  color,
  isForward,
}: {
  size: number;
  color: string;
  isForward: boolean;
}) => (
  <Svg
    width={size}
    height={(size * VIEWBOX_HEIGHT) / VIEWBOX_WIDTH}
    viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
    fill="none"
    stroke={color}
    strokeWidth={3}
    strokeLinecap="round"
    strokeLinejoin="round">
    <G transform={isForward ? undefined : 'translate(64 0) scale(-1 1)'}>
      <Path d="M30.1 12.52A25.5 25.5 0 1 0 54 26.03" />
      <Path d="m25 5.5 8 7-8 7m8.5-15L40 12l-6.5 7.5" />
    </G>
  </Svg>
);

interface SeekButtonProps {
  direction: 'backward' | 'forward';
  seekSeconds: number;
  onPress: () => void;
  disabled?: boolean;
  resetControlTimeout?: () => void;
  size?: number;
  /**
   * Accumulated seek time coming from the double-tap gesture. Drives the
   * label (+10 → +20 → +30) and replays the spring on every change.
   */
  skipTime?: number;
  /**
   * Controls are hidden most of the time; the button still fades in on its own
   * while a gesture seek is being accumulated.
   */
  visible?: boolean;
  controlOpacityStyle?: VideoAnimations['controlsOpacity'];
}

export const SeekButton = ({
  direction,
  seekSeconds,
  onPress,
  disabled,
  resetControlTimeout,
  size = 54,
  skipTime = 0,
  visible = true,
  controlOpacityStyle,
}: SeekButtonProps) => {
  const isForward = direction === 'forward';
  const prevSkipRef = useRef(0);
  // The accumulated value is kept on screen while the number springs home, so
  // it does not snap back to the plain "10" mid-flight.
  const [displaySkip, setDisplaySkip] = useState(0);
  const settleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Tapping the button directly accumulates the same way the double-tap
  // gesture does, so repeated presses read +10 → +20 → +30 instead of getting
  // stuck on the base value.
  const [pressSkip, setPressSkip] = useState(0);
  const pressSkipRef = useRef(0);
  const pressResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Gesture feedback wins when present; otherwise the local press count drives
  // the label and the animation.
  const activeSkip = skipTime > 0 ? skipTime : pressSkip;

  const rotation = useSharedValue(0);
  const iconScale = useSharedValue(1);
  const labelScale = useSharedValue(1);
  const labelTravel = useSharedValue(0);
  const opacity = useSharedValue(visible ? 1 : 0);

  // How far the number rides out past the arc while the count is building.
  const travelDistance = size * 0.85 * (isForward ? 1 : -1);
  const RETURN_DURATION = 340;

  // Eases in gently and eases out into place, so the number glides home
  // instead of snapping fast and bouncing at the end.
  const returnHome = useCallback(() => {
    cancelAnimation(labelTravel);
    labelTravel.value = withTiming(0, {
      duration: RETURN_DURATION,
      easing: Easing.inOut(Easing.cubic),
    });
  }, [labelTravel]);

  // Plays on every change of the accumulated value, from either a button press
  // or the double-tap gesture. The number is left parked outside; `returnHome`
  // brings it back once the count stops climbing.
  const kick = useCallback(
    () => {
      cancelAnimation(rotation);
      cancelAnimation(iconScale);
      cancelAnimation(labelScale);
      cancelAnimation(labelTravel);

      rotation.value = withSequence(
        withTiming(isForward ? 32 : -32, {
          duration: 110,
          easing: Easing.out(Easing.quad),
        }),
        withSpring(0, {damping: 12, stiffness: 200}),
      );
      iconScale.value = withSequence(
        withTiming(0.9, {duration: 70}),
        withSpring(1, {damping: 10, stiffness: 260}),
      );
      labelScale.value = withSequence(
        withTiming(1.24, {duration: 90}),
        withSpring(1, {damping: 11, stiffness: 220}),
      );

      labelTravel.value = withTiming(travelDistance, {
        duration: 150,
        easing: Easing.out(Easing.cubic),
      });
    },
    [
      iconScale,
      isForward,
      labelScale,
      labelTravel,
      rotation,
      travelDistance,
    ],
  );

  useEffect(() => {
    if (settleTimeoutRef.current) {
      clearTimeout(settleTimeoutRef.current);
      settleTimeoutRef.current = null;
    }

    if (activeSkip > 0) {
      setDisplaySkip(activeSkip);
      if (activeSkip !== prevSkipRef.current) {
        kick();
      }
    } else if (prevSkipRef.current > 0) {
      returnHome();
      settleTimeoutRef.current = setTimeout(
        () => setDisplaySkip(0),
        RETURN_DURATION,
      );
    }
    prevSkipRef.current = activeSkip;
  }, [activeSkip, kick, returnHome]);

  useEffect(
    () => () => {
      if (settleTimeoutRef.current) {
        clearTimeout(settleTimeoutRef.current);
      }
      if (pressResetRef.current) {
        clearTimeout(pressResetRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, {duration: 110});
      return;
    }

    // Only wait when a number is still gliding back into the arc. Otherwise
    // fade out immediately so the buttons leave with the rest of the controls
    // instead of lingering behind them.
    const hide = withTiming(0, {duration: 240});
    opacity.value =
      displaySkip > 0 ? withDelay(RETURN_DURATION, hide) : hide;
  }, [displaySkip, opacity, visible]);

  const handlePress = useCallback(() => {
    // Each press seeks immediately; the label just reports the running total
    // for this burst of presses and clears once they stop.
    pressSkipRef.current += seekSeconds;
    setPressSkip(pressSkipRef.current);

    if (pressResetRef.current) {
      clearTimeout(pressResetRef.current);
    }
    pressResetRef.current = setTimeout(() => {
      pressSkipRef.current = 0;
      setPressSkip(0);
      pressResetRef.current = null;
    }, 700);

    onPress();
    resetControlTimeout?.();
  }, [onPress, resetControlTimeout, seekSeconds]);

  const height = (size * VIEWBOX_HEIGHT) / VIEWBOX_WIDTH;
  // The rewind icon is the same path mirrored, so its ring centre mirrors too.
  const centerX = isForward ? ARC_CENTER_X : VIEWBOX_WIDTH - ARC_CENTER_X;
  const labelOffsetX = size * (centerX / VIEWBOX_WIDTH - 0.5);
  const labelOffsetY = height * (ARC_CENTER_Y / VIEWBOX_HEIGHT - 0.5);

  const wrapperAnimatedStyle = useAnimatedStyle(
    () => ({opacity: opacity.value}),
    [],
  );

  const iconAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{rotate: `${rotation.value}deg`}, {scale: iconScale.value}],
  }));

  const labelAnimatedStyle = useAnimatedStyle(
    () => ({
      transform: [
        {translateX: labelOffsetX + labelTravel.value},
        {translateY: labelOffsetY},
        {scale: labelScale.value},
      ],
    }),
    [labelOffsetX, labelOffsetY],
  );

  const containerStyle = useMemo(
    () => ({
      width: size,
      height,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    }),
    [height, size],
  );

  // Widened past the icon so the travelling number is never clipped by the
  // wrapper's own bounds once it leaves the arc.
  const labelWrapperStyle = useMemo(
    () => ({
      position: 'absolute' as const,
      top: 0,
      bottom: 0,
      left: -size,
      right: -size,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    }),
    [size],
  );

  const isActive = displaySkip > 0;
  const color = isActive ? '#FFFFFF' : 'rgba(255,255,255,0.78)';

  const labelTextStyle = useMemo(
    () => ({
      color,
      fontSize: size * 0.29,
      fontWeight: '400' as const,
      includeFontPadding: false,
      textAlign: 'center' as const,
    }),
    [color, size],
  );

  const label = isActive
    ? `${isForward ? '+' : '-'}${Math.floor(displaySkip)}`
    : `${seekSeconds}`;

  return (
    <NativeAnimated.View style={displaySkip === 0 && activeSkip === 0 ? controlOpacityStyle : undefined}>
    <Animated.View style={controlOpacityStyle && displaySkip === 0 && activeSkip === 0 ? undefined : wrapperAnimatedStyle}>
      <Control
        disabled={disabled}
        callback={handlePress}
        style={styles.control}
        accessibilityRole="button"
        accessibilityLabel={`${
          isForward ? 'Forward' : 'Rewind'
        } ${seekSeconds} seconds`}>
        <View style={containerStyle}>
          <Animated.View style={iconAnimatedStyle}>
            <SeekArcIcon size={size} color={color} isForward={isForward} />
          </Animated.View>
          <Animated.View
            pointerEvents="none"
            style={[labelWrapperStyle, labelAnimatedStyle]}>
            <Text style={labelTextStyle} numberOfLines={1}>
              {label}
            </Text>
          </Animated.View>
        </View>
      </Control>
    </Animated.View>
    </NativeAnimated.View>
  );
};

interface SeekControlsProps {
  seekSeconds: number;
  onPressRewind: () => void;
  onPressForward: () => void;
  resetControlTimeout?: () => void;
  showControls: boolean;
  controlOpacityStyle?: VideoAnimations['controlsOpacity'];
  skipFeedbackLeft?: number;
  skipFeedbackRight?: number;
  size?: number;
}

/**
 * Rewind/forward pair rendered in its own always-mounted layer, outside the
 * controls opacity animation. That is what lets a double-tap seek animate the
 * real button while the controls are hidden.
 */
export const SeekControls = ({
  seekSeconds,
  onPressRewind,
  onPressForward,
  resetControlTimeout,
  showControls,
  controlOpacityStyle,
  skipFeedbackLeft = 0,
  skipFeedbackRight = 0,
  size = 54,
}: SeekControlsProps) => (
  // While the controls are hidden the layer must not swallow taps, otherwise
  // the gesture surface underneath never sees the double tap.
  <View
    pointerEvents={showControls ? 'box-none' : 'none'}
    style={styles.row}>
    <SeekButton
      direction="backward"
      seekSeconds={seekSeconds}
      size={size}
      controlOpacityStyle={controlOpacityStyle}
      disabled={!showControls}
      visible={showControls || skipFeedbackLeft > 0}
      skipTime={skipFeedbackLeft}
      onPress={onPressRewind}
      resetControlTimeout={resetControlTimeout}
    />
    <View style={styles.spacer} pointerEvents="none" />
    <SeekButton
      direction="forward"
      seekSeconds={seekSeconds}
      size={size}
      controlOpacityStyle={controlOpacityStyle}
      disabled={!showControls}
      visible={showControls || skipFeedbackRight > 0}
      skipTime={skipFeedbackRight}
      onPress={onPressForward}
      resetControlTimeout={resetControlTimeout}
    />
  </View>
);

const styles = {
  row: {
    position: 'absolute' as const,
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    zIndex: 100000,
  },
  // Matches the play/pause control width so the buttons keep the same
  // positions they had inside the PlayPause row.
  spacer: {
    width: '35%' as const,
  },
  control: {
    opacity: 0.7,
  },
};
