import { erpApi } from '@/lib/erpApi';

export type NotificationStatus = 'unread' | 'read' | 'acknowledged' | 'assigned' | 'resolved' | 'dismissed';

export type NotificationSeverity = 'info' | 'warning' | 'high' | 'critical';

export type NotificationChannel = 'in_app' | 'push' | 'email' | 'sms' | 'whatsapp';

export type ErpNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  severity: NotificationSeverity;
  status: NotificationStatus;
  entity?: string | null;
  entityId?: string | null;
  route?: string | null;
  createdAt: string;
  readAt?: string | null;
  acknowledgedAt?: string | null;
  acknowledgedBy?: string | null;
  assignedTo?: string | null;
  resolvedAt?: string | null;
  channels?: NotificationChannel[];
  deliveryHistory?: Array<{
    channel: NotificationChannel;
    status: 'queued' | 'sent' | 'delivered' | 'failed';
    attemptedAt?: string | null;
    deliveredAt?: string | null;
    error?: string | null;
  }>;
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

function notificationStatus(value: unknown, record: UnknownRecord): NotificationStatus {
  const normalized = text(value).toLowerCase();
  const allowed: NotificationStatus[] = ['unread', 'read', 'acknowledged', 'assigned', 'resolved', 'dismissed'];
  if (allowed.includes(normalized as NotificationStatus)) return normalized as NotificationStatus;
  return record.readAt || record.read_at ? 'read' : 'unread';
}

function notificationSeverity(value: unknown): NotificationSeverity {
  const normalized = text(value).toLowerCase();
  const allowed: NotificationSeverity[] = ['info', 'warning', 'high', 'critical'];
  return allowed.includes(normalized as NotificationSeverity) ? normalized as NotificationSeverity : 'info';
}

function notificationChannels(value: unknown): NotificationChannel[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const allowed: NotificationChannel[] = ['in_app', 'push', 'email', 'sms', 'whatsapp'];
  const channels = value
    .map(item => text(item).toLowerCase())
    .filter((item): item is NotificationChannel => allowed.includes(item as NotificationChannel));
  return channels.length > 0 ? channels : undefined;
}

function normalizeNotification(value: unknown): ErpNotification {
  const record = asRecord(value);
  if (!record) throw new Error('ERP notification response is invalid.');

  const id = text(record.id ?? record.notification_id).trim();
  if (!id) throw new Error('ERP notification response does not include an ID.');

  return {
    id,
    type: text(record.type ?? record.notification_type, 'general'),
    title: text(record.title ?? record.subject, 'Notification'),
    body: text(record.body ?? record.message ?? record.description),
    severity: notificationSeverity(record.severity ?? record.priority),
    status: notificationStatus(record.status, record),
    entity: optionalText(record.entity ?? record.entity_type),
    entityId: optionalText(record.entityId ?? record.entity_id),
    route: optionalText(record.route ?? record.deep_link ?? record.action_url),
    createdAt: text(record.createdAt ?? record.created_at, new Date().toISOString()),
    readAt: optionalText(record.readAt ?? record.read_at),
    acknowledgedAt: optionalText(record.acknowledgedAt ?? record.acknowledged_at),
    acknowledgedBy: optionalText(record.acknowledgedBy ?? record.acknowledged_by),
    assignedTo: optionalText(record.assignedTo ?? record.assigned_to),
    resolvedAt: optionalText(record.resolvedAt ?? record.resolved_at),
    channels: notificationChannels(record.channels),
  };
}

function notificationRows(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  const record = asRecord(value);
  if (!record) return [];

  for (const key of ['items', 'notifications', 'data']) {
    const candidate = record[key];
    if (Array.isArray(candidate)) return candidate;
    const nested = asRecord(candidate);
    if (nested && Array.isArray(nested.data)) return nested.data;
  }
  return [];
}

export async function listNotifications(input: {
  status?: NotificationStatus;
  severity?: NotificationSeverity;
  type?: string;
  page?: number;
  limit?: number;
} = {}): Promise<ErpNotification[]> {
  const search = new URLSearchParams();
  if (input.status) search.set('status', input.status);
  if (input.severity) search.set('severity', input.severity);
  if (input.type) search.set('type', input.type);
  if (input.page) search.set('page', String(Math.max(1, Math.trunc(input.page))));
  if (input.limit) search.set('limit', String(Math.max(1, Math.min(200, Math.trunc(input.limit)))));
  const suffix = search.toString() ? `?${search.toString()}` : '';
  const response = await erpApi.get<unknown>(`/notifications${suffix}`);
  return notificationRows(response).map(normalizeNotification);
}

export async function markNotificationRead(notificationId: string): Promise<ErpNotification> {
  const response = await erpApi.post<unknown>(
    `/notifications/${encodeURIComponent(notificationId)}/read`,
    {},
    { idempotencyKey: `notification-read:${notificationId}` },
  );
  return normalizeNotification(response);
}

export async function acknowledgeNotification(
  notificationId: string,
  note?: string | null,
): Promise<ErpNotification> {
  const response = await erpApi.post<unknown>(
    `/notifications/${encodeURIComponent(notificationId)}/acknowledge`,
    { note },
    { idempotencyKey: `notification-ack:${notificationId}` },
  );
  return normalizeNotification(response);
}

export async function resolveNotification(
  notificationId: string,
  resolution: string,
): Promise<ErpNotification> {
  const response = await erpApi.post<unknown>(
    `/notifications/${encodeURIComponent(notificationId)}/resolve`,
    { resolution },
    { idempotencyKey: `notification-resolve:${notificationId}` },
  );
  return normalizeNotification(response);
}

export async function registerFcmToken(input: {
  deviceId: string;
  token: string;
  appVersion: string;
}): Promise<void> {
  await erpApi.post<void>('/notifications/devices', {
    device_id: input.deviceId,
    fcm_token: input.token,
    app_version: input.appVersion,
    platform: 'android',
  }, { idempotencyKey: `fcm:${input.deviceId}:${input.token}` });
}

export async function unregisterFcmToken(deviceId: string): Promise<void> {
  await erpApi.delete<void>(`/notifications/devices/${encodeURIComponent(deviceId)}`);
}
