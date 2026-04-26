import { getApiToken } from './authToken';

const rawBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim() ?? '';

export function hasApiBaseUrl(): boolean {
  return rawBaseUrl.length > 0;
}

function apiBaseUrl(): string {
  if (!hasApiBaseUrl()) {
    throw new Error('Set EXPO_PUBLIC_API_BASE_URL to your Cloudflare Worker URL.');
  }
  return rawBaseUrl.replace(/\/+$/, '');
}

export function apiWebSocketUrl(path: string): string {
  const base = apiBaseUrl();
  const url = new URL(`${base}${path}`);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.toString();
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = await getApiToken();
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');

  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${apiBaseUrl()}${path}`, {
    ...init,
    headers,
  });

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      if (response.ok) {
        throw new Error('Cloudflare API returned an invalid JSON response.');
      }
    }
  }

  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'error' in payload
        ? String(payload.error)
        : `Cloudflare API request failed with ${response.status}.`;
    throw new Error(message);
  }

  return payload as T;
}

export function encodeQuery(params: Record<string, string | number | undefined>): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      searchParams.set(key, String(value));
    }
  }
  const query = searchParams.toString();
  return query ? `?${query}` : '';
}
