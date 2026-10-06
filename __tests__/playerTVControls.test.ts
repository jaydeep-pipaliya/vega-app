import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {usePlayerTVControls} from '../src/lib/tv/usePlayerTVControls';

let mockSeekInterval = 10;
let mockRemoteHandler: ((event: {eventType: string}) => void) | undefined;

jest.mock('../src/lib/tv/constants', () => ({isTV: true}));
jest.mock('../src/lib/tv/useTVRemote', () => ({
  useTVRemote: (handler: (event: {eventType: string}) => void) => {
    mockRemoteHandler = handler;
  },
}));
jest.mock('../src/lib/tv/useTVFocusBorderColor', () => ({
  useTVFocusBorderColor: () => '#fff',
}));
jest.mock('../src/lib/storage', () => ({
  settingsStorage: {getSeekInterval: () => mockSeekInterval},
}));

const seek = jest.fn();

const Harness = () => {
  usePlayerTVControls({
    playerRef: {current: {seek}},
    videoPositionRef: {current: {position: 100, duration: 1000}},
    showSettings: false,
    setShowSettings: jest.fn(),
    showControls: false,
    setShowControls: jest.fn(),
    primaryColor: '#fff',
  });
  return null;
};

const seekAfterRemoteEvent = (eventType: string) => {
  let tree: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(React.createElement(Harness));
  });
  act(() => mockRemoteHandler?.({eventType}));
  act(() => {
    jest.advanceTimersByTime(400);
  });
  act(() => tree.unmount());
};

describe('TV seek interval', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    seek.mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('seeks by ten seconds by default', () => {
    mockSeekInterval = 10;
    seekAfterRemoteEvent('right');
    expect(seek).toHaveBeenCalledWith(110);
  });

  it('uses the saved seek interval for the D-pad and media keys', () => {
    mockSeekInterval = 85;
    seekAfterRemoteEvent('right');
    expect(seek).toHaveBeenLastCalledWith(185);

    seekAfterRemoteEvent('rewind');
    expect(seek).toHaveBeenLastCalledWith(15);
  });
});
