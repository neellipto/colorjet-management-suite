import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import React, { useMemo } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';

function fmtMoney(n: number) {
  return `৳${n.toLocaleString()}`;
}

export default function ServiceReportScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { tickets, company } = useApp();
  const ticket = useMemo(() => tickets.find(t => t.id === id), [tickets, id]);

  const pb = insets.bottom + (Platform.OS === 'web' ? 34 : 0) + 24;
  const pt = Platform.OS === 'web' ? 16 : 0;

  if (!ticket) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.mutedForeground }}>Report not found.</Text>
      </View>
    );
  }

  const partsTotal = (ticket.usedParts ?? []).reduce((s, p) => s + (p.billing === 'chargeable' ? (p.unitPrice ?? 0) * p.qty : 0), 0);

  const handlePrint = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.print();
    }
  };

  const Row = ({ label, value }: { label: string; value?: string }) => {
    if (!value) return null;
    return (
      <View style={styles.row}>
        <Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text>
        <Text style={[styles.value, { color: colors.foreground }]}>{value}</Text>
      </View>
    );
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingTop: pt + 16, paddingBottom: pb, paddingHorizontal: 16, gap: 14 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {/* Letterhead */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Text style={[styles.company, { color: colors.primary }]}>{company.companyName}</Text>
          <Text style={[styles.sub, { color: colors.mutedForeground }]}>{company.address}</Text>
          <Text style={[styles.sub, { color: colors.mutedForeground }]}>Hotline: {company.hotline} · {company.email}</Text>
          <View style={[styles.reportTag, { backgroundColor: colors.navyLight }]}>
            <Text style={[styles.reportTagText, { color: colors.primary }]}>SERVICE REPORT</Text>
          </View>
        </View>

        <View style={styles.block}>
          <Row label="Ticket No" value={ticket.ticketNo} />
          <Row label="Date" value={ticket.completedDate ?? ticket.plannedDate} />
          <Row label="Customer" value={ticket.customerName} />
          <Row label="Address" value={ticket.customerAddress} />
          <Row label="Phone" value={ticket.customerPhone} />
        </View>

        <View style={[styles.block, { borderTopColor: colors.border, borderTopWidth: 1, paddingTop: 12 }]}>
          <Row label="Machine" value={ticket.machineModel} />
          <Row label="Serial" value={ticket.machineSerial} />
          <Row label="Warranty" value={ticket.warrantyStatus} />
          <Row label="Engineer" value={ticket.assignedEngineerName} />
        </View>

        {ticket.report && (
          <View style={[styles.block, { borderTopColor: colors.border, borderTopWidth: 1, paddingTop: 12 }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Problem Found</Text>
            <Text style={[styles.para, { color: colors.foreground }]}>{ticket.report.problemFound}</Text>
            <Text style={[styles.sectionTitle, { color: colors.foreground, marginTop: 8 }]}>Work Done</Text>
            <Text style={[styles.para, { color: colors.foreground }]}>{ticket.report.workDone}</Text>
            {ticket.report.pendingIssue ? (
              <>
                <Text style={[styles.sectionTitle, { color: colors.foreground, marginTop: 8 }]}>Pending Issue</Text>
                <Text style={[styles.para, { color: colors.foreground }]}>{ticket.report.pendingIssue}</Text>
              </>
            ) : null}
          </View>
        )}

        {(ticket.usedParts ?? []).length > 0 && (
          <View style={[styles.block, { borderTopColor: colors.border, borderTopWidth: 1, paddingTop: 12 }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Parts Used</Text>
            {(ticket.usedParts ?? []).map((p, i) => (
              <View key={i} style={styles.row}>
                <Text style={[styles.value, { color: colors.foreground }]}>{p.productName} x{p.qty} ({p.billing})</Text>
                <Text style={[styles.value, { color: colors.foreground }]}>{p.billing === 'chargeable' ? fmtMoney((p.unitPrice ?? 0) * p.qty) : '—'}</Text>
              </View>
            ))}
            {partsTotal > 0 && (
              <View style={[styles.row, { marginTop: 4 }]}>
                <Text style={[styles.label, { color: colors.foreground }]}>Total Chargeable</Text>
                <Text style={[styles.totalValue, { color: colors.secondary }]}>{fmtMoney(partsTotal)}</Text>
              </View>
            )}
          </View>
        )}

        {/* Signature */}
        <View style={[styles.sigBlock, { borderTopColor: colors.border }]}>
          <View style={styles.sigCol}>
            <View style={[styles.sigLine, { borderTopColor: colors.foreground }]} />
            <Text style={[styles.sigLabel, { color: colors.mutedForeground }]}>Engineer</Text>
            <Text style={[styles.sigName, { color: colors.foreground }]}>{ticket.assignedEngineerName}</Text>
          </View>
          <View style={styles.sigCol}>
            <View style={[styles.sigLine, { borderTopColor: colors.foreground }]} />
            <Text style={[styles.sigLabel, { color: colors.mutedForeground }]}>Customer</Text>
            <Text style={[styles.sigName, { color: colors.foreground }]}>{ticket.signature?.customerName ?? ticket.customerName}</Text>
            {ticket.signature?.rating ? (
              <Text style={[styles.sigLabel, { color: colors.mutedForeground }]}>Rating: {ticket.signature.rating}/5</Text>
            ) : null}
          </View>
        </View>
      </View>

      {Platform.OS === 'web' && (
        <TouchableOpacity style={[styles.printBtn, { backgroundColor: colors.primary }]} onPress={handlePrint} activeOpacity={0.85}>
          <Feather name="printer" size={16} color="#fff" />
          <Text style={styles.printBtnText}>Print / Save PDF</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  sheet: { borderRadius: 14, padding: 20, borderWidth: 1, gap: 14 },
  header: { alignItems: 'center', gap: 3, paddingBottom: 14, borderBottomWidth: 1 },
  company: { fontSize: 20, fontFamily: 'Inter_700Bold', letterSpacing: 1 },
  sub: { fontSize: 11, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  reportTag: { marginTop: 8, paddingHorizontal: 14, paddingVertical: 5, borderRadius: 6 },
  reportTagText: { fontSize: 13, fontFamily: 'Inter_700Bold', letterSpacing: 1 },
  block: { gap: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 2 },
  label: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  value: { fontSize: 13, fontFamily: 'Inter_500Medium', flexShrink: 1, textAlign: 'right' },
  totalValue: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  sectionTitle: { fontSize: 13, fontFamily: 'Inter_700Bold', marginBottom: 2 },
  para: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 19 },
  sigBlock: { flexDirection: 'row', gap: 24, borderTopWidth: 1, paddingTop: 28, marginTop: 6 },
  sigCol: { flex: 1, alignItems: 'center', gap: 3 },
  sigLine: { borderTopWidth: 1, width: '100%', borderStyle: 'solid' },
  sigLabel: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  sigName: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  printBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, borderRadius: 10 },
  printBtnText: { color: '#fff', fontSize: 14, fontFamily: 'Inter_700Bold' },
});
