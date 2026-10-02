import {isRemotePlaybackCanceled} from '../../lib/remote/remotePlaybackErrors';
import * as DocumentPicker from 'expo-document-picker';
import React, {useState} from 'react';
import SearchSubtitles, {FoundSubtitle} from '../SearchSubtitles';
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
  /** Starting text for the online subtitle search. */
  subtitleSearchQuery?: string;
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
  subtitleSearchQuery,
}) => {
  const [searchQuery, setSearchQuery] = useState(subtitleSearchQuery || '');
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

  const addSubtitle = (track: Pick<FoundSubtitle, 'uri' | 'title' | 'language'>) => {
    onClose();
    // The manager reports failures on the remote screen.
    remotePlaybackManager.addExternalSubtitle(track).catch(() => {});
  };

  const pickSubtitleFile = async () => {
    try {
      // The picker copies the file into the app cache, the only local
      // folder the phone server shares with the receiver.
      const res = await DocumentPicker.getDocumentAsync({
        type: [
          'text/vtt',
          'application/x-subrip',
          'text/srt',
          'application/ttml+xml',
          'text/plain',
          'application/octet-stream',
        ],
        multiple: false,
        copyToCacheDirectory: true,
      });
      const asset = !res.canceled ? res.assets?.[0] : undefined;
      if (!asset) return;
      addSubtitle({
        uri: asset.uri,
        title: asset.name || 'External subtitle',
        language: 'und',
      });
    } catch (error: any) {
      useRemoteStore
        .getState()
        .setErrorMessage(error?.message || 'Could not open the subtitle file');
    }
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
            <RemoteSheetSectionLabel text="Add subtitles" />
            <RemoteSheetOption
              icon="file-document-outline"
              title="Add external file"
              supportingText="SRT, VTT or TTML from this phone"
              onPress={pickSubtitleFile}
            />
            <SearchSubtitles
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              onAddSubtitle={addSubtitle}
              renderTrigger={open => (
                <RemoteSheetOption
                  icon="earth"
                  title="Search subtitles online"
                  supportingText="Find a subtitle from OpenSubtitles"
                  onPress={open}
                />
              )}
            />
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
