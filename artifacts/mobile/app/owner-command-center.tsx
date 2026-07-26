import { Feather } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useErpRuntime } from '@/context/ErpRuntimeContext';
import {
  fetchDailyExecutiveBrief,
  fetchOwnerCommandCenter,
  type DailyExecutiveBrief,
  type DashboardPayload,
  type KpiValue,
} from '@/lib/dashboardApi';
import { useColors } from '@/hooks/useColors';

function valueOf(kpi: KpiValue): string {
  if (kpi.formattedValue) return kpi.formattedValue;
  if (kpi.value === null || kpi.value === undefined) return '—';
  return String(kpi.value);
}

function KpiCard({ item }: { item: KpiValue }) {
  const colors = useColors();
  const trendIcon = item.trend === 'up' ? 'trending-up' : item.trend === 'down' ? 'trending-down' : 'minus';
  return (
    <View style={[styles.kpiCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.kpiHeader}>
        <Text style={[styles.kpiLabel, { color: colors.mutedForeground }]} numberOfLines={2}>{item.label}</Text>
        <Feather name={trendIcon} size={16} color={item.trend === 'down' ? colors.destructive : colors.primary} />
      </View>
      <Text style={[styles.kpiValue, { color: colors.foreground }]}>{valueOf(item)}</Text>
      <Text style={[styles.kpiSource, { color: colors.mutedForeground }]} numberOfLines={1}>
        {item.dataFreshness ? `Updated ${item.dataFreshness}` : item.source}
      </Text>
    </View>
  );
}

export default function OwnerCommandCenterScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { authenticated, permissions, refreshIdentity } = useErpRuntime();
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [brief, setBrief] = useState<DailyExecutiveBrief | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allowed = Boolean(authenticated && permissions?.isOwner);

  const load = useCallback(async () => {
    if (!allowed) return;
    setLoading(true);
    setError(null);
    try {
      const [dashboardResult, briefResult] = await Promise.all([
        fetchOwnerCommandCenter({ periodPreset: 'this_month' }),
        fetchDailyExecutiveBrief({ language: 'bilingual' }),
      ]);
      setDashboard(dashboardResult);
      setBrief(briefResult);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load Owner Command Center.');
    } finally {
      setLoading(false);
    }
  }, [allowed]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!allowed) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <Feather name="lock" size={34} color={colors.mutedForeground} />
        <Text style={[styles.lockTitle, { color: colors.foreground }]}>Owner access required</Text>
        <Text style={[styles.lockText, { color: colors.mutedForeground }]}>This dashboard requires an active ERP Owner session and server-confirmed permission.</Text>
        <TouchableOpacity style={[styles.button, { backgroundColor: colors.primary }]} onPress={() => void refreshIdentity()}>
          <Text style={styles.buttonText}>Refresh authorization</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingTop: insets.top + 14, paddingBottom: insets.bottom + 24, paddingHorizontal: 16, gap: 16 }}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
    >
      <View style={styles.titleRow}>
        <View>
          <Text style={[styles.eyebrow, { color: colors.primary }]}>COLORJET Bangladesh</Text>
          <Text style={[styles.title, { color: colors.foreground }]}>Owner Command Center</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Quality • Commitment • Service</Text>
        </View>
        {loading && <ActivityIndicator color={colors.primary} />}
      </View>

      {error && (
        <View style={[styles.errorBox, { borderColor: colors.destructive, backgroundColor: colors.card }]}>
          <Text style={{ color: colors.destructive }}>{error}</Text>
        </View>
      )}

      <View style={styles.kpiGrid}>
        {(dashboard?.kpis ?? []).map(item => <KpiCard key={item.code} item={item} />)}
      </View>

      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Daily Executive Brief</Text>
        <Text style={[styles.sectionMeta, { color: colors.mutedForeground }]}>{brief?.date ?? 'Latest available data'}</Text>
        {(brief?.risks ?? []).slice(0, 8).map((risk, index) => (
          <View key={`${risk.title}-${index}`} style={styles.listRow}>
            <Feather name={risk.severity === 'critical' ? 'alert-octagon' : 'alert-triangle'} size={16} color={risk.severity === 'critical' ? colors.destructive : colors.secondary} />
            <View style={styles.listText}>
              <Text style={[styles.listTitle, { color: colors.foreground }]}>{risk.title}</Text>
              <Text style={[styles.listDetail, { color: colors.mutedForeground }]}>{risk.detail}</Text>
            </View>
          </View>
        ))}
        {!brief?.risks?.length && !loading && (
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No source-backed risk alert returned.</Text>
        )}
      </View>

      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Recommended Owner Actions</Text>
        {(brief?.recommendedActions ?? []).slice(0, 8).map((action, index) => (
          <View key={`${action.title}-${index}`} style={styles.listRow}>
            <Feather name="check-circle" size={16} color={colors.primary} />
            <View style={styles.listText}>
              <Text style={[styles.listTitle, { color: colors.foreground }]}>{action.title}</Text>
              <Text style={[styles.listDetail, { color: colors.mutedForeground }]}>{action.detail}</Text>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, gap: 12 },
  lockTitle: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  lockText: { fontSize: 14, lineHeight: 21, textAlign: 'center', fontFamily: 'Inter_400Regular' },
  button: { paddingHorizontal: 18, paddingVertical: 12, borderRadius: 10, marginTop: 6 },
  buttonText: { color: '#fff', fontFamily: 'Inter_600SemiBold' },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eyebrow: { fontSize: 12, fontFamily: 'Inter_600SemiBold', textTransform: 'uppercase', letterSpacing: 0.5 },
  title: { fontSize: 25, fontFamily: 'Inter_700Bold', marginTop: 2 },
  subtitle: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 3 },
  errorBox: { borderWidth: 1, borderRadius: 10, padding: 12 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  kpiCard: { width: '48.5%', minHeight: 116, borderWidth: 1, borderRadius: 14, padding: 13, justifyContent: 'space-between' },
  kpiHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  kpiLabel: { flex: 1, fontSize: 12, fontFamily: 'Inter_500Medium' },
  kpiValue: { fontSize: 21, fontFamily: 'Inter_700Bold', marginVertical: 8 },
  kpiSource: { fontSize: 10, fontFamily: 'Inter_400Regular' },
  section: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 10 },
  sectionTitle: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  sectionMeta: { fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: -6 },
  listRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 5 },
  listText: { flex: 1, gap: 2 },
  listTitle: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  listDetail: { fontSize: 12, lineHeight: 17, fontFamily: 'Inter_400Regular' },
  emptyText: { fontSize: 13, fontFamily: 'Inter_400Regular', paddingVertical: 8 },
});
