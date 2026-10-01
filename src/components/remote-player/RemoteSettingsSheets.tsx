import {isRemotePlaybackCanceled} from '../../lib/remote/remotePlaybackErrors';
import React from 'react';
import {useRemoteStore} from '../../lib/remote/remoteStore';
import {remotePlaybackManager} from '../../lib/remote/remotePlaybackManager';
import {
  RemoteAudioTrack,
  RemoteQuality,
  RemoteServer,
  RemoteSubtitleTrack,
} from '../../lib/remote/types';
import {EpisodeLink} from '../../lib/providers/types';
import {isTV} from '../../lib/tv';
import {
  RemoteSheet,
  RemoteSheetEmpty,
  RemoteSheetOption,
  RemoteSheetSectionLabel,
} from './RemoteSheet';

const qualityDetail = (q: RemoteQuality): string =>
  [
    q.bitrate
      ? q.bitrate >= 1e6
        ? `${(q.bitrate / 1e6).toFixed(1)} Mbps`
        : `${Math.round(q.bitrate / 1e3)} kbps`
      : undefined,
    q.width && q.height ? `${q.width}Ã—${q.height}` : q.resolution,
  ]
    .filter(Boolean)
    .join(' · ');

const qualityIcon = (
  q: RemoteQuality,
): 'video-4k-box' | 'high-definition' | 'standard-definition' =>
  (q.height ?? 0) >= 2160
    ? 'video-4k-box'
    : (q.height ?? 0) >= 720
      ? 'high-definition'
      : 'standard-definition';

export type RemoteSheetType =
  | 'server'
  | 'audio'
  | 'subtitles'
  | 'quality'
  | 'speed'
  | 'episodes';

interface RemoteSettingsSheetsProps {
  sheetType: RemoteSheetType | null;
  onClose: () => void;
  episodes?: EpisodeLink[];
  activeEpisodeIndex?: number;
  onSelectEpisode?: (index: number) => void;
  onSelectServer?: (server: RemoteServer) => void;
  onSelectAudio?: (track: RemoteAudioTrack) => void;
  onSelectSubtitle?: (track?: RemoteSubtitleTrack) => void;
  onSelectQuality?: (q: RemoteQuality) => void;
}

const SPEEDS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

const TITLES: Record<RemoteSheetType, string> = {
  server: 'Server',
  audio: 'Audio',
  subtitles: 'Subtitles',
  quality: 'Quality',
  speed: 'Playback speed',
  episodes: 'Episodes',
};

const languageLabel = (language?: string) =>
  language && language !== 'und' ? language.toUpperCase() : '';

export const RemoteSettingsSheets: React.FC<RemoteSettingsSheetsProps> = ({
  sheetType,
  onClose,
  episodes,
  activeEpisodeIndex,
  onSelectEpisode,
  onSelectServer,
  onSelectAudio,
  onSelectSubtitle,
  onSelectQuality,
}) => {
  const servers = useRemoteStore(state => state.servers);
  const activeServerId = useRemoteStore(state => state.activeServerId);
  const audioTracks = useRemoteStore(state => state.audioTracks);
  const activeAudioTrackId = useRemoteStore(state => state.activeAudioTrackId);
  const subtitleTracks = useRemoteStore(state => state.subtitleTracks);
  const activeSubtitleTrackId = useRemoteStore(
    state => state.activeSubtitleTrackId,
  );
  const qualities = useRemoteStore(state => state.qualities);
  const activeQualityId = useRemoteStore(state => state.activeQualityId);
  const playbackRate = useRemoteStore(state => state.playbackRate);
  const connectedDevice = useRemoteStore(state => state.connectedDevice);

  if (isTV) return null;

  const select = (action: () => void) => {
    action();
    onClose();
  };

  const handleSelectSpeed = (speed: number) => {
    const client = remotePlaybackManager.getCastClient();
    if (!client || connectedDevice?.type !== 'cast') {
      useRemoteStore
        .getState()
        .setErrorMessage('Playback speed is unavailable on this receiver');
      return;
    }
    client
      .setPlaybackRate(speed)
      .then(() => useRemoteStore.getState().setPlaybackRate(speed))
      .catch((error: Error) => {
        if (!isRemotePlaybackCanceled(error))
          useRemoteStore.getState().setErrorMessage(error.message || 'Unable to change playback speed');
      });
  };

  const renderContent = () => {
    switch (sheetType) {
      case 'server': {
        const qualityRows = qualities.map((q, i) => (
          <RemoteSheetOption
            key={`q-${q.id || i}`}
            icon={qualityIcon(q)}
            title={q.height ? `${q.height}p` : q.label}
            supportingText={qualityDetail(q)}
            selected={q.id === activeQualityId}
            onPress={() => select(() => onSelectQuality?.(q))}
          />
        ));
        return (
          <>
            <RemoteSheetSectionLabel text="Server" />
            {servers.length === 0 ? (
              <RemoteSheetEmpty text="No other servers for this title" />
            ) : (
              servers.map((server, i) => (
                <RemoteSheetOption
                  key={server.id || i}
                  icon="dns"
                  title={server.name}
                  supportingText={[
                    server.quality,
                    ...(server.tags || []).filter(
                      t => t && t !== server.quality,
                    ),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  selected={server.id === activeServerId}
                  onPress={() =>
                    select(() => {
                      useRemoteStore.getState().setActiveServerId(server.id);
                      onSelectServer?.(server);
                    })
                  }
                />
              ))
            )}
            {qualities.length > 1 && (
              <>
                <RemoteSheetSectionLabel text="Quality" />
                {qualityRows}
              </>
            )}
          </>
        );
      }

      case 'quality':
        return qualities.length === 0 ? (
          <RemoteSheetEmpty text="This stream has a single quality" />
        ) : (
          qualities.map((q, i) => (
            <RemoteSheetOption
              key={q.id || i}
              icon={qualityIcon(q)}
              title={q.height ? `${q.height}p` : q.label}
              supportingText={qualityDetail(q)}
              selected={q.id === activeQualityId}
              onPress={() => select(() => onSelectQuality?.(q))}
            />
          ))
        );

      case 'audio':
        return audioTracks.length === 0 ? (
          <RemoteSheetEmpty text="Reading audio tracksâ€¦" />
        ) : (
          audioTracks.map((track, i) => {
            const language = languageLabel(track.language);
            return (
              <RemoteSheetOption
                key={track.id || i}
                title={track.title || language || `Track ${i + 1}`}
                supportingText={[language, track.codec]
                  .filter(Boolean)
                  .join(' · ')}
                selected={
                  activeAudioTrackId
                    ? track.id === activeAudioTrackId
                    : Boolean(track.isSelected)
                }
                onPress={() =>
                  select(() =>
                    onSelectAudio
                      ? onSelectAudio(track)
                      : remotePlaybackManager
                          .switchAudioTrack(track)
                          .catch(() => {}),
                  )
                }
              />
            );
          })
        );

      case 'subtitles':
        return (
          <>
            <RemoteSheetOption
              title="Off"
              selected={!activeSubtitleTrackId}
              onPress={() => select(() => onSelectSubtitle?.(undefined))}
            />
            {subtitleTracks.map((sub, i) => {
              const language = languageLabel(sub.language);
              return (
                <RemoteSheetOption
                  key={sub.id || i}
                  title={sub.title || language || `Subtitle ${i + 1}`}
                  supportingText={[
                    language,
                    sub.isEmbedded ? 'Embedded' : 'External',
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  selected={sub.id === activeSubtitleTrackId}
                  onPress={() => select(() => onSelectSubtitle?.(sub))}
                />
              );
            })}
          </>
        );

      case 'speed':
        return SPEEDS.map(speed => (
          <RemoteSheetOption
            key={speed}
            title={speed === 1 ? 'Normal' : `${speed}x`}
            selected={playbackRate === speed}
            onPress={() => select(() => handleSelectSpeed(speed))}
          />
        ));

      case 'episodes':
        return !episodes || episodes.length === 0 ? (
          <RemoteSheetEmpty text="No episodes available" />
        ) : (
          episodes.map((ep, i) => (
            <RemoteSheetOption
              key={ep.id || ep.link || i}
              thumbnail={ep.image}
              icon="play-circle"
              thumbnailPlaceholder
              title={ep.title || `Episode ${i + 1}`}
              supportingText={ep.description}
              selected={i === activeEpisodeIndex}
              onPress={() => select(() => onSelectEpisode?.(i))}
            />
          ))
        );

      default:
        return null;
    }
  };

  return (
    <RemoteSheet
      visible={Boolean(sheetType)}
      title={sheetType ? TITLES[sheetType] : ''}
      onClose={onClose}>
      {renderContent()}
    </RemoteSheet>
  );
};
