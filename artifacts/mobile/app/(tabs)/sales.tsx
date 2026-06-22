import { Feather } from '@expo/vector-icons';
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
import type { Invoice, MarketingTask } from '@/constants/types';

function fmt(n: number) {
  if (n >= 1000000) return `৳${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `৳${(n / 1000).toFixed(0)}K`;
  return `৳${n.toLocaleString()}`;
}

type InvFilter = 'all' | 'posted' | 'partial' | 'paid';

function InvoiceItem({ invoice }: { invoice: Invoice }) {
  const colors = useColors();
  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={() => router.push(`/invoice/${invoice.id}` as any)}
      activeOpacity={0.75}
    >
      <View style={styles.cardTop}>
        <View style={styles.cardLeft}>
          <Text style={[styles.cardCustomer, { color: colors.foreground }]} numberOfLines={1}>{invoice.customerName}</Text>
          <Text style={[styles.cardNo, { color: colors.mutedForeground }]}>{invoice.invoiceNo}</Text>
        </View>
        <Badge label={statusLabel(invoice.status)} variant={statusBadge(invoice.status)} size="md" />
      </View>
      <View style={styles.cardBottom}>
        <View>
          <Text style={[styles.cardLabel, { color: colors.mutedForeground }]}>Total</Text>
          <Text style={[styles.cardAmount, { color: colors.foreground }]}>{fmt(invoice.totalAmount)}</Text>
        </View>
        <View>
          <Text style={[styles.cardLabel, { color: colors.mutedForeground }]}>Paid</Text>
          <Text style={[styles.cardAmount, { color: colors.success }]}>{fmt(invoice.totalPaid)}</Text>
        </View>
        <View>
          <Text style={[styles.cardLabel, { color: colors.mutedForeground }]}>Due</Text>
          <Text style={[styles.cardAmount, { color: invoice.totalDue > 0 ? colors.secondary : colors.success }]}>{fmt(invoice.totalDue)}</Text>
        </View>
        <View>
          <Text style={[styles.cardLabel, { color: colors.mutedForeground }]}>Date</Text>
          <Text style={[styles.cardDate, { color: colors.mutedForeground }]}>{invoice.invoiceDate}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function TaskItem({ task }: { task: MarketingTask }) {
  const colors = useColors();
  const typeColors: Record<string, string> = { visit: colors.info, collection: colors.secondary, delivery_support: colors.primary };
  return (
    <TouchableOpacity style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderLeftColor: typeColors[task.type] ?? colors.border, borderLeftWidth: 3 }]} activeOpacity={0.75}>
      <View style={styles.cardTop}>
        <View style={styles.cardLeft}>
          <Text style={[styles.cardCustomer, { color: colors.foreground }]} numberOfLines={1}>{task.customerName}</Text>
          <Text style={[styles.cardNo, { color: colors.mutedForeground }]}>{task.taskNo} · {task.targetDate}</Text>
        </View>
        <Badge label={statusLabel(task.status)} variant={statusBadge(task.status)} size="md" />
      </View>
      <Text style={[styles.taskPurpose, { color: colors.mutedForeground }]} numberOfLines={2}>{task.purpose}</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
        <Badge label={statusLabel(task.type)} variant="info" />
        {task.collectedAmount ? <Badge label={fmt(task.collectedAmount)} variant="success" /> : null}
      </View>
    </TouchableOpacity>
  );
}

export default function SalesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { invoices, tasks, currentUser } = useApp();
  const role = currentUser?.role ?? 'customer';
  const isMarketing = role === 'marketing';
  const isCustomer = role === 'customer';

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<InvFilter>('all');

  const filtered = useMemo(() => {
    if (isMarketing) {
      return tasks.filter(t => t.customerName.toLowerCase().includes(search.toLowerCase()));
    }
    let list = isCustomer
      ? invoices
      : invoices;
    if (filter !== 'all') list = list.filter(i => i.status === filter);
    if (search) list = list.filter(i => i.customerName.toLowerCase().includes(search.toLowerCase()) || i.invoiceNo.toLowerCase().includes(search.toLowerCase()));
    return list;
  }, [invoices, tasks, search, filter, isMarketing, isCustomer]);

  const summaryStats = useMemo(() => ({
    total: invoices.reduce((s, i) => s + i.totalAmount, 0),
    paid: invoices.reduce((s, i) => s + i.totalPaid, 0),
    due: invoices.reduce((s, i) => s + i.totalDue, 0),
    count: invoices.length,
  }), [invoices]);

  const pb = insets.bottom + (Platform.OS === 'web' ? 34 : 0) + 70;
  const pt = Platform.OS === 'web' ? 67 : 0;

  const FILTERS: { label: string; key: InvFilter }[] = [
    { label: 'All', key: 'all' },
    { label: 'Unpaid', key: 'posted' },
    { label: 'Partial', key: 'partial' },
    { label: 'Paid', key: 'paid' },
  ];

  const title = isMarketing ? 'My Tasks' : isCustomer ? 'My Invoices' : 'Sales & Invoices';

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingTop: pt + 16, paddingBottom: pb, paddingHorizontal: 16, gap: 12 }}
      ListHeaderComponent={
        <>
          <Text style={[styles.screenTitle, { color: colors.foreground }]}>{title}</Text>
          {!isMarketing && (
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              <StatCard label="Total" value={fmt(summaryStats.total)} accent="primary" />
              <StatCard label="Collected" value={fmt(summaryStats.paid)} accent="success" />
              <StatCard label="Due" value={fmt(summaryStats.due)} accent="orange" />
            </View>
          )}
          <SearchBar value={search} onChangeText={setSearch} placeholder={isMarketing ? 'Search tasks...' : 'Search invoices...'} />
          {!isMarketing && (
            <View style={styles.filterRow}>
              {FILTERS.map(f => (
                <TouchableOpacity
                  key={f.key}
                  style={[styles.filterBtn, { backgroundColor: filter === f.key ? colors.primary : colors.card, borderColor: filter === f.key ? colors.primary : colors.border }]}
                  onPress={() => setFilter(f.key)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.filterText, { color: filter === f.key ? '#fff' : colors.mutedForeground }]}>{f.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </>
      }
      data={filtered as any[]}
      keyExtractor={item => item.id}
      renderItem={({ item }) => isMarketing ? <TaskItem task={item as MarketingTask} /> : <InvoiceItem invoice={item as Invoice} />}
      ListEmptyComponent={<EmptyState icon="file-text" title="No items found" description="No matching records." />}
      ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  screenTitle: { fontSize: 22, fontFamily: 'Inter_700Bold', marginBottom: 4 },
  card: { borderRadius: 12, padding: 14, borderWidth: 1, gap: 10 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  cardLeft: { flex: 1, gap: 3 },
  cardCustomer: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  cardNo: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  cardLabel: { fontSize: 10, fontFamily: 'Inter_500Medium', textTransform: 'uppercase', marginBottom: 2 },
  cardAmount: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  cardDate: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  taskPurpose: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  filterRow: { flexDirection: 'row', gap: 8 },
  filterBtn: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1 },
  filterText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
});
