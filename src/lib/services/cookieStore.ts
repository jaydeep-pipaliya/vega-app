import {mainStorage} from '../storage/StorageService';

interface StoredCookie {
  cookieString: string;
  expiresAt: number | null; // Unix timestamp in milliseconds
}

export function updateGlobalCookies(
  urlOrDomain: string,
  cookieString: string,
  expires?: number | null,
) {
  try {
    const domain = urlOrDomain.includes('://')
      ? new URL(urlOrDomain).origin
      : urlOrDomain;
    const data: StoredCookie = {
      cookieString,
      expiresAt: expires
        ? (expires > 1e11 ? expires : expires * 1000)
        : null,
    };
    mainStorage.setString(`vega_waf_cookie_${domain}`, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save cookie to storage', e);
  }
}

export function getGlobalCookies(url: string): string | undefined {
  try {
    const domain = url.includes('://') ? new URL(url).origin : url;
    const raw = mainStorage.getString(`vega_waf_cookie_${domain}`);
    if (!raw) return undefined;

    const data: StoredCookie = JSON.parse(raw);

    // Check expiry
    if (data.expiresAt && Date.now() > data.expiresAt) {
      mainStorage.delete(`vega_waf_cookie_${domain}`);
      return undefined;
    }

    return data.cookieString;
  } catch {
    return undefined;
  }
}

export function clearGlobalCookies(url: string) {
  try {
    const domain = url.includes('://') ? new URL(url).origin : url;
    mainStorage.delete(`vega_waf_cookie_${domain}`);
  } catch (e) {
    console.error('Failed to clear cookie from storage', e);
  }
}
