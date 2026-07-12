-- COLORJET ERP V13: Service Case, Warranty Registration and SLA
-- Stacked on V12 Engineer Operations. Existing legacy service_tickets remain untouched.

create extension if not exists pgcrypto;

create table if not exists public.v13_warranty_registrations (
  id uuid primary key default gen_random_uuid(),
  warranty_no text not null unique,
  customer_id uuid,
  product_id uuid,
  invoice_id uuid,
  machine_serial text not null unique,
  machine_model text not null,
  machine_name text,
  sale_date date,
  installation_date date,
  warranty_start date not null,
  warranty_end date not null,
  engineer_service_end date,
  coverage jsonb not null default '["mainboard","headboard","servo_motor","driver"]'::jsonb,
  exclusions jsonb not null default '["printhead","small_spares","consumables","physical_damage","voltage_damage"]'::jsonb,
  terms text,
  status text not null default 'active' check (status in ('draft','active','expired','void','transferred')),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  verified_by uuid references auth.users(id) on delete set null,
  verified_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (warranty_end >= warranty_start)
);

create index if not exists v13_warranty_customer_idx on public.v13_warranty_registrations (customer_id, status);
create index if not exists v13_warranty_end_idx on public.v13_warranty_registrations (warranty_end, status);

create table if not exists public.v13_service_cases (
  id uuid primary key default gen_random_uuid(),
  case_no text not null unique,
  legacy_ticket_id uuid,
  warranty_id uuid references public.v13_warranty_registrations(id) on delete set null,
  customer_id uuid,
  product_id uuid,
  machine_serial text,
  machine_model text,
  customer_name text not null,
  customer_phone text,
  service_address text,
  service_latitude double precision,
  service_longitude double precision,
  subject text not null,
  problem_description text not null,
  problem_category text,
  service_type text not null default 'onsite' check (service_type in ('onsite','remote','office_repair','supplier_repair','installation','training','preventive_maintenance')),
  warranty_status text not null default 'unknown' check (warranty_status in ('unknown','in_warranty','out_warranty','void','pending_verification')),
  billing_status text not null default 'pending' check (billing_status in ('pending','warranty','free','chargeable','quoted','approved','invoiced','paid','waived')),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent','emergency')),
  status text not null default 'new' check (status in (
    'new','verified','assigned','accepted','travelling','arrived','checked_in','diagnosis',
    'work_started','waiting_parts','waiting_customer','sent_supplier','work_resumed',
    'completed','customer_confirmed','closed','reopened','cancelled','escalated','sla_breached'
  )),
  assigned_engineer_id uuid references auth.users(id) on delete set null,
  service_manager_id uuid references auth.users(id) on delete set null,
  scheduled_at timestamptz,
  response_due_at timestamptz,
  arrival_due_at timestamptz,
  resolution_due_at timestamptz,
  accepted_at timestamptz,
  travel_started_at timestamptz,
  arrived_at timestamptz,
  work_started_at timestamptz,
  completed_at timestamptz,
  customer_confirmed_at timestamptz,
  closed_at timestamptz,
  follow_up_at timestamptz,
  diagnosis text,
  work_performed text,
  pending_issue text,
  resolution_summary text,
  customer_rating numeric(3,2) check (customer_rating between 0 and 5),
  customer_comment text,
  labour_cost numeric(14,2) not null default 0,
  parts_cost numeric(14,2) not null default 0,
  transport_cost numeric(14,2) not null default 0,
  other_cost numeric(14,2) not null default 0,
  chargeable_amount numeric(14,2) not null default 0,
  source text not null default 'mobile' check (source in ('mobile','web','phone','whatsapp','email','legacy_import','system')),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists v13_service_cases_status_idx on public.v13_service_cases (status, priority, created_at desc);
create index if not exists v13_service_cases_engineer_idx on public.v13_service_cases (assigned_engineer_id, status, scheduled_at);
create index if not exists v13_service_cases_customer_idx on public.v13_service_cases (customer_id, created_at desc);
create index if not exists v13_service_cases_serial_idx on public.v13_service_cases (machine_serial);
create unique index if not exists v13_service_cases_legacy_unique on public.v13_service_cases (legacy_ticket_id) where legacy_ticket_id is not null;

create table if not exists public.v13_service_case_events (
  id uuid primary key default gen_random_uuid(),
  service_case_id uuid not null references public.v13_service_cases(id) on delete cascade,
  event_type text not null,
  from_status text,
  to_status text,
  note text,
  latitude double precision,
  longitude double precision,
  accuracy_m double precision,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default timezone('utc', now()),
  idempotency_key text unique,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists v13_service_case_events_idx on public.v13_service_case_events (service_case_id, created_at desc);

create table if not exists public.v13_service_checklist_items (
  id uuid primary key default gen_random_uuid(),
  service_case_id uuid not null references public.v13_service_cases(id) on delete cascade,
  checklist_group text not null default 'service',
  item_text text not null,
  required boolean not null default false,
  completed boolean not null default false,
  completed_by uuid references auth.users(id) on delete set null,
  completed_at timestamptz,
  note text,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.v13_service_attachments (
  id uuid primary key default gen_random_uuid(),
  service_case_id uuid not null references public.v13_service_cases(id) on delete cascade,
  attachment_type text not null check (attachment_type in ('before','problem','serial','parts','after','invoice','warranty','signature','report','other')),
  storage_bucket text not null default 'service-media',
  storage_path text not null,
  file_name text,
  mime_type text,
  uploaded_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.v13_warranty_claims (
  id uuid primary key default gen_random_uuid(),
  claim_no text not null unique,
  warranty_id uuid not null references public.v13_warranty_registrations(id) on delete restrict,
  service_case_id uuid references public.v13_service_cases(id) on delete set null,
  claim_type text not null default 'repair' check (claim_type in ('diagnosis','repair','replacement','supplier_repair','supplier_replacement')),
  claimed_part_name text,
  claimed_part_serial text,
  failure_description text not null,
  coverage_decision text not null default 'pending' check (coverage_decision in ('pending','covered','partially_covered','not_covered','void')),
  decision_reason text,
  status text not null default 'submitted' check (status in ('draft','submitted','reviewing','approved','rejected','part_requested','sent_supplier','repaired','replaced','returned','closed','cancelled')),
  supplier_id uuid,
  supplier_reference text,
  sent_to_supplier_at timestamptz,
  supplier_received_at timestamptz,
  supplier_returned_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists v13_warranty_claims_status_idx on public.v13_warranty_claims (status, created_at desc);
create index if not exists v13_warranty_claims_warranty_idx on public.v13_warranty_claims (warranty_id, created_at desc);

create table if not exists public.v13_sla_policies (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  priority text check (priority in ('low','normal','high','urgent','emergency')),
  service_type text,
  warranty_status text,
  response_minutes integer not null default 30 check (response_minutes > 0),
  arrival_minutes integer not null default 240 check (arrival_minutes > 0),
  resolution_minutes integer not null default 1440 check (resolution_minutes > 0),
  warning_minutes integer not null default 30 check (warning_minutes >= 0),
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.v13_sla_alerts (
  id uuid primary key default gen_random_uuid(),
  service_case_id uuid not null references public.v13_service_cases(id) on delete cascade,
  metric text not null check (metric in ('response','arrival','resolution','confirmation','closure')),
  severity text not null check (severity in ('warning','near_breach','breached','critical')),
  target_at timestamptz not null,
  detected_at timestamptz not null default timezone('utc', now()),
  acknowledged_by uuid references auth.users(id) on delete set null,
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  unique (service_case_id, metric, severity, target_at)
);

create index if not exists v13_sla_alerts_open_idx on public.v13_sla_alerts (severity, target_at) where resolved_at is null;

create or replace function public.v13_register_warranty(
  p_customer_id uuid,
  p_product_id uuid,
  p_invoice_id uuid,
  p_machine_serial text,
  p_machine_model text,
  p_machine_name text,
  p_sale_date date,
  p_installation_date date,
  p_warranty_start date,
  p_warranty_end date,
  p_engineer_service_end date,
  p_coverage jsonb default null,
  p_exclusions jsonb default null,
  p_terms text default null
)
returns public.v13_warranty_registrations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.v13_warranty_registrations;
  v_no text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.v12_has_role(array['owner','super_admin','admin','manager','service_manager','sales']) then
    raise exception 'Not authorized to register warranty';
  end if;
  if nullif(trim(p_machine_serial), '') is null then raise exception 'Machine serial is required'; end if;
  if nullif(trim(p_machine_model), '') is null then raise exception 'Machine model is required'; end if;
  if p_warranty_end < p_warranty_start then raise exception 'Warranty end date cannot be before start date'; end if;

  v_no := 'CJ-WAR-' || to_char(timezone('utc', now()), 'YYYYMMDDHH24MISS') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 5));

  insert into public.v13_warranty_registrations (
    warranty_no, customer_id, product_id, invoice_id, machine_serial, machine_model,
    machine_name, sale_date, installation_date, warranty_start, warranty_end,
    engineer_service_end, coverage, exclusions, terms, status, created_by
  ) values (
    v_no, p_customer_id, p_product_id, p_invoice_id, trim(p_machine_serial), trim(p_machine_model),
    nullif(trim(p_machine_name), ''), p_sale_date, p_installation_date, p_warranty_start, p_warranty_end,
    p_engineer_service_end,
    coalesce(p_coverage, '["mainboard","headboard","servo_motor","driver"]'::jsonb),
    coalesce(p_exclusions, '["printhead","small_spares","consumables","physical_damage","voltage_damage"]'::jsonb),
    p_terms, 'active', auth.uid()
  ) returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.v13_check_warranty(
  p_machine_serial text,
  p_check_date date default current_date
)
returns table (
  warranty_id uuid,
  warranty_no text,
  machine_serial text,
  machine_model text,
  validity text,
  warranty_start date,
  warranty_end date,
  remaining_days integer,
  coverage jsonb,
  exclusions jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select
    w.id,
    w.warranty_no,
    w.machine_serial,
    w.machine_model,
    case
      when w.status = 'void' then 'void'
      when w.status <> 'active' then w.status
      when p_check_date < w.warranty_start then 'not_started'
      when p_check_date <= w.warranty_end then 'valid'
      else 'expired'
    end,
    w.warranty_start,
    w.warranty_end,
    (w.warranty_end - p_check_date)::integer,
    w.coverage,
    w.exclusions
  from public.v13_warranty_registrations w
  where lower(trim(w.machine_serial)) = lower(trim(p_machine_serial))
  order by w.created_at desc
  limit 1;
$$;

create or replace function public.v13_create_service_case(
  p_customer_id uuid,
  p_product_id uuid,
  p_machine_serial text,
  p_machine_model text,
  p_customer_name text,
  p_customer_phone text,
  p_service_address text,
  p_subject text,
  p_problem_description text,
  p_problem_category text,
  p_service_type text,
  p_priority text,
  p_assigned_engineer_id uuid,
  p_scheduled_at timestamptz,
  p_response_minutes integer default 30,
  p_arrival_minutes integer default 240,
  p_resolution_minutes integer default 1440,
  p_legacy_ticket_id uuid default null,
  p_source text default 'mobile'
)
returns public.v13_service_cases
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.v13_service_cases;
  v_no text;
  v_warranty record;
  v_warranty_status text := 'unknown';
  v_warranty_id uuid;
  v_now timestamptz := timezone('utc', now());
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.v12_has_role(array['owner','super_admin','admin','manager','service_manager','sales','engineer']) then
    raise exception 'Not authorized to create service case';
  end if;
  if nullif(trim(p_customer_name), '') is null then raise exception 'Customer name is required'; end if;
  if nullif(trim(p_subject), '') is null then raise exception 'Subject is required'; end if;
  if nullif(trim(p_problem_description), '') is null then raise exception 'Problem description is required'; end if;
  if p_priority not in ('low','normal','high','urgent','emergency') then raise exception 'Invalid priority'; end if;
  if p_service_type not in ('onsite','remote','office_repair','supplier_repair','installation','training','preventive_maintenance') then raise exception 'Invalid service type'; end if;

  if nullif(trim(p_machine_serial), '') is not null then
    select * into v_warranty from public.v13_check_warranty(p_machine_serial, current_date) limit 1;
    if found then
      v_warranty_id := v_warranty.warranty_id;
      v_warranty_status := case when v_warranty.validity = 'valid' then 'in_warranty' when v_warranty.validity = 'void' then 'void' else 'out_warranty' end;
    end if;
  end if;

  v_no := 'CJ-SVC-' || to_char(v_now, 'YYYYMMDDHH24MISS') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 5));

  insert into public.v13_service_cases (
    case_no, legacy_ticket_id, warranty_id, customer_id, product_id, machine_serial,
    machine_model, customer_name, customer_phone, service_address, subject,
    problem_description, problem_category, service_type, warranty_status, billing_status,
    priority, status, assigned_engineer_id, scheduled_at, response_due_at,
    arrival_due_at, resolution_due_at, source, created_by
  ) values (
    v_no, p_legacy_ticket_id, v_warranty_id, p_customer_id, p_product_id, nullif(trim(p_machine_serial), ''),
    nullif(trim(p_machine_model), ''), trim(p_customer_name), nullif(trim(p_customer_phone), ''),
    nullif(trim(p_service_address), ''), trim(p_subject), trim(p_problem_description),
    nullif(trim(p_problem_category), ''), p_service_type, v_warranty_status,
    case when v_warranty_status = 'in_warranty' then 'warranty' else 'pending' end,
    p_priority, case when p_assigned_engineer_id is null then 'verified' else 'assigned' end,
    p_assigned_engineer_id, p_scheduled_at,
    v_now + make_interval(mins => greatest(1, coalesce(p_response_minutes, 30))),
    coalesce(p_scheduled_at, v_now) + make_interval(mins => greatest(1, coalesce(p_arrival_minutes, 240))),
    v_now + make_interval(mins => greatest(1, coalesce(p_resolution_minutes, 1440))),
    p_source, auth.uid()
  ) returning * into v_row;

  insert into public.v13_service_case_events (service_case_id, event_type, to_status, note, created_by)
  values (v_row.id, 'case_created', v_row.status, 'Service case created', auth.uid());

  return v_row;
end;
$$;

create or replace function public.v13_transition_service_case(
  p_service_case_id uuid,
  p_new_status text,
  p_note text default null,
  p_latitude double precision default null,
  p_longitude double precision default null,
  p_accuracy_m double precision default null,
  p_idempotency_key text default null
)
returns public.v13_service_cases
language plpgsql
security definer
set search_path = public
as $$
declare
  v_case public.v13_service_cases;
  v_old text;
  v_allowed boolean := false;
begin
  select * into v_case from public.v13_service_cases where id = p_service_case_id for update;
  if not found then raise exception 'Service case not found'; end if;

  if v_case.assigned_engineer_id <> auth.uid()
     and v_case.created_by <> auth.uid()
     and not public.v12_has_role(array['owner','super_admin','admin','manager','service_manager']) then
    raise exception 'Not authorized for this service case';
  end if;

  v_old := v_case.status;
  v_allowed := case v_old
    when 'new' then p_new_status = any(array['verified','assigned','cancelled'])
    when 'verified' then p_new_status = any(array['assigned','cancelled','escalated'])
    when 'assigned' then p_new_status = any(array['accepted','cancelled','escalated'])
    when 'accepted' then p_new_status = any(array['travelling','diagnosis','cancelled','escalated'])
    when 'travelling' then p_new_status = any(array['arrived','cancelled','escalated'])
    when 'arrived' then p_new_status = any(array['checked_in','diagnosis','cancelled'])
    when 'checked_in' then p_new_status = any(array['diagnosis','work_started','cancelled'])
    when 'diagnosis' then p_new_status = any(array['work_started','waiting_parts','waiting_customer','sent_supplier','completed','escalated'])
    when 'work_started' then p_new_status = any(array['waiting_parts','waiting_customer','sent_supplier','completed','escalated'])
    when 'waiting_parts' then p_new_status = any(array['work_resumed','cancelled','escalated'])
    when 'waiting_customer' then p_new_status = any(array['work_resumed','cancelled','escalated'])
    when 'sent_supplier' then p_new_status = any(array['work_resumed','completed','escalated'])
    when 'work_resumed' then p_new_status = any(array['waiting_parts','waiting_customer','sent_supplier','completed','escalated'])
    when 'completed' then p_new_status = any(array['customer_confirmed','reopened','escalated'])
    when 'customer_confirmed' then p_new_status = any(array['closed','reopened'])
    when 'closed' then p_new_status = 'reopened'
    when 'reopened' then p_new_status = any(array['assigned','diagnosis','work_started','cancelled','escalated'])
    when 'escalated' then p_new_status = any(array['assigned','diagnosis','work_started','waiting_parts','completed','cancelled'])
    when 'sla_breached' then p_new_status = any(array['escalated','assigned','work_started','completed','closed'])
    else false
  end;

  if p_new_status <> v_old and not v_allowed then
    raise exception 'Invalid service case transition: % -> %', v_old, p_new_status;
  end if;

  update public.v13_service_cases
  set status = p_new_status,
      accepted_at = case when p_new_status = 'accepted' then coalesce(accepted_at, timezone('utc', now())) else accepted_at end,
      travel_started_at = case when p_new_status = 'travelling' then coalesce(travel_started_at, timezone('utc', now())) else travel_started_at end,
      arrived_at = case when p_new_status = 'arrived' then coalesce(arrived_at, timezone('utc', now())) else arrived_at end,
      work_started_at = case when p_new_status in ('work_started','work_resumed') then coalesce(work_started_at, timezone('utc', now())) else work_started_at end,
      completed_at = case when p_new_status = 'completed' then coalesce(completed_at, timezone('utc', now())) else completed_at end,
      customer_confirmed_at = case when p_new_status = 'customer_confirmed' then coalesce(customer_confirmed_at, timezone('utc', now())) else customer_confirmed_at end,
      closed_at = case when p_new_status = 'closed' then coalesce(closed_at, timezone('utc', now())) else closed_at end
  where id = p_service_case_id
  returning * into v_case;

  insert into public.v13_service_case_events (
    service_case_id, event_type, from_status, to_status, note, latitude, longitude,
    accuracy_m, created_by, idempotency_key
  ) values (
    p_service_case_id, 'status_transition', v_old, p_new_status, p_note, p_latitude,
    p_longitude, p_accuracy_m, auth.uid(), p_idempotency_key
  ) on conflict (idempotency_key) do nothing;

  return v_case;
end;
$$;

create or replace function public.v13_refresh_sla_alerts()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  v_now timestamptz := timezone('utc', now());
begin
  insert into public.v13_sla_alerts (service_case_id, metric, severity, target_at, message)
  select c.id, 'response',
    case when v_now >= c.response_due_at then 'breached' else 'warning' end,
    c.response_due_at,
    case when v_now >= c.response_due_at then 'Response SLA breached for ' || c.case_no else 'Response SLA approaching for ' || c.case_no end
  from public.v13_service_cases c
  where c.status in ('new','verified','assigned')
    and c.response_due_at is not null
    and v_now >= c.response_due_at - interval '30 minutes'
  on conflict do nothing;
  get diagnostics v_count = row_count;

  insert into public.v13_sla_alerts (service_case_id, metric, severity, target_at, message)
  select c.id, 'arrival',
    case when v_now >= c.arrival_due_at then 'breached' else 'warning' end,
    c.arrival_due_at,
    case when v_now >= c.arrival_due_at then 'Arrival SLA breached for ' || c.case_no else 'Arrival SLA approaching for ' || c.case_no end
  from public.v13_service_cases c
  where c.status in ('assigned','accepted','travelling')
    and c.arrival_due_at is not null
    and v_now >= c.arrival_due_at - interval '30 minutes'
  on conflict do nothing;
  get diagnostics v_count = v_count + row_count;

  insert into public.v13_sla_alerts (service_case_id, metric, severity, target_at, message)
  select c.id, 'resolution',
    case when v_now >= c.resolution_due_at then 'critical' else 'near_breach' end,
    c.resolution_due_at,
    case when v_now >= c.resolution_due_at then 'Resolution SLA breached for ' || c.case_no else 'Resolution SLA approaching for ' || c.case_no end
  from public.v13_service_cases c
  where c.status not in ('completed','customer_confirmed','closed','cancelled')
    and c.resolution_due_at is not null
    and v_now >= c.resolution_due_at - interval '60 minutes'
  on conflict do nothing;
  get diagnostics v_count = v_count + row_count;

  update public.v13_service_cases c
  set status = 'sla_breached'
  where c.status not in ('completed','customer_confirmed','closed','cancelled','sla_breached')
    and c.resolution_due_at is not null
    and v_now >= c.resolution_due_at;

  update public.v13_sla_alerts a
  set resolved_at = v_now
  from public.v13_service_cases c
  where a.service_case_id = c.id
    and a.resolved_at is null
    and c.status in ('completed','customer_confirmed','closed','cancelled');

  return v_count;
end;
$$;

create or replace function public.v13_set_updated_at()
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

drop trigger if exists v13_warranty_updated_at on public.v13_warranty_registrations;
create trigger v13_warranty_updated_at before update on public.v13_warranty_registrations
for each row execute function public.v13_set_updated_at();

drop trigger if exists v13_service_case_updated_at on public.v13_service_cases;
create trigger v13_service_case_updated_at before update on public.v13_service_cases
for each row execute function public.v13_set_updated_at();

drop trigger if exists v13_warranty_claim_updated_at on public.v13_warranty_claims;
create trigger v13_warranty_claim_updated_at before update on public.v13_warranty_claims
for each row execute function public.v13_set_updated_at();

drop trigger if exists v13_sla_policy_updated_at on public.v13_sla_policies;
create trigger v13_sla_policy_updated_at before update on public.v13_sla_policies
for each row execute function public.v13_set_updated_at();

alter table public.v13_warranty_registrations enable row level security;
alter table public.v13_service_cases enable row level security;
alter table public.v13_service_case_events enable row level security;
alter table public.v13_service_checklist_items enable row level security;
alter table public.v13_service_attachments enable row level security;
alter table public.v13_warranty_claims enable row level security;
alter table public.v13_sla_policies enable row level security;
alter table public.v13_sla_alerts enable row level security;

drop policy if exists v13_warranty_read on public.v13_warranty_registrations;
create policy v13_warranty_read on public.v13_warranty_registrations for select to authenticated using (true);
drop policy if exists v13_warranty_write on public.v13_warranty_registrations;
create policy v13_warranty_write on public.v13_warranty_registrations for all to authenticated
using (public.v12_has_role(array['owner','super_admin','admin','manager','service_manager','sales']))
with check (public.v12_has_role(array['owner','super_admin','admin','manager','service_manager','sales']));

drop policy if exists v13_service_case_read on public.v13_service_cases;
create policy v13_service_case_read on public.v13_service_cases for select to authenticated
using (
  assigned_engineer_id = auth.uid()
  or created_by = auth.uid()
  or public.v12_has_role(array['owner','super_admin','admin','manager','service_manager','sales','accounts','store','auditor'])
);
drop policy if exists v13_service_case_insert on public.v13_service_cases;
create policy v13_service_case_insert on public.v13_service_cases for insert to authenticated
with check (created_by = auth.uid() or public.v12_has_role(array['owner','super_admin','admin','manager','service_manager'])));
drop policy if exists v13_service_case_update on public.v13_service_cases;
create policy v13_service_case_update on public.v13_service_cases for update to authenticated
using (assigned_engineer_id = auth.uid() or created_by = auth.uid() or public.v12_has_role(array['owner','super_admin','admin','manager','service_manager']))
with check (assigned_engineer_id = auth.uid() or created_by = auth.uid() or public.v12_has_role(array['owner','super_admin','admin','manager','service_manager']));

drop policy if exists v13_service_event_read on public.v13_service_case_events;
create policy v13_service_event_read on public.v13_service_case_events for select to authenticated
using (exists (
  select 1 from public.v13_service_cases c
  where c.id = service_case_id and (
    c.assigned_engineer_id = auth.uid() or c.created_by = auth.uid()
    or public.v12_has_role(array['owner','super_admin','admin','manager','service_manager','auditor'])
  )
));

drop policy if exists v13_service_checklist_rw on public.v13_service_checklist_items;
create policy v13_service_checklist_rw on public.v13_service_checklist_items for all to authenticated
using (exists (
  select 1 from public.v13_service_cases c where c.id = service_case_id
    and (c.assigned_engineer_id = auth.uid() or public.v12_has_role(array['owner','super_admin','admin','manager','service_manager']))
))
with check (exists (
  select 1 from public.v13_service_cases c where c.id = service_case_id
    and (c.assigned_engineer_id = auth.uid() or public.v12_has_role(array['owner','super_admin','admin','manager','service_manager']))
));

drop policy if exists v13_service_attachment_rw on public.v13_service_attachments;
create policy v13_service_attachment_rw on public.v13_service_attachments for all to authenticated
using (exists (
  select 1 from public.v13_service_cases c where c.id = service_case_id
    and (c.assigned_engineer_id = auth.uid() or c.created_by = auth.uid() or public.v12_has_role(array['owner','super_admin','admin','manager','service_manager']))
))
with check (exists (
  select 1 from public.v13_service_cases c where c.id = service_case_id
    and (c.assigned_engineer_id = auth.uid() or c.created_by = auth.uid() or public.v12_has_role(array['owner','super_admin','admin','manager','service_manager']))
));

drop policy if exists v13_warranty_claim_read on public.v13_warranty_claims;
create policy v13_warranty_claim_read on public.v13_warranty_claims for select to authenticated
using (created_by = auth.uid() or public.v12_has_role(array['owner','super_admin','admin','manager','service_manager','store','accounts','auditor']));
drop policy if exists v13_warranty_claim_write on public.v13_warranty_claims;
create policy v13_warranty_claim_write on public.v13_warranty_claims for all to authenticated
using (created_by = auth.uid() or public.v12_has_role(array['owner','super_admin','admin','manager','service_manager','store']))
with check (created_by = auth.uid() or public.v12_has_role(array['owner','super_admin','admin','manager','service_manager','store']));

drop policy if exists v13_sla_policy_read on public.v13_sla_policies;
create policy v13_sla_policy_read on public.v13_sla_policies for select to authenticated using (true);
drop policy if exists v13_sla_policy_write on public.v13_sla_policies;
create policy v13_sla_policy_write on public.v13_sla_policies for all to authenticated
using (public.v12_has_role(array['owner','super_admin','admin','manager','service_manager']))
with check (public.v12_has_role(array['owner','super_admin','admin','manager','service_manager']));

drop policy if exists v13_sla_alert_read on public.v13_sla_alerts;
create policy v13_sla_alert_read on public.v13_sla_alerts for select to authenticated
using (exists (
  select 1 from public.v13_service_cases c where c.id = service_case_id
    and (c.assigned_engineer_id = auth.uid() or public.v12_has_role(array['owner','super_admin','admin','manager','service_manager','auditor']))
));
drop policy if exists v13_sla_alert_update on public.v13_sla_alerts;
create policy v13_sla_alert_update on public.v13_sla_alerts for update to authenticated
using (public.v12_has_role(array['owner','super_admin','admin','manager','service_manager']))
with check (public.v12_has_role(array['owner','super_admin','admin','manager','service_manager']));

grant select, insert, update on public.v13_warranty_registrations to authenticated;
grant select, insert, update on public.v13_service_cases to authenticated;
grant select on public.v13_service_case_events to authenticated;
grant select, insert, update on public.v13_service_checklist_items to authenticated;
grant select, insert, update on public.v13_service_attachments to authenticated;
grant select, insert, update on public.v13_warranty_claims to authenticated;
grant select, insert, update on public.v13_sla_policies to authenticated;
grant select, update on public.v13_sla_alerts to authenticated;
grant execute on function public.v13_register_warranty(uuid,uuid,uuid,text,text,text,date,date,date,date,date,jsonb,jsonb,text) to authenticated;
grant execute on function public.v13_check_warranty(text,date) to authenticated;
grant execute on function public.v13_create_service_case(uuid,uuid,text,text,text,text,text,text,text,text,text,text,uuid,timestamptz,integer,integer,integer,uuid,text) to authenticated;
grant execute on function public.v13_transition_service_case(uuid,text,text,double precision,double precision,double precision,text) to authenticated;
grant execute on function public.v13_refresh_sla_alerts() to authenticated;

comment on table public.v13_service_cases is 'COLORJET V13 normalized service case source of truth; legacy ticket IDs are retained without modifying legacy tables.';
comment on table public.v13_warranty_registrations is 'Machine-serial based warranty registry with coverage and exclusions.';
comment on function public.v13_refresh_sla_alerts() is 'Creates deduplicated response, arrival and resolution alerts and marks breached cases.';
