import React, { useMemo, useState } from 'react';
import { Linking, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { WebView } from 'react-native-webview';
import AppText from '../../../../components/ui/Text';
import { useM3Colors } from '../../../../theme/M3PaletteContext';
import type { TmdbStoryData } from '../../../../lib/hooks/useTmdbStory';
import { TVFocusable } from '../../../../components/tv';
import { SectionHeading } from './storyUtils';

interface TrailerPageProps {
  active: boolean;
  data: TmdbStoryData;
  onInteract?: () => void;
}

export const TrailerPage: React.FC<TrailerPageProps> = ({
  active,
  data,
  onInteract,
}) => {
  const colors = useM3Colors();
  const trailers = useMemo(() => {
    if (data.trailers && data.trailers.length > 0) return data.trailers;
    if (data.trailerUrl)
      return [
        {
          id: 'primary-mp4',
          name: data.trailerName,
          url: data.trailerUrl,
          thumbnail: data.trailerThumbnail,
        },
      ];
    if (data.trailerKey)
      return [
        { id: 'primary-yt', name: data.trailerName, youtubeKey: data.trailerKey },
      ];
    return [];
  }, [data]);

  const [activeTrailerIndex, setActiveTrailerIndex] = useState(0);
  const activeVideo = trailers[activeTrailerIndex] ?? trailers[0];

  const youtubeOrigin = 'https://vega.app';
  const trailerUrl = activeVideo?.youtubeKey
    ? `https://www.youtube.com/embed/${encodeURIComponent(
      activeVideo.youtubeKey,
    )}?playsinline=1&rel=0&modestbranding=1&origin=${encodeURIComponent(
      youtubeOrigin,
    )}`
    : '';
  const youtubeUrl = activeVideo?.youtubeKey
    ? `https://www.youtube.com/watch?v=${encodeURIComponent(
      activeVideo.youtubeKey,
    )}`
    : activeVideo?.url || '';

  const playerHtml = activeVideo?.url
    ? `<!doctype html>
<html>
  <head>
    <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1" />
    <style>
      html, body { width: 100%; height: 100%; margin: 0; padding: 0; background: #000; display: flex; align-items: center; justify-content: center; overflow: hidden; }
      video { width: 100%; height: 100%; object-fit: contain; }
    </style>
  </head>
  <body>
    <video src="${activeVideo.url}" poster="${activeVideo.thumbnail || ''}" controls playsinline></video>
  </body>
</html>`
    : `<!doctype html>
<html>
  <head>
    <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1" />
    <style>
      html, body, iframe { width: 100%; height: 100%; margin: 0; padding: 0; border: 0; overflow: hidden; background: #000; }
    </style>
  </head>
  <body>
    <iframe
      src="${trailerUrl}"
      title="Trailer"
      allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      referrerpolicy="strict-origin-when-cross-origin"
      allowfullscreen>
    </iframe>
  </body>
</html>`;

  return (
    <>
      <View
        style={{
          alignItems: 'center',
          flexDirection: 'row',
          justifyContent: 'space-between',
          marginBottom: 18,
        }}>
        <SectionHeading
          icon="movie-play-outline"
          title={
            trailers.length > 1
              ? `Trailer (${activeTrailerIndex + 1}/${trailers.length})`
              : 'Trailer'
          }
        />
        {trailers.length > 1 ? (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TVFocusable
              borderRadius={20}
              focusScale={1.1}
              onPress={() => {
                onInteract?.();
                setActiveTrailerIndex(prev =>
                  prev > 0 ? prev - 1 : trailers.length - 1,
                );
              }}
              style={{
                alignItems: 'center',
                backgroundColor: colors.surfaceContainerHigh,
                borderColor: colors.outlineVariant,
                borderRadius: 20,
                borderWidth: 1,
                height: 36,
                justifyContent: 'center',
                width: 36,
              }}>
              <MaterialCommunityIcons
                name="chevron-left"
                size={22}
                color={colors.onSurface}
              />
            </TVFocusable>
            <TVFocusable
              borderRadius={20}
              focusScale={1.1}
              onPress={() => {
                onInteract?.();
                setActiveTrailerIndex(prev =>
                  prev < trailers.length - 1 ? prev + 1 : 0,
                );
              }}
              style={{
                alignItems: 'center',
                backgroundColor: colors.surfaceContainerHigh,
                borderColor: colors.outlineVariant,
                borderRadius: 20,
                borderWidth: 1,
                height: 36,
                justifyContent: 'center',
                width: 36,
              }}>
              <MaterialCommunityIcons
                name="chevron-right"
                size={22}
                color={colors.onSurface}
              />
            </TVFocusable>
          </View>
        ) : null}
      </View>
      <View
        onTouchEnd={event => event.stopPropagation()}
        onTouchStart={event => event.stopPropagation()}
        style={{
          aspectRatio: 16 / 9,
          backgroundColor: '#000000',
          borderColor: colors.outlineVariant,
          borderRadius: 24,
          borderWidth: 1,
          overflow: 'hidden',
          width: '100%',
        }}>
        {active ? (
          <WebView
            key={activeVideo?.id || activeVideo?.url || activeVideo?.youtubeKey}
            androidLayerType="hardware"
            allowsFullscreenVideo
            allowsInlineMediaPlayback
            domStorageEnabled
            javaScriptEnabled
            mediaPlaybackRequiresUserAction
            originWhitelist={['https://*', 'http://*']}
            setSupportMultipleWindows={false}
            source={{ baseUrl: `${youtubeOrigin}/`, html: playerHtml }}
            style={{ backgroundColor: '#000000', flex: 1 }}
            thirdPartyCookiesEnabled
          />
        ) : (
          <View
            style={{
              alignItems: 'center',
              flex: 1,
              justifyContent: 'center',
            }}>
            <MaterialCommunityIcons
              name="play-circle-outline"
              size={72}
              color={colors.primary}
            />
          </View>
        )}
      </View>
      <AppText
        role="titleLargeEmphasized"
        style={{ color: colors.onBackground, marginTop: 22 }}>
        {activeVideo?.name || `${data.title} trailer`}
      </AppText>
      {youtubeUrl ? (
        <View
          onTouchEnd={event => event.stopPropagation()}
          onTouchStart={event => event.stopPropagation()}
          style={{ alignItems: 'center', marginTop: 30, width: '100%' }}>
          <TVFocusable
            accessibilityRole="button"
            accessibilityLabel="Open trailer"
            borderRadius={22}
            focusScale={1.04}
            onPress={() => {
              onInteract?.();
              Linking.openURL(youtubeUrl);
            }}
            style={{
              alignItems: 'center',
              backgroundColor: colors.surfaceContainerHigh,
              borderColor: colors.outlineVariant,
              borderRadius: 22,
              borderWidth: 1,
              flexDirection: 'row',
              gap: 10,
              paddingHorizontal: 22,
              paddingVertical: 14,
            }}>
            <MaterialCommunityIcons
              name={activeVideo?.youtubeKey ? 'youtube' : 'play-circle-outline'}
              size={22}
              color={activeVideo?.youtubeKey ? '#ff3b30' : colors.primary}
            />
            <AppText
              role="labelLargeEmphasized"
              style={{ color: colors.onSurface }}>
              {activeVideo?.youtubeKey ? 'Open on YouTube' : 'Open Video'}
            </AppText>
          </TVFocusable>
        </View>
      ) : null}
    </>
  );
};

export default TrailerPage;
