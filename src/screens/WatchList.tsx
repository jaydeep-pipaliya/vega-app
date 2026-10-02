import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {StatusBar} from 'expo-status-bar';
import React, {useCallback, useEffect, useState} from 'react';
import {
  BackHandler,
  Dimensions,
  FlatList,
  Platform,
  View,
  findNodeHandle,
} from 'react-native';
import ReactNativeHapticFeedback, {
  HapticFeedbackTypes,
} from 'react-native-haptic-feedback';
import type {WatchListStackParamList} from '../App';
import MediaPosterCard from '../components/MediaPosterCard';
import AppText from '../components/ui/Text';
import type {WatchListItem} from '../lib/storage';
import {settingsStorage} from '../lib/storage';
import {syncFromSharedFolder} from '../lib/sync/syncService';
import {showAppDialog} from '../lib/zustand/appDialogStore';
import useWatchListStore from '../lib/zustand/watchListStore';
import {useM3Colors} from '../theme/M3PaletteContext';
import {isTV} from '../lib/tv';
import {TVFocusable, TVFocusGuide} from '../components/tv';
import {useTVFocusBorderColor} from '../lib/tv/useTVFocusBorderColor';
import useTVNavigationStore from '../lib/zustand/tvNavigationStore';

const WatchList = () => {
  const colors = useM3Colors();
  const focusBorderColor = useTVFocusBorderColor();
  const navigation =
    useNavigation<NativeStackNavigationProp<WatchListStackParamList>>();
  const watchList = useWatchListStore(state => state.watchList);
  const removeItem = useWatchListStore(state => state.removeItem);
  const [selectedLinks, setSelectedLinks] = useState<Set<string>>(new Set());
  const [isSelectionModeActive, setIsSelectionModeActive] = useState(false);

  const selectButtonRef = React.useRef<View>(null);
  const firstCardRef = React.useRef<View>(null);
  // Claim focus for the first card only until a card has had focus, so
  // leaving selection mode or a list remount does not pull focus back.
  const [initialCardFocused, setInitialCardFocused] = useState(false);
  const [selectButtonNode, setSelectButtonNode] = useState<number | null>(null);
  const [firstCardNode, setFirstCardNode] = useState<number | null>(null);

  const updateSelectButtonNode = useCallback(() => {
    if (selectButtonRef.current) {
      const handle = findNodeHandle(selectButtonRef.current);
      if (handle) {
        setSelectButtonNode(handle);
      }
    }
  }, []);

  const updateFirstCardNode = useCallback(() => {
    if (firstCardRef.current) {
      const handle = findNodeHandle(firstCardRef.current);
      if (handle) {
        setFirstCardNode(handle);
      }
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      updateSelectButtonNode();
      updateFirstCardNode();
    }, 150);
    return () => clearTimeout(t);
  }, [
    watchList.length,
    isSelectionModeActive,
    selectedLinks.size,
    updateSelectButtonNode,
    updateFirstCardNode,
  ]);

  const isSelectionMode = isSelectionModeActive || selectedLinks.size > 0;

  useFocusEffect(
    useCallback(() => {
      if (!isTV) return;
      const handle = watchList.length > 0
        ? firstCardNode ?? selectButtonNode
        : null;
      useTVNavigationStore.getState().setActiveScreenFocusHandle(handle);
      // The card focused before opening Info restores itself on return.
      return () => {
        const store = useTVNavigationStore.getState();
        if (store.activeScreenFocusHandle === handle) {
          store.setActiveScreenFocusHandle(null);
        }
      };
    }, [watchList.length, firstCardNode, selectButtonNode]),
  );

  useFocusEffect(
    useCallback(() => {
      syncFromSharedFolder().catch(e =>
        console.warn('[VegaSync] WatchList sync failed:', e),
      );
    }, []),
  );

  useEffect(() => {
    if (!isSelectionMode) return;
    const backSub = BackHandler.addEventListener('hardwareBackPress', () => {
      handleExitSelection();
      return true;
    });
    return () => backSub.remove();
  }, [isSelectionMode]);

  const triggerHaptic = (
    type: HapticFeedbackTypes = HapticFeedbackTypes.effectTick,
  ) => {
    if (settingsStorage.isHapticFeedbackEnabled()) {
      ReactNativeHapticFeedback.trigger(type, {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });
    }
  };

  const handleCardPress = (item: WatchListItem) => {
    if (isSelectionMode) {
      triggerHaptic(HapticFeedbackTypes.effectTick);
      setSelectedLinks(prev => {
        const next = new Set(prev);
        if (next.has(item.link)) {
          next.delete(item.link);
        } else {
          next.add(item.link);
        }
        return next;
      });
    } else {
      navigation.navigate('Info', {
        link: item.link,
        provider: item.provider,
        poster: item.poster,
      });
    }
  };

  const handleCardLongPress = (item: WatchListItem) => {
    triggerHaptic(HapticFeedbackTypes.impactMedium);
    setIsSelectionModeActive(true);
    setSelectedLinks(prev => {
      const next = new Set(prev);
      if (next.has(item.link)) {
        next.delete(item.link);
      } else {
        next.add(item.link);
      }
      return next;
    });
  };

  const handleExitSelection = () => {
    triggerHaptic(HapticFeedbackTypes.effectClick);
    setSelectedLinks(new Set());
    setIsSelectionModeActive(false);
  };

  const handleToggleSelectAll = () => {
    triggerHaptic(HapticFeedbackTypes.effectClick);
    if (selectedLinks.size === watchList.length) {
      setSelectedLinks(new Set());
    } else {
      setSelectedLinks(new Set(watchList.map(item => item.link)));
    }
  };

  const handleInvertSelection = () => {
    triggerHaptic(HapticFeedbackTypes.effectClick);
    setSelectedLinks(prev => {
      const next = new Set<string>();
      watchList.forEach(item => {
        if (!prev.has(item.link)) {
          next.add(item.link);
        }
      });
      return next;
    });
  };

  const handleDeletePress = () => {
    if (selectedLinks.size === 0) return;

    triggerHaptic(HapticFeedbackTypes.effectHeavyClick);
    const count = selectedLinks.size;

    showAppDialog({
      title: `Remove from Watchlist?`,
      message: `Are you sure you want to remove ${count} ${
        count === 1 ? 'title' : 'titles'
      } from your watchlist?`,
      variant: 'warning',
      actions: [
        {label: 'Cancel'},
        {
          label: 'Remove',
          variant: 'destructive',
          onPress: () => {
            selectedLinks.forEach(link => {
              removeItem(link);
            });
            setSelectedLinks(new Set());
            setIsSelectionModeActive(false);
          },
        },
      ],
    });
  };

  const isAllSelected =
    watchList.length > 0 && selectedLinks.size === watchList.length;

  // Calculate how many items can fit per row
  const screenWidth = Dimensions.get('window').width;
  const containerPadding = 12;
  const itemSpacing = 10;
  const availableWidth = screenWidth - containerPadding * 2;
  const targetItemWidth = isTV ? 160 : 100;
  const numColumns = Math.floor(
    (availableWidth + itemSpacing) / (targetItemWidth + itemSpacing),
  );
  const itemWidth =
    (availableWidth - itemSpacing * (numColumns - 1)) / numColumns;

  return (
    <TVFocusGuide
      trapFocusRight={true}
      trapFocusDown={true}
      trapFocusUp={true}
      style={{flex: 1, backgroundColor: colors.background}}>
      <StatusBar />

      {/* Top Selection Header Toolbar */}
      {isSelectionMode ? (
        <View
          style={{
            alignItems: 'center',
            backgroundColor: colors.surfaceContainerHigh,
            borderBottomColor: colors.outlineVariant,
            borderBottomWidth: 1,
            flexDirection: 'row',
            justifyContent: 'space-between',
            paddingBottom: 12,
            paddingLeft: isTV ? 20 : 16,
            paddingRight: isTV ? 48 : 16,
            paddingTop: Platform.OS === 'android' ? (isTV ? 20 : 36) : 14,
            zIndex: 10,
          }}>
          <View style={{alignItems: 'center', flexDirection: 'row', gap: 16}}>
            <TVFocusable
              hasTVPreferredFocus={isTV}
              accessibilityRole="button"
              accessibilityLabel="Exit selection"
              onPress={handleExitSelection}
              borderRadius={20}
              focusScale={1.1}
              focusBorderColor={focusBorderColor}
              style={{
                alignItems: 'center',
                borderRadius: 20,
                justifyContent: 'center',
                minHeight: 40,
                minWidth: 40,
                padding: 4,
              }}>
              <MaterialCommunityIcons
                name="close"
                size={26}
                color={colors.onSurface}
              />
            </TVFocusable>
            <AppText
              role="titleLargeEmphasized"
              style={{color: colors.onSurface}}>
              {selectedLinks.size} selected
            </AppText>
          </View>

          <View style={{alignItems: 'center', flexDirection: 'row', gap: 12}}>
            <TVFocusable
              accessibilityRole="button"
              accessibilityLabel="Invert selection"
              onPress={handleInvertSelection}
              borderRadius={20}
              focusScale={1.1}
              focusBorderColor={focusBorderColor}
              style={{
                alignItems: 'center',
                borderRadius: 20,
                justifyContent: 'center',
                minHeight: 40,
                minWidth: 40,
                padding: 4,
              }}>
              <MaterialCommunityIcons
                name="select-inverse"
                size={24}
                color={colors.onSurfaceVariant}
              />
            </TVFocusable>
            <TVFocusable
              accessibilityRole="button"
              accessibilityLabel="Select all"
              onPress={handleToggleSelectAll}
              borderRadius={20}
              focusScale={1.1}
              focusBorderColor={focusBorderColor}
              style={{
                alignItems: 'center',
                borderRadius: 20,
                justifyContent: 'center',
                minHeight: 40,
                minWidth: 40,
                padding: 4,
              }}>
              <MaterialIcons
                name="select-all"
                size={24}
                color={isAllSelected ? colors.primary : colors.onSurface}
              />
            </TVFocusable>
          </View>
        </View>
      ) : (
        <View
          className="w-full bg-m3-background"
          style={{
            paddingTop: Platform.OS === 'android' ? (isTV ? 4 : 15) : 0,
          }}
        />
      )}

      <View className="flex-1 w-full px-3">
        {!isSelectionMode ? (
          <View
            style={{
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'space-between',
              marginBottom: 16,
              marginTop: isTV ? 16 : 8,
              paddingLeft: isTV ? 12 : 6,
              paddingRight: isTV ? 48 : 6,
            }}>
            <AppText
              role="headlineLargeEmphasized"
              className="text-m3-on-background">
              Watchlist
            </AppText>
            {watchList.length > 0 ? (
              <TVFocusable
                ref={selectButtonRef}
                onLayout={updateSelectButtonNode}
                accessibilityRole="button"
                accessibilityLabel="Select items"
                nextFocusRight={selectButtonNode ?? undefined}
                nextFocusUp={selectButtonNode ?? undefined}
                nextFocusDown={firstCardNode ?? undefined}
                nextFocusLeft={firstCardNode ?? undefined}
                onPress={() => {
                  triggerHaptic(HapticFeedbackTypes.effectClick);
                  setIsSelectionModeActive(true);
                }}
                borderRadius={18}
                focusScale={1.08}
                focusBorderColor={focusBorderColor}
                style={{
                  alignItems: 'center',
                  backgroundColor: colors.surfaceContainerHigh,
                  borderRadius: 18,
                  flexDirection: 'row',
                  gap: 6,
                  justifyContent: 'center',
                  minHeight: 36,
                  paddingHorizontal: 14,
                }}>
                <MaterialCommunityIcons
                  name="checkbox-multiple-marked-outline"
                  size={18}
                  color={colors.primary}
                />
                <AppText
                  role="labelLargeEmphasized"
                  style={{color: colors.primary}}>
                  Select
                </AppText>
              </TVFocusable>
            ) : null}
          </View>
        ) : null}

        {watchList.length > 0 ? (
          <FlatList
            key={`watchlist-cols-${numColumns}`}
            data={watchList}
            renderItem={({item, index}) => {
              const isTopRow = index < numColumns;
              const isLastItem = index === watchList.length - 1;
              const isRightmostInRow = (index + 1) % numColumns === 0;

              return (
                <MediaPosterCard
                  ref={index === 0 ? firstCardRef : undefined}
                  onLayout={index === 0 ? updateFirstCardNode : undefined}
                  title={item.title}
                  poster={item.poster}
                  width={itemWidth}
                  selected={selectedLinks.has(item.link)}
                  selectionMode={isSelectionMode}
                  hasTVPreferredFocus={
                    isTV && !isSelectionMode && index === 0 && !initialCardFocused
                  }
                  onFocus={
                    initialCardFocused
                      ? undefined
                      : () => setInitialCardFocused(true)
                  }
                  nextFocusUp={
                    isTopRow ? (selectButtonNode ?? undefined) : undefined
                  }
                  nextFocusRight={
                    isLastItem || (isTopRow && isRightmostInRow)
                      ? (selectButtonNode ?? undefined)
                      : undefined
                  }
                  onPress={() => handleCardPress(item)}
                  onLongPress={() => handleCardLongPress(item)}
                />
              );
            }}
            keyExtractor={(item, index) => item.link + index}
            numColumns={numColumns}
            columnWrapperStyle={{
              gap: itemSpacing,
              justifyContent: 'flex-start',
            }}
            contentContainerStyle={{
              paddingTop: isSelectionMode ? 14 : 0,
              paddingBottom: isSelectionMode ? 120 : 50,
            }}
            removeClippedSubviews={false}
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <View className="flex-1">
            <View className="items-center justify-center mt-20 mb-12">
              <MaterialCommunityIcons
                name="bookmark-off-outline"
                size={72}
                color={colors.onSurfaceVariant}
              />
              <AppText
                role="bodyLarge"
                className="mt-4 text-center text-m3-on-surface-variant">
                Your watchlist is empty
              </AppText>
            </View>
          </View>
        )}
      </View>

      {/* Bottom Action Bar in Selection Mode */}
      {isSelectionMode ? (
        <View
          style={{
            bottom: isTV ? 20 : 24,
            left: isTV ? 24 : 16,
            position: 'absolute',
            right: isTV ? 48 : 16,
            zIndex: 20,
          }}>
          <View
            style={{
              alignItems: 'center',
              backgroundColor: colors.surfaceContainerHighest,
              borderColor: colors.outlineVariant,
              borderRadius: 24,
              borderWidth: 1,
              elevation: 8,
              flexDirection: 'row',
              justifyContent: 'space-between',
              paddingHorizontal: 16,
              paddingVertical: 10,
              shadowColor: '#000',
              shadowOffset: {width: 0, height: 4},
              shadowOpacity: 0.35,
              shadowRadius: 10,
            }}>
            <View style={{alignItems: 'center', flexDirection: 'row', gap: 16}}>
              <TVFocusable
                accessibilityRole="button"
                accessibilityLabel="Select all"
                onPress={handleToggleSelectAll}
                borderRadius={18}
                focusScale={1.1}
                focusBorderColor={focusBorderColor}
                style={{
                  alignItems: 'center',
                  borderRadius: 18,
                  justifyContent: 'center',
                  minHeight: 36,
                  minWidth: 36,
                  padding: 4,
                }}>
                <MaterialIcons
                  name="select-all"
                  size={24}
                  color={isAllSelected ? colors.primary : colors.onSurfaceVariant}
                />
              </TVFocusable>
              <TVFocusable
                accessibilityRole="button"
                accessibilityLabel="Invert selection"
                onPress={handleInvertSelection}
                borderRadius={18}
                focusScale={1.1}
                focusBorderColor={focusBorderColor}
                style={{
                  alignItems: 'center',
                  borderRadius: 18,
                  justifyContent: 'center',
                  minHeight: 36,
                  minWidth: 36,
                  padding: 4,
                }}>
                <MaterialCommunityIcons
                  name="select-inverse"
                  size={24}
                  color={colors.onSurfaceVariant}
                />
              </TVFocusable>
              <AppText
                role="labelMediumEmphasized"
                style={{color: colors.onSurfaceVariant}}>
                {selectedLinks.size} selected
              </AppText>
            </View>

            <TVFocusable
              accessibilityRole="button"
              accessibilityLabel="Remove selected items"
              disabled={selectedLinks.size === 0}
              onPress={handleDeletePress}
              borderRadius={16}
              focusScale={1.06}
              focusBorderColor={focusBorderColor}
              style={{
                alignItems: 'center',
                backgroundColor:
                  selectedLinks.size > 0
                    ? colors.errorContainer
                    : colors.surfaceContainerHigh,
                borderRadius: 16,
                flexDirection: 'row',
                gap: 6,
                opacity: selectedLinks.size === 0 ? 0.45 : 1,
                paddingHorizontal: 16,
                paddingVertical: 10,
              }}>
              <MaterialCommunityIcons
                name="trash-can-outline"
                size={20}
                color={
                  selectedLinks.size > 0
                    ? colors.onErrorContainer
                    : colors.onSurfaceVariant
                }
              />
              <AppText
                role="labelLargeEmphasized"
                style={{
                  color:
                    selectedLinks.size > 0
                      ? colors.onErrorContainer
                      : colors.onSurfaceVariant,
                  fontWeight: '700',
                }}>
                Remove
              </AppText>
            </TVFocusable>
          </View>
        </View>
      ) : null}
    </TVFocusGuide>
  );
};

export default WatchList;
