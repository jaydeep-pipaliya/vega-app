import {RefreshControl, View, Modal, Pressable} from 'react-native';
import {FlashList} from '@shopify/flash-list';
import Slider from '../../components/Slider';
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {useFocusEffect} from '@react-navigation/native';
import HeroOptimized from '../../components/Hero';
import {mainStorage} from '../../lib/storage';
import useContentStore from '../../lib/zustand/contentStore';
import useHeroStore from '../../lib/zustand/herostore';
import {syncFromSharedFolder} from '../../lib/sync/syncService';
import {
  useHomePageData,
  getRandomHeroPost,
  clearHeroCache,
} from '../../lib/hooks/useHomePageData';
import ProviderDrawer from '../../components/ProviderDrawer';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {HomeStackParamList} from '../../App';
import {Drawer} from 'react-native-drawer-layout';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {providerManager} from '../../lib/services/ProviderManager';
import {Catalog, Post} from '../../lib/providers/types';
import Tutorial from '../../components/Touturial';
import {QueryErrorBoundary} from '../../components/ErrorBoundary';
import {StatusBar} from 'expo-status-bar';
import AppText from '../../components/ui/Text';
import {useM3Colors} from '../../theme/M3PaletteContext';
import ContinueWatching from '../../components/ContinueWatching';
import StatusBarScrim from '../../components/ui/StatusBarScrim';
import {isTV} from '../../lib/tv/constants';

type Props = NativeStackScreenProps<HomeStackParamList, 'Home'>;

type HomeRow = {
  key: string;
  isLoading: boolean;
  title: string;
  filter: string;
  posts: Post[];
};

const EMPTY_POSTS: Post[] = [];

const homeRowKey = (row: HomeRow) => row.key;

// One item type per row. A row is then never recycled into a different
// catalog, so each row keeps its own horizontal scroll position and focus.
const homeRowType = (row: HomeRow) => row.key;

// TV focus can only move to rows that are mounted. Keep about two rows ahead
// ready so fast D-pad presses do not run past the rendered content.
const HOME_DRAW_DISTANCE = isTV ? 800 : 400;

const Home = ({}: Props) => {
  const colors = useM3Colors();
  const [statusBarScrimVisible, setStatusBarScrimVisible] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [manualRefreshing, setManualRefreshing] = useState(false);
  const [isAtTop, setIsAtTop] = useState(true);

  // Memoize static values
  const disableDrawer = useMemo(
    () => mainStorage.getBool('disableDrawer') || false,
    [],
  );

  const provider = useContentStore(state => state.provider);
  const installedProviders = useContentStore(state => state.installedProviders);
  const setHero = useHeroStore(state => state.setHero);

  // React Query for home page data with better error handling
  const {
    data: homeData = [],
    isLoading,
    error,
    refetch,
    isRefetching,
    // isStale,
  } = useHomePageData({
    provider,
    enabled: !!(installedProviders?.length && provider?.value),
  });

  // Memoized scroll handler
  const handleScroll = useCallback((event: any) => {
    const offsetY = event.nativeEvent?.contentOffset?.y ?? 0;
    setStatusBarScrimVisible(offsetY > 12);
    setIsAtTop(offsetY <= 0);
  }, []);

  // Stable hero post calculation - uses provider value for caching
  const heroPost = useMemo(() => {
    if (!homeData || homeData.length === 0) {
      return null;
    }
    return getRandomHeroPost(homeData, provider?.value);
  }, [homeData, provider?.value]);

  // Update hero only when hero post actually changes
  React.useEffect(() => {
    if (heroPost) {
      setHero(heroPost);
    } else {
      setHero({link: '', image: '', title: ''});
    }
  }, [heroPost, setHero]);

  useFocusEffect(
    useCallback(() => {
      syncFromSharedFolder().catch(e =>
        console.warn('[VegaSync] Home focus sync failed:', e),
      );
    }, []),
  );

  // Optimized refresh handler
  // Promise chain instead of try/finally: React Compiler skips any component
  // that contains a finally clause.
  const handleRefresh = useCallback(() => {
    setManualRefreshing(true);
    const refresh = async () => {
      // Clear hero cache to get a new random hero on refresh
      clearHeroCache(provider?.value);
      await Promise.race([
        Promise.allSettled([
          refetch(),
          syncFromSharedFolder().catch(e =>
            console.warn('[VegaSync] Home refresh sync failed:', e),
          ),
        ]),
        new Promise(resolve => setTimeout(resolve, 10000)),
      ]);
    };
    return refresh()
      .catch(refreshError => {
        console.error('Error refreshing home data:', refreshError);
      })
      .then(() => {
        setTimeout(() => {
          setManualRefreshing(false);
        }, 50);
      });
  }, [refetch, provider?.value]);

  // Catalog now runs in the provider sandbox, so it resolves asynchronously.
  const [skeletonCatalog, setSkeletonCatalog] = useState<Catalog[]>([]);

  useEffect(() => {
    if (!provider?.value) {
      setSkeletonCatalog([]);
      return;
    }
    let cancelled = false;
    providerManager
      .getCatalog({providerValue: provider.value})
      .then(catalog => {
        if (!cancelled) {
          setSkeletonCatalog(catalog);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSkeletonCatalog([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [provider?.value]);

  // Rows of the vertical list. The list mounts only the rows near the screen,
  // so opening Home no longer builds every catalog row and its posters at once.
  const rows = useMemo<HomeRow[]>(
    () =>
      isLoading
        ? skeletonCatalog.map((item, index) => ({
            key: `loading-${item.filter}-${index}`,
            isLoading: true,
            title: item.title,
            filter: item.filter,
            posts: EMPTY_POSTS,
          }))
        : homeData.map((item, index) => ({
            key: `content-${item.filter}-${index}`,
            isLoading: false,
            title: item.title,
            filter: item.filter,
            posts: item.Posts,
          })),
    [isLoading, skeletonCatalog, homeData],
  );

  const providerValue = provider?.value;
  const renderRow = useCallback(
    ({item}: {item: HomeRow}) => (
      <Slider
        isLoading={item.isLoading}
        title={item.title}
        posts={item.posts}
        filter={item.filter}
        providerValue={item.isLoading ? undefined : providerValue}
      />
    ),
    [providerValue],
  );

  const openDrawer = useCallback(() => setIsDrawerOpen(true), []);

  // Memoized error message - only show if there is no cached data and an error occurred
  const errorComponent = useMemo(() => {
    if (homeData.length > 0 || isLoading || !error) {
      return null;
    }

    return (
      <View className="m-4 min-h-64 flex-1 items-center justify-center rounded-3xl bg-m3-error-container p-4">
        <AppText
          role="titleMediumEmphasized"
          className="text-center text-m3-on-error-container">
          {error?.message || 'Failed to load content'}
        </AppText>
        <AppText
          role="bodyMedium"
          className="mt-1 text-center text-m3-on-error-container">
          Pull to refresh and try again
        </AppText>
      </View>
    );
  }, [error, isLoading, homeData.length]);

  // Early return for no providers
  if (
    !installedProviders ||
    installedProviders.length === 0 ||
    !provider?.value
  ) {
    return <Tutorial />;
  }

  return (
    <QueryErrorBoundary>
      <GestureHandlerRootView style={{flex: 1}}>
        <StatusBarScrim visible={statusBarScrimVisible} />
        <View className="flex-1 bg-m3-background">
          <Drawer
            open={!isTV && isDrawerOpen}
            onOpen={() => {
              if (!isTV) setIsDrawerOpen(true);
            }}
            onClose={() => {
              if (!isTV) setIsDrawerOpen(false);
            }}
            drawerPosition="left"
            drawerType="front"
            drawerStyle={{width: 200, backgroundColor: 'transparent'}}
            swipeEdgeWidth={disableDrawer ? 0 : 70}
            swipeEnabled={!disableDrawer && !isTV}
            renderDrawerContent={() =>
              !disableDrawer && !isTV ? (
                <ProviderDrawer
                  isOpen={isDrawerOpen}
                  onClose={() => setIsDrawerOpen(false)}
                />
              ) : null
            }>
            <StatusBar style="light" />

            <FlashList
              data={rows}
              renderItem={renderRow}
              keyExtractor={homeRowKey}
              getItemType={homeRowType}
              drawDistance={HOME_DRAW_DISTANCE}
              onScroll={handleScroll}
              scrollEventThrottle={16}
              showsVerticalScrollIndicator={false}
              style={{backgroundColor: colors.background}}
              contentContainerStyle={{paddingBottom: isTV ? 120 : 32}}
              refreshControl={
                <RefreshControl
                  colors={[colors.primary]}
                  tintColor={colors.primary}
                  progressBackgroundColor={colors.surfaceContainer}
                  refreshing={manualRefreshing}
                  onRefresh={handleRefresh}
                  enabled={isAtTop || manualRefreshing}
                />
              }
              ListHeaderComponent={
                <>
                  <HeroOptimized
                    isDrawerOpen={isDrawerOpen}
                    onOpenDrawer={openDrawer}
                  />
                  <ContinueWatching />
                </>
              }
              ListFooterComponent={
                <View className="pb-8">
                  {errorComponent}
                  <View className="h-8" />
                </View>
              }
            />
          </Drawer>

          {isTV && isDrawerOpen ? (
            <Modal
              transparent
              visible={isDrawerOpen}
              animationType="fade"
              statusBarTranslucent
              onRequestClose={() => setIsDrawerOpen(false)}>
              <View style={{flex: 1, flexDirection: 'row', backgroundColor: 'rgba(0, 0, 0, 0.72)'}}>
                <View style={{width: 340, height: '100%', backgroundColor: '#121214'}}>
                  <ProviderDrawer onClose={() => setIsDrawerOpen(false)} />
                </View>
                <Pressable
                  style={{flex: 1}}
                  onPress={() => setIsDrawerOpen(false)}
                  focusable={false}
                />
              </View>
            </Modal>
          ) : null}
        </View>
      </GestureHandlerRootView>
    </QueryErrorBoundary>
  );
};

export default React.memo(Home);
