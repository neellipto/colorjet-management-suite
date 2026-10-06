import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge } from '@/components/Badge';
import { useApp } from '@/context/AppContext';
import { useErpRuntime } from '@/context/ErpRuntimeContext';
import { can } from '@/lib/effectivePermissions';
import { useColors } from '@/hooks/useColors';

interface MenuItemProps {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  subtitle?: string;
  onPress: () => void;
  iconBg?: string;
  iconColor?: string;
  badge?: string;
}

function MenuItem({ icon, label, subtitle, onPress, iconBg, iconColor, badge }: MenuItemProps) {
  const colors = useColors();
  return (
    <TouchableOpacity
      style={[styles.menuItem, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress(); }}
      activeOpacity={0.75}
    >
      <View style={[styles.menuIcon, { backgroundColor: iconBg ?? colors.navyLight }]}>
        <Feather name={icon} size={20} color={iconColor ?? colors.primary} />
      </View>
      <View style={styles.menuText}>
        <Text style={[styles.menuLabel, { color: colors.foreground }]}>{label}</Text>
        {subtitle ? <Text style={[styles.menuSub, { color: colors.mutedForeground }]}>{subtitle}</Text> : null}
      </View>
      {badge ? <Badge label={badge} variant="error" size="sm" /> : null}
      <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
    </TouchableOpacity>
  );
}

function SectionLabel({ label }: { label: string }) {
  const colors = useColors();
  return <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>{label}</Text>;
}

export default function MoreScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { currentUser, logout, notifications, products } = useApp();
  const { permissions: erpPermissions } = useErpRuntime();
  const role = currentUser?.role ?? 'customer';
  const isAdmin = role === 'admin' || role === 'manager';
  const isAccounts = role === 'accounts';
  const isMarketing = role === 'marketing' || role === 'sales';
  const isEngineer = role === 'engineer';
  const isStore = role === 'store';
  const isServiceControl = role === 'service_control';
  const isOwner = Boolean(erpPermissions?.isOwner);
  const canViewManualRegisters = isOwner || can(erpPermissions, 'manual_registers', 'view');

  const lowStockCount = products.filter(p => p.currentStock < p.minStockQty).length;
  const unread = notifications.filter(n => !n.isRead).length;

  const pb = insets.bottom + (Platform.OS === 'web' ? 34 : 0) + 70;
  const pt = Platform.OS === 'web' ? 67 : 0;

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => { logout(); router.replace('/login'); } },
    ]);
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingTop: pt + 16, paddingBottom: pb, paddingHorizontal: 16, gap: 8 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.userCard, { backgroundColor: colors.primary }]}>
        <View style={[styles.userAvatar, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
          <Feather name="user" size={24} color="#fff" />
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{currentUser?.name}</Text>
          <Text style={styles.userRole}>{role.charAt(0).toUpperCase() + role.slice(1)} · COLORJET Bangladesh</Text>
          {currentUser?.employeeCode ? <Text style={styles.userCode}>{currentUser.employeeCode}</Text> : null}
        </View>
      </View>

      {isOwner && (
        <>
          <SectionLabel label="OWNER CONTROL" />
          <MenuItem icon="command" label="Owner Command Center" subtitle="Executive KPI, risks and approvals" onPress={() => router.push('/owner-command-center' as any)} iconBg={colors.navyLight} iconColor={colors.primary} />
          <MenuItem icon="cpu" label="Owner AI" subtitle="Source-backed analysis and confirmed actions" onPress={() => router.push('/owner-ai' as any)} iconBg="#F3E5F5" iconColor="#7B1FA2" />
        </>
      )}

      {isAdmin && (
        <>
          <SectionLabel label="ADMIN CONTROL CENTER" />
          <MenuItem icon="briefcase" label="Company Profile" subtitle="Business info and contacts" onPress={() => router.push('/admin/company' as any)} iconBg={colors.navyLight} iconColor={colors.primary} />
          <MenuItem icon="droplet" label="Branding" subtitle="Theme, colors, appearance" onPress={() => router.push('/admin/branding' as any)} iconBg={colors.orangeLight} iconColor={colors.secondary} />
          <MenuItem icon="grid" label="Catalog & Categories" subtitle="Product categories and assets" onPress={() => router.push('/admin/catalog' as any)} iconBg="#E8F5E9" iconColor="#2E7D32" />
          <MenuItem icon="users" label="User Management" subtitle="Accounts, roles, access" onPress={() => router.push('/admin/users' as any)} iconBg="#E3F2FD" iconColor="#1565C0" />
          <MenuItem icon="tool" label="Engineer Management" subtitle="Skills, KPIs, permissions" onPress={() => router.push('/admin/engineers' as any)} iconBg="#FFF8E1" iconColor="#F57F17" />
          <MenuItem icon="link" label="Integrations" subtitle="Odoo and messaging channels" onPress={() => router.push('/admin/integrations' as any)} iconBg="#F3E5F5" iconColor="#7B1FA2" />
          <MenuItem icon="sliders" label="Notification Settings" subtitle="Alerts and channels" onPress={() => router.push('/admin/notifications' as any)} iconBg="#FFEBEE" iconColor="#C62828" />
        </>
      )}

      {canViewManualRegisters && (
        <>
          <SectionLabel label="CUSTOM RECORDS" />
          <MenuItem icon="clipboard" label="Manual Registers" subtitle="Amount, asset, item and custom records" onPress={() => router.push('/manual-registers' as any)} iconBg="#E8F5E9" iconColor="#2E7D32" />
        </>
      )}

      {(isAdmin || isServiceControl) && (
        <>
          <SectionLabel label="SERVICE OPERATIONS" />
          <MenuItem icon="activity" label="Service Control" subtitle="Live ticket dashboard" onPress={() => router.push('/service-control' as any)} iconBg={colors.navyLight} iconColor={colors.primary} />
          <MenuItem icon="calendar" label="Engineer Schedule" subtitle="Plan and track visits" onPress={() => router.push('/schedule' as any)} iconBg="#E8F5E9" iconColor="#2E7D32" />
        </>
      )}

      {(isAdmin || isAccounts) && (
        <>
          <SectionLabel label="MANAGEMENT" />
          <MenuItem icon="bar-chart-2" label="Reports Center" subtitle="Sales, due, expenses, P&L" onPress={() => router.push('/reports' as any)} iconBg="#E3F2FD" iconColor="#1565C0" />
          <MenuItem icon="truck" label="Deliveries" subtitle="Track all delivery orders" onPress={() => router.push('/delivery' as any)} iconBg={colors.orangeLight} iconColor={colors.secondary} />
          {isAdmin && <MenuItem icon="users" label="Customers" subtitle="Manage customer accounts" onPress={() => router.push('/(tabs)/sales' as any)} iconBg="#E8F5E9" iconColor="#2E7D32" />}
        </>
      )}

      {(isAdmin || isAccounts) && (
        <>
          <SectionLabel label="FINANCE" />
          <MenuItem icon="credit-card" label="Expenses" subtitle="Track and record expenses" onPress={() => router.push('/expenses' as any)} iconBg="#FFEBEE" iconColor="#C62828" />
        </>
      )}

      {(isAdmin || isEngineer) && (
        <>
          <SectionLabel label="OPERATIONS" />
          {isAdmin && <MenuItem icon="truck" label="Deliveries" subtitle="Delivery order tracking" onPress={() => router.push('/delivery' as any)} iconBg={colors.orangeLight} iconColor={colors.secondary} />}
        </>
      )}

      {isMarketing && (
        <>
          <SectionLabel label="MY TOOLS" />
          <MenuItem icon="truck" label="Delivery Support" subtitle="View delivery assignments" onPress={() => router.push('/delivery' as any)} iconBg={colors.orangeLight} iconColor={colors.secondary} />
          <MenuItem icon="bar-chart-2" label="My Reports" subtitle="Collection and visit summary" onPress={() => router.push('/reports' as any)} iconBg="#E3F2FD" iconColor="#1565C0" />
        </>
      )}

      {isStore && (
        <>
          <SectionLabel label="STORE TOOLS" />
          <MenuItem
            icon="alert-triangle"
            label="Low Stock Alerts"
            subtitle={`${lowStockCount} items below minimum`}
            onPress={() => router.push('/(tabs)/inventory' as any)}
            iconBg="#FFEBEE"
            iconColor="#C62828"
            badge={lowStockCount > 0 ? String(lowStockCount) : undefined}
          />
        </>
      )}

      <SectionLabel label="MY WORKDAY" />
      <MenuItem icon="clock" label="Attendance" subtitle="Check in, check out and view my history" onPress={() => router.push('/attendance' as any)} iconBg="#E8F5E9" iconColor="#2E7D32" />

      <SectionLabel label="NOTIFICATIONS" />
      <MenuItem
        icon="bell"
        label="Notifications"
        subtitle="Alerts and updates"
        onPress={() => router.push('/notifications' as any)}
        badge={unread > 0 ? String(unread) : undefined}
        iconBg="#FFF8E1"
        iconColor="#F57F17"
      />

      <SectionLabel label="ACCOUNT" />
      <MenuItem icon="user" label="My Profile" subtitle="View and edit profile" onPress={() => router.push('/profile' as any)} />

      <TouchableOpacity
        style={[styles.logoutBtn, { backgroundColor: '#FFEBEE', borderColor: '#FFCDD2' }]}
        onPress={handleLogout}
        activeOpacity={0.8}
      >
        <Feather name="log-out" size={18} color="#C62828" />
        <Text style={[styles.logoutText, { color: '#C62828' }]}>Sign Out</Text>
      </TouchableOpacity>

      <Text style={[styles.version, { color: colors.mutedForeground }]}>COLORJET Management Suite · Additive Update</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  userCard: { borderRadius: 14, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 8 },
  userAvatar: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  userInfo: { flex: 1, gap: 2 },
  userName: { fontSize: 17, fontFamily: 'Inter_700Bold', color: '#fff' },
  userRole: { fontSize: 12, fontFamily: 'Inter_400Regular', color: 'rgba(255,255,255,0.8)' },
  userCode: { fontSize: 11, fontFamily: 'Inter_500Medium', color: 'rgba(255,255,255,0.6)' },
  sectionLabel: { fontSize: 11, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.8, paddingTop: 8, paddingLeft: 2 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 12, borderWidth: 1 },
  menuIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  menuText: { flex: 1, gap: 2 },
  menuLabel: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  menuSub: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 14, borderRadius: 12, borderWidth: 1, marginTop: 8 },
  logoutText: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  version: { fontSize: 11, fontFamily: 'Inter_400Regular', textAlign: 'center', paddingVertical: 8 },
});
