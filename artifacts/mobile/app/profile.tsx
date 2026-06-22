import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge } from '@/components/Badge';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';

const ROLE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  admin: { label: 'Owner / Admin', color: '#1A237E', bg: '#E8EAF6' },
  manager: { label: 'General Manager', color: '#283593', bg: '#E8EAF6' },
  service_control: { label: 'Service Control', color: '#00695C', bg: '#E0F2F1' },
  engineer: { label: 'Engineer', color: '#0277BD', bg: '#E1F5FE' },
  marketing: { label: 'Marketing', color: '#2E7D32', bg: '#E8F5E9' },
  sales: { label: 'Sales', color: '#AD1457', bg: '#FCE4EC' },
  accounts: { label: 'Accounts', color: '#6A1B9A', bg: '#F3E5F5' },
  store: { label: 'Store Manager', color: '#E65100', bg: '#FFF3E0' },
  customer: { label: 'Customer', color: '#00838F', bg: '#E0F7FA' },
};

function InfoRow({ icon, label, value, colors }: { icon: keyof typeof Feather.glyphMap; label: string; value?: string; colors: ReturnType<typeof import('@/hooks/useColors').useColors> }) {
  if (!value) return null;
  return (
    <View style={styles.infoRow}>
      <View style={[styles.infoIcon, { backgroundColor: colors.navyLight }]}>
        <Feather name={icon} size={14} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>{label}</Text>
        <Text style={[styles.infoValue, { color: colors.foreground }]}>{value}</Text>
      </View>
    </View>
  );
}

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { currentUser, logout, notifications, invoices, tickets } = useApp();

  const role = currentUser?.role ?? 'customer';
  const roleInfo = ROLE_LABELS[role] ?? ROLE_LABELS.customer;

  const pb = insets.bottom + (Platform.OS === 'web' ? 34 : 0);
  const pt = Platform.OS === 'web' ? 16 : 0;

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out', style: 'destructive', onPress: () => {
          logout();
          router.replace('/login');
        },
      },
    ]);
  };

  const unreadNotifs = notifications.filter(n => !n.isRead && (n.userId === currentUser?.id || n.userId === 'u1'));

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingTop: pt + 16, paddingBottom: pb + 24, paddingHorizontal: 16, gap: 16 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Avatar Card */}
      <View style={[styles.avatarCard, { backgroundColor: colors.primary }]}>
        <View style={[styles.avatar, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
          <Text style={styles.avatarInitials}>
            {currentUser?.name?.split(' ').map(w => w[0]).slice(0, 2).join('') ?? 'U'}
          </Text>
        </View>
        <Text style={styles.profileName}>{currentUser?.name}</Text>
        <View style={[styles.roleBadge, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
          <Text style={styles.roleBadgeText}>{roleInfo.label}</Text>
        </View>
        {currentUser?.employeeCode && (
          <Text style={styles.empCode}>{currentUser.employeeCode}</Text>
        )}
      </View>

      {/* Quick Stats */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.statVal, { color: colors.primary }]}>{unreadNotifs.length}</Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Notifications</Text>
        </View>
        {(role === 'admin' || role === 'engineer') && (
          <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.statVal, { color: colors.warning }]}>{tickets.filter(t => t.status !== 'completed' && t.status !== 'cancelled').length}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Open Tickets</Text>
          </View>
        )}
        {(role === 'admin' || role === 'accounts') && (
          <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.statVal, { color: colors.secondary }]}>{invoices.filter(i => i.totalDue > 0).length}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Open Invoices</Text>
          </View>
        )}
      </View>

      {/* Profile Info */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Account Details</Text>
        <InfoRow icon="user" label="Full Name" value={currentUser?.name} colors={colors} />
        <InfoRow icon="mail" label="Email" value={currentUser?.email} colors={colors} />
        <InfoRow icon="phone" label="Phone" value={currentUser?.phone} colors={colors} />
        <InfoRow icon="briefcase" label="Department" value={currentUser?.department} colors={colors} />
        <InfoRow icon="hash" label="Employee Code" value={currentUser?.employeeCode} colors={colors} />
        <View style={styles.infoRow}>
          <View style={[styles.infoIcon, { backgroundColor: colors.navyLight }]}>
            <Feather name="shield" size={14} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Role</Text>
            <View style={[styles.roleTag, { backgroundColor: roleInfo.bg }]}>
              <Text style={[styles.roleTagText, { color: roleInfo.color }]}>{roleInfo.label}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Notifications Preview */}
      {unreadNotifs.length > 0 && (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Notifications ({unreadNotifs.length})</Text>
          {unreadNotifs.slice(0, 3).map(n => (
            <View key={n.id} style={styles.notifRow}>
              <View style={[styles.notifDot, { backgroundColor: n.type === 'stock_warning' ? colors.warning : n.type === 'due_warning' ? colors.secondary : colors.primary }]} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[styles.notifTitle, { color: colors.foreground }]}>{n.title}</Text>
                <Text style={[styles.notifMsg, { color: colors.mutedForeground }]} numberOfLines={2}>{n.message}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Sign Out */}
      <TouchableOpacity style={[styles.logoutBtn, { backgroundColor: '#FFEBEE', borderColor: '#FFCDD2' }]} onPress={handleLogout} activeOpacity={0.8}>
        <Feather name="log-out" size={18} color="#C62828" />
        <Text style={[styles.logoutText, { color: '#C62828' }]}>Sign Out</Text>
      </TouchableOpacity>

      <Text style={[styles.version, { color: colors.mutedForeground }]}>COLORJET ERP v2.0 · © 2024 COLORJET Bangladesh</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  avatarCard: { borderRadius: 16, padding: 24, alignItems: 'center', gap: 10 },
  avatar: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  avatarInitials: { fontSize: 28, fontFamily: 'Inter_700Bold', color: '#fff' },
  profileName: { fontSize: 22, fontFamily: 'Inter_700Bold', color: '#fff', textAlign: 'center' },
  roleBadge: { borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6 },
  roleBadgeText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#fff' },
  empCode: { fontSize: 12, fontFamily: 'Inter_400Regular', color: 'rgba(255,255,255,0.7)' },
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: { flex: 1, borderRadius: 12, padding: 14, borderWidth: 1, alignItems: 'center', gap: 4 },
  statVal: { fontSize: 24, fontFamily: 'Inter_700Bold' },
  statLabel: { fontSize: 11, fontFamily: 'Inter_500Medium', textAlign: 'center' },
  card: { borderRadius: 14, padding: 16, borderWidth: 1, gap: 12 },
  sectionTitle: { fontSize: 15, fontFamily: 'Inter_700Bold', marginBottom: 2 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  infoIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  infoLabel: { fontSize: 11, fontFamily: 'Inter_500Medium', textTransform: 'uppercase', marginBottom: 2 },
  infoValue: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  roleTag: { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  roleTagText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  notifRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  notifDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  notifTitle: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  notifMsg: { fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 17 },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 14, borderRadius: 12, borderWidth: 1 },
  logoutText: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  version: { fontSize: 11, fontFamily: 'Inter_400Regular', textAlign: 'center' },
});
