-- COLORJET ERP V12 Phase 2: Service Ticket + Warranty Registration
-- Stacked on V12 Engineer Operations. Odoo integration remains untouched.

create extension if not exists pgcrypto;

create table if not exists public.v12_customer_assets (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid,
  asset_no text not null unique,
  machine_brand text,
  machine_model text not null,
  machine_serial text not null,
  installation_date date,
  warranty_start_date date,
  warranty_end_date date,
  warranty_status text not null default 'pending' check (warranty_status in ('pending','active','expired','void','replaced','extended')),
  installation_engineer_id uuid references auth.users(id) on delete set null,
  location_address text,
  latitude double precision,
  longitude double precision,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (machine_serial)
);

create table if not exists public.v12_warranty_registrations (
  id uuid primary key default gen_random_uuid(),
  warranty_no text not null unique,
  asset_id uuid not null references public.v12_customer_assets(id) on delete restrict,
  customer_id uuid,
  sales_order_id uuid,
  invoice_id uuid,
  registration_date date not null default current_date,
  warranty_start_date date not null,
  warranty_end_date date not null,
  coverage_type text not null default 'standard' check (coverage_type in ('standard','extended','amc','service_only','parts_only')),
  engineer_service_months integer not null default 12 check (engineer_service_months >= 0),
  covered_parts text[] not null default array['Mainboard','Headboard','Servo Motor','Driver']::text[],
  excluded_parts text[] not null default array['Printhead','Small spare parts','Consumables']::text[],
  terms text,
  status text not null default 'active' check (status in ('draft','active','expired','suspended','void','replaced','closed')),
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.v12_service_tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_no text not null unique,
  customer_id uuid,
  asset_id uuid references public.v12_customer_assets(id) on delete set null,
  warranty_registration_id uuid references public.v12_warranty_registrations(id) on delete set null,
  source text not null default 'admin' check (source in ('admin','engineer','customer','phone','whatsapp','email','website','system')),
  ticket_type text not null default 'service' check (ticket_type in ('service','warranty','installation','training','inspection','complaint','repair','replacement')),
  title text not null,
  description text not null,
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent','emergency')),
  status text not null default 'open' check (status in (
    'draft','open','triage','assigned','accepted','travelling','arrived','checked_in','diagnosing',
    'work_started','waiting_parts','waiting_customer','waiting_supplier','follow_up','resolved',
    'customer_confirmed','closed','cancelled','rejected','escalated','sla_breached'
  )),
  warranty_decision text not null default 'pending' check (warranty_decision in ('pending','covered','partially_covered','not_covered','expired','void')),
  warranty_reason text,
  customer_name text not null,
  contact_person text,
  customer_phone text,
  service_address text not null,
  problem_category text,
  machine_brand text,
  machine_model text,
  machine_serial text,
  assigned_engineer_id uuid references auth.users(id) on delete set null,
  assigned_by uuid references auth.users(id) on delete set null,
  assigned_at timestamptz,
  planned_start timestamptz,
  response_due_at timestamptz,
  arrival_due_at timestamptz,
  resolution_due_at timestamptz,
  resolved_at timestamptz,
  customer_confirmed_at timestamptz,
  closed_at timestamptz,
  estimated_cost numeric(14,2) not null default 0,
  approved_cost numeric(14,2) not null default 0,
  final_cost numeric(14,2) not null default 0,
  currency text not null default 'BDT',
  follow_up_at timestamptz,
  cancellation_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists v12_service_tickets_status_idx on public.v12_service_tickets (status, priority, created_at desc);
create index if not exists v12_service_tickets_engineer_idx on public.v12_service_tickets (assigned_engineer_id, status, planned_start);
create index if not exists v12_service_tickets_customer_idx on public.v12_service_tickets (customer_id, created_at desc);
create index if not exists v12_service_tickets_asset_idx on public.v12_service_tickets (asset_id, created_at desc);
create index if not exists v12_service_tickets_sla_idx on public.v12_service_tickets (resolution_due_at, status);

create table if not exists public.v12_service_ticket_events (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.v12_service_tickets(id) on delete cascade,
  event_type text not null,
  from_status text,
  to_status text,
  note text,
  actor_id uuid references auth.users(id) on delete set null default auth.uid(),
  latitude double precision,
  longitude double precision,
  captured_at timestamptz not null default timezone('utc', now()),
  server_received_at timestamptz not null default timezone('utc', now()),
  idempotency_key text unique,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists v12_service_ticket_events_ticket_idx on public.v12_service_ticket_events (ticket_id, captured_at desc);

create table if not exists public.v12_service_diagnostics (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.v12_service_tickets(id) on delete cascade,
  visit_id uuid references public.v12_customer_visits(id) on delete set null,
  engineer_id uuid not null references auth.users(id) on delete restrict default auth.uid(),
  problem_found text not null,
  root_cause text,
  work_done text,
  pending_issue text,
  revisit_required boolean not null default false,
  recommendation text,
  machine_running_status text check (machine_running_status in ('running','partially_running','stopped','not_tested')),
  customer_rating integer check (customer_rating between 1 and 5),
  customer_comment text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.v12_service_attachments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.v12_service_tickets(id) on delete cascade,
  diagnostic_id uuid references public.v12_service_diagnostics(id) on delete cascade,
  attachment_type text not null check (attachment_type in ('before','problem','serial','parts','after','signature','document','invoice','warranty_card','other')),
  storage_path text not null,
  file_name text,
  mime_type text,
  size_bytes bigint,
  captured_at timestamptz,
  uploaded_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.v12_warranty_claims (
  id uuid primary key default gen_random_uuid(),
  claim_no text not null unique,
  ticket_id uuid not null references public.v12_service_tickets(id) on delete restrict,
  warranty_registration_id uuid references public.v12_warranty_registrations(id) on delete set null,
  asset_id uuid references public.v12_customer_assets(id) on delete set null,
  claim_type text not null check (claim_type in ('repair','replacement','parts','service','supplier_claim')),
  claim_status text not null default 'submitted' check (claim_status in ('draft','submitted','under_review','approved','partially_approved','rejected','parts_waiting','repairing','replaced','completed','closed','cancelled')),
  claimed_amount numeric(14,2) not null default 0,
  approved_amount numeric(14,2) not null default 0,
  customer_charge numeric(14,2) not null default 0,
  supplier_recovery_amount numeric(14,2) not null default 0,
  decision_reason text,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  completed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.v12_service_cost_lines (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.v12_service_tickets(id) on delete cascade,
  claim_id uuid references public.v12_warranty_claims(id) on delete set null,
  line_type text not null check (line_type in ('engineer_service','spare_part','transport','courier','air_freight','agency','door_to_door','labour','supplier_repair','replacement','other')),
  description text not null,
  quantity numeric(14,3) not null default 1 check (quantity > 0),
  unit_cost numeric(14,2) not null default 0,
  total_cost numeric(14,2) generated always as (quantity * unit_cost) stored,
  billing_type text not null default 'warranty' check (billing_type in ('warranty','free','chargeable','supplier_recoverable','internal')),
  product_id uuid,
  request_item_id uuid references public.v12_parts_request_items(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.v12_sla_alerts (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.v12_service_tickets(id) on delete cascade,
  metric text not null check (metric in ('response','assignment','acceptance','arrival','work_start','resolution','customer_confirmation','closure')),
  severity text not null check (severity in ('info','warning','near_breach','breached','critical')),
  status text not null default 'open' check (status in ('open','acknowledged','resolved','suppressed')),
  due_at timestamptz not null,
  detected_at timestamptz not null default timezone('utc', now()),
  acknowledged_by uuid references auth.users(id) on delete set null,
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  message text not null,
  notification_payload jsonb not null default '{}'::jsonb,
  unique (ticket_id, metric, severity, due_at)
);

create index if not exists v12_sla_alerts_open_idx on public.v12_sla_alerts (status, severity, due_at);

create or replace function public.v12p2_set_updated_at()
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

create or replace function public.v12p2_ticket_number()
returns text
language sql
volatile
set search_path = public
as $$
  select 'CJ-SRV-' || to_char(timezone('utc', now()), 'YYYYMMDDHH24MISS') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 5));
$$;

create or replace function public.v12p2_warranty_number()
returns text
language sql
volatile
set search_path = public
as $$
  select 'CJ-WAR-' || to_char(timezone('utc', now()), 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
$$;

create or replace function public.v12p2_claim_number()
returns text
language sql
volatile
set search_path = public
as $$
  select 'CJ-CLM-' || to_char(timezone('utc', now()), 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
$$;

create or replace function public.v12p2_create_service_ticket(
  p_customer_id uuid,
  p_asset_id uuid,
  p_ticket_type text,
  p_title text,
  p_description text,
  p_priority text,
  p_customer_name text,
  p_contact_person text,
  p_customer_phone text,
  p_service_address text,
  p_problem_category text,
  p_assigned_engineer_id uuid,
  p_planned_start timestamptz,
  p_response_minutes integer,
  p_arrival_minutes integer,
  p_resolution_minutes integer,
  p_source text default 'admin'
)
returns public.v12_service_tickets
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ticket public.v12_service_tickets;
  v_warranty public.v12_warranty_registrations;
  v_asset public.v12_customer_assets;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.v12_has_role(array['owner','super_admin','admin','manager','service_manager','service_control','engineer']) then
    raise exception 'Not authorized to create service tickets';
  end if;
  if nullif(trim(p_title), '') is null or nullif(trim(p_description), '') is null then
    raise exception 'Title and description are required';
  end if;
  if p_priority not in ('low','normal','high','urgent','emergency') then raise exception 'Invalid priority'; end if;

  if p_asset_id is not null then
    select * into v_asset from public.v12_customer_assets where id = p_asset_id;
    select * into v_warranty
    from public.v12_warranty_registrations
    where asset_id = p_asset_id and status = 'active'
      and current_date between warranty_start_date and warranty_end_date
    order by warranty_end_date desc
    limit 1;
  end if;

  insert into public.v12_service_tickets (
    ticket_no, customer_id, asset_id, warranty_registration_id, source, ticket_type,
    title, description, priority, status, warranty_decision, customer_name,
    contact_person, customer_phone, service_address, problem_category,
    machine_brand, machine_model, machine_serial, assigned_engineer_id,
    assigned_by, assigned_at, planned_start, response_due_at, arrival_due_at,
    resolution_due_at, created_by
  ) values (
    public.v12p2_ticket_number(), p_customer_id, p_asset_id, v_warranty.id, p_source, p_ticket_type,
    trim(p_title), trim(p_description), p_priority,
    case when p_assigned_engineer_id is null then 'open' else 'assigned' end,
    case when v_warranty.id is null then 'pending' else 'covered' end,
    trim(p_customer_name), nullif(trim(p_contact_person), ''), nullif(trim(p_customer_phone), ''),
    trim(p_service_address), nullif(trim(p_problem_category), ''),
    v_asset.machine_brand, v_asset.machine_model, v_asset.machine_serial,
    p_assigned_engineer_id,
    case when p_assigned_engineer_id is null then null else auth.uid() end,
    case when p_assigned_engineer_id is null then null else timezone('utc', now()) end,
    p_planned_start,
    timezone('utc', now()) + make_interval(mins => greatest(coalesce(p_response_minutes, 30), 1)),
    timezone('utc', now()) + make_interval(mins => greatest(coalesce(p_arrival_minutes, 240), 1)),
    timezone('utc', now()) + make_interval(mins => greatest(coalesce(p_resolution_minutes, 1440), 1)),
    auth.uid()
  ) returning * into v_ticket;

  insert into public.v12_service_ticket_events(ticket_id, event_type, to_status, note, actor_id)
  values (v_ticket.id, 'created', v_ticket.status, 'Service ticket created', auth.uid());

  return v_ticket;
end;
$$;

create or replace function public.v12p2_transition_service_ticket(
  p_ticket_id uuid,
  p_new_status text,
  p_note text default null,
  p_latitude double precision default null,
  p_longitude double precision default null,
  p_idempotency_key text default null
)
returns public.v12_service_tickets
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ticket public.v12_service_tickets;
  v_old_status text;
  v_allowed boolean := false;
begin
  select * into v_ticket from public.v12_service_tickets where id = p_ticket_id for update;
  if not found then raise exception 'Service ticket not found'; end if;
  if v_ticket.assigned_engineer_id <> auth.uid()
     and not public.v12_has_role(array['owner','super_admin','admin','manager','service_manager','service_control']) then
    raise exception 'Not authorized for this ticket';
  end if;

  v_old_status := v_ticket.status;
  v_allowed := case v_old_status
    when 'draft' then p_new_status = any(array['open','cancelled'])
    when 'open' then p_new_status = any(array['triage','assigned','cancelled','rejected'])
    when 'triage' then p_new_status = any(array['assigned','waiting_customer','cancelled','escalated'])
    when 'assigned' then p_new_status = any(array['accepted','rejected','cancelled','escalated'])
    when 'accepted' then p_new_status = any(array['travelling','cancelled','escalated'])
    when 'travelling' then p_new_status = any(array['arrived','cancelled','escalated'])
    when 'arrived' then p_new_status = any(array['checked_in','cancelled'])
    when 'checked_in' then p_new_status = any(array['diagnosing','work_started','cancelled'])
    when 'diagnosing' then p_new_status = any(array['work_started','waiting_parts','waiting_customer','waiting_supplier','follow_up','escalated'])
    when 'work_started' then p_new_status = any(array['waiting_parts','waiting_customer','waiting_supplier','follow_up','resolved','escalated'])
    when 'waiting_parts' then p_new_status = any(array['work_started','follow_up','cancelled','escalated'])
    when 'waiting_customer' then p_new_status = any(array['work_started','follow_up','cancelled'])
    when 'waiting_supplier' then p_new_status = any(array['work_started','waiting_parts','follow_up','cancelled','escalated'])
    when 'follow_up' then p_new_status = any(array['assigned','work_started','resolved','cancelled'])
    when 'resolved' then p_new_status = any(array['customer_confirmed','follow_up','escalated'])
    when 'customer_confirmed' then p_new_status = any(array['closed','follow_up'])
    when 'escalated' then p_new_status = any(array['assigned','work_started','waiting_parts','resolved','cancelled'])
    when 'sla_breached' then p_new_status = any(array['escalated','work_started','resolved','closed'])
    else false
  end;

  if p_new_status <> v_old_status and not v_allowed then
    raise exception 'Invalid service ticket transition: % -> %', v_old_status, p_new_status;
  end if;

  update public.v12_service_tickets
  set status = p_new_status,
      assigned_at = case when p_new_status = 'assigned' then coalesce(assigned_at, timezone('utc', now())) else assigned_at end,
      resolved_at = case when p_new_status = 'resolved' then coalesce(resolved_at, timezone('utc', now())) else resolved_at end,
      customer_confirmed_at = case when p_new_status = 'customer_confirmed' then coalesce(customer_confirmed_at, timezone('utc', now())) else customer_confirmed_at end,
      closed_at = case when p_new_status = 'closed' then coalesce(closed_at, timezone('utc', now())) else closed_at end
  where id = p_ticket_id
  returning * into v_ticket;

  insert into public.v12_service_ticket_events(
    ticket_id,event_type,from_status,to_status,note,actor_id,latitude,longitude,idempotency_key
  ) values (
    p_ticket_id,'status_transition',v_old_status,p_new_status,p_note,auth.uid(),p_latitude,p_longitude,p_idempotency_key
  ) on conflict (idempotency_key) do nothing;

  return v_ticket;
end;
$$;

create or replace function public.v12p2_scan_sla_breaches()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
begin
  insert into public.v12_sla_alerts(ticket_id, metric, severity, due_at, message, notification_payload)
  select t.id, 'response',
         case when now() > t.response_due_at then 'breached' else 'near_breach' end,
         t.response_due_at,
         case when now() > t.response_due_at then 'Response SLA breached' else 'Response SLA near breach' end,
         jsonb_build_object('ticket_no', t.ticket_no, 'priority', t.priority, 'status', t.status)
  from public.v12_service_tickets t
  where t.status in ('open','triage','assigned')
    and t.response_due_at is not null
    and t.response_due_at <= now() + interval '30 minutes'
  on conflict do nothing;

  get diagnostics v_count = row_count;

  insert into public.v12_sla_alerts(ticket_id, metric, severity, due_at, message, notification_payload)
  select t.id, 'resolution',
         case when now() > t.resolution_due_at then 'critical' else 'near_breach' end,
         t.resolution_due_at,
         case when now() > t.resolution_due_at then 'Resolution SLA breached' else 'Resolution SLA near breach' end,
         jsonb_build_object('ticket_no', t.ticket_no, 'priority', t.priority, 'status', t.status)
  from public.v12_service_tickets t
  where t.status not in ('resolved','customer_confirmed','closed','cancelled','rejected')
    and t.resolution_due_at is not null
    and t.resolution_due_at <= now() + interval '60 minutes'
  on conflict do nothing;

  update public.v12_service_tickets t
  set status = 'sla_breached'
  where t.status not in ('resolved','customer_confirmed','closed','cancelled','rejected','sla_breached')
    and t.resolution_due_at is not null
    and t.resolution_due_at < now();

  return v_count;
end;
$$;

create or replace function public.v12p2_register_warranty(
  p_asset_id uuid,
  p_customer_id uuid,
  p_start_date date,
  p_end_date date,
  p_coverage_type text,
  p_engineer_service_months integer,
  p_covered_parts text[],
  p_excluded_parts text[],
  p_terms text
)
returns public.v12_warranty_registrations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_warranty public.v12_warranty_registrations;
begin
  if not public.v12_has_role(array['owner','super_admin','admin','manager','service_manager','service_control']) then
    raise exception 'Not authorized to register warranty';
  end if;
  if p_end_date < p_start_date then raise exception 'Warranty end date cannot be before start date'; end if;

  insert into public.v12_warranty_registrations(
    warranty_no,asset_id,customer_id,warranty_start_date,warranty_end_date,
    coverage_type,engineer_service_months,covered_parts,excluded_parts,terms,
    status,approved_by,approved_at,created_by
  ) values (
    public.v12p2_warranty_number(),p_asset_id,p_customer_id,p_start_date,p_end_date,
    p_coverage_type,greatest(coalesce(p_engineer_service_months,12),0),
    coalesce(p_covered_parts,array['Mainboard','Headboard','Servo Motor','Driver']::text[]),
    coalesce(p_excluded_parts,array['Printhead','Small spare parts','Consumables']::text[]),
    p_terms,'active',auth.uid(),timezone('utc',now()),auth.uid()
  ) returning * into v_warranty;

  update public.v12_customer_assets
  set warranty_start_date = p_start_date,
      warranty_end_date = p_end_date,
      warranty_status = case when current_date between p_start_date and p_end_date then 'active' else 'pending' end
  where id = p_asset_id;

  return v_warranty;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'v12_customer_assets_updated_at') then
    create trigger v12_customer_assets_updated_at before update on public.v12_customer_assets
    for each row execute function public.v12p2_set_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'v12_warranty_registrations_updated_at') then
    create trigger v12_warranty_registrations_updated_at before update on public.v12_warranty_registrations
    for each row execute function public.v12p2_set_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'v12_service_tickets_updated_at') then
    create trigger v12_service_tickets_updated_at before update on public.v12_service_tickets
    for each row execute function public.v12p2_set_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'v12_service_diagnostics_updated_at') then
    create trigger v12_service_diagnostics_updated_at before update on public.v12_service_diagnostics
    for each row execute function public.v12p2_set_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'v12_warranty_claims_updated_at') then
    create trigger v12_warranty_claims_updated_at before update on public.v12_warranty_claims
    for each row execute function public.v12p2_set_updated_at();
  end if;
end;
$$;

alter table public.v12_customer_assets enable row level security;
alter table public.v12_warranty_registrations enable row level security;
alter table public.v12_service_tickets enable row level security;
alter table public.v12_service_ticket_events enable row level security;
alter table public.v12_service_diagnostics enable row level security;
alter table public.v12_service_attachments enable row level security;
alter table public.v12_warranty_claims enable row level security;
alter table public.v12_service_cost_lines enable row level security;
alter table public.v12_sla_alerts enable row level security;

create policy v12_assets_read on public.v12_customer_assets for select to authenticated using (true);
create policy v12_assets_write on public.v12_customer_assets for all to authenticated
using (public.v12_has_role(array['owner','super_admin','admin','manager','service_manager','service_control']))
with check (public.v12_has_role(array['owner','super_admin','admin','manager','service_manager','service_control']));

create policy v12_warranty_read on public.v12_warranty_registrations for select to authenticated using (true);
create policy v12_warranty_write on public.v12_warranty_registrations for all to authenticated
using (public.v12_has_role(array['owner','super_admin','admin','manager','service_manager','service_control']))
with check (public.v12_has_role(array['owner','super_admin','admin','manager','service_manager','service_control']));

create policy v12_service_tickets_read on public.v12_service_tickets for select to authenticated
using (
  assigned_engineer_id = auth.uid()
  or created_by = auth.uid()
  or public.v12_has_role(array['owner','super_admin','admin','manager','service_manager','service_control','store','accounts','auditor'])
);

create policy v12_service_tickets_write on public.v12_service_tickets for update to authenticated
using (
  assigned_engineer_id = auth.uid()
  or public.v12_has_role(array['owner','super_admin','admin','manager','service_manager','service_control'])
)
with check (
  assigned_engineer_id = auth.uid()
  or public.v12_has_role(array['owner','super_admin','admin','manager','service_manager','service_control'])
);

create policy v12_service_events_read on public.v12_service_ticket_events for select to authenticated
using (exists (
  select 1 from public.v12_service_tickets t where t.id = ticket_id and (
    t.assigned_engineer_id = auth.uid()
    or public.v12_has_role(array['owner','super_admin','admin','manager','service_manager','service_control','auditor'])
  )
));

create policy v12_service_diagnostics_read on public.v12_service_diagnostics for select to authenticated
using (engineer_id = auth.uid() or public.v12_has_role(array['owner','super_admin','admin','manager','service_manager','service_control','auditor']));
create policy v12_service_diagnostics_write on public.v12_service_diagnostics for all to authenticated
using (engineer_id = auth.uid() or public.v12_has_role(array['owner','super_admin','admin','manager','service_manager','service_control']))
with check (engineer_id = auth.uid() or public.v12_has_role(array['owner','super_admin','admin','manager','service_manager','service_control']));

create policy v12_service_attachments_read on public.v12_service_attachments for select to authenticated
using (exists (
  select 1 from public.v12_service_tickets t where t.id = ticket_id and (
    t.assigned_engineer_id = auth.uid()
    or public.v12_has_role(array['owner','super_admin','admin','manager','service_manager','service_control','auditor'])
  )
));
create policy v12_service_attachments_write on public.v12_service_attachments for insert to authenticated with check (uploaded_by = auth.uid());

create policy v12_warranty_claims_read on public.v12_warranty_claims for select to authenticated using (true);
create policy v12_warranty_claims_write on public.v12_warranty_claims for all to authenticated
using (public.v12_has_role(array['owner','super_admin','admin','manager','service_manager','service_control','accounts']))
with check (public.v12_has_role(array['owner','super_admin','admin','manager','service_manager','service_control','accounts']));

create policy v12_service_cost_read on public.v12_service_cost_lines for select to authenticated using (true);
create policy v12_service_cost_write on public.v12_service_cost_lines for all to authenticated
using (public.v12_has_role(array['owner','super_admin','admin','manager','service_manager','service_control','accounts','store']))
with check (public.v12_has_role(array['owner','super_admin','admin','manager','service_manager','service_control','accounts','store']));

create policy v12_sla_alerts_read on public.v12_sla_alerts for select to authenticated
using (public.v12_has_role(array['owner','super_admin','admin','manager','service_manager','service_control','auditor']))
;
create policy v12_sla_alerts_write on public.v12_sla_alerts for update to authenticated
using (public.v12_has_role(array['owner','super_admin','admin','manager','service_manager','service_control']))
with check (public.v12_has_role(array['owner','super_admin','admin','manager','service_manager','service_control']));

grant select, insert, update on public.v12_customer_assets to authenticated;
grant select, insert, update on public.v12_warranty_registrations to authenticated;
grant select, update on public.v12_service_tickets to authenticated;
grant select on public.v12_service_ticket_events to authenticated;
grant select, insert, update on public.v12_service_diagnostics to authenticated;
grant select, insert on public.v12_service_attachments to authenticated;
grant select, insert, update on public.v12_warranty_claims to authenticated;
grant select, insert, update on public.v12_service_cost_lines to authenticated;
grant select, update on public.v12_sla_alerts to authenticated;

grant execute on function public.v12p2_create_service_ticket(uuid,uuid,text,text,text,text,text,text,text,text,text,uuid,timestamptz,integer,integer,integer,text) to authenticated;
grant execute on function public.v12p2_transition_service_ticket(uuid,text,text,double precision,double precision,text) to authenticated;
grant execute on function public.v12p2_register_warranty(uuid,uuid,date,date,text,integer,text[],text[],text) to authenticated;
grant execute on function public.v12p2_scan_sla_breaches() to authenticated;

comment on table public.v12_service_tickets is 'COLORJET production service ticket source of truth with warranty and SLA controls.';
comment on table public.v12_warranty_registrations is 'Machine warranty registration, coverage, exclusions and approval record.';
comment on function public.v12p2_scan_sla_breaches() is 'Creates automatic SLA warning/breach alerts and marks overdue active tickets.';
