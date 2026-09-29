import React from 'react';
import {View} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Text from '../ui/Text';
import {TVFocusable} from '../tv';
import {formatTime} from '../media-console/utils';
import {getEpisodeIdentity} from '../../lib/utils/episodeIdentity';
import type {EpisodeLink} from '../../lib/providers/types';
import type {ContinueWatchingItem} from '../../lib/zustand/continueWatchingStore';

// Past this point the episode counts as watched, so there is nothing to resume.
const WATCHED_RATIO = 0.95;

/**
 * Index of the saved Continue Watching episode in the loaded list, or -1 when
 * it is not in this season or there is nothing left to resume.
 */
export const findResumeEpisodeIndex = (
  episodes: EpisodeLink[],
  item?: ContinueWatchingItem,
): number => {
  if (!item?.episode || item.position <= 0) {
    return -1;
  }
  if (item.duration > 0 && item.position / item.duration >= WATCHED_RATIO) {
    return -1;
  }
  const savedIdentity = getEpisodeIdentity(item.episode);
  return episodes.findIndex(
    episode =>
      episode.link === item.episode.link ||
      (Boolean(savedIdentity) && getEpisodeIdentity(episode) === savedIdentity),
  );
};

interface ResumeEpisodeButtonProps {
  title: string;
  position: number;
  duration: number;
  accentColor: string;
  focusBorderColor: string;
  onPress: () => void;
}

const ResumeEpisodeButton: React.FC<ResumeEpisodeButtonProps> = ({
  title,
  position,
  duration,
  accentColor,
  focusBorderColor,
  onPress,
}) => {
  const time = formatTime({
    time: position,
    duration: duration > 0 ? duration : position,
    showDuration: false,
    showTimeRemaining: false,
    showHours: position >= 3600,
  });

  return (
    <TVFocusable
      accessibilityRole="button"
      accessibilityLabel={`Resume ${title} at ${time}`}
      focusBorderColor={focusBorderColor}
      focusScale={1}
      borderRadius={14}
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginTop: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderRadius: 14,
        backgroundColor: accentColor,
      }}>
      <MaterialCommunityIcons name="play" size={24} color="#000000" />
      <View style={{flex: 1}}>
        <Text
          role="labelLargeEmphasized"
          numberOfLines={1}
          style={{color: '#000000'}}>
          Resume {title}
        </Text>
        <Text role="labelMedium" style={{color: '#000000', opacity: 0.7}}>
          From {time}
        </Text>
      </View>
    </TVFocusable>
  );
};

export default ResumeEpisodeButton;
