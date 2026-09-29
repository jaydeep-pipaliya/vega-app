import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import {
  Host,
  RNHostView,
  Shape,
  Text,
  TextField,
  type TextFieldRef,
  useNativeState,
} from '@expo/ui/jetpack-compose';
import {fillMaxWidth} from '@expo/ui/jetpack-compose/modifiers';
import React, {forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState} from 'react';
import {View, TextInput, Keyboard, Pressable, BackHandler, Text as RNText, findNodeHandle} from 'react-native';
import {useM3Colors, useM3HostTheme} from '../../theme/M3PaletteContext';
import {isTV} from '../../lib/tv';
import {useTVFocusBorderColor} from '../../lib/tv/useTVFocusBorderColor';

interface SearchFieldProps {
  value: string;
  onChangeText: (value: string) => void;
  onSubmit: (value: string) => void;
  onFocusChange?: (focused: boolean) => void;
  placeholder?: string;
  nextFocusDown?: number | null;
  nextFocusUp?: number | null;
  nextFocusLeft?: number | null;
  nextFocusRight?: number | null;
  onNodeHandle?: (handle: number | null) => void;
}

export interface SearchFieldRef {
  focus: () => void;
  blur: () => void;
  getNodeHandle: () => number | null;
}

const SearchField = forwardRef<SearchFieldRef, SearchFieldProps>(
  (
    {
      value,
      onChangeText,
      onSubmit,
      onFocusChange,
      placeholder = 'Search',
      nextFocusDown,
      nextFocusUp,
      nextFocusLeft,
      nextFocusRight,
      onNodeHandle,
    },
    ref,
  ) => {
    const colors = useM3Colors();
    const hostTheme = useM3HostTheme();
    const nativeValue = useNativeState(value);
    const fieldRef = useRef<TextFieldRef>(null);
    const tvInputRef = useRef<TextInput>(null);
    const containerRef = useRef<View>(null);
    const [tvFocused, setTvFocused] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [hasPreferredFocus, setHasPreferredFocus] = useState(true);
    const [containerHandle, setContainerHandle] = useState<number | null>(null);
    const tvFocusBorderColor = useTVFocusBorderColor();

    const exitEditingToContainer = useCallback(() => {
      Keyboard.dismiss();
      setHasPreferredFocus(true);
      setIsEditing(false);
    }, []);

    const exitEditingQuietly = useCallback(() => {
      setIsEditing(false);
      setTvFocused(false);
      onFocusChange?.(false);
    }, [onFocusChange]);

    useEffect(() => {
      if (isTV && containerRef.current && !isEditing) {
        const handle = findNodeHandle(containerRef.current);
        setContainerHandle(handle);
        onNodeHandle?.(handle);
      }
    }, [isEditing, onNodeHandle]);

    useImperativeHandle(ref, () => ({
      focus: () => {
        if (isTV) {
          (containerRef.current as any)?.focus?.();
          setTvFocused(true);
          onFocusChange?.(true);
        } else {
          fieldRef.current?.focus();
        }
      },
      blur: () => {
        if (isTV) {
          exitEditingQuietly();
          tvInputRef.current?.blur();
          (containerRef.current as any)?.blur?.();
        }
      },
      getNodeHandle: () => {
        return containerRef.current ? findNodeHandle(containerRef.current) : null;
      },
    }));

    useEffect(() => {
      if (!isTV) {
        fieldRef.current?.setText(value);
      }
    }, [value]);

    useEffect(() => {
      if (isTV && isEditing) {
        const timer = setTimeout(() => {
          tvInputRef.current?.focus();
        }, 50);
        return () => clearTimeout(timer);
      }
    }, [isEditing]);

    useEffect(() => {
      if (!isTV || !isEditing) {
        return;
      }

      const backHandler = BackHandler.addEventListener(
        'hardwareBackPress',
        () => {
          exitEditingToContainer();
          return true;
        },
      );

      const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
        exitEditingToContainer();
      });

      return () => {
        backHandler.remove();
        hideSubscription.remove();
      };
    }, [isEditing, exitEditingToContainer]);

    if (isTV) {
      if (!isEditing) {
        return (
          <Pressable
            ref={containerRef as any}
            focusable={true}
            isTVSelectable={true}
            hasTVPreferredFocus={hasPreferredFocus}
            nextFocusDown={nextFocusDown ?? undefined}
            nextFocusUp={
              nextFocusUp !== undefined
                ? (nextFocusUp ?? undefined)
                : (containerHandle ?? undefined)
            }
            nextFocusLeft={nextFocusLeft ?? undefined}
            nextFocusRight={nextFocusRight ?? undefined}
            onFocus={() => {
              setHasPreferredFocus(false);
              setTvFocused(true);
              onFocusChange?.(true);
            }}
            onBlur={() => {
              setHasPreferredFocus(false);
              setTvFocused(false);
              onFocusChange?.(false);
            }}
            onPress={() => {
              setHasPreferredFocus(false);
              setTvFocused(false);
              setIsEditing(true);
            }}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={value ? `Search query: ${value}` : placeholder}
            style={{
              width: '100%',
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: tvFocused
                ? colors.surfaceContainerHigh
                : colors.surfaceContainerLow,
              borderRadius: 999,
              borderWidth: tvFocused ? 2.5 : 1,
              borderColor: tvFocused ? tvFocusBorderColor : 'transparent',
              paddingHorizontal: 16,
              height: 52,
            }}>
            <View
              style={{
                height: 24,
                width: 24,
                marginRight: 12,
                justifyContent: 'center',
                alignItems: 'center',
              }}>
              <MaterialCommunityIcons
                name="magnify"
                size={24}
                color={tvFocused ? colors.primary : colors.onSurfaceVariant}
              />
            </View>
            <View style={{flex: 1, justifyContent: 'center'}}>
              <RNText
                numberOfLines={1}
                style={{
                  color: value ? colors.onSurface : colors.onSurfaceVariant,
                  fontSize: 16,
                }}>
                {value || placeholder}
              </RNText>
            </View>
          </Pressable>
        );
      }

      return (
        <View
          style={{
            width: '100%',
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.surfaceContainerHigh,
            borderRadius: 999,
            borderWidth: 2.5,
            borderColor: tvFocusBorderColor,
            paddingHorizontal: 16,
            height: 52,
          }}>
          <View
            style={{
              height: 24,
              width: 24,
              marginRight: 12,
              justifyContent: 'center',
              alignItems: 'center',
            }}>
            <MaterialCommunityIcons
              name="magnify"
              size={24}
              color={colors.primary}
            />
          </View>
          <TextInput
            ref={tvInputRef}
            autoFocus={true}
            value={value}
            onChangeText={onChangeText}
            onSubmitEditing={() => {
              exitEditingToContainer();
              onSubmit(value);
            }}
            onBlur={() => {
              exitEditingQuietly();
            }}
            placeholder={placeholder}
            placeholderTextColor={colors.onSurfaceVariant}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
            style={{
              flex: 1,
              color: colors.onSurface,
              fontSize: 16,
              height: '100%',
              paddingVertical: 0,
            }}
          />
        </View>
      );
    }

    return (
      <Host
        style={{width: '100%'}}
        matchContents={{vertical: true}}
        {...hostTheme}>
        <TextField
          ref={fieldRef}
          value={nativeValue}
          singleLine
          onValueChange={onChangeText}
          onFocusChanged={onFocusChange}
          keyboardOptions={{
            autoCorrectEnabled: false,
            capitalization: 'none',
            imeAction: 'search',
          }}
          keyboardActions={{onSearch: onSubmit}}
          shape={Shape.Pill({})}
          textStyle={{fontSize: 16}}
          colors={{
            focusedContainerColor: colors.surfaceContainerHigh,
            unfocusedContainerColor: colors.surfaceContainerLow,
            focusedTextColor: colors.onSurface,
            unfocusedTextColor: colors.onSurface,
            cursorColor: colors.primary,
            focusedIndicatorColor: 'transparent',
            unfocusedIndicatorColor: 'transparent',
            focusedLeadingIconColor: colors.primary,
            unfocusedLeadingIconColor: colors.onSurfaceVariant,
            focusedPlaceholderColor: colors.onSurfaceVariant,
            unfocusedPlaceholderColor: colors.onSurfaceVariant,
          }}
          modifiers={[fillMaxWidth()]}>
          <TextField.Placeholder>
            <Text color={colors.onSurfaceVariant}>{placeholder}</Text>
          </TextField.Placeholder>
          <TextField.LeadingIcon>
            <RNHostView matchContents>
              <View style={{height: 24, width: 24}}>
                <MaterialCommunityIcons
                  name="magnify"
                  size={24}
                  color={colors.onSurfaceVariant}
                />
              </View>
            </RNHostView>
          </TextField.LeadingIcon>
        </TextField>
      </Host>
    );
  },
);

export default SearchField;
