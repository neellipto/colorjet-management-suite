-- COLORJET ERP V13: Leave, Holiday and Payroll

create table if not exists public.v13_holidays (
  id uuid primary key default gen_random_uuid(),
  holiday_date date not null,
  name text not null,
  holiday_type text not null default 'company'
    check (holiday_type in ('government','company','optional','regional')),
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
  status text not null default 'submitted'
    check (status in ('draft','submitted','manager_approved','hr_approved','approved','rejected','cancelled','taken','closed')),
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

create index if not exists v13_leave_requests_employee_idx
  on public.v13_leave_requests (employee_id, start_date desc);
create index if not exists v13_leave_requests_status_idx
  on public.v13_leave_requests (status, start_date);

create table if not exists public.v13_payroll_periods (
  id uuid primary key default gen_random_uuid(),
  period_code text not null unique,
  period_name text not null,
  start_date date not null,
  end_date date not null,
  pay_date date,
  status text not null default 'draft'
    check (status in ('draft','attendance_locked','calculated','reviewed','approved','paid','closed','cancelled')),
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
  gross_salary numeric(14,2)
    generated always as (round(basic_salary + total_allowance + overtime_amount + bonus_amount, 2)) stored,
  absent_deduction numeric(14,2) not null default 0,
  late_deduction numeric(14,2) not null default 0,
  advance_deduction numeric(14,2) not null default 0,
  loan_deduction numeric(14,2) not null default 0,
  tax_deduction numeric(14,2) not null default 0,
  other_deduction numeric(14,2) not null default 0,
  net_salary numeric(14,2)
    generated always as (
      round(
        (basic_salary + total_allowance + overtime_amount + bonus_amount)
        - (absent_deduction + late_deduction + advance_deduction + loan_deduction + tax_deduction + other_deduction),
        2
      )
    ) stored,
  payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid','approved','processing','paid','held','cancelled')),
  payment_method text,
  payment_reference text,
  paid_at timestamptz,
  note text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (payroll_period_id, employee_id)
);

create index if not exists v13_payroll_entries_period_idx
  on public.v13_payroll_entries (payroll_period_id, payment_status);
create index if not exists v13_payroll_entries_employee_idx
  on public.v13_payroll_entries (employee_id, created_at desc);

create or replace function public.v13_hr_updated_at()
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

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'v13_leave_requests','v13_payroll_periods',
    'v13_employee_salary_profiles','v13_payroll_entries'
  ]
  loop
    execute format('drop trigger if exists %I on public.%I', 'trg_' || v_table || '_updated_at', v_table);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.v13_hr_updated_at()',
      'trg_' || v_table || '_updated_at',
      v_table
    );
  end loop;
end;
$$;

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
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.v13_leave_requests;
  v_type public.v13_leave_types;
  v_no text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if p_end_date < p_start_date then
    raise exception 'End date cannot be before start date';
  end if;
  if p_total_days <= 0 then
    raise exception 'Leave days must be greater than zero';
  end if;
  if nullif(trim(p_reason), '') is null then
    raise exception 'Leave reason is required';
  end if;

  select * into v_type
  from public.v13_leave_types
  where id = p_leave_type_id
    and active = true;

  if not found then
    raise exception 'Active leave type not found';
  end if;
  if v_type.requires_attachment and nullif(trim(p_attachment_path), '') is null then
    raise exception 'Attachment is required for this leave type';
  end if;

  if exists (
    select 1
    from public.v13_leave_requests r
    where r.employee_id = auth.uid()
      and r.status not in ('rejected','cancelled','closed')
      and daterange(r.start_date, r.end_date, '[]')
          && daterange(p_start_date, p_end_date, '[]')
  ) then
    raise exception 'Leave request overlaps an existing request';
  end if;

  v_no := 'CJ-LV-'
    || to_char(timezone('utc', now()), 'YYYYMMDDHH24MISS')
    || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 5));

  insert into public.v13_leave_requests (
    request_no, employee_id, leave_type_id, start_date, end_date,
    total_days, reason, attachment_path, emergency_contact,
    handover_to, handover_note, status
  ) values (
    v_no, auth.uid(), p_leave_type_id, p_start_date, p_end_date,
    p_total_days, trim(p_reason), nullif(trim(p_attachment_path), ''),
    nullif(trim(p_emergency_contact), ''), p_handover_to,
    nullif(trim(p_handover_note), ''), 'submitted'
  )
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.v13_approve_leave_request(
  p_leave_request_id uuid,
  p_action text,
  p_note text default null
)
returns public.v13_leave_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.v13_leave_requests;
  v_is_hr boolean;
  v_is_manager boolean;
begin
  v_is_hr := public.v12_has_role(array['owner','super_admin','admin','accounts']);
  v_is_manager := public.v12_has_role(array['owner','super_admin','admin','manager','service_manager']);

  if not v_is_hr and not v_is_manager then
    raise exception 'Not authorized to approve leave';
  end if;
  if p_action not in ('approve','reject') then
    raise exception 'Invalid action';
  end if;

  select * into v_row
  from public.v13_leave_requests
  where id = p_leave_request_id
  for update;

  if not found then
    raise exception 'Leave request not found';
  end if;
  if v_row.status in ('approved','rejected','cancelled','taken','closed') then
    raise exception 'Leave request is already finalized';
  end if;

  if p_action = 'reject' then
    update public.v13_leave_requests
    set status = 'rejected',
        manager_id = case when v_is_manager then auth.uid() else manager_id end,
        manager_note = case when v_is_manager then p_note else manager_note end,
        manager_action_at = case when v_is_manager then timezone('utc', now()) else manager_action_at end,
        hr_id = case when v_is_hr then auth.uid() else hr_id end,
        hr_note = case when v_is_hr then p_note else hr_note end,
        hr_action_at = case when v_is_hr then timezone('utc', now()) else hr_action_at end
    where id = p_leave_request_id
    returning * into v_row;
  elsif v_is_hr and v_row.status in ('submitted','manager_approved','hr_approved') then
    update public.v13_leave_requests
    set status = 'approved',
        hr_id = auth.uid(),
        hr_note = p_note,
        hr_action_at = timezone('utc', now())
    where id = p_leave_request_id
    returning * into v_row;
  elsif v_is_manager and v_row.status = 'submitted' then
    update public.v13_leave_requests
    set status = 'manager_approved',
        manager_id = auth.uid(),
        manager_note = p_note,
        manager_action_at = timezone('utc', now())
    where id = p_leave_request_id
    returning * into v_row;
  else
    raise exception 'Leave request is not ready for this approval';
  end if;

  return v_row;
end;
$$;

create or replace function public.v13_create_payroll_period(
  p_period_code text,
  p_period_name text,
  p_start_date date,
  p_end_date date,
  p_pay_date date default null
)
returns public.v13_payroll_periods
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.v13_payroll_periods;
begin
  if not public.v12_has_role(array['owner','super_admin','admin','accounts']) then
    raise exception 'Not authorized to create payroll period';
  end if;
  if p_end_date < p_start_date then
    raise exception 'Payroll end date cannot be before start date';
  end if;
  if nullif(trim(p_period_code), '') is null
     or nullif(trim(p_period_name), '') is null then
    raise exception 'Payroll period code and name are required';
  end if;

  insert into public.v13_payroll_periods (
    period_code, period_name, start_date, end_date, pay_date, status, created_by
  ) values (
    upper(trim(p_period_code)), trim(p_period_name),
    p_start_date, p_end_date, p_pay_date, 'draft', auth.uid()
  )
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.v13_calculate_payroll_period(
  p_payroll_period_id uuid,
  p_entries jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period public.v13_payroll_periods;
  v_item jsonb;
  v_profile public.v13_employee_salary_profiles;
  v_employee_id uuid;
  v_count integer := 0;
  v_working_days numeric;
  v_present_days numeric;
  v_paid_leave numeric;
  v_unpaid_leave numeric;
  v_absent_days numeric;
  v_late_count integer;
  v_overtime_hours numeric;
  v_total_allowance numeric;
  v_absent_deduction numeric;
  v_late_deduction numeric;
begin
  if not public.v12_has_role(array['owner','super_admin','admin','accounts']) then
    raise exception 'Not authorized to calculate payroll';
  end if;
  if jsonb_typeof(p_entries) <> 'array' or jsonb_array_length(p_entries) = 0 then
    raise exception 'Payroll attendance entries are required';
  end if;

  select * into v_period
  from public.v13_payroll_periods
  where id = p_payroll_period_id
  for update;

  if not found then
    raise exception 'Payroll period not found';
  end if;
  if v_period.status not in ('draft','attendance_locked','calculated') then
    raise exception 'Payroll period cannot be recalculated in status %', v_period.status;
  end if;

  for v_item in select value from jsonb_array_elements(p_entries)
  loop
    v_employee_id := (v_item ->> 'employee_id')::uuid;

    select * into v_profile
    from public.v13_employee_salary_profiles
    where employee_id = v_employee_id
      and active = true
      and effective_from <= v_period.end_date;

    if not found then
      raise exception 'Active salary profile missing for employee %', v_employee_id;
    end if;

    v_working_days := greatest(0, coalesce(nullif(v_item ->> 'working_days', '')::numeric, 0));
    v_present_days := greatest(0, coalesce(nullif(v_item ->> 'present_days', '')::numeric, 0));
    v_paid_leave := greatest(0, coalesce(nullif(v_item ->> 'paid_leave_days', '')::numeric, 0));
    v_unpaid_leave := greatest(0, coalesce(nullif(v_item ->> 'unpaid_leave_days', '')::numeric, 0));
    v_absent_days := greatest(0, coalesce(nullif(v_item ->> 'absent_days', '')::numeric, 0));
    v_late_count := greatest(0, coalesce(nullif(v_item ->> 'late_count', '')::integer, 0));
    v_overtime_hours := greatest(0, coalesce(nullif(v_item ->> 'overtime_hours', '')::numeric, 0));

    v_total_allowance := v_profile.house_rent
      + v_profile.medical_allowance
      + v_profile.conveyance_allowance
      + v_profile.mobile_allowance
      + v_profile.other_allowance;
    v_absent_deduction := round(v_absent_days * v_profile.absent_deduction_daily, 2);
    v_late_deduction := round(v_late_count * v_profile.late_deduction_rate, 2);

    insert into public.v13_payroll_entries (
      payroll_period_id, employee_id, working_days, present_days,
      paid_leave_days, unpaid_leave_days, absent_days, late_count,
      overtime_hours, basic_salary, total_allowance, overtime_amount,
      bonus_amount, absent_deduction, late_deduction, advance_deduction,
      loan_deduction, tax_deduction, other_deduction, payment_status, note
    ) values (
      p_payroll_period_id, v_employee_id, v_working_days, v_present_days,
      v_paid_leave, v_unpaid_leave, v_absent_days, v_late_count,
      v_overtime_hours, v_profile.basic_salary, v_total_allowance,
      round(v_overtime_hours * v_profile.overtime_rate_hourly, 2),
      greatest(0, coalesce(nullif(v_item ->> 'bonus_amount', '')::numeric, 0)),
      v_absent_deduction, v_late_deduction,
      greatest(0, coalesce(nullif(v_item ->> 'advance_deduction', '')::numeric, 0)),
      greatest(0, coalesce(nullif(v_item ->> 'loan_deduction', '')::numeric, 0)),
      greatest(0, coalesce(nullif(v_item ->> 'tax_deduction', '')::numeric, 0)),
      greatest(0, coalesce(nullif(v_item ->> 'other_deduction', '')::numeric, 0)),
      'unpaid', nullif(trim(v_item ->> 'note'), '')
    )
    on conflict (payroll_period_id, employee_id)
    do update set
      working_days = excluded.working_days,
      present_days = excluded.present_days,
      paid_leave_days = excluded.paid_leave_days,
      unpaid_leave_days = excluded.unpaid_leave_days,
      absent_days = excluded.absent_days,
      late_count = excluded.late_count,
      overtime_hours = excluded.overtime_hours,
      basic_salary = excluded.basic_salary,
      total_allowance = excluded.total_allowance,
      overtime_amount = excluded.overtime_amount,
      bonus_amount = excluded.bonus_amount,
      absent_deduction = excluded.absent_deduction,
      late_deduction = excluded.late_deduction,
      advance_deduction = excluded.advance_deduction,
      loan_deduction = excluded.loan_deduction,
      tax_deduction = excluded.tax_deduction,
      other_deduction = excluded.other_deduction,
      note = excluded.note;

    v_count := v_count + 1;
  end loop;

  update public.v13_payroll_periods
  set status = 'calculated'
  where id = p_payroll_period_id;

  return v_count;
end;
$$;

create or replace function public.v13_approve_payroll_period(
  p_payroll_period_id uuid
)
returns public.v13_payroll_periods
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period public.v13_payroll_periods;
begin
  if not public.v12_has_role(array['owner','super_admin','admin']) then
    raise exception 'Only Owner/Admin can approve payroll';
  end if;

  select * into v_period
  from public.v13_payroll_periods
  where id = p_payroll_period_id
  for update;

  if not found then
    raise exception 'Payroll period not found';
  end if;
  if v_period.status not in ('calculated','reviewed') then
    raise exception 'Payroll must be calculated or reviewed before approval';
  end if;
  if not exists (
    select 1 from public.v13_payroll_entries
    where payroll_period_id = p_payroll_period_id
  ) then
    raise exception 'Payroll period has no entries';
  end if;

  update public.v13_payroll_periods
  set status = 'approved',
      approved_by = auth.uid(),
      approved_at = timezone('utc', now())
  where id = p_payroll_period_id
  returning * into v_period;

  update public.v13_payroll_entries
  set payment_status = 'approved'
  where payroll_period_id = p_payroll_period_id
    and payment_status = 'unpaid';

  return v_period;
end;
$$;

create or replace function public.v13_mark_payroll_paid(
  p_payroll_entry_id uuid,
  p_payment_method text,
  p_payment_reference text,
  p_note text default null
)
returns public.v13_payroll_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry public.v13_payroll_entries;
begin
  if not public.v12_has_role(array['owner','super_admin','admin','accounts']) then
    raise exception 'Not authorized to pay payroll';
  end if;

  select * into v_entry
  from public.v13_payroll_entries
  where id = p_payroll_entry_id
  for update;

  if not found then
    raise exception 'Payroll entry not found';
  end if;
  if v_entry.payment_status not in ('approved','processing') then
    raise exception 'Payroll entry is not approved for payment';
  end if;

  update public.v13_payroll_entries
  set payment_status = 'paid',
      payment_method = nullif(trim(p_payment_method), ''),
      payment_reference = nullif(trim(p_payment_reference), ''),
      paid_at = timezone('utc', now()),
      note = coalesce(nullif(trim(p_note), ''), note)
  where id = p_payroll_entry_id
  returning * into v_entry;

  if not exists (
    select 1
    from public.v13_payroll_entries
    where payroll_period_id = v_entry.payroll_period_id
      and payment_status <> 'paid'
  ) then
    update public.v13_payroll_periods
    set status = 'paid'
    where id = v_entry.payroll_period_id;
  end if;

  return v_entry;
end;
$$;

alter table public.v13_holidays enable row level security;
alter table public.v13_leave_types enable row level security;
alter table public.v13_leave_requests enable row level security;
alter table public.v13_payroll_periods enable row level security;
alter table public.v13_employee_salary_profiles enable row level security;
alter table public.v13_payroll_entries enable row level security;

drop policy if exists v13_holidays_read on public.v13_holidays;
create policy v13_holidays_read
on public.v13_holidays for select to authenticated
using (true);

drop policy if exists v13_holidays_write on public.v13_holidays;
create policy v13_holidays_write
on public.v13_holidays for all to authenticated
using (public.v12_has_role(array['owner','super_admin','admin','manager','accounts']))
with check (public.v12_has_role(array['owner','super_admin','admin','manager','accounts']));

drop policy if exists v13_leave_types_read on public.v13_leave_types;
create policy v13_leave_types_read
on public.v13_leave_types for select to authenticated
using (active = true or public.v12_has_role(array['owner','super_admin','admin','manager','accounts']));

drop policy if exists v13_leave_types_write on public.v13_leave_types;
create policy v13_leave_types_write
on public.v13_leave_types for all to authenticated
using (public.v12_has_role(array['owner','super_admin','admin','manager','accounts']))
with check (public.v12_has_role(array['owner','super_admin','admin','manager','accounts']));

drop policy if exists v13_leave_requests_read on public.v13_leave_requests;
create policy v13_leave_requests_read
on public.v13_leave_requests for select to authenticated
using (
  employee_id = auth.uid()
  or handover_to = auth.uid()
  or public.v12_has_role(array['owner','super_admin','admin','manager','service_manager','accounts','auditor'])
);

drop policy if exists v13_leave_requests_write on public.v13_leave_requests;
create policy v13_leave_requests_write
on public.v13_leave_requests for all to authenticated
using (
  employee_id = auth.uid()
  or public.v12_has_role(array['owner','super_admin','admin','manager','service_manager','accounts'])
)
with check (
  employee_id = auth.uid()
  or public.v12_has_role(array['owner','super_admin','admin','manager','service_manager','accounts'])
);

drop policy if exists v13_payroll_periods_read on public.v13_payroll_periods;
create policy v13_payroll_periods_read
on public.v13_payroll_periods for select to authenticated
using (public.v12_has_role(array['owner','super_admin','admin','manager','accounts','auditor']));

drop policy if exists v13_payroll_periods_write on public.v13_payroll_periods;
create policy v13_payroll_periods_write
on public.v13_payroll_periods for all to authenticated
using (public.v12_has_role(array['owner','super_admin','admin','accounts']))
with check (public.v12_has_role(array['owner','super_admin','admin','accounts']));

drop policy if exists v13_salary_profiles_read on public.v13_employee_salary_profiles;
create policy v13_salary_profiles_read
on public.v13_employee_salary_profiles for select to authenticated
using (
  employee_id = auth.uid()
  or public.v12_has_role(array['owner','super_admin','admin','accounts','auditor'])
);

drop policy if exists v13_salary_profiles_write on public.v13_employee_salary_profiles;
create policy v13_salary_profiles_write
on public.v13_employee_salary_profiles for all to authenticated
using (public.v12_has_role(array['owner','super_admin','admin','accounts']))
with check (public.v12_has_role(array['owner','super_admin','admin','accounts']));

drop policy if exists v13_payroll_entries_read on public.v13_payroll_entries;
create policy v13_payroll_entries_read
on public.v13_payroll_entries for select to authenticated
using (
  employee_id = auth.uid()
  or public.v12_has_role(array['owner','super_admin','admin','accounts','auditor'])
);

drop policy if exists v13_payroll_entries_write on public.v13_payroll_entries;
create policy v13_payroll_entries_write
on public.v13_payroll_entries for all to authenticated
using (public.v12_has_role(array['owner','super_admin','admin','accounts']))
with check (public.v12_has_role(array['owner','super_admin','admin','accounts']));

grant select, insert, update on public.v13_holidays to authenticated;
grant select, insert, update on public.v13_leave_types to authenticated;
grant select, insert, update on public.v13_leave_requests to authenticated;
grant select, insert, update on public.v13_payroll_periods to authenticated;
grant select, insert, update on public.v13_employee_salary_profiles to authenticated;
grant select, insert, update on public.v13_payroll_entries to authenticated;

grant execute on function public.v13_submit_leave_request(uuid,date,date,numeric,text,text,text,uuid,text) to authenticated;
grant execute on function public.v13_approve_leave_request(uuid,text,text) to authenticated;
grant execute on function public.v13_create_payroll_period(text,text,date,date,date) to authenticated;
grant execute on function public.v13_calculate_payroll_period(uuid,jsonb) to authenticated;
grant execute on function public.v13_approve_payroll_period(uuid) to authenticated;
grant execute on function public.v13_mark_payroll_paid(uuid,text,text,text) to authenticated;

comment on table public.v13_leave_requests is
  'Employee leave request with manager and HR approval stages.';
comment on table public.v13_payroll_entries is
  'Auditable payroll calculation and payment ledger for each employee and period.';
