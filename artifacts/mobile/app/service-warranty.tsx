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
  type ServiceCase,
  type ServiceCaseStatus,
  type WarrantyCheckResult,
  type WarrantyRegistration,
  checkWarranty,
  createServiceCase,
  listServiceCases,
  listSlaAlerts,
  listWarranties,
  registerWarranty,
  transitionServiceCase,
} from '@/lib/v13BusinessOperations';

const PRIORITIES: ServiceCase['priority'][] = ['low', 'normal', 'high', 'urgent', 'emergency'];
const SERVICE_TYPES: ServiceCase['service_type'][] = ['onsite', 'remote', 'office_repair', 'supplier_repair', 'installation', 'training', 'preventive_maintenance'];
const STATUS_COLORS: Record<string, string> = {
  new: '#0A84FF', verified: '#5856D6', assigned: '#007AFF', accepted: '#5E5CE6', travelling: '#32ADE6',
  arrived: '#30B0C7', checked_in: '#00A6A6', diagnosis: '#BF5AF2', work_started: '#1A237E', waiting_parts: '#FF9500',
  waiting_customer: '#FF9F0A', sent_supplier: '#AF52DE', work_resumed: '#1A237E', completed: '#34C759',
  customer_confirmed: '#2E7D32', closed: '#2E7D32', reopened: '#FF9500', cancelled: '#8E8E93',
  escalated: '#FF453A', sla_breached: '#D70015',
};

function nextAction(status: ServiceCaseStatus): { label: string; next: ServiceCaseStatus; icon: keyof typeof Feather.glyphMap } | null {
  switch (status) {
    case 'new': return { label: 'Verify', next: 'verified', icon: 'check-circle' };
    case 'verified': return { label: 'Assign Ready', next: 'assigned', icon: 'user-check' };
    case 'assigned': return { label: 'Accept', next: 'accepted', icon: 'check' };
    case 'accepted': return { label: 'Start Travel', next: 'travelling', icon: 'navigation' };
    case 'travelling': return { label: 'Arrived', next: 'arrived', icon: 'map-pin' };
    case 'arrived': return { label: 'Check In', next: 'checked_in', icon: 'crosshair' };
    case 'checked_in': return { label: 'Diagnose', next: 'diagnosis', icon: 'search' };
    case 'diagnosis': return { label: 'Start Work', next: 'work_started', icon: 'play-circle' };
    case 'waiting_parts':
    case 'waiting_customer':
    case 'sent_supplier': return { label: 'Resume Work', next: 'work_resumed', icon: 'play' };
    case 'work_started':
    case 'work_resumed': return { label: 'Complete', next: 'completed', icon: 'flag' };
    case 'completed': return { label: 'Customer Confirm', next: 'customer_confirmed', icon: 'user-check' };
    case 'customer_confirmed': return { label: 'Close', next: 'closed', icon: 'archive' };
    case 'reopened': return { label: 'Start Diagnosis', next: 'diagnosis', icon: 'tool' };
    case 'sla_breached':
    case 'escalated': return { label: 'Resume Work', next: 'work_started', icon: 'activity' };
    default: return null;
  }
}

function formatDate(value?: string | null): string {
  if (!value) return 'Not set';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function isoFromLocal(value: string): string | undefined {
  if (!value.trim()) return undefined;
  const date = new Date(value.trim());
  if (Number.isNaN(date.getTime())) throw new Error('Use a valid date or date-time.');
  return date.toISOString();
}

export default function ServiceWarrantyScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { currentUser, customers, products, engineers, invoices } = useApp();
  const [tab, setTab] = useState<'cases' | 'warranty'>('cases');
  const [cases, setCases] = useState<ServiceCase[]>([]);
  const [warranties, setWarranties] = useState<WarrantyRegistration[]>([]);
  const [alertCount, setAlertCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [caseModal, setCaseModal] = useState(false);
  const [warrantyModal, setWarrantyModal] = useState(false);
  const [checkSerial, setCheckSerial] = useState('');
  const [checkResult, setCheckResult] = useState<WarrantyCheckResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [caseForm, setCaseForm] = useState({
    customerId: '', productId: '', engineerId: '', machineSerial: '', machineModel: '',
    subject: '', description: '', category: '', serviceType: 'onsite' as ServiceCase['service_type'],
    priority: 'normal' as ServiceCase['priority'], scheduledAt: '', responseMinutes: '30',
    arrivalMinutes: '240', resolutionMinutes: '1440',
  });
  const [warrantyForm, setWarrantyForm] = useState({
    customerId: '', productId: '', invoiceId: '', machineSerial: '', machineModel: '', machineName: '',
    saleDate: '', installationDate: '', warrantyStart: '', warrantyEnd: '', engineerServiceEnd: '',
    coverage: 'mainboard, headboard, servo_motor, driver',
    exclusions: 'printhead, small_spares, consumables, physical_damage, voltage_damage',
    terms: '',
  });

  const role = currentUser?.role ?? 'customer';
  const canManage = ['admin', 'manager', 'service_control'].includes(role);
  const canRegisterWarranty = canManage || role === 'sales';
  const pb = insets.bottom + (Platform.OS === 'web' ? 34 : 0) + 26;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [caseRows, warrantyRows, alerts] = await Promise.all([
        listServiceCases(), listWarranties(), listSlaAlerts(),
      ]);
      setCases(caseRows);
      setWarranties(warrantyRows);
      setAlertCount(alerts.filter(item => !item.resolved_at).length);
    } catch (error) {
      Alert.alert('Service & Warranty', error instanceof Error ? error.message : 'Data could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const visibleCases = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const rows = canManage || role === 'accounts' || role === 'store'
      ? cases
      : cases.filter(item => item.assigned_engineer_id === currentUser?.id || item.source === 'mobile');
    if (!needle) return rows;
    return rows.filter(item => `${item.case_no} ${item.customer_name} ${item.machine_serial ?? ''} ${item.machine_model ?? ''} ${item.subject}`.toLowerCase().includes(needle));
  }, [canManage, cases, currentUser?.id, role, search]);

  const visibleWarranties = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return warranties;
    return warranties.filter(item => `${item.warranty_no} ${item.machine_serial} ${item.machine_model} ${item.machine_name ?? ''}`.toLowerCase().includes(needle));
  }, [search, warranties]);

  const kpi = useMemo(() => ({
    open: cases.filter(item => !['completed', 'customer_confirmed', 'closed', 'cancelled'].includes(item.status)).length,
    waitingParts: cases.filter(item => item.status === 'waiting_parts').length,
    warranty: cases.filter(item => item.warranty_status === 'in_warranty').length,
    breached: cases.filter(item => item.status === 'sla_breached').length || alertCount,
  }), [alertCount, cases]);

  const submitCase = async () => {
    const customer = customers.find(item => item.id === caseForm.customerId);
    const product = products.find(item => item.id === caseForm.productId);
    if (!customer) return Alert.alert('Required', 'Select a customer.');
    if (!caseForm.subject.trim() || !caseForm.description.trim()) return Alert.alert('Required', 'Subject and problem description are required.');

    setWorkingId('new-case');
    try {
      await createServiceCase({
        customerId: customer.id,
        productId: product?.id,
        machineSerial: caseForm.machineSerial || undefined,
        machineModel: caseForm.machineModel || product?.name,
        customerName: customer.name,
        customerPhone: customer.phone,
        serviceAddress: customer.address,
        subject: caseForm.subject,
        problemDescription: caseForm.description,
        problemCategory: caseForm.category || undefined,
        serviceType: caseForm.serviceType,
        priority: caseForm.priority,
        assignedEngineerId: caseForm.engineerId || undefined,
        scheduledAt: isoFromLocal(caseForm.scheduledAt),
        responseMinutes: Number(caseForm.responseMinutes) || 30,
        arrivalMinutes: Number(caseForm.arrivalMinutes) || 240,
        resolutionMinutes: Number(caseForm.resolutionMinutes) || 1440,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCaseModal(false);
      setCaseForm({ customerId: '', productId: '', engineerId: '', machineSerial: '', machineModel: '', subject: '', description: '', category: '', serviceType: 'onsite', priority: 'normal', scheduledAt: '', responseMinutes: '30', arrivalMinutes: '240', resolutionMinutes: '1440' });
      await load();
    } catch (error) {
      Alert.alert('Service Case', error instanceof Error ? error.message : 'Service case could not be created.');
    } finally {
      setWorkingId(null);
    }
  };

  const submitWarranty = async () => {
    if (!warrantyForm.machineSerial.trim() || !warrantyForm.machineModel.trim() || !warrantyForm.warrantyStart || !warrantyForm.warrantyEnd) {
      return Alert.alert('Required', 'Serial, model, warranty start and warranty end are required.');
    }
    setWorkingId('new-warranty');
    try {
      await registerWarranty({
        customerId: warrantyForm.customerId || undefined,
        productId: warrantyForm.productId || undefined,
        invoiceId: warrantyForm.invoiceId || undefined,
        machineSerial: warrantyForm.machineSerial,
        machineModel: warrantyForm.machineModel,
        machineName: warrantyForm.machineName || undefined,
        saleDate: warrantyForm.saleDate || undefined,
        installationDate: warrantyForm.installationDate || undefined,
        warrantyStart: warrantyForm.warrantyStart,
        warrantyEnd: warrantyForm.warrantyEnd,
        engineerServiceEnd: warrantyForm.engineerServiceEnd || undefined,
        coverage: warrantyForm.coverage.split(',').map(item => item.trim()).filter(Boolean),
        exclusions: warrantyForm.exclusions.split(',').map(item => item.trim()).filter(Boolean),
        terms: warrantyForm.terms || undefined,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setWarrantyModal(false);
      await load();
    } catch (error) {
      Alert.alert('Warranty Registration', error instanceof Error ? error.message : 'Warranty could not be registered.');
    } finally {
      setWorkingId(null);
    }
  };

  const runWarrantyCheck = async () => {
    if (!checkSerial.trim()) return;
    setChecking(true);
    try {
      const result = await checkWarranty(checkSerial);
      setCheckResult(result);
      if (!result) Alert.alert('Warranty Check', 'No registration found for this machine serial.');
    } catch (error) {
      Alert.alert('Warranty Check', error instanceof Error ? error.message : 'Warranty could not be checked.');
    } finally {
      setChecking(false);
    }
  };

  const transition = async (item: ServiceCase, next: ServiceCaseStatus) => {
    setWorkingId(item.id);
    try {
      await transitionServiceCase({
        serviceCaseId: item.id,
        newStatus: next,
        idempotencyKey: `${item.id}:${next}:${Date.now()}`,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await load();
    } catch (error) {
      Alert.alert('Service Case', error instanceof Error ? error.message : 'Status could not be updated.');
    } finally {
      setWorkingId(null);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingTop: Platform.OS === 'web' ? 24 : 12, paddingBottom: pb + 72, gap: 13 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.hero, { backgroundColor: colors.primary }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroEyebrow}>COLORJET SERVICE CONTROL</Text>
            <Text style={styles.heroTitle}>Service & Warranty Center</Text>
            <Text style={styles.heroSub}>Machine serial validity, engineer workflow, cost and SLA control</Text>
          </View>
          <Feather name="shield" size={30} color="#fff" />
        </View>

        <View style={styles.kpiGrid}>
          {[
            ['activity', 'Open Cases', kpi.open, '#007AFF'],
            ['package', 'Waiting Parts', kpi.waitingParts, '#FF9500'],
            ['shield', 'In Warranty', kpi.warranty, '#34C759'],
            ['alert-triangle', 'SLA Risk', kpi.breached, '#D70015'],
          ].map(([icon, label, value, color]) => (
            <View key={String(label)} style={[styles.kpi, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name={icon as keyof typeof Feather.glyphMap} size={17} color={String(color)} />
              <Text style={[styles.kpiValue, { color: colors.foreground }]}>{String(value)}</Text>
              <Text style={[styles.kpiLabel, { color: colors.mutedForeground }]}>{String(label)}</Text>
            </View>
          ))}
        </View>

        <View style={[styles.checkBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Check Warranty Validity</Text>
            <TextInput style={[styles.input, { borderColor: colors.border, color: colors.foreground }]} value={checkSerial} onChangeText={setCheckSerial} placeholder="Machine serial number" placeholderTextColor={colors.mutedForeground} autoCapitalize="characters" />
          </View>
          <TouchableOpacity style={[styles.checkButton, { backgroundColor: colors.primary }]} onPress={() => void runWarrantyCheck()} disabled={checking}>
            <Feather name="search" size={17} color="#fff" />
          </TouchableOpacity>
        </View>

        {checkResult ? (
          <View style={[styles.validity, { backgroundColor: checkResult.validity === 'valid' ? '#E8F5E9' : '#FFEBEE', borderColor: checkResult.validity === 'valid' ? '#81C784' : '#EF9A9A' }]}>
            <Feather name={checkResult.validity === 'valid' ? 'check-circle' : 'alert-circle'} size={20} color={checkResult.validity === 'valid' ? '#2E7D32' : '#C62828'} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.validityTitle, { color: checkResult.validity === 'valid' ? '#2E7D32' : '#C62828' }]}>{checkResult.validity.toUpperCase()} · {checkResult.warranty_no}</Text>
              <Text style={styles.validityText}>{checkResult.machine_model} · Ends {checkResult.warranty_end} · {checkResult.remaining_days} days</Text>
            </View>
          </View>
        ) : null}

        <View style={styles.tabRow}>
          {(['cases', 'warranty'] as const).map(value => (
            <TouchableOpacity key={value} style={[styles.tab, { backgroundColor: tab === value ? colors.primary : colors.card, borderColor: tab === value ? colors.primary : colors.border }]} onPress={() => setTab(value)}>
              <Text style={[styles.tabText, { color: tab === value ? '#fff' : colors.foreground }]}>{value === 'cases' ? 'Service Cases' : 'Warranty Register'}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TextInput style={[styles.search, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]} value={search} onChangeText={setSearch} placeholder={tab === 'cases' ? 'Search case, customer, serial or model' : 'Search warranty or machine serial'} placeholderTextColor={colors.mutedForeground} />

        {tab === 'cases' ? visibleCases.map(item => {
          const action = nextAction(item.status);
          const statusColor = STATUS_COLORS[item.status] ?? colors.primary;
          const overdue = Boolean(item.resolution_due_at && new Date(item.resolution_due_at).getTime() < Date.now() && !['completed', 'customer_confirmed', 'closed', 'cancelled'].includes(item.status));
          return (
            <View key={item.id} style={[styles.card, { backgroundColor: colors.card, borderColor: overdue ? '#D70015' : colors.border }]}>
              <View style={styles.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.code, { color: colors.mutedForeground }]}>{item.case_no}</Text>
                  <Text style={[styles.cardTitle, { color: colors.foreground }]}>{item.customer_name}</Text>
                  <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>{item.subject}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: `${statusColor}20` }]}>
                  <Text style={[styles.statusText, { color: statusColor }]}>{item.status.replaceAll('_', ' ')}</Text>
                </View>
              </View>
              <View style={[styles.metaBox, { backgroundColor: colors.background }]}>
                <Text style={[styles.meta, { color: colors.mutedForeground }]}>Machine: {item.machine_model || 'Not set'} · Serial: {item.machine_serial || 'Not set'}</Text>
                <Text style={[styles.meta, { color: item.warranty_status === 'in_warranty' ? '#2E7D32' : colors.mutedForeground }]}>Warranty: {item.warranty_status.replaceAll('_', ' ')} · Billing: {item.billing_status}</Text>
                <Text style={[styles.meta, { color: overdue ? '#D70015' : colors.mutedForeground }]}>Resolution SLA: {formatDate(item.resolution_due_at)}</Text>
              </View>
              <View style={styles.actions}>
                {action ? (
                  <TouchableOpacity style={[styles.primaryAction, { backgroundColor: colors.primary, opacity: workingId === item.id ? 0.6 : 1 }]} onPress={() => void transition(item, action.next)} disabled={workingId !== null}>
                    <Feather name={action.icon} size={14} color="#fff" />
                    <Text style={styles.primaryActionText}>{workingId === item.id ? 'Processing…' : action.label}</Text>
                  </TouchableOpacity>
                ) : null}
                {['diagnosis', 'work_started', 'work_resumed'].includes(item.status) ? (
                  <TouchableOpacity style={[styles.secondaryAction, { borderColor: '#FF9500' }]} onPress={() => void transition(item, 'waiting_parts')} disabled={workingId !== null}>
                    <Feather name="package" size={14} color="#FF9500" />
                    <Text style={[styles.secondaryActionText, { color: '#FF9500' }]}>Waiting Parts</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          );
        }) : visibleWarranties.map(item => {
          const expired = new Date(item.warranty_end).getTime() < Date.now() || item.status !== 'active';
          return (
            <View key={item.id} style={[styles.card, { backgroundColor: colors.card, borderColor: expired ? '#EF9A9A' : colors.border }]}>
              <View style={styles.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.code, { color: colors.mutedForeground }]}>{item.warranty_no}</Text>
                  <Text style={[styles.cardTitle, { color: colors.foreground }]}>{item.machine_model}</Text>
                  <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>Serial: {item.machine_serial}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: expired ? '#FFEBEE' : '#E8F5E9' }]}>
                  <Text style={[styles.statusText, { color: expired ? '#C62828' : '#2E7D32' }]}>{expired ? 'EXPIRED/VOID' : 'ACTIVE'}</Text>
                </View>
              </View>
              <Text style={[styles.meta, { color: colors.mutedForeground }]}>Warranty: {item.warranty_start} → {item.warranty_end}</Text>
              <Text style={[styles.meta, { color: colors.mutedForeground }]}>Covered: {(item.coverage ?? []).join(', ') || 'Not specified'}</Text>
              <Text style={[styles.meta, { color: colors.mutedForeground }]}>Excluded: {(item.exclusions ?? []).join(', ') || 'Not specified'}</Text>
            </View>
          );
        })}
      </ScrollView>

      <View style={[styles.fabStack, { bottom: pb }]}>
        {canRegisterWarranty ? (
          <TouchableOpacity style={[styles.fabSecondary, { backgroundColor: '#2E7D32' }]} onPress={() => setWarrantyModal(true)}>
            <Feather name="shield" size={20} color="#fff" />
          </TouchableOpacity>
        ) : null}
        {(canManage || role === 'engineer' || role === 'sales') ? (
          <TouchableOpacity style={[styles.fab, { backgroundColor: colors.primary }]} onPress={() => setCaseModal(true)}>
            <Feather name="plus" size={24} color="#fff" />
          </TouchableOpacity>
        ) : null}
      </View>

      <Modal visible={caseModal} animationType="slide" transparent onRequestClose={() => setCaseModal(false)}>
        <View style={styles.modalBg}><View style={[styles.modalCard, { backgroundColor: colors.card, paddingBottom: pb }]}>
          <ModalHeader title="Create Service Case" subtitle="Customer, machine, engineer and SLA" onClose={() => setCaseModal(false)} colors={colors} />
          <ScrollView contentContainerStyle={{ gap: 11 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Choice label="Customer *" items={customers.map(item => ({ id: item.id, label: item.name }))} selected={caseForm.customerId} onSelect={id => setCaseForm(previous => ({ ...previous, customerId: id }))} colors={colors} />
            <Choice label="Product / Machine" items={products.filter(item => item.productType === 'machine').map(item => ({ id: item.id, label: item.name }))} selected={caseForm.productId} onSelect={id => {
              const product = products.find(item => item.id === id);
              setCaseForm(previous => ({ ...previous, productId: id, machineModel: previous.machineModel || product?.name || '' }));
            }} colors={colors} />
            <Choice label="Engineer" items={engineers.map(item => ({ id: item.userId || item.id, label: item.name }))} selected={caseForm.engineerId} onSelect={id => setCaseForm(previous => ({ ...previous, engineerId: id }))} colors={colors} />
            <View style={styles.twoCol}><Field label="Machine Serial" value={caseForm.machineSerial} onChange={value => setCaseForm(previous => ({ ...previous, machineSerial: value }))} placeholder="Serial number" colors={colors} /><Field label="Machine Model" value={caseForm.machineModel} onChange={value => setCaseForm(previous => ({ ...previous, machineModel: value }))} placeholder="Model" colors={colors} /></View>
            <Field label="Subject *" value={caseForm.subject} onChange={value => setCaseForm(previous => ({ ...previous, subject: value }))} placeholder="Service problem title" colors={colors} />
            <Field label="Problem Description *" value={caseForm.description} onChange={value => setCaseForm(previous => ({ ...previous, description: value }))} placeholder="Detailed problem description" colors={colors} multiline />
            <Field label="Problem Category" value={caseForm.category} onChange={value => setCaseForm(previous => ({ ...previous, category: value }))} placeholder="Board, ink, software, mechanical..." colors={colors} />
            <Choice label="Service Type" items={SERVICE_TYPES.map(value => ({ id: value, label: value.replaceAll('_', ' ') }))} selected={caseForm.serviceType} onSelect={id => setCaseForm(previous => ({ ...previous, serviceType: id as ServiceCase['service_type'] }))} colors={colors} />
            <Choice label="Priority" items={PRIORITIES.map(value => ({ id: value, label: value }))} selected={caseForm.priority} onSelect={id => setCaseForm(previous => ({ ...previous, priority: id as ServiceCase['priority'] }))} colors={colors} />
            <Field label="Scheduled Date-Time" value={caseForm.scheduledAt} onChange={value => setCaseForm(previous => ({ ...previous, scheduledAt: value }))} placeholder="2026-07-13 10:00" colors={colors} />
            <View style={styles.threeCol}><Field label="Response min" value={caseForm.responseMinutes} onChange={value => setCaseForm(previous => ({ ...previous, responseMinutes: value }))} placeholder="30" keyboard="numeric" colors={colors} /><Field label="Arrival min" value={caseForm.arrivalMinutes} onChange={value => setCaseForm(previous => ({ ...previous, arrivalMinutes: value }))} placeholder="240" keyboard="numeric" colors={colors} /><Field label="Resolution min" value={caseForm.resolutionMinutes} onChange={value => setCaseForm(previous => ({ ...previous, resolutionMinutes: value }))} placeholder="1440" keyboard="numeric" colors={colors} /></View>
            <SaveButton label={workingId === 'new-case' ? 'Creating…' : 'Create Service Case'} disabled={workingId !== null} onPress={() => void submitCase()} colors={colors} />
          </ScrollView>
        </View></View>
      </Modal>

      <Modal visible={warrantyModal} animationType="slide" transparent onRequestClose={() => setWarrantyModal(false)}>
        <View style={styles.modalBg}><View style={[styles.modalCard, { backgroundColor: colors.card, paddingBottom: pb }]}>
          <ModalHeader title="Register Machine Warranty" subtitle="Machine serial becomes the validation key" onClose={() => setWarrantyModal(false)} colors={colors} />
          <ScrollView contentContainerStyle={{ gap: 11 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Choice label="Customer" items={customers.map(item => ({ id: item.id, label: item.name }))} selected={warrantyForm.customerId} onSelect={id => setWarrantyForm(previous => ({ ...previous, customerId: id }))} colors={colors} />
            <Choice label="Product / Machine" items={products.filter(item => item.productType === 'machine').map(item => ({ id: item.id, label: item.name }))} selected={warrantyForm.productId} onSelect={id => {
              const product = products.find(item => item.id === id);
              setWarrantyForm(previous => ({ ...previous, productId: id, machineModel: previous.machineModel || product?.name || '' }));
            }} colors={colors} />
            <Choice label="Invoice" items={invoices.map(item => ({ id: item.id, label: `${item.invoiceNo} · ${item.customerName}` }))} selected={warrantyForm.invoiceId} onSelect={id => setWarrantyForm(previous => ({ ...previous, invoiceId: id }))} colors={colors} />
            <View style={styles.twoCol}><Field label="Machine Serial *" value={warrantyForm.machineSerial} onChange={value => setWarrantyForm(previous => ({ ...previous, machineSerial: value }))} placeholder="Unique serial" colors={colors} /><Field label="Machine Model *" value={warrantyForm.machineModel} onChange={value => setWarrantyForm(previous => ({ ...previous, machineModel: value }))} placeholder="Model" colors={colors} /></View>
            <Field label="Machine Name" value={warrantyForm.machineName} onChange={value => setWarrantyForm(previous => ({ ...previous, machineName: value }))} placeholder="Customer-visible name" colors={colors} />
            <View style={styles.twoCol}><Field label="Sale Date" value={warrantyForm.saleDate} onChange={value => setWarrantyForm(previous => ({ ...previous, saleDate: value }))} placeholder="YYYY-MM-DD" colors={colors} /><Field label="Installation Date" value={warrantyForm.installationDate} onChange={value => setWarrantyForm(previous => ({ ...previous, installationDate: value }))} placeholder="YYYY-MM-DD" colors={colors} /></View>
            <View style={styles.twoCol}><Field label="Warranty Start *" value={warrantyForm.warrantyStart} onChange={value => setWarrantyForm(previous => ({ ...previous, warrantyStart: value }))} placeholder="YYYY-MM-DD" colors={colors} /><Field label="Warranty End *" value={warrantyForm.warrantyEnd} onChange={value => setWarrantyForm(previous => ({ ...previous, warrantyEnd: value }))} placeholder="YYYY-MM-DD" colors={colors} /></View>
            <Field label="Engineer Service End" value={warrantyForm.engineerServiceEnd} onChange={value => setWarrantyForm(previous => ({ ...previous, engineerServiceEnd: value }))} placeholder="YYYY-MM-DD" colors={colors} />
            <Field label="Covered Parts" value={warrantyForm.coverage} onChange={value => setWarrantyForm(previous => ({ ...previous, coverage: value }))} placeholder="Comma separated" colors={colors} multiline />
            <Field label="Excluded Items" value={warrantyForm.exclusions} onChange={value => setWarrantyForm(previous => ({ ...previous, exclusions: value }))} placeholder="Comma separated" colors={colors} multiline />
            <Field label="Warranty Terms" value={warrantyForm.terms} onChange={value => setWarrantyForm(previous => ({ ...previous, terms: value }))} placeholder="Additional terms" colors={colors} multiline />
            <SaveButton label={workingId === 'new-warranty' ? 'Registering…' : 'Register Warranty'} disabled={workingId !== null} onPress={() => void submitWarranty()} colors={colors} />
          </ScrollView>
        </View></View>
      </Modal>
    </View>
  );
}

function ModalHeader({ title, subtitle, onClose, colors }: { title: string; subtitle: string; onClose: () => void; colors: ReturnType<typeof useColors> }) {
  return <View style={styles.modalHeader}><View style={{ flex: 1 }}><Text style={[styles.modalTitle, { color: colors.foreground }]}>{title}</Text><Text style={[styles.modalSub, { color: colors.mutedForeground }]}>{subtitle}</Text></View><TouchableOpacity onPress={onClose}><Feather name="x" size={22} color={colors.mutedForeground} /></TouchableOpacity></View>;
}

function Field({ label, value, onChange, placeholder, colors, keyboard, multiline }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; colors: ReturnType<typeof useColors>; keyboard?: 'default' | 'numeric' | 'decimal-pad' | 'phone-pad'; multiline?: boolean }) {
  return <View style={{ flex: 1, gap: 5 }}><Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text><TextInput style={[styles.input, multiline && styles.multiline, { borderColor: colors.border, color: colors.foreground }]} value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={colors.mutedForeground} keyboardType={keyboard ?? 'default'} multiline={multiline} /></View>;
}

function Choice({ label, items, selected, onSelect, colors }: { label: string; items: Array<{ id: string; label: string }>; selected: string; onSelect: (id: string) => void; colors: ReturnType<typeof useColors> }) {
  return <View style={{ gap: 6 }}><Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7 }}>{items.length ? items.map(item => <TouchableOpacity key={item.id} style={[styles.choice, { backgroundColor: selected === item.id ? colors.primary : colors.background, borderColor: selected === item.id ? colors.primary : colors.border }]} onPress={() => onSelect(item.id)}><Text style={[styles.choiceText, { color: selected === item.id ? '#fff' : colors.foreground }]}>{item.label}</Text></TouchableOpacity>) : <Text style={[styles.emptyChoice, { color: colors.mutedForeground }]}>No records available</Text>}</ScrollView></View>;
}

function SaveButton({ label, disabled, onPress, colors }: { label: string; disabled: boolean; onPress: () => void; colors: ReturnType<typeof useColors> }) {
  return <TouchableOpacity style={[styles.saveButton, { backgroundColor: colors.primary, opacity: disabled ? 0.6 : 1 }]} disabled={disabled} onPress={onPress}><Feather name="save" size={17} color="#fff" /><Text style={styles.saveText}>{label}</Text></TouchableOpacity>;
}

const styles = StyleSheet.create({
  hero: { borderRadius: 16, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 14 },
  heroEyebrow: { color: 'rgba(255,255,255,0.72)', fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 1 },
  heroTitle: { color: '#fff', fontSize: 21, fontFamily: 'Inter_700Bold', marginTop: 4 },
  heroSub: { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 4 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kpi: { width: '48.5%', borderRadius: 12, borderWidth: 1, padding: 12, gap: 3 },
  kpiValue: { fontSize: 19, fontFamily: 'Inter_700Bold' },
  kpiLabel: { fontSize: 10, fontFamily: 'Inter_500Medium' },
  checkBox: { borderRadius: 13, borderWidth: 1, padding: 12, flexDirection: 'row', alignItems: 'flex-end', gap: 9 },
  sectionTitle: { fontSize: 13, fontFamily: 'Inter_700Bold', marginBottom: 7 },
  checkButton: { width: 45, height: 45, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  validity: { borderRadius: 12, borderWidth: 1, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  validityTitle: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  validityText: { color: '#455A64', fontSize: 10, fontFamily: 'Inter_400Regular', marginTop: 3 },
  tabRow: { flexDirection: 'row', gap: 8 },
  tab: { flex: 1, borderRadius: 10, borderWidth: 1, paddingVertical: 10, alignItems: 'center' },
  tabText: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  search: { borderRadius: 11, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 11, fontSize: 12, fontFamily: 'Inter_400Regular' },
  card: { borderRadius: 13, borderWidth: 1, padding: 13, gap: 10 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  code: { fontSize: 9, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.4 },
  cardTitle: { fontSize: 15, fontFamily: 'Inter_700Bold', marginTop: 2 },
  cardSub: { fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 3 },
  statusBadge: { borderRadius: 12, paddingHorizontal: 9, paddingVertical: 5 },
  statusText: { fontSize: 9, fontFamily: 'Inter_700Bold', textTransform: 'uppercase' },
  metaBox: { borderRadius: 9, padding: 9, gap: 5 },
  meta: { fontSize: 10, fontFamily: 'Inter_400Regular', lineHeight: 15 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  primaryAction: { borderRadius: 9, paddingHorizontal: 12, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 6 },
  primaryActionText: { color: '#fff', fontSize: 11, fontFamily: 'Inter_700Bold' },
  secondaryAction: { borderRadius: 9, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 6 },
  secondaryActionText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  fabStack: { position: 'absolute', right: 20, alignItems: 'center', gap: 10 },
  fab: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', elevation: 4 },
  fabSecondary: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', elevation: 3 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalCard: { maxHeight: '95%', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 17 },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 14 },
  modalTitle: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  modalSub: { fontSize: 10, fontFamily: 'Inter_400Regular', marginTop: 3 },
  label: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  input: { borderWidth: 1, borderRadius: 9, paddingHorizontal: 11, paddingVertical: 10, fontSize: 12, fontFamily: 'Inter_400Regular' },
  multiline: { minHeight: 70, textAlignVertical: 'top' },
  twoCol: { flexDirection: 'row', gap: 9 },
  threeCol: { flexDirection: 'row', gap: 7 },
  choice: { borderWidth: 1, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 8, maxWidth: 210 },
  choiceText: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  emptyChoice: { fontSize: 10, fontFamily: 'Inter_400Regular', paddingVertical: 8 },
  saveButton: { borderRadius: 11, paddingVertical: 13, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, marginTop: 3 },
  saveText: { color: '#fff', fontSize: 13, fontFamily: 'Inter_700Bold' },
});
