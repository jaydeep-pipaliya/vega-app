import {useEffect, useMemo} from 'react';
import Animated, {Easing, useAnimatedStyle, useSharedValue, withTiming} from 'react-native-reanimated';
import type {VideoAnimations} from '../types';

const managedByParent = () => {};

/** One UI-thread timeline for the screen buttons and the console controls. */
export function usePlayerControlAnimations(visible: boolean, duration = 350) {
  const progress = useSharedValue(visible ? 1 : 0);
  useEffect(() => {
    progress.value = withTiming(visible ? 1 : 0, {
      duration, easing: Easing.inOut(Easing.quad),
    });
  }, [visible, duration, progress]);

  const bottomStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{translateY: 150 * (1 - progress.value)}],
  }));
  const topStyle = useAnimatedStyle(() => ({
    transform: [{translateY: -150 * (1 - progress.value)}],
  }));
  const opacityStyle = useAnimatedStyle(() => ({opacity: progress.value}));
  const animations = useMemo(() => ({
    AnimatedView: Animated.View,
    bottomControl: bottomStyle,
    topControl: topStyle,
    controlsOpacity: opacityStyle,
    showControlAnimation: managedByParent,
    hideControlAnimation: managedByParent,
  }) as VideoAnimations, [bottomStyle, topStyle, opacityStyle]);
  return {progress, bottomStyle, opacityStyle, animations};
}
