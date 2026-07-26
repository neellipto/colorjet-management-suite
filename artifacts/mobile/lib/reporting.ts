import { erpApi, ERP_API_BASE_URL } from '@/lib/erpApi';

export type ReportPeriodPreset =
  | 'today'
  | 'yesterday'
  | 'this_week'
  | 'last_week'
  | 'this_month'
  | 'last_month'
  | 'quarter'
  | 'year'
  | 'financial_year'
  | 'as_of'
  | 'custom';

export type ReportFilters = {
  periodPreset?: ReportPeriodPreset;
  from?: string;
  to?: string;
  asOf?: string;
  branchIds?: string[];
  warehouseIds?: string[];
  departmentIds?: string[];
  customerIds?: string[];
  supplierIds?: string[];
  employeeIds?: string[];
  engineerIds?: string[];
  salespersonIds?: string[];
  productIds?: string[];
  categoryIds?: string[];
  groupIds?: string[];
  partIds?: string[];
  brandIds?: string[];
  statuses?: string[];
  paymentModes?: string[];
  warrantyStates?: string[];
  currency?: string;
  search?: string;
};

export type ReportColumn = {
  key: string;
  label: string;
  labelBn?: string | null;
  dataType: 'text' | 'date' | 'datetime' | 'number' | 'currency' | 'quantity' | 'status';
  visible: boolean;
  permission?: string | null;
};

export type ReportDefinition = {
  code: string;
  name: string;
  nameBn?: string | null;
  module: string;
  columns: ReportColumn[];
  availableFilters: string[];
  exportFormats: Array<'pdf' | 'csv' | 'xlsx'>;
  printTemplateCode?: string | null;
};

export type ReportSummary = {
  openingBalance?: number | null;
  debitTotal?: number | null;
  creditTotal?: number | null;
  closingBalance?: number | null;
  quantityTotal?: number | null;
  valueTotal?: number | null;
  subtotalGroups?: Array<{ key: string; label: string; amount?: number; quantity?: number }>;
  categorySubtotals?: Array<{ key: string; label: string; amount?: number; quantity?: number }>;
};

export type ReportResult<Row = Record<string, unknown>> = {
  runId: string;
  definition: ReportDefinition;
  filters: ReportFilters;
  rows: Row[];
  summary: ReportSummary;
  generatedAt: string;
  generatedBy: string;
  dataFreshness?: string | null;
  nextPage?: number | null;
};

export type DocumentArtifact = {
  id: string;
  fileName: string;
  mimeType: string;
  downloadUrl: string;
  expiresAt?: string | null;
  sha256?: string | null;
};

function filterPayload(filters: ReportFilters): Record<string, unknown> {
  return {
    period_preset: filters.periodPreset,
    from: filters.from,
    to: filters.to,
    as_of: filters.asOf,
    branch_ids: filters.branchIds,
    warehouse_ids: filters.warehouseIds,
    department_ids: filters.departmentIds,
    customer_ids: filters.customerIds,
    supplier_ids: filters.supplierIds,
    employee_ids: filters.employeeIds,
    engineer_ids: filters.engineerIds,
    salesperson_ids: filters.salespersonIds,
    product_ids: filters.productIds,
    category_ids: filters.categoryIds,
    group_ids: filters.groupIds,
    part_ids: filters.partIds,
    brand_ids: filters.brandIds,
    statuses: filters.statuses,
    payment_modes: filters.paymentModes,
    warranty_states: filters.warrantyStates,
    currency: filters.currency,
    search: filters.search,
  };
}

export async function listReportDefinitions(): Promise<ReportDefinition[]> {
  return erpApi.get<ReportDefinition[]>('/reports/definitions');
}

export async function runReport<Row = Record<string, unknown>>(
  reportCode: string,
  filters: ReportFilters,
  page = 1,
): Promise<ReportResult<Row>> {
  return erpApi.post<ReportResult<Row>>(`/reports/${encodeURIComponent(reportCode)}/run`, {
    filters: filterPayload(filters),
    page: Math.max(1, Math.trunc(page)),
  }, { idempotencyKey: `report:${reportCode}:${Date.now()}:${Math.random().toString(16).slice(2)}` });
}

export async function exportReport(
  runId: string,
  format: 'pdf' | 'csv' | 'xlsx',
  options: {
    letterheadTemplateId?: string | null;
    titleOverride?: string | null;
    language?: 'en' | 'bn' | 'bilingual';
  } = {},
): Promise<DocumentArtifact> {
  return erpApi.post<DocumentArtifact>(`/report-runs/${encodeURIComponent(runId)}/export`, {
    format,
    letterhead_template_id: options.letterheadTemplateId,
    title_override: options.titleOverride,
    language: options.language ?? 'bilingual',
  }, { idempotencyKey: `report-export:${runId}:${format}:${options.letterheadTemplateId ?? 'default'}` });
}

export async function generateRecordDocument(input: {
  entity: string;
  entityId: string;
  format: 'pdf' | 'csv' | 'xlsx';
  templateCode?: string | null;
  titleOverride?: string | null;
  language?: 'en' | 'bn' | 'bilingual';
}): Promise<DocumentArtifact> {
  return erpApi.post<DocumentArtifact>('/documents/generate', {
    entity: input.entity,
    entity_id: input.entityId,
    format: input.format,
    template_code: input.templateCode,
    title_override: input.titleOverride,
    language: input.language ?? 'bilingual',
  }, { idempotencyKey: `document:${input.entity}:${input.entityId}:${input.format}:${input.templateCode ?? 'default'}` });
}

export async function shareDocument(input: {
  artifactId: string;
  channel: 'email' | 'whatsapp' | 'internal';
  recipients: string[];
  message?: string | null;
}): Promise<{ queued: boolean; reference: string }> {
  return erpApi.post<{ queued: boolean; reference: string }>('/documents/share', {
    artifact_id: input.artifactId,
    channel: input.channel,
    recipients: input.recipients,
    message: input.message,
  }, { idempotencyKey: `document-share:${input.artifactId}:${input.channel}:${input.recipients.join(',')}` });
}

export function trustedDocumentUrl(url: string): boolean {
  try {
    const value = new URL(url);
    const api = new URL(ERP_API_BASE_URL);
    return value.protocol === 'https:' && value.hostname === api.hostname;
  } catch {
    return false;
  }
}
