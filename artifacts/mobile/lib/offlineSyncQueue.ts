import AsyncStorage from '@react-native-async-storage/async-storage';

const QUEUE_KEY = '@colorjet/offline-sync-queue-v1';
const DEAD_LETTER_KEY = '@colorjet/offline-sync-dead-letter-v1';

export type OfflineSyncState =
  | 'pending'
  | 'uploading'
  | 'synced'
  | 'failed'
  | 'conflict'
  | 'blocked'
  | 'cancelled';

export type OfflineSyncOperationType = 'create' | 'update' | 'delete' | 'submit' | 'upload';

export type OfflineSyncOperation = {
  clientUuid: string;
  idempotencyKey: string;
  entity: string;
  entityId?: string | null;
  operation: OfflineSyncOperationType;
  payload: unknown;
  localTimestamp: string;
  baseServerVersion?: string | number | null;
  priority: number;
  dependencyKeys: string[];
  retryCount: number;
  maxRetries: number;
  syncState: OfflineSyncState;
  lastError?: string | null;
  nextAttemptAt?: string | null;
  serverAcknowledgement?: unknown;
};

export type OfflineSyncProcessorResult = {
  serverAcknowledgement?: unknown;
  serverVersion?: string | number | null;
};

export type OfflineSyncProcessor = (
  operation: OfflineSyncOperation,
) => Promise<OfflineSyncProcessorResult>;

let queueLock: Promise<void> = Promise.resolve();

function serialized<T>(work: () => Promise<T>): Promise<T> {
  const next = queueLock.then(work, work);
  queueLock = next.then(() => undefined, () => undefined);
  return next;
}

function newClientUuid(): string {
  return `cj-${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`;
}

async function readList(key: string): Promise<OfflineSyncOperation[]> {
  const value = await AsyncStorage.getItem(key);
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? (parsed as OfflineSyncOperation[]) : [];
  } catch {
    return [];
  }
}

async function writeList(key: string, operations: OfflineSyncOperation[]): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(operations));
}

function retryDelayMs(retryCount: number): number {
  const capped = Math.min(Math.max(retryCount, 0), 8);
  return Math.min(30 * 60_000, 2 ** capped * 5_000);
}

export async function listOfflineOperations(includeFinal = false): Promise<OfflineSyncOperation[]> {
  const queue = await readList(QUEUE_KEY);
  return queue
    .filter(item => includeFinal || !['synced', 'cancelled'].includes(item.syncState))
    .sort((a, b) => b.priority - a.priority || a.localTimestamp.localeCompare(b.localTimestamp));
}

export async function enqueueOfflineOperation(input: {
  idempotencyKey: string;
  entity: string;
  entityId?: string | null;
  operation: OfflineSyncOperationType;
  payload: unknown;
  baseServerVersion?: string | number | null;
  priority?: number;
  dependencyKeys?: string[];
  maxRetries?: number;
  clientUuid?: string;
}): Promise<OfflineSyncOperation> {
  if (!input.idempotencyKey.trim()) throw new Error('Offline operation requires an idempotency key.');
  if (!input.entity.trim()) throw new Error('Offline operation requires an entity name.');

  return serialized(async () => {
    const queue = await readList(QUEUE_KEY);
    const duplicate = queue.find(
      item => item.idempotencyKey === input.idempotencyKey && item.syncState !== 'cancelled',
    );
    if (duplicate) return duplicate;

    const operation: OfflineSyncOperation = {
      clientUuid: input.clientUuid ?? newClientUuid(),
      idempotencyKey: input.idempotencyKey,
      entity: input.entity,
      entityId: input.entityId,
      operation: input.operation,
      payload: input.payload,
      localTimestamp: new Date().toISOString(),
      baseServerVersion: input.baseServerVersion,
      priority: input.priority ?? 0,
      dependencyKeys: input.dependencyKeys ?? [],
      retryCount: 0,
      maxRetries: input.maxRetries ?? 8,
      syncState: 'pending',
      lastError: null,
      nextAttemptAt: null,
    };

    queue.push(operation);
    await writeList(QUEUE_KEY, queue);
    return operation;
  });
}

export async function cancelOfflineOperation(clientUuid: string): Promise<void> {
  await serialized(async () => {
    const queue = await readList(QUEUE_KEY);
    const next = queue.map(item => item.clientUuid === clientUuid
      ? { ...item, syncState: 'cancelled' as const, lastError: null }
      : item);
    await writeList(QUEUE_KEY, next);
  });
}

export async function markOfflineConflict(clientUuid: string, error: string): Promise<void> {
  await serialized(async () => {
    const queue = await readList(QUEUE_KEY);
    const next = queue.map(item => item.clientUuid === clientUuid
      ? { ...item, syncState: 'conflict' as const, lastError: error, nextAttemptAt: null }
      : item);
    await writeList(QUEUE_KEY, next);
  });
}

export async function processOfflineQueue(
  processor: OfflineSyncProcessor,
  options: { limit?: number; now?: Date } = {},
): Promise<{ processed: number; synced: number; failed: number; conflicts: number }> {
  const limit = Math.max(1, Math.min(100, Math.trunc(options.limit ?? 25)));
  const now = options.now ?? new Date();

  return serialized(async () => {
    let queue = await readList(QUEUE_KEY);
    const syncedKeys = new Set(
      queue.filter(item => item.syncState === 'synced').map(item => item.idempotencyKey),
    );

    const candidates = queue
      .filter(item => {
        if (!['pending', 'failed'].includes(item.syncState)) return false;
        if (item.nextAttemptAt && new Date(item.nextAttemptAt) > now) return false;
        return item.dependencyKeys.every(key => syncedKeys.has(key));
      })
      .sort((a, b) => b.priority - a.priority || a.localTimestamp.localeCompare(b.localTimestamp))
      .slice(0, limit);

    let synced = 0;
    let failed = 0;
    let conflicts = 0;

    for (const candidate of candidates) {
      queue = queue.map(item => item.clientUuid === candidate.clientUuid
        ? { ...item, syncState: 'uploading' as const, lastError: null }
        : item);
      await writeList(QUEUE_KEY, queue);

      try {
        const result = await processor({ ...candidate, syncState: 'uploading' });
        queue = queue.map(item => item.clientUuid === candidate.clientUuid
          ? {
              ...item,
              syncState: 'synced' as const,
              serverAcknowledgement: result.serverAcknowledgement,
              baseServerVersion: result.serverVersion ?? item.baseServerVersion,
              lastError: null,
              nextAttemptAt: null,
            }
          : item);
        syncedKeys.add(candidate.idempotencyKey);
        synced += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Offline sync failed.';
        const isConflict = /conflict|version|stale|409/i.test(message);
        const retryCount = candidate.retryCount + 1;
        const exhausted = retryCount >= candidate.maxRetries;

        queue = queue.map(item => item.clientUuid === candidate.clientUuid
          ? {
              ...item,
              retryCount,
              syncState: isConflict ? 'conflict' as const : exhausted ? 'blocked' as const : 'failed' as const,
              lastError: message,
              nextAttemptAt: isConflict || exhausted
                ? null
                : new Date(now.getTime() + retryDelayMs(retryCount)).toISOString(),
            }
          : item);

        if (isConflict) conflicts += 1;
        else failed += 1;
      }

      await writeList(QUEUE_KEY, queue);
    }

    const deadLetters = queue.filter(item => item.syncState === 'blocked');
    if (deadLetters.length) {
      const previous = await readList(DEAD_LETTER_KEY);
      const byKey = new Map(previous.map(item => [item.idempotencyKey, item]));
      deadLetters.forEach(item => byKey.set(item.idempotencyKey, item));
      await writeList(DEAD_LETTER_KEY, Array.from(byKey.values()));
    }

    return { processed: candidates.length, synced, failed, conflicts };
  });
}

export async function clearSyncedOfflineOperations(olderThanDays = 7): Promise<number> {
  const cutoff = Date.now() - Math.max(0, olderThanDays) * 86_400_000;
  return serialized(async () => {
    const queue = await readList(QUEUE_KEY);
    const next = queue.filter(item => {
      if (item.syncState !== 'synced') return true;
      return new Date(item.localTimestamp).getTime() >= cutoff;
    });
    await writeList(QUEUE_KEY, next);
    return queue.length - next.length;
  });
}
