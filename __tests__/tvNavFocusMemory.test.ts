import React from 'react';
import renderer, {act} from 'react-test-renderer';

jest.mock('../src/lib/tv/constants', () => ({isTV: true}));
jest.mock('@react-navigation/native', () => ({useIsFocused: jest.fn(() => true)}));
jest.mock('react-native', () => ({
  findNodeHandle: jest.fn(() => 42),
  UIManager: {dispatchViewManagerCommand: jest.fn()},
}));

import {UIManager} from 'react-native';
import {useTVNavFocusMemory} from '../src/lib/tv/useTVNavFocusMemory';
import useTVNavigationStore, {
  selectRailFocusHandle,
} from '../src/lib/zustand/tvNavigationStore';

const dispatch = UIManager.dispatchViewManagerCommand as jest.Mock;

type Memory = ReturnType<typeof useTVNavFocusMemory>;

const setup = (initial: {isNavFocused: boolean; preferred: boolean}) => {
  let memory!: Memory;
  const ref = {current: {}};
  const Harness = ({isNavFocused, preferred}: typeof initial) => {
    memory = useTVNavFocusMemory({
      ref,
      isNavFocused,
      hasTVPreferredFocus: preferred,
    });
    return null;
  };
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(React.createElement(Harness, initial));
  });
  return {
    get memory() {
      return memory;
    },
    update: (props: typeof initial) =>
      act(() => tree.update(React.createElement(Harness, props))),
    unmount: () => act(() => tree.unmount()),
  };
};

beforeEach(() => {
  jest.useFakeTimers();
  dispatch.mockClear();
  useTVNavigationStore.setState({
    activeTabKey: null,
    activeScreenFocusHandle: null,
    focusHandleTabKey: null,
  });
});

afterEach(() => {
  jest.useRealTimers();
});

it('keeps preferred focus unchanged when the screen is shown again', () => {
  const h = setup({isNavFocused: true, preferred: true});
  expect(h.memory.preferredFocus).toBe(true);
  h.update({isNavFocused: false, preferred: false});
  // Frozen while hidden, so native code never sees false -> true on return.
  expect(h.memory.preferredFocus).toBe(true);
  h.update({isNavFocused: true, preferred: true});
  expect(h.memory.preferredFocus).toBe(true);
  h.unmount();
});

it('does not claim preferred focus while the screen is hidden', () => {
  const h = setup({isNavFocused: false, preferred: true});
  expect(h.memory.preferredFocus).toBe(false);
  h.update({isNavFocused: true, preferred: true});
  expect(h.memory.preferredFocus).toBe(true);
  h.unmount();
});

it('restores focus to the element that was focused when the screen was left', () => {
  const h = setup({isNavFocused: true, preferred: false});
  act(() => h.memory.onFocus());
  h.update({isNavFocused: false, preferred: false});
  act(() => h.memory.onBlur());
  h.update({isNavFocused: true, preferred: false});
  act(() => jest.advanceTimersByTime(60));
  expect(dispatch).toHaveBeenCalledWith(42, 'requestTVFocus', []);
  // Focus arrived, so the retry does nothing.
  act(() => h.memory.onFocus());
  dispatch.mockClear();
  act(() => jest.advanceTimersByTime(400));
  expect(dispatch).not.toHaveBeenCalled();
  h.unmount();
});

it('does not move focus for an element that was not focused', () => {
  const h = setup({isNavFocused: true, preferred: false});
  h.update({isNavFocused: false, preferred: false});
  h.update({isNavFocused: true, preferred: false});
  act(() => jest.advanceTimersByTime(1000));
  expect(dispatch).not.toHaveBeenCalled();
  h.unmount();
});

it('gives the rail a target only for the tab that saved it', () => {
  const store = useTVNavigationStore.getState();
  act(() => store.setActiveTabKey('home'));
  const h = setup({isNavFocused: true, preferred: false});
  act(() => h.memory.onFocus());
  expect(selectRailFocusHandle(useTVNavigationStore.getState())).toBe(42);
  act(() => store.setActiveTabKey('search'));
  expect(selectRailFocusHandle(useTVNavigationStore.getState())).toBeNull();
  act(() => store.setActiveTabKey('home'));
  expect(selectRailFocusHandle(useTVNavigationStore.getState())).toBe(42);
  h.unmount();
});
