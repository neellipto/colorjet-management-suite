-- COLORJET ERP V13: Spare Parts Approval, Reservation, Dispatch, Receipt and Stock Posting
-- Extends the V12 parts request/dispatch foundation.

create table if not exists public.v13_parts_reservations (
  id uuid primary key default gen_random_uuid(),
  request_item_id uuid not null references public.v12_parts_request_items(id) on delete cascade,
  warehouse_id uuid,
  reserved_qty numeric(14,3) not null check (reserved_qty > 0),
  released_qty numeric(14,3) not null default 0 check (released_qty >= 0),
  consumed_qty numeric(14,3) not null default 0 check (consumed_qty >= 0),
  status text not null default 'active' check (status in ('active','partially_consumed','consumed','released','cancelled')),
  reserved_by uuid references auth.users(id) on delete set null default auth.uid(),
  reserved_at timestamptz not null default timezone('utc', now()),
  expires_at timestamptz,
  note text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists v13_parts_reservations_item_idx on public.v13_parts_reservations (request_item_id, status);
create index if not exists v13_parts_reservations_warehouse_idx on public.v13_parts_reservations (warehouse_id, status);

create table if not exists public.v13_parts_receipts (
  id uuid primary key default gen_random_uuid(),
  receipt_no text not null unique,
  dispatch_id uuid not null references public.v12_parts_dispatches(id) on delete restrict,
  request_id uuid not null references public.v12_parts_requests(id) on delete restrict,
  receiver_user_id uuid not null references auth.users(id) on delete restrict,
  received_at timestamptz not null default timezone('utc', now()),
  condition_summary text,
  proof_storage_path text,
  receiver_signature_path text,
  status text not null default 'received' check (status in ('partial','received','damaged','short','rejected')),
  note text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.v13_parts_receipt_items (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references public.v13_parts_receipts(id) on delete cascade,
  dispatch_item_id uuid not null references public.v12_parts_dispatch_items(id) on delete restrict,
  request_item_id uuid not null references public.v12_parts_request_items(id) on delete restrict,
  received_qty numeric(14,3) not null check (received_qty >= 0),
  damaged_qty numeric(14,3) not null default 0 check (damaged_qty >= 0),
  short_qty numeric(14,3) not null default 0 check (short_qty >= 0),
  condition_at_receipt text,
  serial_numbers text[] not null default '{}',
  note text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.v13_parts_stock_postings (
  id uuid primary key default gen_random_uuid(),
  posting_no text not null unique,
  posting_type text not null check (posting_type in (
    'reservation','reservation_release','dispatch_out','engineer_receive','install_use',
    'customer_return','engineer_return','warehouse_return','damage_writeoff','adjustment'
  )),
  product_id uuid,
  warehouse_id uuid,
  engineer_id uuid references auth.users(id) on delete set null,
  request_id uuid references public.v12_parts_requests(id) on delete set null,
  request_item_id uuid references public.v12_parts_request_items(id) on delete set null,
  dispatch_id uuid references public.v12_parts_dispatches(id) on delete set null,
  receipt_id uuid references public.v13_parts_receipts(id) on delete set null,
  quantity numeric(14,3) not null check (quantity > 0),
  stock_effect numeric(14,3) not null default 0,
  unit_cost numeric(14,4) not null default 0,
  total_cost numeric(14,2) generated always as (round(quantity * unit_cost, 2)) stored,
  reference_no text,
  note text,
  posted_by uuid references auth.users(id) on delete set null default auth.uid(),
  posted_at timestamptz not null default timezone('utc', now()),
  idempotency_key text unique,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists v13_parts_stock_postings_product_idx on public.v13_parts_stock_postings (product_id, posted_at desc);
create index if not exists v13_parts_stock_postings_request_idx on public.v13_parts_stock_postings (request_id, posted_at desc);

create or replace function public.v13_parts_role_allowed()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.v12_has_role(array['owner','super_admin','admin','manager','service_manager','store']);
$$;

create or replace function public.v13_approve_parts_request(
  p_request_id uuid,
  p_items jsonb,
  p_note text default null
)
returns public.v12_parts_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.v12_parts_requests;
  v_item jsonb;
  v_request_item public.v12_parts_request_items;
  v_qty numeric;
  v_full boolean;
begin
  if not public.v13_parts_role_allowed() then raise exception 'Not authorized to approve spare parts'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Approval items are required'; end if;

  select * into v_request from public.v12_parts_requests where id = p_request_id for update;
  if not found then raise exception 'Parts request not found'; end if;
  if v_request.status in ('rejected','cancelled','closed') then raise exception 'Parts request is not open'; end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    select * into v_request_item
    from public.v12_parts_request_items
    where id = (v_item ->> 'request_item_id')::uuid and request_id = p_request_id
    for update;
    if not found then raise exception 'Request item not found'; end if;

    v_qty := coalesce(nullif(v_item ->> 'approved_qty', '')::numeric, 0);
    if v_qty < 0 or v_qty > v_request_item.requested_qty then
      raise exception 'Approved quantity must be between zero and requested quantity';
    end if;

    update public.v12_parts_request_items
    set approved_qty = v_qty,
        note = coalesce(nullif(trim(v_item ->> 'note'), ''), note)
    where id = v_request_item.id;
  end loop;

  select bool_and(approved_qty >= requested_qty) into v_full
  from public.v12_parts_request_items where request_id = p_request_id;

  update public.v12_parts_requests
  set status = case when coalesce(v_full, false) then 'manager_approved' else 'partially_approved' end,
      approved_by = auth.uid(), approved_at = timezone('utc', now()),
      reason = case when nullif(trim(p_note), '') is null then reason else reason || E'\nApproval note: ' || trim(p_note) end
  where id = p_request_id
  returning * into v_request;

  return v_request;
end;
$$;

create or replace function public.v13_reserve_part(
  p_request_item_id uuid,
  p_warehouse_id uuid,
  p_quantity numeric,
  p_expires_at timestamptz default null,
  p_note text default null
)
returns public.v13_parts_reservations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.v12_parts_request_items;
  v_reserved numeric;
  v_row public.v13_parts_reservations;
begin
  if not public.v13_parts_role_allowed() then raise exception 'Not authorized to reserve spare parts'; end if;
  if p_quantity <= 0 then raise exception 'Reservation quantity must be greater than zero'; end if;

  select * into v_item from public.v12_parts_request_items where id = p_request_item_id for update;
  if not found then raise exception 'Request item not found'; end if;
  if v_item.approved_qty <= 0 then raise exception 'Item must be approved before reservation'; end if;

  select coalesce(sum(reserved_qty - released_qty - consumed_qty), 0) into v_reserved
  from public.v13_parts_reservations
  where request_item_id = p_request_item_id and status in ('active','partially_consumed');

  if v_reserved + p_quantity > v_item.approved_qty - v_item.dispatched_qty then
    raise exception 'Reservation exceeds remaining approved quantity';
  end if;

  insert into public.v13_parts_reservations (
    request_item_id, warehouse_id, reserved_qty, expires_at, note, reserved_by
  ) values (
    p_request_item_id, p_warehouse_id, p_quantity, p_expires_at, p_note, auth.uid()
  ) returning * into v_row;

  update public.v12_parts_requests r
  set status = case
    when not exists (
      select 1 from public.v12_parts_request_items i
      where i.request_id = r.id
        and i.approved_qty > coalesce((
          select sum(x.reserved_qty - x.released_qty - x.consumed_qty)
          from public.v13_parts_reservations x
          where x.request_item_id = i.id and x.status in ('active','partially_consumed')
        ), 0)
    ) then 'reserved'
    else 'partially_approved'
  end
  where r.id = v_item.request_id;

  insert into public.v13_parts_stock_postings (
    posting_no, posting_type, product_id, warehouse_id, request_id, request_item_id,
    quantity, stock_effect, reference_no, note, idempotency_key
  ) values (
    'CJ-STK-' || to_char(timezone('utc', now()), 'YYYYMMDDHH24MISS') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''),1,5)),
    'reservation', v_item.product_id, p_warehouse_id, v_item.request_id, v_item.id,
    p_quantity, 0, null, p_note, 'reserve:' || v_row.id::text
  );

  return v_row;
end;
$$;

create or replace function public.v13_apply_stock_balance(
  p_product_id uuid,
  p_warehouse_id uuid,
  p_effect numeric,
  p_movement_type text,
  p_reference_no text,
  p_note text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_has_balance boolean;
  v_has_movement boolean;
begin
  if p_effect = 0 or p_product_id is null or p_warehouse_id is null then return; end if;

  select to_regclass('public.stock_balances') is not null into v_has_balance;
  if v_has_balance
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='stock_balances' and column_name='product_id')
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='stock_balances' and column_name='warehouse_id')
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='stock_balances' and column_name='quantity') then
    execute 'update public.stock_balances set quantity = quantity + $1 where product_id = $2 and warehouse_id = $3'
      using p_effect, p_product_id, p_warehouse_id;
    if not found then
      execute 'insert into public.stock_balances (product_id, warehouse_id, quantity) values ($1,$2,$3)'
        using p_product_id, p_warehouse_id, p_effect;
    end if;
  end if;

  select to_regclass('public.stock_movements') is not null into v_has_movement;
  if v_has_movement
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='stock_movements' and column_name='product_id')
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='stock_movements' and column_name='warehouse_id')
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='stock_movements' and column_name='movement_type')
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='stock_movements' and column_name='quantity') then
    execute 'insert into public.stock_movements (product_id, warehouse_id, movement_type, quantity, reference_no, note, created_by) values ($1,$2,$3,$4,$5,$6,$7)'
      using p_product_id, p_warehouse_id, p_movement_type, abs(p_effect), p_reference_no, p_note, auth.uid();
  end if;
end;
$$;

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
  v_qty numeric;
  v_reserved numeric;
  v_dispatch_no text;
begin
  if not public.v13_parts_role_allowed() then raise exception 'Not authorized to dispatch spare parts'; end if;
  if nullif(trim(p_destination), '') is null then raise exception 'Destination is required'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Dispatch items are required'; end if;

  select * into v_request from public.v12_parts_requests where id = p_request_id for update;
  if not found then raise exception 'Parts request not found'; end if;
  if v_request.status not in ('manager_approved','partially_approved','reserved','partially_dispatched') then
    raise exception 'Parts request is not ready for dispatch';
  end if;

  v_dispatch_no := 'CJ-DSP-' || to_char(timezone('utc', now()), 'YYYYMMDDHH24MISS') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''),1,5));
  insert into public.v12_parts_dispatches (
    dispatch_no, request_id, source_warehouse_id, destination, receiver_user_id,
    courier_name, tracking_no, transport_type, status, package_count, delivery_charge,
    dispatched_at, expected_delivery_at, created_by
  ) values (
    v_dispatch_no, p_request_id, p_source_warehouse_id, trim(p_destination), p_receiver_user_id,
    nullif(trim(p_courier_name), ''), nullif(trim(p_tracking_no), ''), nullif(trim(p_transport_type), ''),
    'dispatched', 1, coalesce(p_delivery_charge, 0), timezone('utc', now()), p_expected_delivery_at, auth.uid()
  ) returning * into v_dispatch;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    select * into v_request_item
    from public.v12_parts_request_items
    where id = (v_item ->> 'request_item_id')::uuid and request_id = p_request_id
    for update;
    if not found then raise exception 'Request item not found'; end if;

    v_qty := coalesce(nullif(v_item ->> 'quantity', '')::numeric, 0);
    if v_qty <= 0 then raise exception 'Dispatch quantity must be greater than zero'; end if;
    if v_request_item.dispatched_qty + v_qty > v_request_item.approved_qty then raise exception 'Dispatch exceeds approved quantity'; end if;

    select coalesce(sum(reserved_qty - released_qty - consumed_qty), 0) into v_reserved
    from public.v13_parts_reservations
    where request_item_id = v_request_item.id and warehouse_id is not distinct from p_source_warehouse_id
      and status in ('active','partially_consumed');
    if v_reserved < v_qty then raise exception 'Not enough reserved quantity for dispatch'; end if;

    insert into public.v12_parts_dispatch_items (
      dispatch_id, request_item_id, quantity, serial_numbers, condition_at_dispatch
    ) values (
      v_dispatch.id, v_request_item.id, v_qty,
      coalesce(array(select jsonb_array_elements_text(coalesce(v_item -> 'serial_numbers', '[]'::jsonb))), '{}'),
      nullif(trim(v_item ->> 'condition_at_dispatch'), '')
    );

    update public.v12_parts_request_items
    set dispatched_qty = dispatched_qty + v_qty
    where id = v_request_item.id;

    update public.v13_parts_reservations
    set consumed_qty = least(reserved_qty - released_qty, consumed_qty + v_qty),
        status = case when consumed_qty + v_qty >= reserved_qty - released_qty then 'consumed' else 'partially_consumed' end
    where id in (
      select id from public.v13_parts_reservations
      where request_item_id = v_request_item.id and warehouse_id is not distinct from p_source_warehouse_id
        and status in ('active','partially_consumed')
      order by reserved_at
      for update
    )
    and v_qty > 0;

    insert into public.v13_parts_stock_postings (
      posting_no, posting_type, product_id, warehouse_id, engineer_id, request_id,
      request_item_id, dispatch_id, quantity, stock_effect, reference_no, note,
      idempotency_key
    ) values (
      'CJ-STK-' || to_char(timezone('utc', now()), 'YYYYMMDDHH24MISS') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''),1,5)),
      'dispatch_out', v_request_item.product_id, p_source_warehouse_id, p_receiver_user_id,
      p_request_id, v_request_item.id, v_dispatch.id, v_qty, -v_qty, v_dispatch_no,
      'Dispatched to ' || trim(p_destination), 'dispatch:' || v_dispatch.id::text || ':' || v_request_item.id::text
    );

    perform public.v13_apply_stock_balance(v_request_item.product_id, p_source_warehouse_id, -v_qty, 'service_dispatch', v_dispatch_no, 'V13 spare-parts dispatch');
  end loop;

  update public.v12_parts_requests r
  set status = case
    when not exists (
      select 1 from public.v12_parts_request_items i
      where i.request_id = r.id and i.dispatched_qty < i.approved_qty
    ) then 'dispatched' else 'partially_dispatched' end
  where r.id = p_request_id;

  return v_dispatch;
end;
$$;

create or replace function public.v13_receive_parts_dispatch(
  p_dispatch_id uuid,
  p_condition_summary text,
  p_proof_storage_path text,
  p_receiver_signature_path text,
  p_items jsonb,
  p_note text default null
)
returns public.v13_parts_receipts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dispatch public.v12_parts_dispatches;
  v_receipt public.v13_parts_receipts;
  v_item jsonb;
  v_dispatch_item public.v12_parts_dispatch_items;
  v_received numeric;
  v_damaged numeric;
  v_short numeric;
  v_receipt_no text;
  v_full boolean := true;
begin
  select * into v_dispatch from public.v12_parts_dispatches where id = p_dispatch_id for update;
  if not found then raise exception 'Dispatch not found'; end if;
  if v_dispatch.receiver_user_id <> auth.uid() and not public.v13_parts_role_allowed() then
    raise exception 'Not authorized to receive this dispatch';
  end if;
  if v_dispatch.status in ('received','cancelled') then raise exception 'Dispatch is already closed'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Receipt items are required'; end if;

  v_receipt_no := 'CJ-RCV-' || to_char(timezone('utc', now()), 'YYYYMMDDHH24MISS') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''),1,5));
  insert into public.v13_parts_receipts (
    receipt_no, dispatch_id, request_id, receiver_user_id, received_at,
    condition_summary, proof_storage_path, receiver_signature_path, status, note, created_by
  ) values (
    v_receipt_no, v_dispatch.id, v_dispatch.request_id, coalesce(v_dispatch.receiver_user_id, auth.uid()), timezone('utc', now()),
    p_condition_summary, p_proof_storage_path, p_receiver_signature_path, 'received', p_note, auth.uid()
  ) returning * into v_receipt;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    select * into v_dispatch_item
    from public.v12_parts_dispatch_items
    where id = (v_item ->> 'dispatch_item_id')::uuid and dispatch_id = p_dispatch_id
    for update;
    if not found then raise exception 'Dispatch item not found'; end if;

    v_received := coalesce(nullif(v_item ->> 'received_qty', '')::numeric, 0);
    v_damaged := coalesce(nullif(v_item ->> 'damaged_qty', '')::numeric, 0);
    v_short := coalesce(nullif(v_item ->> 'short_qty', '')::numeric, 0);
    if v_received < 0 or v_damaged < 0 or v_short < 0 then raise exception 'Receipt quantities cannot be negative'; end if;
    if v_received + v_damaged + v_short > v_dispatch_item.quantity then raise exception 'Receipt quantity exceeds dispatch quantity'; end if;
    if v_received + v_damaged + v_short < v_dispatch_item.quantity then v_full := false; end if;

    insert into public.v13_parts_receipt_items (
      receipt_id, dispatch_item_id, request_item_id, received_qty, damaged_qty,
      short_qty, condition_at_receipt, serial_numbers, note
    ) values (
      v_receipt.id, v_dispatch_item.id, v_dispatch_item.request_item_id, v_received, v_damaged,
      v_short, nullif(trim(v_item ->> 'condition_at_receipt'), ''),
      coalesce(array(select jsonb_array_elements_text(coalesce(v_item -> 'serial_numbers', '[]'::jsonb))), '{}'),
      nullif(trim(v_item ->> 'note'), '')
    );

    update public.v12_parts_request_items
    set received_qty = received_qty + v_received
    where id = v_dispatch_item.request_item_id;

    insert into public.v13_parts_stock_postings (
      posting_no, posting_type, product_id, engineer_id, request_id, request_item_id,
      dispatch_id, receipt_id, quantity, stock_effect, reference_no, note,
      idempotency_key
    )
    select
      'CJ-STK-' || to_char(timezone('utc', now()), 'YYYYMMDDHH24MISS') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''),1,5)),
      'engineer_receive', i.product_id, v_dispatch.receiver_user_id, v_dispatch.request_id,
      i.id, v_dispatch.id, v_receipt.id, v_received, 0, v_receipt_no,
      'Engineer received dispatched spare parts', 'receipt:' || v_receipt.id::text || ':' || i.id::text
    from public.v12_parts_request_items i where i.id = v_dispatch_item.request_item_id;
  end loop;

  update public.v13_parts_receipts
  set status = case when v_full then 'received' else 'partial' end
  where id = v_receipt.id
  returning * into v_receipt;

  update public.v12_parts_dispatches
  set status = case when v_full then 'received' else 'delivered' end,
      delivered_at = coalesce(delivered_at, timezone('utc', now())),
      received_at = case when v_full then timezone('utc', now()) else received_at end,
      proof_storage_path = coalesce(p_proof_storage_path, proof_storage_path),
      receiver_signature_path = coalesce(p_receiver_signature_path, receiver_signature_path)
  where id = p_dispatch_id;

  update public.v12_parts_requests
  set status = case when v_full then 'engineer_received' else 'in_transit' end
  where id = v_dispatch.request_id;

  return v_receipt;
end;
$$;

create or replace function public.v13_post_installed_part(
  p_request_item_id uuid,
  p_quantity numeric,
  p_service_case_id uuid default null,
  p_note text default null,
  p_idempotency_key text default null
)
returns public.v13_parts_stock_postings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.v12_parts_request_items;
  v_request public.v12_parts_requests;
  v_row public.v13_parts_stock_postings;
  v_no text;
begin
  if p_quantity <= 0 then raise exception 'Installed quantity must be greater than zero'; end if;
  select * into v_item from public.v12_parts_request_items where id = p_request_item_id for update;
  if not found then raise exception 'Request item not found'; end if;
  select * into v_request from public.v12_parts_requests where id = v_item.request_id;
  if v_request.requested_by <> auth.uid() and not public.v13_parts_role_allowed() then raise exception 'Not authorized'; end if;
  if v_item.installed_qty + p_quantity > v_item.received_qty then raise exception 'Installed quantity exceeds received quantity'; end if;

  update public.v12_parts_request_items
  set installed_qty = installed_qty + p_quantity
  where id = p_request_item_id;

  v_no := 'CJ-STK-' || to_char(timezone('utc', now()), 'YYYYMMDDHH24MISS') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''),1,5));
  insert into public.v13_parts_stock_postings (
    posting_no, posting_type, product_id, engineer_id, request_id, request_item_id,
    quantity, stock_effect, reference_no, note, idempotency_key, metadata
  ) values (
    v_no, 'install_use', v_item.product_id, auth.uid(), v_item.request_id, v_item.id,
    p_quantity, 0, v_request.request_no, p_note, p_idempotency_key,
    jsonb_build_object('service_case_id', p_service_case_id)
  ) on conflict (idempotency_key) do update set idempotency_key = excluded.idempotency_key
  returning * into v_row;

  update public.v12_parts_requests r
  set status = case
    when not exists (
      select 1 from public.v12_parts_request_items i
      where i.request_id = r.id and i.installed_qty < i.received_qty
    ) then 'used' else 'installed' end
  where r.id = v_item.request_id;

  return v_row;
end;
$$;

create or replace function public.v13_set_parts_updated_at()
returns trigger language plpgsql security invoker set search_path = public as $$
begin new.updated_at = timezone('utc', now()); return new; end;
$$;

drop trigger if exists v13_parts_reservation_updated_at on public.v13_parts_reservations;
create trigger v13_parts_reservation_updated_at before update on public.v13_parts_reservations
for each row execute function public.v13_set_parts_updated_at();

alter table public.v13_parts_reservations enable row level security;
alter table public.v13_parts_receipts enable row level security;
alter table public.v13_parts_receipt_items enable row level security;
alter table public.v13_parts_stock_postings enable row level security;

drop policy if exists v13_parts_reservation_read on public.v13_parts_reservations;
create policy v13_parts_reservation_read on public.v13_parts_reservations for select to authenticated
using (public.v13_parts_role_allowed() or exists (
  select 1 from public.v12_parts_request_items i join public.v12_parts_requests r on r.id=i.request_id
  where i.id=request_item_id and r.requested_by=auth.uid()
));
drop policy if exists v13_parts_reservation_write on public.v13_parts_reservations;
create policy v13_parts_reservation_write on public.v13_parts_reservations for all to authenticated
using (public.v13_parts_role_allowed()) with check (public.v13_parts_role_allowed());

drop policy if exists v13_parts_receipt_read on public.v13_parts_receipts;
create policy v13_parts_receipt_read on public.v13_parts_receipts for select to authenticated
using (receiver_user_id=auth.uid() or public.v13_parts_role_allowed() or public.v12_has_role(array['accounts','auditor']));
drop policy if exists v13_parts_receipt_write on public.v13_parts_receipts;
create policy v13_parts_receipt_write on public.v13_parts_receipts for all to authenticated
using (receiver_user_id=auth.uid() or public.v13_parts_role_allowed())
with check (receiver_user_id=auth.uid() or public.v13_parts_role_allowed());

drop policy if exists v13_parts_receipt_items_read on public.v13_parts_receipt_items;
create policy v13_parts_receipt_items_read on public.v13_parts_receipt_items for select to authenticated
using (exists (
  select 1 from public.v13_parts_receipts r where r.id=receipt_id
    and (r.receiver_user_id=auth.uid() or public.v13_parts_role_allowed() or public.v12_has_role(array['accounts','auditor']))
));

drop policy if exists v13_parts_stock_read on public.v13_parts_stock_postings;
create policy v13_parts_stock_read on public.v13_parts_stock_postings for select to authenticated
using (engineer_id=auth.uid() or public.v13_parts_role_allowed() or public.v12_has_role(array['accounts','auditor']));

grant select, insert, update on public.v13_parts_reservations to authenticated;
grant select, insert, update on public.v13_parts_receipts to authenticated;
grant select, insert on public.v13_parts_receipt_items to authenticated;
grant select on public.v13_parts_stock_postings to authenticated;
grant execute on function public.v13_approve_parts_request(uuid,jsonb,text) to authenticated;
grant execute on function public.v13_reserve_part(uuid,uuid,numeric,timestamptz,text) to authenticated;
grant execute on function public.v13_create_parts_dispatch(uuid,uuid,text,uuid,text,text,text,numeric,timestamptz,jsonb) to authenticated;
grant execute on function public.v13_receive_parts_dispatch(uuid,text,text,text,jsonb,text) to authenticated;
grant execute on function public.v13_post_installed_part(uuid,numeric,uuid,text,text) to authenticated;

comment on table public.v13_parts_stock_postings is 'Immutable V13 audit ledger for spare-parts reservation, dispatch, receipt, installation and returns.';
comment on function public.v13_create_parts_dispatch(uuid,uuid,text,uuid,text,text,text,numeric,timestamptz,jsonb) is 'Creates dispatch and items transactionally, consumes reservations and posts warehouse stock out.';
