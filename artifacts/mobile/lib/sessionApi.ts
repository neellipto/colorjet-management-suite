import { clearErpSession, erpApi, saveErpSession, type ErpSession } from '@/lib/erpApi';

export type LoginIdentifierType = 'email' | 'phone' | 'employee_code';

export type ErpUserIdentity = {
  id: string;
  displayName: string;
  email?: string | null;
  phone?: string | null;
  employeeCode?: string | null;
  roleCodes: string[];
  branchIds?: string[];
  departmentIds?: string[];
  warehouseIds?: string[];
  active: boolean;
  forcePasswordChange?: boolean;
};

export type LoginRequest = {
  identifier: string;
  password: string;
  identifierType?: LoginIdentifierType;
  deviceId?: string;
  deviceName?: string;
  appVersion?: string;
};

export type LoginResult = {
  session: ErpSession;
  user: ErpUserIdentity;
  permissionVersion?: string;
};

export type CurrentSessionResult = {
  user: ErpUserIdentity;
  permissionVersion?: string;
  serverTime?: string;
};

function normalizeSession(value: unknown): ErpSession {
  if (!value || typeof value !== 'object') throw new Error('ERP login did not return a session.');
  const record = value as Record<string, unknown>;
  const accessToken = String(record.accessToken ?? record.access_token ?? '');
  const refreshTokenValue = record.refreshToken ?? record.refresh_token;
  if (!accessToken) throw new Error('ERP login did not return an access token.');
  return {
    accessToken,
    refreshToken: refreshTokenValue ? String(refreshTokenValue) : null,
  };
}

export async function loginToErp(request: LoginRequest): Promise<LoginResult> {
  const result = await erpApi.post<{
    session?: unknown;
    access_token?: string;
    refresh_token?: string | null;
    user: ErpUserIdentity;
    permissionVersion?: string;
    permission_version?: string;
  }>('/auth/login', {
    identifier: request.identifier.trim(),
    password: request.password,
    identifier_type: request.identifierType,
    device_id: request.deviceId,
    device_name: request.deviceName,
    app_version: request.appVersion,
  }, { skipAuthentication: true, retryAfterRefresh: false });

  const session = result.session
    ? normalizeSession(result.session)
    : normalizeSession({ access_token: result.access_token, refresh_token: result.refresh_token });

  await saveErpSession(session);
  return {
    session,
    user: result.user,
    permissionVersion: result.permissionVersion ?? result.permission_version,
  };
}

export async function fetchCurrentErpSession(): Promise<CurrentSessionResult> {
  return erpApi.get<CurrentSessionResult>('/auth/me');
}

export async function logoutFromErp(deviceId?: string): Promise<void> {
  try {
    await erpApi.post<void>('/auth/logout', { device_id: deviceId });
  } finally {
    await clearErpSession();
  }
}

export async function requestErpPasswordReset(identifier: string): Promise<void> {
  await erpApi.post<void>('/auth/forgot-password', { identifier: identifier.trim() }, {
    skipAuthentication: true,
    retryAfterRefresh: false,
  });
}

export async function changeErpPassword(currentPassword: string, newPassword: string): Promise<void> {
  await erpApi.post<void>('/auth/change-password', {
    current_password: currentPassword,
    new_password: newPassword,
  });
}

export async function registerDevice(input: {
  deviceId: string;
  deviceName?: string;
  platform: 'android';
  appVersion: string;
  fcmToken?: string | null;
}): Promise<void> {
  await erpApi.post<void>('/devices/register', {
    device_id: input.deviceId,
    device_name: input.deviceName,
    platform: input.platform,
    app_version: input.appVersion,
    fcm_token: input.fcmToken,
  }, { idempotencyKey: `device-register:${input.deviceId}:${input.appVersion}` });
}
