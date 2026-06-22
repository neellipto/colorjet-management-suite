import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import type { EngineerAvailability } from '@/constants/types';

const AVAILS: EngineerAvailability[] = ['available', 'busy', 'on_job', 'leave', 'offline'];
const AVAIL_LABEL: Record<EngineerAvailability, string> = {
  available: 'Available', busy: 'Busy', on_job: 'On Job', leave: 'On Leave', offline: 'Offline',
};
const PERMISSIONS: { key: string; label: string }[] = [
  { key: 'viewAllJobs', label: 'View all jobs' },
  { key: 'editParts', label: 'Add billable parts' },
  { key: 'closeTickets', label: 'Close tickets' },
  { key: 'viewReports', label: 'View reports' },
  { key: 'manageSchedule', label: 'Manage own schedule' },
];

export default function EngineerDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { engineers, updateEngineer } = useApp();
  const engineer = engineers.find(e => e.id === id);

  const [form, setForm] = useState(() => ({
    phone: engineer?.phone ?? '', area: engineer?.area ?? '', roleTitle: engineer?.roleTitle ?? '',
    skills: (engineer?.skills ?? []).join(', '),
    availability: (engineer?.availability ?? 'available') as EngineerAvailability,
    permissions: { ...(engineer?.permissions ?? {}) } as Record<string, boolean>,
  }));

  const pb = insets.bottom + (Platform.OS === 'web' ? 34 : 0) + 24;
  const pt = Platform.OS === 'web' ? 16 : 0;

  if (!engineer) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.mutedForeground }}>Engineer not found.</Text>
      </View>
    );
  }

  const onSave = () => {
    updateEngineer(engineer.id, {
      phone: form.phone, area: form.area, roleTitle: form.roleTitle,
      skills: form.skills.split(',').map(s => s.trim()).filter(Boolean),
      availability: form.availability, permissions: form.permissions,
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingTop: pt + 16, paddingBottom: pb, paddingHorizontal: 16, gap: 12 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.hero, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.avatar, { backgroundColor: colors.navyLight }]}>
          <Text style={[styles.avatarText, { color: colors.primary }]}>{engineer.name.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.heroName, { color: colors.foreground }]}>{engineer.name}</Text>
          <Text style={[styles.heroSub, { color: colors.mutedForeground }]}>{engineer.roleTitle}</Text>
        </View>
      </View>

      <View style={styles.kpiGrid}>
        <Stat label="Completed" value={String(engineer.completedJobs)} colors={colors} />
        <Stat label="Rating" value={engineer.rating.toFixed(1)} colors={colors} />
        <Stat label="First-Time Fix" value={`${engineer.firstTimeFixPct}%`} colors={colors} />
        <Stat label="Late Jobs" value={String(engineer.lateJobs)} colors={colors} />
        <Stat label="Travel (km)" value={String(engineer.travelKm)} colors={colors} />
        <Stat label="Revenue" value={`৳${engineer.revenueContribution.toLocaleString()}`} colors={colors} />
      </View>

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {([['phone', 'Phone'], ['area', 'Service Area'], ['roleTitle', 'Role Title'], ['skills', 'Skills (comma separated)']] as const).map(([k, label]) => (
          <View key={k} style={styles.field}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text>
            <TextInput
              style={[styles.input, { color: colors.foreground, borderColor: colors.border }]}
              value={form[k]}
              onChangeText={t => setForm(s => ({ ...s, [k]: t }))}
              placeholder={label}
              placeholderTextColor={colors.mutedForeground}
            />
          </View>
        ))}
        <Text style={[styles.label, { color: colors.mutedForeground }]}>Availability</Text>
        <View style={styles.availGrid}>
          {AVAILS.map(a => (
            <TouchableOpacity key={a} style={[styles.availOpt, { backgroundColor: form.availability === a ? colors.primary : colors.background, borderColor: form.availability === a ? colors.primary : colors.border }]} onPress={() => setForm(s => ({ ...s, availability: a }))} activeOpacity={0.75}>
              <Text style={[styles.availOptText, { color: form.availability === a ? '#fff' : colors.mutedForeground }]}>{AVAIL_LABEL[a]}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <Text style={[styles.section, { color: colors.mutedForeground }]}>PERMISSIONS</Text>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, gap: 0 }]}>
        {PERMISSIONS.map(p => {
          const on = !!form.permissions[p.key];
          return (
            <TouchableOpacity key={p.key} style={styles.permRow} onPress={() => setForm(s => ({ ...s, permissions: { ...s.permissions, [p.key]: !on } }))} activeOpacity={0.7}>
              <Text style={[styles.rowLabel, { color: colors.foreground }]}>{p.label}</Text>
              <View style={[styles.switch, { backgroundColor: on ? colors.success : colors.muted }]}>
                <View style={[styles.knob, { transform: [{ translateX: on ? 18 : 2 }] }]} />
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary }]} onPress={onSave} activeOpacity={0.85}>
        <Feather name="check" size={17} color="#fff" />
        <Text style={styles.saveText}>Save Changes</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function Stat({ label, value, colors }: { label: string; value: string; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={[styles.stat, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.statValue, { color: colors.foreground }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, borderWidth: 1 },
  avatar: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  heroName: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  heroSub: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 1 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: { width: '47%', flexGrow: 1, borderRadius: 12, borderWidth: 1, padding: 12, alignItems: 'center' },
  statValue: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  statLabel: { fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 3 },
  card: { borderRadius: 14, padding: 14, borderWidth: 1, gap: 12 },
  field: { gap: 6 },
  label: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14, fontFamily: 'Inter_400Regular' },
  availGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  availOpt: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  availOptText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  section: { fontSize: 12, fontFamily: 'Inter_700Bold', letterSpacing: 0.5, marginLeft: 4 },
  permRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13 },
  rowLabel: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  switch: { width: 40, height: 24, borderRadius: 12, justifyContent: 'center' },
  knob: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12 },
  saveText: { color: '#fff', fontSize: 15, fontFamily: 'Inter_700Bold' },
});
