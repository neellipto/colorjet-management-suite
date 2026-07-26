import { erpApi } from '@/lib/erpApi';

export type DutyEventType =
  | 'office_check_in'
  | 'office_check_out'
  | 'field_duty_start'
  | 'customer_site_check_in'
  | 'customer_site_check_out'
  | 'break_start'
  | 'break_end'
  | 'duty_end';

export type GeoPoint = {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  altitude?: number | null;
  speed?: number | null;
  heading?: number | null;
  recordedAt: string;
  mocked?: boolean;
};

export type DutySession = {
  id: string;
  sessionUuid: string;
  employeeId: string;
  status: 'active' | 'paused' | 'completed' | 'cancelled';
  startedAt: string;
  endedAt?: string | null;
  dutyType: 'office' | 'field' | 'customer_visit';
  customerId?: string | null;
  serviceTicketId?: string | null;
  geofenceResult?: 'inside' | 'outside' | 'not_configured' | 'not_checked';
  selfieArtifactId?: string | null;
  totalDistanceKm?: number | null;
  trackingPolicy?: {
    trackingAllowed: boolean;
    trackingStartsAt?: string | null;
    trackingStopsAt?: string | null;
    reason?: string | null;
  };
};

export type AttendanceEvent = {
  id: string;
  sessionId?: string | null;
  eventType: DutyEventType;
  occurredAt: string;
  location?: GeoPoint | null;
  note?: string | null;
  approvalStatus?: 'not_required' | 'pending' | 'approved' | 'rejected';
  auditReference?: string | null;
};

export async function startDutySession(input: {
  sessionUuid: string;
  dutyType: DutySession['dutyType'];
  location: GeoPoint;
  customerId?: string | null;
  serviceTicketId?: string | null;
  selfieArtifactId?: string | null;
  clientUuid: string;
}): Promise<DutySession> {
  return erpApi.post<DutySession>('/attendance/duty-sessions', {
    session_uuid: input.sessionUuid,
    duty_type: input.dutyType,
    location: input.location,
    customer_id: input.customerId,
    service_ticket_id: input.serviceTicketId,
    selfie_artifact_id: input.selfieArtifactId,
    client_uuid: input.clientUuid,
  }, { idempotencyKey: `duty-start:${input.sessionUuid}:${input.clientUuid}` });
}

export async function recordAttendanceEvent(input: {
  sessionId?: string | null;
  eventType: DutyEventType;
  location?: GeoPoint | null;
  note?: string | null;
  clientUuid: string;
}): Promise<AttendanceEvent> {
  return erpApi.post<AttendanceEvent>('/attendance/events', {
    session_id: input.sessionId,
    event_type: input.eventType,
    location: input.location,
    note: input.note,
    client_uuid: input.clientUuid,
  }, { idempotencyKey: `attendance-event:${input.eventType}:${input.clientUuid}` });
}

export async function uploadDutyLocations(input: {
  sessionId: string;
  clientBatchId: string;
  points: GeoPoint[];
}): Promise<{ accepted: number; duplicates: number; rejected: number; acknowledgement: string }> {
  return erpApi.post<{ accepted: number; duplicates: number; rejected: number; acknowledgement: string }>(
    `/attendance/duty-sessions/${encodeURIComponent(input.sessionId)}/locations`,
    {
      client_batch_id: input.clientBatchId,
      points: input.points,
    },
    { idempotencyKey: `duty-locations:${input.sessionId}:${input.clientBatchId}` },
  );
}

export async function endDutySession(input: {
  sessionId: string;
  location?: GeoPoint | null;
  note?: string | null;
  clientUuid: string;
}): Promise<DutySession> {
  return erpApi.post<DutySession>(
    `/attendance/duty-sessions/${encodeURIComponent(input.sessionId)}/end`,
    {
      location: input.location,
      note: input.note,
      client_uuid: input.clientUuid,
    },
    { idempotencyKey: `duty-end:${input.sessionId}:${input.clientUuid}` },
  );
}

export async function fetchMyAttendanceHistory(input: {
  from?: string;
  to?: string;
  page?: number;
} = {}): Promise<AttendanceEvent[]> {
  const search = new URLSearchParams();
  if (input.from) search.set('from', input.from);
  if (input.to) search.set('to', input.to);
  if (input.page) search.set('page', String(Math.max(1, Math.trunc(input.page))));
  const suffix = search.toString() ? `?${search.toString()}` : '';
  return erpApi.get<AttendanceEvent[]>(`/attendance/me${suffix}`);
}
