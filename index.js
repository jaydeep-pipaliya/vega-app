/**
 * @format
 */

import {AppRegistry} from 'react-native';
import App from './src/App';
import notifee from '@notifee/react-native';
// import notificationService from './src/lib/services/Notification';

// Release builds: drop verbose logging. Each call formats its arguments and
// crosses into native logcat on the JS thread, which adds up in hot paths
// (provider fetches, playback, downloads). Warnings and errors are kept.
if (!__DEV__) {
  const noop = () => {};
  console.log = noop;
  console.info = noop;
  console.debug = noop;
  console.trace = noop;
}

// Enable react-native-firebase debug mode for Analytics DebugView in dev
if (__DEV__) {
  // eslint-disable-next-line no-undef
  globalThis.RNFBDebug = true;
}

notifee.onBackgroundEvent(async ({type, detail}) => {
  const notificationService =
    require('./src/lib/services/Notification').default;
  await notificationService.actionHandler({type, detail});
});

notifee.registerForegroundService(async () => {
  // Keep the service alive while in foreground
  return new Promise(() => {});
});

AppRegistry.registerComponent('main', () => App);
