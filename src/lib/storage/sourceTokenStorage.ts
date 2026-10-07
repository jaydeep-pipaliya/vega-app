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
 * True when a token of this source may go to the URL: any
 * raw.githubusercontent.com file, or for a custom source (author key
 * "host/folder") only files under its own https folder. A token never reaches
 * another host or another site's folder.
 */
export const isSourceAuthUrl = (author: string, url: string): boolean =>
  url.startsWith(RAW_GITHUB_ORIGIN) || url.startsWith(`https://${author}/`);

/** Auth header for a provider source file. */
export const getSourceAuthHeaders = (
  author: string | undefined,
  url: string,
): Record<string, string> => {
  if (!author || !isSourceAuthUrl(author, url)) {
    return {};
  }
  const token = sourceTokenStorage.get(author);
  return token ? {Authorization: `token ${token}`} : {};
};
