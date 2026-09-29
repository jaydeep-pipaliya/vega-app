import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {Image, Modal, Pressable, View, findNodeHandle, Keyboard} from 'react-native';
import {getColors} from 'react-native-image-colors';
import LinearGradient from 'react-native-linear-gradient';
import Animated, {FadeIn, FadeInDown} from 'react-native-reanimated';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import debounce from 'lodash/debounce';
import {HomeStackParamList} from '../App';
import {useHeroMetadata} from '../lib/hooks/useHomePageData';
import useContentStore from '../lib/zustand/contentStore';
import useHeroStore from '../lib/zustand/herostore';
import {useM3Colors} from '../theme/M3PaletteContext';
import {mixHex} from '../theme/seeds';
import {
  fetchIMDbSuggestions,
  type IMDbSuggestion,
} from '../lib/services/imdbSuggestions';
import {sanitizeSearchQuery} from '../lib/utils/helpers';
import SearchSuggestions from './search/SearchSuggestions';
import Button from './ui/Button';
import SearchField, {type SearchFieldRef} from './ui/SearchField';
import AppText from './ui/Text';
import {isTV} from '../lib/tv';
import {TVFocusable, TVFocusGuide} from './tv';
import {useTVFocusBorderColor} from '../lib/tv/useTVFocusBorderColor';

interface HeroProps {
  isDrawerOpen: boolean;
  onOpenDrawer: () => void;
}

const IMAGE_COLOR_FALLBACK = '#FFFFFF';

const getReadableContentColor = (backgroundColor: string) => {
  const hex = backgroundColor.replace('#', '').slice(0, 6);
  if (hex.length !== 6) {
    return '#211F1E';
  }
  const red = parseInt(hex.slice(0, 2), 16);
  const green = parseInt(hex.slice(2, 4), 16);
  const blue = parseInt(hex.slice(4, 6), 16);
  return (red * 299 + green * 587 + blue * 114) / 1000 > 145
    ? '#211F1E'
    : '#FFFFFF';
};

const HeroTopButton = React.forwardRef<
  View,
  {
    disabled?: boolean;
    icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
    iconColor: string;
    label: string;
    onPress: () => void;
    nextFocusDown?: number | null;
    nextFocusLeft?: number | null;
    nextFocusRight?: number | null;
    nextFocusUp?: number | null;
    hasTVPreferredFocus?: boolean;
    onLayout?: (event: any) => void;
  }
>(
  (
    {
      disabled = false,
      icon,
      iconColor,
      label,
      onPress,
      nextFocusDown,
      nextFocusLeft,
      nextFocusRight,
      nextFocusUp,
      hasTVPreferredFocus,
      onLayout,
    },
    ref,
  ) => {
    const focusBorderColor = useTVFocusBorderColor();

    if (isTV) {
      return (
        <TVFocusable
          ref={ref}
          onLayout={onLayout}
          accessibilityLabel={label}
          accessibilityRole="button"
          disabled={disabled}
          hasTVPreferredFocus={hasTVPreferredFocus}
          nextFocusDown={nextFocusDown}
          nextFocusLeft={nextFocusLeft}
          nextFocusRight={nextFocusRight}
          nextFocusUp={nextFocusUp}
          onPress={onPress}
          borderRadius={24}
          focusScale={1.18}
          focusBorderColor={focusBorderColor}
          style={{
            alignItems: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.45)',
            borderColor: 'rgba(255, 255, 255, 0.15)',
            borderRadius: 24,
            borderWidth: 1,
            height: 48,
            justifyContent: 'center',
            opacity: disabled ? 0 : 1,
            width: 48,
          }}>
          {({focused}) => (
            <MaterialCommunityIcons
              name={icon}
              size={28}
              color={focused ? '#FFFFFF' : iconColor}
            />
          )}
        </TVFocusable>
      );
    }

    return (
      <Pressable
        ref={ref as any}
        onLayout={onLayout}
        accessibilityLabel={label}
        accessibilityRole="button"
        disabled={disabled}
        onPress={onPress}
        style={({pressed}) => ({
          alignItems: 'center',
          height: 48,
          justifyContent: 'center',
          opacity: disabled ? 0 : pressed ? 0.62 : 1,
          width: 48,
        })}>
        <MaterialCommunityIcons name={icon} size={30} color={iconColor} />
      </Pressable>
    );
  },
);

const Hero = memo(({isDrawerOpen, onOpenDrawer}: HeroProps) => {
  const colors = useM3Colors();
  const insets = useSafeAreaInsets();
  const [logoFailed, setLogoFailed] = useState(false);
  const [searchActive, setSearchActive] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [suggestions, setSuggestions] = useState<IMDbSuggestion[]>([]);
  const [searchButtonColor, setSearchButtonColor] = useState('#FFFFFF');
  const searchFieldRef = useRef<SearchFieldRef>(null);
  const hamburgerRef = useRef<View>(null);
  const searchRef = useRef<View>(null);
  const watchNowRef = useRef<View>(null);

  const [hamburgerNode, setHamburgerNode] = useState<number | null>(null);
  const [searchNode, setSearchNode] = useState<number | null>(null);
  const [watchNowNode, setWatchNowNode] = useState<number | null>(null);

  const updateHamburgerNode = useCallback(() => {
    if (hamburgerRef.current) {
      const handle = findNodeHandle(hamburgerRef.current);
      if (handle) setHamburgerNode(handle);
    }
  }, []);

  const updateSearchNode = useCallback(() => {
    if (searchRef.current) {
      const handle = findNodeHandle(searchRef.current);
      if (handle) setSearchNode(handle);
    }
  }, []);

  const updateWatchNowNode = useCallback(() => {
    if (watchNowRef.current) {
      const handle = findNodeHandle(watchNowRef.current);
      if (handle) setWatchNowNode(handle);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      updateHamburgerNode();
      updateSearchNode();
      updateWatchNowNode();
    }, 150);
    return () => clearTimeout(t);
  }, [updateHamburgerNode, updateSearchNode, updateWatchNowNode, isDrawerOpen]);

  const provider = useContentStore(state => state.provider);
  const hero = useHeroStore(state => state.hero);
  const navigation =
    useNavigation<NativeStackNavigationProp<HomeStackParamList>>();
  const {data: heroData, error} = useHeroMetadata(
    hero?.link || '',
    provider.value,
  );

  const imageSource = useMemo(
    () => ({
      uri:
        heroData?.background ||
        heroData?.image ||
        heroData?.poster ||
        hero?.image ||
        '',
    }),
    [hero?.image, heroData],
  );
  const imageUri = imageSource.uri;

  useEffect(() => {
    setSearchButtonColor(IMAGE_COLOR_FALLBACK);
  }, [hero?.link]);

  useEffect(() => {
    setLogoFailed(false);
  }, [heroData?.logo]);

  useEffect(() => {
    if (!searchActive) {
      return;
    }
    const frame = requestAnimationFrame(() => searchFieldRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [searchActive]);

  const suppressSuggestionsRef = useRef(false);

  // Debounced IMDb search suggestions for home page search
  const debouncedFetchSuggestions = useCallback(
    debounce(async (text: string) => {
      const clean = text.trim();
      if (clean.length >= 2 && !suppressSuggestionsRef.current) {
        const results = await fetchIMDbSuggestions(clean);
        setSuggestions(results);
      } else {
        setSuggestions([]);
      }
    }, 250),
    [],
  );

  const handleTextChange = useCallback((text: string) => {
    suppressSuggestionsRef.current = false;
    setSearchText(text);
  }, []);

  const submitProviderSearch = useCallback(
    (value: string) => {
      Keyboard.dismiss();
      const query = value.trim();
      if (!query) {
        return;
      }
      setSearchActive(false);
      setSearchText('');
      setSuggestions([]);
      if (/^https?:\/\//i.test(query)) {
        navigation.navigate('Info', {
          link: query,
          provider: provider.value,
        });
        return;
      }
      navigation.navigate('ScrollList', {
        providerValue: provider.value,
        filter: query,
        title: provider.display_name,
        isSearch: true,
      });
    },
    [navigation, provider.display_name, provider.value],
  );

  const handleSelectSuggestion = useCallback(
    (title: string) => {
      const cleanTitle = sanitizeSearchQuery(title);
      Keyboard.dismiss();
      suppressSuggestionsRef.current = true;
      setSuggestions([]);
      setSearchText(cleanTitle);
      submitProviderSearch(cleanTitle);
    },
    [submitProviderSearch],
  );

  useEffect(() => {
    if (searchActive && searchText.trim().length >= 2) {
      debouncedFetchSuggestions(searchText);
    } else {
      setSuggestions([]);
    }
    return () => {
      debouncedFetchSuggestions.cancel();
    };
  }, [searchText, searchActive, debouncedFetchSuggestions]);

  const updateSearchButtonColor = useCallback(async () => {
    if (!imageUri) {
      return;
    }
    try {
      const imageColors = await getColors(imageUri, {
        cache: true,
        fallback: IMAGE_COLOR_FALLBACK,
        key: `hero-accent-v2:${imageUri}`,
        pixelSpacing: 8,
      });
      const candidates =
        imageColors.platform === 'android'
          ? [
              imageColors.lightVibrant,
              imageColors.vibrant,
              imageColors.dominant,
              imageColors.average,
              imageColors.darkVibrant,
            ]
          : imageColors.platform === 'ios'
            ? [imageColors.primary, imageColors.secondary]
            : [imageColors.vibrant, imageColors.dominant];
      const extractedColor = candidates.find(
        candidate =>
          candidate.toUpperCase() !== IMAGE_COLOR_FALLBACK.toUpperCase(),
      );
      if (extractedColor) {
        setSearchButtonColor(mixHex(extractedColor, '#FFFFFF', 0.72));
      }
    } catch {}
  }, [imageUri]);
  const genres = useMemo(
    () => (heroData?.genre || heroData?.tags || []).slice(0, 3),
    [heroData],
  );
  const openDetails = useCallback(() => {
    if (!hero?.link) {
      return;
    }
    navigation.navigate('Info', {
      link: hero.link,
      provider: provider.value,
      poster: heroData?.poster || heroData?.image || heroData?.background,
    });
  }, [hero, heroData, navigation, provider.value]);

  return (
    <View
      style={{
        backgroundColor: colors.surfaceContainerLow,
        borderBottomLeftRadius: 28,
        borderBottomRightRadius: 28,
        height: 410,
        overflow: 'hidden',
      }}>
      {!imageUri ? (
        <View
          style={{flex: 1, backgroundColor: colors.surfaceContainerHighest}}
        />
      ) : (
        <Animated.Image
          entering={FadeIn.duration(450)}
          source={imageSource}
          onLoad={updateSearchButtonColor}
          resizeMode="cover"
          style={{height: '100%', width: '100%'}}
        />
      )}

      <LinearGradient
        colors={[
          'rgba(0,0,0,0.2)',
          'rgba(0,0,0,0.08)',
          'rgba(0,0,0,0.72)',
          colors.background,
        ]}
        locations={[0, 0.28, 0.7, 1]}
        style={{position: 'absolute', inset: 0}}
      />

      <TVFocusGuide
        trapFocusUp={true}
        style={{
          alignItems: 'center',
          flexDirection: 'row',
          justifyContent: 'space-between',
          left: isTV ? 24 : 16,
          position: 'absolute',
          right: isTV ? 48 : 16,
          top: insets.top + (isTV ? 16 : 6),
          zIndex: 30,
        }}>
        <HeroTopButton
          ref={hamburgerRef}
          onLayout={updateHamburgerNode}
          icon="menu"
          iconColor={searchButtonColor}
          label="Open provider drawer"
          disabled={isDrawerOpen}
          hasTVPreferredFocus={isTV && !isDrawerOpen}
          nextFocusRight={searchNode ?? undefined}
          nextFocusDown={watchNowNode ?? undefined}
          nextFocusUp={hamburgerNode ?? undefined}
          onPress={onOpenDrawer}
        />
        <HeroTopButton
          ref={searchRef}
          onLayout={updateSearchNode}
          icon="magnify"
          iconColor={searchButtonColor}
          label={`Search in ${provider.display_name}`}
          nextFocusLeft={hamburgerNode ?? undefined}
          nextFocusRight={searchNode ?? undefined}
          nextFocusDown={watchNowNode ?? undefined}
          nextFocusUp={searchNode ?? undefined}
          onPress={() => setSearchActive(true)}
        />
      </TVFocusGuide>

      <Animated.View
        entering={FadeInDown.delay(100).springify().damping(18).stiffness(180)}
        style={{
          alignItems: 'center',
          bottom: 22,
          left: 20,
          position: 'absolute',
          right: 20,
        }}>
        {heroData?.logo && !logoFailed ? (
          <Image
            source={{uri: heroData.logo}}
            onError={() => setLogoFailed(true)}
            resizeMode="contain"
            style={{height: 94, width: 280}}
          />
        ) : heroData?.title || hero?.title ? (
          <AppText
            numberOfLines={2}
            role="headlineLarge"
            style={{
              color: '#FFFFFF',
              maxWidth: 300,
              textAlign: 'center',
            }}>
            {heroData?.title || hero?.title}
          </AppText>
        ) : null}

        {genres.length > 0 ? (
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 8,
              justifyContent: 'center',
              marginTop: 10,
            }}>
            {genres.map((genre: string) => (
              <View
                key={genre}
                style={{
                  backgroundColor: 'rgba(32, 28, 28, 0.82)',
                  borderColor: 'rgba(255,255,255,0.24)',
                  borderRadius: 12,
                  borderWidth: 1,
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                }}>
                <AppText
                  role="labelMediumEmphasized"
                  style={{color: '#FFFFFF'}}>
                  {genre}
                </AppText>
              </View>
            ))}
          </View>
        ) : null}

        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'center',
            marginTop: 14,
            width: '100%',
          }}>
          <Button
            ref={watchNowRef}
            onLayout={updateWatchNowNode}
            variant="filled"
            containerColor={searchButtonColor}
            contentColor={getReadableContentColor(searchButtonColor)}
            nextFocusUp={hamburgerNode ?? undefined}
            onPress={openDetails}>
            Watch now
          </Button>
        </View>
        {error ? (
          <AppText
            role="bodySmall"
            style={{
              color: colors.onSurfaceVariant,
              marginTop: 10,
              textAlign: 'center',
            }}>
            Some featured details are unavailable
          </AppText>
        ) : null}
      </Animated.View>

      {/* Full-screen Search Overlay with Auto-completion Suggestions */}
      <Modal
        visible={searchActive}
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => {
          setSearchActive(false);
          setSearchText('');
          setSuggestions([]);
        }}>
        <SafeAreaView
          style={{flex: 1, backgroundColor: colors.background}}
          edges={['top', 'left', 'right']}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 16,
              paddingTop: 8,
              paddingBottom: 10,
              gap: 8,
            }}>
            {isTV ? (
              <TVFocusable
                accessibilityLabel="Close search"
                accessibilityRole="button"
                hasTVPreferredFocus={true}
                borderRadius={22}
                focusScale={1.1}
                onPress={() => {
                  setSearchActive(false);
                  setSearchText('');
                  setSuggestions([]);
                }}
                style={{
                  alignItems: 'center',
                  borderRadius: 22,
                  height: 44,
                  justifyContent: 'center',
                  width: 44,
                }}>
                <MaterialCommunityIcons
                  name="arrow-left"
                  size={26}
                  color={colors.onSurface}
                />
              </TVFocusable>
            ) : (
              <Pressable
                accessibilityLabel="Close search"
                accessibilityRole="button"
                onPress={() => {
                  setSearchActive(false);
                  setSearchText('');
                  setSuggestions([]);
                }}
                style={({pressed}) => ({
                  alignItems: 'center',
                  height: 48,
                  justifyContent: 'center',
                  opacity: pressed ? 0.62 : 1,
                  width: 44,
                })}>
                <MaterialCommunityIcons
                  name="arrow-left"
                  size={26}
                  color={colors.onSurface}
                />
              </Pressable>
            )}

            <View style={{flex: 1}}>
              <SearchField
                ref={searchFieldRef}
                value={searchText}
                onChangeText={handleTextChange}
                onSubmit={submitProviderSearch}
                placeholder={`Search in ${provider.display_name}...`}
              />
            </View>

            {searchText.length > 0 && (
              <Pressable
                accessibilityLabel="Clear search"
                accessibilityRole="button"
                onPress={() => {
                  suppressSuggestionsRef.current = false;
                  setSearchText('');
                  setSuggestions([]);
                }}
                style={({pressed}) => ({
                  alignItems: 'center',
                  height: 48,
                  justifyContent: 'center',
                  opacity: pressed ? 0.62 : 1,
                  width: 36,
                })}>
                <MaterialCommunityIcons
                  name="close"
                  size={22}
                  color={colors.onSurfaceVariant}
                />
              </Pressable>
            )}
          </View>

          {/* Real-time Search Suggestions */}
          <View style={{flex: 1}}>
            <SearchSuggestions
              suggestions={suggestions}
              onSelectSuggestion={handleSelectSuggestion}
            />
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
});

Hero.displayName = 'Hero';

export default Hero;
