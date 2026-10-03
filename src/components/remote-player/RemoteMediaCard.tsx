import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React, {useEffect, useState} from 'react';
import {Image, View} from 'react-native';
import AppText from '../ui/Text';
import {useRemoteStore} from '../../lib/remote/remoteStore';
import {useM3Colors} from '../../theme/M3PaletteContext';
import {isTV} from '../../lib/tv';

interface RemoteMediaCardProps {
  title?: string;
  subtitle?: string;
  poster?: string;
}

/** Poster takes whatever height is left, so it never collides with the header or controls. */
export const RemoteMediaCard: React.FC<RemoteMediaCardProps> = ({
  title,
  subtitle,
  poster,
}) => {
  const colors = useM3Colors();
  const servers = useRemoteStore(state => state.servers);
  const activeServerId = useRemoteStore(state => state.activeServerId);
  const audioTracks = useRemoteStore(state => state.audioTracks);
  const activeAudioTrackId = useRemoteStore(state => state.activeAudioTrackId);
  const [artworkSize, setArtworkSize] = useState<{uri: string; ratio: number} | null>(null);
  const [availableSize, setAvailableSize] = useState({width: 0, height: 0});

  useEffect(() => {
    if (!poster) return;
    let cancelled = false;
    Image.getSize(poster, (width, height) => {
      if (!cancelled && width > 0 && height > 0) {
        setArtworkSize({uri: poster, ratio: width / height});
      }
    }, () => {});
    return () => { cancelled = true; };
  }, [poster]);

  if (isTV) return null;

  const serverName = servers.find(s => s.id === activeServerId)?.name;
  const audio = audioTracks.find(a => a.id === activeAudioTrackId);
  const details = [subtitle, serverName, audio?.title].filter(Boolean).join(' · ');
  const aspectRatio = artworkSize && artworkSize.uri === poster ? artworkSize.ratio : 2 / 3;
  const artworkHeight = Math.max(0, Math.min(420, availableSize.height - 32, availableSize.width / aspectRatio));

  return (
    <View style={{flex: 1, paddingHorizontal: 24}}>
      <View
        onLayout={event => setAvailableSize(event.nativeEvent.layout)}
        style={{
          alignItems: 'center',
          flex: 1,
          justifyContent: 'center',
          minHeight: 0,
          paddingVertical: 16,
        }}>
        <View
          style={{
            alignItems: 'center',
            aspectRatio,
            backgroundColor: colors.surfaceContainerHigh,
            borderRadius: 28,
            height: artworkHeight,
            justifyContent: 'center',
            maxHeight: 420,
            overflow: 'hidden',
          }}>
          {/* resizeMethod="resize" decodes at the size measured on load. The
              card starts at height 0, so the poster was decoded tiny and shown
              blurry. Use "scale" and mount only after layout. */}
          {poster && artworkHeight > 0 ? (
            <Image
              source={{uri: poster}}
              resizeMode="contain"
              resizeMethod="scale"
              onLoad={event => {
                const {width, height} = event.nativeEvent.source;
                if (width > 0 && height > 0) setArtworkSize({uri: poster, ratio: width / height});
              }}
              style={{height: '100%', width: '100%'}}
            />
          ) : poster ? null : (
            <MaterialCommunityIcons
              name="movie-open-outline"
              size={56}
              color={colors.onSurfaceVariant}
            />
          )}
        </View>
      </View>

      <AppText
        role="titleLarge"
        numberOfLines={1}
        style={{color: colors.onSurface, textAlign: 'center'}}>
        {title || 'Untitled'}
      </AppText>
      {!!details && (
        <AppText
          role="bodyMedium"
          numberOfLines={1}
          style={{color: colors.onSurfaceVariant, marginTop: 2, textAlign: 'center'}}>
          {details}
        </AppText>
      )}
    </View>
  );
};
