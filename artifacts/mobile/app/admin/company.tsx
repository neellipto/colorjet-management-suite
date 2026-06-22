import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import type { CompanySettings } from '@/constants/types';

const FIELDS: { key: keyof CompanySettings; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { key: 'companyName', label: 'Company Name', icon: 'briefcase' },
  { key: 'shortName', label: 'Short Name', icon: 'tag' },
  { key: 'tagline', label: 'Tagline', icon: 'type' },
  { key: 'hotline', label: 'Hotline', icon: 'phone' },
  { key: 'email', label: 'Email', icon: 'mail' },
  { key: 'address', label: 'Address', icon: 'map-pin' },
  { key: 'website', label: 'Website', icon: 'globe' },
  { key: 'facebook', label: 'Facebook', icon: 'facebook' },
  { key: 'instagram', label: 'Instagram', icon: 'instagram' },
  { key: 'youtube', label: 'YouTube', icon: 'youtube' },
  { key: 'linkedin', label: 'LinkedIn', icon: 'linkedin' },
];

export default function CompanyScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { company, saveCompany } = useApp();
  const [form, setForm] = useState<CompanySettings>({ ...company });

  const pb = insets.bottom + (Platform.OS === 'web' ? 34 : 0) + 24;
  const pt = Platform.OS === 'web' ? 16 : 0;

  const onSave = () => {
    saveCompany(form);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingTop: pt + 16, paddingBottom: pb, paddingHorizontal: 16, gap: 12 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {FIELDS.map(f => (
          <View key={f.key} style={styles.field}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>{f.label}</Text>
            <View style={[styles.inputWrap, { borderColor: colors.border }]}>
              <Feather name={f.icon} size={15} color={colors.mutedForeground} />
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                value={form[f.key]}
                onChangeText={t => setForm(s => ({ ...s, [f.key]: t }))}
                placeholder={f.label}
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="none"
              />
            </View>
          </View>
        ))}
      </View>
      <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary }]} onPress={onSave} activeOpacity={0.85}>
        <Feather name="check" size={17} color="#fff" />
        <Text style={styles.saveText}>Save Company Profile</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 14, padding: 16, borderWidth: 1, gap: 14 },
  field: { gap: 6 },
  label: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  inputWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11 },
  input: { flex: 1, fontSize: 14, fontFamily: 'Inter_400Regular', padding: 0 },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12 },
  saveText: { color: '#fff', fontSize: 15, fontFamily: 'Inter_700Bold' },
});
