# COLORJET ERP V13 — Biometric Connector Setup

## Architecture

A biometric device must not receive the Supabase service-role key and must not connect directly to PostgreSQL.

```text
Biometric Device
      ↓
Vendor SDK / Local Gateway Service
      ↓  HTTPS + x-colorjet-gateway-key
Supabase Edge Function: biometric-ingest
      ↓  service-role RPC
v13_ingest_biometric_event
      ↓
Biometric Event Audit + Employee Mapping
```

## Supported Connector Contracts

| Connector Type | Use Case |
|---|---|
| `GENERIC_WEBHOOK` | Any vendor or custom gateway that can send HTTPS JSON |
| `ZK_PUSH_GATEWAY` | ZKTeco ADMS/push data transformed by a secured gateway |
| `ZK_TCP_GATEWAY` | ZKTeco TCP/SDK polling through a local Windows/Linux gateway |
| `REST_API` | Vendor cloud REST API polling |
| `SDK_GATEWAY` | Vendor SDK integration hosted on an office PC or server |
| `CSV_IMPORT` | Controlled fallback import for offline devices |

## Required Supabase Secrets

Configure these only in Supabase Edge Function Secrets:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
BIOMETRIC_GATEWAY_KEY
```

Never store the secret values in:

- GitHub source files
- Mobile application code
- Device configuration notes
- `v13_biometric_connectors.credential_secret_name`

The database stores only a secret reference such as `BIOMETRIC_GATEWAY_KEY`.

## Gateway Request

### Endpoint

```text
POST /functions/v1/biometric-ingest
```

### Headers

```text
Content-Type: application/json
x-colorjet-gateway-key: <protected gateway key>
```

### Body

```json
{
  "connector_code": "HEAD-OFFICE-ZK",
  "device_code": "DEVICE-01",
  "events": [
    {
      "device_user_code": "1007",
      "event_time": "2026-07-12T09:02:11+06:00",
      "event_type": "check_in",
      "verify_mode": "fingerprint",
      "device_event_id": "882191",
      "raw_payload": {
        "source": "vendor-sdk"
      }
    }
  ]
}
```

The gateway may omit `idempotency_key`. The Edge Function creates a deterministic key from connector, device, employee code, event ID, time and event type.

## Setup Order

1. Deploy V13 database migrations.
2. Deploy the `biometric-ingest` Edge Function.
3. Set the three Supabase secrets.
4. Create the connector from **Biometric Connector Center**.
5. Register each device.
6. Map every device user code to the correct ERP employee.
7. Install the vendor-specific gateway on an always-on office PC or server.
8. Send a test event.
9. Verify the event under **Punch Events**.
10. Confirm unmapped events are corrected before payroll calculation.

## ZKTeco TCP Gateway Notes

For devices using TCP port `4370`:

- The gateway must be inside the same LAN or connected through a secure VPN.
- Do not expose TCP port `4370` directly to the public internet.
- Poll by the last device event ID or event time.
- Send batches of at most 1,000 events.
- Persist the last successful cursor locally.
- Retry with the same event ID/idempotency key to prevent duplicates.

## Device-Specific Completion Requirement

The ERP side is vendor-neutral and production-ready. The final local gateway adapter depends on the exact device vendor, model, firmware and communication mode. For example, a ZKTeco standalone terminal using TCP/SDK requires a different adapter from a cloud ADMS/push terminal.

Before field deployment, record:

```text
Vendor:
Model:
Firmware:
Serial Number:
Connection Mode: TCP / ADMS / Cloud API / USB Export
LAN IP:
Port:
Vendor SDK Name and Version:
```

## Security Controls

- HTTPS only between gateway and Supabase.
- Rotate `BIOMETRIC_GATEWAY_KEY` after staff or vendor access changes.
- Restrict the local gateway host with firewall rules.
- Use one connector code per office/site.
- Review unprocessed and unmapped events daily.
- Never allow the mobile APK to call the ingestion RPC with service-role credentials.
