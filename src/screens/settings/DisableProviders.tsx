import {useFocusEffect} from '@react-navigation/native';
import {View, ScrollView, BackHandler} from 'react-native';
import React, {useState, useEffect, useCallback} from 'react';
import {extensionStorage, providersStorage} from '../../lib/storage';
import {SvgUri} from 'react-native-svg';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import AppText from '../../components/ui/Text';
import SettingsSwitchRow from '../../components/ui/SettingsSwitchRow';
import Surface from '../../components/ui/Surface';
import {useM3Colors} from '../../theme/M3PaletteContext';
import {TVFocusable, TVFocusGuide} from '../../components/tv';
import {isTV} from '../../lib/tv';

const DisableProviders = ({navigation}: any) => {
  const colors = useM3Colors();
  const providersList = extensionStorage.getInstalledProviders();
  const [disabledProviders, setDisabledProviders] = useState<string[]>(
    providersStorage.getDisabledProviders(),
  );

  // Register only while this screen is focused. A hidden screen in a
  // mounted tab or stack must not swallow back presses.
  useFocusEffect(
    useCallback(() => {
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
    }, [navigation]),
  );

  const toggleProvider = (providerId: string) => {
    const newDisabled = providersStorage.toggleProvider(providerId);
    setDisabledProviders(newDisabled);
  };

  const enableAll = () => {
    providersStorage.enableAllProviders();
    setDisabledProviders([]);
  };

  return (
    <TVFocusGuide autoFocus={true} trapFocusRight={true} style={{flex: 1}}>
      <ScrollView
        focusable={false}
        accessible={false}
        className="h-full w-full bg-m3-background"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{paddingBottom: 40, paddingTop: 20}}>
        <View className="px-5">
          <View className="mb-2 flex-row items-center justify-between">
            <View style={{flexDirection: 'row', alignItems: 'center'}}>
              {navigation?.canGoBack?.() ? (
                <TVFocusable
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
              ) : null}
              <AppText
                role="headlineLargeEmphasized"
                className="text-m3-on-background">
                Disable Providers
              </AppText>
            </View>
            <TVFocusable
              onPress={enableAll}
              borderRadius={16}
              focusScale={1.05}
              accessibilityRole="button"
              accessibilityLabel="Enable all providers"
              style={{
                backgroundColor: colors.surfaceContainerHigh,
                borderRadius: 16,
                paddingHorizontal: 16,
                paddingVertical: 10,
              }}>
              <AppText
                role="labelLargeEmphasized"
                style={{color: colors.onSurface}}>
                Enable all
              </AppText>
            </TVFocusable>
          </View>

          <AppText role="bodyLarge" className="mb-6 text-m3-on-surface-variant">
            Choose which built-in sources can appear in discovery results
          </AppText>

        <Surface level="low" className="overflow-hidden">
          {providersList.map((provider, index) => (
            <View
              key={provider.value}
              className="flex-row items-center"
              style={{
                borderBottomColor: colors.outlineVariant,
                borderBottomWidth: index !== providersList.length - 1 ? 1 : 0,
              }}>
              <View className="ml-4 flex-row items-center">
                <View
                  className="mr-1 h-11 w-11 items-center justify-center rounded-2xl"
                  style={{backgroundColor: colors.secondaryContainer}}>
                  <SvgUri width={24} height={24} uri={provider.icon} />
                </View>
              </View>
              <View className="flex-1">
                <SettingsSwitchRow
                  title={provider.display_name}
                  description={provider.type || 'Content provider'}
                  value={!disabledProviders.includes(provider.value)}
                  onValueChange={() => toggleProvider(provider.value)}
                  divider={false}
                />
              </View>
            </View>
          ))}
        </Surface>

        <AppText
          role="bodySmall"
          className="mt-4 text-center text-m3-on-surface-variant">
          Changes will apply to new searches
        </AppText>
      </View>
    </ScrollView>
  </TVFocusGuide>
  );
};

export default DisableProviders;
