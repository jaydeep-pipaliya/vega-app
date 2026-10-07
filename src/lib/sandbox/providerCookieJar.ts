import {providerCookieStorage} from '../storage/StorageService';
import {providerAuthor} from './providerScope';

/**
 * Cookie jar for provider requests, one per source author. Provider requests
 * never use the shared native cookie store, so cookies set for one author's
 * providers (including WAF clearance cookies) are never sent or shown to
 * another author's providers.
 *
 * Kept simple: cookies match by domain only (path and Secure are ignored).
 */

interface StoredCookie {
  value: string;
  /** Unix time in ms, or null for no expiry. */
  expiresAt: number | null;
  /** Sent only to the exact host, not its subdomains. */
  hostOnly: boolean;
}

/** domain -> cookie name -> cookie */
type AuthorJar = Record<string, Record<string, StoredCookie>>;

export interface JarCookie {
  name: string;
  value: string;
  /** Domain attribute; host-only when missing. */
  domain?: string;
  /** Unix time in ms. */
  expiresAt?: number | null;
}

const MAX_COOKIES_PER_AUTHOR = 500;

const hostOf = (url: string): string | undefined => {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return undefined;
  }
};

// Jars before version 3 saved cookies from providers' own Cookie headers with
// no expiry (a stale NetMirror `addhash`, for example). They cannot be told
// apart from server cookies, so cookies without an expiry are dropped once.
const JAR_VERSION = 3;
const jarVersionKey = (author: string) => `${author}::jarVersion`;

const readJar = (author: string): AuthorJar => {
  const raw = providerCookieStorage.getString(author);
  if (!raw) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return {};
    }
    const jar = parsed as AuthorJar;
    if (providerCookieStorage.getNumber(jarVersionKey(author)) !== JAR_VERSION) {
      for (const domain of Object.keys(jar)) {
        for (const name of Object.keys(jar[domain])) {
          if (jar[domain][name].expiresAt === null) {
            delete jar[domain][name];
          }
        }
      }
      writeJar(author, jar);
    }
    return jar;
  } catch {
    return {};
  }
};

const writeJar = (author: string, jar: AuthorJar): void => {
  const now = Date.now();
  let count = 0;
  for (const domain of Object.keys(jar)) {
    for (const name of Object.keys(jar[domain])) {
      const cookie = jar[domain][name];
      if (cookie.expiresAt !== null && cookie.expiresAt <= now) {
        delete jar[domain][name];
      } else if (++count > MAX_COOKIES_PER_AUTHOR) {
        delete jar[domain][name];
      }
    }
    if (Object.keys(jar[domain]).length === 0) {
      delete jar[domain];
    }
  }
  if (Object.keys(jar).length === 0) {
    providerCookieStorage.delete(author);
  } else {
    providerCookieStorage.setString(author, JSON.stringify(jar));
  }
  providerCookieStorage.setNumber(jarVersionKey(author), JAR_VERSION);
};

const domainMatches = (host: string, domain: string, hostOnly: boolean) =>
  host === domain || (!hostOnly && host.endsWith(`.${domain}`));

/**
 * Lifetime of a cookie with no Expires or Max-Age. A browser drops these when
 * it closes; the app has no such moment, so they get a fixed lifetime instead
 * of living forever.
 */
const SESSION_COOKIE_MAX_AGE_MS = 12 * 60 * 60 * 1000;

const putCookies = (
  authorRaw: string | undefined,
  url: string,
  cookies: JarCookie[],
): void => {
  const host = hostOf(url);
  if (!host || cookies.length === 0) {
    return;
  }
  const author = providerAuthor(authorRaw);
  const jar = readJar(author);
  const now = Date.now();
  for (const cookie of cookies) {
    if (!cookie.name) {
      continue;
    }
    const attrDomain = cookie.domain?.trim().toLowerCase().replace(/^\./, '');
    // A Domain attribute must cover the host that set it.
    if (attrDomain && !domainMatches(host, attrDomain, false)) {
      continue;
    }
    const domain = attrDomain || host;
    const expiresAt = cookie.expiresAt ?? now + SESSION_COOKIE_MAX_AGE_MS;
    // A cookie replaces (or, when expired, removes) any same-named one this
    // host can see.
    for (const d of Object.keys(jar)) {
      if (domainMatches(host, d, false)) {
        delete jar[d][cookie.name];
      }
    }
    if (expiresAt > now) {
      jar[domain] = jar[domain] ?? {};
      jar[domain][cookie.name] = {
        value: cookie.value,
        expiresAt,
        hostOnly: !attrDomain,
      };
    }
  }
  writeJar(author, jar);
};


/** Parses one Set-Cookie header value. */
const parseSetCookie = (header: string): JarCookie | undefined => {
  const [pair, ...attributes] = header.split(';');
  const eq = pair.indexOf('=');
  if (eq <= 0) {
    return undefined;
  }
  const cookie: JarCookie = {
    name: pair.slice(0, eq).trim(),
    value: pair.slice(eq + 1).trim(),
  };
  let maxAge: number | undefined;
  for (const attribute of attributes) {
    const i = attribute.indexOf('=');
    const key = (i < 0 ? attribute : attribute.slice(0, i)).trim().toLowerCase();
    const value = i < 0 ? '' : attribute.slice(i + 1).trim();
    if (key === 'domain' && value) {
      cookie.domain = value;
    } else if (key === 'max-age' && /^-?\d+$/.test(value)) {
      maxAge = Number(value);
    } else if (key === 'expires') {
      const time = Date.parse(value);
      if (!isNaN(time)) {
        cookie.expiresAt = time;
      }
    }
  }
  if (maxAge !== undefined) {
    cookie.expiresAt = Date.now() + maxAge * 1000;
  }
  return cookie;
};

/**
 * Splits Set-Cookie values that were joined with commas, without splitting
 * the comma inside an Expires date.
 */
const splitSetCookie = (value: string): string[] =>
  value.split(/,(?=\s*[^;,\s]+=)/).map(part => part.trim()).filter(Boolean);

/** Name -> value map of this author's cookies for the URL. */
export const getJarCookieMap = (
  author: string | undefined,
  url: string,
): Record<string, string> => {
  const host = hostOf(url);
  const map: Record<string, string> = {};
  if (!host) {
    return map;
  }
  const now = Date.now();
  const jar = readJar(providerAuthor(author));
  for (const domain of Object.keys(jar)) {
    for (const [name, cookie] of Object.entries(jar[domain])) {
      if (
        domainMatches(host, domain, cookie.hostOnly) &&
        (cookie.expiresAt === null || cookie.expiresAt > now)
      ) {
        map[name] = cookie.value;
      }
    }
  }
  return map;
};

const toHeader = (map: Record<string, string>): string =>
  Object.entries(map)
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');

const parseCookieHeader = (header: string): Record<string, string> => {
  const map: Record<string, string> = {};
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq > 0) {
      map[part.slice(0, eq).trim()] = part.slice(eq + 1).trim();
    }
  }
  return map;
};

/** Cookie header of this author's cookies for the URL ('' when none). */
export const getJarCookieHeader = (
  author: string | undefined,
  url: string,
): string => toHeader(getJarCookieMap(author, url));

/**
 * Cookie header for a provider request: the jar's cookies plus the ones the
 * provider set itself, which win on a name clash. As in a browser, only server
 * responses write the jar: the provider's cookies go on this request only.
 * Saving them let a provider's stale or empty value replace the server's
 * cookie for good (NetMirror's `addhash` and `t_hash_t=`).
 */
export const buildRequestCookieHeader = (
  author: string | undefined,
  url: string,
  supplied?: string,
): string => {
  if (supplied) {
    const map = parseCookieHeader(supplied);
    const jar = getJarCookieMap(author, url);
    for (const name of Object.keys(map)) {
      delete jar[name];
    }
    return toHeader({...map, ...jar});
  }
  return getJarCookieHeader(author, url);
};

/** Keep a redirect chain's cookies independent of concurrent mirror requests. */
export const updateRedirectCookieHeader = (
  url: string,
  sentHeader: string | undefined,
  responseCookies: string[],
): string => {
  const host = hostOf(url);
  const cookies = parseCookieHeader(sentHeader ?? '');
  for (const header of responseCookies) {
    for (const part of splitSetCookie(header)) {
      const cookie = parseSetCookie(part);
      if (!cookie || !host) continue;
      const domain = cookie.domain?.toLowerCase().replace(/^\./, '');
      if (domain && !domainMatches(host, domain, false)) continue;
      if (cookie.expiresAt != null && cookie.expiresAt <= Date.now()) {
        delete cookies[cookie.name];
      } else {
        cookies[cookie.name] = cookie.value;
      }
    }
  }
  return toHeader(cookies);
};

/** Saves Set-Cookie header values from a response to this author's jar. */
export const storeSetCookies = (
  author: string | undefined,
  url: string,
  headers: string[],
): void => {
  const cookies: JarCookie[] = [];
  for (const header of headers) {
    for (const part of splitSetCookie(header)) {
      const cookie = parseSetCookie(part);
      if (cookie) {
        cookies.push(cookie);
      }
    }
  }
  putCookies(author, url, cookies);
};

/** Saves cookies read from a WebView to this author's jar. */
export const storeJarCookies = (
  author: string | undefined,
  url: string,
  cookies: JarCookie[],
): void => putCookies(author, url, cookies);

/** Removes a cookie of this author for the URL. */
export const deleteJarCookie = (
  authorRaw: string | undefined,
  url: string,
  name: string,
): void => {
  const host = hostOf(url);
  if (!host) {
    return;
  }
  const author = providerAuthor(authorRaw);
  const jar = readJar(author);
  for (const domain of Object.keys(jar)) {
    if (domainMatches(host, domain, false)) {
      delete jar[domain][name];
    }
  }
  writeJar(author, jar);
};
