import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React, {useState} from 'react';
import {Clipboard, Pressable, Switch, ToastAndroid, View} from 'react-native';
import IconButton from '../ui/IconButton';
import AppText from '../ui/Text';
import {useRemoteStore} from '../../lib/remote/remoteStore';
import {useM3Colors} from '../../theme/M3PaletteContext';
import {isTV} from '../../lib/tv';
import {remotePlaybackManager} from '../../lib/remote/remotePlaybackManager';
import {RemoteSheet} from './RemoteSheet';

interface RemoteHeaderProps {
  onBack: () => void;
  onOpenDevicePicker: () => void;
}

export const RemoteHeader: React.FC<RemoteHeaderProps> = ({
  onBack,
  onOpenDevicePicker,
}) => {
  const colors = useM3Colors();
  const connectedDevice = useRemoteStore(state => state.connectedDevice);
  const [menuVisible, setMenuVisible] = useState(false);
  const [castHls, setCastHls] = useState(() =>
    remotePlaybackManager.isCastHlsEnabled(),
  );

  if (isTV) return null;

  const copy = (value: string | undefined, label: string) => {
    if (!value) {
      ToastAndroid.show(`No ${label} to copy`, ToastAndroid.SHORT);
      return;
    }
    Clipboard.setString(value);
    ToastAndroid.show(`${label[0].toUpperCase()}${label.slice(1)} copied`, ToastAndroid.SHORT);
    setMenuVisible(false);
  };

  const toggleCastHls = (enabled: boolean) => {
    remotePlaybackManager.setCastHlsEnabled(enabled);
    setCastHls(enabled);
  };

  return (
    <View
      style={{
        alignItems: 'center',
        flexDirection: 'row',
        gap: 4,
        paddingLeft: 4,
        paddingRight: 16,
        paddingTop: 4,
      }}>
      <IconButton
        icon="arrow-left"
        label="Stop casting and go back"
        contentColor={colors.onSurface}
        onPress={onBack}
      />
      <View style={{flex: 1}} />
      <Pressable
        accessibilityLabel="Playback device"
        accessibilityRole="button"
        onPress={onOpenDevicePicker}
        android_ripple={{color: colors.onSurfaceVariant}}
        style={{
          alignItems: 'center',
          backgroundColor: colors.surfaceContainerHigh,
          borderRadius: 20,
          flexDirection: 'row',
          gap: 8,
          height: 40,
          maxWidth: '70%',
          overflow: 'hidden',
          paddingLeft: 12,
          paddingRight: 8,
        }}>
        <MaterialCommunityIcons
          name={
            !connectedDevice
              ? 'cast'
              : connectedDevice.type === 'cast'
                ? 'cast-connected'
                : 'television'
          }
          size={18}
          color={colors.primary}
        />
        <AppText
          role="labelLarge"
          numberOfLines={1}
          style={{color: colors.onSurface, flexShrink: 1}}>
          {connectedDevice?.name || 'Choose a device'}
        </AppText>
        <MaterialCommunityIcons
          name="chevron-down"
          size={20}
          color={colors.onSurfaceVariant}
        />
      </Pressable>
      <IconButton
        icon="dots-vertical"
        label="More options"
        contentColor={colors.onSurface}
        onPress={() => setMenuVisible(true)}
      />
      <RemoteSheet
        visible={menuVisible}
        title="Options"
        onClose={() => setMenuVisible(false)}>
        <MenuRow
          icon="playlist-play"
          title="HLS for Google Cast"
          detail="Lets the Chromecast seek by itself. Applies to the next video or audio change."
          onPress={() => toggleCastHls(!castHls)}
          right={<Switch value={castHls} onValueChange={toggleCastHls} />}
        />
        <MenuRow
          icon="link-variant"
          title="Copy stream link"
          onPress={() => copy(remotePlaybackManager.getActiveStreamUrl(), 'stream link')}
        />
        <MenuRow
          icon="subtitles-outline"
          title="Copy subtitle link"
          onPress={() => copy(remotePlaybackManager.getActiveSubtitleUrl(), 'subtitle link')}
        />
      </RemoteSheet>
    </View>
  );
};

const MenuRow: React.FC<{
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  title: string;
  detail?: string;
  onPress: () => void;
  right?: React.ReactNode;
}> = ({icon, title, detail, onPress, right}) => {
  const colors = useM3Colors();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      android_ripple={{color: colors.onSurfaceVariant}}
      style={{
        alignItems: 'center',
        flexDirection: 'row',
        gap: 16,
        minHeight: 56,
        paddingHorizontal: 24,
        paddingVertical: 8,
      }}>
      <MaterialCommunityIcons name={icon} size={24} color={colors.onSurfaceVariant} />
      <View style={{flex: 1}}>
        <AppText role="bodyLarge" style={{color: colors.onSurface}}>
          {title}
        </AppText>
        {detail ? (
          <AppText role="bodySmall" style={{color: colors.onSurfaceVariant}}>
            {detail}
          </AppText>
        ) : null}
      </View>
      {right}
    </Pressable>
  );
};
