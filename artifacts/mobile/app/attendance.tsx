import { Feather } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useErpRuntime } from '@/context/ErpRuntimeContext';
import { useColors } from '@/hooks/useColors';
import { fetchMyAttendanceHistory, recordAttendanceEvent, type AttendanceEvent, type DutyEventType } from '@/lib/attendanceApi';
import { can } from '@/lib/effectivePermissions';

const LABELS: Record<DutyEventType, string> = {
  office_check_in: 'Office check-in', office_check_out: 'Office check-out',
  field_duty_start: 'Field duty started', customer_site_check_in: 'Customer-site check-in',
  customer_site_check_out: 'Customer-site check-out', break_start: 'Break started',
  break_end: 'Break ended', duty_end: 'Duty ended',
};
const uuid = () => `mobile-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
const when = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

export default function AttendanceScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { authenticated, user, permissions, refreshIdentity } = useErpRuntime();
  const [events, setEvents] = useState<AttendanceEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState<DutyEventType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canViewOwn = Boolean(authenticated && user?.id);
  const canRecord = Boolean(authenticated && (permissions?.isOwner || can(permissions, 'attendance', 'create')));

  const load = useCallback(async () => {
    if (!canViewOwn) return;
    setLoading(true); setError(null);
    try { setEvents(await fetchMyAttendanceHistory()); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to load attendance history.'); }
    finally { setLoading(false); }
  }, [canViewOwn]);

  useEffect(() => { void load(); }, [load]);
  const latest = events[0];
  const checkedIn = useMemo(() => latest?.eventType === 'office_check_in' || latest?.eventType === 'field_duty_start', [latest]);

  const record = async (eventType: DutyEventType) => {
    setSubmitting(eventType); setError(null);
    try {
      await recordAttendanceEvent({ eventType, clientUuid: uuid() });
      await load();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Attendance could not be recorded.';
      setError(message); Alert.alert('Attendance not saved', message);
    } finally { setSubmitting(null); }
  };

  if (!canViewOwn) return (
    <View style={[styles.center, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <Feather name="lock" size={34} color={colors.mutedForeground} />
      <Text style={[styles.title, { color: colors.foreground }]}>ERP sign-in required</Text>
      <Text style={[styles.help, { color: colors.mutedForeground }]}>Sign in with your existing ERP account to view your own attendance.</Text>
      <TouchableOpacity style={[styles.primaryButton, { backgroundColor: colors.primary }]} onPress={() => void refreshIdentity()}>
        <Text style={styles.primaryText}>Refresh sign-in</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingTop: insets.top + 14, paddingBottom: insets.bottom + 24, paddingHorizontal: 16, gap: 14 }}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}>
      <View>
        <Text style={[styles.eyebrow, { color: colors.primary }]}>MY WORKDAY</Text>
        <Text style={[styles.title, { color: colors.foreground }]}>Attendance</Text>
        <Text style={[styles.help, { color: colors.mutedForeground }]}>{user?.displayName ?? user?.username ?? 'Employee'} · your own ERP attendance record</Text>
      </View>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.statusRow}>
          <View style={styles.grow}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>Today</Text>
            <Text style={[styles.help, { color: colors.mutedForeground }]}>
              {latest ? `Latest: ${LABELS[latest.eventType]} · ${when(latest.occurredAt)}` : 'No attendance event returned yet.'}
            </Text>
          </View>
          {loading && <ActivityIndicator color={colors.primary} />}
        </View>
        {canRecord ? <View style={styles.actionRow}>
          <TouchableOpacity disabled={Boolean(submitting) || checkedIn} onPress={() => void record('office_check_in')}
            style={[styles.actionButton, { backgroundColor: colors.primary, opacity: submitting || checkedIn ? 0.5 : 1 }]}>
            <Feather name="log-in" size={17} color="#fff" /><Text style={styles.primaryText}>{submitting === 'office_check_in' ? 'Saving…' : 'Check in'}</Text>
          </TouchableOpacity>
          <TouchableOpacity disabled={Boolean(submitting) || !checkedIn} onPress={() => void record('office_check_out')}
            style={[styles.actionButton, { backgroundColor: colors.secondary, opacity: submitting || !checkedIn ? 0.5 : 1 }]}>
            <Feather name="log-out" size={17} color="#fff" /><Text style={styles.primaryText}>{submitting === 'office_check_out' ? 'Saving…' : 'Check out'}</Text>
          </TouchableOpacity>
        </View> : <Text style={[styles.permissionNote, { color: colors.mutedForeground }]}>History access is enabled. Check-in/out needs Attendance Create permission from the ERP server.</Text>}
      </View>
      {error && <View style={[styles.errorBox, { backgroundColor: colors.card, borderColor: colors.destructive }]}>
        <Feather name="alert-circle" size={17} color={colors.destructive} /><Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
      </View>}
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Recent history</Text>
      {events.map(event => <View key={event.id} style={[styles.eventRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.eventIcon, { backgroundColor: colors.navyLight }]}><Feather name="clock" size={17} color={colors.primary} /></View>
        <View style={styles.grow}><Text style={[styles.eventTitle, { color: colors.foreground }]}>{LABELS[event.eventType]}</Text>
          <Text style={[styles.help, { color: colors.mutedForeground }]}>{when(event.occurredAt)}</Text>
          {event.note ? <Text style={[styles.note, { color: colors.mutedForeground }]}>{event.note}</Text> : null}
        </View>
        {event.approvalStatus === 'pending' && <Text style={[styles.pending, { color: colors.secondary }]}>Pending</Text>}
      </View>)}
      {!events.length && !loading && !error && <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Feather name="calendar" size={26} color={colors.mutedForeground} /><Text style={[styles.help, { color: colors.mutedForeground }]}>No attendance history returned by the ERP.</Text>
      </View>}
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, gap: 12 },
  grow: { flex: 1 }, eyebrow: { fontSize: 12, fontFamily: 'Inter_700Bold', letterSpacing: 0.8 },
  title: { fontSize: 25, fontFamily: 'Inter_700Bold', marginTop: 2 }, help: { fontSize: 12, lineHeight: 18, fontFamily: 'Inter_500Medium' },
  card: { borderWidth: 1, borderLeftWidth: 4, borderLeftColor: '#0D47A1', borderRadius: 14, padding: 14, gap: 14 },
  cardTitle: { fontSize: 17, fontFamily: 'Inter_700Bold' }, statusRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  actionRow: { flexDirection: 'row', gap: 10 }, actionButton: { flex: 1, minHeight: 46, borderRadius: 10, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  primaryButton: { minHeight: 44, borderRadius: 10, paddingHorizontal: 18, justifyContent: 'center' }, primaryText: { color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 14 },
  permissionNote: { fontSize: 12, lineHeight: 18, fontFamily: 'Inter_500Medium' }, errorBox: { borderWidth: 1, borderRadius: 10, padding: 12, flexDirection: 'row', gap: 8 },
  errorText: { flex: 1, fontSize: 12, lineHeight: 18, fontFamily: 'Inter_500Medium' }, sectionTitle: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  eventRow: { borderWidth: 1, borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  eventIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }, eventTitle: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  note: { fontSize: 12, lineHeight: 17, fontFamily: 'Inter_400Regular' }, pending: { fontSize: 11, fontFamily: 'Inter_700Bold' },
  empty: { minHeight: 130, borderWidth: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 18 },
});
