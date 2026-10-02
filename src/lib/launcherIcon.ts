import {NativeModules, Platform} from 'react-native';

export type LauncherIcon = 'white' | 'tomato' | 'gray' | 'blue' | 'lavender';

type LauncherIconModule = {
  setIcon: (icon: LauncherIcon) => Promise<LauncherIcon>;
};

const nativeModule = NativeModules.LauncherIconModule as
  | LauncherIconModule
  | undefined;

export const setLauncherIcon = async (icon: LauncherIcon): Promise<void> => {
  if (Platform.OS !== 'android') return;
  if (!nativeModule) {
    throw new Error('Launcher icon module is unavailable. Rebuild the Android app.');
  }
  await nativeModule.setIcon(icon);
};
