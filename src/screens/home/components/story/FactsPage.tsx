import React from 'react';
import { View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import AppText from '../../../../components/ui/Text';
import { useM3Colors } from '../../../../theme/M3PaletteContext';
import type { TmdbStoryData } from '../../../../lib/hooks/useTmdbStory';
import {
  ChipList,
  formatCount,
  formatRating,
  formatRuntime,
  SectionHeading,
} from './storyUtils';

interface FactsPageProps {
  data: TmdbStoryData;
}

const FactCard = ({
  icon,
  label,
  value,
}: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string;
  value: string;
}) => {
  const colors = useM3Colors();

  return (
    <View
      style={{
        backgroundColor: colors.surfaceContainerLow,
        borderColor: colors.outlineVariant,
        borderRadius: 20,
        borderWidth: 1,
        flexBasis: '47%',
        flexGrow: 1,
        minHeight: 108,
        padding: 16,
      }}>
      <MaterialCommunityIcons name={icon} size={26} color={colors.primary} />
      <AppText
        role="titleMediumEmphasized"
        style={{ color: colors.onSurface, marginTop: 12 }}>
        {value}
      </AppText>
      <AppText
        role="bodySmall"
        style={{ color: colors.onSurfaceVariant, marginTop: 3 }}>
        {label}
      </AppText>
    </View>
  );
};

export const FactsPage: React.FC<FactsPageProps> = ({ data }) => {
  const colors = useM3Colors();
  const facts = [
    data.trendingRank
      ? {
        icon: 'trending-up' as const,
        label: 'Trending this week',
        value: `#${data.trendingRank}`,
      }
      : null,
    formatRating(data.rating)
      ? {
        icon: 'star-outline' as const,
        label: `${formatCount(data.voteCount) || 'TMDB'} votes`,
        value: `${formatRating(data.rating)}/10`,
      }
      : null,
    data.metascore
      ? {
        icon: 'pound' as const,
        label: 'Metascore',
        value: `${data.metascore}`,
      }
      : null,
    data.certification
      ? {
        icon: 'shield-outline' as const,
        label: 'Content rating',
        value: data.certification,
      }
      : null,
    data.releaseDate
      ? {
        icon: 'calendar-blank-outline' as const,
        label: 'Released',
        value: data.releaseDate.slice(0, 4),
      }
      : null,
    data.runtime
      ? {
        icon: 'clock-outline' as const,
        label: data.mediaType === 'tv' ? 'Episode runtime' : 'Runtime',
        value: formatRuntime(data.runtime) || '',
      }
      : null,
    data.status
      ? {
        icon: 'information-outline' as const,
        label: 'Status',
        value: data.status,
      }
      : null,
    data.watchlistCount
      ? {
        icon: 'account-group-outline' as const,
        label: 'Watchlist',
        value: data.watchlistCount.replace('Added by ', ''),
      }
      : null,
    data.totalSeasons
      ? {
        icon: 'television' as const,
        label: 'Seasons',
        value: `${data.totalSeasons} ${data.totalSeasons === 1 ? 'season' : 'seasons'}`,
      }
      : null,
    data.totalEpisodes
      ? {
        icon: 'television-play' as const,
        label: 'Episodes',
        value: `${data.totalEpisodes} ${data.totalEpisodes === 1 ? 'episode' : 'episodes'}`,
      }
      : null,
    data.upcomingSeason
      ? {
        icon: 'calendar-clock' as const,
        label: 'Upcoming',
        value: data.upcomingSeason,
      }
      : null,
  ].filter(Boolean) as {
    icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
    label: string;
    value: string;
  }[];

  return (
    <>
      <SectionHeading icon="chart-box-outline" title="Ratings & facts" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {facts.map(fact => (
          <FactCard
            key={`${fact.label}-${fact.value}`}
            icon={fact.icon}
            label={fact.label}
            value={fact.value}
          />
        ))}
      </View>

      {data.awardsText ? (
        <View style={{ marginTop: 26 }}>
          <AppText
            role="titleMediumEmphasized"
            style={{ color: colors.onBackground, marginBottom: 8 }}>
            Awards
          </AppText>
          <View
            style={{
              backgroundColor: colors.surfaceContainerLow,
              borderColor: colors.outlineVariant,
              borderRadius: 18,
              borderWidth: 1,
              padding: 14,
            }}>
            <AppText role="bodyMedium" style={{ color: colors.onSurface }}>
              {data.awardsText}
            </AppText>
          </View>
        </View>
      ) : null}

      {data.creators.length ? (
        <View style={{ marginTop: 30 }}>
          <AppText
            role="titleMediumEmphasized"
            style={{ color: colors.onBackground, marginBottom: 10 }}>
            {data.mediaType === 'tv' ? 'Created by' : 'Directed by'}
          </AppText>
          <ChipList items={data.creators} />
        </View>
      ) : null}
      {data.genres.length ? (
        <View style={{ marginTop: 26 }}>
          <AppText
            role="titleMediumEmphasized"
            style={{ color: colors.onBackground, marginBottom: 10 }}>
            Genres
          </AppText>
          <ChipList items={data.genres} />
        </View>
      ) : null}
      {data.keywords.length ? (
        <View style={{ marginTop: 26 }}>
          <AppText
            role="titleMediumEmphasized"
            style={{ color: colors.onBackground, marginBottom: 10 }}>
            Themes
          </AppText>
          <ChipList items={data.keywords} />
        </View>
      ) : null}
      {data.companies.length || data.networks.length ? (
        <View style={{ marginTop: 26 }}>
          <AppText
            role="titleMediumEmphasized"
            style={{ color: colors.onBackground, marginBottom: 8 }}>
            Studios & networks
          </AppText>
          <AppText
            role="bodyMedium"
            style={{
              color: colors.onSurfaceVariant,
              lineHeight: 22,
            }}>
            {[...data.networks, ...data.companies].slice(0, 6).join(' · ')}
          </AppText>
        </View>
      ) : null}
      {data.countries.length || data.originalLanguage ? (
        <AppText
          role="bodyMedium"
          style={{
            color: colors.outline,
            lineHeight: 22,
            marginTop: 22,
          }}>
          {[...data.countries, data.originalLanguage]
            .filter(Boolean)
            .join(' · ')}
        </AppText>
      ) : null}
    </>
  );
};

export default FactsPage;
