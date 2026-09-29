import {MaterialCommunityIcons} from '@expo/vector-icons';
import React, {useEffect, useState} from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  TextInput,
  View,
} from 'react-native';
import Text from '../../../components/ui/Text';
import {TVFocusable} from '../../../components/tv';
import {socialLinks} from '../../../lib/constants';
import {useM3Colors} from '../../../theme/M3PaletteContext';
import {readableOnColor} from '../../../theme/seeds';
import {useTVFocusBorderColor} from '../../../lib/tv/useTVFocusBorderColor';
import {isTV} from '../../../lib/tv';

interface AddSourceModalProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (value: string) => void;
}

export const AddSourceModal: React.FC<AddSourceModalProps> = ({
  visible,
  onClose,
  onAdd,
}) => {
  const colors = useM3Colors();
  const focusBorderColor = useTVFocusBorderColor();
  const [inputValue, setInputValue] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isInputFocused, setIsInputFocused] = useState(false);

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

  const handleClose = () => {
    setInputValue('');
    onClose();
  };

  const handleConfirm = () => {
    const trimmed = inputValue.trim();
    if (trimmed) {
      onAdd(trimmed);
      setInputValue('');
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={handleClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 justify-center items-center bg-black/60 px-4"
        style={{
          paddingBottom: Platform.OS === 'android' ? keyboardHeight : 0,
        }}>
        <Pressable
          focusable={false}
          accessible={false}
          importantForAccessibility="no"
          style={{position: 'absolute', top: 0, bottom: 0, left: 0, right: 0}}
          onPress={() => {
            if (keyboardHeight > 0) {
              Keyboard.dismiss();
            } else {
              handleClose();
            }
          }}
        />
        <View
          style={{
            backgroundColor: colors.surfaceContainerHigh,
            borderRadius: 28,
            maxWidth: 420,
            overflow: 'hidden',
            padding: 24,
            width: 340,
          }}>
          <View className="flex-row items-center justify-between mb-3">
            <Text
              className="text-base font-semibold w-fit"
              style={{color: colors.onSurface}}
              numberOfLines={1}>
              Add Source
            </Text>
            <TVFocusable
              hasTVPreferredFocus={isTV}
              accessibilityRole="button"
              accessibilityLabel="Close add source dialog"
              onPress={handleClose}
              borderRadius={14}
              focusScale={1.1}
              style={{
                height: 40,
                width: 40,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.surfaceContainerHighest,
                borderRadius: 14,
              }}>
              <MaterialCommunityIcons
                name="close"
                size={22}
                color={colors.onSurfaceVariant}
              />
            </TVFocusable>
          </View>
          <Text className="text-sm font-medium" style={{color: colors.onSurface}}>
            Enter url of your hosted provider source or GitHub author
          </Text>
          <Text
            className="text-sm mt-[4px]"
            style={{color: colors.onSurfaceVariant, lineHeight: 20}}>
            How to create provider{' '}
            <Text
              accessibilityRole="link"
              style={{color: '#38BDF8', fontSize: 14, lineHeight: 20}}
              onPress={() => Linking.openURL(socialLinks.github + '#vega-app')}>
              here
            </Text>
          </Text>
          <Text
            className="text-sm mt-[4px]"
            style={{color: colors.onSurfaceVariant, lineHeight: 20}}>
            or join Discord for support{' '}
            <Text
              accessibilityRole="link"
              style={{color: '#38BDF8', fontSize: 14, lineHeight: 20}}
              onPress={() => Linking.openURL(socialLinks.discord)}>
              Discord
            </Text>
          </Text>
          <TextInput
            className="h-14 px-4 mt-4"
            focusable={true}
            onFocus={() => setIsInputFocused(true)}
            onBlur={() => setIsInputFocused(false)}
            style={{
              backgroundColor: colors.surfaceContainerHighest,
              borderColor: isInputFocused ? focusBorderColor : colors.outlineVariant,
              borderRadius: 18,
              borderWidth: isInputFocused ? 2.5 : 1,
              color: colors.onSurface,
            }}
            placeholder="GitHub author or source URL"
            placeholderTextColor={colors.onSurfaceVariant}
            selectionColor={colors.primary}
            value={inputValue}
            onChangeText={setInputValue}
            onSubmitEditing={handleConfirm}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <View className="flex-row gap-2 mt-4">
            <TVFocusable
              accessibilityRole="button"
              onPress={handleClose}
              borderRadius={16}
              focusScale={1.05}
              style={{
                height: 48,
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.surfaceContainerHighest,
                borderRadius: 16,
              }}>
              <Text className="font-medium" style={{color: colors.onSurface}}>
                Cancel
              </Text>
            </TVFocusable>

            <TVFocusable
              accessibilityRole="button"
              onPress={handleConfirm}
              borderRadius={16}
              focusScale={1.05}
              style={{
                height: 48,
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.primary,
                borderRadius: 16,
              }}>
              <Text
                className="font-medium"
                style={{color: readableOnColor(colors.primary)}}>
                Confirm
              </Text>
            </TVFocusable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};
