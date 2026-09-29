import React, {useRef, useCallback} from 'react';
import {View, Text, FlatList, StyleSheet, ViewStyle, Image} from 'react-native';
import TVFocusable, {TVFocusableCard} from './TVFocusable';
import {
  TV_CARD_WIDTH,
  TV_CARD_HEIGHT,
  TV_CARD_MARGIN,
  TV_FONT_SIZES,
  TV_SPACING,
} from '../../lib/tv/constants';

export interface TVSliderItem {
  id: string;
  title: string;
  image?: string;
  link: string;
  provider?: string;
}

export interface TVSliderProps {
  title: string;
  data: TVSliderItem[];
  onItemPress: (item: TVSliderItem) => void;
  onSeeMorePress?: () => void;
  isLoading?: boolean;
  focusBorderColor?: string;
  style?: ViewStyle;
  hasTVPreferredFocus?: boolean;
}

const TVSlider: React.FC<TVSliderProps> = ({
  title,
  data,
  onItemPress,
  onSeeMorePress,
  isLoading = false,
  focusBorderColor,
  style,
  hasTVPreferredFocus = false,
}) => {
  const flatListRef = useRef<FlatList>(null);

  const handleItemFocus = useCallback(
    (index: number) => {
      flatListRef.current?.scrollToIndex({
        index,
        animated: true,
        viewPosition: 0.2,
      });
    },
    [],
  );

  const renderItem = useCallback(
    ({item, index}: {item: TVSliderItem; index: number}) => {
      return (
        <TVFocusableCard
          onPress={() => onItemPress(item)}
          onFocus={() => handleItemFocus(index)}
          width={TV_CARD_WIDTH}
          height={TV_CARD_HEIGHT + 36}
          focusBorderColor={focusBorderColor}
          hasTVPreferredFocus={hasTVPreferredFocus && index === 0}
          style={styles.cardContainer}
          accessibilityLabel={item.title}>
          <View style={styles.imageContainer}>
            {item.image ? (
              <Image
                source={{uri: item.image}}
                style={[
                  styles.posterImage,
                  {
                    width: TV_CARD_WIDTH,
                    height: TV_CARD_HEIGHT,
                  },
                ]}
                resizeMode="cover"
              />
            ) : (
              <View
                style={[
                  styles.posterPlaceholder,
                  {
                    width: TV_CARD_WIDTH,
                    height: TV_CARD_HEIGHT,
                  },
                ]}>
                <Text style={styles.placeholderText}>No Image</Text>
              </View>
            )}
          </View>
          <View style={styles.titleContainer}>
            <Text style={styles.itemTitle} numberOfLines={2}>
              {item.title}
            </Text>
          </View>
        </TVFocusableCard>
      );
    },
    [onItemPress, handleItemFocus, focusBorderColor, hasTVPreferredFocus],
  );

  const keyExtractor = useCallback(
    (item: TVSliderItem, index: number) => item.id || item.link || `slider-item-${index}`,
    [],
  );

  if (isLoading) {
    return (
      <View style={[styles.container, style]}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.loadingContainer}>
          {[1, 2, 3, 4, 5].map(i => (
            <View
              key={i}
              style={[
                styles.loadingSkeleton,
                {width: TV_CARD_WIDTH, height: TV_CARD_HEIGHT},
              ]}
            />
          ))}
        </View>
      </View>
    );
  }

  if (!data || data.length === 0) {
    return null;
  }

  return (
    <View style={[styles.container, style]}>
      <View style={styles.headerContainer}>
        <Text style={styles.title}>{title}</Text>
        {onSeeMorePress ? (
          <TVFocusable
            onPress={onSeeMorePress}
            style={styles.seeMoreButton}
            focusScale={1.08}
            showFocusBorder={true}>
            <Text style={styles.seeMoreText}>See All →</Text>
          </TVFocusable>
        ) : null}
      </View>
      <FlatList
        ref={flatListRef}
        data={data}
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
          length: TV_CARD_WIDTH + TV_CARD_MARGIN,
          offset: (TV_CARD_WIDTH + TV_CARD_MARGIN) * index,
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
    color: '#ffffff',
  },
  seeMoreButton: {
    paddingHorizontal: TV_SPACING.md,
    paddingVertical: TV_SPACING.xs,
  },
  seeMoreText: {
    fontSize: TV_FONT_SIZES.body,
    color: '#cccccc',
  },
  listContent: {
    paddingHorizontal: TV_SPACING.lg,
  },
  cardContainer: {
    marginHorizontal: TV_CARD_MARGIN / 2,
  },
  imageContainer: {
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#222222',
  },
  posterImage: {
    backgroundColor: '#222222',
  },
  posterPlaceholder: {
    backgroundColor: '#222222',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#666666',
    fontSize: TV_FONT_SIZES.small,
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
  loadingContainer: {
    flexDirection: 'row',
    paddingHorizontal: TV_SPACING.lg,
  },
  loadingSkeleton: {
    backgroundColor: '#222222',
    borderRadius: 8,
    marginRight: TV_CARD_MARGIN,
  },
});

export default React.memo(TVSlider);
