import React from 'react';
import { Image, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import AppText from '../../../../components/ui/Text';
import { useM3Colors } from '../../../../theme/M3PaletteContext';
import type {
  TmdbStoryCollectionItem,
  TmdbStoryData,
} from '../../../../lib/hooks/useTmdbStory';
import { getTmdbImage, SectionHeading } from './storyUtils';

interface CollectionPageProps {
  data: TmdbStoryData;
}

const CollectionRow = ({ item }: { item: TmdbStoryCollectionItem }) => {
  const colors = useM3Colors();
  const image = getTmdbImage(item.imagePath, 'w342');

  return (
    <View
      style={{
        alignItems: 'center',
        backgroundColor: colors.surfaceContainerLow,
        borderRadius: 22,
        flexDirection: 'row',
        marginBottom: 12,
        minHeight: 118,
        overflow: 'hidden',
      }}>
      {image ? (
        <Image
          source={{ uri: image }}
          resizeMode="cover"
          resizeMethod="resize"
          style={{
            alignSelf: 'stretch',
            backgroundColor: colors.surfaceContainer,
            width: 82,
          }}
        />
      ) : (
        <View
          style={{
            alignItems: 'center',
            alignSelf: 'stretch',
            backgroundColor: colors.surfaceContainer,
            justifyContent: 'center',
            width: 82,
          }}>
          <MaterialCommunityIcons
            name="movie-open-outline"
            size={34}
            color={colors.outline}
          />
        </View>
      )}
      <View style={{ flex: 1, padding: 16 }}>
        <AppText role="titleMediumEmphasized" style={{ color: colors.onSurface }}>
          {item.title}
        </AppText>
        {item.subtitle ? (
          <AppText
            role="bodyMedium"
            style={{ color: colors.onSurfaceVariant, marginTop: 5 }}>
            {item.subtitle}
          </AppText>
        ) : null}
      </View>
    </View>
  );
};

export const CollectionPage: React.FC<CollectionPageProps> = ({ data }) => (
  <>
    <SectionHeading
      icon={
        data.mediaType === 'tv'
          ? 'television-classic'
          : 'filmstrip-box-multiple'
      }
      title={
        data.collectionTitle ||
        (data.mediaType === 'tv' ? 'Seasons' : 'Collection')
      }
    />
    {data.collectionItems.map(item => (
      <CollectionRow key={item.id} item={item} />
    ))}
  </>
);

export default CollectionPage;
