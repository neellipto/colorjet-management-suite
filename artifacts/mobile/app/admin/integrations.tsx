import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import type { IntegrationSettings, MessagingSettings } from '@/constants/types';

const ODOO_FIELDS: { key: keyof IntegrationSettings['odoo']; label: string; secure?: boolean }[] = [
  { key: 'domain', label: 'Odoo Domain' },
  { key: 'database', label: 'Database Name' },
  { key: 'username', label: 'Username' },
  { key: 'apiKey', label: 'API Key', secure: true },
];

const ODOO_MODULES: { key: string; label: string }[] = [
  { key: 'sales', label: 'Sales' },
  { key: 'inventory', label: 'Inventory' },
  { key: 'accounting', label: 'Accounting' },
  { key: 'crm', label: 'CRM' },
  { key: 'hr', label: 'HR / Payroll' },
];

const CHANNELS: { key: keyof MessagingSettings; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { key: 'whatsapp', label: 'WhatsApp', icon: 'message-circle' },
  { key: 'facebook', label: 'Facebook Messenger', icon: 'facebook' },
  { key: 'instagram', label: 'Instagram DM', icon: 'instagram' },
  { key: 'liveChat', label: 'Website Live Chat', icon: 'message-square' },
  { key: 'email', label: 'Email', icon: 'mail' },
  { key: 'sms', label: 'SMS', icon: 'smartphone' },
  { key: 'googleBusiness', label: 'Google Business', icon: 'globe' },
  { key: 'tiktok', label: 'TikTok', icon: 'video' },
];

export default function IntegrationsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { integrations, saveIntegrations } = useApp();
  const [form, setForm] = useState<IntegrationSettings>(JSON.parse(JSON.stringify(integrations)));

  const pb = insets.bottom + (Platform.OS === 'web' ? 34 : 0) + 24;
  const pt = Platform.OS === 'web' ? 16 : 0;

  const onSave = () => {
    const odooConfigured = !!(form.odoo.domain && form.odoo.database && form.odoo.username);
    const next: IntegrationSettings = { ...form, odoo: { ...form.odoo, status: odooConfigured ? 'configured' : 'not_configured' } };
    saveIntegrations(next);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingTop: pt + 16, paddingBottom: pb, paddingHorizontal: 16, gap: 12 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerRow}>
        <Text style={[styles.section, { color: colors.mutedForeground }]}>ODOO ERP</Text>
        <View style={[styles.statusPill, { backgroundColor: form.odoo.status === 'configured' ? colors.success + '22' : colors.muted }]}>
          <Text style={[styles.statusText, { color: form.odoo.status === 'configured' ? colors.success : colors.mutedForeground }]}>
            {form.odoo.status === 'configured' ? 'Configured' : 'Not Configured'}
          </Text>
        </View>
      </View>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {ODOO_FIELDS.map(f => (
          <View key={f.key} style={styles.field}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>{f.label}</Text>
            <View style={[styles.inputWrap, { borderColor: colors.border }]}>
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                value={form.odoo[f.key] as string}
                onChangeText={t => setForm(s => ({ ...s, odoo: { ...s.odoo, [f.key]: t } }))}
                placeholder={f.label}
                placeholderTextColor={colors.mutedForeground}
                secureTextEntry={f.secure}
                autoCapitalize="none"
              />
            </View>
          </View>
        ))}
        <Text style={[styles.label, { color: colors.mutedForeground, marginTop: 4 }]}>Modules to Sync</Text>
        {ODOO_MODULES.map(m => {
          const on = form.odoo.modules[m.key];
          return (
            <TouchableOpacity key={m.key} style={styles.modRow} onPress={() => setForm(s => ({ ...s, odoo: { ...s.odoo, modules: { ...s.odoo.modules, [m.key]: !on } } }))} activeOpacity={0.7}>
              <Text style={[styles.rowLabel, { color: colors.foreground }]}>{m.label}</Text>
              <View style={[styles.switch, { backgroundColor: on ? colors.success : colors.muted }]}>
                <View style={[styles.knob, { transform: [{ translateX: on ? 18 : 2 }] }]} />
              </View>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity style={styles.modRow} onPress={() => setForm(s => ({ ...s, odoo: { ...s.odoo, autoSync: !s.odoo.autoSync } }))} activeOpacity={0.7}>
          <Text style={[styles.rowLabel, { color: colors.foreground }]}>Auto Sync</Text>
          <View style={[styles.switch, { backgroundColor: form.odoo.autoSync ? colors.success : colors.muted }]}>
            <View style={[styles.knob, { transform: [{ translateX: form.odoo.autoSync ? 18 : 2 }] }]} />
          </View>
        </TouchableOpacity>
      </View>

      <Text style={[styles.section, { color: colors.mutedForeground, marginTop: 4 }]}>MESSAGING CHANNELS</Text>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {CHANNELS.map(ch => {
          const channel = form.messaging[ch.key];
          return (
            <TouchableOpacity
              key={ch.key}
              style={styles.chRow}
              onPress={() => setForm(s => ({ ...s, messaging: { ...s.messaging, [ch.key]: { enabled: !channel.enabled, status: !channel.enabled ? 'configured' : 'not_configured' } } }))}
              activeOpacity={0.7}
            >
              <View style={[styles.chIcon, { backgroundColor: colors.navyLight }]}>
                <Feather name={ch.icon} size={16} color={colors.primary} />
              </View>
              <Text style={[styles.rowLabel, { color: colors.foreground, flex: 1 }]}>{ch.label}</Text>
              <View style={[styles.switch, { backgroundColor: channel.enabled ? colors.success : colors.muted }]}>
                <View style={[styles.knob, { transform: [{ translateX: channel.enabled ? 18 : 2 }] }]} />
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary }]} onPress={onSave} activeOpacity={0.85}>
        <Feather name="check" size={17} color="#fff" />
        <Text style={styles.saveText}>Save Integrations</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  section: { fontSize: 12, fontFamily: 'Inter_700Bold', letterSpacing: 0.5, marginLeft: 4 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  card: { borderRadius: 14, padding: 14, borderWidth: 1, gap: 12 },
  field: { gap: 6 },
  label: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  inputWrap: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11 },
  input: { fontSize: 14, fontFamily: 'Inter_400Regular', padding: 0 },
  modRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  chRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  chIcon: { width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  switch: { width: 40, height: 24, borderRadius: 12, justifyContent: 'center' },
  knob: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12, marginTop: 4 },
  saveText: { color: '#fff', fontSize: 15, fontFamily: 'Inter_700Bold' },
});
