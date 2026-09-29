import React, {useRef, useCallback} from 'react';
import {View, Text, Image, FlatList, StyleSheet, ViewStyle} from 'react-native';
import {TVFocusableCard} from './TVFocusable';
import {
  isTV,
  TV_CARD_WIDTH,
  TV_CARD_HEIGHT,
  TV_CARD_MARGIN,
  TV_FONT_SIZES,
  TV_SPACING,
} from '../../lib/tv/constants';
import useThemeStore from '../../lib/zustand/themeStore';

export interface TVContinueWatchingItem {
  link: string;
  title: string;
  poster?: string;
  provider?: string;
  currentTime?: number;
  duration?: number;
}

export interface TVContinueWatchingProps {
  items: TVContinueWatchingItem[];
  progressData: Record<string, number>;
  onItemPress: (item: TVContinueWatchingItem) => void;
  style?: ViewStyle;
  hasTVPreferredFocus?: boolean;
}

const TVContinueWatching: React.FC<TVContinueWatchingProps> = ({
  items,
  progressData,
  onItemPress,
  style,
  hasTVPreferredFocus = false,
}) => {
  const {primary} = useThemeStore(state => state);
  const flatListRef = useRef<FlatList>(null);

  const handleItemFocus = useCallback((index: number) => {
    flatListRef.current?.scrollToIndex({
      index,
      animated: true,
      viewPosition: 0.2,
    });
  }, []);

  const renderItem = useCallback(
    ({item, index}: {item: TVContinueWatchingItem; index: number}) => {
      const progress = progressData[item.link] || 0;
      const cardWidth = isTV ? TV_CARD_WIDTH : 100;
      const cardHeight = isTV ? TV_CARD_HEIGHT : 150;

      return (
        <TVFocusableCard
          onPress={() => onItemPress(item)}
          onFocus={() => handleItemFocus(index)}
          width={cardWidth}
          height={cardHeight + 40}
          focusBorderColor={primary}
          hasTVPreferredFocus={hasTVPreferredFocus && index === 0}
          style={styles.cardContainer}
          accessibilityLabel={`Continue watching ${item.title}`}>
          <View
            style={[
              styles.posterContainer,
              {width: cardWidth, height: cardHeight},
            ]}>
            <Image
              source={{
                uri:
                  item.poster ||
                  'https://placehold.jp/24/363636/ffffff/100x150.png?text=vega',
              }}
              style={[styles.poster, {width: cardWidth, height: cardHeight}]}
              resizeMode="cover"
            />

            <View style={styles.progressBarContainer}>
              <View
                style={[
                  styles.progressBar,
                  {
                    width: `${Math.min(Math.max(progress, 0), 100)}%`,
                    backgroundColor: primary,
                  },
                ]}
              />
            </View>
          </View>

          <View style={styles.titleContainer}>
            <Text style={styles.itemTitle} numberOfLines={2}>
              {item.title}
            </Text>
            {progress > 0 ? (
              <Text style={styles.progressText}>
                {Math.round(progress)}% watched
              </Text>
            ) : null}
          </View>
        </TVFocusableCard>
      );
    },
    [onItemPress, handleItemFocus, progressData, primary, hasTVPreferredFocus],
  );

  const keyExtractor = useCallback(
    (item: TVContinueWatchingItem, index: number) => item.link || `continue-${index}`,
    [],
  );

  if (!items || items.length === 0) {
    return null;
  }

  const cardWidth = isTV ? TV_CARD_WIDTH : 100;

  return (
    <View style={[styles.container, style]}>
      <View style={styles.headerContainer}>
        <Text style={[styles.title, {color: primary}]}>Continue Watching</Text>
      </View>
      <FlatList
        ref={flatListRef}
        data={items}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={{width: TV_CARD_MARGIN}} />}
        removeClippedSubviews={true}
        maxToRenderPerBatch={8}
        windowSize={5}
        initialNumToRender={5}
        getItemLayout={(_, index) => ({
          length: cardWidth + TV_CARD_MARGIN,
          offset: (cardWidth + TV_CARD_MARGIN) * index,
          index,
        })}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: TV_SPACING.md,
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: TV_SPACING.lg,
    marginBottom: TV_SPACING.sm,
  },
  title: {
    fontSize: TV_FONT_SIZES.title,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: TV_SPACING.lg,
  },
  cardContainer: {
    marginHorizontal: TV_CARD_MARGIN / 2,
  },
  posterContainer: {
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#222222',
  },
  poster: {
    borderRadius: 8,
  },
  progressBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  progressBar: {
    height: '100%',
  },
  titleContainer: {
    paddingVertical: TV_SPACING.xs,
    paddingHorizontal: 2,
  },
  itemTitle: {
    fontSize: TV_FONT_SIZES.small,
    color: '#ffffff',
    textAlign: 'center',
  },
  progressText: {
    fontSize: isTV ? 12 : 10,
    color: '#888888',
    textAlign: 'center',
    marginTop: 2,
  },
});

export default React.memo(TVContinueWatching);
