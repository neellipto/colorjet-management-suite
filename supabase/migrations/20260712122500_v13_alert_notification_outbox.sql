-- COLORJET ERP V13: durable notification outbox for SLA and task alerts.

create table if not exists public.v13_notification_outbox (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  event_type text not null,
  user_id uuid references auth.users(id) on delete cascade,
  audience_role text,
  channel text not null default 'push'
    check (channel in ('push','in_app','email','sms','whatsapp')),
  title text not null,
  body text not null,
  deep_link text,
  priority text not null default 'normal'
    check (priority in ('low','normal','high','urgent','critical')),
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending','processing','sent','failed','cancelled')),
  attempt_count integer not null default 0,
  next_attempt_at timestamptz not null default timezone('utc', now()),
  processing_started_at timestamptz,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (user_id is not null or audience_role is not null)
);

create index if not exists v13_notification_outbox_pending_idx
  on public.v13_notification_outbox (next_attempt_at, priority, created_at)
  where status in ('pending','failed');

create or replace function public.v13_notification_updated_at()
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

drop trigger if exists v13_notification_outbox_updated_at
  on public.v13_notification_outbox;
create trigger v13_notification_outbox_updated_at
before update on public.v13_notification_outbox
for each row execute function public.v13_notification_updated_at();

create or replace function public.v13_enqueue_sla_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_case public.v13_service_cases;
  v_priority text;
begin
  select * into v_case
  from public.v13_service_cases
  where id = new.service_case_id;

  if not found then
    return new;
  end if;

  v_priority := case
    when new.severity = 'critical' then 'critical'
    when new.severity = 'breached' then 'urgent'
    when new.severity = 'near_breach' then 'high'
    else 'normal'
  end;

  if v_case.assigned_engineer_id is not null then
    insert into public.v13_notification_outbox (
      event_key, event_type, user_id, channel, title, body,
      deep_link, priority, payload
    ) values (
      'sla:' || new.id::text || ':engineer',
      'sla_' || new.severity,
      v_case.assigned_engineer_id,
      'push',
      'Service SLA ' || replace(initcap(new.severity), '_', ' '),
      new.message,
      '/sla-dashboard?caseId=' || new.service_case_id::text,
      v_priority,
      jsonb_build_object(
        'sla_alert_id', new.id,
        'service_case_id', new.service_case_id,
        'case_no', v_case.case_no,
        'metric', new.metric,
        'severity', new.severity,
        'target_at', new.target_at
      )
    )
    on conflict (event_key) do nothing;
  end if;

  insert into public.v13_notification_outbox (
    event_key, event_type, audience_role, channel, title, body,
    deep_link, priority, payload
  ) values (
    'sla:' || new.id::text || ':service_manager',
    'sla_' || new.severity,
    'service_manager',
    'push',
    'Service SLA ' || replace(initcap(new.severity), '_', ' '),
    new.message,
    '/sla-dashboard?caseId=' || new.service_case_id::text,
    v_priority,
    jsonb_build_object(
      'sla_alert_id', new.id,
      'service_case_id', new.service_case_id,
      'case_no', v_case.case_no,
      'metric', new.metric,
      'severity', new.severity,
      'target_at', new.target_at
    )
  )
  on conflict (event_key) do nothing;

  return new;
end;
$$;

drop trigger if exists v13_sla_notification_trigger on public.v13_sla_alerts;
create trigger v13_sla_notification_trigger
after insert on public.v13_sla_alerts
for each row execute function public.v13_enqueue_sla_notifications();

create or replace function public.v13_claim_notification_batch(
  p_limit integer default 50
)
returns setof public.v13_notification_outbox
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
     and not public.v12_has_role(array['owner','super_admin','admin']) then
    raise exception 'Not authorized to process notification outbox';
  end if;

  return query
  with selected as (
    select id
    from public.v13_notification_outbox
    where status in ('pending','failed')
      and next_attempt_at <= timezone('utc', now())
      and attempt_count < 10
    order by
      case priority
        when 'critical' then 1
        when 'urgent' then 2
        when 'high' then 3
        when 'normal' then 4
        else 5
      end,
      created_at
    limit greatest(1, least(coalesce(p_limit, 50), 200))
    for update skip locked
  )
  update public.v13_notification_outbox o
  set status = 'processing',
      processing_started_at = timezone('utc', now()),
      attempt_count = attempt_count + 1
  from selected
  where o.id = selected.id
  returning o.*;
end;
$$;

create or replace function public.v13_complete_notification(
  p_notification_id uuid,
  p_success boolean,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
     and not public.v12_has_role(array['owner','super_admin','admin']) then
    raise exception 'Not authorized to update notification outbox';
  end if;

  update public.v13_notification_outbox
  set status = case when p_success then 'sent' else 'failed' end,
      sent_at = case when p_success then timezone('utc', now()) else sent_at end,
      last_error = case when p_success then null else left(coalesce(p_error, 'Unknown delivery error'), 2000) end,
      next_attempt_at = case
        when p_success then next_attempt_at
        else timezone('utc', now()) + make_interval(mins => least(1440, greatest(1, attempt_count * attempt_count * 5)))
      end
  where id = p_notification_id;
end;
$$;

alter table public.v13_notification_outbox enable row level security;

drop policy if exists v13_notification_user_read on public.v13_notification_outbox;
create policy v13_notification_user_read
on public.v13_notification_outbox for select to authenticated
using (
  user_id = auth.uid()
  or (
    audience_role is not null
    and public.v12_has_role(array[audience_role])
  )
  or public.v12_has_role(array['owner','super_admin','admin','auditor'])
);

drop policy if exists v13_notification_admin_update on public.v13_notification_outbox;
create policy v13_notification_admin_update
on public.v13_notification_outbox for update to authenticated
using (public.v12_has_role(array['owner','super_admin','admin']))
with check (public.v12_has_role(array['owner','super_admin','admin']));

grant select, update on public.v13_notification_outbox to authenticated;
grant execute on function public.v13_claim_notification_batch(integer) to authenticated;
grant execute on function public.v13_complete_notification(uuid,boolean,text) to authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant select, insert, update on public.v13_notification_outbox to service_role;
    grant execute on function public.v13_claim_notification_batch(integer) to service_role;
    grant execute on function public.v13_complete_notification(uuid,boolean,text) to service_role;
  end if;
end;
$$;

comment on table public.v13_notification_outbox is
  'Durable deduplicated delivery queue for SLA, task and operational alerts.';
