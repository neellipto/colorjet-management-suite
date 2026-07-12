-- COLORJET ERP V12 transactional spare-parts request creation.
-- Parent and item rows are committed together or rolled back together.

create or replace function public.v12_create_parts_request(
  p_ticket_id uuid,
  p_visit_id uuid,
  p_urgency text,
  p_request_type text,
  p_reason text,
  p_required_at timestamptz,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request_id uuid;
  v_request_no text;
  v_item jsonb;
  v_product_name text;
  v_quantity numeric;
  v_billing_type text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if p_urgency not in ('low','normal','high','urgent','emergency') then
    raise exception 'Invalid urgency';
  end if;

  if p_request_type not in ('service','warranty','replacement','internal_repair') then
    raise exception 'Invalid request type';
  end if;

  if nullif(trim(p_reason), '') is null then
    raise exception 'Request reason is required';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'At least one spare part is required';
  end if;

  if p_visit_id is not null and not exists (
    select 1
    from public.v12_customer_visits visit
    where visit.id = p_visit_id
      and (
        visit.assigned_engineer_id = auth.uid()
        or public.v12_has_role(array['owner','super_admin','admin','manager','service_manager'])
      )
  ) then
    raise exception 'Not authorized for this visit';
  end if;

  v_request_no := 'CJ-PR-' || to_char(timezone('utc', now()), 'YYYYMMDDHH24MISS') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  insert into public.v12_parts_requests (
    request_no, ticket_id, visit_id, requested_by, urgency, request_type,
    status, reason, required_at
  ) values (
    v_request_no, p_ticket_id, p_visit_id, auth.uid(), p_urgency, p_request_type,
    'requested', trim(p_reason), p_required_at
  ) returning id into v_request_id;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_product_name := nullif(trim(v_item ->> 'product_name'), '');
    v_quantity := coalesce(nullif(v_item ->> 'requested_qty', '')::numeric, 0);
    v_billing_type := coalesce(nullif(v_item ->> 'billing_type', ''), 'warranty');

    if v_product_name is null then
      raise exception 'Every item requires a product name';
    end if;

    if v_quantity <= 0 then
      raise exception 'Every item quantity must be greater than zero';
    end if;

    if v_billing_type not in ('warranty','free','chargeable') then
      raise exception 'Invalid billing type';
    end if;

    insert into public.v12_parts_request_items (
      request_id, product_id, sku, product_name, model, identification_no,
      requested_qty, billing_type, damaged_part_serial, note
    ) values (
      v_request_id,
      nullif(v_item ->> 'product_id', '')::uuid,
      nullif(trim(v_item ->> 'sku'), ''),
      v_product_name,
      nullif(trim(v_item ->> 'model'), ''),
      nullif(trim(v_item ->> 'identification_no'), ''),
      v_quantity,
      v_billing_type,
      nullif(trim(v_item ->> 'damaged_part_serial'), ''),
      nullif(trim(v_item ->> 'note'), '')
    );
  end loop;

  return v_request_id;
end;
$$;

revoke all on function public.v12_create_parts_request(uuid,uuid,text,text,text,timestamptz,jsonb) from public;
grant execute on function public.v12_create_parts_request(uuid,uuid,text,text,text,timestamptz,jsonb) to authenticated;

comment on function public.v12_create_parts_request(uuid,uuid,text,text,text,timestamptz,jsonb)
  is 'Creates a COLORJET spare-parts request and all items in one authenticated transaction.';
