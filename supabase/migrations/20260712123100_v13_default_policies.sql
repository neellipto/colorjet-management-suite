-- COLORJET ERP V13: Safe production defaults for leave and SLA

insert into public.v13_leave_types (
  code, name, annual_quota, paid, carry_forward,
  max_carry_forward, requires_attachment, active
) values
  ('CL', 'Casual Leave', 10, true, false, 0, false, true),
  ('SL', 'Sick Leave', 14, true, false, 0, true, true),
  ('EL', 'Earned Leave', 10, true, true, 5, false, true),
  ('UL', 'Unpaid Leave', 0, false, false, 0, false, true)
on conflict (code) do update set
  name = excluded.name,
  annual_quota = excluded.annual_quota,
  paid = excluded.paid,
  carry_forward = excluded.carry_forward,
  max_carry_forward = excluded.max_carry_forward,
  requires_attachment = excluded.requires_attachment,
  active = true;

insert into public.v13_sla_policies (
  name, priority, response_minutes, arrival_minutes,
  resolution_minutes, warning_minutes, active
) values
  ('COLORJET Low Priority Service', 'low', 240, 1440, 4320, 120, true),
  ('COLORJET Normal Service', 'normal', 120, 480, 1440, 60, true),
  ('COLORJET High Priority Service', 'high', 60, 240, 720, 45, true),
  ('COLORJET Urgent Service', 'urgent', 30, 180, 480, 30, true),
  ('COLORJET Emergency Service', 'emergency', 15, 120, 360, 15, true)
on conflict (name) do update set
  priority = excluded.priority,
  response_minutes = excluded.response_minutes,
  arrival_minutes = excluded.arrival_minutes,
  resolution_minutes = excluded.resolution_minutes,
  warning_minutes = excluded.warning_minutes,
  active = true;

comment on table public.v13_sla_policies is
  'Default values are operational starting points and may be adjusted by authorized COLORJET management.';
