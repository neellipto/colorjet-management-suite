import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Platform, RefreshControl, ScrollView, StyleSheet, Text,
  TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import {
  type ServiceCase,
  type SlaAlert,
  acknowledgeSlaAlert,
  listServiceCases,
  listSlaAlerts,
  refreshSlaAlerts,
} from '@/lib/v13BusinessOperations';

const SEVERITY_COLOR: Record<SlaAlert['severity'], string> = {
  warning: '#FF9500', near_breach: '#FF6B00', breached: '#D70015', critical: '#8B0000',
};

function remaining(target: string): string {
  const diff = new Date(target).getTime() - Date.now();
  const absoluteMinutes = Math.floor(Math.abs(diff) / 60_000);
  const hours = Math.floor(absoluteMinutes / 60);
  const minutes = absoluteMinutes % 60;
  return `${diff < 0 ? 'Overdue' : 'Remaining'} ${hours}h ${minutes}m`;
}

function fmt(value?: string | null): string {
  if (!value) return 'Not set';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export default function SlaDashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { currentUser, engineers } = useApp();
  const [cases, setCases] = useState<ServiceCase[]>([]);
  const [alerts, setAlerts] = useState<SlaAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'open' | 'breached' | 'all'>('open');
  const pb = insets.bottom + (Platform.OS === 'web' ? 34 : 0) + 24;

  const role = currentUser?.role ?? 'customer';
  const canManage = ['admin', 'manager', 'service_control'].includes(role);

  const load = useCallback(async (runRefresh = false) => {
    setLoading(true);
    try {
      if (runRefresh && canManage) await refreshSlaAlerts();
      const [caseRows, alertRows] = await Promise.all([listServiceCases(), listSlaAlerts()]);
      setCases(caseRows);
      setAlerts(alertRows);
    } catch (error) {
      Alert.alert('SLA Dashboard', error instanceof Error ? error.message : 'SLA data could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [canManage]);

  useEffect(() => { void load(false); }, [load]);

  const openAlerts = useMemo(() => alerts.filter(item => !item.resolved_at), [alerts]);
  const visibleAlerts = useMemo(() => {
    const rows = canManage
      ? alerts
      : alerts.filter(alert => cases.find(item => item.id === alert.service_case_id)?.assigned_engineer_id === currentUser?.id);
    if (filter === 'open') return rows.filter(item => !item.resolved_at);
    if (filter === 'breached') return rows.filter(item => ['breached', 'critical'].includes(item.severity) && !item.resolved_at);
    return rows;
  }, [alerts, canManage, cases, currentUser?.id, filter]);

  const stats = useMemo(() => ({
    warning: openAlerts.filter(item => item.severity === 'warning').length,
    near: openAlerts.filter(item => item.severity === 'near_breach').length,
    breached: openAlerts.filter(item => item.severity === 'breached').length,
    critical: openAlerts.filter(item => item.severity === 'critical').length,
  }), [openAlerts]);

  const acknowledge = async (alert: SlaAlert) => {
    setWorkingId(alert.id);
    try {
      await acknowledgeSlaAlert(alert.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await load(false);
    } catch (error) {
      Alert.alert('SLA Alert', error instanceof Error ? error.message : 'Alert could not be acknowledged.');
    } finally {
      setWorkingId(null);
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 16, paddingTop: Platform.OS === 'web' ? 24 : 12, paddingBottom: pb, gap: 13 }}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => load(canManage)} />}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.hero, { backgroundColor: colors.primary }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.heroEyebrow}>COLORJET ENGINEER SLA CONTROL</Text>
          <Text style={styles.heroTitle}>Response & Resolution Monitor</Text>
          <Text style={styles.heroSub}>Response, arrival and resolution deadlines with escalation audit</Text>
        </View>
        <Feather name="clock" size={30} color="#fff" />
      </View>

      <View style={styles.kpiGrid}>
        {[
          ['alert-circle', 'Warning', stats.warning, '#FF9500'],
          ['clock', 'Near Breach', stats.near, '#FF6B00'],
          ['alert-triangle', 'Breached', stats.breached, '#D70015'],
          ['zap', 'Critical', stats.critical, '#8B0000'],
        ].map(([icon, label, value, color]) => (
          <View key={String(label)} style={[styles.kpi, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name={icon as keyof typeof Feather.glyphMap} size={17} color={String(color)} />
            <Text style={[styles.kpiValue, { color: colors.foreground }]}>{String(value)}</Text>
            <Text style={[styles.kpiLabel, { color: colors.mutedForeground }]}>{String(label)}</Text>
          </View>
        ))}
      </View>

      {canManage ? (
        <TouchableOpacity style={[styles.refreshButton, { backgroundColor: colors.primary }]} onPress={() => void load(true)} disabled={loading}>
          <Feather name="refresh-cw" size={15} color="#fff" />
          <Text style={styles.refreshText}>Run SLA Evaluation Now</Text>
        </TouchableOpacity>
      ) : null}

      <View style={styles.filterRow}>
        {(['open', 'breached', 'all'] as const).map(value => (
          <TouchableOpacity key={value} style={[styles.filter, { backgroundColor: filter === value ? colors.primary : colors.card, borderColor: filter === value ? colors.primary : colors.border }]} onPress={() => setFilter(value)}>
            <Text style={[styles.filterText, { color: filter === value ? '#fff' : colors.foreground }]}>{value === 'open' ? 'Open Alerts' : value === 'breached' ? 'Breached' : 'All History'}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {!loading && visibleAlerts.length === 0 ? (
        <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="check-circle" size={28} color="#34C759" />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No matching SLA alerts</Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Current service cases are within the selected SLA view.</Text>
        </View>
      ) : null}

      {visibleAlerts.map(alert => {
        const serviceCase = cases.find(item => item.id === alert.service_case_id);
        const engineer = engineers.find(item => item.userId === serviceCase?.assigned_engineer_id || item.id === serviceCase?.assigned_engineer_id);
        const color = SEVERITY_COLOR[alert.severity];
        const acknowledged = Boolean(alert.acknowledged_at);
        return (
          <View key={alert.id} style={[styles.card, { backgroundColor: colors.card, borderColor: color }]}>
            <View style={styles.cardTop}>
              <View style={[styles.iconBox, { backgroundColor: `${color}18` }]}><Feather name="alert-triangle" size={18} color={color} /></View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.caseNo, { color: colors.mutedForeground }]}>{serviceCase?.case_no || alert.service_case_id}</Text>
                <Text style={[styles.message, { color: colors.foreground }]}>{alert.message}</Text>
                <Text style={[styles.customer, { color: colors.mutedForeground }]}>{serviceCase?.customer_name || 'Service case'} · {engineer?.name || 'Unassigned'}</Text>
              </View>
              <View style={[styles.severity, { backgroundColor: `${color}18` }]}><Text style={[styles.severityText, { color }]}>{alert.severity.replaceAll('_', ' ')}</Text></View>
            </View>
            <View style={[styles.metaBox, { backgroundColor: colors.background }]}>
              <Text style={[styles.meta, { color }]}>Target: {fmt(alert.target_at)} · {remaining(alert.target_at)}</Text>
              <Text style={[styles.meta, { color: colors.mutedForeground }]}>Metric: {alert.metric} · Case status: {serviceCase?.status?.replaceAll('_', ' ') || 'Unknown'}</Text>
              <Text style={[styles.meta, { color: colors.mutedForeground }]}>Detected: {fmt(alert.detected_at)}{acknowledged ? ` · Acknowledged ${fmt(alert.acknowledged_at)}` : ''}</Text>
            </View>
            {!alert.resolved_at && !acknowledged && canManage ? (
              <TouchableOpacity style={[styles.ackButton, { borderColor: colors.primary }]} onPress={() => void acknowledge(alert)} disabled={workingId !== null}>
                <Feather name="check" size={14} color={colors.primary} />
                <Text style={[styles.ackText, { color: colors.primary }]}>{workingId === alert.id ? 'Acknowledging…' : 'Acknowledge Alert'}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: 16, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 14 },
  heroEyebrow: { color: 'rgba(255,255,255,0.72)', fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 1 },
  heroTitle: { color: '#fff', fontSize: 21, fontFamily: 'Inter_700Bold', marginTop: 4 },
  heroSub: { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 4 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kpi: { width: '48.5%', borderRadius: 12, borderWidth: 1, padding: 12, gap: 3 },
  kpiValue: { fontSize: 19, fontFamily: 'Inter_700Bold' },
  kpiLabel: { fontSize: 10, fontFamily: 'Inter_500Medium' },
  refreshButton: { borderRadius: 10, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  refreshText: { color: '#fff', fontSize: 12, fontFamily: 'Inter_700Bold' },
  filterRow: { flexDirection: 'row', gap: 7 },
  filter: { flex: 1, borderWidth: 1, borderRadius: 9, paddingVertical: 9, alignItems: 'center' },
  filterText: { fontSize: 10, fontFamily: 'Inter_700Bold' },
  empty: { borderWidth: 1, borderRadius: 13, padding: 28, alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  emptyText: { fontSize: 11, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  card: { borderWidth: 1, borderRadius: 13, padding: 13, gap: 10 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  iconBox: { width: 36, height: 36, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  caseNo: { fontSize: 9, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.4 },
  message: { fontSize: 13, fontFamily: 'Inter_700Bold', marginTop: 2, lineHeight: 18 },
  customer: { fontSize: 10, fontFamily: 'Inter_400Regular', marginTop: 3 },
  severity: { borderRadius: 11, paddingHorizontal: 8, paddingVertical: 5 },
  severityText: { fontSize: 8, fontFamily: 'Inter_700Bold', textTransform: 'uppercase' },
  metaBox: { borderRadius: 9, padding: 9, gap: 4 },
  meta: { fontSize: 10, fontFamily: 'Inter_400Regular', lineHeight: 15 },
  ackButton: { borderWidth: 1, borderRadius: 9, paddingVertical: 9, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
  ackText: { fontSize: 11, fontFamily: 'Inter_700Bold' },
});
