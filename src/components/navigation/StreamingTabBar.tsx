import type {BottomTabBarProps} from '@react-navigation/bottom-tabs';
import React, {useState} from 'react';
import {
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  View,
  findNodeHandle,
} from 'react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {settingsStorage} from '../../lib/storage';
import {useM3Colors} from '../../theme/M3PaletteContext';
import AppText from '../ui/Text';
import {AnimatedTabIcon, type AnimatedTabIconName} from './AnimatedTabIcon';
import {isTV} from '../../lib/tv/constants';
import {useTVFocusBorderColor} from '../../lib/tv/useTVFocusBorderColor';

const TAB_ICONS: Record<string, AnimatedTabIconName> = {
  HomeStack: 'home',
  SearchStack: 'search',
  WatchListStack: 'watchlist',
  DownloadsStack: 'download',
  SettingsStack: 'settings',
};

interface TabButtonProps {
  routeKey: string;
  routeName: string;
  isFocused: boolean;
  label: string;
  icon: AnimatedTabIconName;
  accessibilityLabel?: string;
  isNavigationRail: boolean;
  showLabels: boolean;
  colors: any;
  onPress: () => void;
  onLongPress: () => void;
}

import {TVFocusable} from '../tv';

import useTVNavigationStore, {
  selectRailFocusHandle,
} from '../../lib/zustand/tvNavigationStore';

const StreamingTabButton = ({
  routeKey,
  routeName,
  isFocused,
  label,
  icon,
  accessibilityLabel,
  isNavigationRail,
  showLabels,
  colors,
  onPress,
  onLongPress,
}: TabButtonProps) => {
  const focusBorderColor = useTVFocusBorderColor();
  const railFocusHandle = useTVNavigationStore(selectRailFocusHandle);
  const tabRef = React.useRef<View>(null);
  const [tabHandle, setTabHandle] = useState<number | null>(null);

  if (isTV) {
    return (
      <TVFocusable
        ref={tabRef}
        registerScreenFocus={false}
        onLayout={() => {
          if (tabRef.current) {
            setTabHandle(findNodeHandle(tabRef.current));
          }
        }}
        nextFocusLeft={tabHandle}
        nextFocusRight={railFocusHandle ?? undefined}
        key={routeKey}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel || label}
        onPress={onPress}
        onLongPress={onLongPress}
        focusScale={1.08}
        showFocusBorder={false}
        style={{
          alignItems: 'center',
          height: showLabels ? 72 : 56,
          justifyContent: 'center',
          minWidth: 48,
          width: 88,
          marginVertical: 4,
        }}>
        {({focused}) => (
          <>
            <View
              pointerEvents="none"
              style={{
                alignItems: 'center',
                backgroundColor: isFocused
                  ? colors.secondaryContainer
                  : focused
                    ? colors.surfaceContainerHighest
                    : 'transparent',
                borderColor: focused ? focusBorderColor : 'transparent',
                borderWidth: focused ? 2.5 : 0,
                borderRadius: 16,
                height: 34,
                justifyContent: 'center',
                overflow: 'hidden',
                width: 58,
              }}>
              <AnimatedTabIcon
                name={icon}
                active={isFocused || focused}
                color={
                  isFocused
                    ? colors.onSecondaryContainer
                    : focused
                      ? colors.onSurface
                      : colors.onSurfaceVariant
                }
                size={24}
              />
            </View>
            {showLabels ? (
              <AppText
                role={isFocused || focused ? 'labelMediumEmphasized' : 'labelMedium'}
                numberOfLines={1}
                style={{
                  color: isFocused || focused ? colors.onSurface : colors.onSurfaceVariant,
                  marginTop: 4,
                  textAlign: 'center',
                  fontWeight: focused ? '700' : isFocused ? '600' : '400',
                }}>
                {label}
              </AppText>
            ) : null}
          </>
        )}
      </TVFocusable>
    );
  }

  return (
    <TouchableOpacity
      key={routeKey}
      accessibilityRole="button"
      accessibilityState={isFocused ? {selected: true} : {}}
      accessibilityLabel={accessibilityLabel}
      activeOpacity={0.85}
      onLongPress={onLongPress}
      onPress={onPress}
      style={{
        alignItems: 'center',
        flex: isNavigationRail ? undefined : 1,
        height: isNavigationRail
          ? showLabels
            ? 72
            : 56
          : showLabels
            ? 58
            : 42,
        justifyContent: 'center',
        minWidth: 48,
        width: isNavigationRail ? 88 : undefined,
      }}>
      <View
        pointerEvents="none"
        style={{
          alignItems: 'center',
          backgroundColor: isFocused
            ? colors.secondaryContainer
            : 'transparent',
          borderRadius: 16,
          height: 34,
          justifyContent: 'center',
          overflow: 'hidden',
          width: 58,
        }}>
        <AnimatedTabIcon
          name={icon}
          active={isFocused}
          color={
            isFocused
              ? colors.onSecondaryContainer
              : colors.onSurfaceVariant
          }
          size={24}
        />
      </View>
      {showLabels ? (
        <AppText
          role={isFocused ? 'labelMediumEmphasized' : 'labelMedium'}
          numberOfLines={1}
          style={{
            color: isFocused ? colors.onSurface : colors.onSurfaceVariant,
            marginTop: 4,
            textAlign: 'center',
            fontWeight: isFocused ? '600' : '400',
          }}>
          {label}
        </AppText>
      ) : null}
    </TouchableOpacity>
  );
};

const StreamingTabBar = ({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps) => {
  const colors = useM3Colors();
  const insets = useSafeAreaInsets();
  const {width: windowWidth, height: windowHeight} = useWindowDimensions();
  const isNavigationRail = isTV || Math.min(windowWidth, windowHeight) >= 600;
  const showLabels = settingsStorage.showTabBarLabels();
  const bottomBarPadding = Math.max(insets.bottom, 8);
  const activeTabKey = state.routes[state.index]?.key ?? null;

  React.useLayoutEffect(() => {
    useTVNavigationStore.getState().setActiveTabKey(activeTabKey);
  }, [activeTabKey]);

  return (
    <View
      style={{
        backgroundColor: colors.surfaceContainerHigh,
        borderRightColor: isNavigationRail ? colors.outlineVariant : undefined,
        borderRightWidth: isNavigationRail ? StyleSheet.hairlineWidth : 0,
        height: isNavigationRail ? '100%' : undefined,
        paddingBottom: isNavigationRail
          ? Math.max(insets.bottom, 12)
          : bottomBarPadding,
        paddingLeft: isNavigationRail ? insets.left : 4,
        paddingRight: 4,
        paddingTop: isNavigationRail ? Math.max(insets.top, 16) : 6,
        width: isNavigationRail ? 96 + insets.left : undefined,
      }}>
      <View
        style={{
          alignItems: isNavigationRail ? 'center' : undefined,
          flex: isNavigationRail ? 1 : undefined,
          flexDirection: isNavigationRail ? 'column' : 'row',
          gap: isNavigationRail ? 8 : undefined,
          height: isNavigationRail ? undefined : showLabels ? 58 : 42,
        }}>
        {state.routes.map((route, index) => {
          const descriptor = descriptors[route.key];
          const focused = state.index === index;
          const label =
            typeof descriptor.options.tabBarLabel === 'string'
              ? descriptor.options.tabBarLabel
              : typeof descriptor.options.title === 'string'
                ? descriptor.options.title
                : route.name;
          const icon = TAB_ICONS[route.name] ?? 'home';

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              if (settingsStorage.isHapticFeedbackEnabled()) {
                ReactNativeHapticFeedback.trigger('effectTick', {
                  enableVibrateFallback: true,
                  ignoreAndroidSystemSettings: false,
                });
              }
              navigation.navigate(route.name, route.params);
            }
          };

          return (
            <StreamingTabButton
              key={route.key}
              routeKey={route.key}
              routeName={route.name}
              isFocused={focused}
              label={label}
              icon={icon}
              accessibilityLabel={descriptor.options.tabBarAccessibilityLabel}
              isNavigationRail={isNavigationRail}
              showLabels={showLabels}
              colors={colors}
              onPress={onPress}
              onLongPress={() =>
                navigation.emit({type: 'tabLongPress', target: route.key})
              }
            />
          );
        })}
      </View>
    </View>
  );
};

export default StreamingTabBar;
