import { getSupabase } from '@/lib/supabaseClient';

export type ServiceCaseStatus =
  | 'new' | 'verified' | 'assigned' | 'accepted' | 'travelling' | 'arrived'
  | 'checked_in' | 'diagnosis' | 'work_started' | 'waiting_parts'
  | 'waiting_customer' | 'sent_supplier' | 'work_resumed' | 'completed'
  | 'customer_confirmed' | 'closed' | 'reopened' | 'cancelled'
  | 'escalated' | 'sla_breached';

export interface WarrantyRegistration {
  id: string;
  warranty_no: string;
  customer_id?: string | null;
  product_id?: string | null;
  invoice_id?: string | null;
  machine_serial: string;
  machine_model: string;
  machine_name?: string | null;
  sale_date?: string | null;
  installation_date?: string | null;
  warranty_start: string;
  warranty_end: string;
  engineer_service_end?: string | null;
  coverage: string[];
  exclusions: string[];
  terms?: string | null;
  status: 'draft' | 'active' | 'expired' | 'void' | 'transferred';
  created_at: string;
  updated_at: string;
}

export interface WarrantyCheckResult {
  warranty_id: string;
  warranty_no: string;
  machine_serial: string;
  machine_model: string;
  validity: 'valid' | 'expired' | 'void' | 'not_started' | string;
  warranty_start: string;
  warranty_end: string;
  remaining_days: number;
  coverage: string[];
  exclusions: string[];
}

export interface ServiceCase {
  id: string;
  case_no: string;
  legacy_ticket_id?: string | null;
  warranty_id?: string | null;
  customer_id?: string | null;
  product_id?: string | null;
  machine_serial?: string | null;
  machine_model?: string | null;
  customer_name: string;
  customer_phone?: string | null;
  service_address?: string | null;
  subject: string;
  problem_description: string;
  problem_category?: string | null;
  service_type: 'onsite' | 'remote' | 'office_repair' | 'supplier_repair' | 'installation' | 'training' | 'preventive_maintenance';
  warranty_status: 'unknown' | 'in_warranty' | 'out_warranty' | 'void' | 'pending_verification';
  billing_status: 'pending' | 'warranty' | 'free' | 'chargeable' | 'quoted' | 'approved' | 'invoiced' | 'paid' | 'waived';
  priority: 'low' | 'normal' | 'high' | 'urgent' | 'emergency';
  status: ServiceCaseStatus;
  assigned_engineer_id?: string | null;
  service_manager_id?: string | null;
  scheduled_at?: string | null;
  response_due_at?: string | null;
  arrival_due_at?: string | null;
  resolution_due_at?: string | null;
  accepted_at?: string | null;
  travel_started_at?: string | null;
  arrived_at?: string | null;
  work_started_at?: string | null;
  completed_at?: string | null;
  customer_confirmed_at?: string | null;
  closed_at?: string | null;
  follow_up_at?: string | null;
  diagnosis?: string | null;
  work_performed?: string | null;
  pending_issue?: string | null;
  resolution_summary?: string | null;
  customer_rating?: number | null;
  customer_comment?: string | null;
  labour_cost: number;
  parts_cost: number;
  transport_cost: number;
  other_cost: number;
  chargeable_amount: number;
  source: string;
  created_at: string;
  updated_at: string;
}

export interface SlaAlert {
  id: string;
  service_case_id: string;
  metric: 'response' | 'arrival' | 'resolution' | 'confirmation' | 'closure';
  severity: 'warning' | 'near_breach' | 'breached' | 'critical';
  target_at: string;
  detected_at: string;
  acknowledged_by?: string | null;
  acknowledged_at?: string | null;
  resolved_at?: string | null;
  message: string;
  metadata: Record<string, unknown>;
}

export interface PartsRequest {
  id: string;
  request_no: string;
  ticket_id?: string | null;
  visit_id?: string | null;
  requested_by: string;
  assigned_store_user_id?: string | null;
  urgency: 'low' | 'normal' | 'high' | 'urgent' | 'emergency';
  request_type: 'service' | 'warranty' | 'replacement' | 'internal_repair';
  status: string;
  reason: string;
  required_at?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PartsRequestItem {
  id: string;
  request_id: string;
  product_id?: string | null;
  sku?: string | null;
  product_name: string;
  model?: string | null;
  identification_no?: string | null;
  requested_qty: number;
  approved_qty: number;
  dispatched_qty: number;
  received_qty: number;
  installed_qty: number;
  billing_type: 'warranty' | 'free' | 'chargeable';
  damaged_part_serial?: string | null;
  note?: string | null;
}

export interface PartsReservation {
  id: string;
  request_item_id: string;
  warehouse_id?: string | null;
  reserved_qty: number;
  released_qty: number;
  consumed_qty: number;
  status: 'active' | 'partially_consumed' | 'consumed' | 'released' | 'cancelled';
  reserved_by?: string | null;
  reserved_at: string;
  expires_at?: string | null;
  note?: string | null;
}

export interface PartsDispatch {
  id: string;
  dispatch_no: string;
  request_id: string;
  source_warehouse_id?: string | null;
  destination: string;
  receiver_user_id?: string | null;
  courier_name?: string | null;
  tracking_no?: string | null;
  transport_type?: string | null;
  status: string;
  package_count: number;
  delivery_charge: number;
  dispatched_at?: string | null;
  expected_delivery_at?: string | null;
  delivered_at?: string | null;
  received_at?: string | null;
  created_at: string;
}

export interface PartsDispatchItem {
  id: string;
  dispatch_id: string;
  request_item_id: string;
  quantity: number;
  serial_numbers: string[];
  condition_at_dispatch?: string | null;
  condition_at_receipt?: string | null;
}

export interface OfficeTask {
  id: string;
  task_no: string;
  title: string;
  description?: string | null;
  module: string;
  related_entity_type?: string | null;
  related_entity_id?: string | null;
  department?: string | null;
  assigned_to?: string | null;
  assigned_by?: string | null;
  priority: 'low' | 'normal' | 'high' | 'urgent' | 'emergency';
  status: 'new' | 'accepted' | 'in_progress' | 'waiting' | 'completed' | 'cancelled' | 'rejected' | 'overdue';
  start_at?: string | null;
  due_at?: string | null;
  follow_up_at?: string | null;
  completed_at?: string | null;
  completion_note?: string | null;
  progress_percent: number;
  created_at: string;
  updated_at: string;
}

export interface ImportOrder {
  id: string;
  import_no: string;
  supplier_id?: string | null;
  supplier_name: string;
  purchase_order_no?: string | null;
  pi_no?: string | null;
  transaction_type: 'LC' | 'TT' | 'CASH' | 'CREDIT';
  lc_no?: string | null;
  lc_open_date?: string | null;
  lc_expiry_date?: string | null;
  currency: string;
  exchange_rate: number;
  goods_value_foreign: number;
  goods_value_bdt: number;
  advance_required: number;
  production_payment_required: number;
  shipment_payment_required: number;
  total_paid_foreign: number;
  bank_charge_bdt: number;
  amendment_charge_bdt: number;
  status: string;
  production_start_date?: string | null;
  production_complete_date?: string | null;
  expected_ship_date?: string | null;
  expected_arrival_date?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Shipment {
  id: string;
  shipment_no: string;
  import_order_id: string;
  shipment_mode: 'SEA' | 'AIR' | 'ROAD' | 'COURIER' | 'DOOR_TO_DOOR' | 'WITH_MACHINE';
  carrier_name?: string | null;
  vessel_flight_no?: string | null;
  booking_no?: string | null;
  bl_awb_no?: string | null;
  container_no?: string | null;
  origin?: string | null;
  destination?: string | null;
  etd?: string | null;
  eta?: string | null;
  status: string;
  delay_reason?: string | null;
  tracking_url?: string | null;
  created_at: string;
  updated_at: string;
}

export interface TruckingJob {
  id: string;
  trucking_no: string;
  shipment_id?: string | null;
  import_order_id?: string | null;
  trucking_type: 'CHINA_PICKUP' | 'PORT_TO_WAREHOUSE' | 'WAREHOUSE_TRANSFER' | 'CUSTOMER_DELIVERY' | 'WARRANTY_PARTS' | 'OTHER';
  transporter_name?: string | null;
  driver_name?: string | null;
  driver_phone?: string | null;
  vehicle_no?: string | null;
  pickup_location: string;
  delivery_location: string;
  pickup_at?: string | null;
  expected_delivery_at?: string | null;
  delivered_at?: string | null;
  transport_cost: number;
  status: string;
  proof_storage_path?: string | null;
  receiver_name?: string | null;
  receiver_phone?: string | null;
  note?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Holiday {
  id: string;
  holiday_date: string;
  name: string;
  holiday_type: 'government' | 'company' | 'optional' | 'regional';
  region?: string | null;
  paid: boolean;
  active: boolean;
}

export interface LeaveType {
  id: string;
  code: string;
  name: string;
  annual_quota: number;
  paid: boolean;
  carry_forward: boolean;
  max_carry_forward: number;
  requires_attachment: boolean;
  active: boolean;
}

export interface LeaveRequest {
  id: string;
  request_no: string;
  employee_id: string;
  leave_type_id: string;
  start_date: string;
  end_date: string;
  total_days: number;
  reason: string;
  attachment_path?: string | null;
  emergency_contact?: string | null;
  handover_to?: string | null;
  handover_note?: string | null;
  status: 'draft' | 'submitted' | 'manager_approved' | 'hr_approved' | 'approved' | 'rejected' | 'cancelled' | 'taken' | 'closed';
  manager_id?: string | null;
  manager_note?: string | null;
  hr_id?: string | null;
  hr_note?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PayrollPeriod {
  id: string;
  period_code: string;
  period_name: string;
  start_date: string;
  end_date: string;
  pay_date?: string | null;
  status: 'draft' | 'attendance_locked' | 'calculated' | 'reviewed' | 'approved' | 'paid' | 'closed' | 'cancelled';
  created_at: string;
  updated_at: string;
}

export interface PayrollEntry {
  id: string;
  payroll_period_id: string;
  employee_id: string;
  working_days: number;
  present_days: number;
  paid_leave_days: number;
  unpaid_leave_days: number;
  absent_days: number;
  late_count: number;
  overtime_hours: number;
  basic_salary: number;
  total_allowance: number;
  overtime_amount: number;
  bonus_amount: number;
  gross_salary: number;
  absent_deduction: number;
  late_deduction: number;
  advance_deduction: number;
  loan_deduction: number;
  tax_deduction: number;
  other_deduction: number;
  net_salary: number;
  payment_status: string;
  payment_method?: string | null;
  payment_reference?: string | null;
  paid_at?: string | null;
  note?: string | null;
}

export interface BiometricConnector {
  id: string;
  connector_code: string;
  name: string;
  vendor: string;
  connector_type: 'GENERIC_WEBHOOK' | 'ZK_PUSH_GATEWAY' | 'ZK_TCP_GATEWAY' | 'CSV_IMPORT' | 'REST_API' | 'SDK_GATEWAY';
  endpoint_url?: string | null;
  gateway_identifier?: string | null;
  credential_secret_name?: string | null;
  timezone: string;
  active: boolean;
  last_sync_at?: string | null;
  last_success_at?: string | null;
  last_error?: string | null;
  created_at: string;
  updated_at: string;
}

export interface BiometricDevice {
  id: string;
  connector_id: string;
  device_code: string;
  serial_no?: string | null;
  model?: string | null;
  location_name?: string | null;
  ip_address?: string | null;
  port?: number | null;
  active: boolean;
  last_seen_at?: string | null;
  firmware_version?: string | null;
  metadata: Record<string, unknown>;
}

function ensure<T>(data: T | null, error: { message: string } | null, fallback: string): T {
  if (error) throw new Error(error.message);
  if (data === null) throw new Error(fallback);
  return data;
}

async function listRows<T>(table: string, orderColumn = 'created_at', ascending = false, limit = 500): Promise<T[]> {
  const { data, error } = await getSupabase()
    .from(table)
    .select('*')
    .order(orderColumn, { ascending })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as T[];
}

export const listWarranties = () => listRows<WarrantyRegistration>('v13_warranty_registrations');
export const listServiceCases = () => listRows<ServiceCase>('v13_service_cases');
export const listSlaAlerts = () => listRows<SlaAlert>('v13_sla_alerts', 'target_at', true);
export const listPartsRequests = () => listRows<PartsRequest>('v12_parts_requests');
export const listPartsRequestItems = () => listRows<PartsRequestItem>('v12_parts_request_items');
export const listPartsReservations = () => listRows<PartsReservation>('v13_parts_reservations', 'reserved_at', false);
export const listPartsDispatches = () => listRows<PartsDispatch>('v12_parts_dispatches');
export const listPartsDispatchItems = () => listRows<PartsDispatchItem>('v12_parts_dispatch_items');
export const listOfficeTasks = () => listRows<OfficeTask>('v13_office_tasks');
export const listImportOrders = () => listRows<ImportOrder>('v13_import_orders');
export const listShipments = () => listRows<Shipment>('v13_shipments');
export const listTruckingJobs = () => listRows<TruckingJob>('v13_trucking_jobs');
export const listHolidays = () => listRows<Holiday>('v13_holidays', 'holiday_date', true);
export const listLeaveTypes = () => listRows<LeaveType>('v13_leave_types', 'name', true);
export const listLeaveRequests = () => listRows<LeaveRequest>('v13_leave_requests');
export const listPayrollPeriods = () => listRows<PayrollPeriod>('v13_payroll_periods', 'start_date', false);
export const listPayrollEntries = () => listRows<PayrollEntry>('v13_payroll_entries', 'created_at', false);
export const listBiometricConnectors = () => listRows<BiometricConnector>('v13_biometric_connectors', 'name', true);
export const listBiometricDevices = () => listRows<BiometricDevice>('v13_biometric_devices', 'device_code', true);

export async function checkWarranty(machineSerial: string, checkDate?: string): Promise<WarrantyCheckResult | null> {
  const { data, error } = await getSupabase().rpc('v13_check_warranty', {
    p_machine_serial: machineSerial.trim(),
    p_check_date: checkDate ?? new Date().toISOString().slice(0, 10),
  });
  if (error) throw new Error(error.message);
  return ((data ?? [])[0] as WarrantyCheckResult | undefined) ?? null;
}

export async function registerWarranty(input: {
  customerId?: string;
  productId?: string;
  invoiceId?: string;
  machineSerial: string;
  machineModel: string;
  machineName?: string;
  saleDate?: string;
  installationDate?: string;
  warrantyStart: string;
  warrantyEnd: string;
  engineerServiceEnd?: string;
  coverage?: string[];
  exclusions?: string[];
  terms?: string;
}): Promise<WarrantyRegistration> {
  const { data, error } = await getSupabase().rpc('v13_register_warranty', {
    p_customer_id: input.customerId ?? null,
    p_product_id: input.productId ?? null,
    p_invoice_id: input.invoiceId ?? null,
    p_machine_serial: input.machineSerial.trim(),
    p_machine_model: input.machineModel.trim(),
    p_machine_name: input.machineName?.trim() || null,
    p_sale_date: input.saleDate ?? null,
    p_installation_date: input.installationDate ?? null,
    p_warranty_start: input.warrantyStart,
    p_warranty_end: input.warrantyEnd,
    p_engineer_service_end: input.engineerServiceEnd ?? null,
    p_coverage: input.coverage ?? null,
    p_exclusions: input.exclusions ?? null,
    p_terms: input.terms?.trim() || null,
  });
  return ensure(data as WarrantyRegistration | null, error, 'Warranty could not be registered.');
}

export async function createServiceCase(input: {
  customerId?: string;
  productId?: string;
  machineSerial?: string;
  machineModel?: string;
  customerName: string;
  customerPhone?: string;
  serviceAddress?: string;
  subject: string;
  problemDescription: string;
  problemCategory?: string;
  serviceType: ServiceCase['service_type'];
  priority: ServiceCase['priority'];
  assignedEngineerId?: string;
  scheduledAt?: string;
  responseMinutes?: number;
  arrivalMinutes?: number;
  resolutionMinutes?: number;
  legacyTicketId?: string;
  source?: string;
}): Promise<ServiceCase> {
  const { data, error } = await getSupabase().rpc('v13_create_service_case', {
    p_customer_id: input.customerId ?? null,
    p_product_id: input.productId ?? null,
    p_machine_serial: input.machineSerial?.trim() || null,
    p_machine_model: input.machineModel?.trim() || null,
    p_customer_name: input.customerName.trim(),
    p_customer_phone: input.customerPhone?.trim() || null,
    p_service_address: input.serviceAddress?.trim() || null,
    p_subject: input.subject.trim(),
    p_problem_description: input.problemDescription.trim(),
    p_problem_category: input.problemCategory?.trim() || null,
    p_service_type: input.serviceType,
    p_priority: input.priority,
    p_assigned_engineer_id: input.assignedEngineerId ?? null,
    p_scheduled_at: input.scheduledAt ?? null,
    p_response_minutes: input.responseMinutes ?? 30,
    p_arrival_minutes: input.arrivalMinutes ?? 240,
    p_resolution_minutes: input.resolutionMinutes ?? 1440,
    p_legacy_ticket_id: input.legacyTicketId ?? null,
    p_source: input.source ?? 'mobile',
  });
  return ensure(data as ServiceCase | null, error, 'Service case could not be created.');
}

export async function transitionServiceCase(input: {
  serviceCaseId: string;
  newStatus: ServiceCaseStatus;
  note?: string;
  latitude?: number;
  longitude?: number;
  accuracyM?: number;
  idempotencyKey?: string;
}): Promise<ServiceCase> {
  const { data, error } = await getSupabase().rpc('v13_transition_service_case', {
    p_service_case_id: input.serviceCaseId,
    p_new_status: input.newStatus,
    p_note: input.note ?? null,
    p_latitude: input.latitude ?? null,
    p_longitude: input.longitude ?? null,
    p_accuracy_m: input.accuracyM ?? null,
    p_idempotency_key: input.idempotencyKey ?? null,
  });
  return ensure(data as ServiceCase | null, error, 'Service case transition failed.');
}

export async function refreshSlaAlerts(): Promise<number> {
  const { data, error } = await getSupabase().rpc('v13_refresh_sla_alerts');
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}

export async function acknowledgeSlaAlert(alertId: string): Promise<void> {
  const { data: auth } = await getSupabase().auth.getUser();
  if (!auth.user) throw new Error('Authentication required.');
  const { error } = await getSupabase()
    .from('v13_sla_alerts')
    .update({ acknowledged_by: auth.user.id, acknowledged_at: new Date().toISOString() })
    .eq('id', alertId);
  if (error) throw new Error(error.message);
}

export async function approvePartsRequest(requestId: string, items: Array<{ requestItemId: string; approvedQty: number; note?: string }>, note?: string): Promise<PartsRequest> {
  const { data, error } = await getSupabase().rpc('v13_approve_parts_request', {
    p_request_id: requestId,
    p_items: items.map(item => ({ request_item_id: item.requestItemId, approved_qty: item.approvedQty, note: item.note ?? null })),
    p_note: note ?? null,
  });
  return ensure(data as PartsRequest | null, error, 'Parts request approval failed.');
}

export async function reservePart(input: { requestItemId: string; warehouseId?: string; quantity: number; expiresAt?: string; note?: string }): Promise<PartsReservation> {
  const { data, error } = await getSupabase().rpc('v13_reserve_part', {
    p_request_item_id: input.requestItemId,
    p_warehouse_id: input.warehouseId ?? null,
    p_quantity: input.quantity,
    p_expires_at: input.expiresAt ?? null,
    p_note: input.note ?? null,
  });
  return ensure(data as PartsReservation | null, error, 'Part reservation failed.');
}

export async function createPartsDispatch(input: {
  requestId: string;
  sourceWarehouseId?: string;
  destination: string;
  receiverUserId?: string;
  courierName?: string;
  trackingNo?: string;
  transportType?: string;
  deliveryCharge?: number;
  expectedDeliveryAt?: string;
  items: Array<{ requestItemId: string; quantity: number; serialNumbers?: string[]; conditionAtDispatch?: string }>;
}): Promise<PartsDispatch> {
  const { data, error } = await getSupabase().rpc('v13_create_parts_dispatch', {
    p_request_id: input.requestId,
    p_source_warehouse_id: input.sourceWarehouseId ?? null,
    p_destination: input.destination.trim(),
    p_receiver_user_id: input.receiverUserId ?? null,
    p_courier_name: input.courierName?.trim() || null,
    p_tracking_no: input.trackingNo?.trim() || null,
    p_transport_type: input.transportType?.trim() || null,
    p_delivery_charge: input.deliveryCharge ?? 0,
    p_expected_delivery_at: input.expectedDeliveryAt ?? null,
    p_items: input.items.map(item => ({
      request_item_id: item.requestItemId,
      quantity: item.quantity,
      serial_numbers: item.serialNumbers ?? [],
      condition_at_dispatch: item.conditionAtDispatch ?? null,
    })),
  });
  return ensure(data as PartsDispatch | null, error, 'Parts dispatch failed.');
}

export async function receivePartsDispatch(input: {
  dispatchId: string;
  conditionSummary?: string;
  proofStoragePath?: string;
  receiverSignaturePath?: string;
  items: Array<{ dispatchItemId: string; receivedQty: number; damagedQty?: number; shortQty?: number; conditionAtReceipt?: string; serialNumbers?: string[]; note?: string }>;
  note?: string;
}): Promise<Record<string, unknown>> {
  const { data, error } = await getSupabase().rpc('v13_receive_parts_dispatch', {
    p_dispatch_id: input.dispatchId,
    p_condition_summary: input.conditionSummary ?? null,
    p_proof_storage_path: input.proofStoragePath ?? null,
    p_receiver_signature_path: input.receiverSignaturePath ?? null,
    p_items: input.items.map(item => ({
      dispatch_item_id: item.dispatchItemId,
      received_qty: item.receivedQty,
      damaged_qty: item.damagedQty ?? 0,
      short_qty: item.shortQty ?? 0,
      condition_at_receipt: item.conditionAtReceipt ?? null,
      serial_numbers: item.serialNumbers ?? [],
      note: item.note ?? null,
    })),
    p_note: input.note ?? null,
  });
  return ensure(data as Record<string, unknown> | null, error, 'Dispatch receipt failed.');
}

export async function createOfficeTask(input: {
  title: string;
  description?: string;
  module?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  department?: string;
  assignedTo?: string;
  priority: OfficeTask['priority'];
  startAt?: string;
  dueAt?: string;
  followUpAt?: string;
}): Promise<OfficeTask> {
  const { data, error } = await getSupabase().rpc('v13_create_office_task', {
    p_title: input.title.trim(),
    p_description: input.description?.trim() || null,
    p_module: input.module ?? 'general',
    p_related_entity_type: input.relatedEntityType ?? null,
    p_related_entity_id: input.relatedEntityId ?? null,
    p_department: input.department ?? null,
    p_assigned_to: input.assignedTo ?? null,
    p_priority: input.priority,
    p_start_at: input.startAt ?? null,
    p_due_at: input.dueAt ?? null,
    p_follow_up_at: input.followUpAt ?? null,
  });
  return ensure(data as OfficeTask | null, error, 'Office task could not be created.');
}

export async function transitionOfficeTask(input: { taskId: string; newStatus: OfficeTask['status']; progressPercent?: number; comment?: string; idempotencyKey?: string }): Promise<OfficeTask> {
  const { data, error } = await getSupabase().rpc('v13_transition_office_task', {
    p_task_id: input.taskId,
    p_new_status: input.newStatus,
    p_progress_percent: input.progressPercent ?? null,
    p_comment: input.comment ?? null,
    p_idempotency_key: input.idempotencyKey ?? null,
  });
  return ensure(data as OfficeTask | null, error, 'Task update failed.');
}

export async function createImportOrder(input: Omit<ImportOrder, 'id' | 'import_no' | 'goods_value_bdt' | 'total_paid_foreign' | 'status' | 'created_at' | 'updated_at'> & { status?: string }): Promise<ImportOrder> {
  const importNo = `CJ-IMP-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const { data, error } = await getSupabase().from('v13_import_orders').insert({
    import_no: importNo,
    supplier_id: input.supplier_id ?? null,
    supplier_name: input.supplier_name.trim(),
    purchase_order_no: input.purchase_order_no ?? null,
    pi_no: input.pi_no ?? null,
    transaction_type: input.transaction_type,
    lc_no: input.lc_no ?? null,
    lc_open_date: input.lc_open_date ?? null,
    lc_expiry_date: input.lc_expiry_date ?? null,
    currency: input.currency,
    exchange_rate: input.exchange_rate,
    goods_value_foreign: input.goods_value_foreign,
    advance_required: input.advance_required,
    production_payment_required: input.production_payment_required,
    shipment_payment_required: input.shipment_payment_required,
    bank_charge_bdt: input.bank_charge_bdt,
    amendment_charge_bdt: input.amendment_charge_bdt,
    status: input.status ?? 'draft',
    production_start_date: input.production_start_date ?? null,
    production_complete_date: input.production_complete_date ?? null,
    expected_ship_date: input.expected_ship_date ?? null,
    expected_arrival_date: input.expected_arrival_date ?? null,
    notes: input.notes ?? null,
  }).select('*').single();
  return ensure(data as ImportOrder | null, error, 'Import order could not be created.');
}

export async function updateShipmentStatus(input: { shipmentId: string; status: string; eventTime?: string; location?: string; note?: string; latitude?: number; longitude?: number }): Promise<Shipment> {
  const { data, error } = await getSupabase().rpc('v13_update_shipment_status', {
    p_shipment_id: input.shipmentId,
    p_status: input.status,
    p_event_time: input.eventTime ?? new Date().toISOString(),
    p_location: input.location ?? null,
    p_note: input.note ?? null,
    p_latitude: input.latitude ?? null,
    p_longitude: input.longitude ?? null,
  });
  return ensure(data as Shipment | null, error, 'Shipment update failed.');
}

export async function updateTruckingStatus(input: { truckingJobId: string; status: string; eventTime?: string; location?: string; note?: string; latitude?: number; longitude?: number; proofStoragePath?: string; receiverName?: string; receiverPhone?: string }): Promise<TruckingJob> {
  const { data, error } = await getSupabase().rpc('v13_update_trucking_status', {
    p_trucking_job_id: input.truckingJobId,
    p_status: input.status,
    p_event_time: input.eventTime ?? new Date().toISOString(),
    p_location: input.location ?? null,
    p_note: input.note ?? null,
    p_latitude: input.latitude ?? null,
    p_longitude: input.longitude ?? null,
    p_proof_storage_path: input.proofStoragePath ?? null,
    p_receiver_name: input.receiverName ?? null,
    p_receiver_phone: input.receiverPhone ?? null,
  });
  return ensure(data as TruckingJob | null, error, 'Trucking update failed.');
}

export async function submitLeaveRequest(input: { leaveTypeId: string; startDate: string; endDate: string; totalDays: number; reason: string; attachmentPath?: string; emergencyContact?: string; handoverTo?: string; handoverNote?: string }): Promise<LeaveRequest> {
  const { data, error } = await getSupabase().rpc('v13_submit_leave_request', {
    p_leave_type_id: input.leaveTypeId,
    p_start_date: input.startDate,
    p_end_date: input.endDate,
    p_total_days: input.totalDays,
    p_reason: input.reason.trim(),
    p_attachment_path: input.attachmentPath ?? null,
    p_emergency_contact: input.emergencyContact ?? null,
    p_handover_to: input.handoverTo ?? null,
    p_handover_note: input.handoverNote ?? null,
  });
  return ensure(data as LeaveRequest | null, error, 'Leave request could not be submitted.');
}

export async function approveLeaveRequest(leaveRequestId: string, action: 'approve' | 'reject', note?: string): Promise<LeaveRequest> {
  const { data, error } = await getSupabase().rpc('v13_approve_leave_request', {
    p_leave_request_id: leaveRequestId,
    p_action: action,
    p_note: note ?? null,
  });
  return ensure(data as LeaveRequest | null, error, 'Leave approval failed.');
}

export async function createBiometricConnector(input: {
  connectorCode: string;
  name: string;
  vendor: string;
  connectorType: BiometricConnector['connector_type'];
  endpointUrl?: string;
  gatewayIdentifier?: string;
  credentialSecretName?: string;
  timezone?: string;
}): Promise<BiometricConnector> {
  const { data, error } = await getSupabase().from('v13_biometric_connectors').insert({
    connector_code: input.connectorCode.trim().toUpperCase(),
    name: input.name.trim(),
    vendor: input.vendor.trim(),
    connector_type: input.connectorType,
    endpoint_url: input.endpointUrl?.trim() || null,
    gateway_identifier: input.gatewayIdentifier?.trim() || null,
    credential_secret_name: input.credentialSecretName?.trim() || null,
    timezone: input.timezone ?? 'Asia/Dhaka',
  }).select('*').single();
  return ensure(data as BiometricConnector | null, error, 'Biometric connector could not be created.');
}

export async function createBiometricDevice(input: {
  connectorId: string;
  deviceCode: string;
  serialNo?: string;
  model?: string;
  locationName?: string;
  ipAddress?: string;
  port?: number;
}): Promise<BiometricDevice> {
  const { data, error } = await getSupabase().from('v13_biometric_devices').insert({
    connector_id: input.connectorId,
    device_code: input.deviceCode.trim(),
    serial_no: input.serialNo?.trim() || null,
    model: input.model?.trim() || null,
    location_name: input.locationName?.trim() || null,
    ip_address: input.ipAddress?.trim() || null,
    port: input.port ?? null,
  }).select('*').single();
  return ensure(data as BiometricDevice | null, error, 'Biometric device could not be created.');
}
