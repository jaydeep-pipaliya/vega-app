import {Platform, StyleSheet} from 'react-native';

export const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99999,
  },
  playContainer: {
    width: Platform.isTV ? 96 : '35%',
    ...(Platform.isTV ? {height: 96, borderRadius: 48} : {}),
    alignItems: 'center',
    ...(Platform.isTV ? {justifyContent: 'center', padding: 0} : {}),
  },
});
