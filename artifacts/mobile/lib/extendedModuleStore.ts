import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ExtendedModuleDefinition } from '@/constants/extendedModules';
import { hostingApiRequest } from '@/lib/hostingApi';
import { isHostingApiConfigured } from '@/lib/runtimeConfig';

export interface ExtendedRecord {
  id: string;
  moduleId: string;
  status: string;
  values: Record<string, string>;
  createdAt: string;
  updatedAt: string;
  syncState?: 'synced' | 'pending';
  lastSyncError?: string;
}

const storageKey = (moduleId: string) => `@colorjet/extended-module/${moduleId}`;

const moduleEndpoint: Record<string, string> = {
  warranty: '/warranties',
  'spare-parts-logistics': '/spare-parts',
  suppliers: '/suppliers',
  'lc-tt-shipment': '/lc-records',
  'landed-cost': '/landed-cost',
  agreements: '/agreements',
  'supplier-ledger': '/supplier-ledger',
  'leave-payroll': '/hr/records',
  biometric: '/biometric-connectors',
};

function numeric(value?: string): number {
  const parsed = Number(String(value ?? '').replace(/,/g, '').trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

function fixed(value: number): string {
  if (!Number.isFinite(value)) return '0';
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function stringifyValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try { return JSON.stringify(value); } catch { return String(value); }
}

function remoteItems(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  const record = payload as Record<string, unknown>;
  if (Array.isArray(record.items)) return record.items;
  if (Array.isArray(record.records)) return record.records;
  if (Array.isArray(record.rows)) return record.rows;
  return [];
}

function normalizeRemoteRecord(moduleId: string, raw: unknown, fallback?: ExtendedRecord): ExtendedRecord {
  const now = new Date().toISOString();
  const record = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const explicitValues = record.values && typeof record.values === 'object' && !Array.isArray(record.values)
    ? record.values as Record<string, unknown>
    : null;
  const ignored = new Set(['id', 'uuid', 'record_id', 'module_id', 'moduleId', 'status', 'created_at', 'createdAt', 'updated_at', 'updatedAt', 'values']);
  const valuesSource = explicitValues ?? Object.fromEntries(Object.entries(record).filter(([key]) => !ignored.has(key)));
  const values = Object.fromEntries(Object.entries(valuesSource).map(([key, value]) => [key, stringifyValue(value)]));

  return {
    id: String(record.id ?? record.uuid ?? record.record_id ?? fallback?.id ?? `EXT-${Date.now()}`),
    moduleId,
    status: String(record.status ?? fallback?.status ?? 'Draft'),
    values: Object.keys(values).length ? values : (fallback?.values ?? {}),
    createdAt: String(record.created_at ?? record.createdAt ?? fallback?.createdAt ?? now),
    updatedAt: String(record.updated_at ?? record.updatedAt ?? now),
    syncState: 'synced',
  };
}

export function calculateModuleValues(moduleId: string, rawValues: Record<string, string>): Record<string, string> {
  const values = { ...rawValues };

  if (moduleId === 'landed-cost') {
    const total = numeric(values.purchaseValue)
      + numeric(values.freight)
      + numeric(values.customsDuty)
      + numeric(values.cnf)
      + numeric(values.transport)
      + numeric(values.bankCharge)
      + numeric(values.otherCost);
    const quantity = Math.max(0, numeric(values.quantity));
    values.totalLandedCost = fixed(total);
    values.unitLandedCost = fixed(quantity > 0 ? total / quantity : 0);
  }

  if (moduleId === 'agreements') {
    const cashPrice = numeric(values.cashPrice);
    const downPayment = numeric(values.downPayment);
    const remaining = Math.max(0, cashPrice - downPayment);
    const months = Math.max(0, numeric(values.emiMonths));
    if (!values.remainingAmount?.trim()) values.remainingAmount = fixed(remaining);
    if (!values.monthlyAmount?.trim()) values.monthlyAmount = fixed(months > 0 ? remaining / months : 0);
  }

  if (moduleId === 'suppliers') {
    const total = numeric(values.totalValue);
    const advance = numeric(values.advancePaid);
    if (!values.balanceDue?.trim()) values.balanceDue = fixed(Math.max(0, total - advance));
  }

  if (moduleId === 'leave-payroll') {
    const gross = numeric(values.grossSalary);
    const deduction = numeric(values.deduction);
    if (!values.payable?.trim()) values.payable = fixed(Math.max(0, gross - deduction));
  }

  return values;
}

async function loadLocal(moduleId: string): Promise<ExtendedRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(moduleId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function persist(moduleId: string, records: ExtendedRecord[]): Promise<void> {
  await AsyncStorage.setItem(storageKey(moduleId), JSON.stringify(records));
}

function mergeRecords(local: ExtendedRecord[], remote: ExtendedRecord[]): ExtendedRecord[] {
  const merged = new Map<string, ExtendedRecord>();
  local.forEach(item => merged.set(item.id, item));
  remote.forEach(item => merged.set(item.id, item));
  return [...merged.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function loadExtendedRecords(moduleId: string): Promise<ExtendedRecord[]> {
  const local = await loadLocal(moduleId);
  const endpoint = moduleEndpoint[moduleId];
  if (!endpoint || !isHostingApiConfigured()) return local;

  try {
    const { data } = await hostingApiRequest<unknown>(endpoint, { method: 'GET' });
    const remote = remoteItems(data).map(item => normalizeRemoteRecord(moduleId, item));
    const merged = mergeRecords(local.filter(item => item.syncState === 'pending'), remote);
    await persist(moduleId, merged);
    return merged;
  } catch (error) {
    console.warn(`COLORJET hosting sync failed for ${moduleId}`, error);
    return local;
  }
}

export async function saveExtendedRecord(
  definition: ExtendedModuleDefinition,
  values: Record<string, string>,
  recordId?: string,
): Promise<ExtendedRecord> {
  const now = new Date().toISOString();
  const calculated = calculateModuleValues(definition.id, values);
  const records = await loadLocal(definition.id);
  const existing = recordId ? records.find(item => item.id === recordId) : undefined;
  let record: ExtendedRecord = {
    id: existing?.id ?? `EXT-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    moduleId: definition.id,
    status: existing?.status ?? definition.statuses[0] ?? 'Draft',
    values: calculated,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    syncState: 'pending',
  };

  const localNext = existing
    ? records.map(item => item.id === existing.id ? record : item)
    : [record, ...records];
  await persist(definition.id, localNext);

  const endpoint = moduleEndpoint[definition.id];
  if (!endpoint || !isHostingApiConfigured()) return record;

  try {
    const path = existing ? `${endpoint}/${encodeURIComponent(existing.id)}` : endpoint;
    const { data } = await hostingApiRequest<unknown>(path, {
      method: existing ? 'PUT' : 'POST',
      body: JSON.stringify({
        id: record.id,
        module_id: definition.id,
        status: record.status,
        values: record.values,
        ...record.values,
      }),
    });
    record = normalizeRemoteRecord(definition.id, data, record);
    const synced = localNext.map(item => item.id === (existing?.id ?? record.id) || item.id === record.id ? record : item);
    if (!synced.find(item => item.id === record.id)) synced.unshift(record);
    await persist(definition.id, synced);
  } catch (error) {
    record = {
      ...record,
      syncState: 'pending',
      lastSyncError: error instanceof Error ? error.message : 'Hosting sync failed',
    };
    await persist(definition.id, localNext.map(item => item.id === record.id ? record : item));
    console.warn(`COLORJET hosting save queued for ${definition.id}`, error);
  }

  return record;
}

export async function deleteExtendedRecord(moduleId: string, recordId: string): Promise<void> {
  const records = await loadLocal(moduleId);
  const endpoint = moduleEndpoint[moduleId];
  if (endpoint && isHostingApiConfigured()) {
    await hostingApiRequest<unknown>(`${endpoint}/${encodeURIComponent(recordId)}`, { method: 'DELETE' });
  }
  await persist(moduleId, records.filter(item => item.id !== recordId));
}

export async function advanceExtendedRecordStatus(
  definition: ExtendedModuleDefinition,
  recordId: string,
): Promise<ExtendedRecord | null> {
  const records = await loadLocal(definition.id);
  const current = records.find(record => record.id === recordId);
  if (!current) return null;

  const currentIndex = Math.max(0, definition.statuses.indexOf(current.status));
  const nextStatus = definition.statuses[Math.min(currentIndex + 1, definition.statuses.length - 1)] ?? current.status;
  let updated: ExtendedRecord = {
    ...current,
    status: nextStatus,
    updatedAt: new Date().toISOString(),
    syncState: 'pending',
  };
  await persist(definition.id, records.map(item => item.id === recordId ? updated : item));

  const endpoint = moduleEndpoint[definition.id];
  if (endpoint && isHostingApiConfigured()) {
    try {
      const { data } = await hostingApiRequest<unknown>(`${endpoint}/${encodeURIComponent(recordId)}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      updated = normalizeRemoteRecord(definition.id, data, updated);
      await persist(definition.id, records.map(item => item.id === recordId ? updated : item));
    } catch (error) {
      updated = {
        ...updated,
        lastSyncError: error instanceof Error ? error.message : 'Status sync failed',
      };
      await persist(definition.id, records.map(item => item.id === recordId ? updated : item));
      console.warn(`COLORJET hosting status queued for ${definition.id}`, error);
    }
  }

  return updated;
}

function csvCell(value: unknown): string {
  return `"${String(value ?? '').replace(/"/g, '""').replace(/[\r\n]+/g, ' ')}"`;
}

export function extendedRecordsToCsv(
  definition: ExtendedModuleDefinition,
  records: ExtendedRecord[],
): string {
  const headers = ['Record ID', 'Status', 'Sync', ...definition.fields.map(field => field.label), 'Created At', 'Updated At'];
  const rows = records.map(record => [
    record.id,
    record.status,
    record.syncState ?? 'local',
    ...definition.fields.map(field => record.values[field.key] ?? ''),
    record.createdAt,
    record.updatedAt,
  ]);
  return [headers, ...rows].map(row => row.map(csvCell).join(',')).join('\n');
}
