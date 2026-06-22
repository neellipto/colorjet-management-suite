import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert, Modal, Platform, ScrollView, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge, statusBadge, statusLabel } from '@/components/Badge';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import type { Payment } from '@/constants/types';

function fmt(n: number) {
  return `৳${n.toLocaleString()}`;
}

const METHODS: Payment['method'][] = ['Cash', 'Bank Transfer', 'bKash', 'Nagad', 'Card', 'Cheque'];

export default function InvoiceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { invoices, payments, customers, addPayment, currentUser } = useApp();

  const invoice = invoices.find(i => i.id === id);
  const invoicePayments = payments.filter(p => p.invoiceId === id);
  const customer = invoice ? customers.find(c => c.id === invoice.customerId) : null;

  const canAddPayment = currentUser?.role === 'admin' || currentUser?.role === 'accounts';

  const [showPayModal, setShowPayModal] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<Payment['method']>('Cash');
  const [payRef, setPayRef] = useState('');

  if (!invoice) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }}>Invoice not found.</Text>
      </View>
    );
  }

  const handleAddPayment = () => {
    const amount = parseFloat(payAmount);
    if (!amount || amount <= 0) { Alert.alert('Invalid', 'Enter a valid amount.'); return; }
    if (amount > invoice.totalDue) { Alert.alert('Too Much', `Amount exceeds due: ${fmt(invoice.totalDue)}`); return; }
    addPayment({
      customerId: invoice.customerId,
      customerName: invoice.customerName,
      invoiceId: invoice.id,
      paymentDate: new Date().toISOString().split('T')[0],
      amount,
      method: payMethod,
      reference: payRef || undefined,
      createdBy: currentUser?.id ?? '',
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowPayModal(false);
    setPayAmount('');
    setPayRef('');
  };

  const pb = insets.bottom + (Platform.OS === 'web' ? 34 : 0);
  const pt = Platform.OS === 'web' ? 16 : 0;

  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ paddingTop: pt + 16, paddingBottom: pb + 100, paddingHorizontal: 16, gap: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Invoice Header */}
        <View style={[styles.card, { backgroundColor: colors.primary }]}>
          <View style={styles.invHeaderTop}>
            <View>
              <Text style={styles.invNo}>{invoice.invoiceNo}</Text>
              <Text style={styles.invDate}>{invoice.invoiceDate}</Text>
            </View>
            <Badge label={statusLabel(invoice.status)} variant={statusBadge(invoice.status)} size="md" />
          </View>
          <Text style={styles.invCustomer}>{invoice.customerName}</Text>
          <View style={styles.invMeta}>
            <Text style={styles.invMetaText}>Due Date: {invoice.dueDate}</Text>
            {customer && <Text style={styles.invMetaText}>{customer.district}</Text>}
          </View>
        </View>

        {/* Financial Summary */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Payment Summary</Text>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Invoice Total</Text>
              <Text style={[styles.summaryVal, { color: colors.foreground }]}>{fmt(invoice.totalAmount)}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Paid</Text>
              <Text style={[styles.summaryVal, { color: colors.success }]}>{fmt(invoice.totalPaid)}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Balance Due</Text>
              <Text style={[styles.summaryVal, { color: invoice.totalDue > 0 ? colors.secondary : colors.success }]}>{fmt(invoice.totalDue)}</Text>
            </View>
          </View>
          {invoice.totalDue > 0 && (
            <View style={[styles.dueBar, { backgroundColor: '#FFEBEE' }]}>
              <Feather name="alert-circle" size={14} color={colors.destructive} />
              <Text style={[styles.dueBarText, { color: colors.destructive }]}>Balance due: {fmt(invoice.totalDue)}</Text>
            </View>
          )}
        </View>

        {/* Line Items */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Items ({invoice.lines.length})</Text>
          {invoice.lines.map((line, idx) => (
            <View key={line.id}>
              {idx > 0 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
              <View style={styles.lineRow}>
                <View style={styles.lineLeft}>
                  <Text style={[styles.lineName, { color: colors.foreground }]}>{line.productName}</Text>
                  {line.description ? <Text style={[styles.lineDesc, { color: colors.mutedForeground }]}>{line.description}</Text> : null}
                  <Text style={[styles.lineQtyPrice, { color: colors.mutedForeground }]}>{line.qty} × {fmt(line.unitPrice)}</Text>
                </View>
                <Text style={[styles.lineTotal, { color: colors.foreground }]}>{fmt(line.lineTotal)}</Text>
              </View>
            </View>
          ))}
          <View style={[styles.lineTotalRow, { borderTopColor: colors.border }]}>
            <Text style={[styles.lineTotalLabel, { color: colors.foreground }]}>Total</Text>
            <Text style={[styles.lineTotalAmount, { color: colors.primary }]}>{fmt(invoice.totalAmount)}</Text>
          </View>
        </View>

        {/* Payment History */}
        {invoicePayments.length > 0 && (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Payments ({invoicePayments.length})</Text>
            {invoicePayments.map((pay, idx) => (
              <View key={pay.id}>
                {idx > 0 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
                <View style={styles.payRow}>
                  <View style={[styles.payIcon, { backgroundColor: colors.navyLight }]}>
                    <Feather name="credit-card" size={14} color={colors.primary} />
                  </View>
                  <View style={styles.payLeft}>
                    <Text style={[styles.payMethod, { color: colors.foreground }]}>{pay.method}</Text>
                    <Text style={[styles.payDate, { color: colors.mutedForeground }]}>{pay.paymentDate}{pay.reference ? ` · ${pay.reference}` : ''}</Text>
                  </View>
                  <Text style={[styles.payAmount, { color: colors.success }]}>{fmt(pay.amount)}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Customer Info */}
        {customer && (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Customer</Text>
            <TouchableOpacity onPress={() => router.push(`/customer/${customer.id}` as any)} activeOpacity={0.75}>
              <Text style={[styles.customerLink, { color: colors.primary }]}>{customer.name}</Text>
            </TouchableOpacity>
            <Text style={[styles.customerMeta, { color: colors.mutedForeground }]}>{customer.phone} · {customer.district}</Text>
          </View>
        )}
      </ScrollView>

      {/* Add Payment FAB */}
      {canAddPayment && invoice.totalDue > 0 && (
        <View style={[styles.fab, { bottom: insets.bottom + (Platform.OS === 'web' ? 34 : 0) + 16 }]}>
          <TouchableOpacity
            style={[styles.fabBtn, { backgroundColor: colors.primary }]}
            onPress={() => setShowPayModal(true)}
            activeOpacity={0.85}
          >
            <Feather name="plus" size={18} color="#fff" />
            <Text style={styles.fabText}>Add Payment</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Add Payment Modal */}
      <Modal visible={showPayModal} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setShowPayModal(false)}>
        <View style={[styles.modal, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Record Payment</Text>
            <TouchableOpacity onPress={() => setShowPayModal(false)}>
              <Feather name="x" size={22} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalBody}>
            <Text style={[styles.modalLabel, { color: colors.mutedForeground }]}>AMOUNT (Max: {fmt(invoice.totalDue)})</Text>
            <View style={[styles.modalInput, { borderColor: colors.border }]}>
              <TextInput
                style={[styles.modalInputText, { color: colors.foreground, fontFamily: 'Inter_400Regular' }]}
                value={payAmount}
                onChangeText={setPayAmount}
                keyboardType="decimal-pad"
                placeholder={`Up to ${fmt(invoice.totalDue)}`}
                placeholderTextColor={colors.mutedForeground}
              />
            </View>
            <Text style={[styles.modalLabel, { color: colors.mutedForeground }]}>PAYMENT METHOD</Text>
            <View style={styles.methodGrid}>
              {METHODS.map(m => (
                <TouchableOpacity
                  key={m}
                  style={[styles.methodBtn, { backgroundColor: payMethod === m ? colors.primary : colors.card, borderColor: payMethod === m ? colors.primary : colors.border }]}
                  onPress={() => setPayMethod(m)}
                >
                  <Text style={[styles.methodText, { color: payMethod === m ? '#fff' : colors.foreground }]}>{m}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={[styles.modalLabel, { color: colors.mutedForeground }]}>REFERENCE (Optional)</Text>
            <View style={[styles.modalInput, { borderColor: colors.border }]}>
              <TextInput
                style={[styles.modalInputText, { color: colors.foreground, fontFamily: 'Inter_400Regular' }]}
                value={payRef}
                onChangeText={setPayRef}
                placeholder="Cheque no, TXN ID..."
                placeholderTextColor={colors.mutedForeground}
              />
            </View>
            <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: colors.primary }]} onPress={handleAddPayment} activeOpacity={0.85}>
              <Text style={styles.confirmText}>Confirm Payment</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: { borderRadius: 14, padding: 16, borderWidth: 1, gap: 10 },
  invHeaderTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  invNo: { fontSize: 18, fontFamily: 'Inter_700Bold', color: '#fff' },
  invDate: { fontSize: 12, fontFamily: 'Inter_400Regular', color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  invCustomer: { fontSize: 20, fontFamily: 'Inter_700Bold', color: '#fff' },
  invMeta: { flexDirection: 'row', gap: 12 },
  invMetaText: { fontSize: 12, fontFamily: 'Inter_400Regular', color: 'rgba(255,255,255,0.7)' },
  sectionTitle: { fontSize: 15, fontFamily: 'Inter_700Bold', marginBottom: 6 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryItem: { alignItems: 'center', gap: 4 },
  summaryLabel: { fontSize: 11, fontFamily: 'Inter_500Medium', textTransform: 'uppercase' },
  summaryVal: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  dueBar: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 8 },
  dueBarText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  divider: { height: 1, marginVertical: 10 },
  lineRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  lineLeft: { flex: 1, gap: 2 },
  lineName: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  lineDesc: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  lineQtyPrice: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  lineTotal: { fontSize: 14, fontFamily: 'Inter_700Bold', marginLeft: 12 },
  lineTotalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 12, marginTop: 4, borderTopWidth: 1 },
  lineTotalLabel: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  lineTotalAmount: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  payRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  payIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  payLeft: { flex: 1, gap: 2 },
  payMethod: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  payDate: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  payAmount: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  customerLink: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  customerMeta: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  fab: { position: 'absolute', right: 16, left: 16 },
  fabBtn: { borderRadius: 14, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, shadowColor: '#1A237E', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
  fabText: { color: '#fff', fontSize: 15, fontFamily: 'Inter_700Bold' },
  modal: { flex: 1 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1 },
  modalTitle: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  modalBody: { padding: 20, gap: 10, paddingBottom: 40 },
  modalLabel: { fontSize: 11, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.5, marginTop: 8 },
  modalInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12 },
  modalInputText: { fontSize: 15 },
  methodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  methodBtn: { borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1 },
  methodText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  confirmBtn: { borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 12 },
  confirmText: { color: '#fff', fontSize: 16, fontFamily: 'Inter_700Bold' },
});
