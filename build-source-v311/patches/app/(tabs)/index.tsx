/** UI LOCKED FILE */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Screen } from '@/src/components/ui/Screen';
import { AppHeader } from '@/src/components/ui/AppHeader';
import { MetricCard } from '@/src/components/ui/MetricCard';
import { ModuleCard } from '@/src/components/ui/ModuleCard';
import { SectionHeader } from '@/src/components/ui/SectionHeader';
import { useAppData } from '@/src/data/AppDataProvider';
import { MODULE_MAP } from '@/src/core/moduleRegistry';
import type { ModuleDefinition, UserRole } from '@/src/types/domain';
import { colors, radius, spacing, typography } from '@/src/theme/tokens';

const greeting = () => {
  const hour = new Date().getHours();
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
};

const quickByRole: Partial<Record<UserRole, string[]>> = {
  owner: ['attendance-location', 'notifications', 'users', 'reports'],
  admin: ['attendance-location', 'notifications', 'users', 'service-tickets'],
  manager: ['attendance-location', 'office-tasks', 'service-tickets', 'reports'],
  accounts: ['payments', 'expenses', 'cash-bank', 'customer-ledger'],
  sales: ['customers', 'invoices', 'payments', 'office-tasks'],
  engineer: ['attendance-location', 'engineer-schedule', 'service-tickets', 'spare-parts'],
  service_control: ['attendance-location', 'service-tickets', 'engineer-schedule', 'warranty-register'],
  store: ['products', 'stock-movements', 'warehouse-receiving', 'spare-parts'],
  office_staff: ['attendance-location', 'office-tasks', 'notifications', 'employee-directory'],
  customer: ['notifications', 'service-tickets', 'customer-ledger', 'documents-audit'],
};

export default function Dashboard() {
  const router = useRouter();
  const { currentUser, getRecords, state } = useAppData();
  const activeRole: UserRole = currentUser?.role ?? 'office_staff';
  const quickKeys = quickByRole[activeRole] ?? ['attendance-location', 'service-tickets', 'office-tasks', 'products'];
  const quick = quickKeys
    .map((key) => MODULE_MAP[key])
    .filter((item): item is ModuleDefinition => Boolean(item) && item!.roles.includes(activeRole));

  return (
    <Screen>
      <AppHeader
        title={`${greeting()}, ${currentUser?.name?.split(' ')[0] ?? 'User'}`}
        subtitle={`${currentUser?.roleTitle ?? 'COLORJET user'} dashboard`}
        onProfile={() => router.push('/profile')}
        onNotification={() => router.push({ pathname: '/module/[key]', params: { key: 'notifications' } })}
      />
      <View style={styles.brand}>
        <View>
          <Text style={styles.brandTitle}>COLORJET Bangladesh</Text>
          <Text style={styles.brandTag}>Quality • Commitment • Service</Text>
        </View>
        <View style={styles.brandIcon}>
          <Ionicons name="print-outline" size={30} color={colors.secondary} />
        </View>
      </View>
      <SectionHeader title="Business Overview" caption="Live operational data • GPS attendance enabled" />
      <View style={styles.metrics}>
        <MetricCard label="Open Tickets" value={getRecords('service-tickets').filter((row) => !['completed', 'cancelled'].includes(row.status)).length} icon="ticket-outline" />
        <MetricCard label="Pending Tasks" value={getRecords('office-tasks').filter((row) => !['done', 'cancelled'].includes(row.status)).length} icon="checkbox-outline" tone="orange" />
        <MetricCard label="Attendance" value={getRecords('attendance-location').length} icon="location-outline" tone="info" />
        <MetricCard label="Unread Alerts" value={(state?.notifications ?? []).filter((notification) => notification.status === 'unread').length} icon="notifications-outline" tone="success" />
      </View>
      <SectionHeader title="Quick Access" caption="Role-based access, attendance, notifications and operations" />
      <View style={styles.grid}>
        {quick.map((module) => (
          <ModuleCard
            key={module.key}
            module={module}
            count={getRecords(module.key).length}
            onPress={() => router.push({ pathname: '/module/[key]', params: { key: module.key } })}
          />
        ))}
      </View>
      <Pressable onPress={() => router.push('/(tabs)/more')} style={styles.all}>
        <Text style={styles.allText}>View All Modules</Text>
        <Ionicons name="arrow-forward" size={16} color={colors.secondary} />
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  brand: { minHeight: 108, borderRadius: radius.lg, backgroundColor: colors.primary, padding: spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brandTitle: { fontFamily: typography.bold, fontSize: 19, color: colors.primaryForeground },
  brandTag: { fontFamily: typography.medium, fontSize: 11, color: colors.orangeLight, marginTop: 5 },
  brandIcon: { width: 56, height: 56, borderRadius: radius.lg, backgroundColor: 'rgba(255,255,255,.1)', alignItems: 'center', justifyContent: 'center' },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: spacing.md },
  all: { height: 50, marginTop: spacing.lg, borderRadius: radius.md, backgroundColor: colors.orangeLight, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  allText: { fontFamily: typography.semibold, fontSize: 13, color: colors.secondary },
});
