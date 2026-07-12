import { getSupabase } from '@/lib/supabaseClient';

export interface WarehouseOption {
  id: string;
  code?: string | null;
  name: string;
}

export interface PartsStockPosting {
  id: string;
  posting_no: string;
  posting_type: string;
  product_id?: string | null;
  warehouse_id?: string | null;
  engineer_id?: string | null;
  request_id?: string | null;
  request_item_id?: string | null;
  dispatch_id?: string | null;
  receipt_id?: string | null;
  quantity: number;
  stock_effect: number;
  unit_cost: number;
  total_cost: number;
  reference_no?: string | null;
  note?: string | null;
  posted_at: string;
}

export async function listWarehouseOptions(): Promise<WarehouseOption[]> {
  const { data, error } = await getSupabase()
    .from('warehouses')
    .select('id,code,name')
    .order('name', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as WarehouseOption[];
}

export async function listPartsStockPostings(limit = 500): Promise<PartsStockPosting[]> {
  const { data, error } = await getSupabase()
    .from('v13_parts_stock_postings')
    .select('*')
    .order('posted_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as PartsStockPosting[];
}

export async function postInstalledPart(input: {
  requestItemId: string;
  quantity: number;
  serviceCaseId?: string;
  note?: string;
  idempotencyKey?: string;
}): Promise<PartsStockPosting> {
  const { data, error } = await getSupabase().rpc('v13_post_installed_part', {
    p_request_item_id: input.requestItemId,
    p_quantity: input.quantity,
    p_service_case_id: input.serviceCaseId ?? null,
    p_note: input.note ?? null,
    p_idempotency_key: input.idempotencyKey ?? null,
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Installed part could not be posted.');
  return data as PartsStockPosting;
}
