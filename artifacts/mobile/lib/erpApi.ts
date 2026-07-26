import AsyncStorage from '@react-native-async-storage/async-storage';

const ACCESS_TOKEN_KEY = '@colorjet/erp-access-token';
const REFRESH_TOKEN_KEY = '@colorjet/erp-refresh-token';
const DEFAULT_TIMEOUT_MS = 20_000;

export const ERP_API_BASE_URL = (
  process.env.EXPO_PUBLIC_ERP_API_BASE_URL ?? 'https://erp.colorjet.website/api/v1'
).replace(/\/$/, '');

export type ErpApiEnvelope<T> = {
  ok?: boolean;
  data?: T;
  message?: string;
  error?: string;
  errors?: Record<string, string[]>;
  meta?: Record<string, unknown>;
};

export type ErpSession = {
  accessToken: string;
  refreshToken?: string | null;
};

export type ErpRequestOptions = RequestInit & {
  timeoutMs?: number;
  idempotencyKey?: string;
  skipAuthentication?: boolean;
  retryAfterRefresh?: boolean;
};

export class ErpApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly validationErrors?: Record<string, string[]>;

  constructor(
    message: string,
    status = 0,
    code?: string,
    validationErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'ErpApiError';
    this.status = status;
    this.code = code;
    this.validationErrors = validationErrors;
  }
}

export async function saveErpSession(session: ErpSession): Promise<void> {
  await AsyncStorage.setItem(ACCESS_TOKEN_KEY, session.accessToken);
  if (session.refreshToken) {
    await AsyncStorage.setItem(REFRESH_TOKEN_KEY, session.refreshToken);
  } else {
    await AsyncStorage.removeItem(REFRESH_TOKEN_KEY);
  }
}

export async function clearErpSession(): Promise<void> {
  await AsyncStorage.multiRemove([ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY]);
}

export async function readErpSession(): Promise<ErpSession | null> {
  const [accessToken, refreshToken] = await AsyncStorage.multiGet([
    ACCESS_TOKEN_KEY,
    REFRESH_TOKEN_KEY,
  ]);
  const access = accessToken[1];
  if (!access) return null;
  return { accessToken: access, refreshToken: refreshToken[1] };
}

function requestId(): string {
  return `cj-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function resolveUrl(path: string): string {
  if (/^https:\/\//i.test(path)) return path;
  return `${ERP_API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

async function parseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

async function refreshAccessToken(): Promise<boolean> {
  const current = await readErpSession();
  if (!current?.refreshToken) return false;

  const response = await fetch(resolveUrl('/auth/refresh'), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Colorjet-App': 'management-suite-android',
      'X-Request-ID': requestId(),
    },
    body: JSON.stringify({ refresh_token: current.refreshToken }),
  });

  const body = (await parseBody(response)) as ErpApiEnvelope<ErpSession> | null;
  if (!response.ok || !body?.data?.accessToken) {
    await clearErpSession();
    return false;
  }

  await saveErpSession(body.data);
  return true;
}

export async function erpRequest<T>(
  path: string,
  options: ErpRequestOptions = {},
): Promise<T> {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    idempotencyKey,
    skipAuthentication = false,
    retryAfterRefresh = true,
    ...init
  } = options;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  headers.set('X-Colorjet-App', 'management-suite-android');
  headers.set('X-Request-ID', requestId());

  if (idempotencyKey) headers.set('Idempotency-Key', idempotencyKey);
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (!skipAuthentication) {
    const session = await readErpSession();
    if (session?.accessToken) headers.set('Authorization', `Bearer ${session.accessToken}`);
  }

  try {
    const response = await fetch(resolveUrl(path), {
      ...init,
      headers,
      signal: controller.signal,
    });

    if (response.status === 401 && !skipAuthentication && retryAfterRefresh) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return erpRequest<T>(path, { ...options, retryAfterRefresh: false });
      }
    }

    const body = (await parseBody(response)) as ErpApiEnvelope<T> | T | null;
    const envelope = body && typeof body === 'object' ? (body as ErpApiEnvelope<T>) : null;

    if (!response.ok || envelope?.ok === false) {
      throw new ErpApiError(
        envelope?.message ?? envelope?.error ?? `ERP request failed with HTTP ${response.status}`,
        response.status,
        envelope?.error,
        envelope?.errors,
      );
    }

    if (envelope && 'data' in envelope) return envelope.data as T;
    return body as T;
  } catch (error) {
    if (error instanceof ErpApiError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ErpApiError('ERP request timed out. Please try again.', 0, 'TIMEOUT');
    }
    throw new ErpApiError(
      error instanceof Error ? error.message : 'Unable to connect to the ERP server.',
      0,
      'NETWORK_ERROR',
    );
  } finally {
    clearTimeout(timeout);
  }
}

export const erpApi = {
  get<T>(path: string, options: ErpRequestOptions = {}) {
    return erpRequest<T>(path, { ...options, method: 'GET' });
  },
  post<T>(path: string, body?: unknown, options: ErpRequestOptions = {}) {
    return erpRequest<T>(path, {
      ...options,
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body ?? {}),
    });
  },
  put<T>(path: string, body?: unknown, options: ErpRequestOptions = {}) {
    return erpRequest<T>(path, {
      ...options,
      method: 'PUT',
      body: body instanceof FormData ? body : JSON.stringify(body ?? {}),
    });
  },
  patch<T>(path: string, body?: unknown, options: ErpRequestOptions = {}) {
    return erpRequest<T>(path, {
      ...options,
      method: 'PATCH',
      body: body instanceof FormData ? body : JSON.stringify(body ?? {}),
    });
  },
  delete<T>(path: string, options: ErpRequestOptions = {}) {
    return erpRequest<T>(path, { ...options, method: 'DELETE' });
  },
};
