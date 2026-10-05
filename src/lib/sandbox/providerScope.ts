import {mainStorage, providerKvStorage} from '../storage/StorageService';
import {extensionStorage} from '../storage/extensionStorage';

/**
 * Provider data (kvStore, state, cookies) is kept per source author, so a
 * provider from one source can never read what a provider from another source
 * saved, even when both use the same provider value.
 */

/** Author used for providers without a source, such as dev server modules. */
export const LOCAL_AUTHOR = 'local';

export const providerAuthor = (author?: string | null): string =>
  author?.trim() || LOCAL_AUTHOR;

/**
 * Storage id of one provider of one author. Both parts are URI encoded, so the
 * id never contains ':' and one provider's key prefix cannot match another's.
 */
export const providerScopeId = (
  author: string | undefined | null,
  providerValue: string,
): string =>
  `${encodeURIComponent(providerAuthor(author))}/${encodeURIComponent(providerValue)}`;

export const getScopedKvKey = (
  author: string | undefined | null,
  providerValue: string,
  key: string,
): string => `${providerScopeId(author, providerValue)}:${key}`;

export const getProviderKvPrefix = (
  author: string | undefined | null,
  providerValue: string,
): string => `${providerScopeId(author, providerValue)}:`;

const KV_MIGRATED_KEY = 'provider-kv-scoped-by-author';

/**
 * Moves kvStore keys saved before scoping ("value:key") to "author/value:key".
 * A value installed from several sources already shared one store, so each of
 * those authors gets a copy. Keys of providers that are no longer installed
 * are dropped. Also removes the old shared WAF cookies. Runs once.
 */
let migration: Promise<void> | null = null;

export const migrateLegacyProviderKv = (): Promise<void> => {
  if (mainStorage.getBool(KV_MIGRATED_KEY)) {
    return Promise.resolve();
  }
  migration = migration ?? runMigration();
  return migration;
};

const runMigration = async (): Promise<void> => {
  const authorsByValue = new Map<string, Set<string>>();
  for (const provider of extensionStorage.getInstalledProviders()) {
    const authors = authorsByValue.get(provider.value) ?? new Set<string>();
    authors.add(providerAuthor(provider.source?.author));
    authorsByValue.set(provider.value, authors);
  }
  // Longest value first, so "a:b:key" goes to provider "a:b", not "a".
  const values = Array.from(authorsByValue.keys()).sort(
    (a, b) => b.length - a.length,
  );

  for (const oldKey of await providerKvStorage.getKeys()) {
    const colon = oldKey.indexOf(':');
    // Scoped keys have "/" before the first ":"; leave them alone.
    if (colon <= 0 || oldKey.slice(0, colon).includes('/')) {
      continue;
    }
    const value = values.find(v => oldKey.startsWith(`${v}:`));
    const raw = providerKvStorage.getString(oldKey);
    if (value && raw !== undefined && raw !== null) {
      const key = oldKey.slice(value.length + 1);
      for (const author of authorsByValue.get(value) ?? []) {
        providerKvStorage.setString(getScopedKvKey(author, value, key), raw);
      }
    }
    providerKvStorage.delete(oldKey);
  }
  // WAF cookies used to be saved for all providers together; they now live in
  // per-author jars, so drop the shared copies.
  for (const key of await mainStorage.getKeys()) {
    if (key.startsWith('vega_waf_cookie_')) {
      mainStorage.delete(key);
    }
  }
  mainStorage.setBool(KV_MIGRATED_KEY, true);
};
