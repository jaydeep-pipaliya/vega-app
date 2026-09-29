import React from 'react';
import renderer, {act} from 'react-test-renderer';

const mockNavigate = jest.fn();
const episodes = [
  {title: 'Episode 1', link: 'https://example.com/e1'},
  {title: 'Episode 2', link: 'https://example.com/e2'},
  {title: 'Episode 3', link: 'https://example.com/e3'},
];
let mockContinueItems: object[] = [];

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
  useNavigation: () => ({navigate: mockNavigate}),
  useFocusEffect: jest.fn(),
  useIsFocused: () => true,
}));
jest.mock('../src/lib/tv', () => ({isTV: false}));
jest.mock('../src/lib/tv/useTVFocusBorderColor', () => ({
  useTVFocusBorderColor: () => '#FFFFFF',
}));
jest.mock('../src/components/tv', () => {
  const {Pressable, View} = require('react-native');
  return {TVFocusable: Pressable, TVFocusGuide: View};
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
    getBool: () => false,
  },
}));
jest.mock('../src/lib/file/ifExists', () => ({
  ifExists: jest.fn(async () => undefined),
}));
jest.mock('../src/lib/hooks/useEpisodes', () => ({
  useEpisodes: () => ({data: episodes, isLoading: false, refetch: jest.fn()}),
  useStreamData: () => ({fetchStreams: jest.fn()}),
}));
jest.mock('../src/lib/zustand/downloadsStore', () => {
  const store = (selector: (state: object) => unknown) =>
    selector({downloads: {}});
  store.getState = () => ({downloads: {}});
  return {__esModule: true, default: store};
});
jest.mock('../src/lib/zustand/continueWatchingStore', () => ({
  __esModule: true,
  default: (selector: (state: object) => unknown) =>
    selector({items: mockContinueItems}),
}));
jest.mock('../src/theme/M3PaletteContext', () => ({
  useM3Colors: () => ({primary: '#FFFFFF'}),
}));
jest.mock('../src/lib/sync/syncService', () => ({
  setSyncedEpisodeProgress: jest.fn(),
}));

import SeasonList from '../src/components/SeasonList';
import {findResumeEpisodeIndex} from '../src/components/season/ResumeEpisodeButton';

const showLink = 'https://example.com/show';
const savedItem = (episode: object, position: number, duration = 1200) =>
  ({
    id: showLink,
    title: 'Show',
    episode,
    type: 'series',
    providerValue: 'vega',
    infoUrl: showLink,
    position,
    duration,
    updatedAt: 1,
  }) as any;

describe('findResumeEpisodeIndex', () => {
  it('finds the saved episode by link', () => {
    expect(
      findResumeEpisodeIndex(episodes, savedItem({...episodes[1]}, 300)),
    ).toBe(1);
  });

  it('skips episodes that are not in the list', () => {
    expect(
      findResumeEpisodeIndex(
        episodes,
        savedItem({title: 'Other', link: 'https://example.com/x'}, 300),
      ),
    ).toBe(-1);
  });

  it('skips watched or not started episodes', () => {
    expect(findResumeEpisodeIndex(episodes, savedItem(episodes[1], 1190))).toBe(
      -1,
    );
    expect(findResumeEpisodeIndex(episodes, savedItem(episodes[1], 0))).toBe(
      -1,
    );
  });
});

describe('SeasonList resume button', () => {
  const props = {
    poster: {},
    type: 'series',
    metaTitle: 'Show',
    providerValue: 'vega',
    refreshing: false,
    routeParams: {link: showLink, provider: 'vega'},
    LinkList: [{title: 'Season 1', episodesLink: 'https://example.com/s1'}],
  } as any;

  const render = async () => {
    let tree: renderer.ReactTestRenderer | undefined;
    await act(async () => {
      tree = renderer.create(<SeasonList {...props} />);
    });
    return tree!;
  };

  const findResumeButton = (tree: renderer.ReactTestRenderer) =>
    tree.root.findAll(
      node =>
        typeof node.props.accessibilityLabel === 'string' &&
        node.props.accessibilityLabel.startsWith('Resume') &&
        typeof node.props.onPress === 'function',
    );

  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it('plays the saved episode from the resume button', async () => {
    mockContinueItems = [savedItem(episodes[2], 754)];
    const tree = await render();
    const [button] = findResumeButton(tree);

    expect(button.props.accessibilityLabel).toBe('Resume Episode 3 at 12:34');
    await act(async () => {
      button.props.onPress();
    });

    expect(mockNavigate).toHaveBeenCalledWith(
      'Player',
      expect.objectContaining({linkIndex: 2, infoUrl: showLink}),
    );
  });

  it('hides the button when nothing is saved for the show', async () => {
    mockContinueItems = [];
    const tree = await render();

    expect(findResumeButton(tree)).toHaveLength(0);
  });
});
