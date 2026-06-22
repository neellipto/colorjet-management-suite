import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import type { Notification } from '@/constants/types';

const TYPE_META: Record<Notification['type'], { icon: keyof typeof Feather.glyphMap; color: string }> = {
  stock_warning: { icon: 'alert-triangle', color: '#FF9500' },
  due_warning: { icon: 'clock', color: '#FF3B30' },
  new_ticket: { icon: 'plus-circle', color: '#007AFF' },
  status_change: { icon: 'refresh-cw', color: '#5856D6' },
  payment: { icon: 'dollar-sign', color: '#34C759' },
  job_assigned: { icon: 'user-check', color: '#1A237E' },
  complaint: { icon: 'message-square', color: '#FF3B30' },
};

export default function NotificationsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { notifications, currentUser, markNotificationRead, markAllNotificationsRead } = useApp();

  const pb = insets.bottom + (Platform.OS === 'web' ? 34 : 0) + 24;
  const pt = Platform.OS === 'web' ? 16 : 0;

  const mine = notifications
    .filter(n => !n.userId || n.userId === currentUser?.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const unread = mine.filter(n => !n.isRead).length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {unread > 0 && (
        <View style={[styles.topBar, { paddingTop: pt + 12, backgroundColor: colors.background }]}>
          <Text style={[styles.countText, { color: colors.mutedForeground }]}>{unread} unread</Text>
          <TouchableOpacity onPress={() => { markAllNotificationsRead(); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }} hitSlop={6}>
            <Text style={[styles.markAll, { color: colors.primary }]}>Mark all read</Text>
          </TouchableOpacity>
        </View>
      )}
      <ScrollView
        contentContainerStyle={{ paddingTop: unread > 0 ? 8 : pt + 12, paddingBottom: pb, paddingHorizontal: 16, gap: 8 }}
        showsVerticalScrollIndicator={false}
      >
        {mine.length === 0 && (
          <View style={styles.empty}>
            <Feather name="bell-off" size={36} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No notifications</Text>
          </View>
        )}
        {mine.map(n => {
          const meta = TYPE_META[n.type] ?? { icon: 'bell', color: colors.primary };
          return (
            <TouchableOpacity
              key={n.id}
              style={[styles.row, { backgroundColor: colors.card, borderColor: n.isRead ? colors.border : meta.color }]}
              onPress={() => { if (!n.isRead) markNotificationRead(n.id); }}
              activeOpacity={0.75}
            >
              <View style={[styles.iconWrap, { backgroundColor: meta.color + '22' }]}>
                <Feather name={meta.icon} size={17} color={meta.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.title, { color: colors.foreground }]}>{n.title}</Text>
                <Text style={[styles.message, { color: colors.mutedForeground }]}>{n.message}</Text>
                <Text style={[styles.time, { color: colors.mutedForeground }]}>{n.createdAt}</Text>
              </View>
              {!n.isRead && <View style={[styles.dot, { backgroundColor: meta.color }]} />}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 4 },
  countText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  markAll: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12 },
  emptyText: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13, borderRadius: 12, borderWidth: 1 },
  iconWrap: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  message: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  time: { fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 3 },
  dot: { width: 9, height: 9, borderRadius: 5 },
});
