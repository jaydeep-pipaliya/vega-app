export class RemotePlaybackCanceledError extends Error {
  readonly code = 'REMOTE_PLAYBACK_CANCELED';

  constructor(message = 'Remote playback operation was canceled') {
    super(message);
    this.name = 'RemotePlaybackCanceledError';
  }
}

export function isRemotePlaybackCanceled(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  return (error as {code?: string}).code === 'REMOTE_PLAYBACK_CANCELED';
}
