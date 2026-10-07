import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {BackHandler, Clipboard, ToastAndroid} from 'react-native';

jest.mock('@expo/vector-icons/MaterialCommunityIcons', () => 'Icon');
jest.mock('../src/lib/tv/useTVFocusBorderColor', () => ({
  useTVFocusBorderColor: () => '#FFFFFF',
}));
jest.mock('../src/components/tv', () => {
  const {View} = require('react-native');
  return {TVFocusable: View};
});
jest.mock('../src/components/ui/Text', () => {
  const {Text} = require('react-native');
  return {__esModule: true, default: Text};
});
jest.mock('../src/theme/M3PaletteContext', () => ({
  useM3Colors: () => ({}),
}));

import EpisodeSelectionBar from '../src/components/season/EpisodeSelectionBar';
import {
  EpisodeSelection,
  useEpisodeSelection,
} from '../src/components/season/useEpisodeSelection';

const textOf = (tree: renderer.ReactTestRenderer) =>
  JSON.stringify(tree.toJSON());

describe('EpisodeSelectionBar', () => {
  const handlers = {
    onExit: jest.fn(),
    onToggleSelectAll: jest.fn(),
    onCopyLinks: jest.fn(),
    onCancelCopy: jest.fn(),
  };

  it('shows the count and copies on press', async () => {
    let tree: renderer.ReactTestRenderer | undefined;
    await act(async () => {
      tree = renderer.create(
        <EpisodeSelectionBar
          selectedCount={3}
          allSelected={false}
          progress={null}
          {...handlers}
        />,
      );
    });
    expect(textOf(tree!)).toContain('3');
    expect(textOf(tree!)).toContain('selected');

    const copy = tree!.root.findByProps({accessibilityLabel: 'Copy links'});
    expect(copy.props.disabled).toBe(false);
    copy.props.onPress();
    tree!.root.findByProps({accessibilityLabel: 'Select all'}).props.onPress();
    tree!.root
      .findByProps({accessibilityLabel: 'Exit selection'})
      .props.onPress();
    expect(handlers.onCopyLinks).toHaveBeenCalledTimes(1);
    expect(handlers.onToggleSelectAll).toHaveBeenCalledTimes(1);
    expect(handlers.onExit).toHaveBeenCalledTimes(1);
  });

  it('disables copy when nothing is selected', async () => {
    let tree: renderer.ReactTestRenderer | undefined;
    await act(async () => {
      tree = renderer.create(
        <EpisodeSelectionBar
          selectedCount={0}
          allSelected={false}
          progress={null}
          {...handlers}
        />,
      );
    });
    expect(
      tree!.root.findByProps({accessibilityLabel: 'Copy links'}).props.disabled,
    ).toBe(true);
  });

  it('shows progress with a cancel button', async () => {
    let tree: renderer.ReactTestRenderer | undefined;
    await act(async () => {
      tree = renderer.create(
        <EpisodeSelectionBar
          selectedCount={12}
          allSelected
          progress={{current: 3, total: 12}}
          {...handlers}
        />,
      );
    });
    expect(textOf(tree!)).toContain('Getting links ');
    expect(textOf(tree!)).toMatch(/"3".*"\/".*"12"/);
    expect(
      tree!.root.findAllByProps({accessibilityLabel: 'Copy links'}),
    ).toEqual([]);
    tree!.root
      .findByProps({accessibilityLabel: 'Cancel getting links'})
      .props.onPress();
    expect(handlers.onCancelCopy).toHaveBeenCalledTimes(1);
  });
});

describe('useEpisodeSelection', () => {
  const items = [
    {link: 'ep1', title: 'Episode 1'},
    {link: 'ep2', title: 'Episode 2'},
    {link: 'ep3', title: 'Episode 3'},
  ];
  let current: EpisodeSelection;
  const Harness = (props: {
    resetKey: string;
    fetchStreams: (link: string, signal: AbortSignal) => Promise<any>;
  }) => {
    current = useEpisodeSelection({items, ...props});
    return null;
  };

  let setString: jest.SpyInstance;
  let toast: jest.SpyInstance;
  beforeEach(() => {
    setString = jest.spyOn(Clipboard, 'setString').mockImplementation(() => {});
    toast = jest.spyOn(ToastAndroid, 'show').mockImplementation(() => {});
    setString.mockClear();
    toast.mockClear();
  });
  afterEach(() => jest.restoreAllMocks());

  it('copies the selected links in season order as one entry', async () => {
    const fetchStreams = jest.fn(async (link: string) =>
      link === 'ep2'
        ? []
        : [{server: 'S', type: 'mp4', link: `https://cdn.example/${link}`}],
    );
    let tree: renderer.ReactTestRenderer | undefined;
    await act(async () => {
      tree = renderer.create(
        <Harness resetKey="s1" fetchStreams={fetchStreams} />,
      );
    });

    await act(async () => current.start('ep3'));
    await act(async () => current.toggle('ep1'));
    expect(current.active).toBe(true);
    expect(current.selectedCount).toBe(2);
    await act(async () => current.toggleAll());
    expect(current.allSelected).toBe(true);

    await act(async () => {
      await current.copyLinks();
    });

    expect(fetchStreams.mock.calls.map(call => call[0])).toEqual([
      'ep1',
      'ep2',
      'ep3',
    ]);
    expect(setString).toHaveBeenCalledWith(
      'https://cdn.example/ep1\nhttps://cdn.example/ep3',
    );
    expect(toast).toHaveBeenCalledWith(
      'Copied 2 links, 1 skipped',
      ToastAndroid.LONG,
    );
    expect(current.progress).toBeNull();

    // A season change ends select mode.
    await act(async () => {
      tree!.update(<Harness resetKey="s2" fetchStreams={fetchStreams} />);
    });
    expect(current.active).toBe(false);
    expect(current.selectedCount).toBe(0);
  });

  it('cancels on back press and copies nothing', async () => {
    let release: (() => void) | undefined;
    const fetchStreams = jest.fn(
      () =>
        new Promise<any>(resolve => {
          release = () =>
            resolve([{server: 'S', type: 'mp4', link: 'https://x/1'}]);
        }),
    );
    const listeners: Array<() => boolean> = [];
    jest
      .spyOn(BackHandler, 'addEventListener')
      .mockImplementation((_event, listener) => {
        listeners.push(listener as () => boolean);
        return {remove: jest.fn()};
      });

    await act(async () => {
      renderer.create(<Harness resetKey="s1" fetchStreams={fetchStreams} />);
    });
    await act(async () => current.start('ep1'));

    let copying: Promise<void> | undefined;
    await act(async () => {
      copying = current.copyLinks();
    });
    expect(current.progress).toEqual({current: 1, total: 1});

    await act(async () => {
      expect(listeners[listeners.length - 1]()).toBe(true);
    });
    expect(current.progress).toBeNull();
    expect(current.active).toBe(true);

    await act(async () => {
      release!();
      await copying;
    });
    expect(setString).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith('Cancelled', ToastAndroid.SHORT);

    // A second back press leaves select mode.
    await act(async () => {
      expect(listeners[listeners.length - 1]()).toBe(true);
    });
    expect(current.active).toBe(false);
  });
});
