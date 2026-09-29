import React from 'react';
import { Image, Linking, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import AppText from '../../../../components/ui/Text';
import { useM3Colors } from '../../../../theme/M3PaletteContext';
import type { TmdbStoryData } from '../../../../lib/hooks/useTmdbStory';
import { TVFocusable } from '../../../../components/tv';
import { formatRating, SectionHeading } from './storyUtils';
import {isTV} from '../../../../lib/tv/constants';

interface RelatedPageProps {
  data: TmdbStoryData;
  onInteract?: () => void;
}

export const RelatedPage: React.FC<RelatedPageProps> = ({
  data,
  onInteract,
}) => {
  const colors = useM3Colors();

  return (
    <>
      <SectionHeading icon="movie-filter-outline" title="Recommendations" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {(data.relatedTitles ?? []).map(item => {
          return (
            <TVFocusable
              key={item.id}
              borderRadius={22}
              focusScale={1.03}
              onPress={() => {
                onInteract?.();
                if (item.id) {
                  Linking.openURL(`https://www.imdb.com/title/${item.id}/`);
                }
              }}
              style={{
                backgroundColor: colors.surfaceContainerLow,
                borderRadius: 22,
                flexBasis: isTV ? undefined : '47%',
                flexGrow: isTV ? 0 : 1,
                overflow: 'hidden',
                width: isTV ? 170 : undefined,
              }}>
              {item.image ? (
                <Image
                  source={{ uri: item.image }}
                  resizeMode="cover"
                  style={{
                    aspectRatio: 0.72,
                    backgroundColor: colors.surfaceContainer,
                    width: '100%',
                  }}
                />
              ) : (
                <View
                  style={{
                    alignItems: 'center',
                    aspectRatio: 0.72,
                    backgroundColor: colors.surfaceContainer,
                    justifyContent: 'center',
                    width: '100%',
                  }}>
                  <MaterialCommunityIcons
                    name="movie-open-outline"
                    size={64}
                    color={colors.outline}
                  />
                </View>
              )}
              <View style={{ padding: 12 }}>
                <AppText
                  role="labelLargeEmphasized"
                  numberOfLines={2}
                  style={{ color: colors.onSurface }}>
                  {item.title}
                </AppText>
                {formatRating(item.rating) ? (
                  <View
                    style={{
                      alignItems: 'center',
                      flexDirection: 'row',
                      gap: 4,
                      marginTop: 4,
                    }}>
                    <MaterialCommunityIcons
                      name="star"
                      size={14}
                      color="#f5c518"
                    />
                    <AppText
                      role="labelMediumEmphasized"
                      style={{ color: colors.onSurfaceVariant }}>
                      {formatRating(item.rating)}
                    </AppText>
                  </View>
                ) : null}
              </View>
            </TVFocusable>
          );
        })}
      </View>
    </>
  );
};

export default RelatedPage;
