import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

interface GatewayEvent {
  device_user_code: string;
  event_time: string;
  event_type?: 'punch' | 'check_in' | 'check_out' | 'break_start' | 'break_end' | 'unknown';
  verify_mode?: string;
  work_code?: string;
  device_event_id?: string;
  idempotency_key?: string;
  raw_payload?: Record<string, unknown>;
}

interface GatewayPayload {
  connector_code: string;
  device_code: string;
  events: GatewayEvent[];
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

function safeEqual(left: string, right: string): boolean {
  const encoder = new TextEncoder();
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  if (a.length !== b.length) return false;
  let result = 0;
  for (let index = 0; index < a.length; index += 1) {
    result |= a[index] ^ b[index];
  }
  return result === 0;
}

function makeIdempotencyKey(
  connectorCode: string,
  deviceCode: string,
  event: GatewayEvent,
): string {
  if (event.idempotency_key?.trim()) return event.idempotency_key.trim();
  return [
    connectorCode.trim().toUpperCase(),
    deviceCode.trim(),
    event.device_user_code.trim(),
    event.device_event_id?.trim() || '',
    new Date(event.event_time).toISOString(),
    event.event_type || 'punch',
  ].join(':');
}

Deno.serve(async (request: Request) => {
  if (request.method === 'GET') {
    return json({ ok: true, service: 'colorjet-biometric-ingest', version: '13.0.0' });
  }
  if (request.method !== 'POST') {
    return json({ ok: false, error: 'Method not allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const configuredGatewayKey = Deno.env.get('BIOMETRIC_GATEWAY_KEY') || '';
  const suppliedGatewayKey = request.headers.get('x-colorjet-gateway-key') || '';

  if (!supabaseUrl || !serviceRoleKey || !configuredGatewayKey) {
    return json({ ok: false, error: 'Server configuration is incomplete' }, 503);
  }
  if (!suppliedGatewayKey || !safeEqual(suppliedGatewayKey, configuredGatewayKey)) {
    return json({ ok: false, error: 'Unauthorized gateway' }, 401);
  }

  let payload: GatewayPayload;
  try {
    payload = await request.json() as GatewayPayload;
  } catch {
    return json({ ok: false, error: 'Invalid JSON body' }, 400);
  }

  const connectorCode = payload.connector_code?.trim().toUpperCase();
  const deviceCode = payload.device_code?.trim();
  const events = Array.isArray(payload.events) ? payload.events : [];

  if (!connectorCode || !deviceCode) {
    return json({ ok: false, error: 'connector_code and device_code are required' }, 400);
  }
  if (events.length === 0 || events.length > 1000) {
    return json({ ok: false, error: 'events must contain 1 to 1000 records' }, 400);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let inserted = 0;
  let failed = 0;
  const errors: Array<{ index: number; error: string }> = [];

  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    const eventTime = new Date(event.event_time);

    if (!event.device_user_code?.trim() || Number.isNaN(eventTime.getTime())) {
      failed += 1;
      errors.push({ index, error: 'Valid device_user_code and event_time are required' });
      continue;
    }

    const idempotencyKey = makeIdempotencyKey(connectorCode, deviceCode, event);
    const { error } = await supabase.rpc('v13_ingest_biometric_event', {
      p_connector_code: connectorCode,
      p_device_code: deviceCode,
      p_device_user_code: event.device_user_code.trim(),
      p_event_time: eventTime.toISOString(),
      p_event_type: event.event_type || 'punch',
      p_verify_mode: event.verify_mode?.trim() || null,
      p_work_code: event.work_code?.trim() || null,
      p_device_event_id: event.device_event_id?.trim() || null,
      p_raw_payload: event.raw_payload || event,
      p_idempotency_key: idempotencyKey,
    });

    if (error) {
      failed += 1;
      errors.push({ index, error: error.message });
    } else {
      inserted += 1;
    }
  }

  return json({
    ok: failed === 0,
    connector_code: connectorCode,
    device_code: deviceCode,
    received: events.length,
    inserted,
    failed,
    errors: errors.slice(0, 50),
  }, failed === events.length ? 422 : 200);
});
