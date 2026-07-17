#!/usr/bin/env bash
set -euo pipefail

SRC_DIR="${1:-build/mobile}"
export SRC_DIR
python3 - <<'PY'
from pathlib import Path
import json, os
src = Path(os.environ['SRC_DIR'])

p = src / 'app.json'
data = json.loads(p.read_text())
data['expo']['version'] = '3.1.2'
data['expo']['android']['versionCode'] = 3102
p.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')

p = src / 'package.json'
data = json.loads(p.read_text())
data['name'] = 'colorjet-management-suite-v312'
data['version'] = '3.1.2'
p.write_text(json.dumps(data, indent=2) + '\n')

p = src / 'src/services/runtimeConfig.ts'
t = p.read_text()
t = t.replace(
    "const ENV_BASE = (process.env.EXPO_PUBLIC_ERP_API_BASE_URL ?? '').trim();",
    "const DEFAULT_API_BASE = 'https://eng.erp.com.bd/api/v1';\nconst ENV_BASE = (process.env.EXPO_PUBLIC_ERP_API_BASE_URL ?? DEFAULT_API_BASE).trim();",
)
p.write_text(t)

p = src / 'src/services/erpApi.ts'
p.write_text(p.read_text().replace("app_version:'3.1.1'", "app_version:'3.1.2'"))

p = src / 'app/setup.tsx'
p.write_text(p.read_text().replace('https://erp.colorjetbd.com', 'https://eng.erp.com.bd'))

p = src / 'src/data/AppDataProvider.tsx'
t = p.read_text()
old = "await apiPost('attendance/punch',{action,attendance:record,idempotency_key:action==='check_in'?record.checkInIdempotencyKey:record.checkOutIdempotencyKey});"
new = "await apiPost('attendance',{action,latitude:location.latitude,longitude:location.longitude,accuracy_m:location.accuracyM??999,accuracy_threshold_m:80,is_mock_location:location.mocked?1:0,offline_source:0,device_uuid:currentUser.id,idempotency_key:action==='check_in'?record.checkInIdempotencyKey:record.checkOutIdempotencyKey});"
if old not in t:
    raise SystemExit('Attendance endpoint patch target not found')
p.write_text(t.replace(old, new))

p = src / 'app/new/[key].tsx'
t = p.read_text()
t = t.replace(
    "import { contractFor } from '@/src/services/moduleApi';",
    "import { contractFor, payloadFor } from '@/src/services/moduleApi';",
)
t = t.replace(
    "import {contractFor} from '@/src/services/moduleApi';",
    "import {contractFor,payloadFor} from '@/src/services/moduleApi';",
)
old_pretty = """    const payload: Record<string, unknown> = {};
    for (const field of moduleDefinition.fields) {
      const raw = String(values[field.key] ?? '').trim();
      if (raw) {
        payload[field.key] = ['number', 'currency'].includes(field.type) ? Number(raw) : raw;
      }
    }
"""
if old_pretty in t:
    t = t.replace(old_pretty, "    const payload = payloadFor(moduleDefinition.key, values);\n")
else:
    old_min = "const payload:Record<string,unknown>={};for(const f of moduleDefinition.fields){const raw=String(values[f.key]??'').trim();if(raw)payload[f.key]=['number','currency'].includes(f.type)?Number(raw):raw}"
    if old_min not in t:
        raise SystemExit('NewRecord payload patch target not found')
    t = t.replace(old_min, "const payload=payloadFor(moduleDefinition.key,values);")
p.write_text(t)
PY

cat > "$SRC_DIR/src/services/moduleApi.ts" <<'EOF_MODULE'
import { MODULE_MAP } from '@/src/core/moduleRegistry';

export type ModuleApiContract = { list: string; create?: string };

const custom: Record<string, ModuleApiContract> = {
  'attendance-location': { list: 'attendance', create: 'attendance' },
  'office-tasks': { list: 'tasks', create: 'tasks' },
  'reports': { list: 'reports' },
  'notifications': { list: 'notifications' },
  'customers': { list: 'customers', create: 'customers' },
  'invoices': { list: 'invoices' },
  'payments': { list: 'collections/followups' },
  'products': { list: 'products', create: 'products' },
  'stock-movements': { list: 'stock/movements' },
  'spare-parts': { list: 'operations/parts-requests' },
  'warehouse-receiving': { list: 'purchases' },
  'receiving-discrepancy': { list: 'inventory/counts' },
  'service-tickets': { list: 'service-tickets' },
  'engineer-schedule': { list: 'engineer-schedules' },
  'delivery': { list: 'operations/visits' },
  'warranty-register': { list: 'supplier-claims' },
  'expenses': { list: 'expenses' },
  'agreements-emi': { list: 'agreements' },
  'cash-bank': { list: 'cash-bank/accounts' },
  'daily-ledger': { list: 'reports/daily-ledger' },
  'customer-ledger': { list: 'collections/followups' },
  'import-control-center': { list: 'commercial-import/summary' },
  'suppliers': { list: 'supplier-payables/summary' },
  'supplier-ledger': { list: 'import-logistics/supplier-ledger' },
  'foreign-purchase': { list: 'purchases' },
  'lc-tt': { list: 'commercial-import/summary' },
  'shipment': { list: 'import-logistics/shipments' },
  'landed-cost': { list: 'commercial-import/summary' },
  'supplier-claims': { list: 'supplier-claims' },
  'import-approvals': { list: 'ai/actions' },
  'import-reports': { list: 'reports' },
  'employee-directory': { list: 'employee-cards' },
  'employee-verification': { list: 'qr-codes' },
  'employee-id-cards': { list: 'employee-cards' },
  'leave-payroll': { list: 'leave' },
  'documents-audit': { list: 'data-quality' },
  'users': { list: 'access-control/summary' },
  'company-settings': { list: 'app-config' },
};

export function contractFor(key: string): ModuleApiContract {
  if (custom[key]) return custom[key];
  const module = MODULE_MAP[key];
  if (!module) return { list: key };
  const endpoint = module.apiEndpoint.replace(/^\/api\//, '').replace(/^\/+/, '');
  return { list: endpoint };
}

export function payloadFor(key: string, values: Record<string, string>): Record<string, unknown> {
  const text = (name: string) => String(values[name] ?? '').trim();
  const number = (name: string) => {
    const raw = text(name);
    return raw === '' ? 0 : Number(raw);
  };
  if (key === 'customers') {
    return {
      name: text('contactPerson') || text('companyName'),
      phone: text('phone'),
      email: text('email'),
      address: text('billingAddress'),
      city: text('district'),
      company_name: text('companyName'),
      customer_type: text('customerType') || 'retail',
      credit_limit: number('creditLimit'),
      notes: text('notes'),
    };
  }
  if (key === 'office-tasks') {
    return {
      title: text('title'),
      department: text('department'),
      assigned_to: text('assignedEmployee'),
      priority: text('priority') || 'normal',
      due_date: text('dueDate'),
      due_time: text('dueTime'),
      notes: [text('description'), text('notes')].filter(Boolean).join('\n\n'),
    };
  }
  if (key === 'products') {
    return {
      name: text('productName'),
      sku: text('sku'),
      brand: text('brand'),
      model: text('model'),
      unit: text('unit') || 'pcs',
      purchase_price: number('purchasePrice'),
      selling_price: number('sellingPrice'),
      opening_stock: number('openingStock'),
      min_stock: number('minimumStockLevel'),
      description: text('notes'),
    };
  }
  return Object.fromEntries(
    Object.entries(values).map(([field, value]) => [field.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`), value]),
  );
}
EOF_MODULE

cat > "$SRC_DIR/src/attendance/attendanceSync.ts" <<'EOF_ATTENDANCE'
import { apiPost } from '@/src/services/erpApi';
import type { AttendanceAction, AttendanceRecord } from '@/src/types/domain';

export async function syncAttendancePunch(record: AttendanceRecord, action: AttendanceAction) {
  const key = action === 'check_in' ? record.checkInIdempotencyKey : record.checkOutIdempotencyKey;
  const location = action === 'check_in' ? record.checkInLocation : record.checkOutLocation;
  if (!key || !location) return false;
  await apiPost('attendance', {
    action,
    latitude: location.latitude,
    longitude: location.longitude,
    accuracy_m: location.accuracyM ?? 999,
    accuracy_threshold_m: 80,
    is_mock_location: location.mocked ? 1 : 0,
    offline_source: 1,
    device_uuid: record.employeeId,
    idempotency_key: key,
  });
  return true;
}
EOF_ATTENDANCE

cat > "$SRC_DIR/.env.example" <<'EOF_ENV'
# Public HTTPS API base. No database or cPanel password belongs here.
EXPO_PUBLIC_ERP_API_BASE_URL=https://eng.erp.com.bd/api/v1
EOF_ENV

cat > "$SRC_DIR/BUILD_INFO.md" <<'EOF_INFO'
# COLORJET Management Suite V3.1.2

- Package: `com.colorjetbd.managementsuite`
- Version code: `3102`
- Default API base: `https://eng.erp.com.bd/api/v1`
- Base: verified V3.1.1 Expo SDK 54 native source
- Original COLORJET icon/splash and approved UI preserved
- Login, refresh, logout, health and attendance mapped to the V17.2 cPanel API
- All 38 module list contracts mapped to existing V17.2 GET routes
- Unsafe/unimplemented write actions remain read-only rather than returning 404
- No WebView, database password, API secret or demo credential embedded
EOF_INFO

cat >> "$SRC_DIR/CHANGELOG.md" <<'EOF_CHANGELOG'

## 3.1.2 — eng.erp.com.bd API Integration
- Set the default secure API base to `https://eng.erp.com.bd/api/v1`.
- Bumped Android versionCode to 3102 without changing package identity.
- Corrected attendance API route and payload for the V17.2 backend.
- Replaced invalid module routes with existing backend routes.
- Disabled Add actions where the backend has no compatible POST contract.
- Preserved the approved native UI and original COLORJET assets.
EOF_CHANGELOG

node - <<'NODE'
const fs = require('fs');
const app = JSON.parse(fs.readFileSync(`${process.env.SRC_DIR}/app.json`, 'utf8')).expo;
if (app.android.package !== 'com.colorjetbd.managementsuite') throw new Error('Package changed');
if (app.version !== '3.1.2' || app.android.versionCode !== 3102) throw new Error('Version patch failed');
const runtime = fs.readFileSync(`${process.env.SRC_DIR}/src/services/runtimeConfig.ts`, 'utf8');
if (!runtime.includes('https://eng.erp.com.bd/api/v1')) throw new Error('API base missing');
const moduleApi = fs.readFileSync(`${process.env.SRC_DIR}/src/services/moduleApi.ts`, 'utf8');
const routeCount = (moduleApi.match(/'[^']+': \{ list:/g) || []).length;
if (routeCount !== 38) throw new Error(`Expected 38 module contracts, got ${routeCount}`);
console.log(JSON.stringify({ package: app.android.package, version: app.version, versionCode: app.android.versionCode, apiBase: 'https://eng.erp.com.bd/api/v1', moduleContracts: routeCount }, null, 2));
NODE
