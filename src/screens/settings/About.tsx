import {View, ScrollView, ToastAndroid, Linking, BackHandler, findNodeHandle} from 'react-native';
// import pkg from '../../../package.json';
import React, {useState, useEffect, useRef} from 'react';
import {settingsStorage} from '../../lib/storage';
import * as RNFS from '@dr.pogodin/react-native-fs';
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import {notificationService} from '../../lib/services/Notification';
import SettingsRow from '../../components/ui/SettingsRow';
import SettingsSection from '../../components/ui/SettingsSection';
import SettingsSwitchRow from '../../components/ui/SettingsSwitchRow';
import AppText from '../../components/ui/Text';
import LoadingIndicator from '../../components/ui/LoadingIndicator';
import {showAppDialog} from '../../lib/zustand/appDialogStore';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import {useM3Colors} from '../../theme/M3PaletteContext';
import {TVFocusable, TVFocusGuide} from '../../components/tv';
import {isTV} from '../../lib/tv';

const deletePartialFile = async (filePath: string) => {
  try {
    if (await RNFS.exists(filePath)) {
      await RNFS.unlink(filePath);
    }
  } catch {}
};

const downloadUpdate = async (url: string, name: string) => {
  console.log('downloading', url, name);
  await notificationService.requestPermission();

  const filePath = `${RNFS.CachesDirectoryPath}/${name}`;

  let expectedSize = 0;

  const {promise} = RNFS.downloadFile({
    fromUrl: url,
    background: true,
    progressInterval: 1000,
    progressDivider: 1,
    toFile: filePath,
    begin: res => {
      expectedSize = res.contentLength;
      console.log('begin', res.jobId, res.statusCode, res.contentLength);
    },
    progress: res => {
      notificationService.showUpdateProgress(
        'Downloading Update',
        `Version ${Application.nativeApplicationVersion} -> ${name}`,
        {
          current: res.bytesWritten,
          max: res.contentLength,
          indeterminate: false,
        },
      );
    },
  });

  try {
    const res = await promise;
    await notificationService.cancelNotification('updateProgress');

    if (res.statusCode !== 200 || res.bytesWritten < expectedSize) {
      console.log(
        `[update] Download failed: status=${res.statusCode}, bytes=${res.bytesWritten}/${expectedSize}`,
      );
      await deletePartialFile(filePath);
      ToastAndroid.show(
        'Download failed, please try again',
        ToastAndroid.SHORT,
      );
      return;
    }

    await notificationService.displayUpdateNotification({
      id: 'downloadComplete',
      title: 'Download Complete',
      body: 'Tap to install',
      data: {filePath, action: 'install'},
    });
  } catch (error) {
    console.log('[update] Download error:', error);
    await notificationService.cancelNotification('updateProgress');
    await deletePartialFile(filePath);
    ToastAndroid.show('Download failed, please try again', ToastAndroid.SHORT);
  }
};

// handle check for update
export const checkForUpdate = async (
  setUpdateLoading: React.Dispatch<React.SetStateAction<boolean>>,
  autoDownload: boolean,
  showToast: boolean = true,
) => {
  setUpdateLoading(true);
  try {
    const res = await fetch(
      'https://api.github.com/repos/Zenda-Cross/vega-app/releases/latest',
    );
    if (res.status === 403 || res.status === 429) {
      ToastAndroid.show(
        'GitHub API rate limit exceeded. Please wait a few minutes before trying again.',
        ToastAndroid.LONG,
      );
      setUpdateLoading(false);
      return;
    }
    if (!res.ok) {
      throw new Error(`GitHub release check failed with status ${res.status}`);
    }
    const data = await res.json();
    if (!data?.tag_name) {
      throw new Error('Invalid release data received from GitHub');
    }
    const localVersion = Application.nativeApplicationVersion;
    const remoteVersion = Number(
      data.tag_name.replace('v', '')?.split('.').join(''),
    );
    if (compareVersions(localVersion || '', data.tag_name.replace('v', ''))) {
      ToastAndroid.show('New update available', ToastAndroid.SHORT);
      showAppDialog({
        title: `Update v${localVersion} -> ${data.tag_name}`,
        message: data.body,
        messageFormat: 'markdown',
        actions: [
          {label: 'Cancel'},
          {
            label: 'Update',
            variant: 'primary',
            onPress: () => {
              const apkAsset =
                data?.assets?.find(
                  (asset: any) =>
                    asset.name?.endsWith('.apk') &&
                    asset.name?.toLowerCase().includes('universal'),
                ) ||
                data?.assets?.find((asset: any) =>
                  asset.name?.endsWith('.apk'),
                );
              return autoDownload && apkAsset
                ? downloadUpdate(apkAsset.browser_download_url, apkAsset.name)
                : Linking.openURL(data.html_url);
            },
          },
        ],
      });
      console.log(
        'local version',
        localVersion,
        'remote version',
        remoteVersion,
      );
    } else {
      showToast && ToastAndroid.show('App is up to date', ToastAndroid.SHORT);
      console.log(
        'local version',
        localVersion,
        'remote version',
        remoteVersion,
      );
    }
  } catch (error) {
    const isRateLimit =
      error instanceof Error &&
      error.message.toLowerCase().includes('rate limit');
    const msg = isRateLimit
      ? 'GitHub API rate limit exceeded. Please wait a few minutes before trying again.'
      : 'Failed to check for update';
    ToastAndroid.show(msg, ToastAndroid.SHORT);
    console.log('Update error', error);
  }
  setUpdateLoading(false);
};

const About = ({navigation}: any) => {
  const colors = useM3Colors();
  const backRef = useRef<View>(null);
  const autoDownloadRef = useRef<View>(null);
  const [backHandle, setBackHandle] = useState<number | null>(null);
  const [autoDownloadHandle, setAutoDownloadHandle] = useState<number | null>(null);
  const [updateLoading, setUpdateLoading] = useState(false);
  const [autoDownload, setAutoDownload] = useState(
    settingsStorage.isAutoDownloadEnabled(),
  );
  const [autoCheckUpdate, setAutoCheckUpdate] = useState<boolean>(
    settingsStorage.isAutoCheckUpdateEnabled(),
  );

  useEffect(() => {
    if (!isTV) {
      return;
    }
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (navigation?.canGoBack?.()) {
        navigation.goBack();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [navigation]);

  return (
    <TVFocusGuide autoFocus={true} trapFocusRight={true} trapFocusDown={true} style={{flex: 1}}>
      <ScrollView
        focusable={false}
        accessible={false}
        style={{flex: 1, backgroundColor: colors.background}}
        contentContainerStyle={{padding: 20, paddingBottom: 40}}
        showsVerticalScrollIndicator={false}>
        <View className="mb-7">
          <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 12}}>
            <TVFocusable
              ref={backRef}
              onLayout={() => setBackHandle(findNodeHandle(backRef.current))}
              nextFocusDown={autoDownloadHandle}
              hasTVPreferredFocus={isTV}
              accessibilityLabel="Go back"
              accessibilityRole="button"
              onPress={() => navigation.goBack()}
              borderRadius={22}
              style={{
                alignItems: 'center',
                height: 44,
                justifyContent: 'center',
                marginRight: 10,
                width: 44,
              }}>
              <MaterialCommunityIcons
                name="arrow-left"
                size={28}
                color={colors.onBackground}
              />
            </TVFocusable>
            <AppText
              role="headlineLargeEmphasized"
              className="text-m3-on-background">
              About Vega
            </AppText>
          </View>
          <AppText role="bodyLarge" className="mt-1 text-m3-on-surface-variant">
            App information and updates
          </AppText>
        </View>

        <SettingsSection title="App">
          <SettingsRow
            title="Version"
            description={`Vega ${Application.nativeApplicationVersion || ''}`}
            icon="information-outline"
            divider={Constants.expoConfig?.extra?.isPlayStore}
          />

          {!Constants.expoConfig?.extra?.isPlayStore && (
            <>
              <SettingsSwitchRow
                ref={autoDownloadRef}
                nextFocusUp={backHandle}
                title="Auto install updates"
                description="Download and install new releases automatically"
                value={autoDownload}
                onValueChange={next => {
                  setAutoDownload(next);
                  settingsStorage.setAutoDownloadEnabled(next);
                }}
              />
              <SettingsSwitchRow
                title="Check on startup"
                description="Look for a new release when Vega opens"
                value={autoCheckUpdate}
                onValueChange={next => {
                  setAutoCheckUpdate(next);
                  settingsStorage.setAutoCheckUpdateEnabled(next);
                }}
              />
              <SettingsRow
                title="Check for updates"
                description="Compare this build with the latest release"
                icon="update"
                divider={false}
                trailing={
                  updateLoading ? <LoadingIndicator size={14} /> : undefined
                }
                onPress={
                  updateLoading
                    ? undefined
                    : () => checkForUpdate(setUpdateLoading, autoDownload, true)
                }
              />
            </>
          )}
        </SettingsSection>
      </ScrollView>
    </TVFocusGuide>
  );
};

export default About;

function compareVersions(localVersion: string, remoteVersion: string): boolean {
  try {
    // Split versions into arrays and convert to numbers
    const local = localVersion.split('.').map(Number);
    const remote = remoteVersion.split('.').map(Number);

    // Compare major version
    if (remote[0] > local[0]) {
      return true;
    }
    if (remote[0] < local[0]) {
      return false;
    }

    // Compare minor version
    if (remote[1] > local[1]) {
      return true;
    }
    if (remote[1] < local[1]) {
      return false;
    }

    // Compare patch version
    if (remote[2] > local[2]) {
      return true;
    }

    return false;
  } catch (error) {
    console.error('Invalid version format');
    return false;
  }
}
