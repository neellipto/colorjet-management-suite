import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge, statusBadge, statusLabel } from '@/components/Badge';
import { EmptyState } from '@/components/EmptyState';
import { StatCard } from '@/components/StatCard';
import { useApp } from '@/context/AppContext';
import { useDeliveryRuntime } from '@/context/DeliveryRuntimeContext';
import { useErpRuntime } from '@/context/ErpRuntimeContext';
import { useColors } from '@/hooks/useColors';
import { can } from '@/lib/effectivePermissions';
import type { DeliveryOrder } from '@/constants/types';

type DOFilter = 'all' | 'pending' | 'out_for_delivery' | 'delivered' | 'failed';

function DeliveryCard({
  delivery,
  onUpdateStatus,
  canUpdate,
  isUpdating,
}: {
  delivery: DeliveryOrder;
  onUpdateStatus: (id: string, status: DeliveryOrder['status']) => void;
  canUpdate: boolean;
  isUpdating: boolean;
}) {
  const colors = useColors();
  const statusIcons: Record<string, keyof typeof Feather.glyphMap> = {
    pending: 'clock',
    out_for_delivery: 'truck',
    delivered: 'check-circle',
    failed: 'x-circle',
  };
  const icon = statusIcons[delivery.status] ?? 'package';

  const confirmFailed = () => {
    Alert.alert(
      'Mark delivery failed?',
      'This delivery can be dispatched again after the failure is recorded.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark Failed',
          style: 'destructive',
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            onUpdateStatus(delivery.id, 'failed');
          },
        },
      ],
    );
  };

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
        {delivery.receiverName ? <InfoChip icon="user" value={delivery.receiverName} colors={colors} /> : null}
        {delivery.receiverPhone ? <InfoChip icon="phone" value={delivery.receiverPhone} colors={colors} /> : null}
        {delivery.deliveredByName ? <InfoChip icon="user-check" value={delivery.deliveredByName} colors={colors} /> : null}
        {delivery.vehicleNo ? <InfoChip icon="truck" value={delivery.vehicleNo} colors={colors} /> : null}
      </View>

      {delivery.items.length > 0 ? (
        <View style={[styles.itemsList, { backgroundColor: colors.background, borderColor: colors.border }]}>
          {delivery.items.map((item, i) => (
            <Text key={`${delivery.id}-${i}`} style={[styles.itemText, { color: colors.mutedForeground }]}>• {item}</Text>
          ))}
        </View>
      ) : null}

      {canUpdate && delivery.status !== 'delivered' && (
        <View style={styles.actionRow}>
          {isUpdating ? (
            <View style={[styles.actionBtn, { backgroundColor: colors.muted }]}> 
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[styles.actionText, { color: colors.primary }]}>Updating...</Text>
            </View>
          ) : (
            <>
              {(delivery.status === 'pending' || delivery.status === 'failed') && (
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: colors.info }]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    onUpdateStatus(delivery.id, 'out_for_delivery');
                  }}
                  activeOpacity={0.85}
                >
                  <Feather name="truck" size={14} color="#fff" />
                  <Text style={styles.actionText}>{delivery.status === 'failed' ? 'Retry Dispatch' : 'Dispatch'}</Text>
                </TouchableOpacity>
              )}
              {delivery.status === 'out_for_delivery' && (
                <>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: colors.destructive }]}
                    onPress={confirmFailed}
                    activeOpacity={0.85}
                  >
                    <Feather name="x-circle" size={14} color="#fff" />
                    <Text style={styles.actionText}>Failed</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: colors.success }]}
                    onPress={() => {
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                      onUpdateStatus(delivery.id, 'delivered');
                    }}
                    activeOpacity={0.85}
                  >
                    <Feather name="check-circle" size={14} color="#fff" />
                    <Text style={styles.actionText}>Delivered</Text>
                  </TouchableOpacity>
                </>
              )}
            </>
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
  const { currentUser } = useApp();
  const { permissions } = useErpRuntime();
  const {
    deliveries,
    updatingIds,
    isLoading,
    isErpBacked,
    error,
    refresh,
    updateStatus,
    clearError,
  } = useDeliveryRuntime();

  const role = currentUser?.role ?? '';
  const canUpdate = isErpBacked
    ? can(permissions, 'sales-orders', 'edit')
    : role === 'admin' || role === 'marketing';

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

  const filters: { label: string; key: DOFilter }[] = [
    { label: 'All', key: 'all' },
    { label: 'Pending', key: 'pending' },
    { label: 'Dispatched', key: 'out_for_delivery' },
    { label: 'Delivered', key: 'delivered' },
    { label: 'Failed', key: 'failed' },
  ];

  const handleUpdateStatus = async (id: string, status: DeliveryOrder['status']) => {
    try {
      await updateStatus(id, status);
    } catch (updateError) {
      Alert.alert('Delivery update failed', updateError instanceof Error ? updateError.message : 'Refresh and try again.');
    }
  };

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingTop: pt + 16, paddingBottom: pb + 24, paddingHorizontal: 16, gap: 12 }}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={() => { void refresh(); }} tintColor={colors.primary} />}
      ListHeaderComponent={
        <>
          <View style={styles.titleRow}>
            <Text style={[styles.screenTitle, { color: colors.foreground }]}>Deliveries</Text>
            <View style={[styles.sourceBadge, { backgroundColor: isErpBacked ? '#E8F5E9' : colors.muted }]}>
              <View style={[styles.sourceDot, { backgroundColor: isErpBacked ? colors.success : colors.mutedForeground }]} />
              <Text style={[styles.sourceText, { color: isErpBacked ? colors.success : colors.mutedForeground }]}>
                {isErpBacked ? 'ERP Live' : 'Local fallback'}
              </Text>
            </View>
          </View>
          {error ? (
            <View style={[styles.errorBanner, { backgroundColor: '#FFF3E0', borderColor: '#FFCC80' }]}>
              <Feather name="alert-circle" size={16} color="#E65100" />
              <Text style={styles.errorText} numberOfLines={3}>{error}</Text>
              <TouchableOpacity onPress={() => { clearError(); void refresh(); }} hitSlop={6}>
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <StatCard label="Pending" value={String(stats.pending)} accent="warning" />
            <StatCard label="In Transit" value={String(stats.outForDelivery)} accent="primary" />
            <StatCard label="Delivered" value={String(stats.delivered)} accent="success" />
          </View>
          <View style={styles.filterRow}>
            {filters.map(item => (
              <TouchableOpacity
                key={item.key}
                style={[styles.filterBtn, { backgroundColor: filter === item.key ? colors.primary : colors.card, borderColor: filter === item.key ? colors.primary : colors.border }]}
                onPress={() => setFilter(item.key)}
                activeOpacity={0.75}
              >
                <Text style={[styles.filterText, { color: filter === item.key ? '#fff' : colors.mutedForeground }]}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      }
      data={filtered}
      keyExtractor={delivery => delivery.id}
      renderItem={({ item }) => (
        <DeliveryCard
          delivery={item}
          onUpdateStatus={(id, status) => { void handleUpdateStatus(id, status); }}
          canUpdate={canUpdate}
          isUpdating={updatingIds.has(item.id)}
        />
      )}
      ListEmptyComponent={isLoading
        ? (
          <View style={styles.loadingState}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Loading deliveries...</Text>
          </View>
        )
        : <EmptyState icon="truck" title="No deliveries found" description="No delivery orders match your filter." />}
      ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  screenTitle: { fontSize: 22, fontFamily: 'Inter_700Bold', marginBottom: 4 },
  sourceBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
  sourceDot: { width: 6, height: 6, borderRadius: 3 },
  sourceText: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  errorText: { flex: 1, color: '#8D4A00', fontSize: 11, fontFamily: 'Inter_400Regular' },
  retryText: { color: '#E65100', fontSize: 12, fontFamily: 'Inter_700Bold' },
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
  loadingState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12 },
  loadingText: { fontSize: 14, fontFamily: 'Inter_500Medium' },
});
