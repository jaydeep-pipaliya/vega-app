import {isRemotePlaybackCanceled} from '../../lib/remote/remotePlaybackErrors';
import React, {useEffect, useState} from 'react';
import {ActivityIndicator, TextInput, View} from 'react-native';
import GoogleCast, {useCastDevice, useDevices} from 'react-native-google-cast';
import {useRemoteStore} from '../../lib/remote/remoteStore';
import {dlnaService} from '../../lib/remote/dlnaService';
import {remoteDeliveryService} from '../../lib/remote/remoteDeliveryService';
import {remotePlaybackManager} from '../../lib/remote/remotePlaybackManager';
import {RemoteDevice} from '../../lib/remote/types';
import {useM3Colors} from '../../theme/M3PaletteContext';
import {isTV} from '../../lib/tv';
import Button from '../ui/Button';
import AppText from '../ui/Text';
import {
  RemoteSheet,
  RemoteSheetEmpty,
  RemoteSheetOption,
  RemoteSheetSectionLabel,
} from './RemoteSheet';

interface DevicePickerModalProps {
  visible: boolean;
  onClose: () => void;
  /** Ends casting and leaves the remote screen. */
  onStopCasting: () => void;
}

export const DevicePickerModal: React.FC<DevicePickerModalProps> = ({
  visible,
  onClose,
  onStopCasting,
}) => {
  const colors = useM3Colors();
  const castDevice = useCastDevice();
  const castDevices = useDevices();
  const connectedDevice = useRemoteStore(state => state.connectedDevice);
  const availableDlnaDevices = useRemoteStore(
    state => state.availableDlnaDevices,
  );
  const isSearchingDlna = useRemoteStore(state => state.isSearchingDlna);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [connectError, setConnectError] = useState<string | undefined>();
  const [manualAddress, setManualAddress] = useState('');
  const [addingManual, setAddingManual] = useState(false);
  const [manualError, setManualError] = useState<string | undefined>();

  // Scan for both kinds of device only while the sheet is open.
  useEffect(() => {
    if (!visible || isTV) return;
    setConnectError(undefined);
    dlnaService.startDiscovery();
    remoteDeliveryService.startCastDiscovery().catch(error =>
      console.warn('Cast discovery failed to start:', error),
    );
    return () => {
      dlnaService.stopDiscovery();
      remoteDeliveryService.stopCastDiscovery().catch(() => {});
    };
  }, [visible]);

  // Close once the requested Cast session is up; report a failed start.
  useEffect(() => {
    if (!connectingId) return;
    if (castDevice?.deviceId === connectingId) {
      setConnectingId(null);
      onClose();
      return;
    }
    const sub = GoogleCast.getSessionManager().onSessionStartFailed(
      (_session, error) => {
        setConnectingId(null);
        setConnectError(error || "Couldn't connect to that device");
      },
    );
    return () => sub.remove();
  }, [castDevice?.deviceId, connectingId, onClose]);

  if (isTV) return null;

  const isCastConnected = (deviceId: string) =>
    castDevice?.deviceId === deviceId && connectedDevice?.type !== 'dlna';

  const handleSelectCast = (deviceId: string) => {
    if (isCastConnected(deviceId)) {
      onClose();
      return;
    }
    setConnectError(undefined);
    setConnectingId(deviceId);
    remotePlaybackManager.connectCast(deviceId).catch((error: Error) => {
      setConnectingId(null);
      if (!isRemotePlaybackCanceled(error)) setConnectError(error.message);
    });
  };

  const handleSelectDlna = (device: RemoteDevice) => {
    onClose();
    remotePlaybackManager.connectDlna(device).catch((error: Error) => {
      if (!isRemotePlaybackCanceled(error))
        useRemoteStore.getState().setErrorMessage(error.message);
    });
  };

  const handleAddManual = () => {
    const address = manualAddress.trim();
    if (!address || addingManual) return;
    setManualError(undefined);
    setAddingManual(true);
    dlnaService
      .addDeviceByAddress(address)
      .then(() => setManualAddress(''))
      .catch(() => setManualError(`No DLNA device found at ${address}`))
      .finally(() => setAddingManual(false));
  };

  // The connected device is excluded by the library's list; show it first.
  const castList = [
    ...(castDevice ? [castDevice] : []),
    ...castDevices.filter(device => device.deviceId !== castDevice?.deviceId),
  ];

  return (
    <RemoteSheet
      visible={visible}
      title="Play on"
      onClose={onClose}
      headerRight={
        isSearchingDlna ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : undefined
      }>
      {!!connectedDevice && (
        <View style={{alignItems: 'flex-start', paddingBottom: 8, paddingHorizontal: 16}}>
          <Button
            variant="tonal"
            compact
            onPress={() => {
              onClose();
              onStopCasting();
            }}>
            Stop casting
          </Button>
        </View>
      )}
      {!!connectError && (
        <AppText
          role="bodyMedium"
          style={{color: colors.error, paddingHorizontal: 16, paddingBottom: 8}}>
          {connectError}
        </AppText>
      )}

      <RemoteSheetSectionLabel text="Google Cast" />
      {castList.length === 0 ? (
        <RemoteSheetEmpty text="Searching for Cast devices on this Wi-Fi…" />
      ) : (
        castList.map(device => (
          <RemoteSheetOption
            key={device.deviceId}
            icon={isCastConnected(device.deviceId) ? 'cast-connected' : 'cast'}
            title={device.friendlyName}
            supportingText={
              connectingId === device.deviceId
                ? 'Connecting…'
                : [device.modelName, device.ipAddress].filter(Boolean).join(' · ')
            }
            selected={isCastConnected(device.deviceId)}
            onPress={() => handleSelectCast(device.deviceId)}
          />
        ))
      )}

      <RemoteSheetSectionLabel text="DLNA" />
      {availableDlnaDevices.length === 0 ? (
        <RemoteSheetEmpty
          text={
            isSearchingDlna
              ? 'Searching this Wi-Fi network…'
              : 'No DLNA devices found on this Wi-Fi network'
          }
        />
      ) : (
        availableDlnaDevices.map(device => (
          <RemoteSheetOption
            key={device.id}
            icon="television"
            title={device.name}
            supportingText={[device.model, device.host].filter(Boolean).join(' · ')}
            selected={connectedDevice?.id === device.id}
            onPress={() => handleSelectDlna(device)}
          />
        ))
      )}

      <View style={{flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 8}}>
        <TextInput
          style={{
            backgroundColor: colors.surfaceContainerHighest,
            borderColor: colors.outlineVariant,
            borderRadius: 18,
            borderWidth: 1,
            color: colors.onSurface,
            flex: 1,
            height: 48,
            paddingHorizontal: 16,
          }}
          placeholder="Add by IP, e.g. 192.168.1.20:1815"
          placeholderTextColor={colors.onSurfaceVariant}
          selectionColor={colors.primary}
          value={manualAddress}
          onChangeText={setManualAddress}
          onSubmitEditing={handleAddManual}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          returnKeyType="done"
        />
        <Button
          variant="tonal"
          onPress={handleAddManual}
          disabled={addingManual || !manualAddress.trim()}>
          {addingManual ? 'Adding…' : 'Add'}
        </Button>
      </View>
      {!!manualError && (
        <AppText
          role="bodyMedium"
          style={{color: colors.error, paddingHorizontal: 16, paddingTop: 8}}>
          {manualError}
        </AppText>
      )}
    </RemoteSheet>
  );
};
