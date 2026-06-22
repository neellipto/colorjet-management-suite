import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Image, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge, statusBadge, statusLabel } from '@/components/Badge';
import { SignaturePad } from '@/components/SignaturePad';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import type { ServicePart, ServicePhoto } from '@/constants/types';

const PHOTO_TYPES: ServicePhoto['type'][] = ['before', 'problem', 'parts', 'serial', 'after', 'other'];
const BILLING_TYPES: NonNullable<ServicePart['billing']>[] = ['warranty', 'free', 'chargeable'];

function fmtDuration(ms?: number): string {
  if (!ms || ms < 0) return '00:00:00';
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(h)}:${p(m)}:${p(s)}`;
}

function fmtMoney(n: number) {
  return `৳${n.toLocaleString()}`;
}

export default function TicketDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    tickets, products, currentUser,
    updateTicketStatus, startTravel, startWork, pauseWork, resumeWork, completeWork,
    addTicketPart, addTicketPhoto, saveSignature, submitReport,
  } = useApp();

  const ticket = useMemo(() => tickets.find(t => t.id === id), [tickets, id]);

  const [tick, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const [partModal, setPartModal] = useState(false);
  const [partProductId, setPartProductId] = useState('');
  const [partQty, setPartQty] = useState('1');
  const [partBilling, setPartBilling] = useState<NonNullable<ServicePart['billing']>>('warranty');

  const [sigModal, setSigModal] = useState(false);
  const [sigData, setSigData] = useState('');
  const [sigCustomerName, setSigCustomerName] = useState('');
  const [sigRating, setSigRating] = useState(5);
  const [sigComment, setSigComment] = useState('');

  const [reportModal, setReportModal] = useState(false);
  const [problemFound, setProblemFound] = useState('');
  const [workDone, setWorkDone] = useState('');
  const [pendingIssue, setPendingIssue] = useState('');
  const [revisit, setRevisit] = useState(false);

  const [photoType, setPhotoType] = useState<ServicePhoto['type']>('before');

  const pb = insets.bottom + (Platform.OS === 'web' ? 34 : 0) + 24;
  const pt = Platform.OS === 'web' ? 16 : 0;

  if (!ticket) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.mutedForeground }}>Ticket not found.</Text>
      </View>
    );
  }

  const canEdit = currentUser?.role === 'engineer'
    ? ticket.assignedEngineerId === currentUser.id
    : ['admin', 'manager', 'service_control'].includes(currentUser?.role ?? '');

  const liveWorkMs = ticket.workStartAt && !ticket.workEndAt
    ? Date.now() - new Date(ticket.workStartAt).getTime() - (ticket.pausedMs ?? 0) - (ticket.isPaused && ticket.pauseStartedAt ? Date.now() - new Date(ticket.pauseStartedAt).getTime() : 0)
    : ticket.totalWorkMs;
  void tick;

  const partsTotal = (ticket.usedParts ?? []).reduce((s, p) => s + (p.billing === 'chargeable' ? (p.unitPrice ?? 0) * p.qty : 0), 0);

  const haptic = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

  const doAddPart = () => {
    const product = products.find(p => p.id === partProductId);
    if (!product) { Alert.alert('Select a part', 'Please choose a product.'); return; }
    const qty = Math.max(1, parseInt(partQty, 10) || 1);
    const part: ServicePart = {
      productId: product.id,
      productName: product.name,
      qty,
      billing: partBilling,
      unitPrice: partBilling === 'chargeable' ? product.salePrice : 0,
    };
    addTicketPart(ticket.id, part);
    haptic();
    setPartModal(false);
    setPartProductId('');
    setPartQty('1');
    setPartBilling('warranty');
  };

  const pickPhoto = async (fromCamera: boolean) => {
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission needed', 'Please allow access to add photos.'); return; }
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.5 })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.5, mediaTypes: ['images'] });
    if (!result.canceled && result.assets[0]) {
      addTicketPhoto(ticket.id, { uri: result.assets[0].uri, type: photoType });
      haptic();
    }
  };

  const doSaveSignature = () => {
    if (!sigCustomerName.trim()) { Alert.alert('Name required', 'Enter the customer name.'); return; }
    if (!sigData) { Alert.alert('Signature required', 'Please capture the signature.'); return; }
    saveSignature(ticket.id, {
      customerName: sigCustomerName.trim(),
      signatureData: sigData,
      rating: sigRating,
      comment: sigComment.trim() || undefined,
      confirmed: true,
    });
    haptic();
    setSigModal(false);
  };

  const doSubmitReport = () => {
    if (!problemFound.trim() || !workDone.trim()) { Alert.alert('Required', 'Fill problem found and work done.'); return; }
    submitReport(ticket.id, {
      problemFound: problemFound.trim(),
      workDone: workDone.trim(),
      pendingIssue: pendingIssue.trim() || undefined,
      revisitRequired: revisit,
      submittedById: currentUser?.id ?? 'u2',
      submittedByName: currentUser?.name ?? ticket.assignedEngineerName,
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setReportModal(false);
  };

  const WorkflowButtons = () => {
    if (!canEdit) return null;
    const s = ticket.status;
    const btns: { label: string; icon: keyof typeof Feather.glyphMap; onPress: () => void; color?: string }[] = [];
    if (s === 'pending' || s === 'assigned') {
      btns.push({ label: 'Accept Job', icon: 'check-circle', onPress: () => { updateTicketStatus(ticket.id, 'accepted'); haptic(); } });
    }
    if (s === 'accepted') {
      btns.push({ label: 'Start Travel', icon: 'navigation', onPress: () => { startTravel(ticket.id); haptic(); } });
    }
    if (s === 'on_the_way') {
      btns.push({ label: 'Start Work', icon: 'play', onPress: () => { startWork(ticket.id); haptic(); } });
    }
    if (s === 'in_progress') {
      if (ticket.isPaused) {
        btns.push({ label: 'Resume', icon: 'play', onPress: () => { resumeWork(ticket.id); haptic(); } });
      } else {
        btns.push({ label: 'Pause', icon: 'pause', onPress: () => { pauseWork(ticket.id); haptic(); }, color: colors.warning });
      }
      btns.push({ label: 'Waiting Parts', icon: 'package', onPress: () => { updateTicketStatus(ticket.id, 'waiting_parts'); haptic(); }, color: colors.destructive });
      btns.push({ label: 'Pending Customer', icon: 'user-x', onPress: () => { updateTicketStatus(ticket.id, 'pending_customer'); haptic(); }, color: colors.secondary });
      btns.push({ label: 'Complete Work', icon: 'flag', onPress: () => { completeWork(ticket.id); haptic(); }, color: colors.success });
    }
    if (s === 'waiting_parts' || s === 'pending_customer') {
      btns.push({ label: 'Resume Work', icon: 'play', onPress: () => { updateTicketStatus(ticket.id, 'in_progress'); haptic(); } });
    }
    if (s === 'revisit') {
      btns.push({ label: 'Start Revisit', icon: 'refresh-cw', onPress: () => { updateTicketStatus(ticket.id, 'in_progress'); haptic(); } });
    }
    if (btns.length === 0) return null;
    return (
      <View style={styles.workflowRow}>
        {btns.map(b => (
          <TouchableOpacity
            key={b.label}
            style={[styles.wfBtn, { backgroundColor: b.color ?? colors.primary }]}
            onPress={b.onPress}
            activeOpacity={0.85}
          >
            <Feather name={b.icon} size={15} color="#fff" />
            <Text style={styles.wfBtnText}>{b.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const Section = ({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) => (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.cardHead}>
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>{title}</Text>
        {action}
      </View>
      {children}
    </View>
  );

  const InfoLine = ({ label, value }: { label: string; value?: string }) => {
    if (!value) return null;
    return (
      <View style={styles.infoLine}>
        <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>{label}</Text>
        <Text style={[styles.infoValue, { color: colors.foreground }]}>{value}</Text>
      </View>
    );
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingTop: pt + 16, paddingBottom: pb, paddingHorizontal: 16, gap: 14 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.headerTop}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.ticketNo, { color: colors.mutedForeground }]}>{ticket.ticketNo}</Text>
            <Text style={[styles.customer, { color: colors.foreground }]}>{ticket.customerName}</Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            <Badge label={statusLabel(ticket.status)} variant={statusBadge(ticket.status)} size="md" />
            <Badge label={ticket.priority.toUpperCase()} variant={statusBadge(ticket.priority)} size="sm" />
          </View>
        </View>
        <Text style={[styles.title, { color: colors.foreground }]}>{ticket.title}</Text>
        <Text style={[styles.desc, { color: colors.mutedForeground }]}>{ticket.description}</Text>
      </View>

      {/* Workflow */}
      <WorkflowButtons />

      {/* Timer */}
      {(ticket.workStartAt || ticket.travelStartAt) && (
        <View style={[styles.timerCard, { backgroundColor: colors.primary }]}>
          <View style={styles.timerCol}>
            <Text style={styles.timerLabel}>WORK TIME</Text>
            <Text style={styles.timerValue}>{fmtDuration(liveWorkMs)}</Text>
            {ticket.isPaused && <Text style={styles.timerPaused}>PAUSED</Text>}
          </View>
          <View style={styles.timerDivider} />
          <View style={styles.timerCol}>
            <Text style={styles.timerLabel}>TRAVEL TIME</Text>
            <Text style={styles.timerValue}>{fmtDuration(ticket.totalTravelMs)}</Text>
          </View>
        </View>
      )}

      {/* Customer / Machine */}
      <Section title="Machine & Customer">
        <InfoLine label="Machine" value={ticket.machineModel} />
        <InfoLine label="Serial" value={ticket.machineSerial} />
        <InfoLine label="Warranty" value={ticket.warrantyStatus ? statusLabel(ticket.warrantyStatus) : undefined} />
        <InfoLine label="Phone" value={ticket.customerPhone} />
        <InfoLine label="Address" value={ticket.customerAddress} />
        <InfoLine label="Area" value={ticket.area} />
        <InfoLine label="Engineer" value={ticket.assignedEngineerName} />
        <InfoLine label="Planned" value={`${ticket.plannedDate}${ticket.scheduledTime ? ' ' + ticket.scheduledTime : ''}`} />
        {ticket.customerPhone && (
          <View style={styles.contactRow}>
            <TouchableOpacity style={[styles.contactBtn, { borderColor: colors.border }]} activeOpacity={0.7}>
              <Feather name="phone" size={14} color={colors.success} />
              <Text style={[styles.contactText, { color: colors.foreground }]}>Call</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.contactBtn, { borderColor: colors.border }]} activeOpacity={0.7}>
              <Feather name="message-circle" size={14} color={colors.success} />
              <Text style={[styles.contactText, { color: colors.foreground }]}>WhatsApp</Text>
            </TouchableOpacity>
          </View>
        )}
      </Section>

      {/* Parts */}
      <Section
        title={`Parts Used (${(ticket.usedParts ?? []).length})`}
        action={canEdit ? (
          <TouchableOpacity style={styles.addBtn} onPress={() => setPartModal(true)} activeOpacity={0.7}>
            <Feather name="plus" size={14} color={colors.primary} />
            <Text style={[styles.addText, { color: colors.primary }]}>Add</Text>
          </TouchableOpacity>
        ) : undefined}
      >
        {(ticket.usedParts ?? []).length === 0 ? (
          <Text style={[styles.empty, { color: colors.mutedForeground }]}>No parts added</Text>
        ) : (
          (ticket.usedParts ?? []).map((p, i) => (
            <View key={i} style={[styles.partRow, { borderColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.partName, { color: colors.foreground }]}>{p.productName}</Text>
                <Text style={[styles.partSub, { color: colors.mutedForeground }]}>Qty {p.qty} · {p.billing}</Text>
              </View>
              <Text style={[styles.partPrice, { color: colors.foreground }]}>
                {p.billing === 'chargeable' ? fmtMoney((p.unitPrice ?? 0) * p.qty) : '—'}
              </Text>
            </View>
          ))
        )}
        {partsTotal > 0 && (
          <View style={styles.partTotalRow}>
            <Text style={[styles.partName, { color: colors.foreground }]}>Chargeable Total</Text>
            <Text style={[styles.partPrice, { color: colors.secondary }]}>{fmtMoney(partsTotal)}</Text>
          </View>
        )}
      </Section>

      {/* Photos */}
      <Section title={`Photos (${(ticket.photos ?? []).length})`}>
        {canEdit && (
          <>
            <View style={styles.photoTypeRow}>
              {PHOTO_TYPES.map(t => (
                <TouchableOpacity
                  key={t}
                  style={[styles.chip, { backgroundColor: photoType === t ? colors.primary : colors.background, borderColor: photoType === t ? colors.primary : colors.border }]}
                  onPress={() => setPhotoType(t)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.chipText, { color: photoType === t ? '#fff' : colors.mutedForeground }]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.photoBtnRow}>
              <TouchableOpacity style={[styles.photoBtn, { backgroundColor: colors.navyLight }]} onPress={() => pickPhoto(true)} activeOpacity={0.8}>
                <Feather name="camera" size={15} color={colors.primary} />
                <Text style={[styles.photoBtnText, { color: colors.primary }]}>Camera</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.photoBtn, { backgroundColor: colors.navyLight }]} onPress={() => pickPhoto(false)} activeOpacity={0.8}>
                <Feather name="image" size={15} color={colors.primary} />
                <Text style={[styles.photoBtnText, { color: colors.primary }]}>Gallery</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
        {(ticket.photos ?? []).length === 0 ? (
          <Text style={[styles.empty, { color: colors.mutedForeground }]}>No photos added</Text>
        ) : (
          <View style={styles.photoGrid}>
            {(ticket.photos ?? []).map(ph => (
              <View key={ph.id} style={styles.photoThumb}>
                <Image source={{ uri: ph.uri }} style={styles.photoImg} />
                <View style={[styles.photoTag, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
                  <Text style={styles.photoTagText}>{ph.type}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </Section>

      {/* Signature */}
      <Section title="Customer Signature">
        {ticket.signature ? (
          <View style={{ gap: 6 }}>
            <InfoLine label="Signed by" value={ticket.signature.customerName} />
            <InfoLine label="Rating" value={`${ticket.signature.rating ?? '-'} / 5`} />
            {ticket.signature.comment ? <InfoLine label="Comment" value={ticket.signature.comment} /> : null}
            <Badge label="Confirmed" variant="success" size="sm" />
          </View>
        ) : canEdit ? (
          <TouchableOpacity style={[styles.outlineBtn, { borderColor: colors.primary }]} onPress={() => { setSigCustomerName(ticket.customerName); setSigModal(true); }} activeOpacity={0.8}>
            <Feather name="edit-3" size={15} color={colors.primary} />
            <Text style={[styles.outlineBtnText, { color: colors.primary }]}>Capture Signature</Text>
          </TouchableOpacity>
        ) : (
          <Text style={[styles.empty, { color: colors.mutedForeground }]}>Not signed yet</Text>
        )}
      </Section>

      {/* Report */}
      <Section title="Service Report">
        {ticket.report ? (
          <View style={{ gap: 6 }}>
            <InfoLine label="Problem" value={ticket.report.problemFound} />
            <InfoLine label="Work Done" value={ticket.report.workDone} />
            <InfoLine label="Pending" value={ticket.report.pendingIssue} />
            <InfoLine label="Revisit" value={ticket.report.revisitRequired ? 'Required' : 'No'} />
            <TouchableOpacity style={[styles.outlineBtn, { borderColor: colors.primary, marginTop: 6 }]} onPress={() => router.push(`/ticket/report/${ticket.id}` as any)} activeOpacity={0.8}>
              <Feather name="printer" size={15} color={colors.primary} />
              <Text style={[styles.outlineBtnText, { color: colors.primary }]}>View / Print Report</Text>
            </TouchableOpacity>
          </View>
        ) : canEdit ? (
          <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.primary }]} onPress={() => setReportModal(true)} activeOpacity={0.85}>
            <Feather name="file-text" size={15} color="#fff" />
            <Text style={styles.primaryBtnText}>Submit Final Report</Text>
          </TouchableOpacity>
        ) : (
          <Text style={[styles.empty, { color: colors.mutedForeground }]}>No report submitted</Text>
        )}
      </Section>

      {ticket.workNotes ? (
        <Section title="Work Notes">
          <Text style={[styles.desc, { color: colors.foreground }]}>{ticket.workNotes}</Text>
        </Section>
      ) : null}

      {/* Add Part Modal */}
      <Modal visible={partModal} transparent animationType="slide" onRequestClose={() => setPartModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Add Part</Text>
            <ScrollView style={{ maxHeight: 220 }}>
              {products.filter(p => p.productType !== 'machine').map(p => (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.pickRow, { borderColor: colors.border, backgroundColor: partProductId === p.id ? colors.navyLight : 'transparent' }]}
                  onPress={() => setPartProductId(p.id)}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.partName, { color: colors.foreground }]}>{p.name}</Text>
                    <Text style={[styles.partSub, { color: colors.mutedForeground }]}>Stock {p.currentStock} · {fmtMoney(p.salePrice)}</Text>
                  </View>
                  {partProductId === p.id && <Feather name="check" size={16} color={colors.primary} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={styles.modalRow}>
              <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Qty</Text>
              <TextInput
                style={[styles.qtyInput, { borderColor: colors.border, color: colors.foreground }]}
                value={partQty}
                onChangeText={setPartQty}
                keyboardType="number-pad"
              />
            </View>
            <View style={styles.billingRow}>
              {BILLING_TYPES.map(b => (
                <TouchableOpacity
                  key={b}
                  style={[styles.chip, { backgroundColor: partBilling === b ? colors.primary : colors.background, borderColor: partBilling === b ? colors.primary : colors.border }]}
                  onPress={() => setPartBilling(b)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.chipText, { color: partBilling === b ? '#fff' : colors.mutedForeground }]}>{b}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.muted }]} onPress={() => setPartModal(false)} activeOpacity={0.8}>
                <Text style={[styles.modalBtnText, { color: colors.foreground }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.primary }]} onPress={doAddPart} activeOpacity={0.85}>
                <Text style={[styles.modalBtnText, { color: '#fff' }]}>Add Part</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Signature Modal */}
      <Modal visible={sigModal} transparent animationType="slide" onRequestClose={() => setSigModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Customer Sign-off</Text>
            <TextInput
              style={[styles.textInput, { borderColor: colors.border, color: colors.foreground }]}
              value={sigCustomerName}
              onChangeText={setSigCustomerName}
              placeholder="Customer name"
              placeholderTextColor={colors.mutedForeground}
            />
            <SignaturePad onChange={setSigData} />
            <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Rating</Text>
            <View style={styles.ratingRow}>
              {[1, 2, 3, 4, 5].map(r => (
                <TouchableOpacity key={r} onPress={() => setSigRating(r)} activeOpacity={0.7}>
                  <Feather name="star" size={26} color={r <= sigRating ? colors.secondary : colors.border} />
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={[styles.textInput, { borderColor: colors.border, color: colors.foreground }]}
              value={sigComment}
              onChangeText={setSigComment}
              placeholder="Customer comment (optional)"
              placeholderTextColor={colors.mutedForeground}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.muted }]} onPress={() => setSigModal(false)} activeOpacity={0.8}>
                <Text style={[styles.modalBtnText, { color: colors.foreground }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.primary }]} onPress={doSaveSignature} activeOpacity={0.85}>
                <Text style={[styles.modalBtnText, { color: '#fff' }]}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Report Modal */}
      <Modal visible={reportModal} transparent animationType="slide" onRequestClose={() => setReportModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Final Service Report</Text>
            <TextInput
              style={[styles.textArea, { borderColor: colors.border, color: colors.foreground }]}
              value={problemFound}
              onChangeText={setProblemFound}
              placeholder="Problem found"
              placeholderTextColor={colors.mutedForeground}
              multiline
            />
            <TextInput
              style={[styles.textArea, { borderColor: colors.border, color: colors.foreground }]}
              value={workDone}
              onChangeText={setWorkDone}
              placeholder="Work done"
              placeholderTextColor={colors.mutedForeground}
              multiline
            />
            <TextInput
              style={[styles.textArea, { borderColor: colors.border, color: colors.foreground }]}
              value={pendingIssue}
              onChangeText={setPendingIssue}
              placeholder="Pending issue (optional)"
              placeholderTextColor={colors.mutedForeground}
              multiline
            />
            <TouchableOpacity style={styles.checkRow} onPress={() => setRevisit(r => !r)} activeOpacity={0.7}>
              <View style={[styles.checkbox, { borderColor: colors.primary, backgroundColor: revisit ? colors.primary : 'transparent' }]}>
                {revisit && <Feather name="check" size={13} color="#fff" />}
              </View>
              <Text style={[styles.infoValue, { color: colors.foreground }]}>Revisit required</Text>
            </TouchableOpacity>
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.muted }]} onPress={() => setReportModal(false)} activeOpacity={0.8}>
                <Text style={[styles.modalBtnText, { color: colors.foreground }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.primary }]} onPress={doSubmitReport} activeOpacity={0.85}>
                <Text style={[styles.modalBtnText, { color: '#fff' }]}>Submit</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: { borderRadius: 14, padding: 16, borderWidth: 1, gap: 8 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  cardTitle: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  ticketNo: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  customer: { fontSize: 19, fontFamily: 'Inter_700Bold' },
  title: { fontSize: 15, fontFamily: 'Inter_600SemiBold', marginTop: 4 },
  desc: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 19 },
  workflowRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  wfBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 11, borderRadius: 10 },
  wfBtnText: { color: '#fff', fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  timerCard: { borderRadius: 14, padding: 18, flexDirection: 'row', alignItems: 'center' },
  timerCol: { flex: 1, alignItems: 'center', gap: 4 },
  timerLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.5 },
  timerValue: { color: '#fff', fontSize: 24, fontFamily: 'Inter_700Bold', fontVariant: ['tabular-nums'] },
  timerPaused: { color: '#FFD54F', fontSize: 11, fontFamily: 'Inter_700Bold' },
  timerDivider: { width: 1, height: 40, backgroundColor: 'rgba(255,255,255,0.2)' },
  infoLine: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 3 },
  infoLabel: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  infoValue: { fontSize: 13, fontFamily: 'Inter_500Medium', flexShrink: 1, textAlign: 'right' },
  contactRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  contactBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderRadius: 9, borderWidth: 1 },
  contactText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  addText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  empty: { fontSize: 13, fontFamily: 'Inter_400Regular', paddingVertical: 6 },
  partRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 9, borderTopWidth: 1 },
  partName: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  partSub: { fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 2 },
  partPrice: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  partTotalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 9, marginTop: 4, borderTopWidth: 1, borderTopColor: '#E5E5EA' },
  photoTypeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  chipText: { fontSize: 12, fontFamily: 'Inter_500Medium', textTransform: 'capitalize' },
  photoBtnRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  photoBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 9 },
  photoBtnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  photoThumb: { width: 88, height: 88, borderRadius: 10, overflow: 'hidden' },
  photoImg: { width: '100%', height: '100%' },
  photoTag: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingVertical: 2, alignItems: 'center' },
  photoTagText: { color: '#fff', fontSize: 10, fontFamily: 'Inter_600SemiBold', textTransform: 'capitalize' },
  outlineBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 11, borderRadius: 10, borderWidth: 1.5 },
  outlineBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 10 },
  primaryBtnText: { color: '#fff', fontSize: 14, fontFamily: 'Inter_700Bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 12 },
  modalTitle: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  pickRow: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 8, borderWidth: 1, marginBottom: 6 },
  modalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  qtyInput: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, width: 90, textAlign: 'center', fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  billingRow: { flexDirection: 'row', gap: 8 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  modalBtn: { flex: 1, paddingVertical: 13, borderRadius: 10, alignItems: 'center' },
  modalBtnText: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  textInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, fontFamily: 'Inter_400Regular' },
  textArea: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, fontFamily: 'Inter_400Regular', minHeight: 64, textAlignVertical: 'top' },
  ratingRow: { flexDirection: 'row', gap: 10, justifyContent: 'center' },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
});
