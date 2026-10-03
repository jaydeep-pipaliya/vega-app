import {MMKVLoader} from 'react-native-mmkv-storage';

// GitHub tokens for private provider sources, keyed by source author. Kept in
// a separate encrypted instance (key held in Android Keystore) so tokens never
// land in the main storage or in backups.
const RAW_GITHUB_ORIGIN = 'https://raw.githubusercontent.com/';
const MAX_TOKEN_LENGTH = 255;

let storage: ReturnType<MMKVLoader['initialize']> | undefined;

const getStorage = () => {
  if (!storage) {
    storage = new MMKVLoader()
      .withInstanceID('provider-source-tokens')
      .withEncryption()
      .initialize();
  }
  return storage;
};

export const normalizeSourceToken = (token: string): string | undefined => {
  const trimmed = token.trim();
  if (!trimmed || trimmed.length > MAX_TOKEN_LENGTH || /\s/.test(trimmed)) {
    return undefined;
  }
  return trimmed;
};

export const sourceTokenStorage = {
  get(author: string): string | undefined {
    return getStorage().getString(author) || undefined;
  },

  set(author: string, token: string): void {
    getStorage().setString(author, token);
  },

  delete(author: string): void {
    getStorage().removeItem(author);
  },

  has(author: string): boolean {
    return Boolean(this.get(author));
  },
};

/**
 * Auth header for a provider source file. Sent only to raw.githubusercontent.com,
 * so a token never reaches another host.
 */
export const getSourceAuthHeaders = (
  author: string | undefined,
  url: string,
): Record<string, string> => {
  if (!author || !url.startsWith(RAW_GITHUB_ORIGIN)) {
    return {};
  }
  const token = sourceTokenStorage.get(author);
  return token ? {Authorization: `token ${token}`} : {};
};
