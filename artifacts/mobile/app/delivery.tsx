import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { FlatList, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge, statusBadge, statusLabel } from '@/components/Badge';
import { EmptyState } from '@/components/EmptyState';
import { StatCard } from '@/components/StatCard';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import type { DeliveryOrder } from '@/constants/types';

type DOFilter = 'all' | 'pending' | 'out_for_delivery' | 'delivered';

function DeliveryCard({ delivery, onUpdateStatus, canUpdate }: { delivery: DeliveryOrder; onUpdateStatus: (id: string, status: DeliveryOrder['status']) => void; canUpdate: boolean }) {
  const colors = useColors();
  const statusIcons: Record<string, keyof typeof Feather.glyphMap> = {
    pending: 'clock', out_for_delivery: 'truck', delivered: 'check-circle',
  };
  const icon = statusIcons[delivery.status] ?? 'package';

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.cardTop}>
        <View style={[styles.doIcon, { backgroundColor: colors.navyLight }]}>
          <Feather name={icon} size={18} color={colors.primary} />
        </View>
        <View style={styles.cardMeta}>
          <Text style={[styles.doNo, { color: colors.foreground }]}>{delivery.doNo}</Text>
          <Text style={[styles.doDate, { color: colors.mutedForeground }]}>{delivery.deliveryDate}</Text>
        </View>
        <Badge label={statusLabel(delivery.status)} variant={statusBadge(delivery.status)} size="md" />
      </View>

      <Text style={[styles.custName, { color: colors.foreground }]}>{delivery.customerName}</Text>

      <View style={styles.infoGrid}>
        <InfoChip icon="user" value={delivery.receiverName} colors={colors} />
        <InfoChip icon="phone" value={delivery.receiverPhone} colors={colors} />
        <InfoChip icon="user-check" value={delivery.deliveredByName} colors={colors} />
        {delivery.vehicleNo ? <InfoChip icon="truck" value={delivery.vehicleNo} colors={colors} /> : null}
      </View>

      <View style={[styles.itemsList, { backgroundColor: colors.background, borderColor: colors.border }]}>
        {delivery.items.map((item, i) => (
          <Text key={i} style={[styles.itemText, { color: colors.mutedForeground }]}>• {item}</Text>
        ))}
      </View>

      {canUpdate && delivery.status !== 'delivered' && (
        <View style={styles.actionRow}>
          {delivery.status === 'pending' && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.info }]}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onUpdateStatus(delivery.id, 'out_for_delivery'); }}
              activeOpacity={0.85}
            >
              <Feather name="truck" size={14} color="#fff" />
              <Text style={styles.actionText}>Dispatch</Text>
            </TouchableOpacity>
          )}
          {delivery.status === 'out_for_delivery' && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.success }]}
              onPress={() => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); onUpdateStatus(delivery.id, 'delivered'); }}
              activeOpacity={0.85}
            >
              <Feather name="check-circle" size={14} color="#fff" />
              <Text style={styles.actionText}>Mark Delivered</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

function InfoChip({ icon, value, colors }: { icon: keyof typeof Feather.glyphMap; value: string; colors: ReturnType<typeof import('@/hooks/useColors').useColors> }) {
  return (
    <View style={styles.infoChip}>
      <Feather name={icon} size={11} color={colors.mutedForeground} />
      <Text style={[styles.infoChipText, { color: colors.mutedForeground }]}>{value}</Text>
    </View>
  );
}

export default function DeliveryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { deliveries, currentUser, updateDeliveryStatus } = useApp();

  const role = currentUser?.role ?? '';
  const canUpdate = role === 'admin' || role === 'marketing';

  const [filter, setFilter] = useState<DOFilter>('all');

  const filtered = useMemo(() => {
    if (filter === 'all') return deliveries;
    return deliveries.filter(d => d.status === filter);
  }, [deliveries, filter]);

  const stats = useMemo(() => ({
    pending: deliveries.filter(d => d.status === 'pending').length,
    outForDelivery: deliveries.filter(d => d.status === 'out_for_delivery').length,
    delivered: deliveries.filter(d => d.status === 'delivered').length,
  }), [deliveries]);

  const pb = insets.bottom + (Platform.OS === 'web' ? 34 : 0);
  const pt = Platform.OS === 'web' ? 67 : 0;

  const FILTERS: { label: string; key: DOFilter }[] = [
    { label: 'All', key: 'all' },
    { label: 'Pending', key: 'pending' },
    { label: 'Dispatched', key: 'out_for_delivery' },
    { label: 'Delivered', key: 'delivered' },
  ];

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingTop: pt + 16, paddingBottom: pb + 24, paddingHorizontal: 16, gap: 12 }}
      ListHeaderComponent={
        <>
          <Text style={[styles.screenTitle, { color: colors.foreground }]}>Deliveries</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <StatCard label="Pending" value={String(stats.pending)} accent="warning" />
            <StatCard label="In Transit" value={String(stats.outForDelivery)} accent="primary" />
            <StatCard label="Delivered" value={String(stats.delivered)} accent="success" />
          </View>
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
        </>
      }
      data={filtered}
      keyExtractor={d => d.id}
      renderItem={({ item }) => (
        <DeliveryCard delivery={item} onUpdateStatus={updateDeliveryStatus} canUpdate={canUpdate} />
      )}
      ListEmptyComponent={<EmptyState icon="truck" title="No deliveries found" description="No delivery orders match your filter." />}
      ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  screenTitle: { fontSize: 22, fontFamily: 'Inter_700Bold', marginBottom: 4 },
  filterRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  filterBtn: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1 },
  filterText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  card: { borderRadius: 12, padding: 14, borderWidth: 1, gap: 10 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  doIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cardMeta: { flex: 1, gap: 2 },
  doNo: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  doDate: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  custName: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  infoChip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  infoChipText: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  itemsList: { borderRadius: 8, padding: 10, borderWidth: 1, gap: 3 },
  itemText: { fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  actionRow: { flexDirection: 'row', gap: 8 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 10, paddingVertical: 10 },
  actionText: { color: '#fff', fontSize: 13, fontFamily: 'Inter_700Bold' },
});
