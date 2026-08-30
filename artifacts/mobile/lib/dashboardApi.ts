import { erpApi } from '@/lib/erpApi';

export type DashboardPeriodPreset =
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

export type DashboardFilters = {
  periodPreset?: DashboardPeriodPreset;
  from?: string;
  to?: string;
  asOf?: string;
  branchId?: string;
  warehouseId?: string;
  departmentId?: string;
  employeeId?: string;
  salespersonId?: string;
  engineerId?: string;
  customerId?: string;
  supplierId?: string;
  productId?: string;
  categoryId?: string;
  currency?: string;
  status?: string;
};

export type KpiValue = {
  code: string;
  label: string;
  value: number | string | null;
  formattedValue?: string | null;
  previousValue?: number | string | null;
  changePercent?: number | null;
  trend?: 'up' | 'down' | 'flat' | 'unknown';
  source: string;
  dataFreshness?: string | null;
  drillDown?: { route: string; filters?: Record<string, unknown> } | null;
  permissionResult: 'allowed' | 'redacted' | 'denied';
};

export type DashboardWidget = {
  id: string;
  type:
    | 'kpi'
    | 'counter'
    | 'trend'
    | 'chart'
    | 'table'
    | 'list'
    | 'calendar'
    | 'map'
    | 'timeline'
    | 'approval_list'
    | 'risk_alert'
    | 'task_list'
    | 'activity_feed'
    | 'notification_list'
    | 'quick_action'
    | 'ai_insight'
    | 'report_shortcut'
    | 'custom_module'
    | 'integration_status';
  code: string;
  title: string;
  titleBn?: string | null;
  position: number;
  optional: boolean;
  permission?: string | null;
  data?: unknown;
  error?: string | null;
  dataFreshness?: string | null;
};

export type DashboardPayload = {
  dashboardId: string;
  dashboardVersion: number;
  resolvedFrom: 'user' | 'position' | 'role' | 'department' | 'branch' | 'system';
  roleCodes: string[];
  title: string;
  filters: DashboardFilters;
  kpis: KpiValue[];
  widgets: DashboardWidget[];
  generatedAt: string;
  dataFreshness?: string | null;
  offlineLastKnown?: boolean;
};

export type DailyExecutiveBrief = {
  date: string;
  language: 'en' | 'bn' | 'bilingual';
  kpis: KpiValue[];
  risks: Array<{ severity: 'info' | 'warning' | 'high' | 'critical'; title: string; detail: string; source?: string }>;
  recommendedActions: Array<{ title: string; detail: string; route?: string; permission?: string }>;
  generatedAt: string;
  dataFreshness?: string | null;
};

function queryString(filters: DashboardFilters): string {
  const search = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  });
  const query = search.toString();
  return query ? `?${query}` : '';
}

export async function fetchMyDashboard(filters: DashboardFilters = {}): Promise<DashboardPayload> {
  return erpApi.get<DashboardPayload>(`/me/dashboard${queryString(filters)}`);
}

export async function fetchOwnerCommandCenter(filters: DashboardFilters = {}): Promise<DashboardPayload> {
  return erpApi.get<DashboardPayload>(`/owner/command-center${queryString(filters)}`);
}

export async function fetchDailyExecutiveBrief(input: {
  date?: string;
  language?: 'en' | 'bn' | 'bilingual';
  branchId?: string;
} = {}): Promise<DailyExecutiveBrief> {
  const search = new URLSearchParams();
  if (input.date) search.set('date', input.date);
  if (input.language) search.set('language', input.language);
  if (input.branchId) search.set('branch_id', input.branchId);
  const suffix = search.toString() ? `?${search.toString()}` : '';
  return erpApi.get<DailyExecutiveBrief>(`/owner/executive-brief${suffix}`);
}

export async function saveDashboardPreferences(input: {
  dashboardId: string;
  hiddenWidgetIds: string[];
  widgetOrder: string[];
  defaultFilters?: DashboardFilters;
}): Promise<DashboardPayload> {
  return erpApi.put<DashboardPayload>('/me/dashboard/preferences', {
    dashboard_id: input.dashboardId,
    hidden_widget_ids: input.hiddenWidgetIds,
    widget_order: input.widgetOrder,
    default_filters: input.defaultFilters,
  });
}

export async function refreshDashboardWidget(
  dashboardId: string,
  widgetId: string,
  filters: DashboardFilters = {},
): Promise<DashboardWidget> {
  return erpApi.post<DashboardWidget>(
    `/dashboards/${encodeURIComponent(dashboardId)}/widgets/${encodeURIComponent(widgetId)}/refresh`,
    { filters },
  );
}
