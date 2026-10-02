import React from 'react';
import {ScrollView, View} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import {useM3Colors} from '../theme/M3PaletteContext';
import {useTVFocusBorderColor} from '../lib/tv/useTVFocusBorderColor';
import {EpisodeRange} from '../lib/utils/episodeRanges';
import {TVFocusable} from './tv';
import Text from './ui/Text';

export interface ResumeTarget {
  mode: 'resume' | 'next' | 'start';
  title: string;
  /** Season label shown before the title, when it differs from the open one. */
  seasonTitle?: string;
  /** Watched fraction, 0 to 1. */
  progress?: number;
  /** Seconds left, for the "left" label. */
  remainingSeconds?: number;
}

const HEADINGS: Record<ResumeTarget['mode'], string> = {
  resume: 'Resume',
  next: 'Up next',
  start: 'Start watching',
};

const formatRemaining = (seconds: number) => {
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes}m left`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m left` : `${hours}h left`;
};

/** Wide primary button at the top of the episode list. */
export const EpisodeResumeCard = React.forwardRef<
  View,
  {target: ResumeTarget; onPress: () => void}
>(({target, onPress}, ref) => {
  const colors = useM3Colors();
  const focusBorderColor = useTVFocusBorderColor();
  const details = [
    target.seasonTitle,
    target.title,
    target.mode === 'resume' && target.remainingSeconds
      ? formatRemaining(target.remainingSeconds)
      : undefined,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <TVFocusable
      ref={ref}
      accessibilityRole="button"
      accessibilityLabel={`${HEADINGS[target.mode]} ${details}`}
      borderRadius={20}
      focusScale={1.02}
      focusBorderColor={focusBorderColor}
      onPress={onPress}
      style={{
        backgroundColor: colors.primary,
        borderRadius: 20,
        marginBottom: 14,
        overflow: 'hidden',
      }}>
      <View
        style={{
          alignItems: 'center',
          flexDirection: 'row',
          gap: 14,
          paddingHorizontal: 18,
          paddingVertical: 14,
        }}>
        <Ionicons
          name={target.mode === 'next' ? 'play-skip-forward' : 'play'}
          size={26}
          color={colors.onPrimary}
        />
        <View style={{flex: 1}}>
          <Text
            role="titleMedium"
            style={{color: colors.onPrimary, fontWeight: '700'}}>
            {HEADINGS[target.mode]}
          </Text>
          <Text
            role="bodyMedium"
            numberOfLines={1}
            style={{color: colors.onPrimary, opacity: 0.85}}>
            {details}
          </Text>
        </View>
      </View>
      {target.mode === 'resume' && target.progress !== undefined && (
        <View style={{backgroundColor: 'rgba(0,0,0,0.10)', height: 4}}>
          <View
            style={{
              backgroundColor: 'rgba(0,0,0,0.24)',
              height: 4,
              width: `${Math.min(100, Math.max(2, target.progress * 100))}%`,
            }}
          />
        </View>
      )}
    </TVFocusable>
  );
});

/** Row of chips that picks which block of 50 episodes the list shows. */
export const EpisodeRangeChips: React.FC<{
  ranges: EpisodeRange[];
  selectedStart: number;
  onSelect: (range: EpisodeRange) => void;
}> = ({ranges, selectedStart, onSelect}) => {
  const colors = useM3Colors();
  const focusBorderColor = useTVFocusBorderColor();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{gap: 8, paddingVertical: 4}}
      style={{marginTop: 8}}>
      {ranges.map(range => {
        const selected = range.start === selectedStart;
        const label = `${range.start + 1}–${range.end}`;
        return (
          <TVFocusable
            key={range.start}
            accessibilityRole="button"
            accessibilityLabel={`Episodes ${label}`}
            accessibilityState={{selected}}
            borderRadius={16}
            focusScale={1}
            focusBorderColor={focusBorderColor}
            onPress={() => onSelect(range)}
            style={{
              backgroundColor: selected
                ? colors.secondaryContainer
                : colors.surfaceContainerHigh,
              borderColor: selected ? 'transparent' : colors.outlineVariant,
              borderRadius: 16,
              borderWidth: 1,
              paddingHorizontal: 16,
              paddingVertical: 8,
            }}>
            <Text
              role="labelLarge"
              style={{
                color: selected
                  ? colors.onSecondaryContainer
                  : colors.onSurfaceVariant,
              }}>
              {label}
            </Text>
          </TVFocusable>
        );
      })}
    </ScrollView>
  );
};
