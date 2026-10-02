import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import {useWindowDimensions, View} from 'react-native';
import {FlatList} from 'react-native-gesture-handler';
import React, {memo, useCallback, useMemo} from 'react';
import type {Post} from '../lib/providers/types';
import {deduplicatePosts} from '../lib/providers/deduplicatePosts';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useNavigation} from '@react-navigation/native';
import {HomeStackParamList} from '../App';
import useContentStore from '../lib/zustand/contentStore';
import SkeletonLoader from './Skeleton';
import MediaPosterCard, {parseAspectRatio} from './MediaPosterCard';
import {useM3Colors} from '../theme/M3PaletteContext';
import {isTV} from '../lib/tv/constants';
import {TVFocusable, TVFocusGuide} from './tv';
import {useTVFocusBorderColor} from '../lib/tv/useTVFocusBorderColor';

import AppText from './ui/Text';

const SKELETON_CARD_SPAN = 136;
const MAX_SKELETON_CARDS = 20;

const SliderSeparator = () => <View style={{width: 14}} />;

// One memoized cell per post, so the press handler stays stable and
// MediaPosterCard skips re-rendering when the list re-renders.
const SliderPosterItem = memo(
  ({item, onPressItem}: {item: Post; onPressItem: (item: Post) => void}) => {
    const ratio = parseAspectRatio(item.aspectRatio, 2 / 3);
    const cardWidth = ratio > 1.2 ? 220 : ratio > 0.85 ? 150 : 124;
    const handlePress = useCallback(
      () => onPressItem(item),
      [onPressItem, item],
    );

    return (
      <MediaPosterCard
        title={item.title}
        poster={item.image}
        width={cardWidth}
        aspectRatio={item.aspectRatio}
        borderRadius={item.borderRadius}
        cornerTag={item.cornerTag || item.tag}
        onPress={handlePress}
      />
    );
  },
);

const Slider = ({
  isLoading,
  title,
  posts,
  filter,
  providerValue,
  isSearch = false,
  error,
}: {
  isLoading: boolean;
  title: string;
  posts: Post[];
  filter: string;
  providerValue?: string;
  isSearch?: boolean;
  error?: string;
}): React.ReactElement => {
  const provider = useContentStore(state => state.provider);
  const colors = useM3Colors();
  const focusBorderColor = useTVFocusBorderColor();
  const navigation =
    useNavigation<NativeStackNavigationProp<HomeStackParamList>>();
  const [isSelected, setSelected] = React.useState('');
  const uniquePosts = useMemo(() => deduplicatePosts(posts), [posts]);
  const {width: windowWidth} = useWindowDimensions();
  // Cards that fit on screen, plus one. The skeleton row clips overflow, so
  // more are never seen; the post row renders this many before measuring.
  const skeletonCount = Math.min(
    MAX_SKELETON_CARDS,
    Math.ceil(windowWidth / SKELETON_CARD_SPAN) + 1,
  );

  const handleMorePress = useCallback(() => {
    navigation.navigate('ScrollList', {
      title: title,
      filter: filter,
      providerValue: providerValue || posts[0]?.provider || provider?.value,
      isSearch: isSearch,
    });
  }, [navigation, title, filter, providerValue, posts, provider?.value, isSearch]);

  const handleItemPress = useCallback(
    (item: Post) => {
      setSelected('');
      navigation.navigate('Info', {
        link: item.link,
        provider: item.provider || providerValue || provider?.value,
        poster: item?.image,
      });
    },
    [navigation, providerValue, provider?.value],
  );

  const renderItem = useCallback(
    ({item}: {item: Post}) => (
      <SliderPosterItem item={item} onPressItem={handleItemPress} />
    ),
    [handleItemPress],
  );

  const keyExtractor = useCallback((item: Post, index: number) =>
    JSON.stringify([item.provider || providerValue || provider?.value || '', item.link || index]),
  [providerValue, provider?.value]);

  return (
    <TVFocusGuide autoFocus={false} style={{gap: 14, marginTop: 28, overflow: 'visible'}}>
      <View
        style={{
          alignItems: 'center',
          flexDirection: 'row',
          justifyContent: 'space-between',
          paddingHorizontal: 20,
        }}>
        <AppText
          role="titleLargeEmphasized"
          style={{
            color: colors.onBackground,
            flex: 1,
            marginRight: 12,
            minWidth: 0,
          }}
          numberOfLines={1}>
          {title}
        </AppText>
        {filter !== 'recent' && (
          <TVFocusable
            accessibilityRole="button"
            accessibilityLabel={`See all ${title}`}
            onPress={handleMorePress}
            borderRadius={18}
            focusScale={1.1}
            focusBorderColor={focusBorderColor}
            style={{
              alignItems: 'center',
              backgroundColor: colors.surfaceContainerHigh,
              borderRadius: 18,
              flexShrink: 0,
              justifyContent: 'center',
              minHeight: 36,
              paddingHorizontal: 12,
            }}>
            <View
              style={{
                alignItems: 'center',
                flexDirection: 'row',
                flexWrap: 'nowrap',
                height: 24,
                justifyContent: 'center',
              }}>
              <AppText
                role="labelLargeEmphasized"
                numberOfLines={1}
                style={{color: colors.primary, marginRight: 4}}>
                See all
              </AppText>
              <MaterialCommunityIcons
                name="chevron-right"
                color={colors.primary}
                size={18}
              />
            </View>
          </TVFocusable>
        )}
      </View>
      {isLoading ? (
        <View className="flex flex-row gap-2 overflow-hidden">
          {Array.from({length: skeletonCount}).map((_, index) => (
            <View
              className="gap-2 flex mb-3 justify-center"
              style={{marginLeft: index === 0 ? 18 : 0, marginRight: 12}}
              key={index}>
              <SkeletonLoader height={186} width={124} />
              <SkeletonLoader height={14} width={110} />
            </View>
          ))}
        </View>
      ) : (
        <FlatList
          showsHorizontalScrollIndicator={false}
          data={uniquePosts}
          extraData={isSelected}
          horizontal
          style={{overflow: 'visible'}}
          contentContainerStyle={{
            paddingVertical: 12,
            paddingHorizontal: 20,
            overflow: 'visible',
          }}
          ItemSeparatorComponent={SliderSeparator}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          initialNumToRender={skeletonCount}
          maxToRenderPerBatch={8}
          // Two screens of posters on each side. Enough for flings and held
          // D-pad presses, and far fewer mounted cards per row than 7.
          windowSize={5}
          removeClippedSubviews={false}
          ListFooterComponent={
            !isLoading && error ? (
              <View className="flex flex-row w-96 justify-center h-10 items-center">
                <AppText
                  role="bodyMedium"
                  className="text-center text-m3-error">
                  {error}
                </AppText>
              </View>
            ) : !isLoading && posts.length === 0 ? (
              <View className="flex flex-row w-96 justify-center h-10 items-center">
                <AppText
                  role="bodyMedium"
                  className="text-center text-m3-on-surface-variant">
                  No content found
                </AppText>
              </View>
            ) : isTV && filter !== 'recent' && posts.length > 0 ? (
              <View
                style={{
                  marginLeft: 14,
                  marginRight: 20,
                  justifyContent: 'center',
                  paddingVertical: 6,
                }}>
                <TVFocusable
                  accessibilityRole="button"
                  accessibilityLabel={`See all ${title}`}
                  onPress={handleMorePress}
                  focusScale={1.05}
                  focusBorderColor={focusBorderColor}
                  borderRadius={18}
                  style={{
                    width: 124,
                    height: 186,
                    borderRadius: 18,
                    backgroundColor: colors.surfaceContainerHigh,
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 12,
                  }}>
                  <View
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 24,
                      backgroundColor: colors.surfaceContainerHighest,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 10,
                    }}>
                    <MaterialCommunityIcons
                      name="arrow-right"
                      color={colors.primary}
                      size={26}
                    />
                  </View>
                  <AppText
                    role="labelLargeEmphasized"
                    numberOfLines={2}
                    style={{color: colors.primary, textAlign: 'center'}}>
                    See all
                  </AppText>
                </TVFocusable>
              </View>
            ) : null
          }
        />
      )}
    </TVFocusGuide>
  );
};

export default memo(Slider);
