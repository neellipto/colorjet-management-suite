import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Modal, Platform, RefreshControl, ScrollView, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import {
  type OfficeTask,
  createOfficeTask,
  listOfficeTasks,
  transitionOfficeTask,
} from '@/lib/v13BusinessOperations';

const PRIORITIES: OfficeTask['priority'][] = ['low', 'normal', 'high', 'urgent', 'emergency'];
const STATUS_COLOR: Record<OfficeTask['status'], string> = {
  new: '#007AFF', accepted: '#5856D6', in_progress: '#1A237E', waiting: '#FF9500',
  completed: '#34C759', cancelled: '#8E8E93', rejected: '#C62828', overdue: '#D70015',
};

function nextAction(status: OfficeTask['status']): { label: string; next: OfficeTask['status']; icon: keyof typeof Feather.glyphMap; progress?: number } | null {
  switch (status) {
    case 'new': return { label: 'Accept', next: 'accepted', icon: 'check' };
    case 'accepted': return { label: 'Start', next: 'in_progress', icon: 'play' };
    case 'in_progress': return { label: 'Complete', next: 'completed', icon: 'check-circle', progress: 100 };
    case 'waiting': return { label: 'Resume', next: 'in_progress', icon: 'play-circle' };
    case 'overdue': return { label: 'Resume', next: 'in_progress', icon: 'activity' };
    default: return null;
  }
}

function fmt(value?: string | null): string {
  if (!value) return 'Not set';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function parseLocal(value: string): string | undefined {
  if (!value.trim()) return undefined;
  const date = new Date(value.trim());
  if (Number.isNaN(date.getTime())) throw new Error('Use a valid date or date-time.');
  return date.toISOString();
}

export default function OfficeTasksScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { currentUser, users } = useApp();
  const [tasks, setTasks] = useState<OfficeTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'mine' | 'open' | 'completed' | 'all'>('mine');
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({
    title: '', description: '', module: 'general', department: '', assignedTo: '',
    priority: 'normal' as OfficeTask['priority'], startAt: '', dueAt: '', followUpAt: '',
  });

  const role = currentUser?.role ?? 'customer';
  const canAssign = ['admin', 'manager', 'service_control', 'accounts', 'sales', 'store', 'engineer'].includes(role);
  const pb = insets.bottom + (Platform.OS === 'web' ? 34 : 0) + 26;

  const load = useCallback(async () => {
    setLoading(true);
    try { setTasks(await listOfficeTasks()); }
    catch (error) { Alert.alert('Office Tasks', error instanceof Error ? error.message : 'Tasks could not be loaded.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const visibleTasks = useMemo(() => {
    let rows = tasks;
    if (filter === 'mine') rows = rows.filter(item => item.assigned_to === currentUser?.id || item.assigned_by === currentUser?.id);
    if (filter === 'open') rows = rows.filter(item => !['completed', 'cancelled', 'rejected'].includes(item.status));
    if (filter === 'completed') rows = rows.filter(item => item.status === 'completed');
    const needle = search.trim().toLowerCase();
    return needle ? rows.filter(item => `${item.task_no} ${item.title} ${item.description ?? ''} ${item.module} ${item.department ?? ''}`.toLowerCase().includes(needle)) : rows;
  }, [currentUser?.id, filter, search, tasks]);

  const stats = useMemo(() => ({
    open: tasks.filter(item => !['completed', 'cancelled', 'rejected'].includes(item.status)).length,
    mine: tasks.filter(item => item.assigned_to === currentUser?.id && !['completed', 'cancelled', 'rejected'].includes(item.status)).length,
    overdue: tasks.filter(item => item.status === 'overdue' || (item.due_at && new Date(item.due_at).getTime() < Date.now() && !['completed', 'cancelled', 'rejected'].includes(item.status))).length,
    completed: tasks.filter(item => item.status === 'completed').length,
  }), [currentUser?.id, tasks]);

  const createTask = async () => {
    if (!form.title.trim()) return Alert.alert('Required', 'Task title is required.');
    setWorkingId('new');
    try {
      await createOfficeTask({
        title: form.title,
        description: form.description || undefined,
        module: form.module || 'general',
        department: form.department || undefined,
        assignedTo: form.assignedTo || currentUser?.id,
        priority: form.priority,
        startAt: parseLocal(form.startAt),
        dueAt: parseLocal(form.dueAt),
        followUpAt: parseLocal(form.followUpAt),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setModal(false);
      setForm({ title: '', description: '', module: 'general', department: '', assignedTo: '', priority: 'normal', startAt: '', dueAt: '', followUpAt: '' });
      await load();
    } catch (error) {
      Alert.alert('Create Task', error instanceof Error ? error.message : 'Task could not be created.');
    } finally { setWorkingId(null); }
  };

  const transition = async (task: OfficeTask, next: OfficeTask['status'], progress?: number) => {
    setWorkingId(task.id);
    try {
      await transitionOfficeTask({ taskId: task.id, newStatus: next, progressPercent: progress, comment: `${next.replaceAll('_', ' ')} from mobile app`, idempotencyKey: `${task.id}:${next}:${Date.now()}` });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await load();
    } catch (error) {
      Alert.alert('Task Update', error instanceof Error ? error.message : 'Task could not be updated.');
    } finally { setWorkingId(null); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: Platform.OS === 'web' ? 24 : 12, paddingBottom: pb + 62, gap: 13 }} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />} showsVerticalScrollIndicator={false}>
        <View style={[styles.hero, { backgroundColor: colors.primary }]}><View style={{ flex: 1 }}><Text style={styles.heroEyebrow}>COLORJET OFFICE OPERATIONS</Text><Text style={styles.heroTitle}>Office Task Management</Text><Text style={styles.heroSub}>Assign, follow up, track progress and close accountable work</Text></View><Feather name="check-square" size={30} color="#fff" /></View>
        <View style={styles.kpiGrid}>{[['Open', stats.open], ['My Pending', stats.mine], ['Overdue', stats.overdue], ['Completed', stats.completed]].map(([label, value]) => <View key={String(label)} style={[styles.kpi, { backgroundColor: colors.card, borderColor: colors.border }]}><Text style={[styles.kpiValue, { color: label === 'Overdue' && Number(value) > 0 ? '#D70015' : colors.foreground }]}>{String(value)}</Text><Text style={[styles.kpiLabel, { color: colors.mutedForeground }]}>{String(label)}</Text></View>)}</View>
        <View style={styles.filterRow}>{(['mine', 'open', 'completed', 'all'] as const).map(value => <TouchableOpacity key={value} style={[styles.filter, { backgroundColor: filter === value ? colors.primary : colors.card, borderColor: filter === value ? colors.primary : colors.border }]} onPress={() => setFilter(value)}><Text style={[styles.filterText, { color: filter === value ? '#fff' : colors.foreground }]}>{value === 'mine' ? 'Mine' : value === 'open' ? 'Open' : value === 'completed' ? 'Done' : 'All'}</Text></TouchableOpacity>)}</View>
        <TextInput style={[styles.search, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]} value={search} onChangeText={setSearch} placeholder="Search task, module or department" placeholderTextColor={colors.mutedForeground} />
        {!loading && visibleTasks.length === 0 ? <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border }]}><Feather name="clipboard" size={28} color={colors.mutedForeground} /><Text style={[styles.emptyTitle, { color: colors.foreground }]}>No matching tasks</Text></View> : null}
        {visibleTasks.map(task => {
          const action = nextAction(task.status);
          const overdue = task.status === 'overdue' || Boolean(task.due_at && new Date(task.due_at).getTime() < Date.now() && !['completed', 'cancelled', 'rejected'].includes(task.status));
          const assignee = users.find(item => item.id === task.assigned_to);
          const color = STATUS_COLOR[task.status];
          return <View key={task.id} style={[styles.card, { backgroundColor: colors.card, borderColor: overdue ? '#D70015' : colors.border }]}>
            <View style={styles.cardTop}><View style={{ flex: 1 }}><Text style={[styles.code, { color: colors.mutedForeground }]}>{task.task_no}</Text><Text style={[styles.title, { color: colors.foreground }]}>{task.title}</Text><Text style={[styles.sub, { color: colors.mutedForeground }]}>{task.module} · {task.department || 'General'} · Assigned to {assignee?.name || 'Unassigned'}</Text></View><View style={[styles.badge, { backgroundColor: `${color}20` }]}><Text style={[styles.badgeText, { color }]}>{task.status.replaceAll('_', ' ')}</Text></View></View>
            {task.description ? <Text style={[styles.description, { color: colors.mutedForeground }]}>{task.description}</Text> : null}
            <View style={[styles.metaBox, { backgroundColor: colors.background }]}><Text style={[styles.meta, { color: overdue ? '#D70015' : colors.mutedForeground }]}>Due: {fmt(task.due_at)}</Text><Text style={[styles.meta, { color: colors.mutedForeground }]}>Follow-up: {fmt(task.follow_up_at)} · Progress {task.progress_percent}%</Text><View style={[styles.progressTrack, { backgroundColor: colors.border }]}><View style={[styles.progressBar, { width: `${Math.max(0, Math.min(100, task.progress_percent))}%`, backgroundColor: overdue ? '#D70015' : colors.primary }]} /></View></View>
            <View style={styles.actions}>{action ? <Action icon={action.icon} label={workingId === task.id ? 'Processing…' : action.label} onPress={() => void transition(task, action.next, action.progress)} colors={colors} disabled={workingId !== null} /> : null}{['accepted', 'in_progress', 'overdue'].includes(task.status) ? <TouchableOpacity style={[styles.secondary, { borderColor: '#FF9500' }]} onPress={() => void transition(task, 'waiting', task.progress_percent)} disabled={workingId !== null}><Feather name="pause" size={14} color="#FF9500" /><Text style={styles.secondaryText}>Waiting</Text></TouchableOpacity> : null}</View>
          </View>;
        })}
      </ScrollView>
      {canAssign ? <TouchableOpacity style={[styles.fab, { backgroundColor: colors.primary, bottom: pb }]} onPress={() => setModal(true)}><Feather name="plus" size={24} color="#fff" /></TouchableOpacity> : null}
      <Modal visible={modal} animationType="slide" transparent onRequestClose={() => setModal(false)}><View style={styles.modalBg}><View style={[styles.modalCard, { backgroundColor: colors.card, paddingBottom: pb }]}><View style={styles.modalHeader}><View style={{ flex: 1 }}><Text style={[styles.modalTitle, { color: colors.foreground }]}>Create Office Task</Text><Text style={[styles.modalSub, { color: colors.mutedForeground }]}>Assign owner, priority and due date</Text></View><TouchableOpacity onPress={() => setModal(false)}><Feather name="x" size={22} color={colors.mutedForeground} /></TouchableOpacity></View><ScrollView contentContainerStyle={{ gap: 11 }} keyboardShouldPersistTaps="handled"><Field label="Task Title *" value={form.title} onChange={value => setForm(previous => ({ ...previous, title: value }))} placeholder="Required work" colors={colors} /><Field label="Description" value={form.description} onChange={value => setForm(previous => ({ ...previous, description: value }))} placeholder="Details and expected result" colors={colors} multiline /><View style={styles.twoCol}><Field label="Module" value={form.module} onChange={value => setForm(previous => ({ ...previous, module: value }))} placeholder="service/accounts/store" colors={colors} /><Field label="Department" value={form.department} onChange={value => setForm(previous => ({ ...previous, department: value }))} placeholder="Department" colors={colors} /></View><Choice label="Assign To" items={users.map(item => ({ id: item.id, label: item.name }))} selected={form.assignedTo} onSelect={id => setForm(previous => ({ ...previous, assignedTo: id }))} colors={colors} /><Choice label="Priority" items={PRIORITIES.map(value => ({ id: value, label: value }))} selected={form.priority} onSelect={id => setForm(previous => ({ ...previous, priority: id as OfficeTask['priority'] }))} colors={colors} /><View style={styles.twoCol}><Field label="Start Date-Time" value={form.startAt} onChange={value => setForm(previous => ({ ...previous, startAt: value }))} placeholder="2026-07-13 09:00" colors={colors} /><Field label="Due Date-Time" value={form.dueAt} onChange={value => setForm(previous => ({ ...previous, dueAt: value }))} placeholder="2026-07-13 17:00" colors={colors} /></View><Field label="Follow-up Date-Time" value={form.followUpAt} onChange={value => setForm(previous => ({ ...previous, followUpAt: value }))} placeholder="Optional" colors={colors} /><TouchableOpacity style={[styles.save, { backgroundColor: colors.primary, opacity: workingId ? 0.6 : 1 }]} disabled={workingId !== null} onPress={() => void createTask()}><Feather name="save" size={17} color="#fff" /><Text style={styles.saveText}>{workingId === 'new' ? 'Creating…' : 'Create Task'}</Text></TouchableOpacity></ScrollView></View></View></Modal>
    </View>
  );
}

function Action({ icon, label, onPress, colors, disabled }: { icon: keyof typeof Feather.glyphMap; label: string; onPress: () => void; colors: ReturnType<typeof useColors>; disabled: boolean }) { return <TouchableOpacity style={[styles.action, { backgroundColor: colors.primary, opacity: disabled ? 0.6 : 1 }]} onPress={onPress} disabled={disabled}><Feather name={icon} size={14} color="#fff" /><Text style={styles.actionText}>{label}</Text></TouchableOpacity>; }
function Field({ label, value, onChange, placeholder, colors, multiline }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; colors: ReturnType<typeof useColors>; multiline?: boolean }) { return <View style={{ flex: 1, gap: 5 }}><Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text><TextInput style={[styles.input, multiline && styles.multiline, { borderColor: colors.border, color: colors.foreground }]} value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={colors.mutedForeground} multiline={multiline} /></View>; }
function Choice({ label, items, selected, onSelect, colors }: { label: string; items: Array<{ id: string; label: string }>; selected: string; onSelect: (id: string) => void; colors: ReturnType<typeof useColors> }) { return <View style={{ gap: 6 }}><Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7 }}>{items.map(item => <TouchableOpacity key={item.id} style={[styles.choice, { backgroundColor: selected === item.id ? colors.primary : colors.background, borderColor: selected === item.id ? colors.primary : colors.border }]} onPress={() => onSelect(item.id)}><Text style={[styles.choiceText, { color: selected === item.id ? '#fff' : colors.foreground }]}>{item.label}</Text></TouchableOpacity>)}</ScrollView></View>; }

const styles = StyleSheet.create({ hero: { borderRadius: 16, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 14 }, heroEyebrow: { color: 'rgba(255,255,255,0.72)', fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 1 }, heroTitle: { color: '#fff', fontSize: 21, fontFamily: 'Inter_700Bold', marginTop: 4 }, heroSub: { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 4 }, kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, kpi: { width: '48.5%', borderWidth: 1, borderRadius: 11, padding: 11 }, kpiValue: { fontSize: 18, fontFamily: 'Inter_700Bold' }, kpiLabel: { fontSize: 10, fontFamily: 'Inter_500Medium', marginTop: 2 }, filterRow: { flexDirection: 'row', gap: 6 }, filter: { flex: 1, borderWidth: 1, borderRadius: 9, paddingVertical: 8, alignItems: 'center' }, filterText: { fontSize: 9, fontFamily: 'Inter_700Bold' }, search: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 12, fontFamily: 'Inter_400Regular' }, empty: { borderWidth: 1, borderRadius: 13, padding: 28, alignItems: 'center', gap: 8 }, emptyTitle: { fontSize: 15, fontFamily: 'Inter_700Bold' }, card: { borderWidth: 1, borderRadius: 13, padding: 13, gap: 10 }, cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 }, code: { fontSize: 9, fontFamily: 'Inter_600SemiBold' }, title: { fontSize: 14, fontFamily: 'Inter_700Bold', marginTop: 2 }, sub: { fontSize: 10, fontFamily: 'Inter_400Regular', marginTop: 3 }, description: { fontSize: 11, fontFamily: 'Inter_400Regular', lineHeight: 16 }, badge: { borderRadius: 11, paddingHorizontal: 8, paddingVertical: 5 }, badgeText: { fontSize: 8, fontFamily: 'Inter_700Bold', textTransform: 'uppercase' }, metaBox: { borderRadius: 9, padding: 9, gap: 5 }, meta: { fontSize: 10, fontFamily: 'Inter_400Regular' }, progressTrack: { height: 5, borderRadius: 3, overflow: 'hidden', marginTop: 3 }, progressBar: { height: 5, borderRadius: 3 }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, action: { borderRadius: 9, paddingHorizontal: 11, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 6 }, actionText: { color: '#fff', fontSize: 10, fontFamily: 'Inter_700Bold' }, secondary: { borderWidth: 1, borderRadius: 9, paddingHorizontal: 11, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }, secondaryText: { color: '#FF9500', fontSize: 10, fontFamily: 'Inter_700Bold' }, fab: { position: 'absolute', right: 20, width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', elevation: 4 }, modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }, modalCard: { maxHeight: '94%', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 17 }, modalHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 14 }, modalTitle: { fontSize: 18, fontFamily: 'Inter_700Bold' }, modalSub: { fontSize: 10, fontFamily: 'Inter_400Regular', marginTop: 3 }, label: { fontSize: 10, fontFamily: 'Inter_600SemiBold' }, input: { borderWidth: 1, borderRadius: 9, paddingHorizontal: 11, paddingVertical: 10, fontSize: 12, fontFamily: 'Inter_400Regular' }, multiline: { minHeight: 70, textAlignVertical: 'top' }, twoCol: { flexDirection: 'row', gap: 9 }, choice: { borderWidth: 1, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 8 }, choiceText: { fontSize: 10, fontFamily: 'Inter_600SemiBold' }, save: { borderRadius: 11, paddingVertical: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, saveText: { color: '#fff', fontSize: 13, fontFamily: 'Inter_700Bold' } });
