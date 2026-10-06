import React from 'react';
import {BackHandler} from 'react-native';
import renderer, {act} from 'react-test-renderer';
import {
  AUTO_NEXT_COUNTDOWN_SECONDS,
  AUTO_NEXT_SEEK_BACK_SECONDS,
  isSeekAwayFromEnd,
  shouldAutoPlayNext,
} from '../src/lib/player/autoNext';
import AutoNextOverlay from '../src/components/AutoNextOverlay';

jest.mock('../src/components/tv', () => {
  const ReactModule = require('react');
  const {View} = require('react-native');
  return {
    TVFocusGuide: ({children, style}: any) =>
      ReactModule.createElement(View, {style}, children),
  };
});

const allowed = {
  enabled: true,
  hasNext: true,
  isCasting: false,
  isMovie: false,
};

describe('shouldAutoPlayNext', () => {
  it('allows the next episode when every condition holds', () => {
    expect(shouldAutoPlayNext(allowed)).toBe(true);
  });

  it('blocks when the setting is off, there is no next episode, casting, or a movie', () => {
    expect(shouldAutoPlayNext({...allowed, enabled: false})).toBe(false);
    expect(shouldAutoPlayNext({...allowed, hasNext: false})).toBe(false);
    expect(shouldAutoPlayNext({...allowed, isCasting: true})).toBe(false);
    expect(shouldAutoPlayNext({...allowed, isMovie: true})).toBe(false);
  });
});

describe('isSeekAwayFromEnd', () => {
  it('treats a seek near the end as staying at the end', () => {
    expect(isSeekAwayFromEnd(1200, 1200)).toBe(false);
    expect(
      isSeekAwayFromEnd(1200 - AUTO_NEXT_SEEK_BACK_SECONDS + 1, 1200),
    ).toBe(false);
  });

  it('treats a seek back as leaving the end', () => {
    expect(isSeekAwayFromEnd(1200 - AUTO_NEXT_SEEK_BACK_SECONDS, 1200)).toBe(
      true,
    );
    expect(isSeekAwayFromEnd(0, 1200)).toBe(true);
  });

  it('ignores unknown durations', () => {
    expect(isSeekAwayFromEnd(10, 0)).toBe(false);
    expect(isSeekAwayFromEnd(NaN, 1200)).toBe(false);
    expect(isSeekAwayFromEnd(10, Infinity)).toBe(false);
  });
});

describe('AutoNextOverlay', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const render = (onPlayNow = jest.fn(), onCancel = jest.fn()) => {
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <AutoNextOverlay
          seconds={AUTO_NEXT_COUNTDOWN_SECONDS}
          focusColor="#ff0000"
          onPlayNow={onPlayNow}
          onCancel={onCancel}
        />,
      );
    });
    return tree;
  };

  const label = (tree: renderer.ReactTestRenderer) =>
    tree.root
      .findAllByType(require('react-native').Text)
      .map(node => node.props.children)
      .find(text => typeof text === 'string' && text.startsWith('Next'));

  it('counts down and plays the next episode once at zero', () => {
    const onPlayNow = jest.fn();
    const tree = render(onPlayNow);
    expect(label(tree)).toBe(`Next episode in ${AUTO_NEXT_COUNTDOWN_SECONDS}s`);

    act(() => jest.advanceTimersByTime(3000));
    expect(label(tree)).toBe(
      `Next episode in ${AUTO_NEXT_COUNTDOWN_SECONDS - 3}s`,
    );
    expect(onPlayNow).not.toHaveBeenCalled();

    act(() => jest.advanceTimersByTime(AUTO_NEXT_COUNTDOWN_SECONDS * 1000));
    expect(onPlayNow).toHaveBeenCalledTimes(1);
    act(() => tree.unmount());
  });

  it('wires the Play now and Cancel buttons', () => {
    const onPlayNow = jest.fn();
    const onCancel = jest.fn();
    const tree = render(onPlayNow, onCancel);

    act(() =>
      tree.root.findByProps({accessibilityLabel: 'Cancel'}).props.onPress(),
    );
    expect(onCancel).toHaveBeenCalledTimes(1);
    act(() =>
      tree.root.findByProps({accessibilityLabel: 'Play now'}).props.onPress(),
    );
    expect(onPlayNow).toHaveBeenCalledTimes(1);
    act(() => tree.unmount());
  });

  it('stops counting after unmount', () => {
    const onPlayNow = jest.fn();
    const tree = render(onPlayNow);
    act(() => tree.unmount());
    act(() => jest.advanceTimersByTime(AUTO_NEXT_COUNTDOWN_SECONDS * 2000));
    expect(onPlayNow).not.toHaveBeenCalled();
  });

  it('cancels on the back button and releases it after unmount', () => {
    const remove = jest.fn();
    let backHandler: (() => boolean) | undefined;
    const spy = jest
      .spyOn(BackHandler, 'addEventListener')
      .mockImplementation((_event, handler) => {
        backHandler = handler as () => boolean;
        return {remove};
      });
    try {
      const onCancel = jest.fn();
      const tree = render(jest.fn(), onCancel);
      expect(backHandler?.()).toBe(true);
      expect(onCancel).toHaveBeenCalledTimes(1);
      act(() => tree.unmount());
      expect(remove).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
    }
  });
});
