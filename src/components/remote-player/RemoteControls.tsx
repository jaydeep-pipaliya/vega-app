import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React from 'react';
import {ActivityIndicator, Pressable, View} from 'react-native';
import IconButton from '../ui/IconButton';
import {useRemoteStore} from '../../lib/remote/remoteStore';
import {remotePlaybackManager} from '../../lib/remote/remotePlaybackManager';
import {useM3Colors} from '../../theme/M3PaletteContext';
import {isTV} from '../../lib/tv';

export const RemoteControls: React.FC = () => {
  const colors = useM3Colors();
  const status = useRemoteStore(state => state.status);
  const seeking = useRemoteStore(state => !!state.pendingSeek);
  const currentTime = useRemoteStore(state => state.currentTime);
  const duration = useRemoteStore(state => state.duration);
  const connectedDevice = useRemoteStore(state => state.connectedDevice);

  if (isTV) return null;

  const isPlaying = status === 'playing';
  const isBuffering =
    seeking || status === 'buffering' || status === 'loading' || status === 'connecting';
  const isError = status === 'error';
  const canControl =
    !!connectedDevice && (status === 'playing' || status === 'paused');
  // The centre button retries after an error; otherwise it plays or pauses.
  const centreEnabled = !!connectedDevice && !isBuffering && (canControl || isError);

  const handleCentrePress = () => {
    if (isError) {
      remotePlaybackManager.retry().catch(() => {});
    } else if (isPlaying) {
      remotePlaybackManager.pause().catch(() => {});
    } else if (canControl) {
      remotePlaybackManager.play().catch(() => {});
    }
  };

  const handleSeekOffset = (seconds: number) => {
    const target = Math.max(
      0,
      duration > 0 ? Math.min(currentTime + seconds, duration) : currentTime + seconds,
    );
    remotePlaybackManager.seek(target).catch(() => {});
  };

  return (
    <View
      style={{
        alignItems: 'center',
        flexDirection: 'row',
        gap: 32,
        justifyContent: 'center',
      }}>
      <IconButton
        icon="rewind-10"
        label="Back 10 seconds"
        size={28}
        buttonSize={56}
        contentColor={colors.onSurface}
        disabled={!canControl}
        onPress={() => handleSeekOffset(-10)}
      />

      <Pressable
        accessibilityLabel={isError ? 'Retry' : isPlaying ? 'Pause' : 'Play'}
        accessibilityRole="button"
        onPress={handleCentrePress}
        disabled={!centreEnabled}
        android_ripple={{color: colors.onPrimary, borderless: true, radius: 36}}
        style={{
          alignItems: 'center',
          backgroundColor: colors.primary,
          borderRadius: 36,
          height: 72,
          justifyContent: 'center',
          opacity: centreEnabled || isBuffering ? 1 : 0.38,
          width: 72,
        }}>
        {isBuffering ? (
          <ActivityIndicator size="small" color={colors.onPrimary} />
        ) : (
          <MaterialCommunityIcons
            name={isError ? 'refresh' : isPlaying ? 'pause' : 'play'}
            size={36}
            color={colors.onPrimary}
          />
        )}
      </Pressable>

      <IconButton
        icon="fast-forward-10"
        label="Forward 10 seconds"
        size={28}
        buttonSize={56}
        contentColor={colors.onSurface}
        disabled={!canControl}
        onPress={() => handleSeekOffset(10)}
      />
    </View>
  );
};
