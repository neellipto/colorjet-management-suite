import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React from 'react';
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNotificationRuntime, type NotificationFeedItem } from '@/context/NotificationRuntimeContext';
import { useColors } from '@/hooks/useColors';
import type { Notification } from '@/constants/types';

const TYPE_META: Partial<Record<Notification['type'], { icon: keyof typeof Feather.glyphMap; color: string }>> = {
  stock_warning: { icon: 'alert-triangle', color: '#FF9500' },
  due_warning: { icon: 'clock', color: '#FF3B30' },
  new_ticket: { icon: 'plus-circle', color: '#007AFF' },
  ticket_update: { icon: 'tool', color: '#007AFF' },
  status_change: { icon: 'refresh-cw', color: '#5856D6' },
  payment: { icon: 'dollar-sign', color: '#34C759' },
  payment_received: { icon: 'dollar-sign', color: '#34C759' },
  job_assigned: { icon: 'user-check', color: '#1A237E' },
  complaint: { icon: 'message-square', color: '#FF3B30' },
  general: { icon: 'bell', color: '#1A237E' },
};

function formatNotificationTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

export default function NotificationsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    notifications,
    unreadCount,
    isLoading,
    isErpBacked,
    error,
    refresh,
    markRead,
    markAllRead,
    clearError,
  } = useNotificationRuntime();

  const pb = insets.bottom + (Platform.OS === 'web' ? 34 : 0) + 24;
  const pt = Platform.OS === 'web' ? 16 : 0;

  const handleOpen = async (notification: NotificationFeedItem) => {
    if (!notification.isRead) {
      try {
        await markRead(notification.id);
      } catch {
        return;
      }
    }
    if (notification.route?.startsWith('/')) {
      router.push(notification.route as any);
    }
  };

  const handleMarkAll = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await markAllRead();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.topBar, { paddingTop: pt + 12, backgroundColor: colors.background }]}>
        <View style={styles.statusRow}>
          <Text style={[styles.countText, { color: colors.mutedForeground }]}>{unreadCount} unread</Text>
          <View style={[styles.sourceBadge, { backgroundColor: isErpBacked ? '#E8F5E9' : colors.muted }]}>
            <View style={[styles.sourceDot, { backgroundColor: isErpBacked ? colors.success : colors.mutedForeground }]} />
            <Text style={[styles.sourceText, { color: isErpBacked ? colors.success : colors.mutedForeground }]}>
              {isErpBacked ? 'ERP Live' : 'Local fallback'}
            </Text>
          </View>
        </View>
        {unreadCount > 0 ? (
          <TouchableOpacity onPress={() => { void handleMarkAll(); }} hitSlop={6}>
            <Text style={[styles.markAll, { color: colors.primary }]}>Mark all read</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {error ? (
        <View style={[styles.errorBanner, { backgroundColor: '#FFF3E0', borderColor: '#FFCC80' }]}>
          <Feather name="alert-circle" size={16} color="#E65100" />
          <Text style={styles.errorText} numberOfLines={3}>{error}</Text>
          <TouchableOpacity
            onPress={() => { clearError(); void refresh(); }}
            style={styles.retryButton}
            hitSlop={6}
          >
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <ScrollView
        contentContainerStyle={{ paddingTop: 8, paddingBottom: pb, paddingHorizontal: 16, gap: 8 }}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={() => { void refresh(); }} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {isLoading && notifications.length === 0 ? (
          <View style={styles.empty}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Loading notifications...</Text>
          </View>
        ) : null}

        {!isLoading && notifications.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="bell-off" size={36} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No notifications</Text>
          </View>
        ) : null}

        {notifications.map(notification => {
          const meta = TYPE_META[notification.type] ?? { icon: 'bell', color: colors.primary };
          return (
            <TouchableOpacity
              key={notification.id}
              style={[
                styles.row,
                {
                  backgroundColor: colors.card,
                  borderColor: notification.isRead ? colors.border : meta.color,
                },
              ]}
              onPress={() => { void handleOpen(notification); }}
              activeOpacity={0.75}
            >
              <View style={[styles.iconWrap, { backgroundColor: `${meta.color}22` }]}>
                <Feather name={meta.icon} size={17} color={meta.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.title, { color: colors.foreground }]}>{notification.title}</Text>
                <Text style={[styles.message, { color: colors.mutedForeground }]}>{notification.message}</Text>
                <Text style={[styles.time, { color: colors.mutedForeground }]}>{formatNotificationTime(notification.createdAt)}</Text>
              </View>
              {!notification.isRead ? <View style={[styles.dot, { backgroundColor: meta.color }]} /> : null}
              {notification.route?.startsWith('/') ? <Feather name="chevron-right" size={15} color={colors.mutedForeground} /> : null}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 6, gap: 10 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  countText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  sourceBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
  sourceDot: { width: 6, height: 6, borderRadius: 3 },
  sourceText: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  markAll: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginBottom: 4, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  errorText: { flex: 1, color: '#8D4A00', fontSize: 11, fontFamily: 'Inter_400Regular' },
  retryButton: { paddingHorizontal: 4, paddingVertical: 3 },
  retryText: { color: '#E65100', fontSize: 12, fontFamily: 'Inter_700Bold' },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12 },
  emptyText: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13, borderRadius: 12, borderWidth: 1 },
  iconWrap: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  message: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  time: { fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 3 },
  dot: { width: 9, height: 9, borderRadius: 5 },
});
