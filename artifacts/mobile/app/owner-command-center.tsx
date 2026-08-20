import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
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

function reportTarget(item: KpiValue): { code: string; filters: Record<string, unknown> } | null {
  const drillDown = item.drillDown;
  if (!drillDown?.route || item.permissionResult !== 'allowed') return null;

  try {
    const url = new URL(drillDown.route, 'https://colorjet.local');
    const segments = url.pathname.split('/').filter(Boolean);
    const reportsIndex = segments.indexOf('reports');
    const code = reportsIndex >= 0 ? segments.slice(reportsIndex + 1).join('/') : segments.at(-1) ?? '';
    if (!code) return null;

    const filters: Record<string, unknown> = { ...(drillDown.filters ?? {}) };
    url.searchParams.forEach((value, key) => {
      if (key === 'period') {
        const aliases: Record<string, string> = {
          current_month: 'this_month',
          current_week: 'this_week',
          current_year: 'year',
        };
        filters.periodPreset = aliases[value] ?? value;
      } else {
        filters[key] = value;
      }
    });
    return { code, filters };
  } catch {
    return null;
  }
}

function KpiCard({ item }: { item: KpiValue }) {
  const colors = useColors();
  const trendIcon = item.trend === 'up' ? 'trending-up' : item.trend === 'down' ? 'trending-down' : 'minus';
  const target = reportTarget(item);
  const disabled = !target;

  const openReport = () => {
    if (!target) return;
    router.push({
      pathname: '/report',
      params: {
        code: target.code,
        title: item.label,
        filters: JSON.stringify(target.filters),
      },
    } as never);
  };

  return (
    <TouchableOpacity
      activeOpacity={0.78}
      disabled={disabled}
      onPress={openReport}
      style={[
        styles.kpiCard,
        {
          backgroundColor: colors.card,
          borderColor: disabled ? colors.border : colors.primary,
          borderLeftColor: item.permissionResult === 'redacted' ? colors.secondary : colors.primary,
          opacity: item.permissionResult === 'denied' ? 0.55 : 1,
        },
      ]}
    >
      <View style={styles.kpiHeader}>
        <Text style={[styles.kpiLabel, { color: colors.mutedForeground }]} numberOfLines={2}>{item.label}</Text>
        <Feather
          name={item.permissionResult === 'allowed' ? trendIcon : 'lock'}
          size={16}
          color={item.trend === 'down' ? colors.destructive : colors.primary}
        />
      </View>
      <Text style={[styles.kpiValue, { color: colors.foreground }]}>{valueOf(item)}</Text>
      <View style={styles.kpiFooter}>
        <Text style={[styles.kpiSource, { color: colors.mutedForeground }]} numberOfLines={1}>
          {item.dataFreshness ? `Updated ${item.dataFreshness}` : item.source}
        </Text>
        {target && <Feather name="arrow-up-right" size={14} color={colors.primary} />}
      </View>
    </TouchableOpacity>
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

      {!dashboard?.kpis?.length && !loading && !error && (
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}> 
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No source-backed KPI returned by the ERP.</Text>
        </View>
      )}

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
          <TouchableOpacity
            activeOpacity={action.route ? 0.78 : 1}
            disabled={!action.route}
            onPress={() => action.route && router.push(action.route as never)}
            key={`${action.title}-${index}`}
            style={styles.listRow}
          >
            <Feather name="check-circle" size={16} color={colors.primary} />
            <View style={styles.listText}>
              <Text style={[styles.listTitle, { color: colors.foreground }]}>{action.title}</Text>
              <Text style={[styles.listDetail, { color: colors.mutedForeground }]}>{action.detail}</Text>
            </View>
            {action.route && <Feather name="chevron-right" size={16} color={colors.primary} />}
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, gap: 12 },
  lockTitle: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  lockText: { fontSize: 14, lineHeight: 21, textAlign: 'center', fontFamily: 'Inter_500Medium' },
  button: { minHeight: 44, paddingHorizontal: 18, borderRadius: 10, marginTop: 6, justifyContent: 'center' },
  buttonText: { color: '#fff', fontFamily: 'Inter_700Bold' },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eyebrow: { fontSize: 12, fontFamily: 'Inter_700Bold', textTransform: 'uppercase', letterSpacing: 0.5 },
  title: { fontSize: 25, fontFamily: 'Inter_700Bold', marginTop: 2 },
  subtitle: { fontSize: 12, fontFamily: 'Inter_500Medium', marginTop: 3 },
  errorBox: { borderWidth: 1, borderRadius: 10, padding: 12 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  kpiCard: { flexBasis: '47%', flexGrow: 1, minHeight: 122, borderWidth: 1, borderLeftWidth: 4, borderRadius: 14, padding: 13, justifyContent: 'space-between' },
  kpiHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  kpiLabel: { flex: 1, fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  kpiValue: { fontSize: 21, fontFamily: 'Inter_700Bold', marginVertical: 8 },
  kpiFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  kpiSource: { flex: 1, fontSize: 10, fontFamily: 'Inter_500Medium' },
  section: { borderWidth: 1, borderLeftWidth: 4, borderLeftColor: '#0D47A1', borderRadius: 14, padding: 14, gap: 10 },
  sectionTitle: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  sectionMeta: { fontSize: 11, fontFamily: 'Inter_500Medium', marginTop: -6 },
  listRow: { minHeight: 44, flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 6 },
  listText: { flex: 1, gap: 2 },
  listTitle: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  listDetail: { fontSize: 12, lineHeight: 17, fontFamily: 'Inter_500Medium' },
  emptyText: { fontSize: 13, fontFamily: 'Inter_500Medium', paddingVertical: 8 },
});
