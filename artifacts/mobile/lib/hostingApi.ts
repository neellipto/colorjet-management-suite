import AsyncStorage from '@react-native-async-storage/async-storage';
import { productionConfig } from '@/lib/runtimeConfig';
import { getSupabase } from '@/lib/supabaseClient';

const HOSTING_TOKEN_KEY = '@colorjet/hosting-api-token';
const DEFAULT_TIMEOUT_MS = 20000;

export type HostingApiResponse<T> = {
  data: T;
  status: number;
};

export async function setHostingApiToken(token: string | null): Promise<void> {
  if (token?.trim()) await AsyncStorage.setItem(HOSTING_TOKEN_KEY, token.trim());
  else await AsyncStorage.removeItem(HOSTING_TOKEN_KEY);
}

async function resolveAccessToken(): Promise<string | null> {
  const stored = await AsyncStorage.getItem(HOSTING_TOKEN_KEY);
  if (stored) return stored;

  try {
    const { data } = await getSupabase().auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

function normalizePath(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const cleanBase = productionConfig.erpApiBaseUrl.replace(/\/$/, '');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${cleanBase}${cleanPath}`;
}

function extractPayload<T>(body: unknown): T {
  if (body && typeof body === 'object') {
    const record = body as Record<string, unknown>;
    if (record.ok === false) {
      throw new Error(String(record.message ?? record.error ?? 'Hosting API request failed.'));
    }
    if ('data' in record) return record.data as T;
  }
  return body as T;
}

export async function hostingApiRequest<T>(
  path: string,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<HostingApiResponse<T>> {
  if (!productionConfig.erpApiBaseUrl) throw new Error('ERP hosting API is not configured.');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const token = await resolveAccessToken();
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  headers.set('X-Colorjet-App', 'management-suite-android');
  headers.set('X-Colorjet-App-Version', '3.0.1');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  try {
    const response = await fetch(normalizePath(path), {
      ...init,
      headers,
      signal: controller.signal,
    });
    const text = await response.text();
    let body: unknown = null;
    if (text) {
      try { body = JSON.parse(text); }
      catch { body = { message: text }; }
    }

    if (!response.ok) {
      const message = body && typeof body === 'object'
        ? String((body as Record<string, unknown>).message ?? (body as Record<string, unknown>).error ?? `HTTP ${response.status}`)
        : `HTTP ${response.status}`;
      throw new Error(message);
    }

    return { data: extractPayload<T>(body), status: response.status };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('ERP hosting server request timed out.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function checkHostingApiHealth(): Promise<boolean> {
  try {
    await hostingApiRequest<unknown>('/health', { method: 'GET' }, 10000);
    return true;
  } catch {
    return false;
  }
}
