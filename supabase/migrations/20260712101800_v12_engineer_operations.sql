-- COLORJET ERP V12 Engineer Operations
-- Production-safe Supabase/PostgreSQL migration.
-- Odoo integration is intentionally untouched.

create extension if not exists pgcrypto;

create or replace function public.v12_set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.v12_has_role(allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
      and r.code = any(allowed_roles)
  );
$$;

create table if not exists public.v12_customer_visits (
  id uuid primary key default gen_random_uuid(),
  visit_no text not null unique,
  ticket_id uuid,
  customer_id uuid,
  machine_id uuid,
  assigned_engineer_id uuid not null references auth.users(id) on delete restrict,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  schedule_start timestamptz not null,
  schedule_end timestamptz,
  expected_duration_minutes integer not null default 120 check (expected_duration_minutes between 1 and 1440),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent','emergency')),
  status text not null default 'draft' check (status in (
    'draft','assigned','accepted','travelling','arrived','checked_in','work_started',
    'waiting_parts','work_resumed','completed','customer_confirmed','closed',
    'rescheduled','engineer_rejected','customer_unavailable','cancelled',
    'follow_up_required','escalated','sla_breached'
  )),
  customer_name text not null,
  contact_person text,
  customer_phone text,
  service_address text not null,
  service_latitude double precision,
  service_longitude double precision,
  checkin_radius_m integer not null default 200 check (checkin_radius_m between 25 and 5000),
  accepted_at timestamptz,
  travel_started_at timestamptz,
  arrived_at timestamptz,
  checked_in_at timestamptz,
  work_started_at timestamptz,
  completed_at timestamptz,
  customer_confirmed_at timestamptz,
  closed_at timestamptz,
  sla_due_at timestamptz,
  follow_up_at timestamptz,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists v12_customer_visits_engineer_idx on public.v12_customer_visits (assigned_engineer_id, schedule_start desc);
create index if not exists v12_customer_visits_status_idx on public.v12_customer_visits (status, schedule_start);
create index if not exists v12_customer_visits_ticket_idx on public.v12_customer_visits (ticket_id);
create index if not exists v12_customer_visits_customer_idx on public.v12_customer_visits (customer_id);

create table if not exists public.v12_visit_events (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references public.v12_customer_visits(id) on delete cascade,
  event_type text not null,
  from_status text,
  to_status text,
  note text,
  latitude double precision,
  longitude double precision,
  accuracy_m double precision,
  device_id text,
  captured_at timestamptz not null default timezone('utc', now()),
  server_received_at timestamptz not null default timezone('utc', now()),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  idempotency_key text,
  metadata jsonb not null default '{}'::jsonb,
  unique (idempotency_key)
);

create index if not exists v12_visit_events_visit_idx on public.v12_visit_events (visit_id, captured_at desc);

create table if not exists public.v12_tracking_sessions (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid references public.v12_customer_visits(id) on delete cascade,
  engineer_id uuid not null references auth.users(id) on delete restrict,
  device_id text,
  status text not null default 'active' check (status in ('active','paused','completed','cancelled')),
  started_at timestamptz not null default timezone('utc', now()),
  ended_at timestamptz,
  start_latitude double precision,
  start_longitude double precision,
  end_latitude double precision,
  end_longitude double precision,
  total_distance_m numeric(14,2) not null default 0,
  point_count integer not null default 0,
  last_point_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists v12_one_active_tracking_session_per_engineer
  on public.v12_tracking_sessions (engineer_id)
  where status = 'active';
create index if not exists v12_tracking_sessions_visit_idx on public.v12_tracking_sessions (visit_id, started_at desc);

create table if not exists public.v12_location_points (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.v12_tracking_sessions(id) on delete cascade,
  visit_id uuid references public.v12_customer_visits(id) on delete cascade,
  engineer_id uuid not null references auth.users(id) on delete restrict,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  accuracy_m double precision,
  speed_mps double precision,
  bearing_deg double precision,
  altitude_m double precision,
  battery_percent numeric(5,2),
  network_type text,
  is_mock boolean not null default false,
  captured_at timestamptz not null,
  server_received_at timestamptz not null default timezone('utc', now()),
  idempotency_key text not null unique,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists v12_location_points_session_idx on public.v12_location_points (session_id, captured_at);
create index if not exists v12_location_points_engineer_idx on public.v12_location_points (engineer_id, captured_at desc);
create index if not exists v12_location_points_visit_idx on public.v12_location_points (visit_id, captured_at);

create table if not exists public.v12_parts_requests (
  id uuid primary key default gen_random_uuid(),
  request_no text not null unique,
  ticket_id uuid,
  visit_id uuid references public.v12_customer_visits(id) on delete set null,
  requested_by uuid not null references auth.users(id) on delete restrict default auth.uid(),
  assigned_store_user_id uuid references auth.users(id) on delete set null,
  urgency text not null default 'normal' check (urgency in ('low','normal','high','urgent','emergency')),
  request_type text not null default 'service' check (request_type in ('service','warranty','replacement','internal_repair')),
  status text not null default 'requested' check (status in (
    'requested','manager_approved','store_checking','available','reserved','partially_approved',
    'partially_dispatched','dispatched','in_transit','engineer_received','installed',
    'used','returned','out_of_stock','purchase_required','rejected','cancelled','closed'
  )),
  reason text not null,
  required_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.v12_parts_request_items (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.v12_parts_requests(id) on delete cascade,
  product_id uuid,
  sku text,
  product_name text not null,
  model text,
  identification_no text,
  requested_qty numeric(14,3) not null check (requested_qty > 0),
  approved_qty numeric(14,3) not null default 0 check (approved_qty >= 0),
  dispatched_qty numeric(14,3) not null default 0 check (dispatched_qty >= 0),
  received_qty numeric(14,3) not null default 0 check (received_qty >= 0),
  installed_qty numeric(14,3) not null default 0 check (installed_qty >= 0),
  billing_type text not null default 'warranty' check (billing_type in ('warranty','free','chargeable')),
  damaged_part_serial text,
  note text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists v12_parts_request_items_request_idx on public.v12_parts_request_items (request_id);

create table if not exists public.v12_parts_dispatches (
  id uuid primary key default gen_random_uuid(),
  dispatch_no text not null unique,
  request_id uuid not null references public.v12_parts_requests(id) on delete restrict,
  source_warehouse_id uuid,
  destination text not null,
  receiver_user_id uuid references auth.users(id) on delete set null,
  courier_name text,
  tracking_no text,
  transport_type text,
  status text not null default 'prepared' check (status in ('prepared','dispatched','in_transit','delivered','received','damaged','lost','cancelled')),
  package_count integer not null default 1 check (package_count > 0),
  weight_kg numeric(14,3),
  delivery_charge numeric(14,2) not null default 0,
  dispatched_at timestamptz,
  expected_delivery_at timestamptz,
  delivered_at timestamptz,
  received_at timestamptz,
  proof_storage_path text,
  receiver_signature_path text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.v12_parts_dispatch_items (
  id uuid primary key default gen_random_uuid(),
  dispatch_id uuid not null references public.v12_parts_dispatches(id) on delete cascade,
  request_item_id uuid not null references public.v12_parts_request_items(id) on delete restrict,
  quantity numeric(14,3) not null check (quantity > 0),
  serial_numbers text[] not null default '{}',
  condition_at_dispatch text,
  condition_at_receipt text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.v12_sla_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  priority text,
  warranty_status text,
  customer_category text,
  response_minutes integer not null default 30 check (response_minutes > 0),
  arrival_minutes integer not null default 240 check (arrival_minutes > 0),
  resolution_minutes integer not null default 1440 check (resolution_minutes > 0),
  warning_before_minutes integer not null default 30 check (warning_before_minutes >= 0),
  business_hours_only boolean not null default true,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.v12_sla_events (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references public.v12_customer_visits(id) on delete cascade,
  rule_id uuid references public.v12_sla_rules(id) on delete set null,
  metric text not null check (metric in ('response','acceptance','travel_start','arrival','work_start','resolution','customer_confirmation','closure')),
  target_at timestamptz not null,
  achieved_at timestamptz,
  status text not null default 'within_sla' check (status in ('within_sla','warning','near_breach','breached','paused','exempted','approved_exception')),
  pause_reason text,
  paused_at timestamptz,
  resumed_at timestamptz,
  exception_approved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists v12_sla_events_status_idx on public.v12_sla_events (status, target_at);
create index if not exists v12_sla_events_visit_idx on public.v12_sla_events (visit_id, metric);

create table if not exists public.v12_offline_mutations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id text not null,
  mutation_type text not null,
  idempotency_key text not null unique,
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending','processing','applied','failed','conflict')),
  attempt_count integer not null default 0,
  last_error text,
  created_at timestamptz not null default timezone('utc', now()),
  applied_at timestamptz
);

drop trigger if exists v12_customer_visits_updated_at on public.v12_customer_visits;
create trigger v12_customer_visits_updated_at
before update on public.v12_customer_visits
for each row execute function public.v12_set_updated_at();

drop trigger if exists v12_tracking_sessions_updated_at on public.v12_tracking_sessions;
create trigger v12_tracking_sessions_updated_at
before update on public.v12_tracking_sessions
for each row execute function public.v12_set_updated_at();

drop trigger if exists v12_parts_requests_updated_at on public.v12_parts_requests;
create trigger v12_parts_requests_updated_at
before update on public.v12_parts_requests
for each row execute function public.v12_set_updated_at();

drop trigger if exists v12_parts_dispatches_updated_at on public.v12_parts_dispatches;
create trigger v12_parts_dispatches_updated_at
before update on public.v12_parts_dispatches
for each row execute function public.v12_set_updated_at();

drop trigger if exists v12_sla_rules_updated_at on public.v12_sla_rules;
create trigger v12_sla_rules_updated_at
before update on public.v12_sla_rules
for each row execute function public.v12_set_updated_at();

drop trigger if exists v12_sla_events_updated_at on public.v12_sla_events;
create trigger v12_sla_events_updated_at
before update on public.v12_sla_events
for each row execute function public.v12_set_updated_at();

create or replace function public.v12_transition_visit(
  p_visit_id uuid,
  p_new_status text,
  p_note text default null,
  p_latitude double precision default null,
  p_longitude double precision default null,
  p_accuracy_m double precision default null,
  p_device_id text default null,
  p_idempotency_key text default null
)
returns public.v12_customer_visits
language plpgsql
security definer
set search_path = public
as $$
declare
  v_visit public.v12_customer_visits;
  v_old_status text;
  v_allowed boolean := false;
begin
  select * into v_visit
  from public.v12_customer_visits
  where id = p_visit_id
  for update;

  if not found then
    raise exception 'Visit not found';
  end if;

  if v_visit.assigned_engineer_id <> auth.uid()
     and not public.v12_has_role(array['owner','super_admin','admin','manager','service_manager']) then
    raise exception 'Not authorized for this visit';
  end if;

  v_old_status := v_visit.status;

  v_allowed := case v_old_status
    when 'draft' then p_new_status = any(array['assigned','cancelled'])
    when 'assigned' then p_new_status = any(array['accepted','engineer_rejected','rescheduled','cancelled'])
    when 'accepted' then p_new_status = any(array['travelling','rescheduled','cancelled'])
    when 'travelling' then p_new_status = any(array['arrived','customer_unavailable','cancelled','escalated'])
    when 'arrived' then p_new_status = any(array['checked_in','customer_unavailable','cancelled'])
    when 'checked_in' then p_new_status = any(array['work_started','customer_unavailable','cancelled'])
    when 'work_started' then p_new_status = any(array['waiting_parts','completed','follow_up_required','escalated'])
    when 'waiting_parts' then p_new_status = any(array['work_resumed','follow_up_required','cancelled','escalated'])
    when 'work_resumed' then p_new_status = any(array['waiting_parts','completed','follow_up_required','escalated'])
    when 'completed' then p_new_status = any(array['customer_confirmed','follow_up_required','escalated'])
    when 'customer_confirmed' then p_new_status = any(array['closed','follow_up_required'])
    when 'follow_up_required' then p_new_status = any(array['rescheduled','closed'])
    when 'rescheduled' then p_new_status = any(array['assigned','cancelled'])
    when 'escalated' then p_new_status = any(array['assigned','travelling','work_started','waiting_parts','completed','cancelled'])
    when 'sla_breached' then p_new_status = any(array['escalated','completed','closed'])
    else false
  end;

  if not v_allowed and p_new_status <> v_old_status then
    raise exception 'Invalid visit transition: % -> %', v_old_status, p_new_status;
  end if;

  update public.v12_customer_visits
  set status = p_new_status,
      accepted_at = case when p_new_status = 'accepted' then coalesce(accepted_at, timezone('utc', now())) else accepted_at end,
      travel_started_at = case when p_new_status = 'travelling' then coalesce(travel_started_at, timezone('utc', now())) else travel_started_at end,
      arrived_at = case when p_new_status = 'arrived' then coalesce(arrived_at, timezone('utc', now())) else arrived_at end,
      checked_in_at = case when p_new_status = 'checked_in' then coalesce(checked_in_at, timezone('utc', now())) else checked_in_at end,
      work_started_at = case when p_new_status in ('work_started','work_resumed') then coalesce(work_started_at, timezone('utc', now())) else work_started_at end,
      completed_at = case when p_new_status = 'completed' then coalesce(completed_at, timezone('utc', now())) else completed_at end,
      customer_confirmed_at = case when p_new_status = 'customer_confirmed' then coalesce(customer_confirmed_at, timezone('utc', now())) else customer_confirmed_at end,
      closed_at = case when p_new_status = 'closed' then coalesce(closed_at, timezone('utc', now())) else closed_at end
  where id = p_visit_id
  returning * into v_visit;

  insert into public.v12_visit_events (
    visit_id, event_type, from_status, to_status, note, latitude, longitude,
    accuracy_m, device_id, created_by, idempotency_key
  ) values (
    p_visit_id, 'status_transition', v_old_status, p_new_status, p_note, p_latitude,
    p_longitude, p_accuracy_m, p_device_id, auth.uid(), p_idempotency_key
  ) on conflict (idempotency_key) do nothing;

  return v_visit;
end;
$$;

create or replace function public.v12_start_tracking_session(
  p_visit_id uuid,
  p_device_id text,
  p_latitude double precision default null,
  p_longitude double precision default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_visit public.v12_customer_visits;
  v_session_id uuid;
begin
  select * into v_visit from public.v12_customer_visits where id = p_visit_id;
  if not found then raise exception 'Visit not found'; end if;

  if v_visit.assigned_engineer_id <> auth.uid()
     and not public.v12_has_role(array['owner','super_admin','admin','manager','service_manager']) then
    raise exception 'Not authorized for this visit';
  end if;

  update public.v12_tracking_sessions
  set status = 'completed', ended_at = timezone('utc', now())
  where engineer_id = v_visit.assigned_engineer_id and status = 'active';

  insert into public.v12_tracking_sessions (
    visit_id, engineer_id, device_id, start_latitude, start_longitude
  ) values (
    p_visit_id, v_visit.assigned_engineer_id, p_device_id, p_latitude, p_longitude
  ) returning id into v_session_id;

  return v_session_id;
end;
$$;

create or replace function public.v12_append_location(
  p_session_id uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy_m double precision,
  p_speed_mps double precision,
  p_bearing_deg double precision,
  p_altitude_m double precision,
  p_is_mock boolean,
  p_captured_at timestamptz,
  p_idempotency_key text,
  p_battery_percent numeric default null,
  p_network_type text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.v12_tracking_sessions;
  v_point_id uuid;
begin
  select * into v_session
  from public.v12_tracking_sessions
  where id = p_session_id and status = 'active';

  if not found then raise exception 'Active tracking session not found'; end if;

  if v_session.engineer_id <> auth.uid()
     and not public.v12_has_role(array['owner','super_admin','admin','manager','service_manager']) then
    raise exception 'Not authorized for this tracking session';
  end if;

  insert into public.v12_location_points (
    session_id, visit_id, engineer_id, latitude, longitude, accuracy_m, speed_mps,
    bearing_deg, altitude_m, battery_percent, network_type, is_mock, captured_at,
    idempotency_key, metadata
  ) values (
    p_session_id, v_session.visit_id, v_session.engineer_id, p_latitude, p_longitude,
    p_accuracy_m, p_speed_mps, p_bearing_deg, p_altitude_m, p_battery_percent,
    p_network_type, coalesce(p_is_mock, false), p_captured_at, p_idempotency_key,
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (idempotency_key) do nothing
  returning id into v_point_id;

  if v_point_id is null then
    select id into v_point_id
    from public.v12_location_points
    where idempotency_key = p_idempotency_key;
    return v_point_id;
  end if;

  update public.v12_tracking_sessions
  set point_count = point_count + 1,
      last_point_at = greatest(coalesce(last_point_at, p_captured_at), p_captured_at),
      end_latitude = p_latitude,
      end_longitude = p_longitude
  where id = p_session_id;

  return v_point_id;
end;
$$;

create or replace function public.v12_stop_tracking_session(
  p_session_id uuid,
  p_latitude double precision default null,
  p_longitude double precision default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.v12_tracking_sessions;
begin
  select * into v_session from public.v12_tracking_sessions where id = p_session_id;
  if not found then raise exception 'Tracking session not found'; end if;

  if v_session.engineer_id <> auth.uid()
     and not public.v12_has_role(array['owner','super_admin','admin','manager','service_manager']) then
    raise exception 'Not authorized for this tracking session';
  end if;

  update public.v12_tracking_sessions
  set status = 'completed',
      ended_at = coalesce(ended_at, timezone('utc', now())),
      end_latitude = coalesce(p_latitude, end_latitude),
      end_longitude = coalesce(p_longitude, end_longitude)
  where id = p_session_id and status in ('active','paused');
end;
$$;

alter table public.v12_customer_visits enable row level security;
alter table public.v12_visit_events enable row level security;
alter table public.v12_tracking_sessions enable row level security;
alter table public.v12_location_points enable row level security;
alter table public.v12_parts_requests enable row level security;
alter table public.v12_parts_request_items enable row level security;
alter table public.v12_parts_dispatches enable row level security;
alter table public.v12_parts_dispatch_items enable row level security;
alter table public.v12_sla_rules enable row level security;
alter table public.v12_sla_events enable row level security;
alter table public.v12_offline_mutations enable row level security;

drop policy if exists v12_visits_select on public.v12_customer_visits;
create policy v12_visits_select on public.v12_customer_visits
for select to authenticated
using (
  assigned_engineer_id = auth.uid()
  or created_by = auth.uid()
  or public.v12_has_role(array['owner','super_admin','admin','manager','service_manager','store','accounts','auditor'])
);

drop policy if exists v12_visits_insert on public.v12_customer_visits;
create policy v12_visits_insert on public.v12_customer_visits
for insert to authenticated
with check (public.v12_has_role(array['owner','super_admin','admin','manager','service_manager']));

drop policy if exists v12_visits_update on public.v12_customer_visits;
create policy v12_visits_update on public.v12_customer_visits
for update to authenticated
using (
  assigned_engineer_id = auth.uid()
  or public.v12_has_role(array['owner','super_admin','admin','manager','service_manager'])
)
with check (
  assigned_engineer_id = auth.uid()
  or public.v12_has_role(array['owner','super_admin','admin','manager','service_manager'])
);

drop policy if exists v12_visit_events_select on public.v12_visit_events;
create policy v12_visit_events_select on public.v12_visit_events
for select to authenticated
using (
  exists (
    select 1 from public.v12_customer_visits v
    where v.id = visit_id
      and (v.assigned_engineer_id = auth.uid() or public.v12_has_role(array['owner','super_admin','admin','manager','service_manager','auditor']))
  )
);

drop policy if exists v12_tracking_sessions_select on public.v12_tracking_sessions;
create policy v12_tracking_sessions_select on public.v12_tracking_sessions
for select to authenticated
using (engineer_id = auth.uid() or public.v12_has_role(array['owner','super_admin','admin','manager','service_manager','auditor']));

drop policy if exists v12_location_points_select on public.v12_location_points;
create policy v12_location_points_select on public.v12_location_points
for select to authenticated
using (engineer_id = auth.uid() or public.v12_has_role(array['owner','super_admin','admin','manager','service_manager','auditor']));

drop policy if exists v12_parts_requests_select on public.v12_parts_requests;
create policy v12_parts_requests_select on public.v12_parts_requests
for select to authenticated
using (
  requested_by = auth.uid()
  or assigned_store_user_id = auth.uid()
  or public.v12_has_role(array['owner','super_admin','admin','manager','service_manager','store','accounts','auditor'])
);

drop policy if exists v12_parts_requests_insert on public.v12_parts_requests;
create policy v12_parts_requests_insert on public.v12_parts_requests
for insert to authenticated
with check (requested_by = auth.uid());

drop policy if exists v12_parts_requests_update on public.v12_parts_requests;
create policy v12_parts_requests_update on public.v12_parts_requests
for update to authenticated
using (
  requested_by = auth.uid()
  or assigned_store_user_id = auth.uid()
  or public.v12_has_role(array['owner','super_admin','admin','manager','service_manager','store'])
)
with check (
  requested_by = auth.uid()
  or assigned_store_user_id = auth.uid()
  or public.v12_has_role(array['owner','super_admin','admin','manager','service_manager','store'])
);

drop policy if exists v12_parts_requests_delete on public.v12_parts_requests;
create policy v12_parts_requests_delete on public.v12_parts_requests
for delete to authenticated
using (
  requested_by = auth.uid()
  or assigned_store_user_id = auth.uid()
  or public.v12_has_role(array['owner','super_admin','admin','manager','service_manager','store'])
);

drop policy if exists v12_parts_request_items_select on public.v12_parts_request_items;
create policy v12_parts_request_items_select on public.v12_parts_request_items
for select to authenticated
using (exists (
  select 1 from public.v12_parts_requests r
  where r.id = request_id
    and (r.requested_by = auth.uid() or r.assigned_store_user_id = auth.uid() or public.v12_has_role(array['owner','super_admin','admin','manager','service_manager','store','auditor']))
));

drop policy if exists v12_parts_request_items_insert on public.v12_parts_request_items;
create policy v12_parts_request_items_insert on public.v12_parts_request_items
for insert to authenticated
with check (exists (
  select 1 from public.v12_parts_requests r
  where r.id = request_id and (r.requested_by = auth.uid() or public.v12_has_role(array['owner','super_admin','admin','manager','service_manager']))
));

drop policy if exists v12_parts_dispatches_select on public.v12_parts_dispatches;
create policy v12_parts_dispatches_select on public.v12_parts_dispatches
for select to authenticated
using (receiver_user_id = auth.uid() or public.v12_has_role(array['owner','super_admin','admin','manager','service_manager','store','accounts','auditor']));

drop policy if exists v12_parts_dispatches_write on public.v12_parts_dispatches;
create policy v12_parts_dispatches_write on public.v12_parts_dispatches
for all to authenticated
using (public.v12_has_role(array['owner','super_admin','admin','manager','service_manager','store']))
with check (public.v12_has_role(array['owner','super_admin','admin','manager','service_manager','store']));

drop policy if exists v12_parts_dispatch_items_select on public.v12_parts_dispatch_items;
create policy v12_parts_dispatch_items_select on public.v12_parts_dispatch_items
for select to authenticated
using (exists (
  select 1 from public.v12_parts_dispatches d
  where d.id = dispatch_id and (d.receiver_user_id = auth.uid() or public.v12_has_role(array['owner','super_admin','admin','manager','service_manager','store','accounts','auditor']))
));

drop policy if exists v12_parts_dispatch_items_write on public.v12_parts_dispatch_items;
create policy v12_parts_dispatch_items_write on public.v12_parts_dispatch_items
for all to authenticated
using (public.v12_has_role(array['owner','super_admin','admin','manager','service_manager','store']))
with check (public.v12_has_role(array['owner','super_admin','admin','manager','service_manager','store']));

drop policy if exists v12_sla_rules_read on public.v12_sla_rules;
create policy v12_sla_rules_read on public.v12_sla_rules
for select to authenticated using (true);

drop policy if exists v12_sla_rules_write on public.v12_sla_rules;
create policy v12_sla_rules_write on public.v12_sla_rules
for all to authenticated
using (public.v12_has_role(array['owner','super_admin','admin','manager','service_manager']))
with check (public.v12_has_role(array['owner','super_admin','admin','manager','service_manager']));

drop policy if exists v12_sla_events_read on public.v12_sla_events;
create policy v12_sla_events_read on public.v12_sla_events
for select to authenticated
using (exists (
  select 1 from public.v12_customer_visits v
  where v.id = visit_id and (v.assigned_engineer_id = auth.uid() or public.v12_has_role(array['owner','super_admin','admin','manager','service_manager','auditor']))
));

drop policy if exists v12_sla_events_write on public.v12_sla_events;
create policy v12_sla_events_write on public.v12_sla_events
for all to authenticated
using (public.v12_has_role(array['owner','super_admin','admin','manager','service_manager']))
with check (public.v12_has_role(array['owner','super_admin','admin','manager','service_manager']));

drop policy if exists v12_offline_mutations_owner on public.v12_offline_mutations;
create policy v12_offline_mutations_owner on public.v12_offline_mutations
for all to authenticated
using (user_id = auth.uid() or public.v12_has_role(array['owner','super_admin','admin','auditor']))
with check (user_id = auth.uid() or public.v12_has_role(array['owner','super_admin','admin']));

grant select, insert, update on public.v12_customer_visits to authenticated;
grant select on public.v12_visit_events to authenticated;
grant select on public.v12_tracking_sessions to authenticated;
grant select on public.v12_location_points to authenticated;
grant select, insert, update, delete on public.v12_parts_requests to authenticated;
grant select, insert, update on public.v12_parts_request_items to authenticated;
grant select, insert, update on public.v12_parts_dispatches to authenticated;
grant select, insert, update on public.v12_parts_dispatch_items to authenticated;
grant select, insert, update on public.v12_sla_rules to authenticated;
grant select, insert, update on public.v12_sla_events to authenticated;
grant select, insert, update on public.v12_offline_mutations to authenticated;
grant execute on function public.v12_transition_visit(uuid,text,text,double precision,double precision,double precision,text,text) to authenticated;
grant execute on function public.v12_start_tracking_session(uuid,text,double precision,double precision) to authenticated;
grant execute on function public.v12_append_location(uuid,double precision,double precision,double precision,double precision,double precision,double precision,boolean,timestamptz,text,numeric,text,jsonb) to authenticated;
grant execute on function public.v12_stop_tracking_session(uuid,double precision,double precision) to authenticated;

comment on table public.v12_customer_visits is 'COLORJET V12 customer visit workflow and engineer assignment source of truth.';
comment on table public.v12_location_points is 'Background route points captured only during explicit active field tracking sessions.';
comment on function public.v12_transition_visit(uuid,text,text,double precision,double precision,double precision,text,text)
  is 'Validates visit status transitions, authorization, audit trail and idempotency.';
