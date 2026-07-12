import { getSupabase } from '@/lib/supabaseClient';

export interface BiometricMapping {
  id: string;
  device_id: string;
  device_user_code: string;
  employee_id: string;
  active: boolean;
  created_at: string;
}

export interface BiometricEvent {
  id: string;
  device_id?: string | null;
  connector_id?: string | null;
  employee_id?: string | null;
  device_user_code: string;
  event_time: string;
  event_type: string;
  verify_mode?: string | null;
  work_code?: string | null;
  device_event_id?: string | null;
  received_at: string;
  processed: boolean;
  processing_error?: string | null;
  idempotency_key: string;
}

export async function listBiometricMappings(): Promise<BiometricMapping[]> {
  const { data, error } = await getSupabase()
    .from('v13_biometric_employee_mappings')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as BiometricMapping[];
}

export async function listBiometricEvents(limit = 200): Promise<BiometricEvent[]> {
  const { data, error } = await getSupabase()
    .from('v13_biometric_events')
    .select('*')
    .order('event_time', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as BiometricEvent[];
}

export async function mapBiometricEmployee(input: {
  deviceId: string;
  deviceUserCode: string;
  employeeId: string;
}): Promise<BiometricMapping> {
  const { data, error } = await getSupabase()
    .from('v13_biometric_employee_mappings')
    .upsert({
      device_id: input.deviceId,
      device_user_code: input.deviceUserCode.trim(),
      employee_id: input.employeeId,
      active: true,
    }, { onConflict: 'device_id,device_user_code' })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Employee mapping could not be saved.');
  return data as BiometricMapping;
}
