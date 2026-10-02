import React, { useEffect, useMemo, useState } from 'react';
import { Image, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import AppText from '../../../../components/ui/Text';
import { useM3Colors } from '../../../../theme/M3PaletteContext';
import type { TmdbStoryData } from '../../../../lib/hooks/useTmdbStory';
import {isTV} from '../../../../lib/tv/constants';
import {
  formatCount,
  formatRating,
  getTmdbImage,
  SectionHeading,
} from './storyUtils';

interface AboutPageProps {
  data: TmdbStoryData;
  fallbackBackdrop?: string;
  fallbackOverview?: string;
  fallbackTitle?: string;
}

export const AboutPage: React.FC<AboutPageProps> = ({
  data,
  fallbackBackdrop,
  fallbackOverview,
  fallbackTitle,
}) => {
  const colors = useM3Colors();
  const backdropChoices = useMemo(
    () =>
      Array.from(
        new Set(
          [
            ...(data.backdropPaths ?? []).map(path => getTmdbImage(path)),
            fallbackBackdrop,
          ].filter(Boolean),
        ),
      ) as string[],
    [data.backdropPaths, fallbackBackdrop],
  );
  const [backdropIndex, setBackdropIndex] = useState(0);
  const backdrop = backdropChoices[backdropIndex];

  useEffect(() => {
    setBackdropIndex(0);
    if (backdropChoices.length < 2) {
      return;
    }
    const timer = setInterval(() => {
      setBackdropIndex(index => (index + 1) % backdropChoices.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [backdropChoices]);

  return (
    <>
      {backdrop ? (
        <Image
          key={backdrop}
          fadeDuration={500}
          source={{ uri: backdrop }}
          resizeMode="cover"
          resizeMethod="resize"
          style={{
            aspectRatio: isTV ? undefined : 16 / 9,
            backgroundColor: colors.surfaceContainer,
            borderRadius: 28,
            width: '100%',
            height: isTV ? 300 : undefined,
          }}
        />
      ) : null}
      <AppText
        role="headlineLargeEmphasized"
        style={{ color: colors.onBackground, marginTop: 24 }}>
        {data.title || fallbackTitle}
      </AppText>
      {data.tagline ? (
        <AppText
          role="titleMedium"
          style={{ color: colors.primary, marginTop: 7 }}>
          {data.tagline}
        </AppText>
      ) : null}
      <View
        style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
        {formatRating(data.rating) ? (
          <View
            style={{
              alignItems: 'center',
              backgroundColor: '#f5c518',
              borderRadius: 12,
              flexDirection: 'row',
              gap: 4,
              paddingHorizontal: 10,
              paddingVertical: 5,
            }}>
            <MaterialCommunityIcons name="star" size={16} color="#000000" />
            <AppText
              role="labelLargeEmphasized"
              style={{ color: '#000000', fontWeight: 'bold' }}>
              {formatRating(data.rating)}
              {data.voteCount ? ` (${formatCount(data.voteCount)})` : ''}
            </AppText>
          </View>
        ) : null}
        {data.metascore ? (
          <View
            style={{
              alignItems: 'center',
              backgroundColor: colors.surfaceContainerHigh,
              borderColor: colors.outlineVariant,
              borderRadius: 12,
              borderWidth: 1,
              flexDirection: 'row',
              gap: 4,
              paddingHorizontal: 10,
              paddingVertical: 5,
            }}>
            <MaterialCommunityIcons
              name="pound"
              size={16}
              color={colors.primary}
            />
            <AppText
              role="labelLargeEmphasized"
              style={{ color: colors.onSurface }}>
              {data.metascore} Metascore
            </AppText>
          </View>
        ) : null}
        {data.trendingRank ? (
          <View
            style={{
              alignItems: 'center',
              backgroundColor: colors.surfaceContainerHigh,
              borderColor: colors.outlineVariant,
              borderRadius: 12,
              borderWidth: 1,
              flexDirection: 'row',
              gap: 4,
              paddingHorizontal: 10,
              paddingVertical: 5,
            }}>
            <MaterialCommunityIcons
              name="trending-up"
              size={16}
              color={colors.primary}
            />
            <AppText
              role="labelLargeEmphasized"
              style={{ color: colors.onSurface }}>
              #{data.trendingRank}
            </AppText>
          </View>
        ) : null}
      </View>
      <View style={{ marginTop: 34 }}>
        <SectionHeading icon="movie-open-outline" title="What's it about" />
        <AppText
          role="titleLarge"
          style={{
            color: colors.onSurfaceVariant,
            fontSize: 20,
            lineHeight: 30,
          }}>
          {data.overview || fallbackOverview || 'No overview is available.'}
        </AppText>
      </View>
    </>
  );
};

export default AboutPage;
