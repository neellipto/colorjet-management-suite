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
  type ServiceTicketRecord,
  type SlaAlertRecord,
  createServiceTicket,
  listOpenSlaAlerts,
  listServiceTickets,
  scanSlaBreaches,
} from '@/lib/v12ServiceWarranty';

const PRIORITIES = ['low', 'normal', 'high', 'urgent', 'emergency'] as const;
const PRIORITY_COLOR: Record<(typeof PRIORITIES)[number], string> = {
  low: '#8E8E93', normal: '#007AFF', high: '#FF9500', urgent: '#FF3B30', emergency: '#D70015',
};

export default function ServiceWarrantyScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { currentUser, customers, engineers } = useApp();
  const [tickets, setTickets] = useState<ServiceTicketRecord[]>([]);
  const [alerts, setAlerts] = useState<SlaAlertRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [form, setForm] = useState({
    customerId: '', engineerId: '', ticketType: 'service', title: '', description: '',
    priority: 'normal' as (typeof PRIORITIES)[number], contactPerson: '', phone: '',
    address: '', category: '', responseMinutes: '30', arrivalMinutes: '240', resolutionMinutes: '1440',
  });

  const role = currentUser?.role ?? 'customer';
  const canManage = ['admin', 'manager', 'service_control'].includes(role);
  const pb = insets.bottom + (Platform.OS === 'web' ? 34 : 0) + 28;

  const load = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      if (canManage) await scanSlaBreaches();
      const [ticketRows, alertRows] = await Promise.all([
        listServiceTickets({ engineerId: role === 'engineer' ? currentUser.id : undefined }),
        canManage ? listOpenSlaAlerts() : Promise.resolve([]),
      ]);
      setTickets(ticketRows);
      setAlerts(alertRows);
    } catch (error) {
      Alert.alert('Service & Warranty', error instanceof Error ? error.message : 'Data could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [canManage, currentUser, role]);

  useEffect(() => { void load(); }, [load]);

  const stats = useMemo(() => ({
    open: tickets.filter(ticket => !['resolved', 'customer_confirmed', 'closed', 'cancelled', 'rejected'].includes(ticket.status)).length,
    warranty: tickets.filter(ticket => ticket.warranty_decision === 'covered').length,
    waitingParts: tickets.filter(ticket => ticket.status === 'waiting_parts').length,
    slaRisk: alerts.filter(alert => ['near_breach', 'breached', 'critical'].includes(alert.severity)).length,
  }), [alerts, tickets]);

  const filteredCustomers = useMemo(() => {
    const needle = customerSearch.trim().toLowerCase();
    if (!needle) return customers;
    return customers.filter(customer => `${customer.name} ${customer.phone} ${customer.address}`.toLowerCase().includes(needle));
  }, [customerSearch, customers]);

  const selectedCustomer = customers.find(customer => customer.id === form.customerId);

  const selectCustomer = (customerId: string) => {
    const customer = customers.find(item => item.id === customerId);
    setForm(previous => ({
      ...previous,
      customerId,
      contactPerson: customer?.contactPerson || '',
      phone: customer?.phone || '',
      address: customer?.address || '',
    }));
  };

  const reset = () => {
    setForm({
      customerId: '', engineerId: '', ticketType: 'service', title: '', description: '',
      priority: 'normal', contactPerson: '', phone: '', address: '', category: '',
      responseMinutes: '30', arrivalMinutes: '240', resolutionMinutes: '1440',
    });
    setCustomerSearch('');
  };

  const create = async () => {
    if (!selectedCustomer) return Alert.alert('Required', 'Select a customer.');
    if (!form.title.trim() || !form.description.trim()) return Alert.alert('Required', 'Title and description are required.');
    if (!form.address.trim()) return Alert.alert('Required', 'Service address is required.');

    setSaving(true);
    try {
      await createServiceTicket({
        customerId: selectedCustomer.id,
        ticketType: form.ticketType,
        title: form.title,
        description: form.description,
        priority: form.priority,
        customerName: selectedCustomer.name,
        contactPerson: form.contactPerson,
        customerPhone: form.phone,
        serviceAddress: form.address,
        problemCategory: form.category,
        assignedEngineerId: form.engineerId || undefined,
        responseMinutes: Math.max(1, Number(form.responseMinutes) || 30),
        arrivalMinutes: Math.max(1, Number(form.arrivalMinutes) || 240),
        resolutionMinutes: Math.max(1, Number(form.resolutionMinutes) || 1440),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      reset();
      setModal(false);
      await load();
    } catch (error) {
      Alert.alert('Create Failed', error instanceof Error ? error.message : 'Service ticket could not be created.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingTop: Platform.OS === 'web' ? 24 : 12, paddingBottom: pb + 70, gap: 14 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.hero, { backgroundColor: colors.primary }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroEyebrow}>V12 SERVICE & WARRANTY CONTROL</Text>
            <Text style={styles.heroTitle}>Service Operations</Text>
            <Text style={styles.heroSub}>Ticket, warranty coverage, diagnostics, cost and SLA control</Text>
          </View>
          <Feather name="shield" size={30} color="#fff" />
        </View>

        <View style={styles.kpiGrid}>
          {[
            ['tool', 'Open Tickets', stats.open, '#007AFF'],
            ['shield', 'Warranty', stats.warranty, '#34C759'],
            ['package', 'Waiting Parts', stats.waitingParts, '#FF9500'],
            ['alert-triangle', 'SLA Risk', stats.slaRisk, '#D70015'],
          ].map(([icon, label, value, color]) => (
            <View key={String(label)} style={[styles.kpi, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name={icon as keyof typeof Feather.glyphMap} size={18} color={String(color)} />
              <Text style={[styles.kpiValue, { color: colors.foreground }]}>{String(value)}</Text>
              <Text style={[styles.kpiLabel, { color: colors.mutedForeground }]}>{String(label)}</Text>
            </View>
          ))}
        </View>

        {alerts.length > 0 && canManage ? (
          <View style={{ gap: 8 }}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Automatic SLA Alerts</Text>
            {alerts.slice(0, 6).map(alert => (
              <View key={alert.id} style={[styles.alertCard, { backgroundColor: '#FFF3E0', borderColor: '#FFB74D' }]}>
                <Feather name="alert-triangle" size={18} color="#E65100" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.alertTitle}>{alert.message}</Text>
                  <Text style={styles.alertMeta}>{String(alert.notification_payload.ticket_no || '')} · Due {new Date(alert.due_at).toLocaleString()}</Text>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Service Tickets</Text>
        {!loading && tickets.length === 0 ? (
          <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="inbox" size={28} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No service tickets</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Create the first production service ticket from the + button.</Text>
          </View>
        ) : null}

        {tickets.map(ticket => (
          <View key={ticket.id} style={[styles.ticketCard, { backgroundColor: colors.card, borderColor: ticket.status === 'sla_breached' ? '#D70015' : colors.border }]}>
            <View style={styles.ticketTop}>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={[styles.ticketNo, { color: colors.mutedForeground }]}>{ticket.ticket_no}</Text>
                <Text style={[styles.ticketTitle, { color: colors.foreground }]}>{ticket.title}</Text>
                <Text style={[styles.customer, { color: colors.mutedForeground }]}>{ticket.customer_name} · {ticket.machine_model || 'Machine not linked'}</Text>
              </View>
              <View style={[styles.priority, { backgroundColor: PRIORITY_COLOR[ticket.priority] + '20' }]}>
                <Text style={[styles.priorityText, { color: PRIORITY_COLOR[ticket.priority] }]}>{ticket.priority}</Text>
              </View>
            </View>
            <View style={[styles.ticketMetaBox, { backgroundColor: colors.background }]}>
              <Text style={[styles.metaLine, { color: colors.mutedForeground }]}>Status: {ticket.status.replaceAll('_', ' ')}</Text>
              <Text style={[styles.metaLine, { color: ticket.warranty_decision === 'covered' ? '#2E7D32' : colors.mutedForeground }]}>Warranty: {ticket.warranty_decision.replaceAll('_', ' ')}</Text>
              <Text style={[styles.metaLine, { color: colors.mutedForeground }]}>Resolution SLA: {ticket.resolution_due_at ? new Date(ticket.resolution_due_at).toLocaleString() : 'Not set'}</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      {canManage ? (
        <TouchableOpacity style={[styles.fab, { backgroundColor: colors.primary, bottom: pb }]} onPress={() => setModal(true)}>
          <Feather name="plus" size={24} color="#fff" />
        </TouchableOpacity>
      ) : null}

      <Modal visible={modal} transparent animationType="slide" onRequestClose={() => setModal(false)}>
        <View style={styles.modalBg}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, paddingBottom: pb }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalTitle, { color: colors.foreground }]}>Create Service Ticket</Text>
                <Text style={[styles.modalSub, { color: colors.mutedForeground }]}>Warranty and SLA will be calculated from server rules.</Text>
              </View>
              <TouchableOpacity onPress={() => setModal(false)}><Feather name="x" size={22} color={colors.mutedForeground} /></TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ gap: 12 }} keyboardShouldPersistTaps="handled">
              <Field label="Customer Search" value={customerSearch} onChange={setCustomerSearch} placeholder="Name, phone or address" colors={colors} />
              <View style={[styles.customerList, { borderColor: colors.border }]}>
                {filteredCustomers.slice(0, 30).map(customer => (
                  <TouchableOpacity key={customer.id} style={[styles.customerOption, { backgroundColor: form.customerId === customer.id ? colors.navyLight : colors.card, borderBottomColor: colors.border }]} onPress={() => selectCustomer(customer.id)}>
                    <Text style={[styles.optionTitle, { color: colors.foreground }]}>{customer.name}</Text>
                    <Text style={[styles.optionSub, { color: colors.mutedForeground }]}>{customer.phone} · {customer.address}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.label, { color: colors.mutedForeground }]}>Engineer</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                <TouchableOpacity style={[styles.chip, { backgroundColor: !form.engineerId ? colors.primary : colors.background, borderColor: !form.engineerId ? colors.primary : colors.border }]} onPress={() => setForm(previous => ({ ...previous, engineerId: '' }))}><Text style={[styles.chipText, { color: !form.engineerId ? '#fff' : colors.foreground }]}>Unassigned</Text></TouchableOpacity>
                {engineers.map(engineer => (
                  <TouchableOpacity key={engineer.id} style={[styles.chip, { backgroundColor: form.engineerId === (engineer.userId || engineer.id) ? colors.primary : colors.background, borderColor: form.engineerId === (engineer.userId || engineer.id) ? colors.primary : colors.border }]} onPress={() => setForm(previous => ({ ...previous, engineerId: engineer.userId || engineer.id }))}>
                    <Text style={[styles.chipText, { color: form.engineerId === (engineer.userId || engineer.id) ? '#fff' : colors.foreground }]}>{engineer.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Field label="Title *" value={form.title} onChange={value => setForm(previous => ({ ...previous, title: value }))} placeholder="Machine problem title" colors={colors} />
              <Field label="Description *" value={form.description} onChange={value => setForm(previous => ({ ...previous, description: value }))} placeholder="Detailed problem description" colors={colors} multiline />
              <Field label="Problem Category" value={form.category} onChange={value => setForm(previous => ({ ...previous, category: value }))} placeholder="Electrical, mechanical, ink, software..." colors={colors} />
              <Field label="Service Address *" value={form.address} onChange={value => setForm(previous => ({ ...previous, address: value }))} placeholder="Customer site address" colors={colors} multiline />

              <Text style={[styles.label, { color: colors.mutedForeground }]}>Priority</Text>
              <View style={styles.chipGrid}>
                {PRIORITIES.map(priority => (
                  <TouchableOpacity key={priority} style={[styles.chip, { backgroundColor: form.priority === priority ? PRIORITY_COLOR[priority] : colors.background, borderColor: form.priority === priority ? PRIORITY_COLOR[priority] : colors.border }]} onPress={() => setForm(previous => ({ ...previous, priority }))}>
                    <Text style={[styles.chipText, { color: form.priority === priority ? '#fff' : colors.foreground }]}>{priority}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.twoCol}>
                <Field label="Response SLA min" value={form.responseMinutes} onChange={value => setForm(previous => ({ ...previous, responseMinutes: value }))} placeholder="30" colors={colors} keyboard="numeric" />
                <Field label="Arrival SLA min" value={form.arrivalMinutes} onChange={value => setForm(previous => ({ ...previous, arrivalMinutes: value }))} placeholder="240" colors={colors} keyboard="numeric" />
              </View>
              <Field label="Resolution SLA min" value={form.resolutionMinutes} onChange={value => setForm(previous => ({ ...previous, resolutionMinutes: value }))} placeholder="1440" colors={colors} keyboard="numeric" />

              <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary, opacity: saving ? 0.65 : 1 }]} onPress={() => void create()} disabled={saving}>
                <Feather name="check" size={17} color="#fff" />
                <Text style={styles.saveText}>{saving ? 'Creating…' : 'Create Ticket'}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Field({ label, value, onChange, placeholder, colors, multiline, keyboard }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  colors: ReturnType<typeof useColors>;
  multiline?: boolean;
  keyboard?: 'default' | 'numeric';
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
        multiline={multiline}
        keyboardType={keyboard ?? 'default'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: 16, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 14 },
  heroEyebrow: { color: 'rgba(255,255,255,0.72)', fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 1 },
  heroTitle: { color: '#fff', fontSize: 22, fontFamily: 'Inter_700Bold', marginTop: 4 },
  heroSub: { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 4 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kpi: { width: '48.5%', borderRadius: 12, borderWidth: 1, padding: 13, gap: 3 },
  kpiValue: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  kpiLabel: { fontSize: 11, fontFamily: 'Inter_500Medium' },
  sectionTitle: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  alertCard: { borderRadius: 12, borderWidth: 1, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 9 },
  alertTitle: { color: '#E65100', fontSize: 11, fontFamily: 'Inter_700Bold' },
  alertMeta: { color: '#8D4B00', fontSize: 9, fontFamily: 'Inter_400Regular', marginTop: 3 },
  empty: { borderRadius: 14, borderWidth: 1, padding: 28, alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  emptyText: { fontSize: 12, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  ticketCard: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 11 },
  ticketTop: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  ticketNo: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  ticketTitle: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  customer: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  priority: { borderRadius: 12, paddingHorizontal: 9, paddingVertical: 5 },
  priorityText: { fontSize: 9, fontFamily: 'Inter_700Bold', textTransform: 'uppercase' },
  ticketMetaBox: { borderRadius: 10, padding: 10, gap: 5 },
  metaLine: { fontSize: 10, fontFamily: 'Inter_500Medium', textTransform: 'capitalize' },
  fab: { position: 'absolute', right: 20, width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', elevation: 4 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalCard: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 18, maxHeight: '94%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  modalTitle: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  modalSub: { fontSize: 10, fontFamily: 'Inter_400Regular', marginTop: 3 },
  label: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 13, fontFamily: 'Inter_400Regular' },
  multiline: { minHeight: 72, textAlignVertical: 'top' },
  customerList: { maxHeight: 180, borderWidth: 1, borderRadius: 10, overflow: 'hidden' },
  customerOption: { padding: 11, borderBottomWidth: StyleSheet.hairlineWidth },
  optionTitle: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  optionSub: { fontSize: 10, fontFamily: 'Inter_400Regular', marginTop: 2 },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { borderWidth: 1, borderRadius: 9, paddingHorizontal: 11, paddingVertical: 8 },
  chipText: { fontSize: 11, fontFamily: 'Inter_600SemiBold', textTransform: 'capitalize' },
  twoCol: { flexDirection: 'row', gap: 10 },
  saveBtn: { borderRadius: 12, paddingVertical: 14, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  saveText: { color: '#fff', fontSize: 14, fontFamily: 'Inter_700Bold' },
});
