import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Notification } from '@/constants/types';
import { useApp } from '@/context/AppContext';
import { useErpRuntime } from '@/context/ErpRuntimeContext';
import {
  listNotifications,
  markNotificationRead as markErpNotificationRead,
  type ErpNotification,
  type NotificationSeverity,
} from '@/lib/notificationsApi';

export type NotificationFeedItem = Notification & {
  route?: string | null;
  severity?: NotificationSeverity;
  source: 'erp' | 'legacy';
};

type NotificationRuntimeValue = {
  notifications: NotificationFeedItem[];
  unreadCount: number;
  isLoading: boolean;
  isErpBacked: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  markRead: (notificationId: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  clearError: () => void;
};

const NotificationRuntimeContext = createContext<NotificationRuntimeValue | null>(null);

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'Unable to load ERP notifications.';
}

function mapNotificationType(type: string): Notification['type'] {
  const normalized = type.trim().toLowerCase();
  if (normalized.includes('stock')) return 'stock_warning';
  if (normalized.includes('due') || normalized.includes('overdue')) return 'due_warning';
  if (normalized.includes('payment')) return 'payment_received';
  if (normalized.includes('assign')) return 'job_assigned';
  if (normalized.includes('complaint')) return 'complaint';
  if (normalized.includes('status')) return 'status_change';
  if (normalized.includes('new_ticket')) return 'new_ticket';
  if (normalized.includes('ticket')) return 'ticket_update';
  return 'general';
}

function mapErpNotification(item: ErpNotification): NotificationFeedItem {
  return {
    id: item.id,
    title: item.title,
    message: item.body,
    type: mapNotificationType(item.type),
    isRead: item.status !== 'unread',
    createdAt: item.createdAt,
    route: item.route ?? null,
    severity: item.severity,
    source: 'erp',
  };
}

export function NotificationRuntimeProvider({ children }: { children: React.ReactNode }) {
  const {
    notifications: legacyNotifications,
    currentUser,
    markNotificationRead: markLegacyNotificationRead,
    markAllNotificationsRead: markAllLegacyNotificationsRead,
  } = useApp();
  const { authenticated } = useErpRuntime();
  const [remoteNotifications, setRemoteNotifications] = useState<NotificationFeedItem[]>([]);
  const [hasLoadedRemote, setHasLoadedRemote] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!authenticated) {
      setRemoteNotifications([]);
      setHasLoadedRemote(false);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    try {
      const items = await listNotifications({ limit: 100 });
      setRemoteNotifications(items.map(mapErpNotification));
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

  const legacyFeed = useMemo<NotificationFeedItem[]>(() => legacyNotifications
    .filter(item => !item.userId || item.userId === currentUser?.id)
    .map(item => ({ ...item, source: 'legacy' as const })), [legacyNotifications, currentUser?.id]);

  const isErpBacked = authenticated && hasLoadedRemote;
  const notifications = useMemo(() => {
    const source = isErpBacked ? remoteNotifications : legacyFeed;
    return [...source].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [isErpBacked, remoteNotifications, legacyFeed]);

  const markRead = useCallback(async (notificationId: string) => {
    const target = notifications.find(item => item.id === notificationId);
    if (!target || target.isRead) return;

    if (target.source === 'legacy') {
      markLegacyNotificationRead(notificationId);
      return;
    }

    const previous = remoteNotifications;
    setRemoteNotifications(items => items.map(item => item.id === notificationId ? { ...item, isRead: true } : item));
    try {
      const updated = await markErpNotificationRead(notificationId);
      const mapped = mapErpNotification(updated);
      setRemoteNotifications(items => items.map(item => item.id === notificationId ? mapped : item));
      setError(null);
    } catch (markError) {
      setRemoteNotifications(previous);
      setError(messageOf(markError));
      throw markError;
    }
  }, [notifications, markLegacyNotificationRead, remoteNotifications]);

  const markAllRead = useCallback(async () => {
    const unread = notifications.filter(item => !item.isRead);
    if (unread.length === 0) return;

    if (!isErpBacked) {
      markAllLegacyNotificationsRead();
      return;
    }

    const previous = remoteNotifications;
    setRemoteNotifications(items => items.map(item => ({ ...item, isRead: true })));
    const results = await Promise.allSettled(unread.map(item => markErpNotificationRead(item.id)));
    const failed = results.some(result => result.status === 'rejected');
    if (failed) {
      setRemoteNotifications(previous);
      setError('Some notifications could not be marked as read. The list has been restored.');
      return;
    }

    setError(null);
    await refresh();
  }, [notifications, isErpBacked, markAllLegacyNotificationsRead, remoteNotifications, refresh]);

  const clearError = useCallback(() => setError(null), []);
  const unreadCount = notifications.filter(item => !item.isRead).length;

  const value = useMemo<NotificationRuntimeValue>(() => ({
    notifications,
    unreadCount,
    isLoading,
    isErpBacked,
    error,
    refresh,
    markRead,
    markAllRead,
    clearError,
  }), [notifications, unreadCount, isLoading, isErpBacked, error, refresh, markRead, markAllRead, clearError]);

  return <NotificationRuntimeContext.Provider value={value}>{children}</NotificationRuntimeContext.Provider>;
}

export function useNotificationRuntime(): NotificationRuntimeValue {
  const value = useContext(NotificationRuntimeContext);
  if (!value) throw new Error('useNotificationRuntime must be used inside NotificationRuntimeProvider.');
  return value;
}
