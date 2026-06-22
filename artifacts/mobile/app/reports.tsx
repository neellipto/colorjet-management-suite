import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useMemo } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatCard } from '@/components/StatCard';
import { SectionHeader } from '@/components/SectionHeader';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';

function fmt(n: number) {
  if (n >= 1000000) return `৳${(n / 1000000).toFixed(2)}M`;
  if (n >= 1000) return `৳${(n / 1000).toFixed(1)}K`;
  return `৳${n.toLocaleString()}`;
}

export default function ReportsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { invoices, payments, expenses, customers, tickets, engineers } = useApp();

  const month = '2024-06';

  const report = useMemo(() => {
    const mtdSales = invoices.filter(i => i.invoiceDate.startsWith(month)).reduce((s, i) => s + i.totalAmount, 0);
    const mtdCollection = payments.filter(p => p.paymentDate.startsWith(month)).reduce((s, p) => s + p.amount, 0);
    const totalDue = invoices.reduce((s, i) => s + i.totalDue, 0);
    const mtdExpenses = expenses.filter(e => e.expenseDate.startsWith(month)).reduce((s, e) => s + e.amount, 0);
    const grossProfit = mtdSales - mtdExpenses;

    const byCustomer = customers.map(c => ({
      id: c.id, name: c.name, due: c.totalDue, paid: c.totalPaid,
    })).filter(c => c.due > 0).sort((a, b) => b.due - a.due).slice(0, 5);

    const expByCategory: Record<string, number> = {};
    expenses.filter(e => e.expenseDate.startsWith(month)).forEach(e => {
      expByCategory[e.category] = (expByCategory[e.category] ?? 0) + e.amount;
    });
    const expenseBreakdown = Object.entries(expByCategory).sort((a, b) => b[1] - a[1]);

    const completedTickets = tickets.filter(t => t.status === 'completed').length;
    const openTickets = tickets.filter(t => t.status !== 'completed' && t.status !== 'cancelled').length;

    const topEngineers = [...engineers]
      .sort((a, b) => b.completedJobs - a.completedJobs || b.rating - a.rating)
      .slice(0, 5);

    return { mtdSales, mtdCollection, totalDue, mtdExpenses, grossProfit, byCustomer, expenseBreakdown, completedTickets, openTickets, topEngineers };
  }, [invoices, payments, expenses, customers, tickets, engineers]);

  const pb = insets.bottom + (Platform.OS === 'web' ? 34 : 0);
  const pt = Platform.OS === 'web' ? 16 : 0;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingTop: pt + 16, paddingBottom: pb + 24, paddingHorizontal: 16, gap: 16 }}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.screenTitle, { color: colors.foreground }]}>Reports Center</Text>
      <Text style={[styles.period, { color: colors.mutedForeground }]}>Period: June 2024</Text>

      {/* Revenue */}
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Revenue Overview</Text>
        <View style={styles.statsRow}>
          <StatCard label="Sales MTD" value={fmt(report.mtdSales)} accent="primary" />
          <StatCard label="Collected" value={fmt(report.mtdCollection)} accent="success" />
        </View>
        <View style={styles.statsRow}>
          <StatCard label="Total Due" value={fmt(report.totalDue)} accent="orange" />
          <StatCard label="Expenses" value={fmt(report.mtdExpenses)} accent="error" />
        </View>
        <View style={[styles.profitRow, { backgroundColor: report.grossProfit >= 0 ? '#E8F5E9' : '#FFEBEE' }]}>
          <Text style={[styles.profitLabel, { color: colors.mutedForeground }]}>Gross Profit (Sales - Expenses)</Text>
          <Text style={[styles.profitVal, { color: report.grossProfit >= 0 ? colors.success : colors.destructive }]}>{fmt(report.grossProfit)}</Text>
        </View>
      </View>

      {/* Top Debtors */}
      {report.byCustomer.length > 0 && (
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SectionHeader title="Top Debtors" count={report.byCustomer.length} />
          {report.byCustomer.map((c, i) => (
            <TouchableOpacity key={c.id} style={styles.debtRow} onPress={() => router.push(`/customer/${c.id}` as any)} activeOpacity={0.75}>
              <View style={[styles.rank, { backgroundColor: i === 0 ? colors.secondary : colors.muted }]}>
                <Text style={[styles.rankText, { color: i === 0 ? '#fff' : colors.mutedForeground }]}>#{i + 1}</Text>
              </View>
              <Text style={[styles.debtName, { color: colors.foreground }]} numberOfLines={1}>{c.name}</Text>
              <Text style={[styles.debtAmt, { color: colors.secondary }]}>{fmt(c.due)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Expense Breakdown */}
      {report.expenseBreakdown.length > 0 && (
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Expense Breakdown (MTD)</Text>
          {report.expenseBreakdown.map(([cat, amt]) => (
            <View key={cat} style={styles.expRow}>
              <Text style={[styles.expCat, { color: colors.foreground }]}>{cat}</Text>
              <View style={styles.expBarWrap}>
                <View style={[styles.expBar, { backgroundColor: colors.navyLight, flex: 1 }]}>
                  <View style={[styles.expBarFill, { backgroundColor: colors.primary, width: `${Math.min(100, (amt / report.mtdExpenses) * 100)}%` }]} />
                </View>
              </View>
              <Text style={[styles.expAmt, { color: colors.primary }]}>{fmt(amt)}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Service KPIs */}
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Service Performance</Text>
        <View style={styles.statsRow}>
          <StatCard label="Open Tickets" value={String(report.openTickets)} accent="warning" />
          <StatCard label="Completed" value={String(report.completedTickets)} accent="success" />
        </View>
        <View style={[styles.profitRow, { backgroundColor: colors.navyLight }]}>
          <Text style={[styles.profitLabel, { color: colors.mutedForeground }]}>Resolution Rate</Text>
          <Text style={[styles.profitVal, { color: colors.primary }]}>
            {tickets.length > 0 ? `${Math.round((report.completedTickets / tickets.length) * 100)}%` : 'N/A'}
          </Text>
        </View>
      </View>

      {/* Engineer Performance */}
      {report.topEngineers.length > 0 && (
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SectionHeader title="Engineer Performance" count={report.topEngineers.length} />
          {report.topEngineers.map((e, i) => (
            <TouchableOpacity key={e.id} style={styles.debtRow} onPress={() => router.push(`/engineer/${e.id}` as any)} activeOpacity={0.75}>
              <View style={[styles.rank, { backgroundColor: i === 0 ? colors.secondary : colors.muted }]}>
                <Text style={[styles.rankText, { color: i === 0 ? '#fff' : colors.mutedForeground }]}>#{i + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.debtName, { color: colors.foreground }]} numberOfLines={1}>{e.name}</Text>
                <Text style={[styles.engSub, { color: colors.mutedForeground }]}>{e.completedJobs} jobs · {e.firstTimeFixPct}% FTF</Text>
              </View>
              <View style={styles.ratingWrap}>
                <Feather name="star" size={13} color={colors.secondary} />
                <Text style={[styles.debtAmt, { color: colors.secondary }]}>{e.rating.toFixed(1)}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screenTitle: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  period: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: -12 },
  section: { borderRadius: 14, padding: 16, borderWidth: 1, gap: 12 },
  sectionTitle: { fontSize: 15, fontFamily: 'Inter_700Bold', marginBottom: 2 },
  statsRow: { flexDirection: 'row', gap: 8 },
  profitRow: { borderRadius: 10, padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  profitLabel: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  profitVal: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  debtRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  rank: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  rankText: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  debtName: { flex: 1, fontSize: 14, fontFamily: 'Inter_500Medium' },
  engSub: { fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 1 },
  ratingWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  debtAmt: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  expRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  expCat: { width: 90, fontSize: 13, fontFamily: 'Inter_500Medium' },
  expBarWrap: { flex: 1 },
  expBar: { borderRadius: 4, overflow: 'hidden', height: 8 },
  expBarFill: { height: 8, borderRadius: 4 },
  expAmt: { width: 60, fontSize: 12, fontFamily: 'Inter_600SemiBold', textAlign: 'right' },
});
