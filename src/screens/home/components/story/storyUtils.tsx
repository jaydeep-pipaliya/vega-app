import React from 'react';
import { View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import AppText from '../../../../components/ui/Text';
import { useM3Colors } from '../../../../theme/M3PaletteContext';

export interface StoryPage {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  key: string;
  title: string;
}

export const getTmdbImage = (
  path?: string,
  size: 'w342' | 'w780' | 'original' = 'w780',
): string | undefined => {
  if (!path) {
    return undefined;
  }
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  return `https://image.tmdb.org/t/p/${size}${path}`;
};

export const formatCount = (value?: number): string | undefined => {
  if (!value) {
    return undefined;
  }
  return new Intl.NumberFormat('en', { notation: 'compact' }).format(value);
};

export const formatCurrency = (value?: number): string | undefined => {
  if (!value && value !== 0) {
    return undefined;
  }
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) {
    const formatted = (value / 1_000_000_000).toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    });
    return `$${formatted}B`;
  }
  if (abs >= 1_000_000) {
    const formatted = (value / 1_000_000).toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    });
    return `$${formatted}M`;
  }
  if (abs >= 1_000) {
    const formatted = (value / 1_000).toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    });
    return `$${formatted}K`;
  }
  return `$${value.toLocaleString('en-US')}`;
};

export const formatRuntime = (minutes?: number): string | undefined => {
  if (!minutes) {
    return undefined;
  }
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return hours ? `${hours}h ${remaining}m` : `${remaining}m`;
};

export const formatRating = (value?: number | string): string | undefined => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  const num = typeof value === 'number' ? value : parseFloat(String(value));
  if (isNaN(num)) {
    return undefined;
  }
  return num.toFixed(1);
};

export const SectionHeading = ({
  icon,
  title,
}: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  title: string;
}) => {
  const colors = useM3Colors();

  return (
    <View
      style={{
        alignItems: 'center',
        flexDirection: 'row',
        gap: 10,
        marginBottom: 18,
      }}>
      <MaterialCommunityIcons name={icon} size={26} color={colors.primary} />
      <AppText role="titleLargeEmphasized" style={{ color: colors.onBackground }}>
        {title}
      </AppText>
    </View>
  );
};

export const ChipList = ({ items }: { items: string[] }) => {
  const colors = useM3Colors();

  if (!items.length) {
    return null;
  }

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {items.map(item => (
        <View
          key={item}
          style={{
            backgroundColor: colors.surfaceContainerHigh,
            borderColor: colors.outlineVariant,
            borderRadius: 16,
            borderWidth: 1,
            paddingHorizontal: 12,
            paddingVertical: 7,
          }}>
          <AppText
            role="labelMediumEmphasized"
            style={{ color: colors.onSurface }}>
            {item}
          </AppText>
        </View>
      ))}
    </View>
  );
};
