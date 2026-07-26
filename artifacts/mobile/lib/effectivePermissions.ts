export type PermissionEffect = 'grant' | 'deny';

export type PermissionAction =
  | 'view'
  | 'create'
  | 'edit'
  | 'update'
  | 'delete'
  | 'soft_delete'
  | 'archive'
  | 'restore'
  | 'submit'
  | 'approve'
  | 'reject'
  | 'return_for_correction'
  | 'post'
  | 'reverse'
  | 'reopen'
  | 'assign'
  | 'print'
  | 'export'
  | 'download'
  | 'upload'
  | 'share'
  | 'import'
  | 'bulk_action'
  | 'configure'
  | 'view_cost'
  | 'view_profit'
  | 'view_salary'
  | 'view_gps'
  | 'view_audit'
  | 'use_ai'
  | 'approve_ai_action'
  | 'execute_ai_action';

export type PermissionScope = {
  branchIds?: string[];
  departmentIds?: string[];
  warehouseIds?: string[];
  territoryIds?: string[];
  teamIds?: string[];
  customerIds?: string[];
  supplierIds?: string[];
  engineerIds?: string[];
  ownRecordsOnly?: boolean;
  assignedRecordsOnly?: boolean;
  fieldVisibility?: Record<string, boolean>;
};

export type EffectivePermissionRule = {
  resource: string;
  action: PermissionAction;
  effect: PermissionEffect;
  source:
    | 'security_policy'
    | 'user_deny'
    | 'user_grant'
    | 'role'
    | 'position'
    | 'department'
    | 'branch'
    | 'default';
  scope?: PermissionScope;
  effectiveFrom?: string | null;
  expiresAt?: string | null;
  reason?: string | null;
};

export type EffectivePermissionPayload = {
  userId: string;
  roleCodes: string[];
  isOwner: boolean;
  permissionVersion: string;
  generatedAt: string;
  rules: EffectivePermissionRule[];
  capabilities?: string[];
};

function isRuleActive(rule: EffectivePermissionRule, now = new Date()): boolean {
  if (rule.effectiveFrom && new Date(rule.effectiveFrom) > now) return false;
  if (rule.expiresAt && new Date(rule.expiresAt) <= now) return false;
  return true;
}

/**
 * Client-side checks are presentation safeguards only. The PHP ERP API must
 * repeat every permission and scope check before returning data or mutating a record.
 */
export function can(
  payload: EffectivePermissionPayload | null | undefined,
  resource: string,
  action: PermissionAction,
): boolean {
  if (!payload) return false;
  const matches = payload.rules.filter(
    rule => rule.resource === resource && rule.action === action && isRuleActive(rule),
  );
  if (!matches.length) return false;

  const priority: EffectivePermissionRule['source'][] = [
    'security_policy',
    'user_deny',
    'user_grant',
    'role',
    'position',
    'department',
    'branch',
    'default',
  ];

  for (const source of priority) {
    const rules = matches.filter(rule => rule.source === source);
    if (!rules.length) continue;
    if (rules.some(rule => rule.effect === 'deny')) return false;
    if (rules.some(rule => rule.effect === 'grant')) return true;
  }

  return false;
}

export function scopeFor(
  payload: EffectivePermissionPayload | null | undefined,
  resource: string,
  action: PermissionAction,
): PermissionScope | null {
  if (!can(payload, resource, action) || !payload) return null;
  const activeGrants = payload.rules.filter(
    rule =>
      rule.resource === resource &&
      rule.action === action &&
      rule.effect === 'grant' &&
      isRuleActive(rule),
  );
  if (!activeGrants.length) return null;

  return activeGrants.reduce<PermissionScope>((result, rule) => {
    const scope = rule.scope ?? {};
    const unique = (left: string[] | undefined, right: string[] | undefined) =>
      Array.from(new Set([...(left ?? []), ...(right ?? [])]));
    return {
      branchIds: unique(result.branchIds, scope.branchIds),
      departmentIds: unique(result.departmentIds, scope.departmentIds),
      warehouseIds: unique(result.warehouseIds, scope.warehouseIds),
      territoryIds: unique(result.territoryIds, scope.territoryIds),
      teamIds: unique(result.teamIds, scope.teamIds),
      customerIds: unique(result.customerIds, scope.customerIds),
      supplierIds: unique(result.supplierIds, scope.supplierIds),
      engineerIds: unique(result.engineerIds, scope.engineerIds),
      ownRecordsOnly: Boolean(result.ownRecordsOnly || scope.ownRecordsOnly),
      assignedRecordsOnly: Boolean(result.assignedRecordsOnly || scope.assignedRecordsOnly),
      fieldVisibility: { ...(result.fieldVisibility ?? {}), ...(scope.fieldVisibility ?? {}) },
    };
  }, {});
}

export function canSeeField(
  payload: EffectivePermissionPayload | null | undefined,
  resource: string,
  action: PermissionAction,
  field: string,
): boolean {
  const scope = scopeFor(payload, resource, action);
  if (!scope) return false;
  if (!scope.fieldVisibility || !(field in scope.fieldVisibility)) return true;
  return scope.fieldVisibility[field] !== false;
}
