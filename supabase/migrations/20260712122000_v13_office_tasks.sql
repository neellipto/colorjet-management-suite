-- COLORJET ERP V13: Office Task Management

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
  priority text not null default 'normal'
    check (priority in ('low','normal','high','urgent','emergency')),
  status text not null default 'new'
    check (status in ('new','accepted','in_progress','waiting','completed','cancelled','rejected','overdue')),
  start_at timestamptz,
  due_at timestamptz,
  follow_up_at timestamptz,
  completed_at timestamptz,
  completion_note text,
  progress_percent integer not null default 0
    check (progress_percent between 0 and 100),
  reminder_minutes integer not null default 60
    check (reminder_minutes >= 0),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists v13_office_tasks_assignee_idx
  on public.v13_office_tasks (assigned_to, status, due_at);
create index if not exists v13_office_tasks_status_idx
  on public.v13_office_tasks (status, priority, due_at);

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

create index if not exists v13_office_task_events_idx
  on public.v13_office_task_events (task_id, created_at desc);

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

create or replace function public.v13_task_updated_at()
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

drop trigger if exists v13_office_tasks_updated_at on public.v13_office_tasks;
create trigger v13_office_tasks_updated_at
before update on public.v13_office_tasks
for each row execute function public.v13_task_updated_at();

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
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.v13_office_tasks;
  v_no text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if not public.v12_has_role(array[
    'owner','super_admin','admin','manager','service_manager',
    'accounts','sales','store','engineer'
  ]) then
    raise exception 'Not authorized to create office tasks';
  end if;
  if nullif(trim(p_title), '') is null then
    raise exception 'Task title is required';
  end if;
  if p_priority not in ('low','normal','high','urgent','emergency') then
    raise exception 'Invalid priority';
  end if;
  if p_due_at is not null and p_start_at is not null and p_due_at < p_start_at then
    raise exception 'Due date cannot be before start date';
  end if;

  v_no := 'CJ-TSK-'
    || to_char(timezone('utc', now()), 'YYYYMMDDHH24MISS')
    || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 5));

  insert into public.v13_office_tasks (
    task_no, title, description, module, related_entity_type,
    related_entity_id, department, assigned_to, assigned_by,
    priority, status, start_at, due_at, follow_up_at, created_by
  ) values (
    v_no,
    trim(p_title),
    nullif(trim(p_description), ''),
    coalesce(nullif(trim(p_module), ''), 'general'),
    nullif(trim(p_related_entity_type), ''),
    p_related_entity_id,
    nullif(trim(p_department), ''),
    p_assigned_to,
    auth.uid(),
    p_priority,
    'new',
    p_start_at,
    p_due_at,
    p_follow_up_at,
    auth.uid()
  )
  returning * into v_row;

  insert into public.v13_office_task_events (
    task_id, event_type, to_status, comment, created_by
  ) values (
    v_row.id, 'created', 'new', 'Task created', auth.uid()
  );

  return v_row;
end;
$$;

create or replace function public.v13_transition_office_task(
  p_task_id uuid,
  p_new_status text,
  p_progress_percent integer default null,
  p_comment text default null,
  p_idempotency_key text default null
)
returns public.v13_office_tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task public.v13_office_tasks;
  v_old text;
  v_allowed boolean := false;
begin
  select * into v_task
  from public.v13_office_tasks
  where id = p_task_id
  for update;

  if not found then
    raise exception 'Task not found';
  end if;

  if v_task.assigned_to <> auth.uid()
     and v_task.assigned_by <> auth.uid()
     and not public.v12_has_role(array['owner','super_admin','admin','manager']) then
    raise exception 'Not authorized for this task';
  end if;

  v_old := v_task.status;
  v_allowed := case v_old
    when 'new' then p_new_status = any(array['accepted','rejected','cancelled'])
    when 'accepted' then p_new_status = any(array['in_progress','waiting','cancelled'])
    when 'in_progress' then p_new_status = any(array['waiting','completed','cancelled'])
    when 'waiting' then p_new_status = any(array['in_progress','completed','cancelled'])
    when 'overdue' then p_new_status = any(array['in_progress','waiting','completed','cancelled'])
    else false
  end;

  if p_new_status <> v_old and not v_allowed then
    raise exception 'Invalid task transition: % -> %', v_old, p_new_status;
  end if;

  update public.v13_office_tasks
  set status = p_new_status,
      progress_percent = case
        when p_new_status = 'completed' then 100
        else coalesce(p_progress_percent, progress_percent)
      end,
      completed_at = case
        when p_new_status = 'completed' then coalesce(completed_at, timezone('utc', now()))
        else completed_at
      end,
      completion_note = case
        when p_new_status = 'completed' then coalesce(nullif(trim(p_comment), ''), completion_note)
        else completion_note
      end
  where id = p_task_id
  returning * into v_task;

  insert into public.v13_office_task_events (
    task_id, event_type, from_status, to_status, comment,
    progress_percent, created_by, idempotency_key
  ) values (
    p_task_id, 'status_transition', v_old, p_new_status, p_comment,
    v_task.progress_percent, auth.uid(), p_idempotency_key
  )
  on conflict (idempotency_key) do nothing;

  return v_task;
end;
$$;

create or replace function public.v13_mark_overdue_tasks()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
     and not public.v12_has_role(array['owner','super_admin','admin','manager']) then
    raise exception 'Not authorized to evaluate overdue tasks';
  end if;

  update public.v13_office_tasks
  set status = 'overdue'
  where status in ('new','accepted','in_progress','waiting')
    and due_at is not null
    and due_at < timezone('utc', now());

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

alter table public.v13_office_tasks enable row level security;
alter table public.v13_office_task_events enable row level security;
alter table public.v13_office_task_attachments enable row level security;

drop policy if exists v13_tasks_read on public.v13_office_tasks;
create policy v13_tasks_read
on public.v13_office_tasks for select to authenticated
using (
  assigned_to = auth.uid()
  or assigned_by = auth.uid()
  or created_by = auth.uid()
  or public.v12_has_role(array['owner','super_admin','admin','manager','auditor'])
);

drop policy if exists v13_tasks_write on public.v13_office_tasks;
create policy v13_tasks_write
on public.v13_office_tasks for all to authenticated
using (
  assigned_to = auth.uid()
  or assigned_by = auth.uid()
  or public.v12_has_role(array['owner','super_admin','admin','manager'])
)
with check (
  assigned_to = auth.uid()
  or assigned_by = auth.uid()
  or public.v12_has_role(array['owner','super_admin','admin','manager'])
);

drop policy if exists v13_task_events_read on public.v13_office_task_events;
create policy v13_task_events_read
on public.v13_office_task_events for select to authenticated
using (
  exists (
    select 1
    from public.v13_office_tasks t
    where t.id = task_id
      and (
        t.assigned_to = auth.uid()
        or t.assigned_by = auth.uid()
        or public.v12_has_role(array['owner','super_admin','admin','manager','auditor'])
      )
  )
);

drop policy if exists v13_task_files_rw on public.v13_office_task_attachments;
create policy v13_task_files_rw
on public.v13_office_task_attachments for all to authenticated
using (
  exists (
    select 1
    from public.v13_office_tasks t
    where t.id = task_id
      and (
        t.assigned_to = auth.uid()
        or t.assigned_by = auth.uid()
        or public.v12_has_role(array['owner','super_admin','admin','manager'])
      )
  )
)
with check (
  exists (
    select 1
    from public.v13_office_tasks t
    where t.id = task_id
      and (
        t.assigned_to = auth.uid()
        or t.assigned_by = auth.uid()
        or public.v12_has_role(array['owner','super_admin','admin','manager'])
      )
  )
);

grant select, insert, update on public.v13_office_tasks to authenticated;
grant select on public.v13_office_task_events to authenticated;
grant select, insert, update on public.v13_office_task_attachments to authenticated;
grant execute on function public.v13_create_office_task(text,text,text,text,uuid,text,uuid,text,timestamptz,timestamptz,timestamptz) to authenticated;
grant execute on function public.v13_transition_office_task(uuid,text,integer,text,text) to authenticated;
grant execute on function public.v13_mark_overdue_tasks() to authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.v13_mark_overdue_tasks() to service_role;
  end if;
end;
$$;

comment on table public.v13_office_tasks is
  'Role-aware office task source of truth with progress, due dates and audit events.';
