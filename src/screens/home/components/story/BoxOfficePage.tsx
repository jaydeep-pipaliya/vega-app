import React from 'react';
import { View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import AppText from '../../../../components/ui/Text';
import { useM3Colors } from '../../../../theme/M3PaletteContext';
import type { TmdbStoryData } from '../../../../lib/hooks/useTmdbStory';
import { formatCurrency, SectionHeading } from './storyUtils';

interface BoxOfficePageProps {
  data: TmdbStoryData;
}

export const BoxOfficePage: React.FC<BoxOfficePageProps> = ({ data }) => {
  const colors = useM3Colors();
  const stats = [
    {
      icon: 'currency-usd' as const,
      label: 'Budget',
      value: data.productionBudget,
    },
    {
      icon: 'calendar-outline' as const,
      label: 'Opening Weekend',
      value: data.openingWeekendGross,
    },
    {
      icon: 'chart-bar' as const,
      label: 'Domestic',
      value: data.domesticGross,
    },
    {
      icon: 'earth' as const,
      label: 'Worldwide',
      value: data.worldwideGross,
    },
  ].filter(s => Boolean(s.value));

  const maxValue = Math.max(...stats.map(s => s.value || 0), 1);
  const roi =
    data.productionBudget && data.worldwideGross
      ? (data.worldwideGross / data.productionBudget) * 100 - 100
      : undefined;
  const isProfit = roi !== undefined && roi >= 0;

  return (
    <>
      <SectionHeading icon="currency-usd" title="Box Office" />
      <View
        style={{
          backgroundColor: colors.surfaceContainerLow,
          borderColor: colors.outlineVariant,
          borderRadius: 22,
          borderWidth: 1,
          gap: 14,
          padding: 18,
        }}>
        {stats.map(item => {
          const pct =
            maxValue > 0 && item.value
              ? Math.max(Math.round((item.value / maxValue) * 100), 4)
              : 0;
          return (
            <View
              key={item.label}
              style={{
                alignItems: 'center',
                flexDirection: 'row',
                gap: 12,
                justifyContent: 'space-between',
              }}>
              <View
                style={{
                  alignItems: 'center',
                  flexDirection: 'row',
                  gap: 6,
                  width: 145,
                }}>
                <MaterialCommunityIcons
                  name={item.icon}
                  size={18}
                  color={colors.primary}
                />
                <AppText
                  numberOfLines={1}
                  role="labelMediumEmphasized"
                  style={{ color: colors.onSurfaceVariant }}>
                  {item.label}
                </AppText>
              </View>
              <View
                style={{
                  backgroundColor: colors.surfaceContainer,
                  borderRadius: 4,
                  flex: 1,
                  height: 6,
                  marginHorizontal: 8,
                  overflow: 'hidden',
                }}>
                <View
                  style={{
                    backgroundColor: colors.primary,
                    borderRadius: 4,
                    height: '100%',
                    width: `${pct}%`,
                  }}
                />
              </View>
              <AppText
                role="titleMediumEmphasized"
                style={{
                  color: colors.onSurface,
                  minWidth: 70,
                  textAlign: 'right',
                }}>
                {formatCurrency(item.value)}
              </AppText>
            </View>
          );
        })}
      </View>

      {roi !== undefined && (
        <View
          style={{
            alignItems: 'center',
            backgroundColor: colors.surfaceContainerLow,
            borderColor: colors.outlineVariant,
            borderRadius: 22,
            borderWidth: 1,
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginTop: 14,
            paddingHorizontal: 20,
            paddingVertical: 16,
          }}>
          <AppText
            role="titleMediumEmphasized"
            style={{ color: colors.onSurface }}>
            Return on Investment
          </AppText>
          <AppText
            role="headlineMediumEmphasized"
            style={{
              color: isProfit ? '#22c55e' : '#ef4444',
              fontWeight: 'bold',
            }}>
            {isProfit ? `+${roi.toFixed(0)}%` : `${roi.toFixed(0)}%`}
          </AppText>
        </View>
      )}
    </>
  );
};

export default BoxOfficePage;
