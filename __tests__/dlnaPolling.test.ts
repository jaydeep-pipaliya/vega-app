import {dlnaService as dlna} from '../src/lib/remote/dlnaService';
import {NativeModules} from 'react-native';
import {useRemoteStore} from '../src/lib/remote/remoteStore';
jest.mock('react-native', () => ({
  Platform: {OS: 'android'},
  DeviceEventEmitter: {addListener: jest.fn()},
  NativeModules: {
    VegaDlna: {
      setAVTransportURI: jest.fn(async () => {}),
      play: jest.fn(async () => {}),
      getPositionInfo: jest.fn(),
    },
  },
}));
const native = NativeModules.VegaDlna;
const device = {
  id: 'tv',
  name: 'TV',
  type: 'dlna' as const,
  controlUrl: 'http://tv',
};
const tick = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};
beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  useRemoteStore.getState().resetSession();
});
afterEach(() => {
  dlna.stopPolling();
  jest.useRealTimers();
});
it('allows one poll in flight and discards its reply after a stream replacement', async () => {
  let resolve!: (v: any) => void;
  native.getPositionInfo.mockImplementation(
    () => new Promise(r => (resolve = r)),
  );
  await dlna.loadMedia(device, 'http://phone/A', 'A', undefined, 0, 900);
  jest.advanceTimersByTime(3000);
  expect(native.getPositionInfo).toHaveBeenCalledTimes(1);
  await dlna.loadMedia(device, 'http://phone/B', 'B', undefined, 200, 600);
  resolve({position: 10, duration: 900, trackUri: 'http://phone/A'});
  await tick();
  expect(useRemoteStore.getState().currentTime).toBe(0);
  native.getPositionInfo.mockResolvedValue({position: 5, duration: 600});
  jest.advanceTimersByTime(1000);
  await tick();
  expect(useRemoteStore.getState().currentTime).toBe(205);
  expect(useRemoteStore.getState().duration).toBe(600);
});
it('does not send Play when a load is canceled while setting its URI', async () => {
  let resolve!: () => void;
  native.setAVTransportURI.mockImplementationOnce(
    () => new Promise<void>(r => (resolve = r)),
  );
  let current = true;
  const loading = dlna.loadMedia(
    device,
    'http://phone/A',
    'A',
    undefined,
    0,
    900,
    () => current,
  );
  const canceled = expect(loading).rejects.toThrow('canceled');
  current = false;
  resolve();
  await canceled;
  expect(native.play).not.toHaveBeenCalled();
});
