import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useMemo, useState } from 'react';
import { Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import type { ScheduleEntry } from '@/constants/types';

const STATUS_COLOR: Record<ScheduleEntry['status'], string> = {
  planned: '#007AFF', in_progress: '#1A237E', completed: '#34C759', cancelled: '#C7C7CC',
};
const STATUS_LABEL: Record<ScheduleEntry['status'], string> = {
  planned: 'Planned', in_progress: 'In Progress', completed: 'Completed', cancelled: 'Cancelled',
};
const PRIORITY_COLOR: Record<string, string> = { low: '#8E8E93', normal: '#007AFF', high: '#FF9500', emergency: '#FF3B30' };
const NEXT_STATUS: Record<ScheduleEntry['status'], ScheduleEntry['status'] | null> = {
  planned: 'in_progress', in_progress: 'completed', completed: null, cancelled: null,
};

export default function ScheduleScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { schedule, engineers, addScheduleEntry, updateScheduleStatus } = useApp();
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ engineerId: '', customerName: '', area: '', date: '', time: '', note: '', priority: 'normal' as ScheduleEntry['priority'] });

  const pb = insets.bottom + (Platform.OS === 'web' ? 34 : 0) + 24;
  const pt = Platform.OS === 'web' ? 16 : 0;

  const grouped = useMemo(() => {
    const map: Record<string, ScheduleEntry[]> = {};
    [...schedule].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)).forEach(s => {
      (map[s.date] = map[s.date] ?? []).push(s);
    });
    return map;
  }, [schedule]);

  const onCreate = () => {
    const eng = engineers.find(e => e.id === form.engineerId);
    if (!eng || !form.customerName.trim() || !form.date.trim()) return;
    addScheduleEntry({
      engineerId: eng.id, engineerName: eng.name, customerName: form.customerName.trim(),
      area: form.area.trim(), date: form.date.trim(), time: form.time.trim() || '09:00',
      priority: form.priority, status: 'planned', note: form.note.trim() || undefined,
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setForm({ engineerId: '', customerName: '', area: '', date: '', time: '', note: '', priority: 'normal' });
    setModal(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: pt + 12, paddingBottom: pb, paddingHorizontal: 16, gap: 14 }}
        showsVerticalScrollIndicator={false}
      >
        {Object.keys(grouped).length === 0 && (
          <Text style={[styles.empty, { color: colors.mutedForeground }]}>No scheduled visits yet.</Text>
        )}
        {Object.entries(grouped).map(([date, items]) => (
          <View key={date} style={{ gap: 8 }}>
            <Text style={[styles.dateHeader, { color: colors.mutedForeground }]}>{date}</Text>
            {items.map(s => {
              const next = NEXT_STATUS[s.status];
              return (
                <View key={s.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={styles.cardTop}>
                    <View style={styles.timeBox}>
                      <Text style={[styles.time, { color: colors.primary }]}>{s.time}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.customer, { color: colors.foreground }]}>{s.customerName}</Text>
                      <Text style={[styles.meta, { color: colors.mutedForeground }]}>{s.engineerName}{s.area ? ` · ${s.area}` : ''}</Text>
                    </View>
                    <View style={[styles.statusPill, { backgroundColor: STATUS_COLOR[s.status] + '22' }]}>
                      <Text style={[styles.statusText, { color: STATUS_COLOR[s.status] }]}>{STATUS_LABEL[s.status]}</Text>
                    </View>
                  </View>
                  {!!s.note && <Text style={[styles.note, { color: colors.mutedForeground }]}>{s.note}</Text>}
                  <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
                    <View style={[styles.prioDot, { backgroundColor: PRIORITY_COLOR[s.priority] }]} />
                    <Text style={[styles.prioText, { color: colors.mutedForeground }]}>{s.priority}</Text>
                    <View style={{ flex: 1 }} />
                    {next && (
                      <TouchableOpacity style={[styles.advanceBtn, { backgroundColor: colors.primary }]} onPress={() => { updateScheduleStatus(s.id, next); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }} activeOpacity={0.8}>
                        <Text style={styles.advanceText}>Mark {STATUS_LABEL[next]}</Text>
                      </TouchableOpacity>
                    )}
                    {s.status !== 'completed' && s.status !== 'cancelled' && (
                      <TouchableOpacity style={[styles.cancelBtn, { borderColor: colors.border }]} onPress={() => { updateScheduleStatus(s.id, 'cancelled'); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }} activeOpacity={0.8}>
                        <Feather name="x" size={14} color={colors.destructive} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        ))}
      </ScrollView>

      <TouchableOpacity style={[styles.fab, { backgroundColor: colors.primary, bottom: pb }]} onPress={() => setModal(true)} activeOpacity={0.85}>
        <Feather name="plus" size={24} color="#fff" />
      </TouchableOpacity>

      <Modal visible={modal} animationType="slide" transparent onRequestClose={() => setModal(false)}>
        <View style={styles.modalBg}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, paddingBottom: pb }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>New Visit</Text>
              <TouchableOpacity onPress={() => setModal(false)} hitSlop={8}><Feather name="x" size={22} color={colors.mutedForeground} /></TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Engineer</Text>
              <View style={styles.optGrid}>
                {engineers.map(e => (
                  <TouchableOpacity key={e.id} style={[styles.opt, { backgroundColor: form.engineerId === e.id ? colors.primary : colors.background, borderColor: form.engineerId === e.id ? colors.primary : colors.border }]} onPress={() => setForm(s => ({ ...s, engineerId: e.id }))} activeOpacity={0.75}>
                    <Text style={[styles.optText, { color: form.engineerId === e.id ? '#fff' : colors.mutedForeground }]}>{e.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {([['customerName', 'Customer Name'], ['area', 'Area'], ['date', 'Date (YYYY-MM-DD)'], ['time', 'Time (HH:MM)'], ['note', 'Note']] as const).map(([k, label]) => (
                <View key={k} style={styles.field}>
                  <Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text>
                  <TextInput style={[styles.input, { color: colors.foreground, borderColor: colors.border }]} value={form[k]} onChangeText={t => setForm(s => ({ ...s, [k]: t }))} placeholder={label} placeholderTextColor={colors.mutedForeground} />
                </View>
              ))}
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Priority</Text>
              <View style={styles.optGrid}>
                {(['low', 'normal', 'high', 'emergency'] as const).map(p => (
                  <TouchableOpacity key={p} style={[styles.opt, { backgroundColor: form.priority === p ? colors.primary : colors.background, borderColor: form.priority === p ? colors.primary : colors.border }]} onPress={() => setForm(s => ({ ...s, priority: p }))} activeOpacity={0.75}>
                    <Text style={[styles.optText, { color: form.priority === p ? '#fff' : colors.mutedForeground, textTransform: 'capitalize' }]}>{p}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary }]} onPress={onCreate} activeOpacity={0.85}>
                <Feather name="check" size={17} color="#fff" />
                <Text style={styles.saveText}>Add Visit</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', paddingVertical: 40 },
  dateHeader: { fontSize: 13, fontFamily: 'Inter_700Bold', marginLeft: 2 },
  card: { borderRadius: 12, borderWidth: 1, padding: 14, gap: 8 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  timeBox: { minWidth: 52 },
  time: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  customer: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  meta: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 1 },
  statusPill: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  note: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10 },
  prioDot: { width: 7, height: 7, borderRadius: 4 },
  prioText: { fontSize: 11, fontFamily: 'Inter_500Medium', textTransform: 'capitalize' },
  advanceBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 },
  advanceText: { color: '#fff', fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  cancelBtn: { width: 30, height: 30, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  fab: { position: 'absolute', right: 20, width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', elevation: 4, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 18, maxHeight: '88%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  modalTitle: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  field: { gap: 6 },
  label: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14, fontFamily: 'Inter_400Regular' },
  optGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  opt: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  optText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12, marginTop: 4 },
  saveText: { color: '#fff', fontSize: 15, fontFamily: 'Inter_700Bold' },
});
