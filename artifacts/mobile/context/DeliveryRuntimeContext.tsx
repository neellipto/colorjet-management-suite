import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { DeliveryOrder } from '@/constants/types';
import { useApp } from '@/context/AppContext';
import { useErpRuntime } from '@/context/ErpRuntimeContext';
import {
  listDeliveries,
  updateDeliveryStatus as updateErpDeliveryStatus,
  type ErpDeliveryOrder,
} from '@/lib/deliveriesApi';

export type DeliveryFeedItem = ErpDeliveryOrder & {
  source: 'erp' | 'legacy';
};

type DeliveryRuntimeValue = {
  deliveries: DeliveryFeedItem[];
  isLoading: boolean;
  isErpBacked: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  updateStatus: (deliveryId: string, status: DeliveryOrder['status']) => Promise<void>;
  clearError: () => void;
};

const DeliveryRuntimeContext = createContext<DeliveryRuntimeValue | null>(null);

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'Unable to load ERP deliveries.';
}

export function DeliveryRuntimeProvider({ children }: { children: React.ReactNode }) {
  const {
    deliveries: legacyDeliveries,
    updateDeliveryStatus: updateLegacyDeliveryStatus,
  } = useApp();
  const { authenticated } = useErpRuntime();
  const [remoteDeliveries, setRemoteDeliveries] = useState<DeliveryFeedItem[]>([]);
  const [hasLoadedRemote, setHasLoadedRemote] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!authenticated) {
      setRemoteDeliveries([]);
      setHasLoadedRemote(false);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    try {
      const items = await listDeliveries({ limit: 200 });
      setRemoteDeliveries(items.map(item => ({ ...item, source: 'erp' as const })));
      setHasLoadedRemote(true);
      setError(null);
    } catch (refreshError) {
      setHasLoadedRemote(false);
      setError(messageOf(refreshError));
    } finally {
      setIsLoading(false);
    }
  }, [authenticated]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const legacyFeed = useMemo<DeliveryFeedItem[]>(() => legacyDeliveries.map(item => ({
    ...item,
    lockVersion: 1,
    source: 'legacy' as const,
  })), [legacyDeliveries]);

  const isErpBacked = authenticated && hasLoadedRemote;
  const deliveries = useMemo(() => {
    const source = isErpBacked ? remoteDeliveries : legacyFeed;
    return [...source].sort((a, b) => {
      const statusWeight: Record<DeliveryOrder['status'], number> = {
        out_for_delivery: 1,
        pending: 2,
        failed: 3,
        delivered: 4,
      };
      return statusWeight[a.status] - statusWeight[b.status]
        || b.deliveryDate.localeCompare(a.deliveryDate);
    });
  }, [isErpBacked, remoteDeliveries, legacyFeed]);

  const updateStatus = useCallback(async (deliveryId: string, status: DeliveryOrder['status']) => {
    const target = deliveries.find(item => item.id === deliveryId);
    if (!target || target.status === status) return;

    if (target.source === 'legacy') {
      updateLegacyDeliveryStatus(deliveryId, status);
      return;
    }

    setRemoteDeliveries(items => items.map(item => item.id === deliveryId
      ? { ...item, status, lockVersion: item.lockVersion + 1 }
      : item));
    try {
      const updated = await updateErpDeliveryStatus({
        deliveryId,
        status,
        lockVersion: target.lockVersion,
      });
      setRemoteDeliveries(items => items.map(item => item.id === deliveryId
        ? { ...updated, source: 'erp' as const }
        : item));
      setError(null);
    } catch (updateError) {
      setRemoteDeliveries(items => items.map(item => item.id === deliveryId ? target : item));
      setError(messageOf(updateError));
      throw updateError;
    }
  }, [deliveries, updateLegacyDeliveryStatus]);

  const clearError = useCallback(() => setError(null), []);
  const value = useMemo<DeliveryRuntimeValue>(() => ({
    deliveries,
    isLoading,
    isErpBacked,
    error,
    refresh,
    updateStatus,
    clearError,
  }), [deliveries, isLoading, isErpBacked, error, refresh, updateStatus, clearError]);

  return <DeliveryRuntimeContext.Provider value={value}>{children}</DeliveryRuntimeContext.Provider>;
}

export function useDeliveryRuntime(): DeliveryRuntimeValue {
  const value = useContext(DeliveryRuntimeContext);
  if (!value) throw new Error('useDeliveryRuntime must be used inside DeliveryRuntimeProvider.');
  return value;
}
