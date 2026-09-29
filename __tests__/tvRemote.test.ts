import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {DeviceEventEmitter, TVEventHandler} from 'react-native';
import {useTVRemote} from '../src/lib/tv/useTVRemote';

jest.mock('../src/lib/tv/constants', () => ({isTV: true}));
jest.mock('react-native', () => {
  return {
    DeviceEventEmitter: {addListener: jest.fn()},
    TVEventHandler: {addListener: jest.fn()},
  };
});

const Listener = ({onEvent}: {onEvent: (event: {eventType: string}) => void}) => {
  useTVRemote(onEvent);
  return null;
};

it('delivers one event when TVEventHandler is available', () => {
  const onEvent = jest.fn();
  const remove = jest.fn();
  let emit: ((event: {eventType: string}) => void) | undefined;
  (TVEventHandler.addListener as jest.Mock).mockImplementation(callback => {
    emit = callback;
    return {remove};
  });

  let tree: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(React.createElement(Listener, {onEvent}));
  });
  act(() => emit?.({eventType: 'right'}));

  expect(onEvent).toHaveBeenCalledTimes(1);
  expect(DeviceEventEmitter.addListener).not.toHaveBeenCalled();
  act(() => tree.unmount());
  expect(remove).toHaveBeenCalledTimes(1);
});
