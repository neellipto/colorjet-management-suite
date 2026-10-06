import * as SecureStore from 'expo-secure-store';

const API_BASE_KEY = 'colorjet_api_base_v3';
const ENV_BASE = (process.env.EXPO_PUBLIC_ERP_API_BASE_URL ?? '').trim();

export function normalizeApiBaseUrl(value: string): string {
  let url = value.trim().replace(/\/+$/, '');
  if (!url) return '';
  if (!/^https:\/\//i.test(url)) throw new Error('Use a valid HTTPS URL.');
  if (!/\/api\/v1$/i.test(url)) url += '/api/v1';
  return url;
}
export async function getApiBaseUrl(): Promise<string> { const stored = await SecureStore.getItemAsync(API_BASE_KEY); const candidate = stored || ENV_BASE; return candidate ? normalizeApiBaseUrl(candidate) : ''; }
export async function requireApiBaseUrl(): Promise<string> { const base = await getApiBaseUrl(); if (!base) throw new Error('ERP server is not configured. Open Server Setup first.'); return base; }
export async function saveApiBaseUrl(value: string): Promise<string> { const normalized = normalizeApiBaseUrl(value); await SecureStore.setItemAsync(API_BASE_KEY, normalized, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }); return normalized; }
export async function clearApiBaseUrl(): Promise<void> { await SecureStore.deleteItemAsync(API_BASE_KEY); }
export async function testApiBaseUrl(value: string): Promise<{base:string; version?:string}> { const base = normalizeApiBaseUrl(value); const response = await fetch(`${base}/health`, { headers: { Accept: 'application/json' } }); const json = await response.json().catch(() => ({})); if (!response.ok || json?.ok === false) throw new Error(json?.error?.message || `Health check failed (${response.status}).`); return { base, version: String(json?.data?.version ?? json?.version ?? '') || undefined }; }
