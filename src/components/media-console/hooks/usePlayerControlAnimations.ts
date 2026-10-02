import {useEffect, useMemo, useRef} from 'react';
import {Animated, Easing} from 'react-native';
import type {VideoAnimations} from '../types';
const managedByParent = () => {};
/** One native-driven timeline; no per-frame Fabric style commits. */
export function usePlayerControlAnimations(visible: boolean, duration = 350) {
  const progress = useRef(new Animated.Value(visible ? 1 : 0)).current;
  useEffect(() => {
    const animation = Animated.timing(progress, {toValue: visible ? 1 : 0, duration,
      easing: Easing.inOut(Easing.quad), useNativeDriver: true});
    animation.start();
    return () => animation.stop();
  }, [visible, duration, progress]);
  return useMemo(() => {
    const opacityStyle = {opacity: progress};
    const bottomStyle = {opacity: progress, transform: [{translateY: progress.interpolate({inputRange: [0, 1], outputRange: [150, 0]})}]};
    const topStyle = {transform: [{translateY: progress.interpolate({inputRange: [0, 1], outputRange: [-150, 0]})}]};
    const animations = {AnimatedView: Animated.View, bottomControl: bottomStyle, topControl: topStyle,
      controlsOpacity: opacityStyle, showControlAnimation: managedByParent, hideControlAnimation: managedByParent} as VideoAnimations;
    return {progress, bottomStyle, topStyle, opacityStyle, animations};
  }, [progress]);
}
