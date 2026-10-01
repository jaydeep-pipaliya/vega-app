import React, {
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import {
  View,
  TouchableOpacity,
  Pressable,
  ToastAndroid,
  FlatList,
  ActivityIndicator,
  Image,
  ScrollView,
  TextInput,
  BackHandler,
  findNodeHandle,
  UIManager,
} from 'react-native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Feather from '@expo/vector-icons/Feather';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  cancelAnimation,
} from 'react-native-reanimated';
import * as IntentLauncher from 'expo-intent-launcher';
import RNReactNativeHapticFeedback from 'react-native-haptic-feedback';
import {EpisodeLink, Link} from '../lib/providers/types';
import {RootStackParamList} from '../App';
import Downloader from './Downloader';
import {cacheStorage, mainStorage, settingsStorage} from '../lib/storage';
import {ifExists} from '../lib/file/ifExists';
import {isTV} from '../lib/tv';
import {useEpisodes, useStreamData} from '../lib/hooks/useEpisodes';
import SkeletonLoader from './Skeleton';
import DropdownField from './ui/DropdownField';
import {
  createDesktopCompatibleFileName,
  createDirectDownloadId,
  createSeriesDownloadId,
} from '../lib/downloadId';
import useDownloadsStore from '../lib/zustand/downloadsStore';
import {useM3Colors} from '../theme/M3PaletteContext';
import MaterialDialogSurface from './ui/MaterialDialogSurface';
import LoadingIndicator from './ui/LoadingIndicator';
import {LEGACY_TERTIARY_BACKGROUND} from '../theme/seeds';
import Text from './ui/Text';
import EpisodeRowContent, {getValidImageUri} from './EpisodeRowContent';
import {setSyncedEpisodeProgress} from '../lib/sync/syncService';
import {TVFocusable, TVFocusGuide} from './tv';
import {useTVFocusBorderColor} from '../lib/tv/useTVFocusBorderColor';
import SeasonSearchSortBar from './season/SeasonSearchSortBar';

const CONTROL_TEXT = '#F5F0EF';
const CONTROL_TEXT_MUTED = '#D4CBC9';
// const CONTROL_OUTLINE = '#494240';

interface SeasonListProps {
  LinkList: Link[];
  poster: {
    logo?: string;
    poster?: string;
    background?: string;
  };
  type: string;
  metaTitle: string;
  providerValue: string;
  refreshing?: boolean;
  routeParams: Readonly<{
    link: string;
    provider?: string;
    poster?: string;
  }>;
  imdbId?: string;
  synopsis?: string;
  refreshVersion?: number;
  quickDownload?: boolean;
}

interface PlayHandlerProps {
  linkIndex: number;
  type: string;
  primaryTitle: string;
  seasonTitle: string;
  episodeData: EpisodeLink[] | Link['directLinks'];
}

interface StickyMenuState {
  active: boolean;
  link?: string;
  type?: string;
}

interface EpisodeDetailsState {
  link: string;
  title: string;
  description: string;
  image?: string;
}

const getOriginalLinkIndex = <T extends {link: string}>(
  links: T[] | undefined,
  link: string,
  fallbackIndex: number,
): number => {
  const originalIndex = links?.findIndex(item => item.link === link) ?? -1;
  return originalIndex >= 0 ? originalIndex : fallbackIndex;
};

interface EpisodeCardRowProps {
  item: any;
  index: number;
  isFirst: boolean;
  isCompleted: boolean;
  isSticky: boolean;
  onPress: () => void;
  onBeforePlay?: (control: View | null) => void;
  onLongPress: () => void;
  displayTitle: string;
  primary: string;
  onShowDetailsPressIn?: () => void;
  onShowDetails?: () => void;
  detailsPreferred?: boolean;
  downloadComponent?: React.ReactNode;
}

const EpisodeCardRow: React.FC<EpisodeCardRowProps> = ({
  item,
  index,
  isFirst,
  isCompleted,
  isSticky,
  onPress,
  onBeforePlay,
  onLongPress,
  displayTitle,
  primary,
  onShowDetailsPressIn,
  onShowDetails,
  detailsPreferred,
  downloadComponent,
}) => {
  const focusBorderColor = useTVFocusBorderColor();
  const playControlRef = useRef<View>(null);

  if (!isTV) {
    return (
      <View
        key={item.link + index}
        className={`w-full my-1.5 ${
          isCompleted || isSticky ? 'opacity-60' : ''
        }`}>
        <View
          className="min-h-[76px] flex-row w-full items-center px-3 py-2"
          style={{
            backgroundColor: LEGACY_TERTIARY_BACKGROUND,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.08)',
          }}>
          <TouchableOpacity
            accessibilityRole="button"
            style={{
              minWidth: 0,
              flex: 1,
              alignItems: 'center',
              flexDirection: 'row',
              gap: 12,
            }}
            onPress={onPress}
            onLongPress={onLongPress}>
            <EpisodeRowContent
              title={displayTitle}
              description={item.description}
              image={item.image}
              accentColor={primary}
              textColor={CONTROL_TEXT}
              mutedTextColor={CONTROL_TEXT_MUTED}
              onShowDetailsPressIn={onShowDetailsPressIn}
              onShowDetails={onShowDetails}
            />
          </TouchableOpacity>
          {downloadComponent}
        </View>
      </View>
    );
  }

  // TV Layout: Separate focus targets for episode play card, details button, and download button
  return (
    <TVFocusGuide
      autoFocus={Boolean(detailsPreferred)}
      style={{
        width: '100%',
        marginVertical: 4,
        opacity: isCompleted || isSticky ? 0.6 : 1,
      }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          width: '100%',
        }}>
        <TVFocusable
          ref={playControlRef}
          accessibilityRole="button"
          accessibilityLabel={`Play ${displayTitle}`}
          focusBorderColor={focusBorderColor}
          focusScale={1}
          borderRadius={14}
          onPress={() => {
            onBeforePlay?.(playControlRef.current);
            onPress();
          }}
          onLongPress={onLongPress}
          style={{
            flex: 1,
            minHeight: 76,
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 12,
            paddingVertical: 10,
            backgroundColor: LEGACY_TERTIARY_BACKGROUND,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: 'rgba(255, 255, 255, 0.08)',
            gap: 12,
          }}
          focusedStyle={{
            backgroundColor: '#262626',
          }}>
          <EpisodeRowContent
            title={displayTitle}
            description={item.description}
            image={item.image}
            accentColor={primary}
            textColor={CONTROL_TEXT}
            mutedTextColor={CONTROL_TEXT_MUTED}
            onShowDetailsPressIn={onShowDetailsPressIn}
            onShowDetails={onShowDetails}
          />
        </TVFocusable>

        {Boolean(onShowDetails) && (
          <TVFocusable
            key={detailsPreferred ? 'restore-details-focus' : 'episode-details'}
            hasTVPreferredFocus={detailsPreferred}
            accessibilityRole="button"
            accessibilityLabel={`Episode details for ${displayTitle}`}
            focusBorderColor={focusBorderColor}
            focusScale={1.05}
            borderRadius={24}
            onPress={onShowDetails}
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              backgroundColor: LEGACY_TERTIARY_BACKGROUND,
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: 8,
              borderWidth: 1,
              borderColor: 'rgba(255, 255, 255, 0.08)',
            }}>
            <MaterialCommunityIcons
              name="information-outline"
              size={22}
              color={primary}
            />
          </TVFocusable>
        )}

        <View style={{marginLeft: 8}}>
          {downloadComponent}
        </View>
      </View>
    </TVFocusGuide>
  );
};

const ServerRowItem = ({
  item,
  index,
  primary,
  onPress,
}: {
  item: any;
  index: number;
  primary: string;
  onPress: () => void;
}) => {
  const [tvFocused, setTvFocused] = useState(false);
  const focusBorderColor = useTVFocusBorderColor();
  return (
    <TVFocusable
      key={`server-${index}-${item.server}`}
      onFocus={() => setTvFocused(true)}
      onBlur={() => setTvFocused(false)}
      focusBorderColor={focusBorderColor}
      focusScale={1.02}
      borderRadius={14}
      style={{
        marginBottom: 8,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 12,
        backgroundColor: tvFocused ? '#262626' : LEGACY_TERTIARY_BACKGROUND,
        borderRadius: 14,
        borderWidth: tvFocused ? 2.5 : 1,
        borderColor: tvFocused ? focusBorderColor : 'rgba(255,255,255,0.08)',
      }}
      onPress={onPress}>
      <View>
        <Text
          className="text-lg capitalize font-bold"
          style={{color: CONTROL_TEXT}}>
          {item.server || `Server ${index + 1}`}
        </Text>
        <Text className="text-xs" style={{color: CONTROL_TEXT_MUTED}}>
          {item.type ? `Format: ${item.type.toUpperCase()}` : ''}
        </Text>
      </View>
      <MaterialCommunityIcons name="vlc" size={24} color={primary} />
    </TVFocusable>
  );
};

const SeasonList: React.FC<SeasonListProps> = ({
  LinkList,
  poster,
  type,
  metaTitle,
  providerValue,
  refreshing,
  routeParams,
  imdbId,
  synopsis,
  refreshVersion,
  quickDownload,
}) => {
  const colors = useM3Colors();
  const primary = colors.primary;
  const focusBorderColor = useTVFocusBorderColor();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const {fetchStreams} = useStreamData();
  const detailsPressRef = useRef<string | null>(null);
  const playerReturnFocusRef = useRef<View | null>(null);
  const restorePlayerFocusRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      if (!isTV || !restorePlayerFocusRef.current) return;
      const timer = setTimeout(() => {
        const handle = findNodeHandle(playerReturnFocusRef.current);
        if (handle) {
          UIManager.dispatchViewManagerCommand(handle, 'requestTVFocus', []);
        }
        restorePlayerFocusRef.current = false;
      }, 350);
      return () => clearTimeout(timer);
    }, []),
  );

  const rememberPlayerFocus = useCallback((control: View | null) => {
    if (!isTV) return;
    playerReturnFocusRef.current = control;
    restorePlayerFocusRef.current = true;
  }, []);
  const episodeSortOrderKey = `episodeSortOrder:${providerValue}:${routeParams.link}`;

  // Early return if no LinkList provided
  if (!LinkList || LinkList.length === 0) {
    return (
      <View className="p-4">
        <Text className="text-white text-center">No Streams Available</Text>
      </View>
    );
  }

  // Memoized initial active season
  const [activeSeason, setActiveSeason] = useState<Link>(() => {
    if (!LinkList || LinkList.length === 0) {
      return {} as Link;
    }

    const cached = cacheStorage.getString(
      `ActiveSeason${metaTitle + providerValue}`,
    );

    if (cached) {
      try {
        const parsedSeason = JSON.parse(cached);
        // Verify the cached season still exists in LinkList
        const seasonExists = LinkList.find(
          link => link.title === parsedSeason.title,
        );
        if (seasonExists) {
          return parsedSeason;
        }
      } catch (error) {
        console.warn('Failed to parse cached season:', error);
      }
    }

    return LinkList[0];
  });

  // React Query for episodes
  const {
    data: episodeList = [],
    isLoading: episodeLoading,
    error: episodeError,
    refetch: refetchEpisodes,
  } = useEpisodes(
    activeSeason?.episodesLink,
    providerValue,
    activeSeason?.episodesLink ? true : false,
  );

  useEffect(() => {
    if (refreshing && activeSeason?.episodesLink) {
      refetchEpisodes();
    }
  }, [activeSeason?.episodesLink, refetchEpisodes, refreshVersion, refreshing]);

  // UI state
  const [vlcLoading, setVlcLoading] = useState<boolean>(false);
  const [stickyMenu, setStickyMenu] = useState<StickyMenuState>({
    active: false,
  });

  // Search and sorting state - memoized initial values
  const [searchText, setSearchText] = useState<string>('');
  const [isSearchFocused, setIsSearchFocused] = useState<boolean>(false);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(() =>
    mainStorage.getString(episodeSortOrderKey) === 'desc' ? 'desc' : 'asc',
  );

  useEffect(() => {
    setSortOrder(
      mainStorage.getString(episodeSortOrderKey) === 'desc' ? 'desc' : 'asc',
    );
  }, [episodeSortOrderKey]);

  // External player state
  const [showServerModal, setShowServerModal] = useState<boolean>(false);
  const [externalPlayerStreams, setExternalPlayerStreams] = useState<any[]>([]);
  const [isLoadingStreams, setIsLoadingStreams] = useState<boolean>(false);
  const [episodeDetails, setEpisodeDetails] =
    useState<EpisodeDetailsState | null>(null);
  const [restoreDetailsLink, setRestoreDetailsLink] = useState<string | null>(null);
  const closeEpisodeDetails = useCallback(() => {
    setRestoreDetailsLink(episodeDetails?.link ?? null);
    setEpisodeDetails(null);
  }, [episodeDetails?.link]);
  const [episodeDetailsImageFailed, setEpisodeDetailsImageFailed] =
    useState(false);

  useEffect(() => {
    setEpisodeDetailsImageFailed(false);
  }, [episodeDetails?.image]);

  useEffect(() => {
    if (!isTV || !episodeDetails) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      closeEpisodeDetails();
      return true;
    });
    return () => sub.remove();
  }, [episodeDetails, closeEpisodeDetails]);

  // VLC loading animation - using shared value so it reacts to vlcLoading state
  const vlcRotation = useSharedValue(0);

  useEffect(() => {
    if (vlcLoading) {
      vlcRotation.value = 0;
      vlcRotation.value = withRepeat(
        withTiming(360, {duration: 800}),
        -1,
        false,
      );
    } else {
      cancelAnimation(vlcRotation);
      vlcRotation.value = 0;
    }
  }, [vlcLoading]);

  const vlcLoadingAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{rotate: `${vlcRotation.value}deg`}],
  }));

  // Memoized filtering and sorting logic for episodes
  const filteredAndSortedEpisodes = useMemo(() => {
    if (!episodeList || !Array.isArray(episodeList)) {
      return [];
    }

    let episodes = episodeList.filter(
      episode => episode && episode.title && episode.link,
    );

    // Apply search filter
    if (searchText.trim()) {
      episodes = episodes.filter(episode =>
        episode?.title?.toLowerCase().includes(searchText.toLowerCase()),
      );
    }

    // Apply sorting
    if (sortOrder === 'desc') {
      episodes = [...episodes].reverse();
    }

    return episodes;
  }, [episodeList, searchText, sortOrder]);

  // Memoized direct links processing
  const filteredAndSortedDirectLinks = useMemo(() => {
    if (
      !activeSeason?.directLinks ||
      !Array.isArray(activeSeason.directLinks)
    ) {
      return [];
    }

    let links = activeSeason.directLinks.filter(
      link => link && link.title && link.link,
    );

    // Apply search filter
    if (searchText.trim()) {
      links = links.filter(link =>
        link?.title?.toLowerCase().includes(searchText.toLowerCase()),
      );
    }

    // Apply sorting
    if (sortOrder === 'desc') {
      links = [...links].reverse();
    }

    return links;
  }, [activeSeason?.directLinks, searchText, sortOrder]);

  // Memoized completion checker
  const isCompleted = useCallback((link: string) => {
    const watchProgress = JSON.parse(cacheStorage.getString(link) || '{}');
    const percentage =
      (watchProgress?.position / watchProgress?.duration) * 100;
    return percentage > 85;
  }, []);

  // Memoized toggle sort order
  const toggleSortOrder = useCallback(() => {
    const newOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    setSortOrder(newOrder);
    mainStorage.setString(episodeSortOrderKey, newOrder);
  }, [episodeSortOrderKey, sortOrder]);

  // Memoized season change handler
  const handleSeasonChange = useCallback(
    (item: Link) => {
      setActiveSeason(item);
      cacheStorage.setString(
        `ActiveSeason${metaTitle + providerValue}`,
        JSON.stringify(item),
      );
    },
    [metaTitle, providerValue],
  );

  // Memoized external player handler
  const handleExternalPlayer = useCallback(
    async (link: string, streamType: string) => {
      setVlcLoading(true);
      setIsLoadingStreams(true);

      try {
        const streams = await fetchStreams(link, streamType, providerValue);

        if (!streams || streams.length === 0) {
          ToastAndroid.show(
            'No streams available from provider',
            ToastAndroid.SHORT,
          );
          return;
        }

        console.log('Available Streams Count:', streams.length);
        setExternalPlayerStreams([...streams]);
        setIsLoadingStreams(false);
        setVlcLoading(false);
        setShowServerModal(true);

        ToastAndroid.show(
          `Found ${streams.length} servers`,
          ToastAndroid.SHORT,
        );
      } catch (error: any) {
        console.error('Error fetching streams:', error);
        const errorMessage = error?.message || 'Failed to load streams';
        ToastAndroid.show(errorMessage, ToastAndroid.SHORT);
      } finally {
        setVlcLoading(false);
        setIsLoadingStreams(false);
      }
    },
    [fetchStreams, providerValue],
  );

  // Memoized external player opener
  const openExternalPlayer = useCallback(
    async (
      streamUrl: string,
      headers?: Record<string, string>,
      title?: string,
    ) => {
      setShowServerModal(false);
      setVlcLoading(true);

      try {
        const intentParams: any = {
          data: streamUrl,
          type: 'video/*',
          flags: 1,
        };

        const extra: Record<string, any> = {};

        if (title) {
          extra.title = title;
          extra['android.intent.extra.TITLE'] = title;
        }

        if (headers && Object.keys(headers).length > 0) {
          Object.assign(extra, headers);
          extra['android.media.intent.extra.HTTP_HEADERS'] = headers;
          extra.headers = headers;

          const headersArray = Object.entries(headers).map(
            ([key, val]) => `${key}: ${val}`,
          );
          extra.headers_array = headersArray;

          const referer = headers['Referer'] || headers['referer'];
          if (referer) {
            extra['android.intent.extra.REFERRER'] = referer;
            extra['android.intent.extra.REFERRER_NAME'] = referer;
          }
        }

        if (Object.keys(extra).length > 0) {
          intentParams.extra = extra;
        }

        await IntentLauncher.startActivityAsync(
          'android.intent.action.VIEW',
          intentParams,
        );
      } catch (error) {
        console.error('Error opening external player:', error);
        ToastAndroid.show('Failed to open external player', ToastAndroid.SHORT);
      } finally {
        setVlcLoading(false);
      }
    },
    [],
  );

  // Memoized play handler
  const playHandler = useCallback(
    async ({
      linkIndex,
      type: playbackType,
      primaryTitle,
      seasonTitle,
      episodeData,
    }: PlayHandlerProps) => {
      if (!episodeData || episodeData.length === 0) {
        return;
      }

      const link = episodeData[linkIndex].link;
      const file = (
        metaTitle +
        seasonTitle +
        episodeData[linkIndex]?.title
      ).replaceAll(/[^a-zA-Z0-9]/g, '_');

      const externalPlayer = settingsStorage.getBool('useExternalPlayer');
      const dwFile = await ifExists(file);

      const downloadIndex = getOriginalLinkIndex(episodeList, link, linkIndex);
      const downloadId = createSeriesDownloadId(
        metaTitle,
        seasonTitle,
        downloadIndex,
      );
      const localDownload =
        useDownloadsStore.getState().downloads[downloadId];
      const localPath =
        (localDownload?.status === 'completed' && localDownload?.filePath) ||
        dwFile;

      if (externalPlayer) {
        if (localPath) {
          await IntentLauncher.startActivityAsync(
            'android.intent.action.VIEW',
            {
              data: localPath,
              type: 'video/*',
            },
          );
          return;
        }
        handleExternalPlayer(link, playbackType);
        return;
      }

      navigation.navigate('Player', {
        linkIndex,
        episodeList: episodeData,
        type: playbackType,
        primaryTitle: primaryTitle,
        secondaryTitle: seasonTitle,
        poster: poster,
        providerValue: providerValue,
        infoUrl: routeParams.link,
        alwaysCast: !isTV && settingsStorage.isAlwaysCastMode(),
      });
    },
    [
      routeParams.link,
      poster,
      providerValue,
      metaTitle,
      handleExternalPlayer,
      navigation,
    ],
  );

  // Memoized long press handler
  const onLongPressHandler = useCallback(
    (active: boolean, link: string, streamType?: string) => {
      if (settingsStorage.isHapticFeedbackEnabled()) {
        RNReactNativeHapticFeedback.trigger('effectTick', {
          enableVibrateFallback: true,
          ignoreAndroidSystemSettings: false,
        });
      }
      setStickyMenu({active: active, link: link, type: streamType});
    },
    [],
  );

  // Memoized mark as watched handler
  const markAsWatched = useCallback(() => {
    if (stickyMenu.link) {
      cacheStorage.setString(
        stickyMenu.link,
        JSON.stringify({
          position: 1,
          duration: 1,
        }),
      );
      const episode = [
        ...episodeList,
        ...(activeSeason.directLinks || []),
      ].find(item => item.link === stickyMenu.link);
      if (episode) {
        setSyncedEpisodeProgress({
          episode,
          title: metaTitle,
          poster: poster.poster,
          background: poster.background,
          provider: providerValue,
          infoUrl: routeParams.link,
          type,
          position: 1,
          duration: 1,
        });
      }
      setStickyMenu({active: false});
    }
  }, [
    activeSeason.directLinks,
    episodeList,
    metaTitle,
    poster.background,
    poster.poster,
    providerValue,
    routeParams.link,
    stickyMenu.link,
    type,
  ]);

  // Memoized mark as unwatched handler
  const markAsUnwatched = useCallback(() => {
    if (stickyMenu.link) {
      cacheStorage.setString(
        stickyMenu.link,
        JSON.stringify({
          position: 0,
          duration: 1,
        }),
      );
      const episode = [
        ...episodeList,
        ...(activeSeason.directLinks || []),
      ].find(item => item.link === stickyMenu.link);
      if (episode) {
        setSyncedEpisodeProgress({
          episode,
          title: metaTitle,
          poster: poster.poster,
          background: poster.background,
          provider: providerValue,
          infoUrl: routeParams.link,
          type,
          position: 0,
          duration: 1,
        });
      }
      setStickyMenu({active: false});
    }
  }, [
    activeSeason.directLinks,
    episodeList,
    metaTitle,
    poster.background,
    poster.poster,
    providerValue,
    routeParams.link,
    stickyMenu.link,
    type,
  ]);

  // Memoized sticky menu external player handler
  const handleStickyMenuExternalPlayer = useCallback(() => {
    setStickyMenu({active: false});
    if (stickyMenu.link && stickyMenu.type) {
      handleExternalPlayer(stickyMenu.link, stickyMenu.type);
    }
  }, [stickyMenu.link, stickyMenu.type, handleExternalPlayer]);

  // Memoized episode render item
  const renderEpisodeItem = useCallback(
    ({item, index}: {item: EpisodeLink; index: number}) => {
      if (!item || !item.link || !item.title) {
        console.warn('Invalid episode item at index', index, item);
        return null; // Skip rendering if item is invalid
      }

      const downloadIndex = getOriginalLinkIndex(episodeList, item.link, index);
      const downloadId = createSeriesDownloadId(
        metaTitle,
        activeSeason.title,
        downloadIndex,
      );
      const handleEpisodePress = () => {
        playHandler({
          linkIndex: index,
          type,
          primaryTitle: metaTitle,
          seasonTitle: activeSeason?.title || '',
          episodeData: filteredAndSortedEpisodes,
        });
      };

      return (
        <EpisodeCardRow
          key={item.link + index}
          item={item}
          index={index}
          isFirst={index === 0}
          isCompleted={isCompleted(item.link)}
          isSticky={stickyMenu.link === item.link}
          detailsPreferred={isTV && restoreDetailsLink === item.link}
          displayTitle={item.title}
          primary={primary}
          onPress={() => {
            if (detailsPressRef.current === item.link) {
              detailsPressRef.current = null;
              return;
            }
            handleEpisodePress();
          }}
          onBeforePlay={rememberPlayerFocus}
          onLongPress={() =>
            onLongPressHandler(true, item.link, 'series')
          }
          onShowDetailsPressIn={() => {
            detailsPressRef.current = item.link;
          }}
          onShowDetails={
            item.description?.trim()
              ? () => {
                  setRestoreDetailsLink(null);
                  setEpisodeDetails({
                    link: item.link,
                    title: item.title,
                    description: item.description!.trim(),
                    image: item.image,
                  });
                  setTimeout(() => {
                    if (detailsPressRef.current === item.link) {
                      detailsPressRef.current = null;
                    }
                  }, 0);
                }
              : undefined
          }
          downloadComponent={
            <Downloader
              downloadId={downloadId}
              episodeIndex={downloadIndex}
              providerValue={providerValue}
              link={item.link}
              type={type}
              mediaType="series"
              showName={metaTitle}
              seasonTitle={activeSeason.title}
              episodeName={item.title}
              imdbId={imdbId}
              poster={poster.poster}
              background={poster.background}
              synopsis={synopsis}
              infoUrl={routeParams.link}
              skip={item.skip || (item as any)?.skips}
              quickDownload={
                quickDownload ||
                activeSeason?.quickDownload ||
                item?.quickDownload
              }
              title={
                metaTitle.length > 30
                  ? metaTitle.slice(0, 30) + '... ' + item.title
                  : metaTitle + ' ' + item.title
              }
              fileName={createDesktopCompatibleFileName(
                `${metaTitle} ${item.title}`,
                'series',
              )}
            />
          }
        />
      );
    },
    [
      isCompleted,
      stickyMenu.link,
      playHandler,
      rememberPlayerFocus,
      metaTitle,
      activeSeason?.title,
      episodeList,
      filteredAndSortedEpisodes,
      onLongPressHandler,
      primary,
      providerValue,
      routeParams.link,
      imdbId,
      poster.poster,
    ],
  );

  // Memoized direct link render item
  const renderDirectLinkItem = useCallback(
    ({item, index}: {item: any; index: number}) => {
      if (!item || !item.link || !item.title) {
        console.warn('Invalid direct link item at index', index, item);
        return null; // Skip rendering if item is invalid
      }

      const downloadIndex = getOriginalLinkIndex(
        activeSeason.directLinks,
        item.link,
        index,
      );
      const downloadId = createDirectDownloadId(
        metaTitle,
        activeSeason.title,
        downloadIndex,
      );
      const displayTitle =
        item.title?.trim() ||
        (activeSeason?.directLinks?.length && activeSeason.directLinks.length > 1
          ? `${activeSeason?.title || 'Episode'} ${index + 1}`
          : activeSeason?.title && activeSeason.title.toLowerCase() !== 'default'
          ? activeSeason.title
          : 'Play');
      const handleEpisodePress = () => {
        playHandler({
          linkIndex: index,
          type,
          primaryTitle: metaTitle,
          seasonTitle: activeSeason?.title || '',
          episodeData: filteredAndSortedDirectLinks,
        });
      };

      return (
        <EpisodeCardRow
          key={item.link + index}
          item={item}
          index={index}
          isFirst={index === 0}
          isCompleted={isCompleted(item.link)}
          isSticky={stickyMenu.link === item.link}
          detailsPreferred={isTV && restoreDetailsLink === item.link}
          displayTitle={displayTitle}
          primary={primary}
          onPress={() => {
            if (detailsPressRef.current === item.link) {
              detailsPressRef.current = null;
              return;
            }
            handleEpisodePress();
          }}
          onBeforePlay={rememberPlayerFocus}
          onLongPress={() =>
            onLongPressHandler(true, item.link, item?.type || 'series')
          }
          onShowDetailsPressIn={() => {
            detailsPressRef.current = item.link;
          }}
          onShowDetails={
            item.description?.trim()
              ? () => {
                  setRestoreDetailsLink(null);
                  setEpisodeDetails({
                    link: item.link,
                    title: item.title,
                    description: item.description.trim(),
                    image: item.image,
                  });
                  setTimeout(() => {
                    if (detailsPressRef.current === item.link) {
                      detailsPressRef.current = null;
                    }
                  }, 0);
                }
              : undefined
          }
          downloadComponent={
            <Downloader
              downloadId={downloadId}
              episodeIndex={downloadIndex}
              providerValue={providerValue}
              link={item.link}
              type={type}
              mediaType={isTV ? 'series' : item?.type === 'series' ? 'series' : 'movie'}
              showName={metaTitle}
              seasonTitle={activeSeason.title}
              episodeName={item.title}
              imdbId={imdbId}
              poster={poster.poster}
              background={poster.background}
              synopsis={synopsis}
              infoUrl={routeParams.link}
              skip={item.skip || (item as any)?.skips}
              quickDownload={
                quickDownload ||
                activeSeason?.quickDownload ||
                item?.quickDownload
              }
              title={
                metaTitle.length > 30
                  ? metaTitle.slice(0, 30) + '... ' + item.title
                  : metaTitle + ' ' + item.title
              }
              fileName={
                item?.type === 'series' ||
                (activeSeason?.directLinks &&
                  activeSeason.directLinks.length > 1)
                  ? createDesktopCompatibleFileName(
                      `${metaTitle} ${item.title}`,
                      'series',
                    )
                  : createDesktopCompatibleFileName(metaTitle, 'movie')
              }
            />
          }
        />
      );
    },
    [
      isCompleted,
      stickyMenu.link,
      playHandler,
      rememberPlayerFocus,
      metaTitle,
      activeSeason?.title,
      activeSeason?.directLinks,
      filteredAndSortedDirectLinks,
      onLongPressHandler,
      primary,
      providerValue,
      routeParams.link,
      imdbId,
      poster.poster,
    ],
  );

  // Memoized server render item
  const renderServerItem = useCallback(
    (item: any, index: number) => (
      <ServerRowItem
        key={`server-${index}-${item.server}`}
        item={item}
        index={index}
        primary={primary}
        onPress={() =>
          openExternalPlayer(
            item.link,
            item.headers,
            `${metaTitle || ''} ${item.server || ''}`.trim(),
          )
        }
      />
    ),
    [primary, openExternalPlayer, metaTitle],
  );

  // Show loading skeleton while episodes are loading
  if (episodeLoading) {
    return (
      <View>
        {LinkList.length > 1 && (
          <DropdownField
            options={LinkList}
            value={activeSeason}
            placeholder="Select Season"
            getKey={item =>
              item.episodesLink || item.directLinks?.[0]?.link || item.title
            }
            getLabel={item => item.title || 'Unknown'}
            onChange={handleSeasonChange}
            showFullOptionLabels
          />
        )}

        <View
          style={{
            width: '100%',
            padding: 10,
            alignItems: 'flex-start',
            gap: 20,
          }}>
          {[...Array(6)].map((_, index) => (
            <SkeletonLoader key={index} show={true} height={48} width={'85%'} />
          ))}
        </View>
      </View>
    );
  }

  // Show error state
  if (episodeError) {
    return (
      <View className="p-4">
        <Text className="text-red-500 text-center">
          {episodeError.message || 'Failed to load episodes. Please try again.'}
        </Text>
        <TouchableOpacity
          className="mt-2 bg-red-600 p-2 rounded-md"
          onPress={() => refetchEpisodes()}>
          <Text className="text-white text-center">Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View>
      <TVFocusGuide autoFocus={false}>
        {/* Season Selector */}
        <DropdownField
          options={LinkList}
          value={activeSeason}
          placeholder="Select Season"
          getKey={item =>
            item.episodesLink || item.directLinks?.[0]?.link || item.title
          }
          getLabel={item => item.title || 'Unknown'}
          onChange={handleSeasonChange}
          showFullOptionLabels
          style={{marginBottom: 8}}
        />

        {/* Search and Sort Controls */}
        {(episodeList.length > 2 ||
          (activeSeason?.directLinks && activeSeason.directLinks?.length > 2) ||
          searchText) && (
          <SeasonSearchSortBar
            searchText={searchText}
            setSearchText={setSearchText}
            sortOrder={sortOrder}
            toggleSortOrder={toggleSortOrder}
            focusBorderColor={focusBorderColor}
          />
        )}
      </TVFocusGuide>

      {/* Episode/Direct Links List */}
      <View className="w-full mt-3">
        {/* Episodes List */}
        {filteredAndSortedEpisodes.length > 0 && (
          <FlatList
            data={filteredAndSortedEpisodes}
            keyExtractor={(item, index) => `episode-${item.link}-${index}`}
            renderItem={renderEpisodeItem}
            maxToRenderPerBatch={10}
            windowSize={10}
            removeClippedSubviews={!isTV}
          />
        )}

        {/* Direct Links List */}
        {filteredAndSortedDirectLinks.length > 0 && (
          <View className="w-full mt-2">
            <FlatList
              data={filteredAndSortedDirectLinks}
              keyExtractor={(item, index) => `direct-${item.link}-${index}`}
              renderItem={renderDirectLinkItem}
              maxToRenderPerBatch={10}
              windowSize={10}
              removeClippedSubviews={!isTV}
            />
          </View>
        )}

        {/* No Content Available */}
        {filteredAndSortedEpisodes.length === 0 &&
          filteredAndSortedDirectLinks.length === 0 &&
          LinkList?.length === 0 && (
            <Text
              className="min-h-20 text-lg font-semibold"
              style={{color: colors.onSurfaceVariant}}>
              No stream found
            </Text>
          )}
      </View>

      {/* VLC Loading Indicator */}
      {vlcLoading && (
        <View className="absolute top-0 left-0 w-full h-full bg-black/60 bg-opacity-50 justify-center items-center">
          <Animated.View style={[vlcLoadingAnimatedStyle]}>
            <MaterialCommunityIcons name="vlc" size={70} color={primary} />
          </Animated.View>
          <Text
            className="mt-2 text-lg font-semibold"
            style={{color: colors.onSurface}}>
            Loading available servers...
          </Text>
        </View>
      )}

      <MaterialDialogSurface
        visible={episodeDetails !== null}
        onDismiss={closeEpisodeDetails}
        style={{padding: 0}}>
        {episodeDetails ? (
          <>
            {getValidImageUri(episodeDetails.image) &&
            !episodeDetailsImageFailed ? (
              <Image
                source={{uri: getValidImageUri(episodeDetails.image)}}
                resizeMode="cover"
                onError={() => setEpisodeDetailsImageFailed(true)}
                style={{aspectRatio: 16 / 9, width: '100%'}}
              />
            ) : (
              <View
                style={{
                  alignItems: 'center',
                  aspectRatio: 16 / 9,
                  backgroundColor: colors.surfaceContainerHighest,
                  justifyContent: 'center',
                  width: '100%',
                }}>
                <MaterialCommunityIcons
                  name="image-off-outline"
                  size={44}
                  color={colors.onSurfaceVariant}
                />
              </View>
            )}
            <View style={{padding: 20}}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 8,
                }}>
                <Text
                  role="titleLarge"
                  style={{
                    color: colors.onSurface,
                    fontWeight: '700',
                    flex: 1,
                    marginRight: 8,
                  }}>
                  {episodeDetails.title}
                </Text>
                {isTV && (
                  <TVFocusable
                    hasTVPreferredFocus={true}
                    accessibilityRole="button"
                    accessibilityLabel="Close"
                    borderRadius={18}
                    focusScale={1}
                    focusBorderColor={focusBorderColor}
                    onPress={closeEpisodeDetails}
                    style={{padding: 4}}>
                    <MaterialCommunityIcons
                      name="close"
                      size={24}
                      color="#CCCCCC"
                    />
                  </TVFocusable>
                )}
              </View>
              <ScrollView style={{maxHeight: 230}} showsVerticalScrollIndicator={false}>
                <Text
                  role="bodyMedium"
                  style={{
                    color: colors.onSurfaceVariant,
                    lineHeight: 22,
                    marginTop: 4,
                  }}>
                  {episodeDetails.description}
                </Text>
              </ScrollView>
              {isTV && (
                <TVFocusable
                  accessibilityRole="button"
                  accessibilityLabel="Close episode details"
                  borderRadius={14}
                  focusScale={1}
                  focusBorderColor={focusBorderColor}
                  onPress={closeEpisodeDetails}
                  style={{
                    marginTop: 16,
                    paddingVertical: 12,
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: 14,
                    alignItems: 'center',
                  }}>
                  <Text style={{color: '#FFFFFF', fontWeight: '600', fontSize: 15}}>
                    Close
                  </Text>
                </TVFocusable>
              )}
            </View>
          </>
        ) : null}
      </MaterialDialogSurface>

      <MaterialDialogSurface
        visible={showServerModal}
        onDismiss={() => setShowServerModal(false)}>
        <Text
          className="mb-2 text-center text-xl font-bold"
          style={{color: colors.onSurface}}>
          Select External Player Server
        </Text>
        <Text
          className="mb-4 text-center text-sm"
          style={{color: colors.onSurfaceVariant}}>
          {externalPlayerStreams.length} servers available
        </Text>

        {isLoadingStreams ? (
          <LoadingIndicator size={40} color={primary} />
        ) : (
          <>
            <ScrollView style={{maxHeight: 300}}>
              {externalPlayerStreams.map((item, index) =>
                renderServerItem(item, index),
              )}
              {externalPlayerStreams.length === 0 && (
                <Text
                  className="p-4 text-center"
                  style={{color: colors.onSurfaceVariant}}>
                  No servers available
                </Text>
              )}
            </ScrollView>

            <TVFocusable
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              borderRadius={18}
              focusScale={1}
              focusBorderColor={focusBorderColor}
              style={{
                marginTop: 16,
                paddingVertical: 12,
                backgroundColor: colors.secondaryContainer,
                borderRadius: 18,
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onPress={() => setShowServerModal(false)}>
              <Text
                className="text-center font-bold"
                style={{color: colors.onSecondaryContainer}}>
                Cancel
              </Text>
            </TVFocusable>
          </>
        )}
      </MaterialDialogSurface>

      <MaterialDialogSurface
        visible={stickyMenu.active}
        onDismiss={() => setStickyMenu({active: false})}>
        <Text
          className="mb-4 text-xl font-bold"
          style={{color: colors.onSurface}}>
          Episode actions
        </Text>
        <View style={{gap: 10}}>
          {isCompleted(stickyMenu.link || '') ? (
            <TVFocusable
              accessibilityRole="button"
              borderRadius={18}
              focusScale={1}
              focusBorderColor={focusBorderColor}
              style={{
                height: 48,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                paddingHorizontal: 16,
                backgroundColor: colors.surfaceContainerHighest,
                borderRadius: 18,
              }}
              onPress={markAsUnwatched}>
              <Ionicons name="checkmark-done" size={28} color={primary} />
              <Text style={{color: colors.onSurface}}>Mark as unwatched</Text>
            </TVFocusable>
          ) : (
            <TVFocusable
              accessibilityRole="button"
              borderRadius={18}
              focusScale={1}
              focusBorderColor={focusBorderColor}
              style={{
                height: 48,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                paddingHorizontal: 16,
                backgroundColor: colors.surfaceContainerHighest,
                borderRadius: 18,
              }}
              onPress={markAsWatched}>
              <Ionicons name="checkmark" size={25} color={primary} />
              <Text style={{color: colors.onSurface}}>Mark as watched</Text>
            </TVFocusable>
          )}
          <TVFocusable
            accessibilityRole="button"
            borderRadius={18}
            focusScale={1}
            focusBorderColor={focusBorderColor}
            style={{
              height: 48,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              paddingHorizontal: 16,
              backgroundColor: colors.surfaceContainerHighest,
              borderRadius: 18,
            }}
            onPress={handleStickyMenuExternalPlayer}>
            <Feather name="external-link" size={20} color={primary} />
            <Text style={{color: colors.onSurface}}>External player</Text>
          </TVFocusable>
        </View>
      </MaterialDialogSurface>
    </View>
  );
};

export default SeasonList;
