import React, { useState } from 'react';
import { View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import AppText from '../../../../components/ui/Text';
import { useM3Colors } from '../../../../theme/M3PaletteContext';
import type { TmdbStoryData } from '../../../../lib/hooks/useTmdbStory';
import { TVFocusable } from '../../../../components/tv';
import { formatCount, formatRating, SectionHeading } from './storyUtils';

interface RatingsPageProps {
  data: TmdbStoryData;
  onInteract?: () => void;
}

export const RatingsPage: React.FC<RatingsPageProps> = ({
  data,
  onInteract,
}) => {
  const colors = useM3Colors();
  const [isReviewExpanded, setIsReviewExpanded] = useState(false);
  const histogram = data.ratingsHistogram ?? [];
  const maxVotes = Math.max(...histogram.map(h => h.voteCount), 1);
  const voteCountFormatted = formatCount(data.voteCount);

  return (
    <>
      <SectionHeading icon="chart-bar" title="User reviews" />

      {/* Ratings & Histogram Card */}
      <View
        style={{
          backgroundColor: colors.surfaceContainerLow,
          borderColor: colors.outlineVariant,
          borderRadius: 22,
          borderWidth: 1,
          marginBottom: 16,
          padding: 18,
        }}>
        {/* Rating summary: Big Star + Score + Votes */}
        {formatRating(data.rating) ? (
          <View
            style={{
              alignItems: 'center',
              flexDirection: 'row',
              gap: 12,
              marginBottom: 16,
            }}>
            <MaterialCommunityIcons name="star" size={38} color="#f5c518" />
            <View>
              <View
                style={{ alignItems: 'baseline', flexDirection: 'row', gap: 4 }}>
                <AppText
                  role="headlineMediumEmphasized"
                  style={{ color: colors.onSurface }}>
                  {formatRating(data.rating)}
                </AppText>
                <AppText
                  role="titleSmall"
                  style={{ color: colors.onSurfaceVariant }}>
                  /10
                </AppText>
              </View>
              {voteCountFormatted ? (
                <AppText
                  role="bodySmall"
                  style={{ color: colors.onSurfaceVariant }}>
                  {voteCountFormatted} votes
                </AppText>
              ) : null}
            </View>
          </View>
        ) : null}

        {/* 10-bar Histogram */}
        {histogram.length > 0 ? (
          <View
            style={{
              alignItems: 'flex-end',
              flexDirection: 'row',
              gap: 6,
              height: 110,
              paddingTop: 10,
            }}>
            {histogram.map(entry => {
              const pct = maxVotes > 0 ? (entry.voteCount / maxVotes) * 100 : 0;
              return (
                <View
                  key={entry.rating}
                  style={{
                    alignItems: 'center',
                    flex: 1,
                    gap: 6,
                    height: '100%',
                  }}>
                  <View
                    style={{
                      alignItems: 'flex-end',
                      backgroundColor: colors.surfaceContainer,
                      borderRadius: 4,
                      flex: 1,
                      justifyContent: 'flex-end',
                      overflow: 'hidden',
                      width: '100%',
                    }}>
                    <View
                      style={{
                        backgroundColor: colors.primary,
                        borderRadius: 4,
                        height: `${Math.max(pct, 4)}%`,
                        width: '100%',
                      }}
                    />
                  </View>
                  <AppText
                    role="labelSmall"
                    style={{
                      color: colors.onSurfaceVariant,
                      fontSize: 11,
                      fontWeight: '600',
                    }}>
                    {entry.rating}
                  </AppText>
                </View>
              );
            })}
          </View>
        ) : null}
      </View>

      {/* Featured Review */}
      {data.featuredReview ? (
        <View
          style={{
            backgroundColor: colors.surfaceContainerLow,
            borderColor: colors.outlineVariant,
            borderRadius: 22,
            borderWidth: 1,
            gap: 10,
            padding: 18,
          }}>
          <AppText
            role="labelMediumEmphasized"
            style={{
              color: colors.primary,
              letterSpacing: 0.5,
              textTransform: 'uppercase',
            }}>
            Featured Review
          </AppText>

          {data.featuredReview.rating ? (
            <View
              style={{
                alignItems: 'center',
                flexDirection: 'row',
                gap: 4,
              }}>
              <MaterialCommunityIcons name="star" size={16} color="#f5c518" />
              <AppText
                role="labelLargeEmphasized"
                style={{ color: colors.onSurface }}>
                {data.featuredReview.rating}/10
              </AppText>
            </View>
          ) : null}

          {data.featuredReview.summary ? (
            <AppText
              role="titleMediumEmphasized"
              style={{ color: colors.onSurface }}>
              {data.featuredReview.summary}
            </AppText>
          ) : null}

          {data.featuredReview.text ? (
            <AppText
              role="bodyMedium"
              numberOfLines={isReviewExpanded ? undefined : 6}
              style={{ color: colors.onSurfaceVariant, lineHeight: 20 }}>
              {data.featuredReview.text}
            </AppText>
          ) : null}

          {data.featuredReview.text && data.featuredReview.text.length > 200 ? (
            <TVFocusable
              onPress={() => {
                onInteract?.();
                setIsReviewExpanded(prev => !prev);
              }}
              borderRadius={8}
              focusScale={1.05}
              style={{ alignSelf: 'flex-start', paddingVertical: 4 }}>
              <AppText
                role="labelLargeEmphasized"
                style={{ color: colors.primary }}>
                {isReviewExpanded ? 'Show less' : 'Read more'}
              </AppText>
            </TVFocusable>
          ) : null}

          {data.featuredReview.author ? (
            <AppText
              role="bodySmall"
              style={{ color: colors.onSurfaceVariant, opacity: 0.8 }}>
              By {data.featuredReview.author}
              {data.featuredReview.date ? ` • ${data.featuredReview.date}` : ''}
            </AppText>
          ) : null}
        </View>
      ) : null}
    </>
  );
};

export default RatingsPage;
