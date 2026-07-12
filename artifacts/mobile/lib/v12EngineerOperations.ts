import { Platform } from 'react-native';
import { getSupabase } from '@/lib/supabaseClient';

export type VisitStatus =
  | 'draft'
  | 'assigned'
  | 'accepted'
  | 'travelling'
  | 'arrived'
  | 'checked_in'
  | 'work_started'
  | 'waiting_parts'
  | 'work_resumed'
  | 'completed'
  | 'customer_confirmed'
  | 'closed'
  | 'rescheduled'
  | 'engineer_rejected'
  | 'customer_unavailable'
  | 'cancelled'
  | 'follow_up_required'
  | 'escalated'
  | 'sla_breached';

export type VisitPriority = 'low' | 'normal' | 'high' | 'urgent' | 'emergency';

export interface CustomerVisit {
  id: string;
  visit_no: string;
  ticket_id?: string | null;
  customer_id?: string | null;
  machine_id?: string | null;
  assigned_engineer_id: string;
  schedule_start: string;
  schedule_end?: string | null;
  expected_duration_minutes: number;
  priority: VisitPriority;
  status: VisitStatus;
  customer_name: string;
  contact_person?: string | null;
  customer_phone?: string | null;
  service_address: string;
  service_latitude?: number | null;
  service_longitude?: number | null;
  checkin_radius_m: number;
  accepted_at?: string | null;
  travel_started_at?: string | null;
  arrived_at?: string | null;
  checked_in_at?: string | null;
  work_started_at?: string | null;
  completed_at?: string | null;
  customer_confirmed_at?: string | null;
  closed_at?: string | null;
  sla_due_at?: string | null;
  follow_up_at?: string | null;
  notes?: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface TrackingSession {
  id: string;
  visit_id?: string | null;
  engineer_id: string;
  device_id?: string | null;
  status: 'active' | 'paused' | 'completed' | 'cancelled';
  started_at: string;
  ended_at?: string | null;
  total_distance_m: number;
  point_count: number;
  last_point_at?: string | null;
}

export interface LocationPoint {
  id: string;
  session_id: string;
  visit_id?: string | null;
  engineer_id: string;
  latitude: number;
  longitude: number;
  accuracy_m?: number | null;
  speed_mps?: number | null;
  bearing_deg?: number | null;
  altitude_m?: number | null;
  is_mock: boolean;
  captured_at: string;
  server_received_at: string;
}

export interface VisitTransitionInput {
  visitId: string;
  newStatus: VisitStatus;
  note?: string;
  latitude?: number;
  longitude?: number;
  accuracyM?: number;
  deviceId?: string;
  idempotencyKey?: string;
}

export interface CreateVisitInput {
  ticketId?: string;
  customerId?: string;
  machineId?: string;
  assignedEngineerId: string;
  scheduleStart: string;
  scheduleEnd?: string;
  expectedDurationMinutes?: number;
  priority?: VisitPriority;
  customerName: string;
  contactPerson?: string;
  customerPhone?: string;
  serviceAddress: string;
  serviceLatitude?: number;
  serviceLongitude?: number;
  checkinRadiusM?: number;
  slaDueAt?: string;
  notes?: string;
}

function unwrap<T>(data: T | null, error: { message: string } | null, fallbackMessage: string): T {
  if (error) throw new Error(error.message);
  if (data === null) throw new Error(fallbackMessage);
  return data;
}

function visitNumber(): string {
  const now = new Date();
  const stamp = now.toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `CJ-VIS-${stamp}-${random}`;
}

export async function listCustomerVisits(options?: {
  engineerId?: string;
  statuses?: VisitStatus[];
  from?: string;
  to?: string;
  limit?: number;
}): Promise<CustomerVisit[]> {
  const supabase = getSupabase();
  let query = supabase
    .from('v12_customer_visits')
    .select('*')
    .order('schedule_start', { ascending: true })
    .limit(options?.limit ?? 100);

  if (options?.engineerId) query = query.eq('assigned_engineer_id', options.engineerId);
  if (options?.statuses?.length) query = query.in('status', options.statuses);
  if (options?.from) query = query.gte('schedule_start', options.from);
  if (options?.to) query = query.lte('schedule_start', options.to);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as CustomerVisit[];
}

export async function getCustomerVisit(visitId: string): Promise<CustomerVisit> {
  const { data, error } = await getSupabase()
    .from('v12_customer_visits')
    .select('*')
    .eq('id', visitId)
    .single();
  return unwrap(data as CustomerVisit | null, error, 'Visit not found.');
}

export async function createCustomerVisit(input: CreateVisitInput): Promise<CustomerVisit> {
  const payload = {
    visit_no: visitNumber(),
    ticket_id: input.ticketId ?? null,
    customer_id: input.customerId ?? null,
    machine_id: input.machineId ?? null,
    assigned_engineer_id: input.assignedEngineerId,
    schedule_start: input.scheduleStart,
    schedule_end: input.scheduleEnd ?? null,
    expected_duration_minutes: input.expectedDurationMinutes ?? 120,
    priority: input.priority ?? 'normal',
    status: 'assigned' as VisitStatus,
    customer_name: input.customerName.trim(),
    contact_person: input.contactPerson?.trim() || null,
    customer_phone: input.customerPhone?.trim() || null,
    service_address: input.serviceAddress.trim(),
    service_latitude: input.serviceLatitude ?? null,
    service_longitude: input.serviceLongitude ?? null,
    checkin_radius_m: input.checkinRadiusM ?? 200,
    sla_due_at: input.slaDueAt ?? null,
    notes: input.notes?.trim() || null,
  };

  const { data, error } = await getSupabase()
    .from('v12_customer_visits')
    .insert(payload)
    .select('*')
    .single();

  return unwrap(data as CustomerVisit | null, error, 'Visit could not be created.');
}

export async function transitionCustomerVisit(input: VisitTransitionInput): Promise<CustomerVisit> {
  if (input.newStatus === 'travelling' && Platform.OS !== 'web') {
    const { requestFieldLocationPermissions } = await import('@/lib/backgroundLocation');
    const permission = await requestFieldLocationPermissions();
    if (!permission.foreground) throw new Error('Precise location permission is required before starting travel.');
    if (!permission.background) throw new Error('Allow all-the-time location access before starting travel.');
  }

  const { data, error } = await getSupabase().rpc('v12_transition_visit', {
    p_visit_id: input.visitId,
    p_new_status: input.newStatus,
    p_note: input.note ?? null,
    p_latitude: input.latitude ?? null,
    p_longitude: input.longitude ?? null,
    p_accuracy_m: input.accuracyM ?? null,
    p_device_id: input.deviceId ?? null,
    p_idempotency_key: input.idempotencyKey ?? null,
  });

  return unwrap(data as CustomerVisit | null, error, 'Visit transition failed.');
}

export async function startTrackingSession(input: {
  visitId: string;
  deviceId: string;
  latitude?: number;
  longitude?: number;
}): Promise<string> {
  const { data, error } = await getSupabase().rpc('v12_start_tracking_session', {
    p_visit_id: input.visitId,
    p_device_id: input.deviceId,
    p_latitude: input.latitude ?? null,
    p_longitude: input.longitude ?? null,
  });
  return unwrap(data as string | null, error, 'Tracking session could not start.');
}

export async function stopTrackingSession(input: {
  sessionId: string;
  latitude?: number;
  longitude?: number;
}): Promise<void> {
  const { error } = await getSupabase().rpc('v12_stop_tracking_session', {
    p_session_id: input.sessionId,
    p_latitude: input.latitude ?? null,
    p_longitude: input.longitude ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function listTrackingSessions(visitId: string): Promise<TrackingSession[]> {
  const { data, error } = await getSupabase()
    .from('v12_tracking_sessions')
    .select('*')
    .eq('visit_id', visitId)
    .order('started_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as TrackingSession[];
}

export async function listRoutePoints(sessionId: string, limit = 2000): Promise<LocationPoint[]> {
  const { data, error } = await getSupabase()
    .from('v12_location_points')
    .select('*')
    .eq('session_id', sessionId)
    .order('captured_at', { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as LocationPoint[];
}

export async function createPartsRequest(input: {
  ticketId?: string;
  visitId?: string;
  urgency: 'low' | 'normal' | 'high' | 'urgent' | 'emergency';
  requestType: 'service' | 'warranty' | 'replacement' | 'internal_repair';
  reason: string;
  requiredAt?: string;
  items: Array<{
    productId?: string;
    sku?: string;
    productName: string;
    model?: string;
    identificationNo?: string;
    quantity: number;
    billingType: 'warranty' | 'free' | 'chargeable';
    damagedPartSerial?: string;
    note?: string;
  }>;
}): Promise<string> {
  if (!input.items.length) throw new Error('At least one spare part is required.');

  const { data, error } = await getSupabase().rpc('v12_create_parts_request', {
    p_ticket_id: input.ticketId ?? null,
    p_visit_id: input.visitId ?? null,
    p_urgency: input.urgency,
    p_request_type: input.requestType,
    p_reason: input.reason.trim(),
    p_required_at: input.requiredAt ?? null,
    p_items: input.items.map(item => ({
      product_id: item.productId ?? null,
      sku: item.sku ?? null,
      product_name: item.productName.trim(),
      model: item.model?.trim() || null,
      identification_no: item.identificationNo?.trim() || null,
      requested_qty: item.quantity,
      billing_type: item.billingType,
      damaged_part_serial: item.damagedPartSerial?.trim() || null,
      note: item.note?.trim() || null,
    })),
  });

  return unwrap(data as string | null, error, 'Parts request could not be created.');
}
