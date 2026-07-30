export type UserRole =
  | 'OWNER'
  | 'ADMIN'
  | 'MANAGER'
  | 'OFFICE_STAFF'
  | 'ACCOUNTS'
  | 'SALES'
  | 'ENGINEER'
  | 'SERVICE_MANAGER'
  | 'STORE';

export type DashboardKpi = {
  key: string;
  label: string;
  value: string | number;
  note?: string;
  status?: 'normal' | 'success' | 'warning' | 'danger';
};

export type ApiResponse<T> = {
  ok: boolean;
  data?: T;
  error?: string;
};
