import { Feather } from '@expo/vector-icons';
import { Linking } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useMemo } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge, statusBadge, statusLabel } from '@/components/Badge';
import { SectionHeader } from '@/components/SectionHeader';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';

function fmt(n: number) {
  if (n >= 1000000) return `৳${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `৳${(n / 1000).toFixed(0)}K`;
  return `৳${n.toLocaleString()}`;
}

export default function CustomerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { customers, invoices, tickets } = useApp();

  const customer = customers.find(c => c.id === id);
  const customerInvoices = useMemo(() => invoices.filter(i => i.customerId === id).slice(0, 5), [invoices, id]);
  const customerTickets = useMemo(() => tickets.filter(t => t.customerId === id).slice(0, 5), [tickets, id]);

  if (!customer) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }}>Customer not found.</Text>
      </View>
    );
  }

  const pb = insets.bottom + (Platform.OS === 'web' ? 34 : 0);
  const pt = Platform.OS === 'web' ? 16 : 0;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingTop: pt + 16, paddingBottom: pb + 24, paddingHorizontal: 16, gap: 16 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={[styles.headerCard, { backgroundColor: colors.primary }]}>
        <View style={[styles.avatar, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
          <Feather name="briefcase" size={28} color="#fff" />
        </View>
        <Text style={styles.custName}>{customer.name}</Text>
        <Text style={styles.custContact}>{customer.contactPerson}</Text>
        <View style={styles.custMeta}>
          <Badge label={customer.customerType} variant="navy" size="md" />
          <Badge label={customer.district} variant="navy" size="md" />
        </View>
      </View>

      {/* Contact Actions */}
      <View style={styles.contactRow}>
        <TouchableOpacity style={[styles.contactBtn, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => Linking.openURL(`tel:${customer.phone}`)} activeOpacity={0.8}>
          <Feather name="phone" size={18} color={colors.success} />
          <Text style={[styles.contactBtnText, { color: colors.foreground }]}>Call</Text>
        </TouchableOpacity>
        {customer.whatsapp && (
          <TouchableOpacity style={[styles.contactBtn, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => Linking.openURL(`https://wa.me/${customer.whatsapp?.replace(/[^0-9]/g, '')}`)} activeOpacity={0.8}>
            <Feather name="message-square" size={18} color="#25D366" />
            <Text style={[styles.contactBtnText, { color: colors.foreground }]}>WhatsApp</Text>
          </TouchableOpacity>
        )}
        {customer.email && (
          <TouchableOpacity style={[styles.contactBtn, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => Linking.openURL(`mailto:${customer.email}`)} activeOpacity={0.8}>
            <Feather name="mail" size={18} color={colors.primary} />
            <Text style={[styles.contactBtnText, { color: colors.foreground }]}>Email</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Financial Summary */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Financial Overview</Text>
        <View style={styles.finRow}>
          <View style={styles.finItem}>
            <Text style={[styles.finLabel, { color: colors.mutedForeground }]}>Total Billed</Text>
            <Text style={[styles.finVal, { color: colors.foreground }]}>{fmt(customer.totalPaid + customer.totalDue)}</Text>
          </View>
          <View style={styles.finItem}>
            <Text style={[styles.finLabel, { color: colors.mutedForeground }]}>Paid</Text>
            <Text style={[styles.finVal, { color: colors.success }]}>{fmt(customer.totalPaid)}</Text>
          </View>
          <View style={styles.finItem}>
            <Text style={[styles.finLabel, { color: colors.mutedForeground }]}>Balance Due</Text>
            <Text style={[styles.finVal, { color: customer.totalDue > 0 ? colors.secondary : colors.success }]}>{fmt(customer.totalDue)}</Text>
          </View>
        </View>
        <View style={styles.finItem2}>
          <Text style={[styles.finLabel, { color: colors.mutedForeground }]}>Credit Limit</Text>
          <Text style={[styles.finVal2, { color: colors.foreground }]}>{fmt(customer.creditLimit)}</Text>
        </View>
      </View>

      {/* Contact Info */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Contact Information</Text>
        <InfoRow icon="phone" label="Phone" value={customer.phone} colors={colors} />
        {customer.whatsapp && <InfoRow icon="smartphone" label="WhatsApp" value={customer.whatsapp} colors={colors} />}
        {customer.email && <InfoRow icon="mail" label="Email" value={customer.email} colors={colors} />}
        <InfoRow icon="map-pin" label="Address" value={`${customer.address}, ${customer.district}`} colors={colors} />
        <InfoRow icon="calendar" label="Customer Since" value={customer.createdAt} colors={colors} />
      </View>

      {/* Invoices */}
      {customerInvoices.length > 0 && (
        <>
          <SectionHeader title="Recent Invoices" count={customerInvoices.length} />
          {customerInvoices.map(inv => (
            <TouchableOpacity key={inv.id} style={[styles.listRow, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => router.push(`/invoice/${inv.id}` as any)} activeOpacity={0.75}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[styles.rowTitle, { color: colors.foreground }]}>{inv.invoiceNo}</Text>
                <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>{inv.invoiceDate}</Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Text style={[styles.rowAmount, { color: colors.foreground }]}>{fmt(inv.totalAmount)}</Text>
                <Badge label={statusLabel(inv.status)} variant={statusBadge(inv.status)} />
              </View>
            </TouchableOpacity>
          ))}
        </>
      )}

      {/* Tickets */}
      {customerTickets.length > 0 && (
        <>
          <SectionHeader title="Service Tickets" count={customerTickets.length} />
          {customerTickets.map(tk => (
            <TouchableOpacity key={tk.id} style={[styles.listRow, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => router.push(`/ticket/${tk.id}` as any)} activeOpacity={0.75}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[styles.rowTitle, { color: colors.foreground }]} numberOfLines={1}>{tk.title}</Text>
                <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>{tk.ticketNo} · {tk.machineModel ?? 'N/A'}</Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Badge label={statusLabel(tk.status)} variant={statusBadge(tk.status)} />
                <Badge label={tk.priority.toUpperCase()} variant={statusBadge(tk.priority)} />
              </View>
            </TouchableOpacity>
          ))}
        </>
      )}
    </ScrollView>
  );
}

function InfoRow({ icon, label, value, colors }: { icon: keyof typeof Feather.glyphMap; label: string; value: string; colors: ReturnType<typeof import('@/hooks/useColors').useColors> }) {
  return (
    <View style={styles.infoRow}>
      <Feather name={icon} size={14} color={colors.mutedForeground} style={{ marginTop: 2 }} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>{label}</Text>
        <Text style={[styles.infoValue, { color: colors.foreground }]}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerCard: { borderRadius: 16, padding: 20, alignItems: 'center', gap: 8 },
  avatar: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  custName: { fontSize: 22, fontFamily: 'Inter_700Bold', color: '#fff', textAlign: 'center' },
  custContact: { fontSize: 14, fontFamily: 'Inter_400Regular', color: 'rgba(255,255,255,0.8)' },
  custMeta: { flexDirection: 'row', gap: 8, marginTop: 4 },
  contactRow: { flexDirection: 'row', gap: 10 },
  contactBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, paddingVertical: 12, borderWidth: 1 },
  contactBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  card: { borderRadius: 14, padding: 16, borderWidth: 1, gap: 12 },
  sectionTitle: { fontSize: 15, fontFamily: 'Inter_700Bold', marginBottom: 2 },
  finRow: { flexDirection: 'row', justifyContent: 'space-between' },
  finItem: { alignItems: 'center', gap: 4 },
  finItem2: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  finLabel: { fontSize: 11, fontFamily: 'Inter_500Medium', textTransform: 'uppercase' },
  finVal: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  finVal2: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  infoRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  infoLabel: { fontSize: 10, fontFamily: 'Inter_500Medium', textTransform: 'uppercase' },
  infoValue: { fontSize: 14, fontFamily: 'Inter_500Medium', marginTop: 1 },
  listRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderRadius: 12, borderWidth: 1, gap: 12 },
  rowTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  rowSub: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  rowAmount: { fontSize: 15, fontFamily: 'Inter_700Bold' },
});
