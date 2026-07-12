import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Platform, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import {
  getActiveTrackingState,
  getCurrentFieldPosition,
  getInstallationId,
  startFieldLocationTracking,
  stopFieldLocationTracking,
} from '@/lib/backgroundLocation';
import {
  type CustomerVisit,
  type VisitStatus,
  listCustomerVisits,
  startTrackingSession,
  stopTrackingSession,
  transitionCustomerVisit,
} from '@/lib/v12EngineerOperations';

const ACTIVE_STATUSES: VisitStatus[] = [
  'assigned', 'accepted', 'travelling', 'arrived', 'checked_in', 'work_started',
  'waiting_parts', 'work_resumed', 'completed', 'customer_confirmed',
  'follow_up_required', 'escalated', 'sla_breached', 'rescheduled',
];

const STATUS_LABEL: Record<VisitStatus, string> = {
  draft: 'Draft',
  assigned: 'Assigned',
  accepted: 'Accepted',
  travelling: 'Travelling',
  arrived: 'Arrived',
  checked_in: 'Checked In',
  work_started: 'Work Started',
  waiting_parts: 'Waiting Parts',
  work_resumed: 'Work Resumed',
  completed: 'Completed',
  customer_confirmed: 'Customer Confirmed',
  closed: 'Closed',
  rescheduled: 'Rescheduled',
  engineer_rejected: 'Engineer Rejected',
  customer_unavailable: 'Customer Unavailable',
  cancelled: 'Cancelled',
  follow_up_required: 'Follow-up Required',
  escalated: 'Escalated',
  sla_breached: 'SLA Breached',
};

const STATUS_COLOR: Record<VisitStatus, string> = {
  draft: '#8E8E93', assigned: '#0A84FF', accepted: '#5856D6', travelling: '#007AFF',
  arrived: '#30B0C7', checked_in: '#32ADE6', work_started: '#1A237E', waiting_parts: '#FF9500',
  work_resumed: '#1A237E', completed: '#34C759', customer_confirmed: '#2E7D32', closed: '#2E7D32',
  rescheduled: '#BF5AF2', engineer_rejected: '#FF3B30', customer_unavailable: '#FF9F0A',
  cancelled: '#8E8E93', follow_up_required: '#AF52DE', escalated: '#FF453A', sla_breached: '#D70015',
};

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const radius = 6_371_000;
  const toRad = (value: number) => value * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * radius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDateTime(value?: string | null): string {
  if (!value) return 'Not set';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function actionFor(status: VisitStatus): { label: string; icon: keyof typeof Feather.glyphMap; next: VisitStatus } | null {
  switch (status) {
    case 'assigned': return { label: 'Accept Job', icon: 'check-circle', next: 'accepted' };
    case 'accepted': return { label: 'Start Travel', icon: 'navigation', next: 'travelling' };
    case 'travelling': return { label: 'Mark Arrived', icon: 'map-pin', next: 'arrived' };
    case 'arrived': return { label: 'GPS Check-in', icon: 'crosshair', next: 'checked_in' };
    case 'checked_in': return { label: 'Start Work', icon: 'play-circle', next: 'work_started' };
    case 'waiting_parts': return { label: 'Resume Work', icon: 'play', next: 'work_resumed' };
    case 'work_started':
    case 'work_resumed': return { label: 'Complete Work', icon: 'flag', next: 'completed' };
    case 'completed': return { label: 'Customer Confirm', icon: 'user-check', next: 'customer_confirmed' };
    case 'customer_confirmed': return { label: 'Close Visit', icon: 'archive', next: 'closed' };
    case 'rescheduled': return { label: 'Assign Again', icon: 'calendar', next: 'assigned' };
    default: return null;
  }
}

export default function FieldOperationsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { currentUser } = useApp();
  const [visits, setVisits] = useState<CustomerVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'active' | 'all'>('active');

  const isManager = ['admin', 'manager', 'service_control'].includes(currentUser?.role ?? '');
  const bottomPadding = insets.bottom + (Platform.OS === 'web' ? 34 : 0) + 30;

  const load = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const data = await listCustomerVisits({
        engineerId: isManager ? undefined : currentUser.id,
        statuses: filter === 'active' ? ACTIVE_STATUSES : undefined,
        limit: 200,
      });
      setVisits(data);
    } catch (error) {
      Alert.alert('Field Operations', error instanceof Error ? error.message : 'Visits could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [currentUser, filter, isManager]);

  useEffect(() => { void load(); }, [load]);

  const counts = useMemo(() => ({
    travelling: visits.filter(item => item.status === 'travelling').length,
    onSite: visits.filter(item => ['arrived', 'checked_in', 'work_started', 'work_resumed'].includes(item.status)).length,
    waitingParts: visits.filter(item => item.status === 'waiting_parts').length,
    breached: visits.filter(item => item.status === 'sla_breached' || (item.sla_due_at && new Date(item.sla_due_at).getTime() < Date.now() && !['completed', 'customer_confirmed', 'closed'].includes(item.status))).length,
  }), [visits]);

  const transition = async (visit: CustomerVisit, next: VisitStatus) => {
    if (!currentUser || workingId) return;
    setWorkingId(visit.id);
    try {
      const deviceId = await getInstallationId();
      let location: Awaited<ReturnType<typeof getCurrentFieldPosition>> | null = null;

      if (['travelling', 'arrived', 'checked_in', 'work_started', 'completed'].includes(next)) {
        location = await getCurrentFieldPosition();
      }

      if (next === 'checked_in') {
        if (visit.service_latitude == null || visit.service_longitude == null) {
          throw new Error('Customer geofence coordinates are not configured. Admin must update the visit location.');
        }
        if (!location) throw new Error('Current location is unavailable.');
        const distance = haversineMeters(
          visit.service_latitude,
          visit.service_longitude,
          location.coords.latitude,
          location.coords.longitude,
        );
        if ((location.coords.accuracy ?? 9999) > 100) {
          throw new Error(`GPS accuracy is too low (${Math.round(location.coords.accuracy ?? 0)} m). Move outdoors and retry.`);
        }
        if (distance > visit.checkin_radius_m) {
          throw new Error(`You are ${Math.round(distance)} m from the customer site. Allowed radius is ${visit.checkin_radius_m} m.`);
        }
      }

      await transitionCustomerVisit({
        visitId: visit.id,
        newStatus: next,
        latitude: location?.coords.latitude,
        longitude: location?.coords.longitude,
        accuracyM: location?.coords.accuracy ?? undefined,
        deviceId,
        idempotencyKey: `${visit.id}:${next}:${Date.now()}`,
      });

      if (next === 'travelling') {
        if (!location) throw new Error('Current location is unavailable.');
        const sessionId = await startTrackingSession({
          visitId: visit.id,
          deviceId,
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
        await startFieldLocationTracking({
          sessionId,
          visitId: visit.id,
          userId: currentUser.id,
          deviceId,
        });
      }

      if (['completed', 'customer_confirmed', 'closed', 'cancelled'].includes(next)) {
        const active = await getActiveTrackingState();
        if (active?.visitId === visit.id) {
          await stopFieldLocationTracking();
          try {
            await stopTrackingSession({
              sessionId: active.sessionId,
              latitude: location?.coords.latitude,
              longitude: location?.coords.longitude,
            });
          } catch {
            // Local foreground service must still stop when the network is unavailable.
          }
        }
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await load();
    } catch (error) {
      Alert.alert('Action Failed', error instanceof Error ? error.message : 'The visit could not be updated.');
    } finally {
      setWorkingId(null);
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 16, paddingTop: Platform.OS === 'web' ? 24 : 12, paddingBottom: bottomPadding, gap: 14 }}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.hero, { backgroundColor: colors.primary }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.heroEyebrow}>COLORJET ENGINEER OPERATIONS</Text>
          <Text style={styles.heroTitle}>{isManager ? 'Live Field Control' : 'My Customer Visits'}</Text>
          <Text style={styles.heroSub}>Authorized travel tracking, GPS check-in, SLA and service workflow</Text>
        </View>
        <Feather name="activity" size={30} color="#fff" />
      </View>

      <View style={styles.kpiGrid}>
        {[
          ['navigation', 'Travelling', counts.travelling, '#007AFF'],
          ['map-pin', 'On Site', counts.onSite, '#30B0C7'],
          ['package', 'Waiting Parts', counts.waitingParts, '#FF9500'],
          ['alert-triangle', 'SLA Risk', counts.breached, '#D70015'],
        ].map(([icon, label, value, color]) => (
          <View key={String(label)} style={[styles.kpi, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name={icon as keyof typeof Feather.glyphMap} size={18} color={String(color)} />
            <Text style={[styles.kpiValue, { color: colors.foreground }]}>{String(value)}</Text>
            <Text style={[styles.kpiLabel, { color: colors.mutedForeground }]}>{String(label)}</Text>
          </View>
        ))}
      </View>

      <View style={styles.filterRow}>
        {(['active', 'all'] as const).map(item => (
          <TouchableOpacity
            key={item}
            style={[styles.filter, { backgroundColor: filter === item ? colors.primary : colors.card, borderColor: filter === item ? colors.primary : colors.border }]}
            onPress={() => setFilter(item)}
          >
            <Text style={[styles.filterText, { color: filter === item ? '#fff' : colors.mutedForeground }]}>{item === 'active' ? 'Active Visits' : 'All Visits'}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {!loading && visits.length === 0 ? (
        <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="calendar" size={28} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No visits found</Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Assigned customer visits will appear here after the V12 database migration is deployed.</Text>
        </View>
      ) : null}

      {visits.map(visit => {
        const action = actionFor(visit.status);
        const overdue = Boolean(visit.sla_due_at && new Date(visit.sla_due_at).getTime() < Date.now() && !['completed', 'customer_confirmed', 'closed'].includes(visit.status));
        return (
          <View key={visit.id} style={[styles.card, { backgroundColor: colors.card, borderColor: overdue ? '#D70015' : colors.border }]}>
            <View style={styles.cardTop}>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={[styles.visitNo, { color: colors.mutedForeground }]}>{visit.visit_no}</Text>
                <Text style={[styles.customer, { color: colors.foreground }]}>{visit.customer_name}</Text>
                <Text style={[styles.address, { color: colors.mutedForeground }]} numberOfLines={2}>{visit.service_address}</Text>
              </View>
              <View style={[styles.status, { backgroundColor: STATUS_COLOR[visit.status] + '20' }]}>
                <Text style={[styles.statusText, { color: STATUS_COLOR[visit.status] }]}>{STATUS_LABEL[visit.status]}</Text>
              </View>
            </View>

            <View style={[styles.metaBox, { backgroundColor: colors.background }]}>
              <View style={styles.metaLine}><Feather name="calendar" size={13} color={colors.mutedForeground} /><Text style={[styles.metaText, { color: colors.mutedForeground }]}>{formatDateTime(visit.schedule_start)}</Text></View>
              <View style={styles.metaLine}><Feather name="clock" size={13} color={overdue ? '#D70015' : colors.mutedForeground} /><Text style={[styles.metaText, { color: overdue ? '#D70015' : colors.mutedForeground }]}>SLA: {formatDateTime(visit.sla_due_at)}</Text></View>
              {visit.customer_phone ? <View style={styles.metaLine}><Feather name="phone" size={13} color={colors.mutedForeground} /><Text style={[styles.metaText, { color: colors.mutedForeground }]}>{visit.customer_phone}</Text></View> : null}
            </View>

            <View style={styles.actions}>
              {action ? (
                <TouchableOpacity
                  style={[styles.primaryAction, { backgroundColor: colors.primary, opacity: workingId === visit.id ? 0.6 : 1 }]}
                  disabled={workingId !== null}
                  onPress={() => void transition(visit, action.next)}
                >
                  <Feather name={action.icon} size={15} color="#fff" />
                  <Text style={styles.primaryActionText}>{workingId === visit.id ? 'Processing…' : action.label}</Text>
                </TouchableOpacity>
              ) : null}
              {['work_started', 'work_resumed'].includes(visit.status) ? (
                <TouchableOpacity style={[styles.secondaryAction, { borderColor: '#FF9500' }]} onPress={() => void transition(visit, 'waiting_parts')} disabled={workingId !== null}>
                  <Feather name="package" size={15} color="#FF9500" />
                  <Text style={[styles.secondaryActionText, { color: '#FF9500' }]}>Waiting Parts</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity style={[styles.secondaryAction, { borderColor: colors.border }]} onPress={() => router.push({ pathname: '/route-history', params: { visitId: visit.id } } as any)}>
                <Feather name="map" size={15} color={colors.primary} />
                <Text style={[styles.secondaryActionText, { color: colors.primary }]}>Route</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: 16, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 14 },
  heroEyebrow: { color: 'rgba(255,255,255,0.72)', fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 1 },
  heroTitle: { color: '#fff', fontSize: 22, fontFamily: 'Inter_700Bold', marginTop: 4 },
  heroSub: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 4, lineHeight: 17 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kpi: { width: '48.5%', borderRadius: 12, borderWidth: 1, padding: 13, gap: 3 },
  kpiValue: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  kpiLabel: { fontSize: 11, fontFamily: 'Inter_500Medium' },
  filterRow: { flexDirection: 'row', gap: 8 },
  filter: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8 },
  filterText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  empty: { borderRadius: 14, borderWidth: 1, padding: 28, alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  emptyText: { fontSize: 12, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 18 },
  card: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 12 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  visitNo: { fontSize: 10, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.4 },
  customer: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  address: { fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 17 },
  status: { borderRadius: 12, paddingHorizontal: 9, paddingVertical: 5 },
  statusText: { fontSize: 10, fontFamily: 'Inter_700Bold' },
  metaBox: { borderRadius: 10, padding: 10, gap: 7 },
  metaLine: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  metaText: { fontSize: 11, fontFamily: 'Inter_400Regular', flex: 1 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  primaryAction: { borderRadius: 9, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 7 },
  primaryActionText: { color: '#fff', fontSize: 12, fontFamily: 'Inter_700Bold' },
  secondaryAction: { borderRadius: 9, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 7 },
  secondaryActionText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
});
