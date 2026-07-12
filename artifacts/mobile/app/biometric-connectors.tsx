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
  type BiometricConnector,
  type BiometricDevice,
  createBiometricConnector,
  createBiometricDevice,
  listBiometricConnectors,
  listBiometricDevices,
} from '@/lib/v13BusinessOperations';
import {
  type BiometricEvent,
  type BiometricMapping,
  listBiometricEvents,
  listBiometricMappings,
  mapBiometricEmployee,
} from '@/lib/v13BiometricOperations';

const CONNECTOR_TYPES: BiometricConnector['connector_type'][] = [
  'GENERIC_WEBHOOK', 'ZK_PUSH_GATEWAY', 'ZK_TCP_GATEWAY',
  'CSV_IMPORT', 'REST_API', 'SDK_GATEWAY',
];

function fmt(value?: string | null): string {
  if (!value) return 'Never';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export default function BiometricConnectorsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { users } = useApp();
  const [tab, setTab] = useState<'connectors' | 'mappings' | 'events'>('connectors');
  const [connectors, setConnectors] = useState<BiometricConnector[]>([]);
  const [devices, setDevices] = useState<BiometricDevice[]>([]);
  const [mappings, setMappings] = useState<BiometricMapping[]>([]);
  const [events, setEvents] = useState<BiometricEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [connectorModal, setConnectorModal] = useState(false);
  const [deviceModal, setDeviceModal] = useState(false);
  const [mappingModal, setMappingModal] = useState(false);
  const [connectorForm, setConnectorForm] = useState({ code: '', name: '', vendor: '', type: 'GENERIC_WEBHOOK' as BiometricConnector['connector_type'], endpointUrl: '', gatewayIdentifier: '', credentialSecretName: '', timezone: 'Asia/Dhaka' });
  const [deviceForm, setDeviceForm] = useState({ connectorId: '', deviceCode: '', serialNo: '', model: '', locationName: '', ipAddress: '', port: '4370' });
  const [mappingForm, setMappingForm] = useState({ deviceId: '', deviceUserCode: '', employeeId: '' });
  const pb = insets.bottom + (Platform.OS === 'web' ? 34 : 0) + 26;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [connectorRows, deviceRows, mappingRows, eventRows] = await Promise.all([
        listBiometricConnectors(), listBiometricDevices(), listBiometricMappings(), listBiometricEvents(),
      ]);
      setConnectors(connectorRows); setDevices(deviceRows); setMappings(mappingRows); setEvents(eventRows);
      setDeviceForm(p => ({ ...p, connectorId: p.connectorId || connectorRows[0]?.id || '' }));
      setMappingForm(p => ({ ...p, deviceId: p.deviceId || deviceRows[0]?.id || '', employeeId: p.employeeId || users[0]?.id || '' }));
    } catch (error) { Alert.alert('Biometric Connectors', error instanceof Error ? error.message : 'Biometric data could not be loaded.'); }
    finally { setLoading(false); }
  }, [users]);

  useEffect(() => { void load(); }, [load]);

  const stats = useMemo(() => ({ activeConnectors: connectors.filter(item => item.active).length, onlineDevices: devices.filter(item => item.active && item.last_seen_at && Date.now() - new Date(item.last_seen_at).getTime() < 15 * 60_000).length, mappings: mappings.filter(item => item.active).length, unprocessed: events.filter(item => !item.processed).length }), [connectors, devices, events, mappings]);

  const submitConnector = async () => {
    if (!connectorForm.code.trim() || !connectorForm.name.trim() || !connectorForm.vendor.trim()) return Alert.alert('Required', 'Connector code, name and vendor are required.');
    setWorkingId('connector');
    try {
      await createBiometricConnector({ connectorCode: connectorForm.code, name: connectorForm.name, vendor: connectorForm.vendor, connectorType: connectorForm.type, endpointUrl: connectorForm.endpointUrl || undefined, gatewayIdentifier: connectorForm.gatewayIdentifier || undefined, credentialSecretName: connectorForm.credentialSecretName || undefined, timezone: connectorForm.timezone });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); setConnectorModal(false); await load();
    } catch (error) { Alert.alert('Connector', error instanceof Error ? error.message : 'Connector could not be created.'); }
    finally { setWorkingId(null); }
  };

  const submitDevice = async () => {
    if (!deviceForm.connectorId || !deviceForm.deviceCode.trim()) return Alert.alert('Required', 'Connector and device code are required.');
    setWorkingId('device');
    try {
      await createBiometricDevice({ connectorId: deviceForm.connectorId, deviceCode: deviceForm.deviceCode, serialNo: deviceForm.serialNo || undefined, model: deviceForm.model || undefined, locationName: deviceForm.locationName || undefined, ipAddress: deviceForm.ipAddress || undefined, port: deviceForm.port ? Number(deviceForm.port) : undefined });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); setDeviceModal(false); await load();
    } catch (error) { Alert.alert('Biometric Device', error instanceof Error ? error.message : 'Device could not be created.'); }
    finally { setWorkingId(null); }
  };

  const submitMapping = async () => {
    if (!mappingForm.deviceId || !mappingForm.deviceUserCode.trim() || !mappingForm.employeeId) return Alert.alert('Required', 'Device, device user code and employee are required.');
    setWorkingId('mapping');
    try {
      await mapBiometricEmployee({ deviceId: mappingForm.deviceId, deviceUserCode: mappingForm.deviceUserCode, employeeId: mappingForm.employeeId });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); setMappingModal(false); await load();
    } catch (error) { Alert.alert('Employee Mapping', error instanceof Error ? error.message : 'Mapping could not be saved.'); }
    finally { setWorkingId(null); }
  };

  return <View style={{ flex: 1, backgroundColor: colors.background }}>
    <ScrollView contentContainerStyle={{ padding: 16, paddingTop: Platform.OS === 'web' ? 24 : 12, paddingBottom: pb + 72, gap: 13 }} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />} showsVerticalScrollIndicator={false}>
      <View style={[styles.hero, { backgroundColor: colors.primary }]}><View style={{ flex: 1 }}><Text style={styles.heroEyebrow}>COLORJET ATTENDANCE INTEGRATION</Text><Text style={styles.heroTitle}>Biometric Connector Center</Text><Text style={styles.heroSub}>Vendor gateway, device registry, employee mapping and punch audit</Text></View><Feather name="cpu" size={30} color="#fff" /></View>
      <View style={styles.kpiGrid}>{[['Connectors', stats.activeConnectors], ['Online Devices', stats.onlineDevices], ['Mappings', stats.mappings], ['Unprocessed', stats.unprocessed]].map(([label, value]) => <View key={String(label)} style={[styles.kpi, { backgroundColor: colors.card, borderColor: colors.border }]}><Text style={[styles.kpiValue, { color: label === 'Unprocessed' && Number(value) > 0 ? '#D70015' : colors.foreground }]}>{String(value)}</Text><Text style={[styles.kpiLabel, { color: colors.mutedForeground }]}>{String(label)}</Text></View>)}</View>
      <View style={styles.tabs}>{(['connectors', 'mappings', 'events'] as const).map(value => <TouchableOpacity key={value} style={[styles.tab, { backgroundColor: tab === value ? colors.primary : colors.card, borderColor: tab === value ? colors.primary : colors.border }]} onPress={() => setTab(value)}><Text style={[styles.tabText, { color: tab === value ? '#fff' : colors.foreground }]}>{value === 'connectors' ? 'Connectors & Devices' : value === 'mappings' ? 'Employee Mapping' : 'Punch Events'}</Text></TouchableOpacity>)}</View>
      {tab === 'connectors' ? <>{connectors.map(connector => <View key={connector.id} style={[styles.card, { backgroundColor: colors.card, borderColor: connector.last_error ? '#D70015' : colors.border }]}><View style={styles.top}><View style={{ flex: 1 }}><Text style={[styles.code, { color: colors.mutedForeground }]}>{connector.connector_code}</Text><Text style={[styles.title, { color: colors.foreground }]}>{connector.name}</Text><Text style={[styles.sub, { color: colors.mutedForeground }]}>{connector.vendor} · {connector.connector_type.replaceAll('_', ' ')}</Text></View><View style={[styles.statusDot, { backgroundColor: connector.active ? '#34C759' : '#8E8E93' }]} /></View><View style={[styles.metaBox, { backgroundColor: colors.background }]}><Text style={[styles.meta, { color: colors.mutedForeground }]}>Last sync: {fmt(connector.last_sync_at)} · Success: {fmt(connector.last_success_at)}</Text><Text style={[styles.meta, { color: connector.last_error ? '#D70015' : colors.mutedForeground }]}>Secret reference: {connector.credential_secret_name || 'Not configured'}{connector.last_error ? ` · ${connector.last_error}` : ''}</Text></View>{devices.filter(device => device.connector_id === connector.id).map(device => <View key={device.id} style={[styles.deviceRow, { borderTopColor: colors.border }]}><Feather name="hard-drive" size={17} color={colors.primary} /><View style={{ flex: 1 }}><Text style={[styles.deviceName, { color: colors.foreground }]}>{device.device_code} · {device.model || 'Model not set'}</Text><Text style={[styles.deviceMeta, { color: colors.mutedForeground }]}>{device.location_name || 'Location not set'} · {device.ip_address || 'No IP'}:{device.port || 'N/A'} · Last seen {fmt(device.last_seen_at)}</Text></View></View>)}</View>)}</> : tab === 'mappings' ? mappings.map(mapping => { const device = devices.find(item => item.id === mapping.device_id); const employee = users.find(item => item.id === mapping.employee_id); return <View key={mapping.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}><View style={styles.top}><Feather name="link" size={20} color={colors.primary} /><View style={{ flex: 1 }}><Text style={[styles.title, { color: colors.foreground }]}>{employee?.name || 'Unknown Employee'}</Text><Text style={[styles.sub, { color: colors.mutedForeground }]}>Device {device?.device_code || 'Unknown'} · User Code {mapping.device_user_code}</Text></View><View style={[styles.statusDot, { backgroundColor: mapping.active ? '#34C759' : '#8E8E93' }]} /></View></View>; }) : events.map(event => { const device = devices.find(item => item.id === event.device_id); const employee = users.find(item => item.id === event.employee_id); return <View key={event.id} style={[styles.card, { backgroundColor: colors.card, borderColor: event.processing_error ? '#D70015' : colors.border }]}><View style={styles.top}><View style={{ flex: 1 }}><Text style={[styles.code, { color: colors.mutedForeground }]}>{event.device_event_id || event.idempotency_key}</Text><Text style={[styles.title, { color: colors.foreground }]}>{employee?.name || `Unmapped User ${event.device_user_code}`}</Text><Text style={[styles.sub, { color: colors.mutedForeground }]}>{event.event_type.replaceAll('_', ' ')} · {fmt(event.event_time)} · {device?.device_code || 'Unknown device'}</Text></View><Feather name={event.processed ? 'check-circle' : 'alert-circle'} size={20} color={event.processed ? '#34C759' : '#FF9500'} /></View>{event.processing_error ? <Text style={styles.errorText}>{event.processing_error}</Text> : null}</View>; })}
    </ScrollView>
    <View style={[styles.fabs, { bottom: pb }]}>{tab === 'connectors' ? <View style={{ gap: 9 }}><SmallFab icon="hard-drive" onPress={() => setDeviceModal(true)} /><Fab onPress={() => setConnectorModal(true)} colors={colors} /></View> : tab === 'mappings' ? <Fab onPress={() => setMappingModal(true)} colors={colors} /> : null}</View>
    <FormModal visible={connectorModal} title="Create Biometric Connector" onClose={() => setConnectorModal(false)} colors={colors} pb={pb}><View style={styles.twoCol}><Field label="Connector Code *" value={connectorForm.code} onChange={v => setConnectorForm(p => ({ ...p, code: v }))} placeholder="HEAD-OFFICE-ZK" colors={colors} /><Field label="Vendor *" value={connectorForm.vendor} onChange={v => setConnectorForm(p => ({ ...p, vendor: v }))} placeholder="ZKTeco/Other" colors={colors} /></View><Field label="Connector Name *" value={connectorForm.name} onChange={v => setConnectorForm(p => ({ ...p, name: v }))} placeholder="Head Office Attendance" colors={colors} /><Choice label="Connector Type" items={CONNECTOR_TYPES.map(value => ({ id: value, label: value.replaceAll('_', ' ') }))} selected={connectorForm.type} onSelect={id => setConnectorForm(p => ({ ...p, type: id as BiometricConnector['connector_type'] }))} colors={colors} /><Field label="Gateway Endpoint" value={connectorForm.endpointUrl} onChange={v => setConnectorForm(p => ({ ...p, endpointUrl: v }))} placeholder="Gateway URL, not device password" colors={colors} /><Field label="Credential Secret Name" value={connectorForm.credentialSecretName} onChange={v => setConnectorForm(p => ({ ...p, credentialSecretName: v }))} placeholder="BIOMETRIC_GATEWAY_KEY" colors={colors} /><Text style={[styles.securityNote, { color: colors.mutedForeground }]}>Only the secret name is stored. The actual key must remain in Supabase/GitHub Secrets.</Text><Save label={workingId === 'connector' ? 'Creating…' : 'Create Connector'} onPress={() => void submitConnector()} disabled={workingId !== null} colors={colors} /></FormModal>
    <FormModal visible={deviceModal} title="Register Biometric Device" onClose={() => setDeviceModal(false)} colors={colors} pb={pb}><Choice label="Connector" items={connectors.map(item => ({ id: item.id, label: item.name }))} selected={deviceForm.connectorId} onSelect={id => setDeviceForm(p => ({ ...p, connectorId: id }))} colors={colors} /><View style={styles.twoCol}><Field label="Device Code *" value={deviceForm.deviceCode} onChange={v => setDeviceForm(p => ({ ...p, deviceCode: v }))} placeholder="DEVICE-01" colors={colors} /><Field label="Serial No" value={deviceForm.serialNo} onChange={v => setDeviceForm(p => ({ ...p, serialNo: v }))} placeholder="Serial" colors={colors} /></View><View style={styles.twoCol}><Field label="Model" value={deviceForm.model} onChange={v => setDeviceForm(p => ({ ...p, model: v }))} placeholder="Model" colors={colors} /><Field label="Location" value={deviceForm.locationName} onChange={v => setDeviceForm(p => ({ ...p, locationName: v }))} placeholder="Head Office" colors={colors} /></View><View style={styles.twoCol}><Field label="IP Address" value={deviceForm.ipAddress} onChange={v => setDeviceForm(p => ({ ...p, ipAddress: v }))} placeholder="192.168.1.201" colors={colors} /><Field label="Port" value={deviceForm.port} onChange={v => setDeviceForm(p => ({ ...p, port: v }))} placeholder="4370" colors={colors} keyboard="numeric" /></View><Save label={workingId === 'device' ? 'Registering…' : 'Register Device'} onPress={() => void submitDevice()} disabled={workingId !== null} colors={colors} /></FormModal>
    <FormModal visible={mappingModal} title="Map Device User to Employee" onClose={() => setMappingModal(false)} colors={colors} pb={pb}><Choice label="Device" items={devices.map(item => ({ id: item.id, label: `${item.device_code} · ${item.location_name || 'Location'}` }))} selected={mappingForm.deviceId} onSelect={id => setMappingForm(p => ({ ...p, deviceId: id }))} colors={colors} /><Field label="Device User Code *" value={mappingForm.deviceUserCode} onChange={v => setMappingForm(p => ({ ...p, deviceUserCode: v }))} placeholder="Biometric enrollment ID" colors={colors} /><Choice label="Employee" items={users.map(item => ({ id: item.id, label: item.name }))} selected={mappingForm.employeeId} onSelect={id => setMappingForm(p => ({ ...p, employeeId: id }))} colors={colors} /><Save label={workingId === 'mapping' ? 'Saving…' : 'Save Mapping'} onPress={() => void submitMapping()} disabled={workingId !== null} colors={colors} /></FormModal>
  </View>;
}

function Fab({ onPress, colors }: { onPress: () => void; colors: ReturnType<typeof useColors> }) { return <TouchableOpacity style={[styles.fab, { backgroundColor: colors.primary }]} onPress={onPress}><Feather name="plus" size={24} color="#fff" /></TouchableOpacity>; }
function SmallFab({ icon, onPress }: { icon: keyof typeof Feather.glyphMap; onPress: () => void }) { return <TouchableOpacity style={styles.smallFab} onPress={onPress}><Feather name={icon} size={18} color="#fff" /></TouchableOpacity>; }
function FormModal({ visible, title, onClose, colors, pb, children }: { visible: boolean; title: string; onClose: () => void; colors: ReturnType<typeof useColors>; pb: number; children: React.ReactNode }) { return <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}><View style={styles.modalBg}><View style={[styles.modalCard, { backgroundColor: colors.card, paddingBottom: pb }]}><View style={styles.modalHeader}><Text style={[styles.modalTitle, { color: colors.foreground }]}>{title}</Text><TouchableOpacity onPress={onClose}><Feather name="x" size={22} color={colors.mutedForeground} /></TouchableOpacity></View><ScrollView contentContainerStyle={{ gap: 11 }} keyboardShouldPersistTaps="handled">{children}</ScrollView></View></View></Modal>; }
function Field({ label, value, onChange, placeholder, colors, keyboard }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; colors: ReturnType<typeof useColors>; keyboard?: 'default' | 'numeric' }) { return <View style={{ flex: 1, gap: 5 }}><Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text><TextInput style={[styles.input, { color: colors.foreground, borderColor: colors.border }]} value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={colors.mutedForeground} keyboardType={keyboard || 'default'} /></View>; }
function Choice({ label, items, selected, onSelect, colors }: { label: string; items: Array<{ id: string; label: string }>; selected: string; onSelect: (id: string) => void; colors: ReturnType<typeof useColors> }) { return <View style={{ gap: 6 }}><Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7 }}>{items.map(item => <TouchableOpacity key={item.id} style={[styles.choice, { backgroundColor: selected === item.id ? colors.primary : colors.background, borderColor: selected === item.id ? colors.primary : colors.border }]} onPress={() => onSelect(item.id)}><Text style={[styles.choiceText, { color: selected === item.id ? '#fff' : colors.foreground }]}>{item.label}</Text></TouchableOpacity>)}</ScrollView></View>; }
function Save({ label, onPress, disabled, colors }: { label: string; onPress: () => void; disabled: boolean; colors: ReturnType<typeof useColors> }) { return <TouchableOpacity style={[styles.save, { backgroundColor: colors.primary, opacity: disabled ? 0.6 : 1 }]} onPress={onPress} disabled={disabled}><Feather name="save" size={17} color="#fff" /><Text style={styles.saveText}>{label}</Text></TouchableOpacity>; }

const styles = StyleSheet.create({ hero: { borderRadius: 16, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 14 }, heroEyebrow: { color: 'rgba(255,255,255,0.72)', fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 1 }, heroTitle: { color: '#fff', fontSize: 21, fontFamily: 'Inter_700Bold', marginTop: 4 }, heroSub: { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 4 }, kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, kpi: { width: '48.5%', borderWidth: 1, borderRadius: 11, padding: 11 }, kpiValue: { fontSize: 18, fontFamily: 'Inter_700Bold' }, kpiLabel: { fontSize: 9, fontFamily: 'Inter_500Medium', marginTop: 2 }, tabs: { flexDirection: 'row', gap: 6 }, tab: { flex: 1, borderWidth: 1, borderRadius: 9, paddingVertical: 9, alignItems: 'center' }, tabText: { fontSize: 9, fontFamily: 'Inter_700Bold', textAlign: 'center' }, card: { borderWidth: 1, borderRadius: 13, padding: 13, gap: 10 }, top: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 }, code: { fontSize: 9, fontFamily: 'Inter_600SemiBold' }, title: { fontSize: 14, fontFamily: 'Inter_700Bold', marginTop: 2 }, sub: { fontSize: 10, fontFamily: 'Inter_400Regular', marginTop: 3 }, statusDot: { width: 10, height: 10, borderRadius: 5 }, metaBox: { borderRadius: 9, padding: 9, gap: 5 }, meta: { fontSize: 10, fontFamily: 'Inter_400Regular' }, deviceRow: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 9, flexDirection: 'row', alignItems: 'center', gap: 9 }, deviceName: { fontSize: 11, fontFamily: 'Inter_600SemiBold' }, deviceMeta: { fontSize: 9, fontFamily: 'Inter_400Regular', marginTop: 2 }, errorText: { color: '#D70015', fontSize: 10, fontFamily: 'Inter_500Medium' }, fabs: { position: 'absolute', right: 20 }, fab: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', elevation: 4 }, smallFab: { width: 45, height: 45, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: '#2E7D32', elevation: 3 }, modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }, modalCard: { maxHeight: '95%', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 17 }, modalHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 }, modalTitle: { fontSize: 18, fontFamily: 'Inter_700Bold' }, label: { fontSize: 10, fontFamily: 'Inter_600SemiBold' }, input: { borderWidth: 1, borderRadius: 9, paddingHorizontal: 11, paddingVertical: 10, fontSize: 12, fontFamily: 'Inter_400Regular' }, choice: { borderWidth: 1, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 8, maxWidth: 220 }, choiceText: { fontSize: 10, fontFamily: 'Inter_600SemiBold' }, twoCol: { flexDirection: 'row', gap: 9 }, securityNote: { fontSize: 10, fontFamily: 'Inter_400Regular', lineHeight: 15 }, save: { borderRadius: 11, paddingVertical: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, saveText: { color: '#fff', fontSize: 13, fontFamily: 'Inter_700Bold' } });
