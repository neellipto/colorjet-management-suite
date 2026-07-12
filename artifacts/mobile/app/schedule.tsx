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
  type CustomerVisit,
  type VisitPriority,
  createCustomerVisit,
  listCustomerVisits,
} from '@/lib/v12EngineerOperations';

const PRIORITIES: VisitPriority[] = ['low', 'normal', 'high', 'urgent', 'emergency'];
const PRIORITY_COLOR: Record<VisitPriority, string> = {
  low: '#8E8E93', normal: '#007AFF', high: '#FF9500', urgent: '#FF3B30', emergency: '#D70015',
};

function localInputToIso(date: string, time: string): string {
  const parsed = new Date(`${date.trim()}T${time.trim() || '09:00'}:00`);
  if (Number.isNaN(parsed.getTime())) throw new Error('Use valid date YYYY-MM-DD and time HH:MM.');
  return parsed.toISOString();
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

function formatTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function ScheduleScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { currentUser, engineers, customers, tickets } = useApp();
  const [visits, setVisits] = useState<CustomerVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    engineerId: '', customerId: '', ticketId: '', date: '', time: '09:00', duration: '120',
    priority: 'normal' as VisitPriority, address: '', latitude: '', longitude: '', radius: '200',
    slaHours: '24', contactPerson: '', phone: '', note: '',
  });

  const role = currentUser?.role ?? 'customer';
  const canManage = ['admin', 'manager', 'service_control'].includes(role);
  const pb = insets.bottom + (Platform.OS === 'web' ? 34 : 0) + 28;

  const load = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const rows = await listCustomerVisits({
        engineerId: canManage ? undefined : currentUser.id,
        limit: 500,
      });
      setVisits(rows);
    } catch (error) {
      Alert.alert('Engineer Schedule', error instanceof Error ? error.message : 'Schedule could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [canManage, currentUser]);

  useEffect(() => { void load(); }, [load]);

  const grouped = useMemo(() => {
    const result: Record<string, CustomerVisit[]> = {};
    visits.forEach(visit => {
      const key = formatDate(visit.schedule_start);
      (result[key] = result[key] ?? []).push(visit);
    });
    return result;
  }, [visits]);

  const filteredCustomers = useMemo(() => {
    const needle = customerSearch.trim().toLowerCase();
    if (!needle) return customers;
    return customers.filter(customer => `${customer.name} ${customer.phone} ${customer.address}`.toLowerCase().includes(needle));
  }, [customerSearch, customers]);

  const selectedCustomer = customers.find(customer => customer.id === form.customerId);
  const selectedEngineer = engineers.find(engineer => engineer.id === form.engineerId || engineer.userId === form.engineerId);
  const customerTickets = tickets.filter(ticket => !form.customerId || ticket.customerId === form.customerId);

  const selectCustomer = (customerId: string) => {
    const customer = customers.find(item => item.id === customerId);
    setForm(previous => ({
      ...previous,
      customerId,
      ticketId: previous.ticketId && tickets.some(ticket => ticket.id === previous.ticketId && ticket.customerId === customerId) ? previous.ticketId : '',
      address: customer?.address || previous.address,
      contactPerson: customer?.contactPerson || previous.contactPerson,
      phone: customer?.phone || previous.phone,
    }));
  };

  const selectTicket = (ticketId: string) => {
    const ticket = tickets.find(item => item.id === ticketId);
    if (!ticket) {
      setForm(previous => ({ ...previous, ticketId: '' }));
      return;
    }
    setForm(previous => ({
      ...previous,
      ticketId,
      customerId: ticket.customerId,
      address: ticket.customerAddress || previous.address,
      phone: ticket.customerPhone || previous.phone,
      priority: ticket.priority === 'emergency' ? 'emergency' : ticket.priority,
      note: previous.note || `${ticket.ticketNo}: ${ticket.title}`,
    }));
  };

  const resetForm = () => {
    setForm({
      engineerId: '', customerId: '', ticketId: '', date: '', time: '09:00', duration: '120',
      priority: 'normal', address: '', latitude: '', longitude: '', radius: '200', slaHours: '24',
      contactPerson: '', phone: '', note: '',
    });
    setCustomerSearch('');
  };

  const onCreate = async () => {
    if (!selectedEngineer) {
      Alert.alert('Required', 'Select an engineer.');
      return;
    }
    if (!selectedCustomer) {
      Alert.alert('Required', 'Select a customer.');
      return;
    }
    if (!form.address.trim()) {
      Alert.alert('Required', 'Customer service address is required.');
      return;
    }

    setSaving(true);
    try {
      const start = localInputToIso(form.date, form.time);
      const duration = Math.max(15, Number(form.duration) || 120);
      const end = new Date(new Date(start).getTime() + duration * 60_000).toISOString();
      const slaHours = Math.max(1, Number(form.slaHours) || 24);
      const slaDueAt = new Date(new Date(start).getTime() + slaHours * 3_600_000).toISOString();
      const latitude = form.latitude.trim() ? Number(form.latitude) : undefined;
      const longitude = form.longitude.trim() ? Number(form.longitude) : undefined;

      if ((latitude == null) !== (longitude == null)) throw new Error('Enter both latitude and longitude, or leave both empty.');
      if (latitude != null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) throw new Error('Latitude must be between -90 and 90.');
      if (longitude != null && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180)) throw new Error('Longitude must be between -180 and 180.');

      await createCustomerVisit({
        ticketId: form.ticketId || undefined,
        customerId: selectedCustomer.id,
        assignedEngineerId: selectedEngineer.userId || selectedEngineer.id,
        scheduleStart: start,
        scheduleEnd: end,
        expectedDurationMinutes: duration,
        priority: form.priority,
        customerName: selectedCustomer.name,
        contactPerson: form.contactPerson || selectedCustomer.contactPerson,
        customerPhone: form.phone || selectedCustomer.phone,
        serviceAddress: form.address,
        serviceLatitude: latitude,
        serviceLongitude: longitude,
        checkinRadiusM: Math.min(5000, Math.max(25, Number(form.radius) || 200)),
        slaDueAt,
        notes: form.note || undefined,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      resetForm();
      setModal(false);
      await load();
    } catch (error) {
      Alert.alert('Schedule Failed', error instanceof Error ? error.message : 'Visit could not be scheduled.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingTop: Platform.OS === 'web' ? 24 : 12, paddingBottom: pb + 62, gap: 14 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.summary, { backgroundColor: colors.primary }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.summaryEyebrow}>V12 CUSTOMER VISIT SCHEDULE</Text>
            <Text style={styles.summaryTitle}>{visits.length} visit{visits.length === 1 ? '' : 's'}</Text>
            <Text style={styles.summarySub}>{canManage ? 'Assign engineers with customer, ticket, geofence and SLA.' : 'Your assigned customer visits and current status.'}</Text>
          </View>
          <Feather name="calendar" size={29} color="#fff" />
        </View>

        {Object.keys(grouped).length === 0 && !loading ? (
          <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="calendar" size={28} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No scheduled visits</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>{canManage ? 'Tap + to assign the first V12 customer visit.' : 'New assignments will appear here.'}</Text>
          </View>
        ) : null}

        {Object.entries(grouped).map(([date, rows]) => (
          <View key={date} style={{ gap: 8 }}>
            <Text style={[styles.dateHeader, { color: colors.mutedForeground }]}>{date}</Text>
            {rows.map(visit => {
              const engineer = engineers.find(item => item.userId === visit.assigned_engineer_id || item.id === visit.assigned_engineer_id);
              return (
                <View key={visit.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={styles.cardTop}>
                    <View style={styles.timeBox}>
                      <Text style={[styles.time, { color: colors.primary }]}>{formatTime(visit.schedule_start)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.customer, { color: colors.foreground }]}>{visit.customer_name}</Text>
                      <Text style={[styles.meta, { color: colors.mutedForeground }]}>{engineer?.name || 'Engineer'} · {visit.service_address}</Text>
                    </View>
                    <View style={[styles.priority, { backgroundColor: PRIORITY_COLOR[visit.priority] + '20' }]}>
                      <Text style={[styles.priorityText, { color: PRIORITY_COLOR[visit.priority] }]}>{visit.priority}</Text>
                    </View>
                  </View>
                  <View style={[styles.footer, { borderTopColor: colors.border }]}>
                    <Text style={[styles.status, { color: colors.primary }]}>{visit.status.replaceAll('_', ' ')}</Text>
                    <View style={{ flex: 1 }} />
                    <Text style={[styles.sla, { color: colors.mutedForeground }]}>SLA {new Date(visit.sla_due_at || visit.schedule_end || visit.schedule_start).toLocaleString()}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        ))}
      </ScrollView>

      {canManage ? (
        <TouchableOpacity style={[styles.fab, { backgroundColor: colors.primary, bottom: pb }]} onPress={() => setModal(true)} activeOpacity={0.85}>
          <Feather name="plus" size={24} color="#fff" />
        </TouchableOpacity>
      ) : null}

      <Modal visible={modal} animationType="slide" transparent onRequestClose={() => setModal(false)}>
        <View style={styles.modalBg}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, paddingBottom: pb }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalTitle, { color: colors.foreground }]}>Schedule Customer Visit</Text>
                <Text style={[styles.modalSub, { color: colors.mutedForeground }]}>Real V12 assignment with SLA and geofence</Text>
              </View>
              <TouchableOpacity onPress={() => setModal(false)} hitSlop={8}><Feather name="x" size={22} color={colors.mutedForeground} /></TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 12 }} keyboardShouldPersistTaps="handled">
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Engineer *</Text>
              <View style={styles.chipGrid}>
                {engineers.map(engineer => (
                  <TouchableOpacity key={engineer.id} style={[styles.chip, { backgroundColor: form.engineerId === (engineer.userId || engineer.id) ? colors.primary : colors.background, borderColor: form.engineerId === (engineer.userId || engineer.id) ? colors.primary : colors.border }]} onPress={() => setForm(previous => ({ ...previous, engineerId: engineer.userId || engineer.id }))}>
                    <Text style={[styles.chipText, { color: form.engineerId === (engineer.userId || engineer.id) ? '#fff' : colors.foreground }]}>{engineer.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.label, { color: colors.mutedForeground }]}>Customer *</Text>
              <TextInput style={[styles.input, { color: colors.foreground, borderColor: colors.border }]} value={customerSearch} onChangeText={setCustomerSearch} placeholder="Search customer name, phone or address" placeholderTextColor={colors.mutedForeground} />
              <View style={[styles.customerList, { borderColor: colors.border }]}>
                {filteredCustomers.slice(0, 50).map(customer => (
                  <TouchableOpacity key={customer.id} style={[styles.customerOption, { backgroundColor: form.customerId === customer.id ? colors.navyLight : colors.card, borderBottomColor: colors.border }]} onPress={() => selectCustomer(customer.id)}>
                    <Text style={[styles.optionTitle, { color: colors.foreground }]}>{customer.name}</Text>
                    <Text style={[styles.optionSub, { color: colors.mutedForeground }]}>{customer.phone}{customer.address ? ` · ${customer.address}` : ''}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.label, { color: colors.mutedForeground }]}>Related Service Ticket</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                <TouchableOpacity style={[styles.chip, { backgroundColor: !form.ticketId ? colors.primary : colors.background, borderColor: !form.ticketId ? colors.primary : colors.border }]} onPress={() => selectTicket('')}><Text style={[styles.chipText, { color: !form.ticketId ? '#fff' : colors.foreground }]}>None</Text></TouchableOpacity>
                {customerTickets.map(ticket => (
                  <TouchableOpacity key={ticket.id} style={[styles.chip, { backgroundColor: form.ticketId === ticket.id ? colors.primary : colors.background, borderColor: form.ticketId === ticket.id ? colors.primary : colors.border }]} onPress={() => selectTicket(ticket.id)}>
                    <Text style={[styles.chipText, { color: form.ticketId === ticket.id ? '#fff' : colors.foreground }]}>{ticket.ticketNo}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <View style={styles.twoCol}>
                <Field label="Date *" value={form.date} placeholder="YYYY-MM-DD" onChange={value => setForm(previous => ({ ...previous, date: value }))} colors={colors} />
                <Field label="Time *" value={form.time} placeholder="HH:MM" onChange={value => setForm(previous => ({ ...previous, time: value }))} colors={colors} />
              </View>
              <View style={styles.twoCol}>
                <Field label="Duration (minutes)" value={form.duration} placeholder="120" keyboard="numeric" onChange={value => setForm(previous => ({ ...previous, duration: value }))} colors={colors} />
                <Field label="SLA (hours)" value={form.slaHours} placeholder="24" keyboard="numeric" onChange={value => setForm(previous => ({ ...previous, slaHours: value }))} colors={colors} />
              </View>

              <Text style={[styles.label, { color: colors.mutedForeground }]}>Priority</Text>
              <View style={styles.chipGrid}>
                {PRIORITIES.map(priority => (
                  <TouchableOpacity key={priority} style={[styles.chip, { backgroundColor: form.priority === priority ? PRIORITY_COLOR[priority] : colors.background, borderColor: form.priority === priority ? PRIORITY_COLOR[priority] : colors.border }]} onPress={() => setForm(previous => ({ ...previous, priority }))}>
                    <Text style={[styles.chipText, { color: form.priority === priority ? '#fff' : colors.foreground }]}>{priority}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Field label="Service Address *" value={form.address} placeholder="Customer site address" multiline onChange={value => setForm(previous => ({ ...previous, address: value }))} colors={colors} />
              <View style={styles.twoCol}>
                <Field label="Latitude" value={form.latitude} placeholder="23.8103" keyboard="decimal-pad" onChange={value => setForm(previous => ({ ...previous, latitude: value }))} colors={colors} />
                <Field label="Longitude" value={form.longitude} placeholder="90.4125" keyboard="decimal-pad" onChange={value => setForm(previous => ({ ...previous, longitude: value }))} colors={colors} />
              </View>
              <Field label="Check-in Radius (meters)" value={form.radius} placeholder="200" keyboard="numeric" onChange={value => setForm(previous => ({ ...previous, radius: value }))} colors={colors} />
              <View style={styles.twoCol}>
                <Field label="Contact Person" value={form.contactPerson} placeholder="Name" onChange={value => setForm(previous => ({ ...previous, contactPerson: value }))} colors={colors} />
                <Field label="Phone" value={form.phone} placeholder="01XXXXXXXXX" keyboard="phone-pad" onChange={value => setForm(previous => ({ ...previous, phone: value }))} colors={colors} />
              </View>
              <Field label="Visit Instructions" value={form.note} placeholder="Problem, machine, parts or access note" multiline onChange={value => setForm(previous => ({ ...previous, note: value }))} colors={colors} />

              <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary, opacity: saving ? 0.65 : 1 }]} onPress={() => void onCreate()} disabled={saving}>
                <Feather name="check" size={17} color="#fff" />
                <Text style={styles.saveText}>{saving ? 'Scheduling…' : 'Assign Visit'}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Field({ label, value, placeholder, onChange, colors, keyboard, multiline }: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  colors: ReturnType<typeof useColors>;
  keyboard?: 'default' | 'numeric' | 'decimal-pad' | 'phone-pad';
  multiline?: boolean;
}) {
  return (
    <View style={{ flex: 1, gap: 6 }}>
      <Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.multiline, { color: colors.foreground, borderColor: colors.border }]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        keyboardType={keyboard ?? 'default'}
        multiline={multiline}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  summary: { borderRadius: 16, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 14 },
  summaryEyebrow: { color: 'rgba(255,255,255,0.72)', fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 1 },
  summaryTitle: { color: '#fff', fontSize: 21, fontFamily: 'Inter_700Bold', marginTop: 4 },
  summarySub: { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 4, lineHeight: 16 },
  empty: { borderRadius: 14, borderWidth: 1, padding: 30, alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  emptyText: { fontSize: 12, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  dateHeader: { fontSize: 12, fontFamily: 'Inter_700Bold', textTransform: 'uppercase' },
  card: { borderRadius: 13, borderWidth: 1, padding: 14, gap: 11 },
  cardTop: { flexDirection: 'row', gap: 11, alignItems: 'flex-start' },
  timeBox: { minWidth: 58 },
  time: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  customer: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  meta: { fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 3, lineHeight: 16 },
  priority: { borderRadius: 12, paddingHorizontal: 9, paddingVertical: 5 },
  priorityText: { fontSize: 9, fontFamily: 'Inter_700Bold', textTransform: 'uppercase' },
  footer: { flexDirection: 'row', alignItems: 'center', paddingTop: 9, borderTopWidth: StyleSheet.hairlineWidth },
  status: { fontSize: 10, fontFamily: 'Inter_700Bold', textTransform: 'uppercase' },
  sla: { fontSize: 9, fontFamily: 'Inter_400Regular' },
  fab: { position: 'absolute', right: 20, width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', elevation: 4, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalCard: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 18, maxHeight: '94%' },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 },
  modalTitle: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  modalSub: { fontSize: 10, fontFamily: 'Inter_400Regular', marginTop: 3 },
  label: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 13, fontFamily: 'Inter_400Regular' },
  multiline: { minHeight: 72, textAlignVertical: 'top' },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { borderWidth: 1, borderRadius: 9, paddingHorizontal: 11, paddingVertical: 8 },
  chipText: { fontSize: 11, fontFamily: 'Inter_600SemiBold', textTransform: 'capitalize' },
  customerList: { maxHeight: 190, borderWidth: 1, borderRadius: 10, overflow: 'hidden' },
  customerOption: { padding: 11, borderBottomWidth: StyleSheet.hairlineWidth },
  optionTitle: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  optionSub: { fontSize: 10, fontFamily: 'Inter_400Regular', marginTop: 2 },
  twoCol: { flexDirection: 'row', gap: 10 },
  saveBtn: { borderRadius: 12, paddingVertical: 14, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 4 },
  saveText: { color: '#fff', fontSize: 14, fontFamily: 'Inter_700Bold' },
});
