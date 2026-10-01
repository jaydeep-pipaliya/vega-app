import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React from 'react';
import {Pressable, View} from 'react-native';
import IconButton from '../ui/IconButton';
import AppText from '../ui/Text';
import {useRemoteStore} from '../../lib/remote/remoteStore';
import {useM3Colors} from '../../theme/M3PaletteContext';
import {isTV} from '../../lib/tv';

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

  if (isTV) return null;

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
    </View>
  );
};
