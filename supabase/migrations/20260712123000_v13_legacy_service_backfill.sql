-- COLORJET ERP V13: Legacy service ticket preservation and backfill
-- Uses to_jsonb so the import tolerates legacy column differences.

alter table public.v13_service_cases
  add column if not exists legacy_reference text;

create unique index if not exists v13_service_cases_legacy_reference_unique
  on public.v13_service_cases (legacy_reference)
  where legacy_reference is not null;

create or replace function public.v13_backfill_legacy_service_tickets()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
     and not public.v12_has_role(array['owner','super_admin','admin','manager','service_manager']) then
    raise exception 'Not authorized to backfill legacy service tickets';
  end if;

  if to_regclass('public.service_tickets') is null then
    return 0;
  end if;

  execute $sql$
    with legacy as (
      select
        to_jsonb(t) as j,
        row_number() over (order by coalesce(
          nullif(to_jsonb(t) ->> 'created_at', '')::timestamptz,
          timezone('utc', now())
        ), to_jsonb(t) ->> 'id') as sequence_no
      from public.service_tickets t
    ), normalized as (
      select
        j,
        coalesce(
          nullif(j ->> 'ticket_no', ''),
          nullif(j ->> 'ticketNo', ''),
          nullif(j ->> 'case_no', ''),
          'LEGACY-' || sequence_no::text
        ) as legacy_ref,
        case
          when coalesce(j ->> 'id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
            then (j ->> 'id')::uuid
          else null
        end as legacy_uuid
      from legacy
    )
    insert into public.v13_service_cases (
      case_no,
      legacy_ticket_id,
      legacy_reference,
      customer_id,
      product_id,
      machine_serial,
      machine_model,
      customer_name,
      customer_phone,
      service_address,
      subject,
      problem_description,
      problem_category,
      service_type,
      warranty_status,
      billing_status,
      priority,
      status,
      assigned_engineer_id,
      scheduled_at,
      completed_at,
      closed_at,
      diagnosis,
      work_performed,
      resolution_summary,
      labour_cost,
      parts_cost,
      transport_cost,
      other_cost,
      chargeable_amount,
      source,
      created_by,
      created_at,
      updated_at
    )
    select
      'CJ-LEG-' || to_char(timezone('utc', now()), 'YYYYMMDD')
        || '-' || upper(substr(md5(n.legacy_ref), 1, 10)),
      n.legacy_uuid,
      n.legacy_ref,
      case
        when coalesce(n.j ->> 'customer_id', n.j ->> 'customerId', '')
          ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          then coalesce(n.j ->> 'customer_id', n.j ->> 'customerId')::uuid
        else null
      end,
      case
        when coalesce(n.j ->> 'product_id', n.j ->> 'productId', '')
          ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          then coalesce(n.j ->> 'product_id', n.j ->> 'productId')::uuid
        else null
      end,
      nullif(coalesce(n.j ->> 'machine_serial', n.j ->> 'machineSerial', n.j ->> 'serial_no'), ''),
      nullif(coalesce(n.j ->> 'machine_model', n.j ->> 'machineModel', n.j ->> 'model'), ''),
      coalesce(
        nullif(n.j ->> 'customer_name', ''),
        nullif(n.j ->> 'customerName', ''),
        'Legacy Customer'
      ),
      nullif(coalesce(n.j ->> 'customer_phone', n.j ->> 'customerPhone', n.j ->> 'phone'), ''),
      nullif(coalesce(n.j ->> 'customer_address', n.j ->> 'customerAddress', n.j ->> 'service_address', n.j ->> 'address'), ''),
      coalesce(
        nullif(n.j ->> 'title', ''),
        nullif(n.j ->> 'subject', ''),
        'Legacy Service Ticket'
      ),
      coalesce(
        nullif(n.j ->> 'description', ''),
        nullif(n.j ->> 'problem_description', ''),
        nullif(n.j ->> 'problemDescription', ''),
        'Imported from the legacy service ticket registry'
      ),
      nullif(coalesce(n.j ->> 'category', n.j ->> 'problem_category'), ''),
      case lower(coalesce(n.j ->> 'service_type', n.j ->> 'serviceType', 'onsite'))
        when 'remote' then 'remote'
        when 'office_repair' then 'office_repair'
        when 'supplier_repair' then 'supplier_repair'
        when 'installation' then 'installation'
        when 'training' then 'training'
        when 'preventive_maintenance' then 'preventive_maintenance'
        else 'onsite'
      end,
      case lower(coalesce(n.j ->> 'warranty_status', n.j ->> 'warrantyStatus', 'unknown'))
        when 'in_warranty' then 'in_warranty'
        when 'warranty' then 'in_warranty'
        when 'out_warranty' then 'out_warranty'
        when 'non_warranty' then 'out_warranty'
        when 'void' then 'void'
        when 'pending_verification' then 'pending_verification'
        else 'unknown'
      end,
      case lower(coalesce(n.j ->> 'billing_status', n.j ->> 'billingStatus', 'pending'))
        when 'warranty' then 'warranty'
        when 'free' then 'free'
        when 'chargeable' then 'chargeable'
        when 'quoted' then 'quoted'
        when 'approved' then 'approved'
        when 'invoiced' then 'invoiced'
        when 'paid' then 'paid'
        when 'waived' then 'waived'
        else 'pending'
      end,
      case lower(coalesce(n.j ->> 'priority', 'normal'))
        when 'low' then 'low'
        when 'high' then 'high'
        when 'urgent' then 'urgent'
        when 'emergency' then 'emergency'
        else 'normal'
      end,
      case lower(coalesce(n.j ->> 'status', 'new'))
        when 'open' then 'new'
        when 'verified' then 'verified'
        when 'assigned' then 'assigned'
        when 'accepted' then 'accepted'
        when 'travelling' then 'travelling'
        when 'arrived' then 'arrived'
        when 'checked_in' then 'checked_in'
        when 'diagnosis' then 'diagnosis'
        when 'in_progress' then 'work_started'
        when 'work_started' then 'work_started'
        when 'waiting_parts' then 'waiting_parts'
        when 'waiting_customer' then 'waiting_customer'
        when 'sent_supplier' then 'sent_supplier'
        when 'completed' then 'completed'
        when 'resolved' then 'completed'
        when 'customer_confirmed' then 'customer_confirmed'
        when 'closed' then 'closed'
        when 'cancelled' then 'cancelled'
        when 'escalated' then 'escalated'
        else 'new'
      end,
      case
        when coalesce(n.j ->> 'assigned_engineer_id', n.j ->> 'assignedEngineerId', n.j ->> 'engineer_id', '')
          ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          then coalesce(n.j ->> 'assigned_engineer_id', n.j ->> 'assignedEngineerId', n.j ->> 'engineer_id')::uuid
        else null
      end,
      case
        when coalesce(n.j ->> 'scheduled_at', n.j ->> 'scheduledAt', '') ~ '^\d{4}-\d{2}-\d{2}'
          then coalesce(n.j ->> 'scheduled_at', n.j ->> 'scheduledAt')::timestamptz
        else null
      end,
      case
        when coalesce(n.j ->> 'completed_at', n.j ->> 'completedAt', '') ~ '^\d{4}-\d{2}-\d{2}'
          then coalesce(n.j ->> 'completed_at', n.j ->> 'completedAt')::timestamptz
        else null
      end,
      case
        when coalesce(n.j ->> 'closed_at', n.j ->> 'closedAt', '') ~ '^\d{4}-\d{2}-\d{2}'
          then coalesce(n.j ->> 'closed_at', n.j ->> 'closedAt')::timestamptz
        else null
      end,
      nullif(n.j ->> 'diagnosis', ''),
      nullif(coalesce(n.j ->> 'work_performed', n.j ->> 'workPerformed'), ''),
      nullif(coalesce(n.j ->> 'resolution_summary', n.j ->> 'resolutionSummary'), ''),
      case when coalesce(n.j ->> 'labour_cost', n.j ->> 'labourCost', '') ~ '^[-+]?[0-9]*\.?[0-9]+$'
        then coalesce(n.j ->> 'labour_cost', n.j ->> 'labourCost')::numeric else 0 end,
      case when coalesce(n.j ->> 'parts_cost', n.j ->> 'partsCost', '') ~ '^[-+]?[0-9]*\.?[0-9]+$'
        then coalesce(n.j ->> 'parts_cost', n.j ->> 'partsCost')::numeric else 0 end,
      case when coalesce(n.j ->> 'transport_cost', n.j ->> 'transportCost', '') ~ '^[-+]?[0-9]*\.?[0-9]+$'
        then coalesce(n.j ->> 'transport_cost', n.j ->> 'transportCost')::numeric else 0 end,
      case when coalesce(n.j ->> 'other_cost', n.j ->> 'otherCost', '') ~ '^[-+]?[0-9]*\.?[0-9]+$'
        then coalesce(n.j ->> 'other_cost', n.j ->> 'otherCost')::numeric else 0 end,
      case when coalesce(n.j ->> 'chargeable_amount', n.j ->> 'chargeableAmount', '') ~ '^[-+]?[0-9]*\.?[0-9]+$'
        then coalesce(n.j ->> 'chargeable_amount', n.j ->> 'chargeableAmount')::numeric else 0 end,
      'legacy_import',
      case
        when coalesce(n.j ->> 'created_by', n.j ->> 'createdBy', '')
          ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          then coalesce(n.j ->> 'created_by', n.j ->> 'createdBy')::uuid
        else null
      end,
      case
        when coalesce(n.j ->> 'created_at', n.j ->> 'createdAt', '') ~ '^\d{4}-\d{2}-\d{2}'
          then coalesce(n.j ->> 'created_at', n.j ->> 'createdAt')::timestamptz
        else timezone('utc', now())
      end,
      case
        when coalesce(n.j ->> 'updated_at', n.j ->> 'updatedAt', '') ~ '^\d{4}-\d{2}-\d{2}'
          then coalesce(n.j ->> 'updated_at', n.j ->> 'updatedAt')::timestamptz
        else timezone('utc', now())
      end
    from normalized n
    where not exists (
      select 1
      from public.v13_service_cases c
      where c.legacy_reference = n.legacy_ref
         or (n.legacy_uuid is not null and c.legacy_ticket_id = n.legacy_uuid)
    )
    on conflict do nothing
  $sql$;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function public.v13_backfill_legacy_service_tickets() to authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.v13_backfill_legacy_service_tickets() to service_role;
  end if;
end;
$$;

-- Run once during deployment when a legacy table is present. This operation is idempotent.
do $$
begin
  if to_regclass('public.service_tickets') is not null then
    perform public.v13_backfill_legacy_service_tickets();
  end if;
exception
  when insufficient_privilege then
    raise notice 'Legacy service ticket backfill deferred: deployment role cannot read service_tickets.';
end;
$$;

comment on function public.v13_backfill_legacy_service_tickets() is
  'Idempotently imports legacy service tickets using JSON field aliases while retaining legacy references.';
