import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import type { UserRole } from '@/constants/types';

const ROLES: UserRole[] = ['admin', 'manager', 'engineer', 'service_control', 'marketing', 'sales', 'accounts', 'store', 'customer'];
const ROLE_LABEL: Record<UserRole, string> = {
  admin: 'Admin', manager: 'Manager', engineer: 'Engineer', service_control: 'Service Control',
  marketing: 'Marketing', sales: 'Sales', accounts: 'Accounts', store: 'Store', customer: 'Customer',
};

export default function UserDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { users, updateUser, toggleUserActive } = useApp();
  const user = users.find(u => u.id === id);

  const [form, setForm] = useState(() => ({
    name: user?.name ?? '', email: user?.email ?? '', phone: user?.phone ?? '',
    role: (user?.role ?? 'engineer') as UserRole, roleTitle: user?.roleTitle ?? '',
    employeeCode: user?.employeeCode ?? '', department: user?.department ?? '',
  }));

  const pb = insets.bottom + (Platform.OS === 'web' ? 34 : 0) + 24;
  const pt = Platform.OS === 'web' ? 16 : 0;

  if (!user) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.mutedForeground }}>User not found.</Text>
      </View>
    );
  }

  const onSave = () => {
    updateUser(user.id, form);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingTop: pt + 16, paddingBottom: pb, paddingHorizontal: 16, gap: 12 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.hero, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.avatar, { backgroundColor: colors.navyLight }]}>
          <Text style={[styles.avatarText, { color: colors.primary }]}>{user.name.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.heroName, { color: colors.foreground }]}>{user.name}</Text>
          <Text style={[styles.heroSub, { color: colors.mutedForeground }]}>{user.email}</Text>
          {!!user.lastLogin && <Text style={[styles.heroSub, { color: colors.mutedForeground }]}>Last login: {user.lastLogin}</Text>}
        </View>
        <View style={[styles.statusPill, { backgroundColor: user.isActive ? colors.success + '22' : colors.muted }]}>
          <Text style={[styles.statusText, { color: user.isActive ? colors.success : colors.mutedForeground }]}>{user.isActive ? 'Active' : 'Inactive'}</Text>
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {([['name', 'Full Name'], ['email', 'Email'], ['phone', 'Phone'], ['roleTitle', 'Role Title'], ['employeeCode', 'Employee Code'], ['department', 'Department']] as const).map(([k, label]) => (
          <View key={k} style={styles.field}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text>
            <TextInput
              style={[styles.input, { color: colors.foreground, borderColor: colors.border }]}
              value={form[k]}
              onChangeText={t => setForm(s => ({ ...s, [k]: t }))}
              placeholder={label}
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize={k === 'email' ? 'none' : 'words'}
            />
          </View>
        ))}
        <Text style={[styles.label, { color: colors.mutedForeground }]}>Role</Text>
        <View style={styles.roleGrid}>
          {ROLES.map(r => (
            <TouchableOpacity key={r} style={[styles.roleOpt, { backgroundColor: form.role === r ? colors.primary : colors.background, borderColor: form.role === r ? colors.primary : colors.border }]} onPress={() => setForm(s => ({ ...s, role: r }))} activeOpacity={0.75}>
              <Text style={[styles.roleOptText, { color: form.role === r ? '#fff' : colors.mutedForeground }]}>{ROLE_LABEL[r]}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary }]} onPress={onSave} activeOpacity={0.85}>
        <Feather name="check" size={17} color="#fff" />
        <Text style={styles.saveText}>Save Changes</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.toggleBtn, { borderColor: user.isActive ? colors.destructive : colors.success }]}
        onPress={() => { toggleUserActive(user.id); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); }}
        activeOpacity={0.8}
      >
        <Feather name={user.isActive ? 'slash' : 'check-circle'} size={16} color={user.isActive ? colors.destructive : colors.success} />
        <Text style={[styles.toggleText, { color: user.isActive ? colors.destructive : colors.success }]}>{user.isActive ? 'Deactivate Account' : 'Activate Account'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, borderWidth: 1 },
  avatar: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  heroName: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  heroSub: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 1 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  card: { borderRadius: 14, padding: 14, borderWidth: 1, gap: 12 },
  field: { gap: 6 },
  label: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14, fontFamily: 'Inter_400Regular' },
  roleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  roleOpt: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  roleOptText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12 },
  saveText: { color: '#fff', fontSize: 15, fontFamily: 'Inter_700Bold' },
  toggleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, borderRadius: 12, borderWidth: 1.5 },
  toggleText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
});
