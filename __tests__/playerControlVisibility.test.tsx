import React, {useEffect} from 'react';
import renderer, {act} from 'react-test-renderer';
import {useControlVisibility} from '../src/components/media-console/hooks/useControlVisibility';
import {useJSAnimations} from '../src/components/media-console/hooks/useAnimations';
import {useControlTimeout} from '../src/components/media-console/hooks/useControlTimeout';

it('auto-hide survives parent feedback and subsequent progress renders', () => {
  let state!: ReturnType<typeof useControlVisibility>;
  const changed = jest.fn();
  const Harness = ({external}: {external: boolean}) => {
    state = useControlVisibility(external, true);
    useEffect(() => changed(state[0]), [state[0]]);
    return null;
  };
  let tree!: renderer.ReactTestRenderer;
  act(() => {tree = renderer.create(<Harness external={true} />);});
  act(() => state[1](false));
  expect(state[0]).toBe(false);
  act(() => tree.update(<Harness external={false} />));
  for (let i = 0; i < 10; i++) act(() => tree.update(<Harness external={false} />));
  expect(changed.mock.calls.map(call => call[0])).toEqual([true, false]);
  act(() => tree.update(<Harness external={true} />));
  expect(state[0]).toBe(true);
  act(() => tree.unmount());
});

it('keeps control animations stable across progress renders', () => {
  let animations!: ReturnType<typeof useJSAnimations>;
  const Harness = () => {animations = useJSAnimations(250); return null;};
  let tree!: renderer.ReactTestRenderer;
  act(() => {tree = renderer.create(<Harness />);});
  const initial = animations;
  act(() => tree.update(<Harness />));
  expect(animations).toBe(initial);
  act(() => tree.unmount());
});

it('auto-hides and notifies the parent despite repeated progress renders', () => {
  jest.useFakeTimers();
  let visible = true;
  let tree!: renderer.ReactTestRenderer;
  const Harness = ({external}: {external: boolean}) => {
    const [local, setLocal] = useControlVisibility(external, true);
    visible = local;
    useControlTimeout({controlTimeoutDelay: 10000, mounted: true,
      showControls: local, setShowControls: setLocal, alwaysShowControls: false});
    return null;
  };
  try {
    act(() => {tree = renderer.create(<Harness external={true} />);});
    for (let i = 0; i < 9; i++) {
      act(() => jest.advanceTimersByTime(1000));
      act(() => tree.update(<Harness external={true} />));
    }
    expect(visible).toBe(true);
    act(() => jest.advanceTimersByTime(1000));
    expect(visible).toBe(false);
    act(() => tree.update(<Harness external={false} />));
    expect(visible).toBe(false);
    act(() => tree.update(<Harness external={true} />));
    expect(visible).toBe(true);
  } finally {
    act(() => tree.unmount());
    jest.useRealTimers();
  }
});
