import React, {useState} from 'react';
import renderer, {act} from 'react-test-renderer';
import PlayerDelayControl from '../src/components/PlayerDelayControl';

jest.mock('@expo/vector-icons/MaterialIcons', () => {
  const ReactModule = require('react');
  const {View} = require('react-native');

  return {
    __esModule: true,
    default: (props: object) => ReactModule.createElement(View, props),
  };
});

jest.mock('../src/lib/tv/useTVFocusBorderColor', () => ({
  useTVFocusBorderColor: (color: string) => color,
}));

const Harness = ({initial}: {initial: number}) => {
  const [delayMs, setDelayMs] = useState(initial);
  return (
    <PlayerDelayControl
      title="Subtitle delay"
      laterLabel="Text shows later"
      earlierLabel="Text shows earlier"
      icon="subtitles"
      delayMs={delayMs}
      accentColor="#3B82F6"
      onChange={setDelayMs}
    />
  );
};

// The outermost match is the Pressable element rendered by the control.
const findReset = (tree: renderer.ReactTestRenderer) =>
  tree.root.findAll(
    node =>
      node.props.accessibilityLabel === 'Reset subtitle delay' &&
      'isTVSelectable' in node.props,
  )[0];

describe('PlayerDelayControl reset button', () => {
  it('stays mounted after reset so TV focus is not lost', async () => {
    let tree: renderer.ReactTestRenderer | undefined;
    await act(async () => {
      tree = renderer.create(<Harness initial={500} />);
    });

    const reset = findReset(tree!);
    expect(reset.props.disabled).toBeFalsy();
    expect(reset.props.focusable).toBe(true);

    await act(async () => {
      reset.props.onFocus();
    });
    await act(async () => {
      reset.props.onPress();
    });

    // Same instance, still mounted and still holding focus.
    const after = findReset(tree!);
    expect(after).toBe(reset);
    expect(after.props.disabled).toBe(true);
    expect(after.props.accessibilityState.disabled).toBe(true);
    expect(after.props.focusable).toBe(true);

    // Once focus moves away it leaves the focus order.
    await act(async () => {
      after.props.onBlur();
    });
    expect(findReset(tree!).props.focusable).toBe(false);
    expect(findReset(tree!).props.isTVSelectable).toBe(false);
  });

  it('is disabled, unfocusable and hidden at zero', async () => {
    let tree: renderer.ReactTestRenderer | undefined;
    await act(async () => {
      tree = renderer.create(<Harness initial={0} />);
    });

    const reset = findReset(tree!);
    expect(reset.props.disabled).toBe(true);
    expect(reset.props.focusable).toBe(false);
    expect(reset.props.style.opacity).toBe(0);
  });
});
