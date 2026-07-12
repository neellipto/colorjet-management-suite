-- COLORJET ERP V13: LC/TT Import, Shipment and Trucking

create table if not exists public.v13_import_orders (
  id uuid primary key default gen_random_uuid(),
  import_no text not null unique,
  supplier_id uuid,
  supplier_name text not null,
  purchase_order_no text,
  pi_no text,
  transaction_type text not null
    check (transaction_type in ('LC','TT','CASH','CREDIT')),
  lc_no text,
  lc_open_date date,
  lc_expiry_date date,
  currency text not null default 'USD',
  exchange_rate numeric(14,6) not null default 1 check (exchange_rate > 0),
  goods_value_foreign numeric(16,2) not null default 0,
  goods_value_bdt numeric(16,2)
    generated always as (round(goods_value_foreign * exchange_rate, 2)) stored,
  advance_required numeric(16,2) not null default 0,
  production_payment_required numeric(16,2) not null default 0,
  shipment_payment_required numeric(16,2) not null default 0,
  total_paid_foreign numeric(16,2) not null default 0,
  bank_charge_bdt numeric(16,2) not null default 0,
  amendment_charge_bdt numeric(16,2) not null default 0,
  status text not null default 'draft'
    check (status in (
      'draft','pi_received','approval_pending','approved','advance_paid','production',
      'production_complete','shipment_payment_due','shipment_ready','shipped','at_port',
      'customs_clearance','released','warehouse_received','landed_cost_pending','closed','cancelled'
    )),
  production_start_date date,
  production_complete_date date,
  expected_ship_date date,
  expected_arrival_date date,
  notes text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists v13_import_orders_status_idx
  on public.v13_import_orders (status, expected_arrival_date);
create index if not exists v13_import_orders_supplier_idx
  on public.v13_import_orders (supplier_id, created_at desc);

create table if not exists public.v13_import_order_items (
  id uuid primary key default gen_random_uuid(),
  import_order_id uuid not null references public.v13_import_orders(id) on delete cascade,
  product_id uuid,
  sku text,
  product_name text not null,
  model text,
  identification_no text,
  quantity numeric(14,3) not null check (quantity > 0),
  unit text not null default 'pcs',
  unit_price_foreign numeric(16,4) not null default 0,
  line_total_foreign numeric(16,2)
    generated always as (round(quantity * unit_price_foreign, 2)) stored,
  weight_kg numeric(14,3),
  cbm numeric(14,4),
  category text,
  note text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists v13_import_order_items_order_idx
  on public.v13_import_order_items (import_order_id);

create table if not exists public.v13_import_payments (
  id uuid primary key default gen_random_uuid(),
  import_order_id uuid not null references public.v13_import_orders(id) on delete restrict,
  payment_no text not null unique,
  payment_stage text not null
    check (payment_stage in ('advance','production','before_shipment','balance','freight','bank_charge','amendment','other')),
  payment_method text not null
    check (payment_method in ('LC','TT','BANK','CASH','CARD','OTHER')),
  amount_foreign numeric(16,2) not null default 0,
  currency text not null default 'USD',
  exchange_rate numeric(14,6) not null default 1 check (exchange_rate > 0),
  amount_bdt numeric(16,2)
    generated always as (round(amount_foreign * exchange_rate, 2)) stored,
  bank_name text,
  reference_no text,
  payment_date date not null,
  attachment_path text,
  note text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists v13_import_payments_order_idx
  on public.v13_import_payments (import_order_id, payment_date desc);

create table if not exists public.v13_shipments (
  id uuid primary key default gen_random_uuid(),
  shipment_no text not null unique,
  import_order_id uuid not null references public.v13_import_orders(id) on delete restrict,
  shipment_mode text not null
    check (shipment_mode in ('SEA','AIR','ROAD','COURIER','DOOR_TO_DOOR','WITH_MACHINE')),
  carrier_name text,
  vessel_flight_no text,
  booking_no text,
  bl_awb_no text,
  container_no text,
  seal_no text,
  origin text,
  destination text,
  port_of_loading text,
  port_of_discharge text,
  etd date,
  eta date,
  actual_departure_at timestamptz,
  actual_arrival_at timestamptz,
  freight_cost_foreign numeric(16,2) not null default 0,
  freight_currency text not null default 'USD',
  status text not null default 'booking'
    check (status in (
      'booking','pickup_pending','picked_up','at_origin_warehouse','customs_origin',
      'departed','in_transit','transshipment','arrived_port','customs_destination',
      'released','truck_assigned','warehouse_delivered','closed','delayed','cancelled'
    )),
  delay_reason text,
  tracking_url text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists v13_shipments_status_idx
  on public.v13_shipments (status, eta);
create index if not exists v13_shipments_order_idx
  on public.v13_shipments (import_order_id, created_at desc);

create table if not exists public.v13_shipment_events (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references public.v13_shipments(id) on delete cascade,
  event_type text not null,
  status text,
  event_time timestamptz not null default timezone('utc', now()),
  location text,
  latitude double precision,
  longitude double precision,
  note text,
  source text not null default 'manual'
    check (source in ('manual','carrier_api','email','webhook','system')),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists v13_shipment_events_idx
  on public.v13_shipment_events (shipment_id, event_time desc);

create table if not exists public.v13_trucking_jobs (
  id uuid primary key default gen_random_uuid(),
  trucking_no text not null unique,
  shipment_id uuid references public.v13_shipments(id) on delete set null,
  import_order_id uuid references public.v13_import_orders(id) on delete set null,
  trucking_type text not null
    check (trucking_type in ('CHINA_PICKUP','PORT_TO_WAREHOUSE','WAREHOUSE_TRANSFER','CUSTOMER_DELIVERY','WARRANTY_PARTS','OTHER')),
  transporter_name text,
  driver_name text,
  driver_phone text,
  vehicle_no text,
  pickup_location text not null,
  delivery_location text not null,
  pickup_at timestamptz,
  expected_delivery_at timestamptz,
  delivered_at timestamptz,
  transport_cost numeric(14,2) not null default 0,
  status text not null default 'planned'
    check (status in ('planned','assigned','pickup_started','picked_up','in_transit','checkpoint','delayed','arrived','delivered','proof_received','closed','cancelled')),
  proof_storage_path text,
  receiver_name text,
  receiver_phone text,
  note text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists v13_trucking_jobs_status_idx
  on public.v13_trucking_jobs (status, expected_delivery_at);
create index if not exists v13_trucking_jobs_shipment_idx
  on public.v13_trucking_jobs (shipment_id, created_at desc);

create table if not exists public.v13_trucking_events (
  id uuid primary key default gen_random_uuid(),
  trucking_job_id uuid not null references public.v13_trucking_jobs(id) on delete cascade,
  status text not null,
  event_time timestamptz not null default timezone('utc', now()),
  location text,
  latitude double precision,
  longitude double precision,
  note text,
  proof_storage_path text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists v13_trucking_events_idx
  on public.v13_trucking_events (trucking_job_id, event_time desc);

create or replace function public.v13_import_updated_at()
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
  foreach v_table in array array['v13_import_orders','v13_shipments','v13_trucking_jobs']
  loop
    execute format('drop trigger if exists %I on public.%I', 'trg_' || v_table || '_updated_at', v_table);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.v13_import_updated_at()',
      'trg_' || v_table || '_updated_at',
      v_table
    );
  end loop;
end;
$$;

create or replace function public.v13_create_import_order(
  p_supplier_id uuid,
  p_supplier_name text,
  p_purchase_order_no text,
  p_pi_no text,
  p_transaction_type text,
  p_lc_no text,
  p_lc_open_date date,
  p_lc_expiry_date date,
  p_currency text,
  p_exchange_rate numeric,
  p_advance_required numeric,
  p_production_payment_required numeric,
  p_shipment_payment_required numeric,
  p_expected_ship_date date,
  p_expected_arrival_date date,
  p_notes text,
  p_items jsonb
)
returns public.v13_import_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.v13_import_orders;
  v_item jsonb;
  v_no text;
  v_goods_value numeric := 0;
begin
  if not public.v12_has_role(array['owner','super_admin','admin','manager','commercial','accounts']) then
    raise exception 'Not authorized to create import order';
  end if;
  if nullif(trim(p_supplier_name), '') is null then
    raise exception 'Supplier name is required';
  end if;
  if p_transaction_type not in ('LC','TT','CASH','CREDIT') then
    raise exception 'Invalid transaction type';
  end if;
  if coalesce(p_exchange_rate, 0) <= 0 then
    raise exception 'Exchange rate must be greater than zero';
  end if;
  if p_transaction_type = 'LC' and nullif(trim(p_lc_no), '') is null then
    raise exception 'LC number is required for LC import';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'At least one import item is required';
  end if;

  select coalesce(sum(
    coalesce(nullif(value ->> 'quantity', '')::numeric, 0)
    * coalesce(nullif(value ->> 'unit_price_foreign', '')::numeric, 0)
  ), 0)
  into v_goods_value
  from jsonb_array_elements(p_items);

  v_no := 'CJ-IMP-'
    || to_char(timezone('utc', now()), 'YYYYMMDDHH24MISS')
    || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 5));

  insert into public.v13_import_orders (
    import_no, supplier_id, supplier_name, purchase_order_no, pi_no,
    transaction_type, lc_no, lc_open_date, lc_expiry_date, currency,
    exchange_rate, goods_value_foreign, advance_required,
    production_payment_required, shipment_payment_required,
    expected_ship_date, expected_arrival_date, status, notes, created_by
  ) values (
    v_no, p_supplier_id, trim(p_supplier_name), nullif(trim(p_purchase_order_no), ''),
    nullif(trim(p_pi_no), ''), p_transaction_type, nullif(trim(p_lc_no), ''),
    p_lc_open_date, p_lc_expiry_date, coalesce(nullif(trim(p_currency), ''), 'USD'),
    p_exchange_rate, v_goods_value, coalesce(p_advance_required, 0),
    coalesce(p_production_payment_required, 0), coalesce(p_shipment_payment_required, 0),
    p_expected_ship_date, p_expected_arrival_date,
    case when nullif(trim(p_pi_no), '') is null then 'draft' else 'pi_received' end,
    nullif(trim(p_notes), ''), auth.uid()
  )
  returning * into v_order;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    if nullif(trim(v_item ->> 'product_name'), '') is null then
      raise exception 'Every import item requires a product name';
    end if;
    if coalesce(nullif(v_item ->> 'quantity', '')::numeric, 0) <= 0 then
      raise exception 'Every import item quantity must be greater than zero';
    end if;

    insert into public.v13_import_order_items (
      import_order_id, product_id, sku, product_name, model,
      identification_no, quantity, unit, unit_price_foreign,
      weight_kg, cbm, category, note
    ) values (
      v_order.id,
      nullif(v_item ->> 'product_id', '')::uuid,
      nullif(trim(v_item ->> 'sku'), ''),
      trim(v_item ->> 'product_name'),
      nullif(trim(v_item ->> 'model'), ''),
      nullif(trim(v_item ->> 'identification_no'), ''),
      (v_item ->> 'quantity')::numeric,
      coalesce(nullif(trim(v_item ->> 'unit'), ''), 'pcs'),
      coalesce(nullif(v_item ->> 'unit_price_foreign', '')::numeric, 0),
      nullif(v_item ->> 'weight_kg', '')::numeric,
      nullif(v_item ->> 'cbm', '')::numeric,
      nullif(trim(v_item ->> 'category'), ''),
      nullif(trim(v_item ->> 'note'), '')
    );
  end loop;

  return v_order;
end;
$$;

create or replace function public.v13_record_import_payment(
  p_import_order_id uuid,
  p_payment_stage text,
  p_payment_method text,
  p_amount_foreign numeric,
  p_currency text,
  p_exchange_rate numeric,
  p_bank_name text,
  p_reference_no text,
  p_payment_date date,
  p_attachment_path text,
  p_note text
)
returns public.v13_import_payments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.v13_import_payments;
  v_no text;
  v_total numeric;
begin
  if not public.v12_has_role(array['owner','super_admin','admin','manager','accounts','commercial']) then
    raise exception 'Not authorized to record import payment';
  end if;
  if p_amount_foreign <= 0 then
    raise exception 'Payment amount must be greater than zero';
  end if;
  if coalesce(p_exchange_rate, 0) <= 0 then
    raise exception 'Exchange rate must be greater than zero';
  end if;

  v_no := 'CJ-IMP-PAY-'
    || to_char(timezone('utc', now()), 'YYYYMMDDHH24MISS')
    || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 5));

  insert into public.v13_import_payments (
    import_order_id, payment_no, payment_stage, payment_method,
    amount_foreign, currency, exchange_rate, bank_name,
    reference_no, payment_date, attachment_path, note, created_by
  ) values (
    p_import_order_id, v_no, p_payment_stage, p_payment_method,
    p_amount_foreign, coalesce(nullif(trim(p_currency), ''), 'USD'),
    p_exchange_rate, nullif(trim(p_bank_name), ''),
    nullif(trim(p_reference_no), ''), p_payment_date,
    nullif(trim(p_attachment_path), ''), nullif(trim(p_note), ''), auth.uid()
  )
  returning * into v_row;

  select coalesce(sum(amount_foreign), 0)
  into v_total
  from public.v13_import_payments
  where import_order_id = p_import_order_id
    and currency = v_row.currency;

  update public.v13_import_orders
  set total_paid_foreign = v_total,
      status = case
        when p_payment_stage = 'advance' then 'advance_paid'
        when p_payment_stage = 'before_shipment' then 'shipment_ready'
        else status
      end
  where id = p_import_order_id;

  return v_row;
end;
$$;

create or replace function public.v13_create_shipment(
  p_import_order_id uuid,
  p_shipment_mode text,
  p_carrier_name text,
  p_vessel_flight_no text,
  p_booking_no text,
  p_bl_awb_no text,
  p_container_no text,
  p_origin text,
  p_destination text,
  p_port_of_loading text,
  p_port_of_discharge text,
  p_etd date,
  p_eta date,
  p_freight_cost_foreign numeric,
  p_freight_currency text,
  p_tracking_url text
)
returns public.v13_shipments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.v13_shipments;
  v_no text;
begin
  if not public.v12_has_role(array['owner','super_admin','admin','manager','commercial','store']) then
    raise exception 'Not authorized to create shipment';
  end if;
  if p_shipment_mode not in ('SEA','AIR','ROAD','COURIER','DOOR_TO_DOOR','WITH_MACHINE') then
    raise exception 'Invalid shipment mode';
  end if;
  if not exists (select 1 from public.v13_import_orders where id = p_import_order_id) then
    raise exception 'Import order not found';
  end if;

  v_no := 'CJ-SHP-'
    || to_char(timezone('utc', now()), 'YYYYMMDDHH24MISS')
    || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 5));

  insert into public.v13_shipments (
    shipment_no, import_order_id, shipment_mode, carrier_name,
    vessel_flight_no, booking_no, bl_awb_no, container_no,
    origin, destination, port_of_loading, port_of_discharge,
    etd, eta, freight_cost_foreign, freight_currency,
    status, tracking_url, created_by
  ) values (
    v_no, p_import_order_id, p_shipment_mode, nullif(trim(p_carrier_name), ''),
    nullif(trim(p_vessel_flight_no), ''), nullif(trim(p_booking_no), ''),
    nullif(trim(p_bl_awb_no), ''), nullif(trim(p_container_no), ''),
    nullif(trim(p_origin), ''), nullif(trim(p_destination), ''),
    nullif(trim(p_port_of_loading), ''), nullif(trim(p_port_of_discharge), ''),
    p_etd, p_eta, coalesce(p_freight_cost_foreign, 0),
    coalesce(nullif(trim(p_freight_currency), ''), 'USD'),
    'booking', nullif(trim(p_tracking_url), ''), auth.uid()
  )
  returning * into v_row;

  update public.v13_import_orders
  set status = 'shipment_ready'
  where id = p_import_order_id
    and status not in ('cancelled','closed');

  return v_row;
end;
$$;

create or replace function public.v13_update_shipment_status(
  p_shipment_id uuid,
  p_status text,
  p_event_time timestamptz,
  p_location text,
  p_note text,
  p_latitude double precision default null,
  p_longitude double precision default null
)
returns public.v13_shipments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.v13_shipments;
begin
  if not public.v12_has_role(array['owner','super_admin','admin','manager','commercial','store','accounts']) then
    raise exception 'Not authorized to update shipment';
  end if;
  if p_status not in (
    'booking','pickup_pending','picked_up','at_origin_warehouse','customs_origin',
    'departed','in_transit','transshipment','arrived_port','customs_destination',
    'released','truck_assigned','warehouse_delivered','closed','delayed','cancelled'
  ) then
    raise exception 'Invalid shipment status';
  end if;

  update public.v13_shipments
  set status = p_status,
      actual_departure_at = case
        when p_status = 'departed' then coalesce(actual_departure_at, p_event_time, timezone('utc', now()))
        else actual_departure_at
      end,
      actual_arrival_at = case
        when p_status in ('arrived_port','warehouse_delivered','closed')
          then coalesce(actual_arrival_at, p_event_time, timezone('utc', now()))
        else actual_arrival_at
      end,
      delay_reason = case when p_status = 'delayed' then p_note else delay_reason end
  where id = p_shipment_id
  returning * into v_row;

  if not found then
    raise exception 'Shipment not found';
  end if;

  insert into public.v13_shipment_events (
    shipment_id, event_type, status, event_time, location,
    latitude, longitude, note, source, created_by
  ) values (
    p_shipment_id, 'status_update', p_status,
    coalesce(p_event_time, timezone('utc', now())),
    nullif(trim(p_location), ''), p_latitude, p_longitude,
    nullif(trim(p_note), ''), 'manual', auth.uid()
  );

  update public.v13_import_orders
  set status = case
    when p_status = 'departed' then 'shipped'
    when p_status = 'arrived_port' then 'at_port'
    when p_status = 'customs_destination' then 'customs_clearance'
    when p_status = 'released' then 'released'
    when p_status = 'warehouse_delivered' then 'warehouse_received'
    when p_status = 'closed' then 'landed_cost_pending'
    else status
  end
  where id = v_row.import_order_id;

  return v_row;
end;
$$;

create or replace function public.v13_create_trucking_job(
  p_shipment_id uuid,
  p_import_order_id uuid,
  p_trucking_type text,
  p_transporter_name text,
  p_driver_name text,
  p_driver_phone text,
  p_vehicle_no text,
  p_pickup_location text,
  p_delivery_location text,
  p_expected_delivery_at timestamptz,
  p_transport_cost numeric,
  p_note text
)
returns public.v13_trucking_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.v13_trucking_jobs;
  v_no text;
begin
  if not public.v12_has_role(array['owner','super_admin','admin','manager','commercial','store','sales']) then
    raise exception 'Not authorized to create trucking job';
  end if;
  if p_trucking_type not in ('CHINA_PICKUP','PORT_TO_WAREHOUSE','WAREHOUSE_TRANSFER','CUSTOMER_DELIVERY','WARRANTY_PARTS','OTHER') then
    raise exception 'Invalid trucking type';
  end if;
  if nullif(trim(p_pickup_location), '') is null
     or nullif(trim(p_delivery_location), '') is null then
    raise exception 'Pickup and delivery locations are required';
  end if;

  v_no := 'CJ-TRK-'
    || to_char(timezone('utc', now()), 'YYYYMMDDHH24MISS')
    || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 5));

  insert into public.v13_trucking_jobs (
    trucking_no, shipment_id, import_order_id, trucking_type,
    transporter_name, driver_name, driver_phone, vehicle_no,
    pickup_location, delivery_location, expected_delivery_at,
    transport_cost, status, note, created_by
  ) values (
    v_no, p_shipment_id, p_import_order_id, p_trucking_type,
    nullif(trim(p_transporter_name), ''), nullif(trim(p_driver_name), ''),
    nullif(trim(p_driver_phone), ''), nullif(trim(p_vehicle_no), ''),
    trim(p_pickup_location), trim(p_delivery_location), p_expected_delivery_at,
    coalesce(p_transport_cost, 0),
    case when nullif(trim(p_driver_name), '') is null then 'planned' else 'assigned' end,
    nullif(trim(p_note), ''), auth.uid()
  )
  returning * into v_row;

  if p_shipment_id is not null then
    update public.v13_shipments
    set status = 'truck_assigned'
    where id = p_shipment_id
      and status not in ('closed','cancelled');
  end if;

  return v_row;
end;
$$;

create or replace function public.v13_update_trucking_status(
  p_trucking_job_id uuid,
  p_status text,
  p_event_time timestamptz,
  p_location text,
  p_note text,
  p_latitude double precision default null,
  p_longitude double precision default null,
  p_proof_storage_path text default null,
  p_receiver_name text default null,
  p_receiver_phone text default null
)
returns public.v13_trucking_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.v13_trucking_jobs;
begin
  if not public.v12_has_role(array['owner','super_admin','admin','manager','commercial','store','engineer','sales']) then
    raise exception 'Not authorized to update trucking';
  end if;
  if p_status not in ('planned','assigned','pickup_started','picked_up','in_transit','checkpoint','delayed','arrived','delivered','proof_received','closed','cancelled') then
    raise exception 'Invalid trucking status';
  end if;

  update public.v13_trucking_jobs
  set status = p_status,
      pickup_at = case
        when p_status in ('pickup_started','picked_up')
          then coalesce(pickup_at, p_event_time, timezone('utc', now()))
        else pickup_at
      end,
      delivered_at = case
        when p_status in ('delivered','proof_received','closed')
          then coalesce(delivered_at, p_event_time, timezone('utc', now()))
        else delivered_at
      end,
      proof_storage_path = coalesce(nullif(trim(p_proof_storage_path), ''), proof_storage_path),
      receiver_name = coalesce(nullif(trim(p_receiver_name), ''), receiver_name),
      receiver_phone = coalesce(nullif(trim(p_receiver_phone), ''), receiver_phone)
  where id = p_trucking_job_id
  returning * into v_row;

  if not found then
    raise exception 'Trucking job not found';
  end if;

  insert into public.v13_trucking_events (
    trucking_job_id, status, event_time, location,
    latitude, longitude, note, proof_storage_path, created_by
  ) values (
    p_trucking_job_id, p_status,
    coalesce(p_event_time, timezone('utc', now())),
    nullif(trim(p_location), ''), p_latitude, p_longitude,
    nullif(trim(p_note), ''), nullif(trim(p_proof_storage_path), ''), auth.uid()
  );

  if v_row.shipment_id is not null and p_status in ('delivered','proof_received','closed') then
    update public.v13_shipments
    set status = 'warehouse_delivered',
        actual_arrival_at = coalesce(actual_arrival_at, v_row.delivered_at, timezone('utc', now()))
    where id = v_row.shipment_id
      and status not in ('closed','cancelled');
  end if;

  return v_row;
end;
$$;

alter table public.v13_import_orders enable row level security;
alter table public.v13_import_order_items enable row level security;
alter table public.v13_import_payments enable row level security;
alter table public.v13_shipments enable row level security;
alter table public.v13_shipment_events enable row level security;
alter table public.v13_trucking_jobs enable row level security;
alter table public.v13_trucking_events enable row level security;

drop policy if exists v13_import_read on public.v13_import_orders;
create policy v13_import_read
on public.v13_import_orders for select to authenticated
using (public.v12_has_role(array['owner','super_admin','admin','manager','commercial','accounts','store','auditor']));

drop policy if exists v13_import_write on public.v13_import_orders;
create policy v13_import_write
on public.v13_import_orders for all to authenticated
using (public.v12_has_role(array['owner','super_admin','admin','manager','commercial','accounts']))
with check (public.v12_has_role(array['owner','super_admin','admin','manager','commercial','accounts']));

drop policy if exists v13_import_items_rw on public.v13_import_order_items;
create policy v13_import_items_rw
on public.v13_import_order_items for all to authenticated
using (public.v12_has_role(array['owner','super_admin','admin','manager','commercial','accounts','store','auditor']))
with check (public.v12_has_role(array['owner','super_admin','admin','manager','commercial','accounts']));

drop policy if exists v13_import_payments_read on public.v13_import_payments;
create policy v13_import_payments_read
on public.v13_import_payments for select to authenticated
using (public.v12_has_role(array['owner','super_admin','admin','manager','commercial','accounts','auditor']));

drop policy if exists v13_import_payments_write on public.v13_import_payments;
create policy v13_import_payments_write
on public.v13_import_payments for insert to authenticated
with check (public.v12_has_role(array['owner','super_admin','admin','manager','accounts']));

drop policy if exists v13_shipments_read on public.v13_shipments;
create policy v13_shipments_read
on public.v13_shipments for select to authenticated
using (public.v12_has_role(array['owner','super_admin','admin','manager','commercial','accounts','store','sales','engineer','auditor']));

drop policy if exists v13_shipments_write on public.v13_shipments;
create policy v13_shipments_write
on public.v13_shipments for all to authenticated
using (public.v12_has_role(array['owner','super_admin','admin','manager','commercial','store']))
with check (public.v12_has_role(array['owner','super_admin','admin','manager','commercial','store']));

drop policy if exists v13_shipment_events_read on public.v13_shipment_events;
create policy v13_shipment_events_read
on public.v13_shipment_events for select to authenticated
using (public.v12_has_role(array['owner','super_admin','admin','manager','commercial','accounts','store','sales','engineer','auditor']));

drop policy if exists v13_trucking_read on public.v13_trucking_jobs;
create policy v13_trucking_read
on public.v13_trucking_jobs for select to authenticated
using (public.v12_has_role(array['owner','super_admin','admin','manager','commercial','accounts','store','sales','engineer','auditor']));

drop policy if exists v13_trucking_write on public.v13_trucking_jobs;
create policy v13_trucking_write
on public.v13_trucking_jobs for all to authenticated
using (public.v12_has_role(array['owner','super_admin','admin','manager','commercial','store','sales','engineer']))
with check (public.v12_has_role(array['owner','super_admin','admin','manager','commercial','store','sales','engineer']));

drop policy if exists v13_trucking_events_read on public.v13_trucking_events;
create policy v13_trucking_events_read
on public.v13_trucking_events for select to authenticated
using (public.v12_has_role(array['owner','super_admin','admin','manager','commercial','accounts','store','sales','engineer','auditor']));

grant select, insert, update on public.v13_import_orders to authenticated;
grant select, insert, update on public.v13_import_order_items to authenticated;
grant select, insert on public.v13_import_payments to authenticated;
grant select, insert, update on public.v13_shipments to authenticated;
grant select on public.v13_shipment_events to authenticated;
grant select, insert, update on public.v13_trucking_jobs to authenticated;
grant select on public.v13_trucking_events to authenticated;

grant execute on function public.v13_create_import_order(uuid,text,text,text,text,text,date,date,text,numeric,numeric,numeric,numeric,date,date,text,jsonb) to authenticated;
grant execute on function public.v13_record_import_payment(uuid,text,text,numeric,text,numeric,text,text,date,text,text) to authenticated;
grant execute on function public.v13_create_shipment(uuid,text,text,text,text,text,text,text,text,text,text,date,date,numeric,text,text) to authenticated;
grant execute on function public.v13_update_shipment_status(uuid,text,timestamptz,text,text,double precision,double precision) to authenticated;
grant execute on function public.v13_create_trucking_job(uuid,uuid,text,text,text,text,text,text,text,timestamptz,numeric,text) to authenticated;
grant execute on function public.v13_update_trucking_status(uuid,text,timestamptz,text,text,double precision,double precision,text,text,text) to authenticated;

comment on table public.v13_import_orders is
  'COLORJET LC, TT and foreign purchase source of truth with staged payments.';
comment on table public.v13_shipments is
  'Shipment lifecycle from booking and departure through customs and warehouse receipt.';
comment on table public.v13_trucking_jobs is
  'China pickup, port, warehouse, customer delivery and warranty-parts trucking workflow.';
