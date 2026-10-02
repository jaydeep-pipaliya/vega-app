import React, {Dispatch, SetStateAction, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  View,
  GestureResponderHandlers,
  Image,
  Platform,
  Pressable,
  Text,
} from 'react-native';
import {styles} from './styles';
import {formatTime} from '../../utils';
import type {SkipInterval} from '../../../../lib/providers/types';

interface SeekbarProps {
  seekerFillWidth: number;
  seekerPosition: number;
  seekColor: string;
  cachedPosition: number;
  seekerPanHandlers: GestureResponderHandlers;
  setSeekerWidth: Dispatch<SetStateAction<number>>;
  time?: number;
  duration: number;
  showDuration: boolean;
  showTimeRemaining: boolean;
  showHours: boolean;
  toggleTimer: () => void;
  resetControlTimeout: () => void;
  seeking: boolean;
  previewTime: number;
  thumbnailUri: string | null;
  thumbnailLoading: boolean;
  snapPosition: number | null;
  skips?: SkipInterval[];
}

const PREVIEW_WIDTH = 160;

export const Seekbar = ({
  seekColor,
  seekerFillWidth,
  seekerPosition,
  cachedPosition,
  seekerPanHandlers,
  setSeekerWidth,
  showDuration,
  showHours,
  showTimeRemaining,
  time,
  duration,
  toggleTimer,
  resetControlTimeout,
  seeking,
  previewTime,
  thumbnailUri,
  thumbnailLoading,
  snapPosition,
  skips,
}: SeekbarProps) => {
  const [trackWidth, setTrackWidth] = useState(0);
  const previewLeft = useMemo(
    () =>
      Math.max(
        0,
        Math.min(
          Math.max(0, trackWidth - PREVIEW_WIDTH),
          seekerPosition - PREVIEW_WIDTH / 2,
        ),
      ),
    [seekerPosition, trackWidth],
  );
  const timestampStyle = {
    color: 'hsl(0, 0%, 70%)',
    fontSize: 12,
    fontWeight: '300' as const,
    letterSpacing: 0.2,
  };

  return (
    <View
      style={{
        marginBottom: 55,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'flex-end',
      }}>
      <Pressable
        hitSlop={12}
        // TV uses the Player timeline; this toggle has no focus ring there.
        focusable={!Platform.isTV}
        accessibilityRole="button"
        accessibilityLabel={
          showTimeRemaining ? 'Show elapsed time' : 'Show remaining time'
        }
        onPress={() => {
          toggleTimer();
          resetControlTimeout();
        }}>
        <Text style={timestampStyle}>
          {formatTime({
            duration,
            time: showTimeRemaining
              ? Math.max(0, duration - (time ?? 0))
              : time,
            showDuration,
            showHours,
            showTimeRemaining,
          })}
        </Text>
      </Pressable>
      <View
        style={{...styles.container, width: '80%'}}
        collapsable={false}
        {...seekerPanHandlers}>
        {seeking && trackWidth > 0 ? (
          <View style={[styles.preview, {left: previewLeft}]} pointerEvents="none">
            {thumbnailUri ? (
              <Image
                key={thumbnailUri}
                source={{uri: thumbnailUri}}
                style={styles.previewImage}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.previewPlaceholder} />
            )}
            {thumbnailLoading ? (
              <View style={styles.previewLoading}>
                <ActivityIndicator size="small" color="#fff" />
              </View>
            ) : null}
            <View style={styles.previewTimestampContainer}>
              <Text style={styles.previewTimestamp}>
                {formatTime({
                  duration,
                  time: previewTime,
                  showDuration,
                  showHours,
                  showTimeRemaining: false,
                })}
              </Text>
            </View>
          </View>
        ) : null}
        <View
          style={styles.track}
          onLayout={event => {
            const width = event.nativeEvent.layout.width;
            if (width > 0 && Math.abs(width - trackWidth) > 1) {
              setTrackWidth(width);
              setSeekerWidth(width);
            }
          }}
          pointerEvents="none">
          <View
            style={{
              width: cachedPosition,
              backgroundColor: '#dedede',
              height: 2,
              position: 'absolute',
              top: 0,
              borderRadius: 1,
            }}
            pointerEvents="none"
          />
          <View
            style={[
              styles.fill,
              {
                width: seekerFillWidth,
                backgroundColor: seekColor || '#FFF',
              },
            ]}
            pointerEvents="none"
          />
          {duration > 0 && trackWidth > 0 && skips && skips.length > 0
            ? skips.map((skip, idx) => {
                const gaps = [];
                if (skip.from > 0 && skip.from < duration) {
                  const leftPos = (skip.from / duration) * trackWidth;
                  gaps.push(
                    <View
                      key={`skip-from-${idx}-${skip.from}`}
                      style={{
                        position: 'absolute',
                        left: Math.max(0, leftPos - 1.5),
                        top: 0,
                        width: 3,
                        height: 2,
                        backgroundColor: '#000000',
                        zIndex: 3,
                      }}
                      pointerEvents="none"
                    />,
                  );
                }
                if (skip.to > 0 && skip.to < duration) {
                  const leftPos = (skip.to / duration) * trackWidth;
                  gaps.push(
                    <View
                      key={`skip-to-${idx}-${skip.to}`}
                      style={{
                        position: 'absolute',
                        left: Math.max(0, leftPos - 1.5),
                        top: 0,
                        width: 3,
                        height: 2,
                        backgroundColor: '#000000',
                        zIndex: 3,
                      }}
                      pointerEvents="none"
                    />,
                  );
                }
                return gaps;
              })
            : null}
        </View>
        {seeking && snapPosition !== null ? (
          <View
            style={[styles.snapMarker, {left: snapPosition - 1}]}
            pointerEvents="none"
          />
        ) : null}
        <View
          style={[styles.handle, {left: seekerPosition}]}
          pointerEvents="none">
          <View
            style={[styles.circle, {backgroundColor: seekColor || '#FFF'}]}
            pointerEvents="none"
          />
        </View>
      </View>
      <View>
        <Text style={timestampStyle}>
          {formatTime({
            duration,
            time: duration,
            showDuration,
            showHours,
            showTimeRemaining: false,
          })}
        </Text>
      </View>
    </View>
  );
};
