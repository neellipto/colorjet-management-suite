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
  return erpApi.get<ErpNotification[]>(`/notifications${suffix}`);
}

export async function markNotificationRead(notificationId: string): Promise<ErpNotification> {
  return erpApi.post<ErpNotification>(
    `/notifications/${encodeURIComponent(notificationId)}/read`,
    {},
    { idempotencyKey: `notification-read:${notificationId}` },
  );
}

export async function acknowledgeNotification(
  notificationId: string,
  note?: string | null,
): Promise<ErpNotification> {
  return erpApi.post<ErpNotification>(
    `/notifications/${encodeURIComponent(notificationId)}/acknowledge`,
    { note },
    { idempotencyKey: `notification-ack:${notificationId}` },
  );
}

export async function resolveNotification(
  notificationId: string,
  resolution: string,
): Promise<ErpNotification> {
  return erpApi.post<ErpNotification>(
    `/notifications/${encodeURIComponent(notificationId)}/resolve`,
    { resolution },
    { idempotencyKey: `notification-resolve:${notificationId}` },
  );
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
