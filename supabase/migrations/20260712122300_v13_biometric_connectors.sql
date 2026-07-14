-- COLORJET ERP V13: Vendor-neutral Biometric Connector Registry
-- Device credentials are referenced by secret name only; no secret value is stored here.

create table if not exists public.v13_biometric_connectors (
  id uuid primary key default gen_random_uuid(),
  connector_code text not null unique,
  name text not null,
  vendor text not null,
  connector_type text not null
    check (connector_type in (
      'GENERIC_WEBHOOK','ZK_PUSH_GATEWAY','ZK_TCP_GATEWAY',
      'CSV_IMPORT','REST_API','SDK_GATEWAY'
    )),
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
  port integer check (port is null or port between 1 and 65535),
  active boolean not null default true,
  last_seen_at timestamptz,
  firmware_version text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (connector_id, device_code)
);

create index if not exists v13_biometric_devices_connector_idx
  on public.v13_biometric_devices (connector_id, active);

create table if not exists public.v13_biometric_employee_mappings (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.v13_biometric_devices(id) on delete cascade,
  device_user_code text not null,
  employee_id uuid not null references auth.users(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  unique (device_id, device_user_code)
);

create index if not exists v13_biometric_mapping_employee_idx
  on public.v13_biometric_employee_mappings (employee_id, active);

create table if not exists public.v13_biometric_events (
  id uuid primary key default gen_random_uuid(),
  device_id uuid references public.v13_biometric_devices(id) on delete set null,
  connector_id uuid references public.v13_biometric_connectors(id) on delete set null,
  employee_id uuid references auth.users(id) on delete set null,
  device_user_code text not null,
  event_time timestamptz not null,
  event_type text not null default 'punch'
    check (event_type in ('punch','check_in','check_out','break_start','break_end','unknown')),
  verify_mode text,
  work_code text,
  device_event_id text,
  raw_payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default timezone('utc', now()),
  processed boolean not null default false,
  processing_error text,
  idempotency_key text not null unique
);

create index if not exists v13_biometric_events_employee_idx
  on public.v13_biometric_events (employee_id, event_time desc);
create index if not exists v13_biometric_events_unprocessed_idx
  on public.v13_biometric_events (received_at)
  where processed = false;

create table if not exists public.v13_biometric_sync_runs (
  id uuid primary key default gen_random_uuid(),
  connector_id uuid not null references public.v13_biometric_connectors(id) on delete cascade,
  started_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz,
  status text not null default 'running'
    check (status in ('running','success','partial','failed','cancelled')),
  fetched_count integer not null default 0,
  inserted_count integer not null default 0,
  duplicate_count integer not null default 0,
  error_count integer not null default 0,
  error_message text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists v13_biometric_sync_runs_idx
  on public.v13_biometric_sync_runs (connector_id, started_at desc);

create or replace function public.v13_biometric_updated_at()
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

drop trigger if exists v13_biometric_connector_updated_at
  on public.v13_biometric_connectors;
create trigger v13_biometric_connector_updated_at
before update on public.v13_biometric_connectors
for each row execute function public.v13_biometric_updated_at();

drop trigger if exists v13_biometric_device_updated_at
  on public.v13_biometric_devices;
create trigger v13_biometric_device_updated_at
before update on public.v13_biometric_devices
for each row execute function public.v13_biometric_updated_at();

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
language plpgsql
security definer
set search_path = public
as $$
declare
  v_connector public.v13_biometric_connectors;
  v_device public.v13_biometric_devices;
  v_employee uuid;
  v_id uuid;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception 'Biometric ingestion requires service role';
  end if;
  if nullif(trim(p_connector_code), '') is null
     or nullif(trim(p_device_code), '') is null
     or nullif(trim(p_device_user_code), '') is null
     or nullif(trim(p_idempotency_key), '') is null then
    raise exception 'Connector, device, user and idempotency key are required';
  end if;

  select * into v_connector
  from public.v13_biometric_connectors
  where connector_code = upper(trim(p_connector_code))
    and active = true;

  if not found then
    raise exception 'Active biometric connector not found';
  end if;

  select * into v_device
  from public.v13_biometric_devices
  where connector_id = v_connector.id
    and device_code = trim(p_device_code)
    and active = true;

  if not found then
    raise exception 'Active biometric device not found';
  end if;

  select employee_id into v_employee
  from public.v13_biometric_employee_mappings
  where device_id = v_device.id
    and device_user_code = trim(p_device_user_code)
    and active = true;

  insert into public.v13_biometric_events (
    device_id, connector_id, employee_id, device_user_code,
    event_time, event_type, verify_mode, work_code,
    device_event_id, raw_payload, idempotency_key
  ) values (
    v_device.id,
    v_connector.id,
    v_employee,
    trim(p_device_user_code),
    p_event_time,
    case
      when p_event_type in ('punch','check_in','check_out','break_start','break_end','unknown')
        then p_event_type
      else 'unknown'
    end,
    nullif(trim(p_verify_mode), ''),
    nullif(trim(p_work_code), ''),
    nullif(trim(p_device_event_id), ''),
    coalesce(p_raw_payload, '{}'::jsonb),
    trim(p_idempotency_key)
  )
  on conflict (idempotency_key)
  do update set idempotency_key = excluded.idempotency_key
  returning id into v_id;

  update public.v13_biometric_devices
  set last_seen_at = timezone('utc', now())
  where id = v_device.id;

  update public.v13_biometric_connectors
  set last_sync_at = timezone('utc', now()),
      last_success_at = timezone('utc', now()),
      last_error = null
  where id = v_connector.id;

  return v_id;
end;
$$;

create or replace function public.v13_process_biometric_event(
  p_event_id uuid
)
returns public.v13_biometric_events
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.v13_biometric_events;
  v_error text;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
     and not public.v12_has_role(array['owner','super_admin','admin','accounts']) then
    raise exception 'Not authorized to process biometric event';
  end if;

  select * into v_event
  from public.v13_biometric_events
  where id = p_event_id
  for update;

  if not found then
    raise exception 'Biometric event not found';
  end if;
  if v_event.processed then
    return v_event;
  end if;

  if v_event.employee_id is null then
    v_error := 'Device user is not mapped to an employee';
  end if;

  update public.v13_biometric_events
  set processed = v_error is null,
      processing_error = v_error
  where id = p_event_id
  returning * into v_event;

  return v_event;
end;
$$;

alter table public.v13_biometric_connectors enable row level security;
alter table public.v13_biometric_devices enable row level security;
alter table public.v13_biometric_employee_mappings enable row level security;
alter table public.v13_biometric_events enable row level security;
alter table public.v13_biometric_sync_runs enable row level security;

drop policy if exists v13_biometric_connectors_read on public.v13_biometric_connectors;
create policy v13_biometric_connectors_read
on public.v13_biometric_connectors for select to authenticated
using (public.v12_has_role(array['owner','super_admin','admin','manager','accounts','auditor']));

drop policy if exists v13_biometric_connectors_write on public.v13_biometric_connectors;
create policy v13_biometric_connectors_write
on public.v13_biometric_connectors for all to authenticated
using (public.v12_has_role(array['owner','super_admin','admin']))
with check (public.v12_has_role(array['owner','super_admin','admin']));

drop policy if exists v13_biometric_devices_read on public.v13_biometric_devices;
create policy v13_biometric_devices_read
on public.v13_biometric_devices for select to authenticated
using (public.v12_has_role(array['owner','super_admin','admin','manager','accounts','auditor']));

drop policy if exists v13_biometric_devices_write on public.v13_biometric_devices;
create policy v13_biometric_devices_write
on public.v13_biometric_devices for all to authenticated
using (public.v12_has_role(array['owner','super_admin','admin']))
with check (public.v12_has_role(array['owner','super_admin','admin']));

drop policy if exists v13_biometric_mappings_read on public.v13_biometric_employee_mappings;
create policy v13_biometric_mappings_read
on public.v13_biometric_employee_mappings for select to authenticated
using (
  employee_id = auth.uid()
  or public.v12_has_role(array['owner','super_admin','admin','manager','accounts','auditor'])
);

drop policy if exists v13_biometric_mappings_write on public.v13_biometric_employee_mappings;
create policy v13_biometric_mappings_write
on public.v13_biometric_employee_mappings for all to authenticated
using (public.v12_has_role(array['owner','super_admin','admin']))
with check (public.v12_has_role(array['owner','super_admin','admin']));

drop policy if exists v13_biometric_events_read on public.v13_biometric_events;
create policy v13_biometric_events_read
on public.v13_biometric_events for select to authenticated
using (
  employee_id = auth.uid()
  or public.v12_has_role(array['owner','super_admin','admin','manager','accounts','auditor'])
);

drop policy if exists v13_biometric_sync_read on public.v13_biometric_sync_runs;
create policy v13_biometric_sync_read
on public.v13_biometric_sync_runs for select to authenticated
using (public.v12_has_role(array['owner','super_admin','admin','manager','accounts','auditor']));

grant select, insert, update on public.v13_biometric_connectors to authenticated;
grant select, insert, update on public.v13_biometric_devices to authenticated;
grant select, insert, update on public.v13_biometric_employee_mappings to authenticated;
grant select on public.v13_biometric_events to authenticated;
grant select on public.v13_biometric_sync_runs to authenticated;
grant execute on function public.v13_process_biometric_event(uuid) to authenticated;

revoke all on function public.v13_ingest_biometric_event(
  text,text,text,timestamptz,text,text,text,text,jsonb,text
) from public;
revoke all on function public.v13_ingest_biometric_event(
  text,text,text,timestamptz,text,text,text,text,jsonb,text
) from authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant select, insert, update on public.v13_biometric_connectors to service_role;
    grant select, insert, update on public.v13_biometric_devices to service_role;
    grant select, insert, update on public.v13_biometric_employee_mappings to service_role;
    grant select, insert, update on public.v13_biometric_events to service_role;
    grant select, insert, update on public.v13_biometric_sync_runs to service_role;
    grant execute on function public.v13_ingest_biometric_event(
      text,text,text,timestamptz,text,text,text,text,jsonb,text
    ) to service_role;
    grant execute on function public.v13_process_biometric_event(uuid) to service_role;
  end if;
end;
$$;

comment on table public.v13_biometric_connectors is
  'Vendor-neutral connector registry. Secret values remain in Supabase or GitHub Secrets.';
comment on function public.v13_ingest_biometric_event(
  text,text,text,timestamptz,text,text,text,text,jsonb,text
) is
  'Service-role-only idempotent biometric event ingestion entry point for secured gateways.';
