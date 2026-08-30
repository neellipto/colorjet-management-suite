import { erpApi } from '@/lib/erpApi';

export type AiRequestMode = 'analysis' | 'report' | 'draft_action' | 'knowledge';

export type AiSourceReference = {
  sourceType: string;
  sourceId?: string | null;
  title: string;
  freshness?: string | null;
  permissionResult: 'allowed' | 'redacted' | 'denied';
};

export type AiDraftAction = {
  id: string;
  actionType: string;
  entity: string;
  entityId?: string | null;
  title: string;
  summary: string;
  payload: Record<string, unknown>;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  requiresOwnerConfirmation: boolean;
  confirmationText?: string | null;
  validationWarnings?: string[];
};

export type AiResponse = {
  requestId: string;
  answer: string;
  language: 'en' | 'bn' | 'bilingual';
  sources: AiSourceReference[];
  draftActions: AiDraftAction[];
  generatedAt: string;
  permissionVersion: string;
  dataFreshness?: string | null;
};

export type AiActionPreview = {
  approvalId: string;
  action: AiDraftAction;
  beforeState?: unknown;
  afterState?: unknown;
  accountingImpact?: Record<string, unknown>;
  stockImpact?: Record<string, unknown>;
  reconciliationChecks?: Array<{ code: string; passed: boolean; message: string }>;
  warnings: string[];
  confirmationRequired: boolean;
  expiresAt: string;
};

export type AiActionExecution = {
  executionId: string;
  approvalId: string;
  status: 'executed' | 'rejected' | 'failed';
  entity?: string | null;
  entityId?: string | null;
  auditReference: string;
  executedAt?: string | null;
  error?: string | null;
};

export async function askOwnerAi(input: {
  prompt: string;
  mode?: AiRequestMode;
  language?: 'en' | 'bn' | 'bilingual';
  filters?: Record<string, unknown>;
  conversationId?: string | null;
}): Promise<AiResponse> {
  return erpApi.post<AiResponse>('/owner/ai/requests', {
    prompt: input.prompt,
    mode: input.mode ?? 'analysis',
    language: input.language ?? 'bilingual',
    filters: input.filters ?? {},
    conversation_id: input.conversationId,
  }, { idempotencyKey: `owner-ai:${Date.now()}:${Math.random().toString(16).slice(2)}` });
}

export async function askLimitedAi(input: {
  prompt: string;
  module?: string | null;
  recordIds?: string[];
  language?: 'en' | 'bn' | 'bilingual';
}): Promise<AiResponse> {
  return erpApi.post<AiResponse>('/ai/requests', {
    prompt: input.prompt,
    module: input.module,
    record_ids: input.recordIds ?? [],
    language: input.language ?? 'bilingual',
  }, { idempotencyKey: `limited-ai:${Date.now()}:${Math.random().toString(16).slice(2)}` });
}

export async function previewAiAction(draftActionId: string): Promise<AiActionPreview> {
  return erpApi.post<AiActionPreview>(
    `/ai/draft-actions/${encodeURIComponent(draftActionId)}/preview`,
    {},
    { idempotencyKey: `ai-preview:${draftActionId}` },
  );
}

export async function updateAiDraftAction(
  draftActionId: string,
  payload: Record<string, unknown>,
): Promise<AiActionPreview> {
  return erpApi.patch<AiActionPreview>(
    `/ai/draft-actions/${encodeURIComponent(draftActionId)}`,
    { payload },
  );
}

export async function confirmAiAction(input: {
  approvalId: string;
  confirmationText: string;
  ownerNote?: string | null;
}): Promise<AiActionExecution> {
  return erpApi.post<AiActionExecution>(
    `/ai/action-approvals/${encodeURIComponent(input.approvalId)}/execute`,
    {
      confirmation_text: input.confirmationText,
      owner_note: input.ownerNote,
    },
    { idempotencyKey: `ai-execute:${input.approvalId}` },
  );
}

export async function rejectAiAction(approvalId: string, reason: string): Promise<AiActionExecution> {
  return erpApi.post<AiActionExecution>(
    `/ai/action-approvals/${encodeURIComponent(approvalId)}/reject`,
    { reason },
    { idempotencyKey: `ai-reject:${approvalId}` },
  );
}

export async function fetchAiAudit(limit = 100): Promise<AiActionExecution[]> {
  const safeLimit = Math.max(1, Math.min(500, Math.trunc(limit)));
  return erpApi.get<AiActionExecution[]>(`/owner/ai/audit?limit=${safeLimit}`);
}
