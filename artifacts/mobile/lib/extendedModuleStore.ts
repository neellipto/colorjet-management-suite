import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ExtendedModuleDefinition } from '@/constants/extendedModules';

export interface ExtendedRecord {
  id: string;
  moduleId: string;
  status: string;
  values: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

const storageKey = (moduleId: string) => `@colorjet/extended-module/${moduleId}`;

function numeric(value?: string): number {
  const parsed = Number(String(value ?? '').replace(/,/g, '').trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

function fixed(value: number): string {
  if (!Number.isFinite(value)) return '0';
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
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

export async function loadExtendedRecords(moduleId: string): Promise<ExtendedRecord[]> {
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

export async function saveExtendedRecord(
  definition: ExtendedModuleDefinition,
  values: Record<string, string>,
  recordId?: string,
): Promise<ExtendedRecord> {
  const now = new Date().toISOString();
  const calculated = calculateModuleValues(definition.id, values);
  const records = await loadExtendedRecords(definition.id);
  const existing = recordId ? records.find(item => item.id === recordId) : undefined;
  const record: ExtendedRecord = {
    id: existing?.id ?? `EXT-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    moduleId: definition.id,
    status: existing?.status ?? definition.statuses[0] ?? 'Draft',
    values: calculated,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  const next = existing
    ? records.map(item => item.id === existing.id ? record : item)
    : [record, ...records];
  await persist(definition.id, next);
  return record;
}

export async function deleteExtendedRecord(moduleId: string, recordId: string): Promise<void> {
  const records = await loadExtendedRecords(moduleId);
  await persist(moduleId, records.filter(item => item.id !== recordId));
}

export async function advanceExtendedRecordStatus(
  definition: ExtendedModuleDefinition,
  recordId: string,
): Promise<ExtendedRecord | null> {
  const records = await loadExtendedRecords(definition.id);
  let updated: ExtendedRecord | null = null;
  const nextRecords = records.map(record => {
    if (record.id !== recordId) return record;
    const currentIndex = Math.max(0, definition.statuses.indexOf(record.status));
    const nextStatus = definition.statuses[Math.min(currentIndex + 1, definition.statuses.length - 1)] ?? record.status;
    updated = { ...record, status: nextStatus, updatedAt: new Date().toISOString() };
    return updated;
  });
  await persist(definition.id, nextRecords);
  return updated;
}

function csvCell(value: unknown): string {
  return `"${String(value ?? '').replace(/"/g, '""').replace(/[\r\n]+/g, ' ')}"`;
}

export function extendedRecordsToCsv(
  definition: ExtendedModuleDefinition,
  records: ExtendedRecord[],
): string {
  const headers = ['Record ID', 'Status', ...definition.fields.map(field => field.label), 'Created At', 'Updated At'];
  const rows = records.map(record => [
    record.id,
    record.status,
    ...definition.fields.map(field => record.values[field.key] ?? ''),
    record.createdAt,
    record.updatedAt,
  ]);
  return [headers, ...rows].map(row => row.map(csvCell).join(',')).join('\n');
}
