import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import type { User, UserRole } from '@/constants/types';

const ROLES: UserRole[] = ['admin', 'manager', 'engineer', 'service_control', 'marketing', 'sales', 'accounts', 'store', 'customer'];
const ROLE_LABEL: Record<UserRole, string> = {
  admin: 'Admin', manager: 'Manager', engineer: 'Engineer', service_control: 'Service Control',
  marketing: 'Marketing', sales: 'Sales', accounts: 'Accounts', store: 'Store', customer: 'Customer',
};

export default function UsersScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { users, addUser } = useApp();
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', role: 'engineer' as UserRole, employeeCode: '', department: '' });

  const pb = insets.bottom + (Platform.OS === 'web' ? 34 : 0) + 24;
  const pt = Platform.OS === 'web' ? 16 : 0;

  const filtered = useMemo(() => {
    return users.filter(u => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (query && !`${u.name} ${u.email}`.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
  }, [users, roleFilter, query]);

  const onCreate = () => {
    if (!form.name.trim() || !form.email.trim()) return;
    addUser({ ...form, password: 'colorjet123', isActive: true });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setForm({ name: '', email: '', phone: '', role: 'engineer', employeeCode: '', department: '' });
    setModal(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: pt + 12, paddingBottom: pb, paddingHorizontal: 16, gap: 10 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.searchWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="search" size={16} color={colors.mutedForeground} />
          <TextInput style={[styles.search, { color: colors.foreground }]} value={query} onChangeText={setQuery} placeholder="Search users" placeholderTextColor={colors.mutedForeground} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7 }}>
          {(['all', ...ROLES] as const).map(r => (
            <TouchableOpacity
              key={r}
              style={[styles.chip, { backgroundColor: roleFilter === r ? colors.primary : colors.card, borderColor: roleFilter === r ? colors.primary : colors.border }]}
              onPress={() => setRoleFilter(r)}
              activeOpacity={0.75}
            >
              <Text style={[styles.chipText, { color: roleFilter === r ? '#fff' : colors.mutedForeground }]}>{r === 'all' ? 'All' : ROLE_LABEL[r]}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {filtered.map(u => (
          <TouchableOpacity key={u.id} style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => router.push(`/user/${u.id}` as any)} activeOpacity={0.7}>
            <View style={[styles.avatar, { backgroundColor: colors.navyLight }]}>
              <Text style={[styles.avatarText, { color: colors.primary }]}>{u.name.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.name, { color: colors.foreground }]}>{u.name}</Text>
              <Text style={[styles.sub, { color: colors.mutedForeground }]}>{u.email}</Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <View style={[styles.rolePill, { backgroundColor: colors.navyLight }]}>
                <Text style={[styles.rolePillText, { color: colors.primary }]}>{ROLE_LABEL[u.role]}</Text>
              </View>
              <View style={[styles.dot, { backgroundColor: u.isActive ? colors.success : colors.muted }]} />
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <TouchableOpacity style={[styles.fab, { backgroundColor: colors.primary, bottom: pb }]} onPress={() => setModal(true)} activeOpacity={0.85}>
        <Feather name="user-plus" size={22} color="#fff" />
      </TouchableOpacity>

      <Modal visible={modal} animationType="slide" transparent onRequestClose={() => setModal(false)}>
        <View style={styles.modalBg}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, paddingBottom: pb }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>New User</Text>
              <TouchableOpacity onPress={() => setModal(false)} hitSlop={8}><Feather name="x" size={22} color={colors.mutedForeground} /></TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
              {([['name', 'Full Name'], ['email', 'Email'], ['phone', 'Phone'], ['employeeCode', 'Employee Code'], ['department', 'Department']] as const).map(([k, label]) => (
                <View key={k} style={styles.field}>
                  <Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text>
                  <TextInput
                    style={[styles.modalInput, { color: colors.foreground, borderColor: colors.border }]}
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
              <Text style={[styles.hint, { color: colors.mutedForeground }]}>Default password: colorjet123</Text>
              <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary }]} onPress={onCreate} activeOpacity={0.85}>
                <Feather name="check" size={17} color="#fff" />
                <Text style={styles.saveText}>Create User</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  search: { flex: 1, fontSize: 14, fontFamily: 'Inter_400Regular', padding: 0 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  chipText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, borderWidth: 1 },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 17, fontFamily: 'Inter_700Bold' },
  name: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  sub: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 1 },
  rolePill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  rolePillText: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  fab: { position: 'absolute', right: 20, width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', elevation: 4, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 18, maxHeight: '88%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  modalTitle: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  field: { gap: 6 },
  label: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  modalInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14, fontFamily: 'Inter_400Regular' },
  roleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  roleOpt: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  roleOptText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  hint: { fontSize: 12, fontFamily: 'Inter_400Regular', fontStyle: 'italic' },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12, marginTop: 4 },
  saveText: { color: '#fff', fontSize: 15, fontFamily: 'Inter_700Bold' },
});
