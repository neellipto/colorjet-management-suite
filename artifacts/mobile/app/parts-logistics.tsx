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
  type PartsDispatch,
  type PartsDispatchItem,
  type PartsRequest,
  type PartsRequestItem,
  type PartsReservation,
  approvePartsRequest,
  createPartsDispatch,
  listPartsDispatchItems,
  listPartsDispatches,
  listPartsRequestItems,
  listPartsRequests,
  listPartsReservations,
  receivePartsDispatch,
  reservePart,
} from '@/lib/v13BusinessOperations';
import {
  type PartsStockPosting,
  type WarehouseOption,
  listPartsStockPostings,
  listWarehouseOptions,
  postInstalledPart,
} from '@/lib/v13PartsOperations';

const STATUS_COLOR: Record<string, string> = {
  requested: '#007AFF', manager_approved: '#5856D6', partially_approved: '#AF52DE', reserved: '#34C759',
  partially_dispatched: '#FF9500', dispatched: '#32ADE6', in_transit: '#30B0C7', engineer_received: '#2E7D32',
  installed: '#1A237E', used: '#2E7D32', returned: '#8E8E93', out_of_stock: '#D70015', purchase_required: '#FF453A',
  rejected: '#C62828', cancelled: '#8E8E93', closed: '#2E7D32', prepared: '#5856D6', delivered: '#34C759', received: '#2E7D32',
};

function fmt(value?: string | null): string {
  if (!value) return 'Not set';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export default function PartsLogisticsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { currentUser, users } = useApp();
  const [tab, setTab] = useState<'requests' | 'dispatches' | 'postings'>('requests');
  const [requests, setRequests] = useState<PartsRequest[]>([]);
  const [items, setItems] = useState<PartsRequestItem[]>([]);
  const [reservations, setReservations] = useState<PartsReservation[]>([]);
  const [dispatches, setDispatches] = useState<PartsDispatch[]>([]);
  const [dispatchItems, setDispatchItems] = useState<PartsDispatchItem[]>([]);
  const [postings, setPostings] = useState<PartsStockPosting[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [dispatchModal, setDispatchModal] = useState<PartsRequest | null>(null);
  const [dispatchForm, setDispatchForm] = useState({ warehouseId: '', receiverUserId: '', destination: '', courier: '', trackingNo: '', transportType: 'Courier', deliveryCharge: '0', expectedDeliveryAt: '' });

  const role = currentUser?.role ?? 'customer';
  const canStoreManage = ['admin', 'manager', 'service_control', 'store'].includes(role);
  const pb = insets.bottom + (Platform.OS === 'web' ? 34 : 0) + 26;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [requestRows, itemRows, reservationRows, dispatchRows, dispatchItemRows, postingRows, warehouseRows] = await Promise.all([
        listPartsRequests(), listPartsRequestItems(), listPartsReservations(), listPartsDispatches(),
        listPartsDispatchItems(), listPartsStockPostings(), listWarehouseOptions(),
      ]);
      setRequests(requestRows);
      setItems(itemRows);
      setReservations(reservationRows);
      setDispatches(dispatchRows);
      setDispatchItems(dispatchItemRows);
      setPostings(postingRows);
      setWarehouses(warehouseRows);
      setDispatchForm(previous => ({ ...previous, warehouseId: previous.warehouseId || warehouseRows[0]?.id || '' }));
    } catch (error) {
      Alert.alert('Parts Logistics', error instanceof Error ? error.message : 'Parts workflow could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filteredRequests = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const rows = role === 'engineer' ? requests.filter(item => item.requested_by === currentUser?.id) : requests;
    return needle ? rows.filter(item => `${item.request_no} ${item.reason} ${item.status}`.toLowerCase().includes(needle)) : rows;
  }, [currentUser?.id, requests, role, search]);

  const filteredDispatches = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const rows = role === 'engineer' ? dispatches.filter(item => item.receiver_user_id === currentUser?.id) : dispatches;
    return needle ? rows.filter(item => `${item.dispatch_no} ${item.destination} ${item.tracking_no ?? ''} ${item.status}`.toLowerCase().includes(needle)) : rows;
  }, [currentUser?.id, dispatches, role, search]);

  const requestItems = (requestId: string) => items.filter(item => item.request_id === requestId);
  const reservedForItem = (itemId: string) => reservations.filter(item => item.request_item_id === itemId && ['active', 'partially_consumed'].includes(item.status)).reduce((sum, item) => sum + Number(item.reserved_qty) - Number(item.released_qty) - Number(item.consumed_qty), 0);
  const dispatchItemsFor = (dispatchId: string) => dispatchItems.filter(item => item.dispatch_id === dispatchId);

  const approveAll = async (request: PartsRequest) => {
    const rows = requestItems(request.id);
    if (!rows.length) return Alert.alert('Parts Approval', 'No request items found.');
    setWorkingId(request.id);
    try {
      await approvePartsRequest(request.id, rows.map(item => ({ requestItemId: item.id, approvedQty: Number(item.requested_qty) })), 'Approved from Parts Logistics mobile UI');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await load();
    } catch (error) {
      Alert.alert('Parts Approval', error instanceof Error ? error.message : 'Approval failed.');
    } finally { setWorkingId(null); }
  };

  const reserveAll = async (request: PartsRequest) => {
    const warehouseId = dispatchForm.warehouseId || warehouses[0]?.id;
    if (!warehouseId) return Alert.alert('Reservation', 'Create or configure a warehouse first.');
    const rows = requestItems(request.id).filter(item => Number(item.approved_qty) - Number(item.dispatched_qty) - reservedForItem(item.id) > 0);
    if (!rows.length) return Alert.alert('Reservation', 'No remaining approved quantity to reserve.');
    setWorkingId(request.id);
    try {
      for (const item of rows) {
        const quantity = Number(item.approved_qty) - Number(item.dispatched_qty) - reservedForItem(item.id);
        await reservePart({ requestItemId: item.id, warehouseId, quantity, note: 'Reserved from mobile parts workflow' });
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await load();
    } catch (error) {
      Alert.alert('Reservation', error instanceof Error ? error.message : 'Reservation failed.');
    } finally { setWorkingId(null); }
  };

  const openDispatch = (request: PartsRequest) => {
    const requester = users.find(user => user.id === request.requested_by);
    setDispatchForm(previous => ({
      ...previous,
      warehouseId: previous.warehouseId || warehouses[0]?.id || '',
      receiverUserId: request.requested_by,
      destination: requester?.department ? `${requester.department} / Engineer Delivery` : 'Engineer Delivery',
    }));
    setDispatchModal(request);
  };

  const submitDispatch = async () => {
    if (!dispatchModal) return;
    const rows = requestItems(dispatchModal.id).filter(item => Number(item.approved_qty) - Number(item.dispatched_qty) > 0);
    if (!dispatchForm.warehouseId || !dispatchForm.destination.trim() || !rows.length) return Alert.alert('Dispatch', 'Warehouse, destination and remaining items are required.');
    setWorkingId(dispatchModal.id);
    try {
      await createPartsDispatch({
        requestId: dispatchModal.id,
        sourceWarehouseId: dispatchForm.warehouseId,
        destination: dispatchForm.destination,
        receiverUserId: dispatchForm.receiverUserId || dispatchModal.requested_by,
        courierName: dispatchForm.courier || undefined,
        trackingNo: dispatchForm.trackingNo || undefined,
        transportType: dispatchForm.transportType || undefined,
        deliveryCharge: Number(dispatchForm.deliveryCharge) || 0,
        expectedDeliveryAt: dispatchForm.expectedDeliveryAt ? new Date(dispatchForm.expectedDeliveryAt).toISOString() : undefined,
        items: rows.map(item => ({ requestItemId: item.id, quantity: Number(item.approved_qty) - Number(item.dispatched_qty), conditionAtDispatch: 'Checked and packed' })),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setDispatchModal(null);
      await load();
    } catch (error) {
      Alert.alert('Dispatch', error instanceof Error ? error.message : 'Dispatch failed.');
    } finally { setWorkingId(null); }
  };

  const receiveFull = async (dispatch: PartsDispatch) => {
    const rows = dispatchItemsFor(dispatch.id);
    if (!rows.length) return Alert.alert('Receive Dispatch', 'No dispatch items found.');
    setWorkingId(dispatch.id);
    try {
      await receivePartsDispatch({
        dispatchId: dispatch.id,
        conditionSummary: 'Received and checked by engineer',
        items: rows.map(item => ({ dispatchItemId: item.id, receivedQty: Number(item.quantity), damagedQty: 0, shortQty: 0, conditionAtReceipt: 'Good', serialNumbers: item.serial_numbers ?? [] })),
        note: 'Full receipt confirmed from mobile app',
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await load();
    } catch (error) {
      Alert.alert('Receive Dispatch', error instanceof Error ? error.message : 'Receipt failed.');
    } finally { setWorkingId(null); }
  };

  const postRemainingInstalled = async (item: PartsRequestItem) => {
    const quantity = Number(item.received_qty) - Number(item.installed_qty);
    if (quantity <= 0) return Alert.alert('Installed Part', 'No received quantity remains to install.');
    setWorkingId(item.id);
    try {
      await postInstalledPart({ requestItemId: item.id, quantity, note: 'Installed and consumed during service', idempotencyKey: `install:${item.id}:${item.received_qty}` });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await load();
    } catch (error) {
      Alert.alert('Installed Part', error instanceof Error ? error.message : 'Stock posting failed.');
    } finally { setWorkingId(null); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: Platform.OS === 'web' ? 24 : 12, paddingBottom: pb, gap: 13 }} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />} showsVerticalScrollIndicator={false}>
        <View style={[styles.hero, { backgroundColor: colors.primary }]}>
          <View style={{ flex: 1 }}><Text style={styles.heroEyebrow}>COLORJET STORE & SERVICE LOGISTICS</Text><Text style={styles.heroTitle}>Spare Parts Control</Text><Text style={styles.heroSub}>Approve, reserve, dispatch, receive and post service parts stock</Text></View>
          <Feather name="package" size={30} color="#fff" />
        </View>

        <View style={styles.kpiRow}>
          {[
            ['Requests', requests.filter(item => !['closed', 'cancelled', 'rejected'].includes(item.status)).length],
            ['Reserved', reservations.filter(item => ['active', 'partially_consumed'].includes(item.status)).length],
            ['In Transit', dispatches.filter(item => ['dispatched', 'in_transit', 'delivered'].includes(item.status)).length],
            ['Postings', postings.length],
          ].map(([label, value]) => <View key={String(label)} style={[styles.kpi, { backgroundColor: colors.card, borderColor: colors.border }]}><Text style={[styles.kpiValue, { color: colors.foreground }]}>{String(value)}</Text><Text style={[styles.kpiLabel, { color: colors.mutedForeground }]}>{String(label)}</Text></View>)}
        </View>

        <View style={styles.tabs}>{(['requests', 'dispatches', 'postings'] as const).map(value => <TouchableOpacity key={value} style={[styles.tab, { backgroundColor: tab === value ? colors.primary : colors.card, borderColor: tab === value ? colors.primary : colors.border }]} onPress={() => setTab(value)}><Text style={[styles.tabText, { color: tab === value ? '#fff' : colors.foreground }]}>{value === 'requests' ? 'Requests' : value === 'dispatches' ? 'Dispatch & Receipt' : 'Stock Posting'}</Text></TouchableOpacity>)}</View>
        <TextInput style={[styles.search, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]} value={search} onChangeText={setSearch} placeholder="Search request, dispatch, tracking or status" placeholderTextColor={colors.mutedForeground} />

        {tab === 'requests' ? filteredRequests.map(request => {
          const rows = requestItems(request.id);
          const color = STATUS_COLOR[request.status] ?? colors.primary;
          return <View key={request.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.top}><View style={{ flex: 1 }}><Text style={[styles.code, { color: colors.mutedForeground }]}>{request.request_no}</Text><Text style={[styles.title, { color: colors.foreground }]}>{request.reason}</Text><Text style={[styles.sub, { color: colors.mutedForeground }]}>{request.request_type.replaceAll('_', ' ')} · {request.urgency} · {fmt(request.required_at)}</Text></View><View style={[styles.badge, { backgroundColor: `${color}20` }]}><Text style={[styles.badgeText, { color }]}>{request.status.replaceAll('_', ' ')}</Text></View></View>
            <View style={[styles.itemBox, { backgroundColor: colors.background }]}>{rows.map(item => <View key={item.id} style={styles.itemRow}><View style={{ flex: 1 }}><Text style={[styles.itemName, { color: colors.foreground }]}>{item.product_name}</Text><Text style={[styles.itemMeta, { color: colors.mutedForeground }]}>Req {item.requested_qty} · Approved {item.approved_qty} · Reserved {reservedForItem(item.id)} · Sent {item.dispatched_qty} · Received {item.received_qty} · Used {item.installed_qty}</Text></View>{role === 'engineer' && Number(item.received_qty) > Number(item.installed_qty) ? <TouchableOpacity style={[styles.miniButton, { borderColor: colors.primary }]} onPress={() => void postRemainingInstalled(item)} disabled={workingId !== null}><Text style={[styles.miniText, { color: colors.primary }]}>Install</Text></TouchableOpacity> : null}</View>)}</View>
            {canStoreManage ? <View style={styles.actions}>
              {request.status === 'requested' ? <Action icon="check" label="Approve Full" onPress={() => void approveAll(request)} colors={colors} disabled={workingId !== null} /> : null}
              {['manager_approved', 'partially_approved'].includes(request.status) ? <Action icon="lock" label="Reserve" onPress={() => void reserveAll(request)} colors={colors} disabled={workingId !== null} /> : null}
              {['reserved', 'partially_dispatched', 'manager_approved'].includes(request.status) ? <Action icon="truck" label="Dispatch" onPress={() => openDispatch(request)} colors={colors} disabled={workingId !== null} /> : null}
            </View> : null}
          </View>;
        }) : tab === 'dispatches' ? filteredDispatches.map(dispatch => {
          const rows = dispatchItemsFor(dispatch.id);
          const color = STATUS_COLOR[dispatch.status] ?? colors.primary;
          return <View key={dispatch.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.top}><View style={{ flex: 1 }}><Text style={[styles.code, { color: colors.mutedForeground }]}>{dispatch.dispatch_no}</Text><Text style={[styles.title, { color: colors.foreground }]}>{dispatch.destination}</Text><Text style={[styles.sub, { color: colors.mutedForeground }]}>{dispatch.courier_name || dispatch.transport_type || 'Internal logistics'} · Tracking {dispatch.tracking_no || 'N/A'}</Text></View><View style={[styles.badge, { backgroundColor: `${color}20` }]}><Text style={[styles.badgeText, { color }]}>{dispatch.status.replaceAll('_', ' ')}</Text></View></View>
            <Text style={[styles.sub, { color: colors.mutedForeground }]}>Dispatched {fmt(dispatch.dispatched_at)} · ETA {fmt(dispatch.expected_delivery_at)} · Charge ৳{Number(dispatch.delivery_charge || 0).toLocaleString()}</Text>
            <View style={[styles.itemBox, { backgroundColor: colors.background }]}>{rows.map(item => { const requestItem = items.find(value => value.id === item.request_item_id); return <Text key={item.id} style={[styles.itemMeta, { color: colors.foreground }]}>{requestItem?.product_name || 'Part'} · Qty {item.quantity}</Text>; })}</View>
            {dispatch.status !== 'received' && (dispatch.receiver_user_id === currentUser?.id || canStoreManage) ? <Action icon="package" label={workingId === dispatch.id ? 'Receiving…' : 'Receive Full'} onPress={() => void receiveFull(dispatch)} colors={colors} disabled={workingId !== null} /> : null}
          </View>;
        }) : postings.map(posting => <View key={posting.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}><View style={styles.top}><View style={{ flex: 1 }}><Text style={[styles.code, { color: colors.mutedForeground }]}>{posting.posting_no}</Text><Text style={[styles.title, { color: colors.foreground }]}>{posting.posting_type.replaceAll('_', ' ')}</Text><Text style={[styles.sub, { color: colors.mutedForeground }]}>Qty {posting.quantity} · Stock effect {posting.stock_effect} · {fmt(posting.posted_at)}</Text></View><Feather name={Number(posting.stock_effect) < 0 ? 'arrow-up-right' : Number(posting.stock_effect) > 0 ? 'arrow-down-left' : 'activity'} size={20} color={Number(posting.stock_effect) < 0 ? '#C62828' : Number(posting.stock_effect) > 0 ? '#2E7D32' : colors.primary} /></View></View>)}
      </ScrollView>

      <Modal visible={Boolean(dispatchModal)} animationType="slide" transparent onRequestClose={() => setDispatchModal(null)}>
        <View style={styles.modalBg}><View style={[styles.modalCard, { backgroundColor: colors.card, paddingBottom: pb }]}>
          <View style={styles.modalHeader}><View style={{ flex: 1 }}><Text style={[styles.modalTitle, { color: colors.foreground }]}>Create Parts Dispatch</Text><Text style={[styles.modalSub, { color: colors.mutedForeground }]}>{dispatchModal?.request_no}</Text></View><TouchableOpacity onPress={() => setDispatchModal(null)}><Feather name="x" size={22} color={colors.mutedForeground} /></TouchableOpacity></View>
          <ScrollView contentContainerStyle={{ gap: 11 }} keyboardShouldPersistTaps="handled">
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Source Warehouse *</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7 }}>{warehouses.map(item => <TouchableOpacity key={item.id} style={[styles.choice, { backgroundColor: dispatchForm.warehouseId === item.id ? colors.primary : colors.background, borderColor: dispatchForm.warehouseId === item.id ? colors.primary : colors.border }]} onPress={() => setDispatchForm(previous => ({ ...previous, warehouseId: item.id }))}><Text style={[styles.choiceText, { color: dispatchForm.warehouseId === item.id ? '#fff' : colors.foreground }]}>{item.name}</Text></TouchableOpacity>)}</ScrollView>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Receiver *</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7 }}>{users.filter(user => ['engineer', 'store', 'manager', 'admin'].includes(user.role)).map(user => <TouchableOpacity key={user.id} style={[styles.choice, { backgroundColor: dispatchForm.receiverUserId === user.id ? colors.primary : colors.background, borderColor: dispatchForm.receiverUserId === user.id ? colors.primary : colors.border }]} onPress={() => setDispatchForm(previous => ({ ...previous, receiverUserId: user.id }))}><Text style={[styles.choiceText, { color: dispatchForm.receiverUserId === user.id ? '#fff' : colors.foreground }]}>{user.name}</Text></TouchableOpacity>)}</ScrollView>
            <Field label="Destination *" value={dispatchForm.destination} onChange={value => setDispatchForm(previous => ({ ...previous, destination: value }))} placeholder="Engineer/customer/site address" colors={colors} />
            <View style={styles.twoCol}><Field label="Courier / Logistics" value={dispatchForm.courier} onChange={value => setDispatchForm(previous => ({ ...previous, courier: value }))} placeholder="Company name" colors={colors} /><Field label="Tracking No" value={dispatchForm.trackingNo} onChange={value => setDispatchForm(previous => ({ ...previous, trackingNo: value }))} placeholder="Tracking" colors={colors} /></View>
            <View style={styles.twoCol}><Field label="Transport Type" value={dispatchForm.transportType} onChange={value => setDispatchForm(previous => ({ ...previous, transportType: value }))} placeholder="Courier/Bus/Air" colors={colors} /><Field label="Delivery Charge" value={dispatchForm.deliveryCharge} onChange={value => setDispatchForm(previous => ({ ...previous, deliveryCharge: value }))} placeholder="0" keyboard="numeric" colors={colors} /></View>
            <Field label="Expected Delivery" value={dispatchForm.expectedDeliveryAt} onChange={value => setDispatchForm(previous => ({ ...previous, expectedDeliveryAt: value }))} placeholder="2026-07-13 16:00" colors={colors} />
            <TouchableOpacity style={[styles.save, { backgroundColor: colors.primary, opacity: workingId ? 0.6 : 1 }]} disabled={Boolean(workingId)} onPress={() => void submitDispatch()}><Feather name="truck" size={17} color="#fff" /><Text style={styles.saveText}>{workingId ? 'Dispatching…' : 'Create & Post Dispatch'}</Text></TouchableOpacity>
          </ScrollView>
        </View></View>
      </Modal>
    </View>
  );
}

function Action({ icon, label, onPress, colors, disabled }: { icon: keyof typeof Feather.glyphMap; label: string; onPress: () => void; colors: ReturnType<typeof useColors>; disabled: boolean }) {
  return <TouchableOpacity style={[styles.action, { backgroundColor: colors.primary, opacity: disabled ? 0.6 : 1 }]} onPress={onPress} disabled={disabled}><Feather name={icon} size={14} color="#fff" /><Text style={styles.actionText}>{label}</Text></TouchableOpacity>;
}

function Field({ label, value, onChange, placeholder, colors, keyboard }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; colors: ReturnType<typeof useColors>; keyboard?: 'default' | 'numeric' | 'decimal-pad' }) {
  return <View style={{ flex: 1, gap: 5 }}><Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text><TextInput style={[styles.input, { borderColor: colors.border, color: colors.foreground }]} value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={colors.mutedForeground} keyboardType={keyboard ?? 'default'} /></View>;
}

const styles = StyleSheet.create({
  hero: { borderRadius: 16, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 14 },
  heroEyebrow: { color: 'rgba(255,255,255,0.72)', fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 1 },
  heroTitle: { color: '#fff', fontSize: 21, fontFamily: 'Inter_700Bold', marginTop: 4 },
  heroSub: { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 4 },
  kpiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  kpi: { width: '48.8%', borderWidth: 1, borderRadius: 11, padding: 11 },
  kpiValue: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  kpiLabel: { fontSize: 10, fontFamily: 'Inter_500Medium', marginTop: 2 },
  tabs: { flexDirection: 'row', gap: 6 },
  tab: { flex: 1, borderWidth: 1, borderRadius: 9, paddingVertical: 9, alignItems: 'center' },
  tabText: { fontSize: 10, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  search: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 12, fontFamily: 'Inter_400Regular' },
  card: { borderWidth: 1, borderRadius: 13, padding: 13, gap: 10 },
  top: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  code: { fontSize: 9, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.4 },
  title: { fontSize: 14, fontFamily: 'Inter_700Bold', marginTop: 2 },
  sub: { fontSize: 10, fontFamily: 'Inter_400Regular', marginTop: 3, lineHeight: 15 },
  badge: { borderRadius: 12, paddingHorizontal: 8, paddingVertical: 5 },
  badgeText: { fontSize: 8, fontFamily: 'Inter_700Bold', textTransform: 'uppercase' },
  itemBox: { borderRadius: 9, padding: 9, gap: 7 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemName: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  itemMeta: { fontSize: 9, fontFamily: 'Inter_400Regular', marginTop: 2, lineHeight: 14 },
  miniButton: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 6 },
  miniText: { fontSize: 9, fontFamily: 'Inter_700Bold' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  action: { borderRadius: 9, paddingHorizontal: 11, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionText: { color: '#fff', fontSize: 10, fontFamily: 'Inter_700Bold' },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalCard: { maxHeight: '92%', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 17 },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 14 },
  modalTitle: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  modalSub: { fontSize: 10, fontFamily: 'Inter_400Regular', marginTop: 3 },
  label: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  input: { borderWidth: 1, borderRadius: 9, paddingHorizontal: 11, paddingVertical: 10, fontSize: 12, fontFamily: 'Inter_400Regular' },
  choice: { borderWidth: 1, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 8 },
  choiceText: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  twoCol: { flexDirection: 'row', gap: 9 },
  save: { borderRadius: 11, paddingVertical: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  saveText: { color: '#fff', fontSize: 13, fontFamily: 'Inter_700Bold' },
});
