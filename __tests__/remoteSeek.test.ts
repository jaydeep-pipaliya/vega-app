import {useRemoteStore} from '../src/lib/remote/remoteStore';

beforeEach(() => useRemoteStore.getState().resetSession());

it('holds the requested position through stale progress and command acknowledgement', () => {
  const store = useRemoteStore.getState();
  store.setTimeline(10, 300);
  store.beginSeek(1, 180);
  store.setTimeline(11, 0);
  store.acknowledgeSeek(1);
  store.setTimeline(12, 300);
  expect(useRemoteStore.getState().currentTime).toBe(180);
  expect(useRemoteStore.getState().duration).toBe(300);
  expect(useRemoteStore.getState().pendingSeek).not.toBeNull();
  store.setTimeline(180.5, 300);
  expect(useRemoteStore.getState().currentTime).toBe(180.5);
  expect(useRemoteStore.getState().pendingSeek).toBeNull();
});

it('accepts receiver confirmation arriving before the seek promise resolves', () => {
  const store = useRemoteStore.getState();
  store.beginSeek(1, 100);
  store.setTimeline(100, 300);
  expect(useRemoteStore.getState().pendingSeek).not.toBeNull();
  store.acknowledgeSeek(1);
  expect(useRemoteStore.getState().pendingSeek).toBeNull();
});

it('ignores completion or failure from an older seek', () => {
  const store = useRemoteStore.getState();
  store.beginSeek(1, 100);
  store.beginSeek(2, 200);
  store.acknowledgeSeek(1);
  store.cancelSeek(1);
  expect(useRemoteStore.getState().pendingSeek?.id).toBe(2);
  expect(useRemoteStore.getState().currentTime).toBe(200);
});

it('releases the pending indicator and restores reported position on failure', () => {
  const store = useRemoteStore.getState();
  store.beginSeek(1, 200);
  store.setTimeline(20, 300);
  store.cancelSeek(1);
  expect(useRemoteStore.getState().currentTime).toBe(20);
  expect(useRemoteStore.getState().pendingSeek).toBeNull();
});
