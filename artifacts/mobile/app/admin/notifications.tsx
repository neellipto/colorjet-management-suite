import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import type { NotificationSettings } from '@/constants/types';

const ALERT_LABELS: Record<string, string> = {
  new_ticket: 'New Service Ticket',
  status_change: 'Ticket Status Change',
  job_assigned: 'Job Assigned to Engineer',
  stock_warning: 'Low Stock Warning',
  due_warning: 'Payment Due Warning',
  payment: 'Payment Received',
  complaint: 'Customer Complaint',
};

const CHANNEL_LABELS: Record<string, string> = {
  in_app: 'In-App',
  email: 'Email',
  sms: 'SMS',
  whatsapp: 'WhatsApp',
};

export default function NotificationSettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { notificationSettings, saveNotificationSettings } = useApp();
  const [form, setForm] = useState<NotificationSettings>(JSON.parse(JSON.stringify(notificationSettings)));

  const pb = insets.bottom + (Platform.OS === 'web' ? 34 : 0) + 24;
  const pt = Platform.OS === 'web' ? 16 : 0;

  const toggle = (group: 'alerts' | 'channels', key: string) => {
    setForm(s => ({ ...s, [group]: { ...s[group], [key]: !s[group][key] } }));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const onSave = () => {
    saveNotificationSettings(form);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  const Row = ({ group, k, label }: { group: 'alerts' | 'channels'; k: string; label: string }) => {
    const value = form[group][k];
    return (
      <TouchableOpacity style={styles.row} onPress={() => toggle(group, k)} activeOpacity={0.7}>
        <Text style={[styles.rowLabel, { color: colors.foreground }]}>{label}</Text>
        <View style={[styles.switch, { backgroundColor: value ? colors.success : colors.muted }]}>
          <View style={[styles.knob, { transform: [{ translateX: value ? 18 : 2 }] }]} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingTop: pt + 16, paddingBottom: pb, paddingHorizontal: 16, gap: 12 }}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.section, { color: colors.mutedForeground }]}>ALERT TYPES</Text>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {Object.keys(form.alerts).map(k => (
          <Row key={k} group="alerts" k={k} label={ALERT_LABELS[k] ?? k} />
        ))}
      </View>

      <Text style={[styles.section, { color: colors.mutedForeground }]}>DELIVERY CHANNELS</Text>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {Object.keys(form.channels).map(k => (
          <Row key={k} group="channels" k={k} label={CHANNEL_LABELS[k] ?? k} />
        ))}
      </View>

      <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary }]} onPress={onSave} activeOpacity={0.85}>
        <Feather name="check" size={17} color="#fff" />
        <Text style={styles.saveText}>Save Settings</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  section: { fontSize: 12, fontFamily: 'Inter_700Bold', letterSpacing: 0.5, marginTop: 4, marginLeft: 4 },
  card: { borderRadius: 14, padding: 6, borderWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 13 },
  rowLabel: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  switch: { width: 40, height: 24, borderRadius: 12, justifyContent: 'center' },
  knob: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12, marginTop: 4 },
  saveText: { color: '#fff', fontSize: 15, fontFamily: 'Inter_700Bold' },
});
