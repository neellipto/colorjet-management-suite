import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import type { EngineerAvailability } from '@/constants/types';

const AVAIL_COLOR: Record<EngineerAvailability, string> = {
  available: '#34C759', busy: '#FF9500', on_job: '#007AFF', leave: '#8E8E93', offline: '#C7C7CC',
};
const AVAIL_LABEL: Record<EngineerAvailability, string> = {
  available: 'Available', busy: 'Busy', on_job: 'On Job', leave: 'On Leave', offline: 'Offline',
};

export default function EngineersScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { engineers } = useApp();

  const pb = insets.bottom + (Platform.OS === 'web' ? 34 : 0) + 24;
  const pt = Platform.OS === 'web' ? 16 : 0;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingTop: pt + 12, paddingBottom: pb, paddingHorizontal: 16, gap: 10 }}
      showsVerticalScrollIndicator={false}
    >
      {engineers.map(e => (
        <TouchableOpacity key={e.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => router.push(`/engineer/${e.id}` as any)} activeOpacity={0.75}>
          <View style={styles.topRow}>
            <View style={[styles.avatar, { backgroundColor: colors.navyLight }]}>
              <Text style={[styles.avatarText, { color: colors.primary }]}>{e.name.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.name, { color: colors.foreground }]}>{e.name}</Text>
              <Text style={[styles.sub, { color: colors.mutedForeground }]}>{e.roleTitle} · {e.area}</Text>
            </View>
            <View style={[styles.availPill, { backgroundColor: AVAIL_COLOR[e.availability] + '22' }]}>
              <View style={[styles.availDot, { backgroundColor: AVAIL_COLOR[e.availability] }]} />
              <Text style={[styles.availText, { color: AVAIL_COLOR[e.availability] }]}>{AVAIL_LABEL[e.availability]}</Text>
            </View>
          </View>
          {e.skills.length > 0 && (
            <View style={styles.skillRow}>
              {e.skills.slice(0, 4).map(s => (
                <View key={s} style={[styles.skill, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <Text style={[styles.skillText, { color: colors.mutedForeground }]}>{s}</Text>
                </View>
              ))}
            </View>
          )}
          <View style={[styles.kpiRow, { borderTopColor: colors.border }]}>
            <Kpi label="Jobs" value={String(e.completedJobs)} colors={colors} />
            <Kpi label="Rating" value={e.rating.toFixed(1)} colors={colors} />
            <Kpi label="FTF %" value={`${e.firstTimeFixPct}%`} colors={colors} />
            <Kpi label="Late" value={String(e.lateJobs)} colors={colors} />
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

function Kpi({ label, value, colors }: { label: string; value: string; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={styles.kpi}>
      <Text style={[styles.kpiValue, { color: colors.foreground }]}>{value}</Text>
      <Text style={[styles.kpiLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 14, padding: 14, borderWidth: 1, gap: 12 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 17, fontFamily: 'Inter_700Bold' },
  name: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  sub: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 1 },
  availPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 20 },
  availDot: { width: 7, height: 7, borderRadius: 4 },
  availText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  skillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  skill: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 12, borderWidth: 1 },
  skillText: { fontSize: 11, fontFamily: 'Inter_500Medium' },
  kpiRow: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10 },
  kpi: { flex: 1, alignItems: 'center' },
  kpiValue: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  kpiLabel: { fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 2 },
});
