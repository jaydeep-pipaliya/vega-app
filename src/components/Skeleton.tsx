import React, {useEffect, useMemo} from 'react';
import {Animated, Easing, StyleSheet, View} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

type SkeletonLoaderProps = {
  width: number | string;
  height: number | string;
  style?: any;
  darkMode?: boolean;
  marginVertical?: number;
  children?: React.ReactNode;
  show?: boolean;
  baseColor?: string;
  highlightColor?: string;
};

// One shimmer value and one native loop shared by every mounted skeleton.
// A loading screen can show dozens of skeletons; a loop per instance cost a
// native animation each and started them all on the same frame.
const shimmerValue = new Animated.Value(0);
let shimmerUsers = 0;
let shimmerLoop: Animated.CompositeAnimation | null = null;

const acquireShimmer = () => {
  shimmerUsers += 1;
  if (shimmerLoop) {
    return;
  }
  shimmerValue.setValue(0);
  shimmerLoop = Animated.loop(
    Animated.timing(shimmerValue, {
      toValue: 1,
      duration: 1500,
      easing: Easing.linear,
      useNativeDriver: true,
    }),
  );
  shimmerLoop.start();
};

const releaseShimmer = () => {
  shimmerUsers = Math.max(0, shimmerUsers - 1);
  if (shimmerUsers === 0 && shimmerLoop) {
    shimmerLoop.stop();
    shimmerLoop = null;
  }
};

const LIGHT_COLORS = ['#E0E0E0', '#F5F5F5', '#E0E0E0'];
const DARK_COLORS = ['#333333', '#444', '#333333'];
const GRADIENT_START = {x: 0, y: 0.5};
const GRADIENT_END = {x: 1, y: 0.5};

const SkeletonLoader = ({
  width,
  height,
  style,
  darkMode = true,
  marginVertical = 8,
  children,
  show = true,
  baseColor,
  highlightColor,
}: SkeletonLoaderProps) => {
  const visible = !(children && !show);

  useEffect(() => {
    if (!visible) {
      return;
    }
    acquireShimmer();
    return releaseShimmer;
  }, [visible]);

  const fallbackColors = darkMode ? DARK_COLORS : LIGHT_COLORS;
  const colors = useMemo(
    () =>
      baseColor && highlightColor
        ? [baseColor, highlightColor, baseColor]
        : fallbackColors,
    [baseColor, highlightColor, fallbackColors],
  );
  const resolvedBaseColor = baseColor || fallbackColors[0];

  const animationWidth = typeof width === 'string' ? 200 : width;
  const translateX = useMemo(
    () =>
      shimmerValue.interpolate({
        inputRange: [0, 1],
        outputRange: [-animationWidth, animationWidth],
      }),
    [animationWidth],
  );

  if (!visible) {
    return <>{children}</>;
  }

  return (
    <View
      style={[
        styles.skeleton,
        {backgroundColor: resolvedBaseColor, width, height, marginVertical},
        style,
      ]}>
      <Animated.View style={[styles.shimmer, {transform: [{translateX}]}]}>
        <LinearGradient
          colors={colors}
          start={GRADIENT_START}
          end={GRADIENT_END}
          style={styles.gradient}
        />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  skeleton: {
    overflow: 'hidden',
    borderRadius: 5,
    // based on dark mode
    backgroundColor: '#333',
  },
  shimmer: {
    flex: 1,
  },
  gradient: {
    width: '100%',
    height: '100%',
  },
});

export default SkeletonLoader;
