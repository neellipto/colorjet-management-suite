import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useMemo } from 'react';
import { FlatList, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge, statusBadge, statusLabel } from '@/components/Badge';
import { SectionHeader } from '@/components/SectionHeader';
import { StatCard } from '@/components/StatCard';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import type { Invoice, ServiceTicket, MarketingTask } from '@/constants/types';

function fmt(n: number) {
  if (n >= 1000000) return `৳${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `৳${(n / 1000).toFixed(0)}K`;
  return `৳${n.toLocaleString()}`;
}

function InvoiceRow({ invoice }: { invoice: Invoice }) {
  const colors = useColors();
  return (
    <TouchableOpacity style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => router.push(`/invoice/${invoice.id}` as any)} activeOpacity={0.75}>
      <View style={styles.rowLeft}>
        <Text style={[styles.rowTitle, { color: colors.foreground }]} numberOfLines={1}>{invoice.customerName}</Text>
        <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>{invoice.invoiceNo} · {invoice.invoiceDate}</Text>
      </View>
      <View style={styles.rowRight}>
        <Text style={[styles.rowAmount, { color: colors.foreground }]}>{fmt(invoice.totalAmount)}</Text>
        <Badge label={statusLabel(invoice.status)} variant={statusBadge(invoice.status)} />
      </View>
    </TouchableOpacity>
  );
}

function TicketRow({ ticket }: { ticket: ServiceTicket }) {
  const colors = useColors();
  const priorityColors: Record<string, string> = { emergency: '#C62828', high: '#E65100', normal: '#1565C0', low: '#2E7D32' };
  return (
    <TouchableOpacity style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border, borderLeftColor: priorityColors[ticket.priority] ?? colors.border, borderLeftWidth: 3 }]} onPress={() => router.push(`/ticket/${ticket.id}` as any)} activeOpacity={0.75}>
      <View style={styles.rowLeft}>
        <Text style={[styles.rowTitle, { color: colors.foreground }]} numberOfLines={1}>{ticket.customerName}</Text>
        <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>{ticket.ticketNo} · {ticket.machineModel ?? 'N/A'}</Text>
      </View>
      <View style={styles.rowRight}>
        <Badge label={statusLabel(ticket.status)} variant={statusBadge(ticket.status)} />
        <Badge label={ticket.priority.toUpperCase()} variant={statusBadge(ticket.priority)} size="sm" />
      </View>
    </TouchableOpacity>
  );
}

function TaskRow({ task }: { task: MarketingTask }) {
  const colors = useColors();
  return (
    <TouchableOpacity style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]} activeOpacity={0.75}>
      <View style={styles.rowLeft}>
        <Text style={[styles.rowTitle, { color: colors.foreground }]} numberOfLines={1}>{task.customerName}</Text>
        <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>{task.taskNo} · {task.targetDate}</Text>
      </View>
      <View style={styles.rowRight}>
        <Badge label={statusLabel(task.type)} variant="info" />
        <Badge label={statusLabel(task.status)} variant={statusBadge(task.status)} />
      </View>
    </TouchableOpacity>
  );
}

function QuickAction({ icon, label, onPress }: { icon: keyof typeof Feather.glyphMap; label: string; onPress: () => void }) {
  const colors = useColors();
  return (
    <TouchableOpacity style={[styles.quickAction, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={onPress} activeOpacity={0.75}>
      <View style={[styles.quickIcon, { backgroundColor: colors.navyLight }]}>
        <Feather name={icon} size={18} color={colors.primary} />
      </View>
      <Text style={[styles.quickLabel, { color: colors.foreground }]} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function DashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { currentUser, invoices, payments, tickets, products, deliveries, expenses, tasks, notifications } = useApp();
  const role = currentUser?.role ?? 'customer';
  const isAdmin = role === 'admin' || role === 'accounts' || role === 'manager';
  const isEngineer = role === 'engineer';
  const isMarketing = role === 'marketing' || role === 'sales';
  const isStore = role === 'store';
  const isCustomer = role === 'customer';
  const isServiceControl = role === 'service_control';

  const stats = useMemo(() => {
    const month = '2024-06';
    const mtdInvoices = invoices.filter(i => i.invoiceDate.startsWith(month));
    const mtdPayments = payments.filter(p => p.paymentDate.startsWith(month));
    const mtdExpenses = expenses.filter(e => e.expenseDate.startsWith(month));
    return {
      totalSalesMTD: mtdInvoices.reduce((s, i) => s + i.totalAmount, 0),
      totalCollectionMTD: mtdPayments.reduce((s, p) => s + p.amount, 0),
      totalDue: invoices.reduce((s, i) => s + i.totalDue, 0),
      totalExpensesMTD: mtdExpenses.reduce((s, e) => s + e.amount, 0),
      openTickets: tickets.filter(t => t.status === 'pending' || t.status === 'in_progress').length,
      completedMTD: tickets.filter(t => t.status === 'completed').length,
      pendingDeliveries: deliveries.filter(d => d.status !== 'delivered').length,
      lowStockCount: products.filter(p => p.currentStock < p.minStockQty).length,
    };
  }, [invoices, payments, expenses, tickets, deliveries, products]);

  const engStats = useMemo(() => {
    const mine = tickets.filter(t => t.assignedEngineerId === currentUser?.id);
    const openStatuses = ['pending', 'assigned', 'accepted', 'on_the_way', 'waiting_parts', 'pending_customer', 'revisit'];
    return {
      open: mine.filter(t => openStatuses.includes(t.status)).length,
      inProgress: mine.filter(t => t.status === 'in_progress').length,
      completed: mine.filter(t => t.status === 'completed').length,
      today: mine.filter(t => t.plannedDate === new Date().toISOString().split('T')[0] || t.status === 'in_progress').length,
      partsUsed: mine.reduce((s, t) => s + (t.usedParts?.length ?? 0), 0),
    };
  }, [tickets, currentUser]);

  const myTickets = useMemo(() => tickets.filter(t => t.assignedEngineerId === currentUser?.id && t.status !== 'completed' && t.status !== 'cancelled'), [tickets, currentUser]);
  const myTasks = useMemo(() => tasks.filter(t => t.assignedMarketingId === currentUser?.id && t.status !== 'done'), [tasks, currentUser]);
  const recentInvoices = useMemo(() => invoices.slice(0, 5), [invoices]);
  const recentTickets = useMemo(() => tickets.filter(t => t.status !== 'completed' && t.status !== 'cancelled').slice(0, 5), [tickets]);
  const unreadNotifs = notifications.filter(n => !n.isRead);

  const pb = insets.bottom + (Platform.OS === 'web' ? 34 : 0) + 70;
  const pt = Platform.OS === 'web' ? 67 : 0;

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingTop: pt + 16, paddingBottom: pb, paddingHorizontal: 16, gap: 20 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={[styles.greeting, { color: colors.mutedForeground }]}>{greeting()},</Text>
          <Text style={[styles.userName, { color: colors.foreground }]}>{currentUser?.name?.split(' ')[0] ?? 'User'}</Text>
        </View>
        <View style={styles.headerActions}>
          {unreadNotifs.length > 0 && (
            <View style={[styles.notifDot, { backgroundColor: colors.destructive }]}>
              <Text style={styles.notifDotText}>{unreadNotifs.length}</Text>
            </View>
          )}
          <TouchableOpacity style={[styles.avatarBtn, { backgroundColor: colors.navyLight }]} onPress={() => router.push('/profile' as any)} activeOpacity={0.8}>
            <Feather name="user" size={18} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Stats — Admin/Accounts */}
      {isAdmin && (
        <>
          <View style={styles.statsRow}>
            <StatCard label="Sales MTD" value={fmt(stats.totalSalesMTD)} accent="primary" />
            <StatCard label="Collected MTD" value={fmt(stats.totalCollectionMTD)} accent="success" />
          </View>
          <View style={styles.statsRow}>
            <StatCard label="Total Due" value={fmt(stats.totalDue)} subLabel="All customers" accent="orange" />
            <StatCard label="Expenses MTD" value={fmt(stats.totalExpensesMTD)} accent="error" />
          </View>
          <View style={styles.statsRow}>
            <StatCard label="Open Tickets" value={String(stats.openTickets)} accent="warning" flex={1} />
            <StatCard label="Deliveries" value={String(stats.pendingDeliveries)} subLabel="Pending" accent="primary" flex={1} />
            <StatCard label="Low Stock" value={String(stats.lowStockCount)} subLabel="Items" accent="error" flex={1} />
          </View>
        </>
      )}

      {/* Stats — Engineer */}
      {isEngineer && (
        <>
          <View style={styles.statsRow}>
            <StatCard label="My Open Jobs" value={String(engStats.open)} accent="primary" flex={1} />
            <StatCard label="In Progress" value={String(engStats.inProgress)} accent="warning" flex={1} />
            <StatCard label="Completed" value={String(engStats.completed)} accent="success" flex={1} />
          </View>
          <View style={styles.statsRow}>
            <StatCard label="Today's Jobs" value={String(engStats.today)} subLabel="Scheduled" accent="primary" />
            <StatCard label="Parts Used" value={String(engStats.partsUsed)} subLabel="This period" accent="orange" />
          </View>
          <View style={styles.quickRow}>
            <QuickAction icon="briefcase" label="My Jobs" onPress={() => router.push('/(tabs)/service' as any)} />
            <QuickAction icon="calendar" label="Schedule" onPress={() => router.push('/schedule' as any)} />
            <QuickAction icon="bell" label="Alerts" onPress={() => router.push('/notifications' as any)} />
          </View>
          <SectionHeader title="My Active Jobs" count={myTickets.length} actionLabel="All Jobs" onAction={() => router.push('/(tabs)/service' as any)} />
          {myTickets.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No active tickets assigned</Text>
          ) : (
            myTickets.map(t => <TicketRow key={t.id} ticket={t} />)
          )}
        </>
      )}

      {/* Stats — Service Control */}
      {isServiceControl && (
        <>
          <View style={styles.statsRow}>
            <StatCard label="Open Tickets" value={String(stats.openTickets)} accent="primary" flex={1} />
            <StatCard label="In Progress" value={String(tickets.filter(t => t.status === 'in_progress').length)} accent="warning" flex={1} />
            <StatCard label="Completed" value={String(stats.completedMTD)} accent="success" flex={1} />
          </View>
          <View style={styles.quickRow}>
            <QuickAction icon="activity" label="Service Control" onPress={() => router.push('/service-control' as any)} />
            <QuickAction icon="calendar" label="Schedule" onPress={() => router.push('/schedule' as any)} />
            <QuickAction icon="bell" label="Alerts" onPress={() => router.push('/notifications' as any)} />
          </View>
          <SectionHeader title="Active Service Tickets" actionLabel="View All" onAction={() => router.push('/(tabs)/service' as any)} />
          {recentTickets.map(t => <TicketRow key={t.id} ticket={t} />)}
        </>
      )}

      {/* Stats — Marketing */}
      {isMarketing && (
        <>
          <View style={styles.statsRow}>
            <StatCard label="Pending Tasks" value={String(myTasks.length)} accent="primary" />
            <StatCard label="Done Today" value={String(tasks.filter(t => t.status === 'done').length)} accent="success" />
          </View>
          <SectionHeader title="My Active Tasks" count={myTasks.length} actionLabel="All Tasks" onAction={() => router.push('/(tabs)/sales' as any)} />
          {myTasks.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No pending tasks</Text>
          ) : (
            myTasks.map(t => <TaskRow key={t.id} task={t} />)
          )}
        </>
      )}

      {/* Stats — Store */}
      {isStore && (
        <>
          <View style={styles.statsRow}>
            <StatCard label="Total SKUs" value={String(products.length)} accent="primary" />
            <StatCard label="Low Stock" value={String(stats.lowStockCount)} subLabel="Items" accent="error" />
          </View>
          <View style={styles.statsRow}>
            <StatCard label="Stock Value" value={fmt(products.reduce((s, p) => s + p.currentStock * p.costPrice, 0))} accent="success" />
          </View>
        </>
      )}

      {/* Stats — Customer */}
      {isCustomer && (
        <>
          <View style={styles.statsRow}>
            <StatCard label="Total Invoices" value={String(invoices.length)} accent="primary" />
            <StatCard label="Total Due" value={fmt(invoices.reduce((s, i) => s + i.totalDue, 0))} accent="orange" />
          </View>
          <View style={styles.statsRow}>
            <StatCard label="Total Paid" value={fmt(invoices.reduce((s, i) => s + i.totalPaid, 0))} accent="success" />
          </View>
        </>
      )}

      {/* Recent Invoices (admin/accounts/customer) */}
      {(isAdmin || isCustomer) && (
        <>
          <SectionHeader title="Recent Invoices" actionLabel="View All" onAction={() => router.push('/(tabs)/sales' as any)} />
          {recentInvoices.map(i => <InvoiceRow key={i.id} invoice={i} />)}
        </>
      )}

      {/* Recent Tickets (admin) */}
      {isAdmin && (
        <>
          <SectionHeader title="Open Service Tickets" actionLabel="View All" onAction={() => router.push('/(tabs)/service' as any)} />
          {recentTickets.map(t => <TicketRow key={t.id} ticket={t} />)}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  greeting: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  userName: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  notifDot: { minWidth: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  notifDotText: { color: '#fff', fontSize: 11, fontFamily: 'Inter_700Bold' },
  avatarBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  statsRow: { flexDirection: 'row', gap: 10 },
  quickRow: { flexDirection: 'row', gap: 10 },
  quickAction: { flex: 1, alignItems: 'center', gap: 8, paddingVertical: 14, borderRadius: 12, borderWidth: 1 },
  quickIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  quickLabel: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 14, borderRadius: 12, borderWidth: 1, gap: 12,
  },
  rowLeft: { flex: 1, gap: 3 },
  rowRight: { alignItems: 'flex-end', gap: 4 },
  rowTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  rowSub: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  rowAmount: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  emptyText: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', paddingVertical: 12 },
});
