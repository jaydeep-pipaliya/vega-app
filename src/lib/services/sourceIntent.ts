import {DeviceEventEmitter, NativeModules, Platform} from 'react-native';

// Native side: native-src/android/com/vega/SourceIntentModule.kt. The intent
// action is vega.intent.action.ADD_SOURCE with the source in the "url" extra
// and an optional GitHub token for a private repo in the "token" extra.
const {VegaSourceIntent} = NativeModules;

export interface SourceIntentPayload {
  url: string;
  token?: string;
}

const toPayload = (value: unknown): SourceIntentPayload | null => {
  const payload = value as SourceIntentPayload | null;
  if (!payload || typeof payload.url !== 'string' || !payload.url) {
    return null;
  }
  return {
    url: payload.url,
    token: typeof payload.token === 'string' ? payload.token : undefined,
  };
};

export const getInitialSourceIntent =
  async (): Promise<SourceIntentPayload | null> => {
    if (Platform.OS !== 'android' || !VegaSourceIntent) {
      return null;
    }
    try {
      return toPayload(await VegaSourceIntent.getInitialSource());
    } catch {
      return null;
    }
  };

export const subscribeSourceIntent = (
  listener: (payload: SourceIntentPayload) => void,
): (() => void) => {
  if (Platform.OS !== 'android' || !VegaSourceIntent) {
    return () => {};
  }
  const subscription = DeviceEventEmitter.addListener(
    'onVegaAddSource',
    (value: unknown) => {
      const payload = toPayload(value);
      if (payload) {
        listener(payload);
      }
    },
  );
  return () => subscription.remove();
};

// The token goes from the intent to the add source dialog through this
// in-memory slot, not through navigation params, so it never appears in
// navigation state.
let pendingToken: {requestId: number; token: string} | undefined;

export const setPendingSourceToken = (
  requestId: number,
  token: string | undefined,
): void => {
  pendingToken = token ? {requestId, token} : undefined;
};

export const getPendingSourceToken = (
  requestId: number | undefined,
): string | undefined =>
  pendingToken && pendingToken.requestId === requestId
    ? pendingToken.token
    : undefined;

export const clearPendingSourceToken = (): void => {
  pendingToken = undefined;
};
