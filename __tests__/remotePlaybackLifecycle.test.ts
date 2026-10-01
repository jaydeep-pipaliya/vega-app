import {remotePlaybackManager as manager} from '../src/lib/remote/remotePlaybackManager';
import {remoteDeliveryService as delivery} from '../src/lib/remote/remoteDeliveryService';
import {dlnaService as dlna} from '../src/lib/remote/dlnaService';
import {useRemoteStore} from '../src/lib/remote/remoteStore';
import {RemotePlaybackCanceledError, isRemotePlaybackCanceled} from '../src/lib/remote/remotePlaybackErrors';
import GoogleCast from 'react-native-google-cast';
jest.mock('../src/lib/tv', () => ({isTV: false}));
jest.mock('../src/lib/services/cookieManager', () => ({
  getCookieHeader: jest.fn(async () => ''),
}));
jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => Math.random().toString()),
}));
jest.mock('react-native-google-cast', () => ({
  __esModule: true,
  default: {
    getSessionManager: (() => {
      const sessionManager = {getCurrentCastSession: jest.fn(async () => null), endCurrentSession: jest.fn(async () => {})};
      return () => sessionManager;
    })(),
  },
}));
jest.mock('../src/lib/remote/remoteDeliveryService', () => ({
  remoteDeliveryService: {
    onMediaAction: jest.fn(),
    inspectTracks: jest.fn(),
    prepareStream: jest.fn(),
    cleanupSession: jest.fn(async () => {}),
    startForegroundService: jest.fn(async () => {}),
    stopForegroundService: jest.fn(async () => {}),
    stopServer: jest.fn(async () => {}),
    updateMediaPlayback: jest.fn(async () => {}),
  },
}));
jest.mock('../src/lib/remote/dlnaService', () => ({
  dlnaService: {
    setOnUriObserved: jest.fn(),
    loadMedia: jest.fn(async () => {}),
    seek: jest.fn(async () => {}),
    stop: jest.fn(async () => {}),
    stopPolling: jest.fn(),
  },
}));
const device = {
  id: 'tv',
  name: 'TV',
  type: 'dlna' as const,
  controlUrl: 'http://tv',
};
const inspected = {
  audioTracks: [{id: '0', index: 0, codec: 'aac', isSelected: true}],
  subtitleTracks: [],
  durationSeconds: 900,
  container: 'mp4',
  hasVideo: true,
};
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => {
    resolve = r;
  });
  return {promise, resolve};
};
const tick = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};
beforeEach(() => {
  jest.clearAllMocks();
  (GoogleCast.getSessionManager().getCurrentCastSession as jest.Mock).mockResolvedValue(null);
  useRemoteStore.getState().resetSession();
  (delivery.inspectTracks as jest.Mock).mockResolvedValue(inspected);
  (delivery.prepareStream as jest.Mock).mockImplementation(async o => ({
    streamUrl: 'http://phone/' + o.sessionId,
    mimeType: 'video/mp4',
    durationSeconds: 900,
    timelineOffsetSeconds: 0,
  }));
});
afterEach(async () => {
  await manager.stop();
});

it.each(['cast', 'dlna'] as const)('seeks video-only remuxed media on %s without inventing an audio track', async type => {
  (delivery.inspectTracks as jest.Mock).mockResolvedValue({...inspected, container: 'matroska', audioTracks: []});
  (delivery.prepareStream as jest.Mock).mockImplementation(async o => ({
    streamUrl: 'http://phone/' + o.sessionId,
    mimeType: 'video/mp4', durationSeconds: 900,
    timelineOffsetSeconds: o.startPositionSeconds || 0,
  }));
  await manager.startRemotePlayback(device, {sourceUrl: 'http://source/silent.mkv', title: 'Silent'});
  const load = jest.spyOn(manager as any, 'loadOnCast').mockResolvedValue(undefined);
  if (type === 'cast') {
    useRemoteStore.getState().setConnectedDevice({...device, type: 'cast'});
    manager.initCastClient({seek: jest.fn(), pause: jest.fn()} as any);
  }
  jest.useFakeTimers();
  try {
    const seek = manager.seek(120);
    jest.advanceTimersByTime(700);
    await seek;
    expect(delivery.prepareStream).toHaveBeenLastCalledWith(expect.objectContaining({
      mode: 'ffmpeg', startPositionSeconds: 120, audioTrackIndex: 0,
    }));
    if (type === 'cast') expect(load).toHaveBeenCalledTimes(1);
    expect(useRemoteStore.getState().audioTracks).toEqual([]);
    expect(useRemoteStore.getState().activeAudioTrackId).toBeUndefined();
    expect(useRemoteStore.getState().errorMessage).toBeUndefined();
  } finally {
    load.mockRestore();
    jest.clearAllTimers();
    jest.useRealTimers();
  }
});

it('distinguishes intentional cancellation from genuine receiver failures', () => {
  expect(isRemotePlaybackCanceled(new RemotePlaybackCanceledError())).toBe(true);
  expect(isRemotePlaybackCanceled({code: 'REMOTE_PLAYBACK_CANCELED'})).toBe(true);
  expect(isRemotePlaybackCanceled(new Error('No session'))).toBe(false);
  expect(isRemotePlaybackCanceled(new Error('Receiver canceled playback unexpectedly'))).toBe(false);
});

it('proxies every external Cast subtitle while keeping a direct video URL', async () => {
  const client = {loadMedia: jest.fn(async () => {}), setActiveTrackIds: jest.fn(async () => {})};
  (GoogleCast.getSessionManager().getCurrentCastSession as jest.Mock).mockResolvedValue({
    client, getCastDevice: async () => ({ipAddress: 'tv'}),
  });
  (delivery.prepareStream as jest.Mock).mockImplementation(async o => ({
    streamUrl: `http://phone/proxy/${o.sessionId}/stream`,
    mimeType: 'video/mp4', durationSeconds: 900, timelineOffsetSeconds: 0,
  }));
  const subtitles = ['srt', 'ass', 'vtt', 'ttml'].map((ext, index) => ({
    id: ext, language: 'en', uri: `https://subtitles/${index}.${ext}?token=abc&lang=en`,
  }));
  subtitles.push({id: 'opaque', language: 'en', uri: 'https://subtitles/download?id=5'});
  await manager.startRemotePlayback({...device, type: 'cast'}, {
    sourceUrl: 'https://video/movie.mp4', title: 'Movie', subtitles,
  });
  expect(delivery.prepareStream).toHaveBeenCalledWith(expect.objectContaining({mode: 'proxy'}));
  const request = client.loadMedia.mock.calls[0] as any;
  expect(request[0].mediaInfo.contentUrl).toBe('https://video/movie.mp4');
  const tracks = request[0].mediaInfo.mediaTracks;
  expect(tracks).toHaveLength(5);
  tracks.forEach((track: any, index: number) => {
    const url = new URL(track.contentId);
    expect(url.origin).toBe('http://phone');
    expect(url.pathname).toMatch(/^\/extsub\/session_[^/]+\/\d+\.(vtt|ttml)$/);
    expect(url.searchParams.get('u')).toBe(subtitles[index].uri);
    expect(track.contentType).toBe(index === 3 ? 'application/ttml+xml' : 'text/vtt');
  });
});

it('does not start the service after a canceled in-flight device load', async () => {
  const wait = deferred<void>();
  (dlna.loadMedia as jest.Mock).mockImplementationOnce(() => wait.promise);
  const old = manager.startRemotePlayback(device, {sourceUrl: 'http://source/A.mp4', title: 'A'});
  const canceled = expect(old).rejects.toThrow('canceled');
  await tick();
  expect(dlna.loadMedia).toHaveBeenCalledTimes(1);
  const stopped = manager.stop();
  wait.resolve();
  await canceled;
  await stopped;
  expect(delivery.startForegroundService).not.toHaveBeenCalled();
  expect(useRemoteStore.getState().status).toBe('idle');
});

it('runs a replacement requested during Stop after teardown', async () => {
  const wait = deferred<void>();
  (delivery.stopServer as jest.Mock).mockImplementationOnce(() => wait.promise);
  const stopped = manager.stop();
  await tick();
  const next = manager.startRemotePlayback(device, {sourceUrl: 'http://source/B.mp4', title: 'B'});
  wait.resolve();
  await stopped;
  await next;
  expect((dlna.loadMedia as jest.Mock).mock.calls[0][2]).toBe('B');
  expect(useRemoteStore.getState().status).toBe('playing');
});

it('cleans canceled prepared media and the previous active session without cleaning the latest', async () => {
  await manager.startRemotePlayback(device, {sourceUrl: 'http://source/A.mp4', title: 'A'});
  const wait = deferred<void>();
  (delivery.startForegroundService as jest.Mock).mockImplementationOnce(() => wait.promise);
  const second = manager.startRemotePlayback(device, {sourceUrl: 'http://source/B.mp4', title: 'B'});
  const canceled = expect(second).rejects.toThrow('canceled');
  await tick();
  const latest = manager.startRemotePlayback(device, {sourceUrl: 'http://source/C.mp4', title: 'C'});
  wait.resolve();
  await canceled;
  await latest;
  const ids = (delivery.prepareStream as jest.Mock).mock.calls.map(([options]) => options.sessionId);
  expect(delivery.cleanupSession).toHaveBeenCalledWith(ids[0]);
  expect(delivery.cleanupSession).toHaveBeenCalledWith(ids[1]);
  expect(delivery.cleanupSession).not.toHaveBeenCalledWith(ids[2]);
});

it.each(['audio', 'subtitle'])('cancels a slow %s reload without rollback after Stop', async kind => {
  await manager.startRemotePlayback(device, {sourceUrl: 'http://source/A.mkv', sourceType: 'mkv', title: 'A'});
  const wait = deferred<any>();
  (delivery.prepareStream as jest.Mock).mockImplementationOnce(() => wait.promise);
  const changing = kind === 'audio'
    ? manager.switchAudioTrack({id: '1', index: 1, codec: 'aac'})
    : manager.setActiveSubtitleTrack('sub');
  const canceled = expect(changing).rejects.toThrow('canceled');
  await tick();
  const stopped = manager.stop();
  wait.resolve({streamUrl: 'http://phone/new', durationSeconds: 900});
  await canceled;
  await stopped;
  expect(dlna.loadMedia).toHaveBeenCalledTimes(1);
  expect(useRemoteStore.getState().status).toBe('idle');
});
it('loads the latest source rather than dropping a request during inspection', async () => {
  const wait = deferred<typeof inspected>();
  (delivery.inspectTracks as jest.Mock).mockImplementationOnce(
    () => wait.promise,
  );
  const old = manager.startRemotePlayback(device, {
    sourceUrl: 'http://source/A.mp4',
    title: 'A',
  });
  const canceled = expect(old).rejects.toThrow('canceled');
  await tick();
  const next = manager.startRemotePlayback(device, {
    sourceUrl: 'http://source/B.mp4',
    title: 'B',
  });
  wait.resolve(inspected);
  await canceled;
  await next;
  expect(dlna.loadMedia).toHaveBeenCalledTimes(1);
  expect((dlna.loadMedia as jest.Mock).mock.calls[0][2]).toBe('B');
});
it('does not load or restart the service after Stop during preparation', async () => {
  const wait = deferred<any>();
  (delivery.prepareStream as jest.Mock).mockImplementationOnce(
    () => wait.promise,
  );
  const old = manager.startRemotePlayback(device, {
    sourceUrl: 'http://source/A.mp4',
    title: 'A',
  });
  const canceled = expect(old).rejects.toThrow('canceled');
  await tick();
  const stopped = manager.stop();
  wait.resolve({streamUrl: 'http://phone/old', durationSeconds: 900});
  await canceled;
  await stopped;
  expect(dlna.loadMedia).not.toHaveBeenCalled();
  expect(delivery.startForegroundService).not.toHaveBeenCalled();
  expect(delivery.cleanupSession).toHaveBeenCalled();
  expect(useRemoteStore.getState().status).toBe('idle');
});
it('seeks progressive DLNA to the saved movie position after loading', async () => {
  await manager.startRemotePlayback(device, {
    sourceUrl: 'http://source/A.mp4',
    title: 'A',
    initialPosition: 120,
  });
  expect(dlna.seek).toHaveBeenCalledWith(device, 120);
  expect(
    (dlna.loadMedia as jest.Mock).mock.invocationCallOrder[0],
  ).toBeLessThan((dlna.seek as jest.Mock).mock.invocationCallOrder[0]);
});
