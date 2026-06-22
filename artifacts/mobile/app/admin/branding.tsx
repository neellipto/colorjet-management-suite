import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import type { BrandingSettings } from '@/constants/types';

const PRESET_THEME = ['#1A237E', '#0D47A1', '#1B5E20', '#4A148C', '#B71C1C', '#263238'];
const PRESET_ACCENT = ['#F57C00', '#FF6F00', '#00838F', '#C2185B', '#558B2F', '#5D4037'];

export default function BrandingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { branding, saveBranding } = useApp();
  const [form, setForm] = useState<BrandingSettings>({ ...branding });

  const pb = insets.bottom + (Platform.OS === 'web' ? 34 : 0) + 24;
  const pt = Platform.OS === 'web' ? 16 : 0;

  const onSave = () => {
    saveBranding(form);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  const Swatches = ({ presets, value, onPick }: { presets: string[]; value: string; onPick: (c: string) => void }) => (
    <View style={styles.swatchRow}>
      {presets.map(c => (
        <TouchableOpacity
          key={c}
          style={[styles.swatch, { backgroundColor: c, borderColor: value === c ? colors.foreground : 'transparent' }]}
          onPress={() => { onPick(c); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
          activeOpacity={0.8}
        >
          {value === c && <Feather name="check" size={16} color="#fff" />}
        </TouchableOpacity>
      ))}
    </View>
  );

  function Segment<T extends string>({ label, options, value, onPick }: { label: string; options: readonly T[]; value: T; onPick: (v: T) => void }) {
    return (
      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text>
        <View style={styles.segRow}>
          {options.map(o => (
            <TouchableOpacity
              key={o}
              style={[styles.seg, { backgroundColor: value === o ? colors.primary : colors.background, borderColor: value === o ? colors.primary : colors.border }]}
              onPress={() => { onPick(o); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
              activeOpacity={0.75}
            >
              <Text style={[styles.segText, { color: value === o ? '#fff' : colors.mutedForeground }]}>{o}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  }

  const Toggle = ({ label, value, onToggle }: { label: string; value: boolean; onToggle: () => void }) => (
    <TouchableOpacity style={styles.toggleRow} onPress={onToggle} activeOpacity={0.7}>
      <Text style={[styles.toggleLabel, { color: colors.foreground }]}>{label}</Text>
      <View style={[styles.switch, { backgroundColor: value ? colors.success : colors.muted }]}>
        <View style={[styles.knob, { transform: [{ translateX: value ? 18 : 2 }] }]} />
      </View>
    </TouchableOpacity>
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingTop: pt + 16, paddingBottom: pb, paddingHorizontal: 16, gap: 12 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Preview */}
      <View style={[styles.preview, { backgroundColor: form.themeColor }]}>
        <Text style={styles.previewTitle}>COLORJET</Text>
        <View style={[styles.previewBtn, { backgroundColor: form.accentColor, borderRadius: form.buttonStyle === 'rounded' ? 10 : 2 }]}>
          <Text style={styles.previewBtnText}>Accent Button</Text>
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.label, { color: colors.mutedForeground }]}>Theme Color</Text>
        <Swatches presets={PRESET_THEME} value={form.themeColor} onPick={c => setForm(s => ({ ...s, themeColor: c }))} />
        <View style={[styles.inputWrap, { borderColor: colors.border }]}>
          <TextInput style={[styles.input, { color: colors.foreground }]} value={form.themeColor} onChangeText={t => setForm(s => ({ ...s, themeColor: t }))} autoCapitalize="none" />
        </View>

        <Text style={[styles.label, { color: colors.mutedForeground, marginTop: 8 }]}>Accent Color</Text>
        <Swatches presets={PRESET_ACCENT} value={form.accentColor} onPick={c => setForm(s => ({ ...s, accentColor: c }))} />
        <View style={[styles.inputWrap, { borderColor: colors.border }]}>
          <TextInput style={[styles.input, { color: colors.foreground }]} value={form.accentColor} onChangeText={t => setForm(s => ({ ...s, accentColor: t }))} autoCapitalize="none" />
        </View>

        <Segment label="Font Scale" options={['small', 'normal', 'large']} value={form.fontScale} onPick={v => setForm(s => ({ ...s, fontScale: v }))} />
        <Segment label="Button Style" options={['rounded', 'square']} value={form.buttonStyle} onPick={v => setForm(s => ({ ...s, buttonStyle: v }))} />
        <Segment label="Appearance" options={['light', 'dark', 'auto']} value={form.appearance} onPick={v => setForm(s => ({ ...s, appearance: v }))} />

        <Toggle label="Header Gradient" value={form.headerGradient} onToggle={() => setForm(s => ({ ...s, headerGradient: !s.headerGradient }))} />
      </View>

      <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary }]} onPress={onSave} activeOpacity={0.85}>
        <Feather name="check" size={17} color="#fff" />
        <Text style={styles.saveText}>Save Branding</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  preview: { borderRadius: 14, padding: 22, alignItems: 'center', gap: 14 },
  previewTitle: { color: '#fff', fontSize: 22, fontFamily: 'Inter_700Bold', letterSpacing: 2 },
  previewBtn: { paddingHorizontal: 20, paddingVertical: 10 },
  previewBtnText: { color: '#fff', fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  card: { borderRadius: 14, padding: 16, borderWidth: 1, gap: 10 },
  field: { gap: 6, marginTop: 8 },
  label: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  swatchRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  swatch: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  inputWrap: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  input: { fontSize: 14, fontFamily: 'Inter_500Medium', padding: 0 },
  segRow: { flexDirection: 'row', gap: 8 },
  seg: { flex: 1, paddingVertical: 9, borderRadius: 8, borderWidth: 1, alignItems: 'center' },
  segText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', textTransform: 'capitalize' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  toggleLabel: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  switch: { width: 40, height: 24, borderRadius: 12, justifyContent: 'center' },
  knob: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12 },
  saveText: { color: '#fff', fontSize: 15, fontFamily: 'Inter_700Bold' },
});
