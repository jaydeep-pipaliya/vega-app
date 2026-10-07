import React, {useLayoutEffect, useState} from 'react';
import {LayoutChangeEvent, Text, View} from 'react-native';
import {Gesture, GestureDetector} from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import {MaterialIcons} from '@expo/vector-icons';
import type {ProviderExtension} from '../lib/storage/extensionStorage';
import {settingsStorage} from '../lib/storage/SettingsStorage';
import useContentStore from '../lib/zustand/contentStore';
import {moveItem, providerOrderKey} from '../lib/providerOrder';
import ProviderIcon from './ProviderIcon';

const LONG_PRESS_MS = 300;
const SETTLE_MS = 120;

interface ReorderableProviderListProps {
  providers: ProviderExtension[];
  selectedValue: string;
  primary: string;
  onSelect: (provider: ProviderExtension) => void;
}

/**
 * Provider rows for the phone drawer. Tap selects; hold a row, then drag it
 * up or down to change the order. The order is saved and used everywhere the
 * installed providers are listed.
 */
const ReorderableProviderList = ({
  providers,
  selectedValue,
  primary,
  onSelect,
}: ReorderableProviderListProps) => {
  const [order, setOrder] = useState(providers);
  const rowHeight = useSharedValue(56);
  const dragFrom = useSharedValue(-1);
  const dragY = useSharedValue(0);

  // Follow installs, removals and updates made elsewhere.
  useLayoutEffect(() => setOrder(providers), [providers]);

  // Rows already sit in their new places when the drag settles, so the
  // offsets are cleared only once the new order has rendered.
  useLayoutEffect(() => {
    dragFrom.value = -1;
    dragY.value = 0;
  }, [order, dragFrom, dragY]);

  const commit = (from: number, to: number) => {
    if (from === to) {
      dragFrom.value = -1;
      dragY.value = 0;
      return;
    }
    const next = moveItem(order, from, to);
    setOrder(next);
    settingsStorage.setProviderOrder(next.map(providerOrderKey));
    useContentStore.getState().setInstalledProviders(next);
  };

  const onRowLayout = (event: LayoutChangeEvent) => {
    rowHeight.value = event.nativeEvent.layout.height;
  };

  return (
    <>
      {order.map((item, index) => (
        <ProviderRow
          key={providerOrderKey(item)}
          item={item}
          index={index}
          count={order.length}
          isSelected={item.value === selectedValue}
          primary={primary}
          rowHeight={rowHeight}
          dragFrom={dragFrom}
          dragY={dragY}
          onSelect={onSelect}
          onDrop={commit}
          onLayout={index === 0 ? onRowLayout : undefined}
        />
      ))}
    </>
  );
};

interface ProviderRowProps {
  item: ProviderExtension;
  index: number;
  count: number;
  isSelected: boolean;
  primary: string;
  rowHeight: SharedValue<number>;
  dragFrom: SharedValue<number>;
  dragY: SharedValue<number>;
  onSelect: (provider: ProviderExtension) => void;
  onDrop: (from: number, to: number) => void;
  onLayout?: (event: LayoutChangeEvent) => void;
}

const triggerHaptic = () => {
  if (settingsStorage.isHapticFeedbackEnabled()) {
    ReactNativeHapticFeedback.trigger('effectHeavyClick', {
      enableVibrateFallback: true,
      ignoreAndroidSystemSettings: false,
    });
  }
};

const ProviderRow = ({
  item,
  index,
  count,
  isSelected,
  primary,
  rowHeight,
  dragFrom,
  dragY,
  onSelect,
  onDrop,
  onLayout,
}: ProviderRowProps) => {
  const pressed = useSharedValue(0);

  const targetIndex = () => {
    'worklet';
    const to = Math.round(dragFrom.value + dragY.value / rowHeight.value);
    return Math.max(0, Math.min(count - 1, to));
  };

  const pan = Gesture.Pan()
    .activateAfterLongPress(LONG_PRESS_MS)
    .onStart(() => {
      dragFrom.value = index;
      dragY.value = 0;
      runOnJS(triggerHaptic)();
    })
    .onUpdate(event => {
      dragY.value = event.translationY;
    })
    .onEnd(() => {
      const from = dragFrom.value;
      const to = targetIndex();
      // Slide into the free slot, then save the new order.
      dragY.value = withTiming(
        (to - from) * rowHeight.value,
        {duration: SETTLE_MS},
        finished => {
          if (finished) runOnJS(onDrop)(from, to);
        },
      );
    })
    .onFinalize((_event, success) => {
      // A cancelled drag (another gesture took over) puts the row back.
      if (!success && dragFrom.value === index) {
        dragFrom.value = -1;
        dragY.value = 0;
      }
    });

  const tap = Gesture.Tap()
    .onBegin(() => {
      pressed.value = 1;
    })
    .onEnd(() => {
      runOnJS(onSelect)(item);
    })
    .onFinalize(() => {
      pressed.value = 0;
    });

  // A hold that turns into a drag never also selects the row.
  const gesture = Gesture.Exclusive(pan, tap);

  const rowStyle = useAnimatedStyle(() => {
    const from = dragFrom.value;
    if (from < 0) {
      return {transform: [{translateY: 0}, {scale: 1}], zIndex: 0};
    }
    if (from === index) {
      return {
        transform: [{translateY: dragY.value}, {scale: 1.02}],
        zIndex: 10,
      };
    }
    // Rows between the old and new slot make room for the dragged one.
    const to = targetIndex();
    let shift = 0;
    if (from < to && index > from && index <= to) shift = -rowHeight.value;
    if (from > to && index < from && index >= to) shift = rowHeight.value;
    return {
      transform: [
        {translateY: withTiming(shift, {duration: SETTLE_MS})},
        {scale: 1},
      ],
      zIndex: 0,
    };
  });

  const backgroundStyle = useAnimatedStyle(() => {
    const lifted = dragFrom.value === index;
    let opacity = isSelected ? 0.1 : 0;
    if (pressed.value) opacity = Math.max(opacity, 0.06);
    if (lifted) opacity = 0.16;
    return {backgroundColor: `rgba(255, 255, 255, ${opacity})`};
  });

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        onLayout={onLayout}
        style={[{paddingVertical: 2}, rowStyle]}
        accessibilityRole="button"
        accessibilityLabel={item.display_name}
        accessibilityHint="Hold and drag to reorder"
        accessibilityState={{selected: isSelected}}>
        <Animated.View
          style={[
            {
              alignItems: 'center',
              borderRadius: 8,
              flexDirection: 'row',
              justifyContent: 'space-between',
              paddingHorizontal: 16,
              paddingVertical: 14,
            },
            backgroundStyle,
          ]}>
          <View style={{alignItems: 'center', flexDirection: 'row', flex: 1}}>
            <ProviderIcon
              uri={item.icon}
              name={item.display_name}
              size={20}
              background="rgba(255, 255, 255, 0.08)"
              color={isSelected ? primary : '#888'}
            />
            <Text
              numberOfLines={1}
              className={`ml-2.5 text-[15.5px] ${
                isSelected ? 'text-white font-medium' : 'text-gray-400'
              }`}
              style={{flexShrink: 1}}>
              {item.display_name}
            </Text>
          </View>
          {isSelected && (
            <MaterialIcons name="check" size={20} color={primary} />
          )}
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
};

export default ReorderableProviderList;
