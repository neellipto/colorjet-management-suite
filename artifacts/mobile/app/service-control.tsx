import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import type { TicketStatus } from '@/constants/types';

const STATUS_META: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pending', color: '#FF9500' },
  assigned: { label: 'Assigned', color: '#007AFF' },
  accepted: { label: 'Accepted', color: '#5856D6' },
  on_the_way: { label: 'On The Way', color: '#5856D6' },
  in_progress: { label: 'In Progress', color: '#1A237E' },
  waiting_parts: { label: 'Waiting Parts', color: '#FF3B30' },
  pending_customer: { label: 'Pending Customer', color: '#FF3B30' },
  completed: { label: 'Completed', color: '#34C759' },
  revisit: { label: 'Revisit', color: '#FF9500' },
  cancelled: { label: 'Cancelled', color: '#C7C7CC' },
};

const PRIORITY_COLOR: Record<string, string> = { low: '#8E8E93', normal: '#007AFF', high: '#FF9500', emergency: '#FF3B30' };

export default function ServiceControlScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { tickets, engineers } = useApp();
  const [filter, setFilter] = useState<TicketStatus | 'all'>('all');

  const pb = insets.bottom + (Platform.OS === 'web' ? 34 : 0) + 24;
  const pt = Platform.OS === 'web' ? 16 : 0;

  const counts = useMemo(() => {
    const c = { open: 0, in_progress: 0, waiting: 0, completed: 0 };
    tickets.forEach(t => {
      if (t.status === 'pending' || t.status === 'assigned') c.open += 1;
      else if (t.status === 'in_progress' || t.status === 'on_the_way' || t.status === 'accepted') c.in_progress += 1;
      else if (t.status === 'waiting_parts' || t.status === 'pending_customer') c.waiting += 1;
      else if (t.status === 'completed') c.completed += 1;
    });
    return c;
  }, [tickets]);

  const available = engineers.filter(e => e.availability === 'available').length;

  const filtered = useMemo(() => {
    const list = filter === 'all' ? tickets : tickets.filter(t => t.status === filter);
    return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [tickets, filter]);

  const FILTERS: (TicketStatus | 'all')[] = ['all', 'pending', 'assigned', 'in_progress', 'waiting_parts', 'completed'];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingTop: pt + 12, paddingBottom: pb, paddingHorizontal: 16, gap: 12 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.kpiGrid}>
        <KpiCard label="Open / New" value={String(counts.open)} color="#FF9500" colors={colors} />
        <KpiCard label="In Progress" value={String(counts.in_progress)} color="#1A237E" colors={colors} />
        <KpiCard label="Waiting" value={String(counts.waiting)} color="#FF3B30" colors={colors} />
        <KpiCard label="Completed" value={String(counts.completed)} color="#34C759" colors={colors} />
      </View>

      <View style={[styles.banner, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Feather name="users" size={18} color={colors.primary} />
        <Text style={[styles.bannerText, { color: colors.foreground }]}>{available} of {engineers.length} engineers available</Text>
        <TouchableOpacity onPress={() => router.push('/schedule' as any)} hitSlop={6}>
          <Text style={[styles.bannerLink, { color: colors.primary }]}>Schedule</Text>
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7 }}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.chip, { backgroundColor: filter === f ? colors.primary : colors.card, borderColor: filter === f ? colors.primary : colors.border }]}
            onPress={() => setFilter(f)}
            activeOpacity={0.75}
          >
            <Text style={[styles.chipText, { color: filter === f ? '#fff' : colors.mutedForeground }]}>{f === 'all' ? 'All' : (STATUS_META[f]?.label ?? f)}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {filtered.map(t => {
        const meta = STATUS_META[t.status] ?? { label: t.status, color: colors.mutedForeground };
        return (
          <TouchableOpacity key={t.id} style={[styles.ticket, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => router.push(`/ticket/${t.id}` as any)} activeOpacity={0.75}>
            <View style={styles.ticketTop}>
              <Text style={[styles.ticketNo, { color: colors.primary }]}>{t.ticketNo}</Text>
              <View style={[styles.statusPill, { backgroundColor: meta.color + '22' }]}>
                <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
              </View>
            </View>
            <Text style={[styles.ticketTitle, { color: colors.foreground }]} numberOfLines={1}>{t.title}</Text>
            <Text style={[styles.ticketSub, { color: colors.mutedForeground }]} numberOfLines={1}>{t.customerName}{t.machineModel ? ` · ${t.machineModel}` : ''}</Text>
            <View style={styles.ticketFooter}>
              <View style={[styles.prioDot, { backgroundColor: PRIORITY_COLOR[t.priority] ?? colors.mutedForeground }]} />
              <Text style={[styles.footerText, { color: colors.mutedForeground }]}>{t.priority}</Text>
              <View style={{ flex: 1 }} />
              <Feather name="user" size={12} color={colors.mutedForeground} />
              <Text style={[styles.footerText, { color: colors.mutedForeground }]}>{t.assignedEngineerName || 'Unassigned'}</Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

function KpiCard({ label, value, color, colors }: { label: string; value: string; color: string; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={[styles.kpiCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.kpiBar, { backgroundColor: color }]} />
      <Text style={[styles.kpiValue, { color: colors.foreground }]}>{value}</Text>
      <Text style={[styles.kpiLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  kpiCard: { width: '47%', flexGrow: 1, borderRadius: 12, borderWidth: 1, padding: 14, overflow: 'hidden' },
  kpiBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  kpiValue: { fontSize: 24, fontFamily: 'Inter_700Bold' },
  kpiLabel: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 12, borderWidth: 1 },
  bannerText: { fontSize: 13, fontFamily: 'Inter_500Medium', flex: 1 },
  bannerLink: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  chipText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  ticket: { borderRadius: 12, borderWidth: 1, padding: 14, gap: 5 },
  ticketTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ticketNo: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  statusPill: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  ticketTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  ticketSub: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  ticketFooter: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  prioDot: { width: 7, height: 7, borderRadius: 4 },
  footerText: { fontSize: 11, fontFamily: 'Inter_500Medium', textTransform: 'capitalize' },
});
