import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  SafeAreaView,
  ScrollView,
  RefreshControl,
  View,
  Text,
  StyleSheet,
} from 'react-native';
import {StatusBar} from 'expo-status-bar';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {HomeStackParamList} from '../../App';
import useContentStore from '../../lib/zustand/contentStore';
import useHeroStore from '../../lib/zustand/herostore';
import useContinueWatchingStore from '../../lib/zustand/continueWatchingStore';
import {
  useHomePageData,
  getRandomHeroPost,
  clearHeroCache,
  useHeroMetadata,
} from '../../lib/hooks/useHomePageData';
import {providerManager} from '../../lib/services/ProviderManager';
import {Catalog} from '../../lib/providers/types';
import Tutorial from '../../components/Touturial';
import {QueryErrorBoundary} from '../../components/ErrorBoundary';
import {useM3Colors} from '../../theme/M3PaletteContext';
import {
  TVHero,
  TVSlider,
  TVContinueWatching,
  TVContinueWatchingItem,
  TVSliderItem,
} from '../../components/tv';
import {isTV, TV_SPACING} from '../../lib/tv/constants';

type Props = NativeStackScreenProps<HomeStackParamList, 'Home'>;

const TVHome: React.FC<Props> = ({navigation}) => {
  const colors = useM3Colors();
  const provider = useContentStore(state => state.provider);
  const installedProviders = useContentStore(state => state.installedProviders);
  const setHero = useHeroStore(state => state.setHero);
  const continueWatchingItems = useContinueWatchingStore(state => state.items);

  const {
    data: homeData = [],
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useHomePageData({
    provider,
    enabled: !!(installedProviders?.length && provider?.value),
  });

  const heroPost = useMemo(() => {
    if (!homeData || homeData.length === 0) {
      return null;
    }
    return getRandomHeroPost(homeData, provider?.value);
  }, [homeData, provider?.value]);

  useEffect(() => {
    if (heroPost) {
      setHero(heroPost);
    } else {
      setHero({link: '', image: '', title: ''});
    }
  }, [heroPost, setHero]);

  const {data: heroData, isLoading: isHeroLoading} = useHeroMetadata(
    heroPost?.link || '',
    provider?.value || '',
  );

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

  const handleHeroPlayPress = useCallback(() => {
    if (heroPost?.link) {
      navigation.navigate('Info', {
        link: heroPost.link,
        provider: provider?.value,
        poster: heroData?.image || heroData?.poster || heroData?.background,
      });
    }
  }, [navigation, heroPost?.link, provider?.value, heroData]);

  const handleHeroInfoPress = useCallback(() => {
    if (heroPost?.link) {
      navigation.navigate('Info', {
        link: heroPost.link,
        provider: provider?.value,
        poster: heroData?.image || heroData?.poster || heroData?.background,
      });
    }
  }, [navigation, heroPost?.link, provider?.value, heroData]);

  const handleSliderItemPress = useCallback(
    (item: TVSliderItem) => {
      navigation.navigate('Info', {
        link: item.link,
        provider: item.provider || provider?.value,
        poster: item.image,
      });
    },
    [navigation, provider?.value],
  );

  const handleContinueWatchingPress = useCallback(
    (item: TVContinueWatchingItem) => {
      navigation.navigate('Info', {
        link: item.link,
        provider: item.provider || provider?.value,
        poster: item.poster,
      });
    },
    [navigation, provider?.value],
  );

  const handleSeeMorePress = useCallback(
    (filter: string, title: string) => {
      navigation.navigate('ScrollList', {
        title,
        filter,
        providerValue: provider?.value,
        isSearch: false,
      });
    },
    [navigation, provider?.value],
  );

  const handleRefresh = useCallback(async () => {
    try {
      clearHeroCache(provider?.value);
      await refetch();
    } catch (refreshError) {
      console.error('Error refreshing home data:', refreshError);
    }
  }, [refetch, provider?.value]);

  const loadingSliders = useMemo(() => {
    return skeletonCatalog.map((item, index) => (
      <TVSlider
        key={`loading-${item.filter}-${index}`}
        title={item.title}
        data={[]}
        onItemPress={() => {}}
        isLoading={true}
      />
    ));
  }, [skeletonCatalog]);

  const contentSliders = useMemo(() => {
    return homeData.map((item, index) => (
      <TVSlider
        key={`content-${item.filter}-${index}`}
        title={item.title}
        data={item.Posts.map(post => ({
          id: post.link,
          title: post.title,
          image: post.image,
          link: post.link,
          provider: post.provider,
        }))}
        onItemPress={handleSliderItemPress}
        onSeeMorePress={
          item.filter !== 'recent'
            ? () => handleSeeMorePress(item.filter, item.title)
            : undefined
        }
        isLoading={false}
        hasTVPreferredFocus={false}
      />
    ));
  }, [
    homeData,
    handleSliderItemPress,
    handleSeeMorePress,
    continueWatchingItems.length,
  ]);

  const continueItems = useMemo<TVContinueWatchingItem[]>(() => {
    return continueWatchingItems.map(item => ({
      link: item.infoUrl || item.episode?.link || item.id,
      title: item.title,
      poster: item.poster || item.background,
      provider: item.providerValue,
      currentTime: item.position,
      duration: item.duration,
    }));
  }, [continueWatchingItems]);

  const progressData = useMemo<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    for (const item of continueWatchingItems) {
      const key = item.infoUrl || item.episode?.link || item.id;
      if (item.duration > 0) {
        map[key] = Math.min(100, Math.max(0, (item.position / item.duration) * 100));
      }
    }
    return map;
  }, [continueWatchingItems]);

  if (!installedProviders || installedProviders.length === 0 || !provider?.value) {
    return (
      <View style={{flex: 1, width: '100%', height: '100%', backgroundColor: '#000000'}}>
        <Tutorial />
      </View>
    );
  }

  return (
    <QueryErrorBoundary>
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" animated={true} />
        <ScrollView
          showsVerticalScrollIndicator={false}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              colors={[colors.primary]}
              tintColor={colors.primary}
              progressBackgroundColor="black"
              refreshing={isRefetching}
              onRefresh={handleRefresh}
            />
          }>
          <TVHero
            title={heroData?.name || heroData?.title || heroPost?.title}
            description={heroData?.synopsis}
            genres={heroData?.genre || heroData?.tags || []}
            rating={heroData?.imdbRating}
            year={heroData?.year}
            backgroundImage={heroData?.background || heroData?.image || heroPost?.image}
            logo={heroData?.logo}
            posterImage={heroData?.poster || heroData?.image}
            onPlayPress={handleHeroPlayPress}
            onInfoPress={handleHeroInfoPress}
            isLoading={isHeroLoading && !heroData}
            hasTVPreferredFocus={false}
          />

          {continueItems.length > 0 ? (
            <TVContinueWatching
              items={continueItems}
              progressData={progressData}
              onItemPress={handleContinueWatchingPress}
              hasTVPreferredFocus={false}
            />
          ) : null}

          <View style={styles.slidersContainer}>
            {isLoading ? loadingSliders : contentSliders}
            {error && !isLoading && homeData.length === 0 ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>
                  {error.message || 'Failed to load content'}
                </Text>
                <Text style={styles.errorSubtext}>Press Select to refresh</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </SafeAreaView>
    </QueryErrorBoundary>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#000000',
  },
  scrollContent: {
    flexGrow: 1,
  },
  slidersContainer: {
    marginTop: -TV_SPACING.lg,
    zIndex: 20,
  },
  bottomSpacer: {
    height: isTV ? 80 : 64,
  },
  errorContainer: {
    padding: TV_SPACING.lg,
    margin: TV_SPACING.lg,
    backgroundColor: 'rgba(229, 9, 20, 0.2)',
    borderRadius: 8,
    minHeight: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#E50914',
    textAlign: 'center',
    fontWeight: '500',
    fontSize: isTV ? 20 : 16,
  },
  errorSubtext: {
    color: '#888888',
    textAlign: 'center',
    fontSize: isTV ? 16 : 14,
    marginTop: TV_SPACING.xs,
  },
});

export default React.memo(TVHome);
