import AsyncStorage from '@react-native-async-storage/async-storage';
import { isProductionConfigured, productionConfig } from '@/lib/runtimeConfig';

const SESSION_KEY = 'colorjet_supabase_session_v1';

export type AuthSession = {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
  user: { id: string; email?: string };
};

function configured() {
  if (!isProductionConfigured()) throw new Error('Production connection is not configured.');
}

async function parseError(response: Response) {
  try {
    const data = await response.json();
    return data.error_description || data.message || `Request failed (${response.status})`;
  } catch {
    return `Request failed (${response.status})`;
  }
}

export async function saveSession(session: AuthSession | null) {
  if (session) await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
  else await AsyncStorage.removeItem(SESSION_KEY);
}

export async function getSession(): Promise<AuthSession | null> {
  configured();
  const raw = await AsyncStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    await saveSession(null);
    return null;
  }
}

export async function signIn(email: string, password: string): Promise<AuthSession> {
  configured();
  const response = await fetch(`${productionConfig.supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: productionConfig.supabasePublishableKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) throw new Error(await parseError(response));
  const session = await response.json() as AuthSession;
  await saveSession(session);
  return session;
}

export async function signOut() {
  await saveSession(null);
}

export async function requestPasswordReset(email: string, redirectTo?: string) {
  configured();
  const response = await fetch(`${productionConfig.supabaseUrl}/auth/v1/recover`, {
    method: 'POST',
    headers: {
      apikey: productionConfig.supabasePublishableKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, redirect_to: redirectTo || undefined }),
  });
  if (!response.ok) throw new Error(await parseError(response));
}
