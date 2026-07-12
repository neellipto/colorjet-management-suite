-- COLORJET ERP V13: Office Tasks, LC/TT Import Logistics, HR and Biometric Connectors

create table if not exists public.v13_office_tasks (
  id uuid primary key default gen_random_uuid(),
  task_no text not null unique,
  title text not null,
  description text,
  module text not null default 'general',
  related_entity_type text,
  related_entity_id uuid,
  department text,
  assigned_to uuid references auth.users(id) on delete set null,
  assigned_by uuid references auth.users(id) on delete set null default auth.uid(),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent','emergency')),
  status text not null default 'new' check (status in ('new','accepted','in_progress','waiting','completed','cancelled','rejected','overdue')),
  start_at timestamptz,
  due_at timestamptz,
  follow_up_at timestamptz,
  completed_at timestamptz,
  completion_note text,
  progress_percent integer not null default 0 check (progress_percent between 0 and 100),
  reminder_minutes integer not null default 60 check (reminder_minutes >= 0),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists v13_office_tasks_assignee_idx on public.v13_office_tasks (assigned_to, status, due_at);
create index if not exists v13_office_tasks_status_idx on public.v13_office_tasks (status, priority, due_at);

create table if not exists public.v13_office_task_events (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.v13_office_tasks(id) on delete cascade,
  event_type text not null,
  from_status text,
  to_status text,
  comment text,
  progress_percent integer,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default timezone('utc', now()),
  idempotency_key text unique
);

create table if not exists public.v13_office_task_attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.v13_office_tasks(id) on delete cascade,
  storage_bucket text not null default 'task-files',
  storage_path text not null,
  file_name text,
  mime_type text,
  uploaded_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.v13_import_orders (
  id uuid primary key default gen_random_uuid(),
  import_no text not null unique,
  supplier_id uuid,
  supplier_name text not null,
  purchase_order_no text,
  pi_no text,
  transaction_type text not null check (transaction_type in ('LC','TT','CASH','CREDIT')),
  lc_no text,
  lc_open_date date,
  lc_expiry_date date,
  currency text not null default 'USD',
  exchange_rate numeric(14,6) not null default 1 check (exchange_rate > 0),
  goods_value_foreign numeric(16,2) not null default 0,
  goods_value_bdt numeric(16,2) generated always as (round(goods_value_foreign * exchange_rate, 2)) stored,
  advance_required numeric(16,2) not null default 0,
  production_payment_required numeric(16,2) not null default 0,
  shipment_payment_required numeric(16,2) not null default 0,
  total_paid_foreign numeric(16,2) not null default 0,
  bank_charge_bdt numeric(16,2) not null default 0,
  amendment_charge_bdt numeric(16,2) not null default 0,
  status text not null default 'draft' check (status in (
    'draft','pi_received','approval_pending','approved','advance_paid','production',
    'production_complete','shipment_payment_due','shipment_ready','shipped','at_port',
    'customs_clearance','released','warehouse_received','landed_cost_pending','closed','cancelled'
  )),
  production_start_date date,
  production_complete_date date,
  expected_ship_date date,
  expected_arrival_date date,
  notes text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists v13_import_orders_status_idx on public.v13_import_orders (status, expected_arrival_date);
create index if not exists v13_import_orders_supplier_idx on public.v13_import_orders (supplier_id, created_at desc);

create table if not exists public.v13_import_order_items (
  id uuid primary key default gen_random_uuid(),
  import_order_id uuid not null references public.v13_import_orders(id) on delete cascade,
  product_id uuid,
  sku text,
  product_name text not null,
  model text,
  identification_no text,
  quantity numeric(14,3) not null check (quantity > 0),
  unit text not null default 'pcs',
  unit_price_foreign numeric(16,4) not null default 0,
  line_total_foreign numeric(16,2) generated always as (round(quantity * unit_price_foreign, 2)) stored,
  weight_kg numeric(14,3),
  cbm numeric(14,4),
  category text,
  note text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.v13_import_payments (
  id uuid primary key default gen_random_uuid(),
  import_order_id uuid not null references public.v13_import_orders(id) on delete restrict,
  payment_no text not null unique,
  payment_stage text not null check (payment_stage in ('advance','production','before_shipment','balance','freight','bank_charge','amendment','other')),
  payment_method text not null check (payment_method in ('LC','TT','BANK','CASH','CARD','OTHER')),
  amount_foreign numeric(16,2) not null default 0,
  currency text not null default 'USD',
  exchange_rate numeric(14,6) not null default 1,
  amount_bdt numeric(16,2) generated always as (round(amount_foreign * exchange_rate, 2)) stored,
  bank_name text,
  reference_no text,
  payment_date date not null,
  attachment_path text,
  note text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.v13_shipments (
  id uuid primary key default gen_random_uuid(),
  shipment_no text not null unique,
  import_order_id uuid not null references public.v13_import_orders(id) on delete restrict,
  shipment_mode text not null check (shipment_mode in ('SEA','AIR','ROAD','COURIER','DOOR_TO_DOOR','WITH_MACHINE')),
  carrier_name text,
  vessel_flight_no text,
  booking_no text,
  bl_awb_no text,
  container_no text,
  seal_no text,
  origin text,
  destination text,
  port_of_loading text,
  port_of_discharge text,
  etd date,
  eta date,
  actual_departure_at timestamptz,
  actual_arrival_at timestamptz,
  freight_cost_foreign numeric(16,2) not null default 0,
  freight_currency text not null default 'USD',
  status text not null default 'booking' check (status in ('booking','pickup_pending','picked_up','at_origin_warehouse','customs_origin','departed','in_transit','transshipment','arrived_port','customs_destination','released','truck_assigned','warehouse_delivered','closed','delayed','cancelled')),
  delay_reason text,
  tracking_url text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists v13_shipments_status_idx on public.v13_shipments (status, eta);

create table if not exists public.v13_shipment_events (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references public.v13_shipments(id) on delete cascade,
  event_type text not null,
  status text,
  event_time timestamptz not null default timezone('utc', now()),
  location text,
  latitude double precision,
  longitude double precision,
  note text,
  source text not null default 'manual' check (source in ('manual','carrier_api','email','webhook','system')),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.v13_trucking_jobs (
  id uuid primary key default gen_random_uuid(),
  trucking_no text not null unique,
  shipment_id uuid references public.v13_shipments(id) on delete set null,
  import_order_id uuid references public.v13_import_orders(id) on delete set null,
  trucking_type text not null check (trucking_type in ('CHINA_PICKUP','PORT_TO_WAREHOUSE','WAREHOUSE_TRANSFER','CUSTOMER_DELIVERY','WARRANTY_PARTS','OTHER')),
  transporter_name text,
  driver_name text,
  driver_phone text,
  vehicle_no text,
  pickup_location text not null,
  delivery_location text not null,
  pickup_at timestamptz,
  expected_delivery_at timestamptz,
  delivered_at timestamptz,
  transport_cost numeric(14,2) not null default 0,
  status text not null default 'planned' check (status in ('planned','assigned','pickup_started','picked_up','in_transit','checkpoint','delayed','arrived','delivered','proof_received','closed','cancelled')),
  proof_storage_path text,
  receiver_name text,
  receiver_phone text,
  note text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.v13_trucking_events (
  id uuid primary key default gen_random_uuid(),
  trucking_job_id uuid not null references public.v13_trucking_jobs(id) on delete cascade,
  status text not null,
  event_time timestamptz not null default timezone('utc', now()),
  location text,
  latitude double precision,
  longitude double precision,
  note text,
  proof_storage_path text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.v13_holidays (
  id uuid primary key default gen_random_uuid(),
  holiday_date date not null,
  name text not null,
  holiday_type text not null default 'company' check (holiday_type in ('government','company','optional','regional')),
  region text,
  paid boolean not null default true,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default timezone('utc', now()),
  unique (holiday_date, name)
);

create table if not exists public.v13_leave_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  annual_quota numeric(8,2) not null default 0,
  paid boolean not null default true,
  carry_forward boolean not null default false,
  max_carry_forward numeric(8,2) not null default 0,
  requires_attachment boolean not null default false,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.v13_leave_requests (
  id uuid primary key default gen_random_uuid(),
  request_no text not null unique,
  employee_id uuid not null references auth.users(id) on delete restrict,
  leave_type_id uuid not null references public.v13_leave_types(id) on delete restrict,
  start_date date not null,
  end_date date not null,
  total_days numeric(8,2) not null check (total_days > 0),
  reason text not null,
  attachment_path text,
  emergency_contact text,
  handover_to uuid references auth.users(id) on delete set null,
  handover_note text,
  status text not null default 'submitted' check (status in ('draft','submitted','manager_approved','hr_approved','approved','rejected','cancelled','taken','closed')),
  manager_id uuid references auth.users(id) on delete set null,
  manager_note text,
  manager_action_at timestamptz,
  hr_id uuid references auth.users(id) on delete set null,
  hr_note text,
  hr_action_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (end_date >= start_date)
);

create index if not exists v13_leave_requests_employee_idx on public.v13_leave_requests (employee_id, start_date desc);
create index if not exists v13_leave_requests_status_idx on public.v13_leave_requests (status, start_date);

create table if not exists public.v13_payroll_periods (
  id uuid primary key default gen_random_uuid(),
  period_code text not null unique,
  period_name text not null,
  start_date date not null,
  end_date date not null,
  pay_date date,
  status text not null default 'draft' check (status in ('draft','attendance_locked','calculated','reviewed','approved','paid','closed','cancelled')),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (end_date >= start_date)
);

create table if not exists public.v13_employee_salary_profiles (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null unique references auth.users(id) on delete cascade,
  basic_salary numeric(14,2) not null default 0,
  house_rent numeric(14,2) not null default 0,
  medical_allowance numeric(14,2) not null default 0,
  conveyance_allowance numeric(14,2) not null default 0,
  mobile_allowance numeric(14,2) not null default 0,
  other_allowance numeric(14,2) not null default 0,
  overtime_rate_hourly numeric(14,4) not null default 0,
  late_deduction_rate numeric(14,4) not null default 0,
  absent_deduction_daily numeric(14,4) not null default 0,
  bank_account_name text,
  bank_account_no text,
  bank_name text,
  mobile_finance_no text,
  active boolean not null default true,
  effective_from date not null default current_date,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.v13_payroll_entries (
  id uuid primary key default gen_random_uuid(),
  payroll_period_id uuid not null references public.v13_payroll_periods(id) on delete cascade,
  employee_id uuid not null references auth.users(id) on delete restrict,
  working_days numeric(8,2) not null default 0,
  present_days numeric(8,2) not null default 0,
  paid_leave_days numeric(8,2) not null default 0,
  unpaid_leave_days numeric(8,2) not null default 0,
  absent_days numeric(8,2) not null default 0,
  late_count integer not null default 0,
  overtime_hours numeric(10,2) not null default 0,
  basic_salary numeric(14,2) not null default 0,
  total_allowance numeric(14,2) not null default 0,
  overtime_amount numeric(14,2) not null default 0,
  bonus_amount numeric(14,2) not null default 0,
  gross_salary numeric(14,2) generated always as (round(basic_salary + total_allowance + overtime_amount + bonus_amount,2)) stored,
  absent_deduction numeric(14,2) not null default 0,
  late_deduction numeric(14,2) not null default 0,
  advance_deduction numeric(14,2) not null default 0,
  loan_deduction numeric(14,2) not null default 0,
  tax_deduction numeric(14,2) not null default 0,
  other_deduction numeric(14,2) not null default 0,
  net_salary numeric(14,2) generated always as (round((basic_salary + total_allowance + overtime_amount + bonus_amount) - (absent_deduction + late_deduction + advance_deduction + loan_deduction + tax_deduction + other_deduction),2)) stored,
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid','approved','processing','paid','held','cancelled')),
  payment_method text,
  payment_reference text,
  paid_at timestamptz,
  note text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (payroll_period_id, employee_id)
);

create table if not exists public.v13_biometric_connectors (
  id uuid primary key default gen_random_uuid(),
  connector_code text not null unique,
  name text not null,
  vendor text not null,
  connector_type text not null check (connector_type in ('GENERIC_WEBHOOK','ZK_PUSH_GATEWAY','ZK_TCP_GATEWAY','CSV_IMPORT','REST_API','SDK_GATEWAY')),
  endpoint_url text,
  gateway_identifier text,
  credential_secret_name text,
  timezone text not null default 'Asia/Dhaka',
  active boolean not null default true,
  last_sync_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.v13_biometric_devices (
  id uuid primary key default gen_random_uuid(),
  connector_id uuid not null references public.v13_biometric_connectors(id) on delete cascade,
  device_code text not null,
  serial_no text,
  model text,
  location_name text,
  ip_address inet,
  port integer,
  active boolean not null default true,
  last_seen_at timestamptz,
  firmware_version text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (connector_id, device_code)
);

create table if not exists public.v13_biometric_employee_mappings (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.v13_biometric_devices(id) on delete cascade,
  device_user_code text not null,
  employee_id uuid not null references auth.users(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  unique (device_id, device_user_code)
);

create table if not exists public.v13_biometric_events (
  id uuid primary key default gen_random_uuid(),
  device_id uuid references public.v13_biometric_devices(id) on delete set null,
  connector_id uuid references public.v13_biometric_connectors(id) on delete set null,
  employee_id uuid references auth.users(id) on delete set null,
  device_user_code text not null,
  event_time timestamptz not null,
  event_type text not null default 'punch' check (event_type in ('punch','check_in','check_out','break_start','break_end','unknown')),
  verify_mode text,
  work_code text,
  device_event_id text,
  raw_payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default timezone('utc', now()),
  processed boolean not null default false,
  processing_error text,
  idempotency_key text not null unique
);

create index if not exists v13_biometric_events_employee_idx on public.v13_biometric_events (employee_id, event_time desc);
create index if not exists v13_biometric_events_unprocessed_idx on public.v13_biometric_events (received_at) where processed=false;

create table if not exists public.v13_biometric_sync_runs (
  id uuid primary key default gen_random_uuid(),
  connector_id uuid not null references public.v13_biometric_connectors(id) on delete cascade,
  started_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz,
  status text not null default 'running' check (status in ('running','success','partial','failed','cancelled')),
  fetched_count integer not null default 0,
  inserted_count integer not null default 0,
  duplicate_count integer not null default 0,
  error_count integer not null default 0,
  error_message text,
  metadata jsonb not null default '{}'::jsonb
);

create or replace function public.v13_create_office_task(
  p_title text,
  p_description text,
  p_module text,
  p_related_entity_type text,
  p_related_entity_id uuid,
  p_department text,
  p_assigned_to uuid,
  p_priority text,
  p_start_at timestamptz,
  p_due_at timestamptz,
  p_follow_up_at timestamptz
)
returns public.v13_office_tasks
language plpgsql security definer set search_path=public
as $$
declare v_row public.v13_office_tasks; v_no text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.v12_has_role(array['owner','super_admin','admin','manager','service_manager','accounts','sales','store','engineer'])) then raise exception 'Not authorized'; end if;
  if nullif(trim(p_title),'') is null then raise exception 'Task title is required'; end if;
  if p_priority not in ('low','normal','high','urgent','emergency') then raise exception 'Invalid priority'; end if;
  if p_due_at is not null and p_start_at is not null and p_due_at < p_start_at then raise exception 'Due date cannot be before start date'; end if;
  v_no := 'CJ-TSK-'||to_char(timezone('utc',now()),'YYYYMMDDHH24MISS')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,5));
  insert into public.v13_office_tasks(task_no,title,description,module,related_entity_type,related_entity_id,department,assigned_to,assigned_by,priority,status,start_at,due_at,follow_up_at,created_by)
  values(v_no,trim(p_title),nullif(trim(p_description),''),coalesce(nullif(trim(p_module),''),'general'),nullif(trim(p_related_entity_type),''),p_related_entity_id,nullif(trim(p_department),''),p_assigned_to,auth.uid(),p_priority,'new',p_start_at,p_due_at,p_follow_up_at,auth.uid()) returning * into v_row;
  insert into public.v13_office_task_events(task_id,event_type,to_status,comment,created_by) values(v_row.id,'created','new','Task created',auth.uid());
  return v_row;
end; $$;

create or replace function public.v13_transition_office_task(
  p_task_id uuid,
  p_new_status text,
  p_progress_percent integer default null,
  p_comment text default null,
  p_idempotency_key text default null
)
returns public.v13_office_tasks
language plpgsql security definer set search_path=public
as $$
declare v_task public.v13_office_tasks; v_old text; v_allowed boolean:=false;
begin
  select * into v_task from public.v13_office_tasks where id=p_task_id for update;
  if not found then raise exception 'Task not found'; end if;
  if v_task.assigned_to<>auth.uid() and v_task.assigned_by<>auth.uid() and not public.v12_has_role(array['owner','super_admin','admin','manager']) then raise exception 'Not authorized'; end if;
  v_old:=v_task.status;
  v_allowed:=case v_old
    when 'new' then p_new_status=any(array['accepted','rejected','cancelled'])
    when 'accepted' then p_new_status=any(array['in_progress','waiting','cancelled'])
    when 'in_progress' then p_new_status=any(array['waiting','completed','cancelled'])
    when 'waiting' then p_new_status=any(array['in_progress','completed','cancelled'])
    when 'overdue' then p_new_status=any(array['in_progress','waiting','completed','cancelled'])
    else false end;
  if p_new_status<>v_old and not v_allowed then raise exception 'Invalid task transition: % -> %',v_old,p_new_status; end if;
  update public.v13_office_tasks set status=p_new_status,
    progress_percent=case when p_new_status='completed' then 100 else coalesce(p_progress_percent,progress_percent) end,
    completed_at=case when p_new_status='completed' then coalesce(completed_at,timezone('utc',now())) else completed_at end,
    completion_note=case when p_new_status='completed' then coalesce(nullif(trim(p_comment),''),completion_note) else completion_note end
  where id=p_task_id returning * into v_task;
  insert into public.v13_office_task_events(task_id,event_type,from_status,to_status,comment,progress_percent,created_by,idempotency_key)
  values(p_task_id,'status_transition',v_old,p_new_status,p_comment,v_task.progress_percent,auth.uid(),p_idempotency_key) on conflict(idempotency_key) do nothing;
  return v_task;
end; $$;

create or replace function public.v13_mark_overdue_tasks()
returns integer language plpgsql security definer set search_path=public
as $$ declare v_count integer; begin
  update public.v13_office_tasks set status='overdue'
  where status in ('new','accepted','in_progress','waiting') and due_at is not null and due_at<timezone('utc',now());
  get diagnostics v_count=row_count; return v_count;
end; $$;

create or replace function public.v13_record_import_payment(
  p_import_order_id uuid,
  p_payment_stage text,
  p_payment_method text,
  p_amount_foreign numeric,
  p_currency text,
  p_exchange_rate numeric,
  p_bank_name text,
  p_reference_no text,
  p_payment_date date,
  p_attachment_path text,
  p_note text
)
returns public.v13_import_payments
language plpgsql security definer set search_path=public
as $$
declare v_row public.v13_import_payments; v_no text; v_total numeric;
begin
  if not public.v12_has_role(array['owner','super_admin','admin','manager','accounts','commercial'])) then raise exception 'Not authorized'; end if;
  if p_amount_foreign<=0 then raise exception 'Payment amount must be greater than zero'; end if;
  v_no:='CJ-IMP-PAY-'||to_char(timezone('utc',now()),'YYYYMMDDHH24MISS')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,5));
  insert into public.v13_import_payments(import_order_id,payment_no,payment_stage,payment_method,amount_foreign,currency,exchange_rate,bank_name,reference_no,payment_date,attachment_path,note,created_by)
  values(p_import_order_id,v_no,p_payment_stage,p_payment_method,p_amount_foreign,coalesce(nullif(trim(p_currency),''),'USD'),greatest(p_exchange_rate,0.000001),nullif(trim(p_bank_name),''),nullif(trim(p_reference_no),''),p_payment_date,p_attachment_path,p_note,auth.uid()) returning * into v_row;
  select coalesce(sum(amount_foreign),0) into v_total from public.v13_import_payments where import_order_id=p_import_order_id and currency=v_row.currency;
  update public.v13_import_orders set total_paid_foreign=v_total,
    status=case when p_payment_stage='advance' then 'advance_paid' when p_payment_stage='before_shipment' then 'shipment_ready' else status end
  where id=p_import_order_id;
  return v_row;
end; $$;

create or replace function public.v13_update_shipment_status(
  p_shipment_id uuid,
  p_status text,
  p_event_time timestamptz,
  p_location text,
  p_note text,
  p_latitude double precision default null,
  p_longitude double precision default null
)
returns public.v13_shipments
language plpgsql security definer set search_path=public
as $$
declare v_row public.v13_shipments;
begin
  if not public.v12_has_role(array['owner','super_admin','admin','manager','commercial','store','accounts'])) then raise exception 'Not authorized'; end if;
  if p_status not in ('booking','pickup_pending','picked_up','at_origin_warehouse','customs_origin','departed','in_transit','transshipment','arrived_port','customs_destination','released','truck_assigned','warehouse_delivered','closed','delayed','cancelled') then raise exception 'Invalid shipment status'; end if;
  update public.v13_shipments set status=p_status,
    actual_departure_at=case when p_status='departed' then coalesce(actual_departure_at,p_event_time) else actual_departure_at end,
    actual_arrival_at=case when p_status in ('arrived_port','warehouse_delivered','closed') then coalesce(actual_arrival_at,p_event_time) else actual_arrival_at end,
    delay_reason=case when p_status='delayed' then p_note else delay_reason end
  where id=p_shipment_id returning * into v_row;
  if not found then raise exception 'Shipment not found'; end if;
  insert into public.v13_shipment_events(shipment_id,event_type,status,event_time,location,latitude,longitude,note,source,created_by)
  values(p_shipment_id,'status_update',p_status,coalesce(p_event_time,timezone('utc',now())),p_location,p_latitude,p_longitude,p_note,'manual',auth.uid());
  return v_row;
end; $$;

create or replace function public.v13_update_trucking_status(
  p_trucking_job_id uuid,
  p_status text,
  p_event_time timestamptz,
  p_location text,
  p_note text,
  p_latitude double precision default null,
  p_longitude double precision default null,
  p_proof_storage_path text default null,
  p_receiver_name text default null,
  p_receiver_phone text default null
)
returns public.v13_trucking_jobs
language plpgsql security definer set search_path=public
as $$
declare v_row public.v13_trucking_jobs;
begin
  if not public.v12_has_role(array['owner','super_admin','admin','manager','commercial','store','engineer','sales'])) then raise exception 'Not authorized'; end if;
  if p_status not in ('planned','assigned','pickup_started','picked_up','in_transit','checkpoint','delayed','arrived','delivered','proof_received','closed','cancelled') then raise exception 'Invalid trucking status'; end if;
  update public.v13_trucking_jobs set status=p_status,
    pickup_at=case when p_status in ('pickup_started','picked_up') then coalesce(pickup_at,p_event_time) else pickup_at end,
    delivered_at=case when p_status in ('delivered','proof_received','closed') then coalesce(delivered_at,p_event_time) else delivered_at end,
    proof_storage_path=coalesce(p_proof_storage_path,proof_storage_path),
    receiver_name=coalesce(nullif(trim(p_receiver_name),''),receiver_name),
    receiver_phone=coalesce(nullif(trim(p_receiver_phone),''),receiver_phone)
  where id=p_trucking_job_id returning * into v_row;
  if not found then raise exception 'Trucking job not found'; end if;
  insert into public.v13_trucking_events(trucking_job_id,status,event_time,location,latitude,longitude,note,proof_storage_path,created_by)
  values(p_trucking_job_id,p_status,coalesce(p_event_time,timezone('utc',now())),p_location,p_latitude,p_longitude,p_note,p_proof_storage_path,auth.uid());
  return v_row;
end; $$;

create or replace function public.v13_submit_leave_request(
  p_leave_type_id uuid,
  p_start_date date,
  p_end_date date,
  p_total_days numeric,
  p_reason text,
  p_attachment_path text,
  p_emergency_contact text,
  p_handover_to uuid,
  p_handover_note text
)
returns public.v13_leave_requests
language plpgsql security definer set search_path=public
as $$
declare v_row public.v13_leave_requests; v_no text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_end_date<p_start_date then raise exception 'End date cannot be before start date'; end if;
  if p_total_days<=0 then raise exception 'Leave days must be greater than zero'; end if;
  if nullif(trim(p_reason),'') is null then raise exception 'Leave reason is required'; end if;
  v_no:='CJ-LV-'||to_char(timezone('utc',now()),'YYYYMMDDHH24MISS')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,5));
  insert into public.v13_leave_requests(request_no,employee_id,leave_type_id,start_date,end_date,total_days,reason,attachment_path,emergency_contact,handover_to,handover_note,status)
  values(v_no,auth.uid(),p_leave_type_id,p_start_date,p_end_date,p_total_days,trim(p_reason),p_attachment_path,nullif(trim(p_emergency_contact),''),p_handover_to,p_handover_note,'submitted') returning * into v_row;
  return v_row;
end; $$;

create or replace function public.v13_approve_leave_request(
  p_leave_request_id uuid,
  p_action text,
  p_note text default null
)
returns public.v13_leave_requests
language plpgsql security definer set search_path=public
as $$
declare v_row public.v13_leave_requests; v_is_hr boolean; v_is_manager boolean;
begin
  v_is_hr:=public.v12_has_role(array['owner','super_admin','admin','accounts']);
  v_is_manager:=public.v12_has_role(array['owner','super_admin','admin','manager','service_manager']);
  if not v_is_hr and not v_is_manager then raise exception 'Not authorized'; end if;
  if p_action not in ('approve','reject') then raise exception 'Invalid action'; end if;
  select * into v_row from public.v13_leave_requests where id=p_leave_request_id for update;
  if not found then raise exception 'Leave request not found'; end if;
  if p_action='reject' then
    update public.v13_leave_requests set status='rejected',
      manager_id=case when v_is_manager then auth.uid() else manager_id end,
      manager_note=case when v_is_manager then p_note else manager_note end,
      manager_action_at=case when v_is_manager then timezone('utc',now()) else manager_action_at end,
      hr_id=case when v_is_hr then auth.uid() else hr_id end,
      hr_note=case when v_is_hr then p_note else hr_note end,
      hr_action_at=case when v_is_hr then timezone('utc',now()) else hr_action_at end
    where id=p_leave_request_id returning * into v_row;
  elsif v_is_hr and v_row.status in ('manager_approved','submitted') then
    update public.v13_leave_requests set status='approved',hr_id=auth.uid(),hr_note=p_note,hr_action_at=timezone('utc',now()) where id=p_leave_request_id returning * into v_row;
  elsif v_is_manager and v_row.status='submitted' then
    update public.v13_leave_requests set status='manager_approved',manager_id=auth.uid(),manager_note=p_note,manager_action_at=timezone('utc',now()) where id=p_leave_request_id returning * into v_row;
  else raise exception 'Leave request is not ready for this approval'; end if;
  return v_row;
end; $$;

create or replace function public.v13_ingest_biometric_event(
  p_connector_code text,
  p_device_code text,
  p_device_user_code text,
  p_event_time timestamptz,
  p_event_type text,
  p_verify_mode text,
  p_work_code text,
  p_device_event_id text,
  p_raw_payload jsonb,
  p_idempotency_key text
)
returns uuid
language plpgsql security definer set search_path=public
as $$
declare v_connector public.v13_biometric_connectors; v_device public.v13_biometric_devices; v_employee uuid; v_id uuid;
begin
  select * into v_connector from public.v13_biometric_connectors where connector_code=p_connector_code and active=true;
  if not found then raise exception 'Active biometric connector not found'; end if;
  select * into v_device from public.v13_biometric_devices where connector_id=v_connector.id and device_code=p_device_code and active=true;
  if not found then raise exception 'Active biometric device not found'; end if;
  select employee_id into v_employee from public.v13_biometric_employee_mappings where device_id=v_device.id and device_user_code=p_device_user_code and active=true;
  insert into public.v13_biometric_events(device_id,connector_id,employee_id,device_user_code,event_time,event_type,verify_mode,work_code,device_event_id,raw_payload,idempotency_key)
  values(v_device.id,v_connector.id,v_employee,p_device_user_code,p_event_time,case when p_event_type in ('punch','check_in','check_out','break_start','break_end','unknown') then p_event_type else 'unknown' end,p_verify_mode,p_work_code,p_device_event_id,coalesce(p_raw_payload,'{}'::jsonb),p_idempotency_key)
  on conflict(idempotency_key) do update set idempotency_key=excluded.idempotency_key returning id into v_id;
  update public.v13_biometric_devices set last_seen_at=timezone('utc',now()) where id=v_device.id;
  update public.v13_biometric_connectors set last_sync_at=timezone('utc',now()),last_success_at=timezone('utc',now()),last_error=null where id=v_connector.id;
  return v_id;
end; $$;

create or replace function public.v13_ops_updated_at()
returns trigger language plpgsql security invoker set search_path=public as $$ begin new.updated_at=timezone('utc',now()); return new; end; $$;

do $$ declare t text; begin
  foreach t in array array['v13_office_tasks','v13_import_orders','v13_shipments','v13_trucking_jobs','v13_leave_requests','v13_payroll_periods','v13_employee_salary_profiles','v13_payroll_entries','v13_biometric_connectors','v13_biometric_devices'] loop
    execute format('drop trigger if exists %I on public.%I','trg_'||t||'_updated_at',t);
    execute format('create trigger %I before update on public.%I for each row execute function public.v13_ops_updated_at()','trg_'||t||'_updated_at',t);
  end loop;
end $$;

alter table public.v13_office_tasks enable row level security;
alter table public.v13_office_task_events enable row level security;
alter table public.v13_office_task_attachments enable row level security;
alter table public.v13_import_orders enable row level security;
alter table public.v13_import_order_items enable row level security;
alter table public.v13_import_payments enable row level security;
alter table public.v13_shipments enable row level security;
alter table public.v13_shipment_events enable row level security;
alter table public.v13_trucking_jobs enable row level security;
alter table public.v13_trucking_events enable row level security;
alter table public.v13_holidays enable row level security;
alter table public.v13_leave_types enable row level security;
alter table public.v13_leave_requests enable row level security;
alter table public.v13_payroll_periods enable row level security;
alter table public.v13_employee_salary_profiles enable row level security;
alter table public.v13_payroll_entries enable row level security;
alter table public.v13_biometric_connectors enable row level security;
alter table public.v13_biometric_devices enable row level security;
alter table public.v13_biometric_employee_mappings enable row level security;
alter table public.v13_biometric_events enable row level security;
alter table public.v13_biometric_sync_runs enable row level security;

create policy v13_tasks_read on public.v13_office_tasks for select to authenticated using(assigned_to=auth.uid() or assigned_by=auth.uid() or created_by=auth.uid() or public.v12_has_role(array['owner','super_admin','admin','manager','auditor']));
create policy v13_tasks_write on public.v13_office_tasks for all to authenticated using(assigned_to=auth.uid() or assigned_by=auth.uid() or public.v12_has_role(array['owner','super_admin','admin','manager'])) with check(assigned_to=auth.uid() or assigned_by=auth.uid() or public.v12_has_role(array['owner','super_admin','admin','manager']));
create policy v13_task_events_read on public.v13_office_task_events for select to authenticated using(exists(select 1 from public.v13_office_tasks t where t.id=task_id and(t.assigned_to=auth.uid() or t.assigned_by=auth.uid() or public.v12_has_role(array['owner','super_admin','admin','manager','auditor']))));
create policy v13_task_files_rw on public.v13_office_task_attachments for all to authenticated using(exists(select 1 from public.v13_office_tasks t where t.id=task_id and(t.assigned_to=auth.uid() or t.assigned_by=auth.uid() or public.v12_has_role(array['owner','super_admin','admin','manager'])))) with check(exists(select 1 from public.v13_office_tasks t where t.id=task_id and(t.assigned_to=auth.uid() or t.assigned_by=auth.uid() or public.v12_has_role(array['owner','super_admin','admin','manager']))));

create policy v13_import_read on public.v13_import_orders for select to authenticated using(public.v12_has_role(array['owner','super_admin','admin','manager','commercial','accounts','store','auditor']));
create policy v13_import_write on public.v13_import_orders for all to authenticated using(public.v12_has_role(array['owner','super_admin','admin','manager','commercial','accounts'])) with check(public.v12_has_role(array['owner','super_admin','admin','manager','commercial','accounts']));
create policy v13_import_items_rw on public.v13_import_order_items for all to authenticated using(public.v12_has_role(array['owner','super_admin','admin','manager','commercial','accounts','store','auditor'])) with check(public.v12_has_role(array['owner','super_admin','admin','manager','commercial','accounts']));
create policy v13_import_payments_read on public.v13_import_payments for select to authenticated using(public.v12_has_role(array['owner','super_admin','admin','manager','commercial','accounts','auditor']));
create policy v13_import_payments_write on public.v13_import_payments for all to authenticated using(public.v12_has_role(array['owner','super_admin','admin','manager','accounts'])) with check(public.v12_has_role(array['owner','super_admin','admin','manager','accounts']));
create policy v13_shipments_read on public.v13_shipments for select to authenticated using(public.v12_has_role(array['owner','super_admin','admin','manager','commercial','accounts','store','sales','engineer','auditor']));
create policy v13_shipments_write on public.v13_shipments for all to authenticated using(public.v12_has_role(array['owner','super_admin','admin','manager','commercial','store'])) with check(public.v12_has_role(array['owner','super_admin','admin','manager','commercial','store']));
create policy v13_shipment_events_read on public.v13_shipment_events for select to authenticated using(public.v12_has_role(array['owner','super_admin','admin','manager','commercial','accounts','store','sales','engineer','auditor']));
create policy v13_trucking_read on public.v13_trucking_jobs for select to authenticated using(public.v12_has_role(array['owner','super_admin','admin','manager','commercial','accounts','store','sales','engineer','auditor']));
create policy v13_trucking_write on public.v13_trucking_jobs for all to authenticated using(public.v12_has_role(array['owner','super_admin','admin','manager','commercial','store','sales','engineer'])) with check(public.v12_has_role(array['owner','super_admin','admin','manager','commercial','store','sales','engineer']));
create policy v13_trucking_events_read on public.v13_trucking_events for select to authenticated using(public.v12_has_role(array['owner','super_admin','admin','manager','commercial','accounts','store','sales','engineer','auditor']));

create policy v13_holidays_read on public.v13_holidays for select to authenticated using(true);
create policy v13_holidays_write on public.v13_holidays for all to authenticated using(public.v12_has_role(array['owner','super_admin','admin','manager','accounts'])) with check(public.v12_has_role(array['owner','super_admin','admin','manager','accounts']));
create policy v13_leave_types_read on public.v13_leave_types for select to authenticated using(active=true or public.v12_has_role(array['owner','super_admin','admin','manager','accounts'])));
create policy v13_leave_types_write on public.v13_leave_types for all to authenticated using(public.v12_has_role(array['owner','super_admin','admin','manager','accounts'])) with check(public.v12_has_role(array['owner','super_admin','admin','manager','accounts']));
create policy v13_leave_requests_read on public.v13_leave_requests for select to authenticated using(employee_id=auth.uid() or handover_to=auth.uid() or public.v12_has_role(array['owner','super_admin','admin','manager','service_manager','accounts','auditor']));
create policy v13_leave_requests_write on public.v13_leave_requests for all to authenticated using(employee_id=auth.uid() or public.v12_has_role(array['owner','super_admin','admin','manager','service_manager','accounts'])) with check(employee_id=auth.uid() or public.v12_has_role(array['owner','super_admin','admin','manager','service_manager','accounts']));
create policy v13_payroll_periods_read on public.v13_payroll_periods for select to authenticated using(public.v12_has_role(array['owner','super_admin','admin','manager','accounts','auditor']));
create policy v13_payroll_periods_write on public.v13_payroll_periods for all to authenticated using(public.v12_has_role(array['owner','super_admin','admin','accounts'])) with check(public.v12_has_role(array['owner','super_admin','admin','accounts']));
create policy v13_salary_profiles_read on public.v13_employee_salary_profiles for select to authenticated using(employee_id=auth.uid() or public.v12_has_role(array['owner','super_admin','admin','accounts','auditor']));
create policy v13_salary_profiles_write on public.v13_employee_salary_profiles for all to authenticated using(public.v12_has_role(array['owner','super_admin','admin','accounts'])) with check(public.v12_has_role(array['owner','super_admin','admin','accounts']));
create policy v13_payroll_entries_read on public.v13_payroll_entries for select to authenticated using(employee_id=auth.uid() or public.v12_has_role(array['owner','super_admin','admin','accounts','auditor']));
create policy v13_payroll_entries_write on public.v13_payroll_entries for all to authenticated using(public.v12_has_role(array['owner','super_admin','admin','accounts'])) with check(public.v12_has_role(array['owner','super_admin','admin','accounts']));

create policy v13_biometric_connectors_read on public.v13_biometric_connectors for select to authenticated using(public.v12_has_role(array['owner','super_admin','admin','manager','accounts','auditor']));
create policy v13_biometric_connectors_write on public.v13_biometric_connectors for all to authenticated using(public.v12_has_role(array['owner','super_admin','admin'])) with check(public.v12_has_role(array['owner','super_admin','admin']));
create policy v13_biometric_devices_read on public.v13_biometric_devices for select to authenticated using(public.v12_has_role(array['owner','super_admin','admin','manager','accounts','auditor']));
create policy v13_biometric_devices_write on public.v13_biometric_devices for all to authenticated using(public.v12_has_role(array['owner','super_admin','admin'])) with check(public.v12_has_role(array['owner','super_admin','admin']));
create policy v13_biometric_mappings_read on public.v13_biometric_employee_mappings for select to authenticated using(employee_id=auth.uid() or public.v12_has_role(array['owner','super_admin','admin','manager','accounts','auditor']));
create policy v13_biometric_mappings_write on public.v13_biometric_employee_mappings for all to authenticated using(public.v12_has_role(array['owner','super_admin','admin'])) with check(public.v12_has_role(array['owner','super_admin','admin']));
create policy v13_biometric_events_read on public.v13_biometric_events for select to authenticated using(employee_id=auth.uid() or public.v12_has_role(array['owner','super_admin','admin','manager','accounts','auditor']));
create policy v13_biometric_sync_read on public.v13_biometric_sync_runs for select to authenticated using(public.v12_has_role(array['owner','super_admin','admin','manager','accounts','auditor']));

grant select,insert,update on public.v13_office_tasks to authenticated;
grant select on public.v13_office_task_events to authenticated;
grant select,insert,update on public.v13_office_task_attachments to authenticated;
grant select,insert,update on public.v13_import_orders to authenticated;
grant select,insert,update on public.v13_import_order_items to authenticated;
grant select,insert on public.v13_import_payments to authenticated;
grant select,insert,update on public.v13_shipments to authenticated;
grant select on public.v13_shipment_events to authenticated;
grant select,insert,update on public.v13_trucking_jobs to authenticated;
grant select on public.v13_trucking_events to authenticated;
grant select,insert,update on public.v13_holidays to authenticated;
grant select,insert,update on public.v13_leave_types to authenticated;
grant select,insert,update on public.v13_leave_requests to authenticated;
grant select,insert,update on public.v13_payroll_periods to authenticated;
grant select,insert,update on public.v13_employee_salary_profiles to authenticated;
grant select,insert,update on public.v13_payroll_entries to authenticated;
grant select,insert,update on public.v13_biometric_connectors to authenticated;
grant select,insert,update on public.v13_biometric_devices to authenticated;
grant select,insert,update on public.v13_biometric_employee_mappings to authenticated;
grant select on public.v13_biometric_events to authenticated;
grant select on public.v13_biometric_sync_runs to authenticated;
grant execute on function public.v13_create_office_task(text,text,text,text,uuid,text,uuid,text,timestamptz,timestamptz,timestamptz) to authenticated;
grant execute on function public.v13_transition_office_task(uuid,text,integer,text,text) to authenticated;
grant execute on function public.v13_mark_overdue_tasks() to authenticated;
grant execute on function public.v13_record_import_payment(uuid,text,text,numeric,text,numeric,text,text,date,text,text) to authenticated;
grant execute on function public.v13_update_shipment_status(uuid,text,timestamptz,text,text,double precision,double precision) to authenticated;
grant execute on function public.v13_update_trucking_status(uuid,text,timestamptz,text,text,double precision,double precision,text,text,text) to authenticated;
grant execute on function public.v13_submit_leave_request(uuid,date,date,numeric,text,text,text,uuid,text) to authenticated;
grant execute on function public.v13_approve_leave_request(uuid,text,text) to authenticated;

comment on table public.v13_biometric_connectors is 'Vendor-neutral biometric connector registry. Secrets are referenced by secret name and never stored in this table.';
comment on function public.v13_ingest_biometric_event(text,text,text,timestamptz,text,text,text,text,jsonb,text) is 'Server-side biometric event ingestion function intended for a secured gateway or Supabase Edge Function.';
