import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Linking, Platform, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import {
  type LocationPoint,
  type TrackingSession,
  getCustomerVisit,
  listRoutePoints,
  listTrackingSessions,
} from '@/lib/v12EngineerOperations';

function distanceMeters(a: LocationPoint, b: LocationPoint): number {
  const radius = 6_371_000;
  const toRad = (value: number) => value * Math.PI / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * radius * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function totalPointDistance(points: LocationPoint[]): number {
  return points.reduce((sum, point, index) => index === 0 ? 0 : sum + distanceMeters(points[index - 1], point), 0);
}

function formatDuration(start: string, end?: string | null): string {
  const milliseconds = Math.max(0, new Date(end ?? Date.now()).getTime() - new Date(start).getTime());
  const minutes = Math.floor(milliseconds / 60_000);
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${hours}h ${remainder}m`;
}

function formatDistance(value: number): string {
  return value >= 1000 ? `${(value / 1000).toFixed(2)} km` : `${Math.round(value)} m`;
}

export default function RouteHistoryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { visitId } = useLocalSearchParams<{ visitId?: string }>();
  const [visitName, setVisitName] = useState('Customer Visit');
  const [sessions, setSessions] = useState<TrackingSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [points, setPoints] = useState<LocationPoint[]>([]);
  const [loading, setLoading] = useState(true);

  const bottomPadding = insets.bottom + (Platform.OS === 'web' ? 34 : 0) + 24;

  const load = useCallback(async () => {
    if (!visitId) return;
    setLoading(true);
    try {
      const [visit, sessionRows] = await Promise.all([
        getCustomerVisit(visitId),
        listTrackingSessions(visitId),
      ]);
      setVisitName(visit.customer_name);
      setSessions(sessionRows);
      const sessionId = selectedSessionId && sessionRows.some(item => item.id === selectedSessionId)
        ? selectedSessionId
        : sessionRows[0]?.id ?? null;
      setSelectedSessionId(sessionId);
      setPoints(sessionId ? await listRoutePoints(sessionId) : []);
    } catch (error) {
      Alert.alert('Route History', error instanceof Error ? error.message : 'Route history could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [selectedSessionId, visitId]);

  useEffect(() => { void load(); }, [visitId]);

  const selectSession = async (sessionId: string) => {
    setSelectedSessionId(sessionId);
    setLoading(true);
    try {
      setPoints(await listRoutePoints(sessionId));
    } catch (error) {
      Alert.alert('Route History', error instanceof Error ? error.message : 'Route points could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  const selected = sessions.find(item => item.id === selectedSessionId) ?? null;
  const calculatedDistance = useMemo(() => totalPointDistance(points), [points]);
  const routeDistance = Number(selected?.total_distance_m ?? 0) || calculatedDistance;
  const first = points[0];
  const last = points[points.length - 1];
  const mockCount = points.filter(point => point.is_mock).length;
  const lowAccuracyCount = points.filter(point => (point.accuracy_m ?? 9999) > 100).length;

  const openPoint = async (point?: LocationPoint) => {
    if (!point) return;
    const url = Platform.select({
      ios: `maps:0,0?q=${point.latitude},${point.longitude}`,
      android: `geo:${point.latitude},${point.longitude}?q=${point.latitude},${point.longitude}`,
      default: `https://www.google.com/maps/search/?api=1&query=${point.latitude},${point.longitude}`,
    });
    if (url) await Linking.openURL(url);
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 16, paddingBottom: bottomPadding, gap: 14 }}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.hero, { backgroundColor: colors.primary }]}>
        <Feather name="map" size={28} color="#fff" />
        <View style={{ flex: 1 }}>
          <Text style={styles.heroEyebrow}>ROUTE AUDIT HISTORY</Text>
          <Text style={styles.heroTitle}>{visitName}</Text>
          <Text style={styles.heroSub}>Server timestamps, GPS accuracy and mock-location indicators</Text>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {sessions.map((session, index) => (
          <TouchableOpacity
            key={session.id}
            style={[styles.sessionChip, { backgroundColor: selectedSessionId === session.id ? colors.primary : colors.card, borderColor: selectedSessionId === session.id ? colors.primary : colors.border }]}
            onPress={() => void selectSession(session.id)}
          >
            <Text style={[styles.sessionChipText, { color: selectedSessionId === session.id ? '#fff' : colors.foreground }]}>Trip {sessions.length - index}</Text>
            <Text style={[styles.sessionChipSub, { color: selectedSessionId === session.id ? 'rgba(255,255,255,0.75)' : colors.mutedForeground }]}>{session.status}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {!selected ? (
        <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="navigation" size={28} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No tracked route</Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>A route appears after the engineer explicitly starts travel in the Android app.</Text>
        </View>
      ) : (
        <>
          <View style={styles.kpiGrid}>
            {[
              ['Distance', formatDistance(routeDistance)],
              ['Duration', formatDuration(selected.started_at, selected.ended_at)],
              ['GPS Points', String(points.length)],
              ['Mock Flags', String(mockCount)],
            ].map(([label, value]) => (
              <View key={label} style={[styles.kpi, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.kpiValue, { color: colors.foreground }]}>{value}</Text>
                <Text style={[styles.kpiLabel, { color: colors.mutedForeground }]}>{label}</Text>
              </View>
            ))}
          </View>

          {(mockCount > 0 || lowAccuracyCount > 0) ? (
            <View style={[styles.warning, { backgroundColor: '#FFF3E0', borderColor: '#FFB74D' }]}>
              <Feather name="alert-triangle" size={18} color="#E65100" />
              <Text style={styles.warningText}>{mockCount} mock-location flags and {lowAccuracyCount} low-accuracy points require review.</Text>
            </View>
          ) : null}

          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>Session Details</Text>
            <View style={styles.detailRow}><Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>Started</Text><Text style={[styles.detailValue, { color: colors.foreground }]}>{new Date(selected.started_at).toLocaleString()}</Text></View>
            <View style={styles.detailRow}><Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>Ended</Text><Text style={[styles.detailValue, { color: colors.foreground }]}>{selected.ended_at ? new Date(selected.ended_at).toLocaleString() : 'Active'}</Text></View>
            <View style={styles.detailRow}><Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>Device</Text><Text style={[styles.detailValue, { color: colors.foreground }]}>{selected.device_id || 'Not recorded'}</Text></View>
            <View style={styles.detailRow}><Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>Last point</Text><Text style={[styles.detailValue, { color: colors.foreground }]}>{selected.last_point_at ? new Date(selected.last_point_at).toLocaleString() : 'No points'}</Text></View>
          </View>

          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.cardHeader}>
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>Route Endpoints</Text>
              <Text style={[styles.pointCount, { color: colors.mutedForeground }]}>{points.length} points</Text>
            </View>
            <TouchableOpacity style={[styles.pointButton, { borderColor: colors.border }]} onPress={() => void openPoint(first)} disabled={!first}>
              <View style={[styles.pointIcon, { backgroundColor: '#E8F5E9' }]}><Feather name="play" size={15} color="#2E7D32" /></View>
              <View style={{ flex: 1 }}><Text style={[styles.pointTitle, { color: colors.foreground }]}>Start Point</Text><Text style={[styles.pointMeta, { color: colors.mutedForeground }]}>{first ? `${first.latitude.toFixed(6)}, ${first.longitude.toFixed(6)} · ±${Math.round(first.accuracy_m ?? 0)}m` : 'No data'}</Text></View>
              <Feather name="external-link" size={15} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.pointButton, { borderColor: colors.border }]} onPress={() => void openPoint(last)} disabled={!last}>
              <View style={[styles.pointIcon, { backgroundColor: '#FFEBEE' }]}><Feather name="flag" size={15} color="#C62828" /></View>
              <View style={{ flex: 1 }}><Text style={[styles.pointTitle, { color: colors.foreground }]}>Last Point</Text><Text style={[styles.pointMeta, { color: colors.mutedForeground }]}>{last ? `${last.latitude.toFixed(6)}, ${last.longitude.toFixed(6)} · ±${Math.round(last.accuracy_m ?? 0)}m` : 'No data'}</Text></View>
              <Feather name="external-link" size={15} color={colors.primary} />
            </TouchableOpacity>
          </View>

          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>Recent GPS Audit</Text>
            {points.slice(-20).reverse().map(point => (
              <View key={point.id} style={[styles.auditRow, { borderBottomColor: colors.border }]}>
                <View style={[styles.auditDot, { backgroundColor: point.is_mock ? '#D70015' : (point.accuracy_m ?? 9999) > 100 ? '#FF9500' : '#34C759' }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.auditCoords, { color: colors.foreground }]}>{point.latitude.toFixed(6)}, {point.longitude.toFixed(6)}</Text>
                  <Text style={[styles.auditMeta, { color: colors.mutedForeground }]}>{new Date(point.captured_at).toLocaleString()} · accuracy ±{Math.round(point.accuracy_m ?? 0)}m</Text>
                </View>
                {point.is_mock ? <Text style={styles.mockLabel}>MOCK</Text> : null}
              </View>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: 16, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 14 },
  heroEyebrow: { color: 'rgba(255,255,255,0.72)', fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 1 },
  heroTitle: { color: '#fff', fontSize: 20, fontFamily: 'Inter_700Bold', marginTop: 3 },
  heroSub: { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 4 },
  sessionChip: { minWidth: 92, borderRadius: 12, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 9 },
  sessionChipText: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  sessionChipSub: { fontSize: 10, fontFamily: 'Inter_400Regular', marginTop: 2, textTransform: 'capitalize' },
  empty: { borderRadius: 14, borderWidth: 1, padding: 30, alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  emptyText: { fontSize: 12, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 18 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kpi: { width: '48.5%', borderRadius: 12, borderWidth: 1, padding: 13 },
  kpiValue: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  kpiLabel: { fontSize: 10, fontFamily: 'Inter_500Medium', marginTop: 3 },
  warning: { borderRadius: 12, borderWidth: 1, padding: 12, flexDirection: 'row', gap: 9, alignItems: 'center' },
  warningText: { color: '#E65100', fontSize: 11, fontFamily: 'Inter_600SemiBold', flex: 1, lineHeight: 16 },
  card: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 10 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  pointCount: { fontSize: 10, fontFamily: 'Inter_500Medium' },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  detailLabel: { fontSize: 11, fontFamily: 'Inter_500Medium' },
  detailValue: { fontSize: 11, fontFamily: 'Inter_600SemiBold', flex: 1, textAlign: 'right' },
  pointButton: { borderWidth: 1, borderRadius: 10, padding: 11, flexDirection: 'row', alignItems: 'center', gap: 10 },
  pointIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  pointTitle: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  pointMeta: { fontSize: 10, fontFamily: 'Inter_400Regular', marginTop: 2 },
  auditRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth },
  auditDot: { width: 8, height: 8, borderRadius: 4 },
  auditCoords: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  auditMeta: { fontSize: 9, fontFamily: 'Inter_400Regular', marginTop: 2 },
  mockLabel: { color: '#D70015', fontSize: 9, fontFamily: 'Inter_700Bold' },
});
