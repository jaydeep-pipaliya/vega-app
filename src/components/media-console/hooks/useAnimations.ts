import {useCallback, useMemo, useRef} from 'react';
import {Animated} from 'react-native';
import type {VideoAnimations} from '../types';

export const useJSAnimations = (
  controlAnimationTiming: number = 450,
  initialShowControls: boolean = true,
): VideoAnimations => {
  const bottomControlMarginBottom = useRef(
    new Animated.Value(initialShowControls ? 0 : -100),
  ).current;
  const controlsOpacity = useRef(
    new Animated.Value(initialShowControls ? 1 : 0),
  ).current;
  const topControlMarginTop = useRef(
    new Animated.Value(initialShowControls ? 0 : -100),
  ).current;

  const hideControlAnimation = useCallback(() => {
    Animated.parallel([
      Animated.timing(controlsOpacity, {
        toValue: 0,
        duration: controlAnimationTiming,
        useNativeDriver: false,
      }),
      Animated.timing(topControlMarginTop, {
        toValue: -100,
        duration: controlAnimationTiming,
        useNativeDriver: false,
      }),
      Animated.timing(bottomControlMarginBottom, {
        toValue: -100,
        duration: controlAnimationTiming,
        useNativeDriver: false,
      }),
    ]).start();
  }, [controlAnimationTiming, controlsOpacity, topControlMarginTop, bottomControlMarginBottom]);

  const showControlAnimation = useCallback(() => {
    Animated.parallel([
      Animated.timing(controlsOpacity, {
        toValue: 1,
        duration: controlAnimationTiming,
        useNativeDriver: false,
      }),
      Animated.timing(topControlMarginTop, {
        toValue: 0,
        duration: controlAnimationTiming,
        useNativeDriver: false,
      }),
      Animated.timing(bottomControlMarginBottom, {
        toValue: 0,
        duration: controlAnimationTiming,
        useNativeDriver: false,
      }),
    ]).start();
  }, [controlAnimationTiming, controlsOpacity, topControlMarginTop, bottomControlMarginBottom]);

  const animations = useMemo(() => ({
    bottomControl: {
      marginBottom: bottomControlMarginBottom,
    },
    topControl: {
      marginTop: topControlMarginTop,
    },
    controlsOpacity: {
      opacity: controlsOpacity,
    },
    showControlAnimation,
    hideControlAnimation,
    AnimatedView: Animated.View,
  } as unknown as VideoAnimations), [bottomControlMarginBottom, topControlMarginTop, controlsOpacity, showControlAnimation, hideControlAnimation]);

  return animations;
};
