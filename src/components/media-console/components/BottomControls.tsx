import React, {Dispatch, SetStateAction} from 'react';
import {
  // ImageBackground,
  SafeAreaView,
  StyleSheet,
  GestureResponderHandlers,
} from 'react-native';
import {Timer} from './Timer';
import {NullControl} from './NullControl';
import {Fullscreen} from './Fullscreen';
import {Seekbar} from './Seekbar';
import {calculateTime} from '../utils';
import type {VideoAnimations} from '../types';
import type {SkipInterval} from '../../../lib/providers/types';
import {styles} from './styles';

interface BottomControlsProps {
  showControls: boolean;
  animations: VideoAnimations;
  panHandlers: GestureResponderHandlers;
  disableTimer: boolean;
  disableSeekbar: boolean;
  showDuration: boolean;
  showHours: boolean;
  paused: boolean;
  showTimeRemaining: boolean;
  currentTime: number;
  duration: number;
  seekColor: string;
  toggleTimer: () => void;
  resetControlTimeout: () => void;
  seekerFillWidth: number;
  seekerPosition: number;
  setSeekerWidth: Dispatch<SetStateAction<number>>;
  isFullscreen: boolean;
  disableFullscreen: boolean;
  toggleFullscreen: () => void;
  cachedPosition: number;
  seeking: boolean;
  seekPreviewTime: number;
  seekThumbnailUri: string | null;
  seekThumbnailLoading: boolean;
  seekSnapPosition: number | null;
  skips?: SkipInterval[];
}

export const BottomControls = ({
  showControls,
  animations: {AnimatedView, ...animations},
  panHandlers,
  disableSeekbar,
  disableTimer,
  duration,
  seekColor,
  showDuration,
  showHours,
  showTimeRemaining,
  currentTime,
  toggleTimer,
  resetControlTimeout,
  seekerFillWidth,
  seekerPosition,
  setSeekerWidth,
  isFullscreen,
  disableFullscreen,
  toggleFullscreen,
  cachedPosition,
  seeking,
  seekPreviewTime,
  seekThumbnailUri,
  seekThumbnailLoading,
  seekSnapPosition,
  skips,
}: BottomControlsProps) => {
  //@ts-ignore
  const timerControl = disableTimer ? (
    <NullControl />
  ) : (
    <Timer
      resetControlTimeout={resetControlTimeout}
      toggleTimer={toggleTimer}
      showControls={showControls}>
      {calculateTime({
        showDuration,
        showHours,
        showTimeRemaining,
        time: currentTime,
        duration,
      })}
    </Timer>
  );

  const seekbarControl = disableSeekbar ? (
    <NullControl />
  ) : (
    <Seekbar
      seekerFillWidth={seekerFillWidth}
      seekerPosition={seekerPosition}
      seekColor={seekColor}
      seekerPanHandlers={panHandlers}
      setSeekerWidth={setSeekerWidth}
      cachedPosition={cachedPosition}
      showDuration={showDuration}
      showHours={showHours}
      showTimeRemaining={showTimeRemaining}
      duration={duration}
      time={currentTime}
      toggleTimer={toggleTimer}
      resetControlTimeout={resetControlTimeout}
      seeking={seeking}
      previewTime={seekPreviewTime}
      thumbnailUri={seekThumbnailUri}
      thumbnailLoading={seekThumbnailLoading}
      snapPosition={seekSnapPosition}
      skips={skips}
    />
  );

  //@ts-ignore
  const fullscreenControl = disableFullscreen ? (
    <NullControl />
  ) : (
    <Fullscreen
      isFullscreen={isFullscreen}
      toggleFullscreen={toggleFullscreen}
      resetControlTimeout={resetControlTimeout}
      showControls={showControls}
    />
  );

  return (
    <AnimatedView
      pointerEvents={showControls ? 'box-none' : 'none'}
      style={[
        _styles.bottom,
        animations.controlsOpacity,
        animations.bottomControl,
      ]}>
      <SafeAreaView style={styles.seekBarContainer}>
        {seekbarControl}
      </SafeAreaView>
    </AnimatedView>
  );
};

const _styles = StyleSheet.create({
  bottom: {
    alignItems: 'stretch',
    flex: 2,
    justifyContent: 'flex-end',
  },
  bottomControlGroup: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginLeft: 12,
    marginRight: 12,
    marginBottom: 0,
  },
});
