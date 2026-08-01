import type { DeliveryOrder } from '@/constants/types';
import { erpApi } from '@/lib/erpApi';

export type ErpDeliveryOrder = DeliveryOrder & {
  assignedToName?: string;
  lockVersion: number;
  dispatchedAt?: string | null;
  deliveredAt?: string | null;
};

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as UnknownRecord : null;
}

function text(value: unknown, fallback = ''): string {
  if (value === null || value === undefined) return fallback;
  return String(value);
}

function optionalText(value: unknown): string | null {
  const normalized = text(value).trim();
  return normalized || null;
}

function positiveInteger(value: unknown, fallback = 1): number {
  const normalized = Number(value);
  return Number.isInteger(normalized) && normalized > 0 ? normalized : fallback;
}

function rows(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  const record = asRecord(value);
  if (!record) return [];
  for (const key of ['items', 'deliveries', 'data']) {
    const candidate = record[key];
    if (Array.isArray(candidate)) return candidate;
    const nested = asRecord(candidate);
    if (nested && Array.isArray(nested.data)) return nested.data;
  }
  return [];
}

function deliveryStatus(value: unknown): DeliveryOrder['status'] {
  const normalized = text(value).toLowerCase();
  if (normalized === 'out_for_delivery' || normalized === 'delivered' || normalized === 'failed') return normalized;
  return 'pending';
}

function deliveryItems(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(item => {
    if (typeof item === 'string') return item;
    const record = asRecord(item);
    if (!record) return text(item);
    const name = text(record.productName ?? record.product_name ?? record.name ?? record.description, 'Item');
    const quantity = record.qty ?? record.quantity;
    return quantity === null || quantity === undefined ? name : `${name} × ${quantity}`;
  });
}

export function normalizeDelivery(value: unknown): ErpDeliveryOrder {
  const record = asRecord(value);
  if (!record) throw new Error('ERP delivery response is invalid.');
  const id = text(record.id ?? record.uuid).trim();
  if (!id) throw new Error('ERP delivery response does not include an ID.');

  return {
    id,
    doNo: text(record.doNo ?? record.delivery_no ?? record.do_no, 'Delivery'),
    customerId: text(record.customerId ?? record.customer_id),
    customerName: text(record.customerName ?? record.customer_name, 'Customer'),
    deliveryDate: text(record.deliveryDate ?? record.delivery_date),
    status: deliveryStatus(record.status),
    items: deliveryItems(record.items),
    receiverName: text(record.receiverName ?? record.receiver_name),
    receiverPhone: text(record.receiverPhone ?? record.receiver_phone),
    deliveredByName: text(record.deliveredByName ?? record.delivered_by_name),
    vehicleNo: optionalText(record.vehicleNo ?? record.vehicle_no) ?? undefined,
    assignedTo: optionalText(record.assignedTo ?? record.assigned_to) ?? undefined,
    assignedToName: optionalText(record.assignedToName ?? record.assigned_to_name) ?? undefined,
    address: text(record.address ?? record.delivery_address),
    notes: optionalText(record.notes) ?? undefined,
    lockVersion: positiveInteger(record.lockVersion ?? record.lock_version),
    dispatchedAt: optionalText(record.dispatchedAt ?? record.dispatched_at),
    deliveredAt: optionalText(record.deliveredAt ?? record.delivered_at),
  };
}

export async function listDeliveries(input: {
  status?: DeliveryOrder['status'];
  page?: number;
  limit?: number;
} = {}): Promise<ErpDeliveryOrder[]> {
  const search = new URLSearchParams();
  if (input.status) search.set('status', input.status);
  if (input.page) search.set('page', String(Math.max(1, Math.trunc(input.page))));
  if (input.limit) search.set('limit', String(Math.max(1, Math.min(200, Math.trunc(input.limit)))));
  const suffix = search.toString() ? `?${search.toString()}` : '';
  const response = await erpApi.get<unknown>(`/deliveries${suffix}`);
  return rows(response).map(normalizeDelivery);
}

export async function updateDeliveryStatus(input: {
  deliveryId: string;
  status: DeliveryOrder['status'];
  lockVersion: number;
  note?: string | null;
}): Promise<ErpDeliveryOrder> {
  const response = await erpApi.patch<unknown>(
    `/deliveries/${encodeURIComponent(input.deliveryId)}/status`,
    {
      status: input.status,
      lock_version: input.lockVersion,
      note: input.note ?? null,
    },
    { idempotencyKey: `delivery-status:${input.deliveryId}:${input.lockVersion}:${input.status}` },
  );
  return normalizeDelivery(response);
}
