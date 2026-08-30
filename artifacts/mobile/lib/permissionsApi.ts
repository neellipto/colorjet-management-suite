import { erpApi } from '@/lib/erpApi';
import type {
  EffectivePermissionPayload,
  PermissionAction,
  PermissionEffect,
  PermissionScope,
} from '@/lib/effectivePermissions';

export type PermissionOverrideInput = {
  userId: string;
  resource: string;
  action: PermissionAction;
  effect: PermissionEffect;
  scope?: PermissionScope;
  effectiveFrom?: string | null;
  expiresAt?: string | null;
  reason: string;
};

export type PermissionAuditRecord = {
  id: string;
  userId: string;
  changedBy: string;
  resource: string;
  action: PermissionAction;
  effect: PermissionEffect;
  beforeState?: unknown;
  afterState?: unknown;
  reason: string;
  createdAt: string;
  deviceId?: string | null;
  sessionId?: string | null;
};

export async function fetchEffectivePermissions(): Promise<EffectivePermissionPayload> {
  return erpApi.get<EffectivePermissionPayload>('/me/permissions');
}

export async function fetchUserEffectivePermissions(userId: string): Promise<EffectivePermissionPayload> {
  return erpApi.get<EffectivePermissionPayload>(`/users/${encodeURIComponent(userId)}/effective-permissions`);
}

export async function createPermissionOverride(input: PermissionOverrideInput): Promise<PermissionAuditRecord> {
  return erpApi.post<PermissionAuditRecord>('/permission-overrides', {
    user_id: input.userId,
    resource: input.resource,
    action: input.action,
    effect: input.effect,
    scope: input.scope,
    effective_from: input.effectiveFrom,
    expires_at: input.expiresAt,
    reason: input.reason,
  }, {
    idempotencyKey: [
      'permission-override',
      input.userId,
      input.resource,
      input.action,
      input.effect,
      input.effectiveFrom ?? 'now',
    ].join(':'),
  });
}

export async function revokePermissionOverride(overrideId: string, reason: string): Promise<PermissionAuditRecord> {
  return erpApi.post<PermissionAuditRecord>(
    `/permission-overrides/${encodeURIComponent(overrideId)}/revoke`,
    { reason },
    { idempotencyKey: `permission-revoke:${overrideId}` },
  );
}

export async function restoreRoleDefaults(userId: string, reason: string): Promise<PermissionAuditRecord[]> {
  return erpApi.post<PermissionAuditRecord[]>(
    `/users/${encodeURIComponent(userId)}/permissions/restore-role-defaults`,
    { reason },
    { idempotencyKey: `permission-defaults:${userId}:${Date.now()}` },
  );
}

export async function fetchPermissionAudit(userId: string, limit = 100): Promise<PermissionAuditRecord[]> {
  const boundedLimit = Math.max(1, Math.min(500, Math.trunc(limit)));
  return erpApi.get<PermissionAuditRecord[]>(
    `/users/${encodeURIComponent(userId)}/permission-audit?limit=${boundedLimit}`,
  );
}
