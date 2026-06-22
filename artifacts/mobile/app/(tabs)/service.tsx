import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { FlatList, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge, statusBadge, statusLabel } from '@/components/Badge';
import { EmptyState } from '@/components/EmptyState';
import { SearchBar } from '@/components/SearchBar';
import { StatCard } from '@/components/StatCard';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import type { ServiceTicket } from '@/constants/types';

type TicketFilter = 'all' | 'assigned' | 'in_progress' | 'waiting' | 'completed';

const FILTER_STATUSES: Record<TicketFilter, string[]> = {
  all: [],
  assigned: ['pending', 'assigned', 'accepted', 'on_the_way'],
  in_progress: ['in_progress'],
  waiting: ['waiting_parts', 'pending_customer', 'revisit'],
  completed: ['completed', 'cancelled'],
};

const PRIORITY_COLOR: Record<string, string> = {
  emergency: '#C62828',
  high: '#E65100',
  normal: '#1565C0',
  low: '#2E7D32',
};

function TicketCard({ ticket }: { ticket: ServiceTicket }) {
  const colors = useColors();
  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderLeftColor: PRIORITY_COLOR[ticket.priority] ?? colors.border, borderLeftWidth: 3 }]}
      onPress={() => router.push(`/ticket/${ticket.id}` as any)}
      activeOpacity={0.75}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardLeft}>
          <Text style={[styles.cardCustomer, { color: colors.foreground }]} numberOfLines={1}>{ticket.customerName}</Text>
          <Text style={[styles.cardNo, { color: colors.mutedForeground }]}>{ticket.ticketNo}</Text>
        </View>
        <View style={styles.badges}>
          <Badge label={ticket.priority.toUpperCase()} variant={statusBadge(ticket.priority)} />
          <Badge label={statusLabel(ticket.status)} variant={statusBadge(ticket.status)} size="md" />
        </View>
      </View>
      <Text style={[styles.cardTitle, { color: colors.foreground }]} numberOfLines={1}>{ticket.title}</Text>
      <Text style={[styles.cardDesc, { color: colors.mutedForeground }]} numberOfLines={2}>{ticket.description}</Text>
      <View style={styles.cardFooter}>
        <View style={styles.footerItem}>
          <Feather name="cpu" size={11} color={colors.mutedForeground} />
          <Text style={[styles.footerText, { color: colors.mutedForeground }]}>{ticket.machineModel ?? 'N/A'}</Text>
        </View>
        <View style={styles.footerItem}>
          <Feather name="user" size={11} color={colors.mutedForeground} />
          <Text style={[styles.footerText, { color: colors.mutedForeground }]}>{ticket.assignedEngineerName}</Text>
        </View>
        <View style={styles.footerItem}>
          <Feather name="calendar" size={11} color={colors.mutedForeground} />
          <Text style={[styles.footerText, { color: colors.mutedForeground }]}>{ticket.plannedDate}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function ServiceScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { tickets, currentUser, updateTicketStatus } = useApp();
  const role = currentUser?.role ?? 'customer';
  const isEngineer = role === 'engineer';
  const isCustomer = role === 'customer';

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<TicketFilter>('all');

  const myTickets = useMemo(() => {
    if (isEngineer) return tickets.filter(t => t.assignedEngineerId === currentUser?.id);
    return tickets;
  }, [tickets, currentUser, isEngineer]);

  const filtered = useMemo(() => {
    let list = myTickets;
    if (filter !== 'all') list = list.filter(t => FILTER_STATUSES[filter].includes(t.status));
    if (search) list = list.filter(t =>
      t.customerName.toLowerCase().includes(search.toLowerCase()) ||
      t.ticketNo.toLowerCase().includes(search.toLowerCase()) ||
      t.title.toLowerCase().includes(search.toLowerCase())
    );
    return list;
  }, [myTickets, filter, search]);

  const stats = useMemo(() => ({
    assigned: myTickets.filter(t => FILTER_STATUSES.assigned.includes(t.status)).length,
    inProgress: myTickets.filter(t => t.status === 'in_progress').length,
    completed: myTickets.filter(t => t.status === 'completed').length,
  }), [myTickets]);

  const pb = insets.bottom + (Platform.OS === 'web' ? 34 : 0) + 70;
  const pt = Platform.OS === 'web' ? 67 : 0;

  const FILTERS: { label: string; key: TicketFilter }[] = [
    { label: 'All', key: 'all' },
    { label: 'Assigned', key: 'assigned' },
    { label: 'In Progress', key: 'in_progress' },
    { label: 'Waiting', key: 'waiting' },
    { label: 'Completed', key: 'completed' },
  ];

  const title = isEngineer ? 'My Jobs' : isCustomer ? 'My Service Requests' : 'Service Tickets';

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingTop: pt + 16, paddingBottom: pb, paddingHorizontal: 16, gap: 12 }}
      ListHeaderComponent={
        <>
          <Text style={[styles.screenTitle, { color: colors.foreground }]}>{title}</Text>
          <View style={styles.statsRow}>
            <StatCard label="Assigned" value={String(stats.assigned)} accent="warning" />
            <StatCard label="In Progress" value={String(stats.inProgress)} accent="primary" />
            <StatCard label="Completed" value={String(stats.completed)} accent="success" />
          </View>
          <SearchBar value={search} onChangeText={setSearch} placeholder="Search tickets..." />
          <View style={styles.filterRow}>
            {FILTERS.map(f => (
              <TouchableOpacity
                key={f.key}
                style={[styles.filterBtn, { backgroundColor: filter === f.key ? colors.primary : colors.card, borderColor: filter === f.key ? colors.primary : colors.border }]}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setFilter(f.key); }}
                activeOpacity={0.75}
              >
                <Text style={[styles.filterText, { color: filter === f.key ? '#fff' : colors.mutedForeground }]}>{f.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      }
      data={filtered}
      keyExtractor={t => t.id}
      renderItem={({ item }) => <TicketCard ticket={item} />}
      ListEmptyComponent={<EmptyState icon="tool" title="No tickets found" description="No service tickets match your filter." />}
      ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  screenTitle: { fontSize: 22, fontFamily: 'Inter_700Bold', marginBottom: 4 },
  statsRow: { flexDirection: 'row', gap: 8 },
  filterRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  filterBtn: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1 },
  filterText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  card: { borderRadius: 12, padding: 14, borderWidth: 1, gap: 6 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  cardLeft: { flex: 1, gap: 2 },
  cardCustomer: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  cardNo: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  badges: { alignItems: 'flex-end', gap: 4 },
  cardTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  cardDesc: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  cardFooter: { flexDirection: 'row', gap: 12, flexWrap: 'wrap', paddingTop: 4, borderTopWidth: 1, borderTopColor: '#E5E5EA', marginTop: 4 },
  footerItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  footerText: { fontSize: 11, fontFamily: 'Inter_400Regular' },
});
