-- COLORJET ERP V12 route idempotency correction.
-- A retried GPS point must return the original row without incrementing session totals.

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

  if not found then
    raise exception 'Active tracking session not found';
  end if;

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

grant execute on function public.v12_append_location(
  uuid,double precision,double precision,double precision,double precision,
  double precision,double precision,boolean,timestamptz,text,numeric,text,jsonb
) to authenticated;
