import { env } from '../config/env';
import type { ApiResponse, DashboardKpi } from '../types';

async function request<T>(path: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  try {
    const res = await fetch(`${env.apiBaseUrl}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      },
      ...options
    });

    const json = await res.json();
    if (!res.ok) {
      return { ok: false, error: json?.error || `HTTP ${res.status}` };
    }
    return json;
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Network error' };
  }
}

export const api = {
  health: () => request<{ service: string; time: string }>('/health'),
  dashboard: () => request<{ kpis: DashboardKpi[] }>('/dashboard'),
  tasks: () => request<any[]>('/tasks'),
  serviceTickets: () => request<any[]>('/service-tickets'),
  stock: () => request<any[]>('/stock'),
  customers: () => request<any[]>('/customers')
};
