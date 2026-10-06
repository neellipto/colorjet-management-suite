import { erpApi } from '@/lib/erpApi';

export type AccountingPeriodState = 'open' | 'soft_closed' | 'hard_closed';

export type AccountingPeriod = {
  id: string;
  code: string;
  name: string;
  startDate: string;
  endDate: string;
  state: AccountingPeriodState;
  closedBy?: string | null;
  closedAt?: string | null;
  reopenedBy?: string | null;
  reopenedAt?: string | null;
};

export type TransactionDateDecision = {
  allowed: boolean;
  requiresOwnerOverride: boolean;
  reasonCode?:
    | 'CURRENT_DATE_ALLOWED'
    | 'BACKDATED_BLOCKED'
    | 'FUTURE_DATED_BLOCKED'
    | 'SOFT_CLOSED_PERIOD'
    | 'HARD_CLOSED_PERIOD'
    | 'INVALID_DATE';
  message?: string;
  period?: AccountingPeriod | null;
};

function isoDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function classifyTransactionDate(
  transactionDate: string,
  options: {
    today?: Date;
    period?: AccountingPeriod | null;
    isOwner?: boolean;
    canOverrideDate?: boolean;
  } = {},
): TransactionDateDecision {
  const today = isoDate(options.today ?? new Date());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(transactionDate)) {
    return { allowed: false, requiresOwnerOverride: false, reasonCode: 'INVALID_DATE', message: 'Invalid transaction date.' };
  }

  const privileged = Boolean(options.isOwner && options.canOverrideDate);
  const period = options.period ?? null;

  if (period?.state === 'hard_closed') {
    return {
      allowed: false,
      requiresOwnerOverride: privileged,
      reasonCode: 'HARD_CLOSED_PERIOD',
      message: 'The accounting period is hard closed.',
      period,
    };
  }

  if (period?.state === 'soft_closed') {
    return {
      allowed: false,
      requiresOwnerOverride: privileged,
      reasonCode: 'SOFT_CLOSED_PERIOD',
      message: 'The accounting period is soft closed.',
      period,
    };
  }

  if (transactionDate < today) {
    return {
      allowed: privileged,
      requiresOwnerOverride: privileged,
      reasonCode: 'BACKDATED_BLOCKED',
      message: privileged
        ? 'Backdated entry requires Owner confirmation and audit reason.'
        : 'Backdated entries are not permitted.',
      period,
    };
  }

  if (transactionDate > today) {
    return {
      allowed: privileged,
      requiresOwnerOverride: privileged,
      reasonCode: 'FUTURE_DATED_BLOCKED',
      message: privileged
        ? 'Future-dated entry requires Owner confirmation and audit reason.'
        : 'Future-dated entries are not permitted.',
      period,
    };
  }

  return {
    allowed: true,
    requiresOwnerOverride: false,
    reasonCode: 'CURRENT_DATE_ALLOWED',
    period,
  };
}

export type DateOverridePreview = {
  overrideToken: string;
  warnings: string[];
  recalculationPreview?: Record<string, unknown>;
  reconciliationChecks?: Array<{ code: string; passed: boolean; message: string }>;
  expiresAt: string;
};

export async function previewTransactionDateOverride(input: {
  entity: string;
  entityId?: string | null;
  requestedDate: string;
  reason: string;
  beforeState?: unknown;
  proposedState?: unknown;
}): Promise<DateOverridePreview> {
  return erpApi.post<DateOverridePreview>('/date-overrides/preview', {
    entity: input.entity,
    entity_id: input.entityId,
    requested_date: input.requestedDate,
    reason: input.reason,
    before_state: input.beforeState,
    proposed_state: input.proposedState,
  }, { idempotencyKey: `date-override-preview:${input.entity}:${input.entityId ?? 'new'}:${input.requestedDate}` });
}

export async function confirmTransactionDateOverride(input: {
  overrideToken: string;
  confirmationText: string;
}): Promise<{ auditReference: string; approvedDate: string }> {
  return erpApi.post<{ auditReference: string; approvedDate: string }>('/date-overrides/confirm', {
    override_token: input.overrideToken,
    confirmation_text: input.confirmationText,
  }, { idempotencyKey: `date-override-confirm:${input.overrideToken}` });
}

export type CorrectionRequest = {
  id: string;
  entity: string;
  entityId: string;
  reason: string;
  status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'reversed' | 'corrected' | 'reconciled';
  reversalReference?: string | null;
  correctedReference?: string | null;
  reconciliationReference?: string | null;
  createdAt: string;
};

export async function requestPostedRecordCorrection(input: {
  entity: string;
  entityId: string;
  reason: string;
  correctedValues: Record<string, unknown>;
}): Promise<CorrectionRequest> {
  return erpApi.post<CorrectionRequest>('/corrections', {
    entity: input.entity,
    entity_id: input.entityId,
    reason: input.reason,
    corrected_values: input.correctedValues,
  }, { idempotencyKey: `correction:${input.entity}:${input.entityId}:${Date.now()}` });
}
