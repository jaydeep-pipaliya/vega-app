import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  ToastAndroid,
  View,
  findNodeHandle,
} from 'react-native';
import { providerManager } from '../../../lib/services/ProviderManager';
import { providerKvStorage } from '../../../lib/storage/StorageService';
import { getScopedKvKey } from '../../../lib/sandbox/providerRpc';
import { showAppDialog } from '../../../lib/zustand/appDialogStore';
import type { ProviderExtension } from '../../../lib/storage/extensionStorage';
import type { SettingsField, SelectOption } from '../../../lib/providers/types';
import { useM3Colors } from '../../../theme/M3PaletteContext';
import AppText from '../../../components/ui/Text';
import SettingsSwitchRow from '../../../components/ui/SettingsSwitchRow';
import DropdownField from '../../../components/ui/DropdownField';
import { TVFocusable, TVFocusGuide } from '../../../components/tv';
import { isTV } from '../../../lib/tv';

interface ProviderSettingsModalProps {
  visible: boolean;
  provider: ProviderExtension | null;
  onClose: () => void;
}

export const ProviderSettingsModal: React.FC<ProviderSettingsModalProps> = ({
  visible,
  provider,
  onClose,
}) => {
  const colors = useM3Colors();
  const closeRef = React.useRef<View>(null);
  const [closeHandle, setCloseHandle] = useState<number | null>(null);
  const [fields, setFields] = useState<SettingsField[]>([]);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      e => {
        setKeyboardHeight(e.endCoordinates.height);
      },
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
      },
    );

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    if (!isTV || !visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [visible, onClose]);

  const loadSchemaAndValues = useCallback(async () => {
    if (!provider) return;
    setLoading(true);
    try {
      const schema = await providerManager.getSettingsSchema({
        providerValue: provider.value,
        sourceAuthor: provider.source?.author,
      });
      setFields(schema);

      const initialValues: Record<string, unknown> = {};
      for (const field of schema) {
        const scopedKey = getScopedKvKey(provider.value, field.key);
        const storedRaw = providerKvStorage.getString(scopedKey);
        if (storedRaw !== undefined && storedRaw !== null) {
          try {
            initialValues[field.key] = JSON.parse(storedRaw);
          } catch {
            initialValues[field.key] = storedRaw;
          }
        } else if (field.defaultValue !== undefined) {
          initialValues[field.key] = field.defaultValue;
        }
      }
      setValues(initialValues);
    } catch (err) {
      console.error('Failed to load settings schema:', err);
    } finally {
      setLoading(false);
    }
  }, [provider]);

  useEffect(() => {
    if (visible && provider) {
      loadSchemaAndValues();
    } else {
      setFields([]);
      setValues({});
    }
  }, [visible, provider, loadSchemaAndValues]);

  const handleChange = (key: string, val: unknown) => {
    setValues(prev => ({ ...prev, [key]: val }));
  };

  const handleSave = () => {
    if (!provider) return;
    for (const [key, value] of Object.entries(values)) {
      const scopedKey = getScopedKvKey(provider.value, key);
      if (value === undefined || value === null || value === '') {
        providerKvStorage.delete(scopedKey);
      } else {
        providerKvStorage.setString(scopedKey, JSON.stringify(value));
      }
    }
    onClose();
  };

  const handleResetProvider = () => {
    if (!provider) return;
    showAppDialog({
      title: `Reset ${provider.display_name}?`,
      message: `Are you sure you want to reset all settings and stored data for ${provider.display_name} to defaults?`,
      variant: 'warning',
      actions: [
        { label: 'Cancel' },
        {
          label: 'Reset',
          variant: 'destructive',
          onPress: async () => {
            await providerManager.clearProviderStorage(provider.value);
            const defaultValues: Record<string, unknown> = {};
            for (const field of fields) {
              if (field.defaultValue !== undefined) {
                defaultValues[field.key] = field.defaultValue;
              }
            }
            setValues(defaultValues);
            if (Platform.OS === 'android') {
              ToastAndroid.show('Provider reset to default', ToastAndroid.SHORT);
            }
          },
        },
      ],
    });
  };

  if (!visible || !provider) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 justify-end bg-black/60"
        style={{
          paddingBottom: Platform.OS === 'android' ? keyboardHeight : 0,
        }}>
        <Pressable
          style={{ flex: 1 }}
          onPress={() => {
            if (keyboardHeight > 0) {
              Keyboard.dismiss();
            } else {
              onClose();
            }
          }}
        />
        <TVFocusGuide autoFocus={true} trapFocusRight={true} trapFocusUp={true} trapFocusDown={true}>
          <View
            className="max-h-[85%] rounded-t-3xl p-5"
            style={{ backgroundColor: colors.surfaceContainer }}>
            {/* Header */}
            <View className="mb-4 flex-row items-center justify-between pb-3 border-b"
              style={{ borderColor: colors.outlineVariant }}>
              <View className="flex-row items-center gap-3">
                <View
                  className="h-11 w-11 items-center justify-center overflow-hidden rounded-2xl"
                  style={{ backgroundColor: colors.surfaceContainerHighest }}>
                  {provider.icon ? (
                    <Image
                      source={{ uri: provider.icon }}
                      className="h-full w-full"
                      resizeMode="cover"
                      resizeMethod="resize"
                    />
                  ) : (
                    <MaterialCommunityIcons
                      name="cog-outline"
                      size={24}
                      color={colors.primary}
                    />
                  )}
                </View>
                <View>
                  <AppText role="titleMedium" style={{ color: colors.onSurface }}>
                    {provider.display_name} Settings
                  </AppText>
                  <AppText role="bodySmall" style={{ color: colors.onSurfaceVariant }}>
                    Configure provider options
                  </AppText>
                </View>
              </View>
              <TVFocusable
                ref={closeRef}
                onLayout={() => setCloseHandle(findNodeHandle(closeRef.current))}
                hasTVPreferredFocus={isTV}
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Close settings"
                borderRadius={18}
                style={{
                  backgroundColor: colors.surfaceContainerHighest,
                  height: 36,
                  width: 36,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 18,
                }}>
                <MaterialCommunityIcons
                  name="close"
                  size={20}
                  color={colors.onSurfaceVariant}
                />
              </TVFocusable>
            </View>

            {/* Body */}
            {loading ? (
              <View className="items-center justify-center py-12">
                <ActivityIndicator size="large" color={colors.primary} />
                <AppText
                  role="bodyMedium"
                  style={{ color: colors.onSurfaceVariant, marginTop: 12 }}>
                  Loading settings...
                </AppText>
              </View>
            ) : fields.length === 0 ? (
              <View className="items-center justify-center py-10">
                <MaterialCommunityIcons
                  name="tune-vertical"
                  size={40}
                  color={colors.onSurfaceVariant}
                />
                <AppText
                  role="bodyMedium"
                  style={{ color: colors.onSurfaceVariant, marginTop: 8 }}>
                  No configurable settings for this provider.
                </AppText>
              </View>
            ) : (
              <ScrollView
                focusable={false}
                accessible={false}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 20 }}>
              <View className="gap-4">
                {fields.map((field, fieldIndex) => {
                  const currentValue = values[field.key];

                  if (field.type === 'toggle') {
                    return (
                      <View
                        key={field.key}
                        className="rounded-2xl overflow-hidden"
                        style={{
                          backgroundColor: colors.surfaceContainerHigh,
                          borderColor: colors.outlineVariant,
                          borderWidth: 1,
                        }}>
                        <SettingsSwitchRow
                          nextFocusUp={fieldIndex === 0 ? closeHandle : undefined}
                          title={field.label}
                          description={field.description}
                          value={Boolean(currentValue)}
                          onValueChange={val => handleChange(field.key, val)}
                          divider={false}
                        />
                      </View>
                    );
                  }

                  if (field.type === 'select') {
                    const selectedOption = field.options.find(
                      opt => opt.value === currentValue,
                    );

                    return (
                      <View
                        key={field.key}
                        className="rounded-2xl p-4"
                        style={{
                          backgroundColor: colors.surfaceContainerHigh,
                          borderColor: colors.outlineVariant,
                          borderWidth: 1,
                        }}>
                        <AppText
                          role="bodyLargeEmphasized"
                          style={{ color: colors.onSurface }}>
                          {field.label}
                        </AppText>
                        {field.description ? (
                          <AppText
                            role="bodySmall"
                            style={{
                              color: colors.onSurfaceVariant,
                              marginTop: 2,
                              marginBottom: 10,
                            }}>
                            {field.description}
                          </AppText>
                        ) : (
                          <View style={{ height: 10 }} />
                        )}

                        <DropdownField
                          options={field.options}
                          value={selectedOption}
                          getKey={opt => opt.value}
                          getLabel={opt => opt.label}
                          onChange={opt => handleChange(field.key, opt.value)}
                        />
                      </View>
                    );
                  }

                  if (field.type === 'multiselect') {
                    const selectedList: string[] = Array.isArray(currentValue)
                      ? (currentValue as string[])
                      : [];

                    const toggleOption = (optValue: string) => {
                      const exists = selectedList.includes(optValue);
                      const updated = exists
                        ? selectedList.filter(v => v !== optValue)
                        : [...selectedList, optValue];
                      handleChange(field.key, updated);
                    };

                    return (
                      <View
                        key={field.key}
                        className="rounded-2xl p-4"
                        style={{
                          backgroundColor: colors.surfaceContainerHigh,
                          borderColor: colors.outlineVariant,
                          borderWidth: 1,
                        }}>
                        <AppText
                          role="bodyLargeEmphasized"
                          style={{ color: colors.onSurface }}>
                          {field.label}
                        </AppText>
                        {field.description ? (
                          <AppText
                            role="bodySmall"
                            style={{ color: colors.onSurfaceVariant, marginTop: 2 }}>
                            {field.description}
                          </AppText>
                        ) : null}

                        <View
                          className="mt-3 rounded-xl border overflow-hidden p-1 gap-1"
                          style={{
                            backgroundColor: colors.surfaceContainerLowest,
                            borderColor: colors.outlineVariant,
                          }}>
                          {field.options.map((opt: SelectOption) => {
                            const isSelected = selectedList.includes(opt.value);
                            return (
                              <TVFocusable
                                key={opt.value}
                                onPress={() => toggleOption(opt.value)}
                                accessibilityRole="checkbox"
                                accessibilityState={{ checked: isSelected }}
                                accessibilityLabel={opt.label}
                                borderRadius={8}
                                focusScale={1.02}
                                style={{
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  paddingHorizontal: 12,
                                  paddingVertical: 10,
                                  borderRadius: 8,
                                  backgroundColor: isSelected
                                    ? colors.primaryContainer
                                    : 'transparent',
                                }}>
                                <AppText
                                  role="bodyMedium"
                                  style={{
                                    color: isSelected
                                      ? colors.onPrimaryContainer
                                      : colors.onSurface,
                                    fontWeight: isSelected ? '700' : '400',
                                  }}>
                                  {opt.label}
                                </AppText>
                                <MaterialCommunityIcons
                                  name={
                                    isSelected
                                      ? 'checkbox-marked'
                                      : 'checkbox-blank-outline'
                                  }
                                  size={20}
                                  color={
                                    isSelected
                                      ? colors.onPrimaryContainer
                                      : colors.onSurfaceVariant
                                  }
                                />
                              </TVFocusable>
                            );
                          })}
                        </View>
                      </View>
                    );
                  }

                  if (field.type === 'number') {
                    return (
                      <View
                        key={field.key}
                        className="rounded-2xl p-4"
                        style={{
                          backgroundColor: colors.surfaceContainerHigh,
                          borderColor: colors.outlineVariant,
                          borderWidth: 1,
                        }}>
                        <AppText
                          role="bodyLargeEmphasized"
                          style={{ color: colors.onSurface }}>
                          {field.label}
                        </AppText>
                        {field.description ? (
                          <AppText
                            role="bodySmall"
                            style={{ color: colors.onSurfaceVariant, marginTop: 2 }}>
                            {field.description}
                          </AppText>
                        ) : null}
                        <TextInput
                          value={
                            currentValue !== undefined ? String(currentValue) : ''
                          }
                          onChangeText={text => {
                            const num = Number(text);
                            handleChange(
                              field.key,
                              isNaN(num) ? undefined : num,
                            );
                          }}
                          keyboardType="numeric"
                          className="mt-3 h-12 px-3.5 rounded-xl border text-sm"
                          style={{
                            backgroundColor: colors.surfaceContainerHighest,
                            borderColor: colors.outlineVariant,
                            color: colors.onSurface,
                          }}
                        />
                      </View>
                    );
                  }

                  // Default: text
                  return (
                    <View
                      key={field.key}
                      className="rounded-2xl p-4"
                      style={{
                        backgroundColor: colors.surfaceContainerHigh,
                        borderColor: colors.outlineVariant,
                        borderWidth: 1,
                      }}>
                      <AppText
                        role="bodyLargeEmphasized"
                        style={{ color: colors.onSurface }}>
                        {field.label}
                      </AppText>
                      {field.description ? (
                        <AppText
                          role="bodySmall"
                          style={{ color: colors.onSurfaceVariant, marginTop: 2 }}>
                          {field.description}
                        </AppText>
                      ) : null}
                      <TextInput
                        value={typeof currentValue === 'string' ? currentValue : ''}
                        onChangeText={text => handleChange(field.key, text)}
                        placeholder={field.placeholder}
                        placeholderTextColor={colors.onSurfaceVariant}
                        multiline={true}
                        className="mt-3 min-h-[48px] max-h-[100px] px-3.5 py-2.5 rounded-xl border text-sm"
                        style={{
                          backgroundColor: colors.surfaceContainerHighest,
                          borderColor: colors.outlineVariant,
                          color: colors.onSurface,
                          textAlignVertical: 'top',
                        }}
                      />
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          )}

          {/* Footer Actions */}
          <TVFocusGuide style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 12, borderTopWidth: 1, borderColor: colors.outlineVariant, marginTop: 12 }}>
            <TVFocusable
              disabled={loading || fields.length === 0}
              onPress={handleResetProvider}
              accessibilityRole="button"
              accessibilityLabel="Reset provider settings to default"
              borderRadius={16}
              focusScale={1.08}
              style={{
                backgroundColor: colors.surfaceContainerHighest,
                borderRadius: 16,
                height: 48,
                width: 48,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: loading || fields.length === 0 ? 0.4 : 1,
              }}>
              <MaterialCommunityIcons
                name="restore"
                size={22}
                color={
                  loading || fields.length === 0
                    ? colors.outline
                    : colors.onSurfaceVariant
                }
              />
            </TVFocusable>

            <TVFocusable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              borderRadius={16}
              focusScale={1.03}
              style={{
                backgroundColor: colors.surfaceContainerHighest,
                borderRadius: 16,
                flex: 1,
                height: 48,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <AppText role="labelLarge" style={{ color: colors.onSurface }}>
                Cancel
              </AppText>
            </TVFocusable>

            <TVFocusable
              disabled={loading || fields.length === 0}
              onPress={handleSave}
              accessibilityRole="button"
              accessibilityLabel="Save Changes"
              borderRadius={16}
              focusScale={1.03}
              style={{
                backgroundColor:
                  loading || fields.length === 0
                    ? colors.surfaceContainerHighest
                    : colors.primary,
                borderRadius: 16,
                flex: 1,
                height: 48,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: loading || fields.length === 0 ? 0.5 : 1,
              }}>
              <AppText
                role="labelLarge"
                style={{
                  color:
                    loading || fields.length === 0
                      ? colors.onSurfaceVariant
                      : colors.onPrimary,
                }}>
                Save Changes
              </AppText>
            </TVFocusable>
          </TVFocusGuide>
        </View>
      </TVFocusGuide>
      </KeyboardAvoidingView>
    </Modal>
  );
};

export default ProviderSettingsModal;
