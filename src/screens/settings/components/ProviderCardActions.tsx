import {MaterialCommunityIcons} from '@expo/vector-icons';
import React from 'react';
import {ActivityIndicator, Text, View} from 'react-native';
import {TVFocusable, TVFocusGuide} from '../../../components/tv';
import {useM3Colors} from '../../../theme/M3PaletteContext';
import type {ProviderExtension} from '../../../lib/storage/extensionStorage';
import type {ProviderTestStatus} from './ProviderStatusBadge';

interface ProviderCardActionsProps {
  provider: ProviderExtension;
  itemKey: string;
  installed: boolean;
  installing: boolean;
  testStatus: ProviderTestStatus;
  hasSettings?: boolean;
  primary: string;
  onInstall: () => void;
  onTest: () => void;
  onUninstall: () => void;
  onOpenSettings?: () => void;
}

export const ProviderCardActions: React.FC<ProviderCardActionsProps> = ({
  provider,
  itemKey,
  installed,
  installing,
  testStatus,
  hasSettings,
  primary,
  onInstall,
  onTest,
  onUninstall,
  onOpenSettings,
}) => {
  const colors = useM3Colors();

  if (!installed) {
    return (
      <View style={{padding: 12}}>
        <TVFocusable
          testID={`install-provider-${itemKey}`}
          accessibilityLabel={`Install ${provider.display_name}`}
          disabled={installing}
          onPress={onInstall}
          borderRadius={16}
          focusScale={1.04}
          style={{
            height: 48,
            width: '100%',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.primary,
            borderRadius: 16,
          }}>
          {installing ? (
            <ActivityIndicator size="small" color={colors.onPrimary} />
          ) : (
            <MaterialCommunityIcons
              name="download"
              size={20}
              color={colors.onPrimary}
            />
          )}
          <Text
            style={{
              marginLeft: 8,
              fontSize: 14,
              fontWeight: 'bold',
              color: colors.onPrimary,
            }}>
            {installing ? 'Installing' : 'Install'}
          </Text>
        </TVFocusable>
      </View>
    );
  }

  return (
    <TVFocusGuide style={{flexDirection: 'row', gap: 8, padding: 12}}>
      {/* Test Button */}
      <TVFocusable
        testID={`test-provider-${itemKey}`}
        accessibilityLabel={`Test ${provider.display_name}`}
        disabled={testStatus === 'testing'}
        onPress={onTest}
        borderRadius={16}
        focusScale={1.05}
        style={{
          height: 48,
          flex: 1,
          minWidth: 0,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 4,
          backgroundColor: colors.surfaceContainerHighest,
          borderRadius: 16,
        }}>
        {testStatus === 'testing' ? (
          <ActivityIndicator size="small" color={primary} />
        ) : (
          <MaterialCommunityIcons name="flask" size={18} color={primary} />
        )}
        <Text
          numberOfLines={1}
          style={{
            marginLeft: 4,
            fontSize: 12,
            fontWeight: 'bold',
            color: colors.onSurface,
          }}>
          {testStatus === 'testing' ? 'Testing' : 'Test'}
        </Text>
      </TVFocusable>

      {/* Settings Button (if supported) */}
      {hasSettings && onOpenSettings && (
        <TVFocusable
          testID={`settings-provider-${itemKey}`}
          accessibilityLabel={`Settings for ${provider.display_name}`}
          onPress={onOpenSettings}
          borderRadius={16}
          focusScale={1.05}
          style={{
            height: 48,
            flex: 1,
            minWidth: 0,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 4,
            backgroundColor: colors.surfaceContainerHighest,
            borderRadius: 16,
          }}>
          <MaterialCommunityIcons
            name="cog"
            size={18}
            color={colors.onSurface}
          />
          <Text
            numberOfLines={1}
            style={{
              marginLeft: 4,
              fontSize: 12,
              fontWeight: 'bold',
              color: colors.onSurface,
            }}>
            Settings
          </Text>
        </TVFocusable>
      )}

      {/* Uninstall Button */}
      <TVFocusable
        testID={`uninstall-provider-${itemKey}`}
        accessibilityLabel={`Uninstall ${provider.display_name}`}
        onPress={onUninstall}
        borderRadius={16}
        focusScale={1.05}
        style={{
          height: 48,
          flex: 1,
          minWidth: 0,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 4,
          backgroundColor: colors.surfaceContainerHighest,
          borderRadius: 16,
        }}>
        <MaterialCommunityIcons
          name="delete-outline"
          size={18}
          color={colors.onErrorContainer}
        />
        <Text
          numberOfLines={1}
          style={{
            marginLeft: 4,
            fontSize: 12,
            fontWeight: 'bold',
            color: colors.onErrorContainer,
          }}>
          Uninstall
        </Text>
      </TVFocusable>
    </TVFocusGuide>
  );
};
