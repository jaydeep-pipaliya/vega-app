import {BasicAlertDialog, Host, RNHostView} from '@expo/ui/jetpack-compose';
import React, {useEffect} from 'react';
import {
  BackHandler,
  Modal,
  Pressable,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import {useM3Colors, useM3HostTheme} from '../../theme/M3PaletteContext';
import {isTV} from '../../lib/tv';

interface MaterialDialogSurfaceProps {
  visible: boolean;
  children: React.ReactNode;
  dismissible?: boolean;
  onDismiss: () => void;
  style?: ViewStyle;
}

const MaterialDialogSurface = ({
  visible,
  children,
  dismissible = true,
  onDismiss,
  style,
}: MaterialDialogSurfaceProps) => {
  const colors = useM3Colors();
  const hostTheme = useM3HostTheme();

  useEffect(() => {
    if (!isTV || !visible || !dismissible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onDismiss();
      return true;
    });
    return () => sub.remove();
  }, [visible, dismissible, onDismiss]);

  if (!visible) {
    return null;
  }

  if (isTV) {
    return (
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (dismissible) onDismiss();
        }}>
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.78)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 24,
          }}>
          {dismissible && (
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={onDismiss}
            />
          )}
          <View
            style={[
              {
                backgroundColor: '#1E1E1E',
                borderRadius: 24,
                maxWidth: 480,
                width: '90%',
                overflow: 'hidden',
                padding: 24,
                borderWidth: 1,
                borderColor: 'rgba(255, 255, 255, 0.12)',
                zIndex: 10,
              },
              style,
            ]}>
            {children}
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <View
      pointerEvents="box-none"
      style={{left: 0, position: 'absolute', top: 0, zIndex: 1000}}>
      <Host matchContents {...hostTheme}>
        <BasicAlertDialog
          onDismissRequest={() => {
            if (dismissible) {
              onDismiss();
            }
          }}>
          <RNHostView matchContents>
            <View
              style={[
                {
                  backgroundColor: colors.surfaceContainerHigh,
                  borderRadius: 28,
                  maxWidth: 420,
                  overflow: 'hidden',
                  padding: 24,
                  width: 340,
                },
                style,
              ]}>
              {children}
            </View>
          </RNHostView>
        </BasicAlertDialog>
      </Host>
    </View>
  );
};

export default MaterialDialogSurface;
