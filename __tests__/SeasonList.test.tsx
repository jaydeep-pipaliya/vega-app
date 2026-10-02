import React from 'react';
import renderer, {act} from 'react-test-renderer';

jest.mock('react-native-reanimated', () => {
  const {View} = require('react-native');
  return {
    __esModule: true,
    default: {View},
    useAnimatedStyle: () => ({}),
    useSharedValue: (value: unknown) => ({value}),
    withRepeat: (value: unknown) => value,
    withTiming: (value: unknown) => value,
    cancelAnimation: jest.fn(),
  };
});
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({navigate: jest.fn()}),
  useFocusEffect: jest.fn(),
}));
jest.mock('../src/lib/tv', () => ({isTV: false}));
jest.mock('../src/lib/tv/useTVFocusBorderColor', () => ({
  useTVFocusBorderColor: () => '#FFFFFF',
}));
jest.mock('../src/components/tv', () => {
  const {View} = require('react-native');
  return {TVFocusable: View, TVFocusGuide: View};
});
jest.mock('../src/components/season/SeasonSearchSortBar', () => () => null);
jest.mock('@expo/vector-icons/Ionicons', () => 'Ionicons');
jest.mock('@expo/vector-icons/MaterialCommunityIcons', () => 'Icon');
jest.mock('@expo/vector-icons/Feather', () => 'Feather');
jest.mock('expo-intent-launcher', () => ({}));
jest.mock('react-native-haptic-feedback', () => ({trigger: jest.fn()}));
jest.mock('../src/components/Downloader', () => () => null);
jest.mock('../src/components/Skeleton', () => () => null);
jest.mock('../src/components/ui/DropdownField', () => () => null);
jest.mock('../src/components/ui/MaterialDialogSurface', () => () => null);
jest.mock('../src/components/ui/LoadingIndicator', () => () => null);
jest.mock('../src/components/EpisodeRowContent', () => ({
  __esModule: true,
  default: () => null,
  getValidImageUri: () => undefined,
}));
jest.mock('../src/components/ui/Text', () => {
  const {Text} = require('react-native');
  return {__esModule: true, default: Text};
});
jest.mock('../src/lib/storage', () => ({
  cacheStorage: {getString: () => undefined, setString: jest.fn()},
  mainStorage: {getString: () => undefined, setString: jest.fn()},
  settingsStorage: {
    isHapticFeedbackEnabled: () => false,
    getExcludedQualities: () => [],
  },
}));
jest.mock('../src/lib/file/ifExists', () => ({ifExists: jest.fn()}));
jest.mock('../src/lib/hooks/useEpisodes', () => ({
  useEpisodes: () => ({data: [], isLoading: false, refetch: jest.fn()}),
  useStreamData: () => ({fetchStreams: jest.fn()}),
}));
jest.mock('../src/lib/zustand/downloadsStore', () => ({
  __esModule: true,
  default: (selector: (state: object) => unknown) => selector({downloads: {}}),
}));
jest.mock('../src/lib/zustand/continueWatchingStore', () => ({
  __esModule: true,
  default: (selector: (state: object) => unknown) => selector({items: []}),
}));
jest.mock('../src/theme/M3PaletteContext', () => ({
  useM3Colors: () => ({}),
}));
jest.mock('../src/lib/sync/syncService', () => ({
  setSyncedEpisodeProgress: jest.fn(),
}));

import SeasonList from '../src/components/SeasonList';

const props = {
  poster: {},
  type: 'series',
  metaTitle: 'Show',
  providerValue: 'vega',
  refreshing: false,
  routeParams: {link: 'https://example.com/show', provider: 'vega'},
} as any;

describe('SeasonList', () => {
  it('renders seasons after an empty list is refreshed', async () => {
    let tree: renderer.ReactTestRenderer | undefined;
    await act(async () => {
      tree = renderer.create(<SeasonList {...props} LinkList={[]} />);
    });

    await act(async () => {
      tree!.update(
        <SeasonList
          {...props}
          LinkList={[
            {title: 'Season 1', episodesLink: 'https://example.com/s1'},
          ]}
        />,
      );
    });

    expect(JSON.stringify(tree!.toJSON())).not.toContain(
      'No Streams Available',
    );
  });
});
