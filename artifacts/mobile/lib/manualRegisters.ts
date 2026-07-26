import { erpApi } from '@/lib/erpApi';

export type ManualRegisterType =
  | 'amount'
  | 'expense'
  | 'income'
  | 'asset'
  | 'item_quantity'
  | 'general'
  | 'document'
  | 'customer'
  | 'supplier'
  | 'employee'
  | 'engineer'
  | 'custom';

export type ManualRegisterFieldType =
  | 'text'
  | 'number'
  | 'currency'
  | 'quantity'
  | 'date'
  | 'time'
  | 'dropdown'
  | 'customer'
  | 'supplier'
  | 'employee'
  | 'engineer'
  | 'product'
  | 'category'
  | 'account'
  | 'asset'
  | 'file'
  | 'image'
  | 'signature'
  | 'formula'
  | 'status'
  | 'approval';

export type ManualRegisterField = {
  key: string;
  label: string;
  labelBn?: string | null;
  type: ManualRegisterFieldType;
  required: boolean;
  options?: Array<{ value: string; label: string }>;
  validation?: Record<string, unknown>;
  defaultValue?: unknown;
  position: number;
};

export type ManualRegisterDefinition = {
  id: string;
  code: string;
  name: string;
  nameBn?: string | null;
  registerType: ManualRegisterType;
  category?: string | null;
  departmentId?: string | null;
  branchId?: string | null;
  responsibleRoleCodes?: string[];
  responsibleUserIds?: string[];
  fields: ManualRegisterField[];
  workflow?: Record<string, unknown>;
  approvalRequired: boolean;
  mobileEnabled: boolean;
  webEnabled: boolean;
  active: boolean;
  postingRuleConfigured: boolean;
  version: number;
};

export type ManualRegisterEntryStatus =
  | 'draft'
  | 'submitted'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'posted'
  | 'reversed'
  | 'archived';

export type ManualRegisterEntry = {
  id: string;
  registerId: string;
  entryNo: string;
  entryDate: string;
  status: ManualRegisterEntryStatus;
  values: Record<string, unknown>;
  attachments?: Array<{ id: string; name: string; url?: string; mimeType?: string }>;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  approvedBy?: string | null;
  approvedAt?: string | null;
  postedAt?: string | null;
  postingReference?: string | null;
  accountingImpact: boolean;
  stockImpact: boolean;
};

export type ManualRegisterEntryInput = {
  registerId: string;
  entryDate: string;
  values: Record<string, unknown>;
  attachmentIds?: string[];
  clientUuid: string;
};

export async function listManualRegisters(): Promise<ManualRegisterDefinition[]> {
  return erpApi.get<ManualRegisterDefinition[]>('/manual-registers');
}

export async function getManualRegister(registerId: string): Promise<ManualRegisterDefinition> {
  return erpApi.get<ManualRegisterDefinition>(`/manual-registers/${encodeURIComponent(registerId)}`);
}

export async function listManualRegisterEntries(
  registerId: string,
  params: { from?: string; to?: string; status?: ManualRegisterEntryStatus; page?: number } = {},
): Promise<ManualRegisterEntry[]> {
  const search = new URLSearchParams();
  if (params.from) search.set('from', params.from);
  if (params.to) search.set('to', params.to);
  if (params.status) search.set('status', params.status);
  if (params.page) search.set('page', String(params.page));
  const suffix = search.toString() ? `?${search.toString()}` : '';
  return erpApi.get<ManualRegisterEntry[]>(
    `/manual-registers/${encodeURIComponent(registerId)}/entries${suffix}`,
  );
}

export async function createManualRegisterEntry(input: ManualRegisterEntryInput): Promise<ManualRegisterEntry> {
  return erpApi.post<ManualRegisterEntry>(
    `/manual-registers/${encodeURIComponent(input.registerId)}/entries`,
    {
      entry_date: input.entryDate,
      values: input.values,
      attachment_ids: input.attachmentIds ?? [],
      client_uuid: input.clientUuid,
    },
    { idempotencyKey: `manual-register:${input.registerId}:${input.clientUuid}` },
  );
}

export async function submitManualRegisterEntry(entryId: string): Promise<ManualRegisterEntry> {
  return erpApi.post<ManualRegisterEntry>(
    `/manual-register-entries/${encodeURIComponent(entryId)}/submit`,
    {},
    { idempotencyKey: `manual-register-submit:${entryId}` },
  );
}

export async function approveManualRegisterEntry(entryId: string, note?: string): Promise<ManualRegisterEntry> {
  return erpApi.post<ManualRegisterEntry>(
    `/manual-register-entries/${encodeURIComponent(entryId)}/approve`,
    { note },
    { idempotencyKey: `manual-register-approve:${entryId}` },
  );
}

export async function postManualRegisterEntry(
  entryId: string,
  confirmationToken: string,
): Promise<ManualRegisterEntry> {
  return erpApi.post<ManualRegisterEntry>(
    `/manual-register-entries/${encodeURIComponent(entryId)}/post`,
    { confirmation_token: confirmationToken },
    { idempotencyKey: `manual-register-post:${entryId}` },
  );
}
