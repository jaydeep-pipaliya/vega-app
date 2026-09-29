import React, {useEffect, useMemo, useState} from 'react';
import {View} from 'react-native';
import {MaterialCommunityIcons, MaterialIcons} from '@expo/vector-icons';
import {
  extensionStorage,
  ProviderSource,
} from '../../../lib/storage/extensionStorage';
import {createProviderSource} from '../../../lib/utils/helpers';
import {useM3Colors} from '../../../theme/M3PaletteContext';
import AppDialog from '../../../components/AppDialog';
import Text from '../../../components/ui/Text';
import {TVFocusable} from '../../../components/tv';
import {isTV} from '../../../lib/tv/constants';
import {AddSourceModal} from './AddSourceModal';
import {SourcePickerModal} from './SourcePickerModal';

type Props = {
  primary: string;
  visible: boolean;
  onSourceChanged: (source: ProviderSource | undefined) => void | Promise<void>;
};

const ProviderSourceManager = ({primary, visible, onSourceChanged}: Props) => {
  const colors = useM3Colors();
  const [sources, setSources] = useState<ProviderSource[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showSourcePicker, setShowSourcePicker] = useState(false);
  const [invalidSourceDialog, setInvalidSourceDialog] = useState(false);
  const [sourceToRemove, setSourceToRemove] = useState<string>();

  const defaultSource = useMemo(() => {
    return sources.find(item => item.isDefault) || sources[0];
  }, [sources]);

  const reloadSources = () => {
    const nextSources = extensionStorage.getProviderSources();
    setSources(nextSources);
    if (nextSources.length === 0) {
      setShowSourcePicker(false);
      setShowAddDialog(true);
    }
  };

  useEffect(() => {
    if (!visible) {
      return;
    }

    const currentSources = extensionStorage.getProviderSources();
    setSources(currentSources);

    if (currentSources.length === 0) {
      setShowAddDialog(true);
    }
  }, [visible]);

  const handleSelectSource = async (source: ProviderSource) => {
    setShowSourcePicker(false);
    extensionStorage.setDefaultProviderSource(source.author);
    reloadSources();
    await onSourceChanged(extensionStorage.getProviderSource());
  };

  const handleConfirmAdd = async (value: string) => {
    try {
      const source = createProviderSource(value);
      extensionStorage.addProviderSources(source.author, source.url);
      extensionStorage.setDefaultProviderSource(source.author);
      setShowAddDialog(false);
      reloadSources();
      await onSourceChanged(source);
    } catch {
      setInvalidSourceDialog(true);
    }
  };

  const confirmRemoveSource = async () => {
    if (!sourceToRemove) {
      return;
    }

    const targetAuthor = sourceToRemove;
    setSourceToRemove(undefined);

    const installed = extensionStorage.getInstalledProviders();
    const remainingInstalled = installed.filter(
      item => item.source?.author !== targetAuthor,
    );
    extensionStorage.setInstalledProviders(remainingInstalled);

    extensionStorage.removeProviderSource(targetAuthor);
    reloadSources();
    await onSourceChanged(extensionStorage.getProviderSource());
  };

  if (!visible) {
    return null;
  }

  return (
    <View className="px-5">
      <Text
        role="labelLarge"
        className="mb-2"
        style={{color: colors.onSurfaceVariant}}>
        Provider source
      </Text>
      <View className="flex-row items-stretch gap-2">
        {/* Active source selector card */}
        <View className="flex-1" style={{overflow: isTV ? 'visible' : 'hidden'}}>
          <TVFocusable
            accessibilityRole="button"
            accessibilityLabel="Select provider source"
            onPress={() => setShowSourcePicker(true)}
            borderRadius={20}
            focusScale={1.03}
            style={{
              height: 64,
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 16,
              backgroundColor: colors.surfaceContainerHigh,
              borderColor: colors.outlineVariant,
              borderRadius: 20,
              borderWidth: 1,
            }}>
            <View
              className="h-10 w-10 items-center justify-center"
              style={{
                backgroundColor: '#171717',
                borderColor: colors.outlineVariant,
                borderRadius: 15,
                borderWidth: 1,
              }}>
              <MaterialCommunityIcons
                name="source-repository"
                size={20}
                color={colors.primary}
              />
            </View>
            <View className="ml-3 flex-1">
              <Text
                className="text-xs font-medium"
                style={{color: colors.onSurfaceVariant}}>
                Active source
              </Text>
              <Text
                className="mt-0.5 text-base font-bold"
                style={{
                  color: defaultSource
                    ? colors.onSurface
                    : colors.onSurfaceVariant,
                }}
                numberOfLines={1}>
                {defaultSource?.author || 'Add a provider source'}
              </Text>
            </View>
            <MaterialIcons
              name="expand-more"
              size={24}
              color={colors.onSurfaceVariant}
            />
          </TVFocusable>
        </View>

        {/* Plus button to add a source */}
        <TVFocusable
          accessibilityRole="button"
          accessibilityLabel="Add provider source"
          onPress={() => setShowAddDialog(true)}
          borderRadius={20}
          focusScale={1.08}
          style={{
            height: 64,
            width: 64,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#171717',
            borderColor: isTV ? colors.outlineVariant : primary,
            borderRadius: 20,
            borderWidth: isTV ? 1 : 2,
          }}>
          <MaterialCommunityIcons name="plus" size={28} color={primary} />
        </TVFocusable>
      </View>

      <SourcePickerModal
        visible={showSourcePicker}
        sources={sources}
        defaultSource={defaultSource}
        onDismiss={() => setShowSourcePicker(false)}
        onSelectSource={handleSelectSource}
        onRequestRemoveSource={author => setSourceToRemove(author)}
      />

      <AddSourceModal
        visible={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        onAdd={handleConfirmAdd}
      />

      <AppDialog
        visible={invalidSourceDialog}
        title="Invalid source"
        message="Enter a valid source URL or GitHub author."
        primary={primary}
        variant="error"
        onDismiss={() => setInvalidSourceDialog(false)}
      />

      <AppDialog
        visible={Boolean(sourceToRemove)}
        title="Remove source?"
        message={`Remove ${sourceToRemove || 'this source'} from provider sources? Installed providers from it will also be removed.`}
        primary={primary}
        variant="warning"
        actions={[
          {label: 'Cancel'},
          {
            label: 'Remove',
            variant: 'destructive',
            onPress: confirmRemoveSource,
          },
        ]}
        onDismiss={() => setSourceToRemove(undefined)}
      />
    </View>
  );
};

export default ProviderSourceManager;
