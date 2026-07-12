import { getSupabase } from '@/lib/supabaseClient';

export type ServiceTicketStatus =
  | 'draft' | 'open' | 'triage' | 'assigned' | 'accepted' | 'travelling' | 'arrived'
  | 'checked_in' | 'diagnosing' | 'work_started' | 'waiting_parts' | 'waiting_customer'
  | 'waiting_supplier' | 'follow_up' | 'resolved' | 'customer_confirmed' | 'closed'
  | 'cancelled' | 'rejected' | 'escalated' | 'sla_breached';

export interface ServiceTicketRecord {
  id: string;
  ticket_no: string;
  customer_id?: string | null;
  asset_id?: string | null;
  warranty_registration_id?: string | null;
  ticket_type: string;
  title: string;
  description: string;
  priority: 'low' | 'normal' | 'high' | 'urgent' | 'emergency';
  status: ServiceTicketStatus;
  warranty_decision: 'pending' | 'covered' | 'partially_covered' | 'not_covered' | 'expired' | 'void';
  warranty_reason?: string | null;
  customer_name: string;
  contact_person?: string | null;
  customer_phone?: string | null;
  service_address: string;
  problem_category?: string | null;
  machine_brand?: string | null;
  machine_model?: string | null;
  machine_serial?: string | null;
  assigned_engineer_id?: string | null;
  planned_start?: string | null;
  response_due_at?: string | null;
  arrival_due_at?: string | null;
  resolution_due_at?: string | null;
  resolved_at?: string | null;
  closed_at?: string | null;
  estimated_cost: number;
  approved_cost: number;
  final_cost: number;
  created_at: string;
  updated_at: string;
}

export interface CustomerAssetRecord {
  id: string;
  customer_id?: string | null;
  asset_no: string;
  machine_brand?: string | null;
  machine_model: string;
  machine_serial: string;
  installation_date?: string | null;
  warranty_start_date?: string | null;
  warranty_end_date?: string | null;
  warranty_status: 'pending' | 'active' | 'expired' | 'void' | 'replaced' | 'extended';
  location_address?: string | null;
}

export interface WarrantyRegistrationRecord {
  id: string;
  warranty_no: string;
  asset_id: string;
  customer_id?: string | null;
  warranty_start_date: string;
  warranty_end_date: string;
  coverage_type: 'standard' | 'extended' | 'amc' | 'service_only' | 'parts_only';
  engineer_service_months: number;
  covered_parts: string[];
  excluded_parts: string[];
  status: 'draft' | 'active' | 'expired' | 'suspended' | 'void' | 'replaced' | 'closed';
}

export interface SlaAlertRecord {
  id: string;
  ticket_id: string;
  metric: string;
  severity: 'info' | 'warning' | 'near_breach' | 'breached' | 'critical';
  status: 'open' | 'acknowledged' | 'resolved' | 'suppressed';
  due_at: string;
  detected_at: string;
  message: string;
  notification_payload: Record<string, unknown>;
}

function unwrap<T>(data: T | null, error: { message: string } | null, fallback: string): T {
  if (error) throw new Error(error.message);
  if (data === null) throw new Error(fallback);
  return data;
}

export async function listServiceTickets(options?: {
  statuses?: ServiceTicketStatus[];
  engineerId?: string;
  customerId?: string;
  limit?: number;
}): Promise<ServiceTicketRecord[]> {
  let query = getSupabase()
    .from('v12_service_tickets')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(options?.limit ?? 200);

  if (options?.statuses?.length) query = query.in('status', options.statuses);
  if (options?.engineerId) query = query.eq('assigned_engineer_id', options.engineerId);
  if (options?.customerId) query = query.eq('customer_id', options.customerId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as ServiceTicketRecord[];
}

export async function listCustomerAssets(customerId?: string): Promise<CustomerAssetRecord[]> {
  let query = getSupabase().from('v12_customer_assets').select('*').order('created_at', { ascending: false });
  if (customerId) query = query.eq('customer_id', customerId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as CustomerAssetRecord[];
}

export async function listWarrantyRegistrations(assetId?: string): Promise<WarrantyRegistrationRecord[]> {
  let query = getSupabase().from('v12_warranty_registrations').select('*').order('created_at', { ascending: false });
  if (assetId) query = query.eq('asset_id', assetId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as WarrantyRegistrationRecord[];
}

export async function listOpenSlaAlerts(limit = 100): Promise<SlaAlertRecord[]> {
  const { data, error } = await getSupabase()
    .from('v12_sla_alerts')
    .select('*')
    .in('status', ['open', 'acknowledged'])
    .order('due_at', { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as SlaAlertRecord[];
}

export async function createServiceTicket(input: {
  customerId?: string;
  assetId?: string;
  ticketType: string;
  title: string;
  description: string;
  priority: 'low' | 'normal' | 'high' | 'urgent' | 'emergency';
  customerName: string;
  contactPerson?: string;
  customerPhone?: string;
  serviceAddress: string;
  problemCategory?: string;
  assignedEngineerId?: string;
  plannedStart?: string;
  responseMinutes?: number;
  arrivalMinutes?: number;
  resolutionMinutes?: number;
  source?: string;
}): Promise<ServiceTicketRecord> {
  const { data, error } = await getSupabase().rpc('v12p2_create_service_ticket', {
    p_customer_id: input.customerId ?? null,
    p_asset_id: input.assetId ?? null,
    p_ticket_type: input.ticketType,
    p_title: input.title.trim(),
    p_description: input.description.trim(),
    p_priority: input.priority,
    p_customer_name: input.customerName.trim(),
    p_contact_person: input.contactPerson?.trim() || null,
    p_customer_phone: input.customerPhone?.trim() || null,
    p_service_address: input.serviceAddress.trim(),
    p_problem_category: input.problemCategory?.trim() || null,
    p_assigned_engineer_id: input.assignedEngineerId ?? null,
    p_planned_start: input.plannedStart ?? null,
    p_response_minutes: input.responseMinutes ?? 30,
    p_arrival_minutes: input.arrivalMinutes ?? 240,
    p_resolution_minutes: input.resolutionMinutes ?? 1440,
    p_source: input.source ?? 'admin',
  });
  return unwrap(data as ServiceTicketRecord | null, error, 'Service ticket could not be created.');
}

export async function transitionServiceTicket(input: {
  ticketId: string;
  newStatus: ServiceTicketStatus;
  note?: string;
  latitude?: number;
  longitude?: number;
  idempotencyKey?: string;
}): Promise<ServiceTicketRecord> {
  const { data, error } = await getSupabase().rpc('v12p2_transition_service_ticket', {
    p_ticket_id: input.ticketId,
    p_new_status: input.newStatus,
    p_note: input.note ?? null,
    p_latitude: input.latitude ?? null,
    p_longitude: input.longitude ?? null,
    p_idempotency_key: input.idempotencyKey ?? null,
  });
  return unwrap(data as ServiceTicketRecord | null, error, 'Ticket transition failed.');
}

export async function registerWarranty(input: {
  assetId: string;
  customerId?: string;
  startDate: string;
  endDate: string;
  coverageType: 'standard' | 'extended' | 'amc' | 'service_only' | 'parts_only';
  engineerServiceMonths?: number;
  coveredParts?: string[];
  excludedParts?: string[];
  terms?: string;
}): Promise<WarrantyRegistrationRecord> {
  const { data, error } = await getSupabase().rpc('v12p2_register_warranty', {
    p_asset_id: input.assetId,
    p_customer_id: input.customerId ?? null,
    p_start_date: input.startDate,
    p_end_date: input.endDate,
    p_coverage_type: input.coverageType,
    p_engineer_service_months: input.engineerServiceMonths ?? 12,
    p_covered_parts: input.coveredParts ?? ['Mainboard', 'Headboard', 'Servo Motor', 'Driver'],
    p_excluded_parts: input.excludedParts ?? ['Printhead', 'Small spare parts', 'Consumables'],
    p_terms: input.terms ?? null,
  });
  return unwrap(data as WarrantyRegistrationRecord | null, error, 'Warranty registration failed.');
}

export async function scanSlaBreaches(): Promise<number> {
  const { data, error } = await getSupabase().rpc('v12p2_scan_sla_breaches');
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}
