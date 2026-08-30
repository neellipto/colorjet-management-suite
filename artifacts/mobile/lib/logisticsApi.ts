import { erpApi } from '@/lib/erpApi';

export type LogisticsStatus =
  | 'draft'
  | 'approved'
  | 'ready'
  | 'dispatched'
  | 'in_transit'
  | 'arrived'
  | 'delivered'
  | 'installation_pending'
  | 'completed'
  | 'failed'
  | 'rescheduled'
  | 'cancelled';

export type LogisticsItem = {
  id: string;
  productId?: string | null;
  description: string;
  quantity: number;
  unit?: string | null;
  serialNumbers?: string[];
};

export type LogisticsRecord = {
  id: string;
  deliveryNo: string;
  customerId: string;
  customerName: string;
  appointmentAt?: string | null;
  deliveryAddress: string;
  routeNote?: string | null;
  warehouseId?: string | null;
  vehicleReference?: string | null;
  driverName?: string | null;
  driverPhone?: string | null;
  referencePerson?: string | null;
  status: LogisticsStatus;
  items: LogisticsItem[];
  deliveryCost?: number | null;
  installationRequired: boolean;
  installationHandoffId?: string | null;
  signatureArtifactId?: string | null;
  photoArtifactIds?: string[];
  createdAt: string;
  updatedAt: string;
};

export type LogisticsStatusEvent = {
  id: string;
  logisticsId: string;
  fromStatus?: LogisticsStatus | null;
  toStatus: LogisticsStatus;
  note?: string | null;
  location?: { latitude: number; longitude: number } | null;
  createdBy: string;
  createdAt: string;
};

export async function listLogisticsRecords(params: {
  status?: LogisticsStatus;
  from?: string;
  to?: string;
  customerId?: string;
  warehouseId?: string;
  page?: number;
} = {}): Promise<LogisticsRecord[]> {
  const search = new URLSearchParams();
  if (params.status) search.set('status', params.status);
  if (params.from) search.set('from', params.from);
  if (params.to) search.set('to', params.to);
  if (params.customerId) search.set('customer_id', params.customerId);
  if (params.warehouseId) search.set('warehouse_id', params.warehouseId);
  if (params.page) search.set('page', String(Math.max(1, Math.trunc(params.page))));
  const suffix = search.toString() ? `?${search.toString()}` : '';
  return erpApi.get<LogisticsRecord[]>(`/logistics${suffix}`);
}

export async function getLogisticsRecord(id: string): Promise<LogisticsRecord> {
  return erpApi.get<LogisticsRecord>(`/logistics/${encodeURIComponent(id)}`);
}

export async function createLogisticsRecord(input: {
  clientUuid: string;
  customerId: string;
  appointmentAt?: string | null;
  deliveryAddress: string;
  routeNote?: string | null;
  warehouseId?: string | null;
  vehicleReference?: string | null;
  driverName?: string | null;
  driverPhone?: string | null;
  referencePerson?: string | null;
  items: Array<Omit<LogisticsItem, 'id'>>;
  deliveryCost?: number | null;
  installationRequired?: boolean;
}): Promise<LogisticsRecord> {
  return erpApi.post<LogisticsRecord>('/logistics', {
    client_uuid: input.clientUuid,
    customer_id: input.customerId,
    appointment_at: input.appointmentAt,
    delivery_address: input.deliveryAddress,
    route_note: input.routeNote,
    warehouse_id: input.warehouseId,
    vehicle_reference: input.vehicleReference,
    driver_name: input.driverName,
    driver_phone: input.driverPhone,
    reference_person: input.referencePerson,
    items: input.items,
    delivery_cost: input.deliveryCost,
    installation_required: input.installationRequired ?? false,
  }, { idempotencyKey: `logistics-create:${input.clientUuid}` });
}

export async function updateLogisticsStatus(input: {
  logisticsId: string;
  status: LogisticsStatus;
  note?: string | null;
  location?: { latitude: number; longitude: number } | null;
  clientUuid: string;
}): Promise<LogisticsRecord> {
  return erpApi.post<LogisticsRecord>(
    `/logistics/${encodeURIComponent(input.logisticsId)}/status`,
    {
      status: input.status,
      note: input.note,
      location: input.location,
      client_uuid: input.clientUuid,
    },
    { idempotencyKey: `logistics-status:${input.logisticsId}:${input.status}:${input.clientUuid}` },
  );
}

export async function confirmLogisticsDelivery(input: {
  logisticsId: string;
  clientUuid: string;
  signatureArtifactId: string;
  photoArtifactIds?: string[];
  customerName: string;
  deliveredAt: string;
  note?: string | null;
}): Promise<LogisticsRecord> {
  return erpApi.post<LogisticsRecord>(
    `/logistics/${encodeURIComponent(input.logisticsId)}/confirm-delivery`,
    {
      client_uuid: input.clientUuid,
      signature_artifact_id: input.signatureArtifactId,
      photo_artifact_ids: input.photoArtifactIds ?? [],
      customer_name: input.customerName,
      delivered_at: input.deliveredAt,
      note: input.note,
    },
    { idempotencyKey: `logistics-confirm:${input.logisticsId}:${input.clientUuid}` },
  );
}

export async function fetchLogisticsHistory(logisticsId: string): Promise<LogisticsStatusEvent[]> {
  return erpApi.get<LogisticsStatusEvent[]>(
    `/logistics/${encodeURIComponent(logisticsId)}/history`,
  );
}
