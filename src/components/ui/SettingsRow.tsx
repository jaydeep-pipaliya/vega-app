import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React, {ReactNode} from 'react';
import {findNodeHandle, Pressable, View} from 'react-native';
import {useM3Colors} from '../../theme/M3PaletteContext';
import {isTV} from '../../lib/tv';
import {TVFocusable} from '../tv';
import AppText from './Text';

import useTVNavigationStore from '../../lib/zustand/tvNavigationStore';

interface SettingsRowProps {
  title: string;
  description?: string;
  icon?: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  onPress?: () => void;
  onFocus?: () => void;
  trailing?: ReactNode;
  divider?: boolean;
  hasTVPreferredFocus?: boolean;
}

const SettingsRow = React.forwardRef<View, SettingsRowProps>(({
  title,
  description,
  icon,
  onPress,
  onFocus,
  trailing,
  divider = true,
  hasTVPreferredFocus,
}: SettingsRowProps, ref) => {
  const colors = useM3Colors();
  const internalRowRef = React.useRef<View>(null);
  const rowRef = (ref as React.RefObject<View>) || internalRowRef;
  const [rowHandle, setRowHandle] = React.useState<number | null>(null);

  const onLayout = React.useCallback(() => {
    if (rowRef.current) {
      const handle = findNodeHandle(rowRef.current);
      setRowHandle(handle);
      if (hasTVPreferredFocus && handle) {
        useTVNavigationStore.getState().setActiveScreenFocusHandle(handle);
      }
    }
  }, [rowRef, hasTVPreferredFocus]);

  const handleFocus = React.useCallback(() => {
    if (rowRef.current) {
      const handle = findNodeHandle(rowRef.current);
      if (handle) {
        useTVNavigationStore.getState().setActiveScreenFocusHandle(handle);
      }
    }
    onFocus?.();
  }, [onFocus, rowRef]);

  const renderContent = (isFocused: boolean) => (
    <View
      className="min-h-16 flex-row items-center px-4 py-3"
      style={{
        backgroundColor: isFocused
          ? colors.surfaceContainerHighest
          : 'transparent',
        borderRadius: isFocused ? 12 : 0,
        borderBottomColor: divider ? colors.outlineVariant : 'transparent',
        borderBottomWidth: divider ? 1 : 0,
      }}>
      {icon ? (
        <View
          className="mr-4 h-10 w-10 items-center justify-center rounded-full"
          style={{backgroundColor: colors.secondaryContainer}}>
          <MaterialCommunityIcons
            name={icon}
            size={21}
            color={colors.onSecondaryContainer}
            pointerEvents="none"
          />
        </View>
      ) : null}
      <View className="mr-3 flex-1">
        <AppText role="bodyLarge" className="text-m3-on-surface">
          {title}
        </AppText>
        {description ? (
          <AppText
            role="bodySmall"
            className="mt-1 text-m3-on-surface-variant">
            {description}
          </AppText>
        ) : null}
      </View>
      {trailing ??
        (onPress ? (
          <MaterialCommunityIcons
            name="chevron-right"
            size={22}
            color={colors.onSurfaceVariant}
            pointerEvents="none"
          />
        ) : null)}
    </View>
  );

  if (isTV && onPress) {
    return (
      <TVFocusable
        ref={rowRef}
        onLayout={onLayout}
        onPress={onPress}
        onFocus={handleFocus}
        hasTVPreferredFocus={hasTVPreferredFocus}
        nextFocusRight={rowHandle}
        focusScale={1.02}
        borderRadius={12}
        accessibilityRole="button"
        accessibilityLabel={title}
        style={{width: '100%'}}>
        {({focused}) => renderContent(focused)}
      </TVFocusable>
    );
  }

  if (!onPress) {
    return renderContent(false);
  }

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({pressed}) => ({
        opacity: pressed ? 0.75 : 1,
      })}>
      {renderContent(false)}
    </Pressable>
  );
});

export default React.memo(SettingsRow);
