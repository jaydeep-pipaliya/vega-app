import {NativeModules, Platform} from 'react-native';
import axios, {type AxiosRequestConfig} from 'axios';
import {headers as commonHeaders} from '../providers/headers';
import {
  buildRequestCookieHeader,
  storeSetCookies,
  updateRedirectCookieHeader,
} from './providerCookieJar';
import {bytesToBase64, base64ToBytes} from './base64';
import {providerRateLimiter} from './rateLimiter';
import {
  MAX_RESPONSE_BYTES,
  type SerializedRequest,
  type SerializedResponse,
} from './protocol';
import {isPrivateHostname, validateProviderUrl} from './urlGuard';

const REQUEST_TIMEOUT_MS = 30_000;
const MAX_REDIRECTS = 10;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

/** `Set-Cookie` is response-only. `Cookie` remains allowed for provider WAF flows. */
const BLOCKED_REQUEST_HEADERS = new Set(['set-cookie', 'set-cookie2']);

const toAxiosBody = (body: SerializedRequest['body']): unknown => {
  if (body.kind === 'none') {
    return undefined;
  }
  if (body.kind === 'text') {
    return body.value;
  }
  return base64ToBytes(body.value);
};

const normalizeHeaders = (
  entries: Array<[string, string]>,
): Record<string, string> => {
  const merged: Record<string, string> = {...commonHeaders};
  for (const [rawKey, value] of entries) {
    const key = String(rawKey).trim();
    if (!key || BLOCKED_REQUEST_HEADERS.has(key.toLowerCase())) {
      continue;
    }
    // Reject header injection attempts outright.
    if (/[\r\n]/.test(key) || /[\r\n]/.test(String(value))) {
      throw new Error('Invalid header value');
    }
    merged[key] = String(value);
  }
  return merged;
};

const hasHeader = (headers: Record<string, string>, name: string): boolean =>
  Object.keys(headers).some(key => key.toLowerCase() === name.toLowerCase());

const deleteHeader = (headers: Record<string, string>, name: string): void => {
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === name.toLowerCase()) {
      delete headers[key];
    }
  }
};

const toBytes = (data: unknown): Uint8Array => {
  if (data == null) {
    return new Uint8Array(0);
  }
  if (data instanceof ArrayBuffer) {
    return new Uint8Array(data);
  }
  if (data instanceof Uint8Array) {
    return data;
  }
  if (typeof data === 'string') {
    const bytes = new Uint8Array(data.length);
    for (let i = 0; i < data.length; i++) {
      // Axios returns binary strings on some RN versions.
      // eslint-disable-next-line no-bitwise
      bytes[i] = data.charCodeAt(i) & 0xff;
    }
    return bytes;
  }
  const text = JSON.stringify(data) ?? '';
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) {
    // eslint-disable-next-line no-bitwise
    bytes[i] = text.charCodeAt(i) & 0xff;
  }
  return bytes;
};

const flattenResponseHeaders = (raw: unknown): Array<[string, string]> => {
  const entries: Array<[string, string]> = [];
  if (!raw || typeof raw !== 'object') {
    return entries;
  }
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (Array.isArray(value)) {
      entries.push([key, value.join(', ')]);
    } else if (value != null) {
      entries.push([key, String(value)]);
    }
  }
  return entries;
};

/**
 * Sends a provider request. Cookies come from, and go to, the jar of the
 * provider's source author only; the shared native cookie store is not used.
 */
export const providerFetch = async (
  author: string,
  rawUrl: unknown,
  request: SerializedRequest,
): Promise<SerializedResponse> => {
  const url = validateProviderUrl(rawUrl);
  // Timings for finding where a slow source spends its time.
  const queuedAt = Date.now();
  const release = await providerRateLimiter.acquire(url.hostname);
  const startedAt = Date.now();

  try {
    const headers = normalizeHeaders(request.headers ?? []);
    const body = request.body ?? {kind: 'none'};
    if (
      body.kind === 'base64' &&
      body.contentType &&
      !hasHeader(headers, 'content-type')
    ) {
      headers['Content-Type'] = body.contentType;
    }
    const cookieKey = Object.keys(headers).find(
      key => key.toLowerCase() === 'cookie',
    );
    const cookieHeader = buildRequestCookieHeader(
      author,
      url.toString(),
      cookieKey ? headers[cookieKey] : undefined,
    );
    if (cookieKey) {
      delete headers[cookieKey];
    }
    if (cookieHeader) {
      headers.Cookie = cookieHeader;
    }

    if (Platform.OS === 'android' && NativeModules.ProviderHttpModule?.fetch) {
      // Native never follows redirects. Each hop is validated here first, so a
      // public URL cannot bounce the request into the local network.
      const followRedirects = request.redirect !== 'manual';
      let hopUrl = url;
      let method = (request.method || 'GET').toUpperCase();
      let hopBody = body;
      for (let redirects = 0; ; redirects++) {
        const headerPairs: Array<[string, string]> = Object.entries(headers);
        const options: Record<string, any> = {
          method,
          headers: headerPairs,
          redirect: 'manual',
          timeoutMs: REQUEST_TIMEOUT_MS,
        };
        if (hopBody.kind === 'base64') {
          options.bodyBase64 = hopBody.value;
          if (hopBody.contentType) options.contentType = hopBody.contentType;
        } else if (hopBody.kind === 'text') {
          options.bodyText = hopBody.value;
        }

        const res = await NativeModules.ProviderHttpModule.fetch(
          hopUrl.toString(),
          options,
        );
        console.log(
          `[ProviderPerf] fetch ${hopUrl.hostname} ${res.status} wait=${
            startedAt - queuedAt
          }ms net=${Date.now() - startedAt}ms body=${Math.round(
            ((res.bodyBase64?.length || 0) * 3) / 4 / 1024,
          )}KB`,
        );
        const finalUrl: string = res.url || hopUrl.toString();
        // Set-Cookie of every response, redirects included, with its URL.
        for (const pair of (res.cookies || []) as Array<[string, string]>) {
          if (pair && pair.length >= 2) {
            storeSetCookies(author, pair[0], [pair[1]]);
          }
        }

        const location = ((res.headers || []) as Array<[string, string]>).find(
          pair =>
            pair && pair.length >= 2 && pair[0].toLowerCase() === 'location',
        )?.[1];
        if (
          !followRedirects ||
          !REDIRECT_STATUSES.has(res.status) ||
          !location
        ) {
          return {
            status: res.status,
            statusText: res.statusText || '',
            url: finalUrl,
            headers: (() => {
              const out: Array<[string, string]> = [];
              for (const pair of res.headers || []) {
                if (pair && pair.length >= 2) {
                  out.push(pair);
                  if (pair[0].toLowerCase() === 'set-cookie') {
                    out.push(['x-set-cookie', pair[1]]);
                  }
                }
              }
              return out;
            })(),
            bodyBase64: res.bodyBase64 || '',
          };
        }

        if (redirects >= MAX_REDIRECTS) {
          throw new Error('Too many provider redirects');
        }
        let nextUrl: URL;
        try {
          nextUrl = validateProviderUrl(new URL(location, hopUrl).toString());
        } catch {
          throw new Error('Provider request redirected to a blocked host');
        }

        if (
          res.status === 303 ||
          ((res.status === 301 || res.status === 302) &&
            method !== 'GET' &&
            method !== 'HEAD')
        ) {
          if (method !== 'HEAD') {
            method = 'GET';
          }
          hopBody = {kind: 'none'};
          deleteHeader(headers, 'content-type');
          deleteHeader(headers, 'content-length');
        }
        if (nextUrl.host !== hopUrl.host) {
          deleteHeader(headers, 'authorization');
        }
        const hopCookie = nextUrl.hostname === hopUrl.hostname
          ? updateRedirectCookieHeader(
              hopUrl.toString(),
              headers.Cookie,
              ((res.cookies || []) as Array<[string, string]>)
                .filter(pair => pair && pair.length >= 2)
                .map(pair => pair[1]),
            )
          : buildRequestCookieHeader(author, nextUrl.toString());
        deleteHeader(headers, 'cookie');
        if (hopCookie) {
          headers.Cookie = hopCookie;
        }
        hopUrl = nextUrl;
      }
    }

    const abortController = new AbortController();
    const isManualRedirect = request.redirect === 'manual';
    let abortedEarly = false;
    let interceptedResponseUrl = '';

    const config: AxiosRequestConfig = {
      url: url.toString(),
      method: (
        request.method || 'GET'
      ).toUpperCase() as AxiosRequestConfig['method'],
      headers,
      data: toAxiosBody(body),
      responseType: 'arraybuffer',
      timeout: REQUEST_TIMEOUT_MS,
      maxRedirects: isManualRedirect ? 0 : 5,
      signal: abortController.signal,
      // Keep the shared native cookie store out of provider requests.
      withCredentials: false,
      // Providers inspect non-2xx responses (WAF detection), so never throw.
      validateStatus: () => true,
      transformResponse: [],
      onDownloadProgress: (progressEvent: any) => {
        const xhr = progressEvent.target || progressEvent.currentTarget;
        if (xhr?.responseURL) {
          interceptedResponseUrl = xhr.responseURL;
        }
        if (
          (isManualRedirect && progressEvent.loaded > 0) ||
          progressEvent.loaded > MAX_RESPONSE_BYTES ||
          (progressEvent.total && progressEvent.total > MAX_RESPONSE_BYTES)
        ) {
          abortedEarly = true;
          abortController.abort();
        }
      },
    };

    let response: any;
    try {
      response = await axios.request(config);
    } catch (err: any) {
      if (axios.isCancel(err) || err.name === 'CanceledError' || err.name === 'AbortError' || abortedEarly) {
        abortedEarly = true;
        response = err.response || {
          status: isManualRedirect ? 302 : 200,
          statusText: isManualRedirect ? 'Found' : 'OK',
          headers: {},
          data: new Uint8Array(0),
          request: err.request,
        };
      } else {
        throw err;
      }
    }

    const finalUrl: string =
      (response.request?.responseURL as string | undefined) || url.toString();
    try {
      const resolved = new URL(finalUrl);
      if (isPrivateHostname(resolved.hostname)) {
        throw new Error('Provider request redirected to a blocked host');
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('blocked host')) {
        throw error;
      }
      // Unparseable responseURL: fall through with the validated request URL.
    }

    const bytes = toBytes(response.data);
    if (bytes.byteLength > MAX_RESPONSE_BYTES) {
      throw new Error('Provider response is too large');
    }

    const setCookie = response.headers?.['set-cookie'];
    if (setCookie) {
      storeSetCookies(
        author,
        finalUrl,
        Array.isArray(setCookie) ? setCookie.map(String) : [String(setCookie)],
      );
    }

    const resHeaders = flattenResponseHeaders(response.headers);
    if (isManualRedirect && finalUrl && !resHeaders.some(([k]) => k.toLowerCase() === 'location')) {
      resHeaders.push(['location', finalUrl]);
    }

    return {
      status: response.status,
      statusText: response.statusText ?? '',
      url: finalUrl,
      headers: resHeaders,
      bodyBase64: bytesToBase64(bytes),
    };
  } finally {
    release();
  }
};
