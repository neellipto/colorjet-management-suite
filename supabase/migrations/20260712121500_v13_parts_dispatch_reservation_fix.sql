-- COLORJET ERP V13: corrected FIFO reservation consumption during dispatch.

create or replace function public.v13_create_parts_dispatch(
  p_request_id uuid,
  p_source_warehouse_id uuid,
  p_destination text,
  p_receiver_user_id uuid,
  p_courier_name text,
  p_tracking_no text,
  p_transport_type text,
  p_delivery_charge numeric,
  p_expected_delivery_at timestamptz,
  p_items jsonb
)
returns public.v12_parts_dispatches
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.v12_parts_requests;
  v_dispatch public.v12_parts_dispatches;
  v_item jsonb;
  v_request_item public.v12_parts_request_items;
  v_reservation public.v13_parts_reservations%rowtype;
  v_qty numeric;
  v_reserved numeric;
  v_remaining numeric;
  v_available numeric;
  v_take numeric;
  v_dispatch_no text;
begin
  if not public.v13_parts_role_allowed() then
    raise exception 'Not authorized to dispatch spare parts';
  end if;
  if nullif(trim(p_destination), '') is null then
    raise exception 'Destination is required';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Dispatch items are required';
  end if;

  select * into v_request
  from public.v12_parts_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Parts request not found';
  end if;
  if v_request.status not in ('manager_approved','partially_approved','reserved','partially_dispatched') then
    raise exception 'Parts request is not ready for dispatch';
  end if;

  v_dispatch_no := 'CJ-DSP-'
    || to_char(timezone('utc', now()), 'YYYYMMDDHH24MISS')
    || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 5));

  insert into public.v12_parts_dispatches (
    dispatch_no, request_id, source_warehouse_id, destination, receiver_user_id,
    courier_name, tracking_no, transport_type, status, package_count,
    delivery_charge, dispatched_at, expected_delivery_at, created_by
  ) values (
    v_dispatch_no, p_request_id, p_source_warehouse_id, trim(p_destination),
    p_receiver_user_id, nullif(trim(p_courier_name), ''),
    nullif(trim(p_tracking_no), ''), nullif(trim(p_transport_type), ''),
    'dispatched', 1, coalesce(p_delivery_charge, 0), timezone('utc', now()),
    p_expected_delivery_at, auth.uid()
  )
  returning * into v_dispatch;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    select * into v_request_item
    from public.v12_parts_request_items
    where id = (v_item ->> 'request_item_id')::uuid
      and request_id = p_request_id
    for update;

    if not found then
      raise exception 'Request item not found';
    end if;

    v_qty := coalesce(nullif(v_item ->> 'quantity', '')::numeric, 0);
    if v_qty <= 0 then
      raise exception 'Dispatch quantity must be greater than zero';
    end if;
    if v_request_item.dispatched_qty + v_qty > v_request_item.approved_qty then
      raise exception 'Dispatch exceeds approved quantity for %', v_request_item.product_name;
    end if;

    select coalesce(sum(reserved_qty - released_qty - consumed_qty), 0)
    into v_reserved
    from public.v13_parts_reservations
    where request_item_id = v_request_item.id
      and warehouse_id is not distinct from p_source_warehouse_id
      and status in ('active','partially_consumed');

    if v_reserved < v_qty then
      raise exception 'Not enough reserved quantity for %', v_request_item.product_name;
    end if;

    insert into public.v12_parts_dispatch_items (
      dispatch_id, request_item_id, quantity, serial_numbers, condition_at_dispatch
    ) values (
      v_dispatch.id,
      v_request_item.id,
      v_qty,
      coalesce(
        array(
          select jsonb_array_elements_text(
            coalesce(v_item -> 'serial_numbers', '[]'::jsonb)
          )
        ),
        '{}'::text[]
      ),
      nullif(trim(v_item ->> 'condition_at_dispatch'), '')
    );

    v_remaining := v_qty;

    for v_reservation in
      select *
      from public.v13_parts_reservations
      where request_item_id = v_request_item.id
        and warehouse_id is not distinct from p_source_warehouse_id
        and status in ('active','partially_consumed')
        and reserved_qty > released_qty + consumed_qty
      order by reserved_at, id
      for update
    loop
      exit when v_remaining <= 0;

      v_available := v_reservation.reserved_qty
        - v_reservation.released_qty
        - v_reservation.consumed_qty;
      v_take := least(v_remaining, greatest(v_available, 0));

      if v_take > 0 then
        update public.v13_parts_reservations
        set consumed_qty = consumed_qty + v_take,
            status = case
              when consumed_qty + v_take >= reserved_qty - released_qty then 'consumed'
              else 'partially_consumed'
            end
        where id = v_reservation.id;

        v_remaining := v_remaining - v_take;
      end if;
    end loop;

    if v_remaining > 0 then
      raise exception 'Reservation allocation changed during dispatch; retry the transaction';
    end if;

    update public.v12_parts_request_items
    set dispatched_qty = dispatched_qty + v_qty
    where id = v_request_item.id;

    insert into public.v13_parts_stock_postings (
      posting_no, posting_type, product_id, warehouse_id, engineer_id,
      request_id, request_item_id, dispatch_id, quantity, stock_effect,
      reference_no, note, idempotency_key
    ) values (
      'CJ-STK-' || to_char(timezone('utc', now()), 'YYYYMMDDHH24MISS')
        || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 5)),
      'dispatch_out', v_request_item.product_id, p_source_warehouse_id,
      p_receiver_user_id, p_request_id, v_request_item.id, v_dispatch.id,
      v_qty, -v_qty, v_dispatch_no,
      'Dispatched to ' || trim(p_destination),
      'dispatch:' || v_dispatch.id::text || ':' || v_request_item.id::text
    );

    perform public.v13_apply_stock_balance(
      v_request_item.product_id,
      p_source_warehouse_id,
      -v_qty,
      'service_dispatch',
      v_dispatch_no,
      'V13 spare-parts dispatch'
    );
  end loop;

  update public.v12_parts_requests r
  set status = case
    when not exists (
      select 1
      from public.v12_parts_request_items i
      where i.request_id = r.id
        and i.dispatched_qty < i.approved_qty
    ) then 'dispatched'
    else 'partially_dispatched'
  end
  where r.id = p_request_id;

  return v_dispatch;
end;
$$;

revoke all on function public.v13_create_parts_dispatch(
  uuid,uuid,text,uuid,text,text,text,numeric,timestamptz,jsonb
) from public;

grant execute on function public.v13_create_parts_dispatch(
  uuid,uuid,text,uuid,text,text,text,numeric,timestamptz,jsonb
) to authenticated;
