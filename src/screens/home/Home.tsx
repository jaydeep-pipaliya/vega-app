import {SafeAreaView, ScrollView, RefreshControl, View, Modal, Pressable} from 'react-native';
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
import {Catalog} from '../../lib/providers/types';
import Tutorial from '../../components/Touturial';
import {QueryErrorBoundary} from '../../components/ErrorBoundary';
import {StatusBar} from 'expo-status-bar';
import AppText from '../../components/ui/Text';
import {useM3Colors} from '../../theme/M3PaletteContext';
import ContinueWatching from '../../components/ContinueWatching';
import StatusBarScrim from '../../components/ui/StatusBarScrim';
import {isTV} from '../../lib/tv/constants';

type Props = NativeStackScreenProps<HomeStackParamList, 'Home'>;

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
  const handleRefresh = useCallback(async () => {
    setManualRefreshing(true);
    try {
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
    } catch (refreshError) {
      console.error('Error refreshing home data:', refreshError);
    } finally {
      setTimeout(() => {
        setManualRefreshing(false);
      }, 50);
    }
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

  // Memoized loading skeleton
  const loadingSliders = useMemo(
    () =>
      skeletonCatalog.map((item, index) => (
        <Slider
          isLoading={true}
          key={`loading-${item.filter}-${index}`}
          title={item.title}
          posts={[]}
          filter={item.filter}
        />
      )),
    [skeletonCatalog],
  );

  // Memoized content sliders
  const contentSliders = useMemo(() => {
    return homeData.map((item, index) => (
      <Slider
        isLoading={false}
        key={`content-${item.filter}-${index}`}
        title={item.title}
        posts={item.Posts}
        filter={item.filter}
        providerValue={provider?.value}
      />
    ));
  }, [homeData, provider?.value]);

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
        <SafeAreaView className="flex-1 bg-m3-background">
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

            <ScrollView
              onScroll={handleScroll}
              scrollEventThrottle={16} // Optimize scroll performance
              showsVerticalScrollIndicator={false}
              className="bg-m3-background"
              contentContainerStyle={{ paddingBottom: isTV ? 120 : 32 }}
              refreshControl={
                <RefreshControl
                  colors={[colors.primary]}
                  tintColor={colors.primary}
                  progressBackgroundColor={colors.surfaceContainer}
                  refreshing={manualRefreshing}
                  onRefresh={handleRefresh}
                  enabled={isAtTop || manualRefreshing}
                />
              }>
              <HeroOptimized
                isDrawerOpen={isDrawerOpen}
                onOpenDrawer={() => setIsDrawerOpen(true)}
              />

              <ContinueWatching />

              <View className="relative z-20 pb-8">
                {isLoading ? loadingSliders : contentSliders}
                {errorComponent}
              </View>

              <View className="h-8" />
            </ScrollView>
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
        </SafeAreaView>
      </GestureHandlerRootView>
    </QueryErrorBoundary>
  );
};

export default React.memo(Home);
