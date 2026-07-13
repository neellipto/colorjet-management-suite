import { Feather } from '@expo/vector-icons';
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getExtendedModule, type ExtendedField } from '@/constants/extendedModules';
import { useColors } from '@/hooks/useColors';
import {
  advanceExtendedRecordStatus,
  deleteExtendedRecord,
  extendedRecordsToCsv,
  loadExtendedRecords,
  saveExtendedRecord,
  type ExtendedRecord,
} from '@/lib/extendedModuleStore';

function clean(value?: string): string {
  return String(value ?? '').trim();
}

function recordTitle(record: ExtendedRecord, fields: ExtendedField[]): string {
  const preferredKeys = [
    'warrantyNo', 'requestNo', 'agreementNo', 'purchaseRef', 'shipmentRef', 'supplierName',
    'customerName', 'employeeName', 'deviceName', 'productName', 'partName',
  ];
  for (const key of preferredKeys) {
    if (clean(record.values[key])) return record.values[key];
  }
  for (const field of fields) {
    if (clean(record.values[field.key])) return record.values[field.key];
  }
  return record.id;
}

function recordSubtitle(record: ExtendedRecord, fields: ExtendedField[]): string {
  const values = fields
    .map(field => clean(record.values[field.key]))
    .filter(Boolean)
    .slice(0, 4);
  return values.join(' • ') || 'No additional details';
}

export default function ExtendedModuleScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ module?: string | string[] }>();
  const definition = useMemo(() => getExtendedModule(params.module), [params.module]);
  const [records, setRecords] = useState<ExtendedRecord[]>([]);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ExtendedRecord | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!definition) return;
    setRecords(await loadExtendedRecords(definition.id));
  }, [definition]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  if (!definition) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Feather name="alert-circle" size={42} color={colors.destructive} />
        <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Module not found</Text>
        <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>The requested COLORJET module is not configured.</Text>
      </View>
    );
  }

  const filtered = records.filter(record => {
    const query = search.trim().toLowerCase();
    if (!query) return true;
    return [record.id, record.status, ...Object.values(record.values)]
      .join(' ')
      .toLowerCase()
      .includes(query);
  });

  const openCreate = () => {
    const initial: Record<string, string> = {};
    definition.fields.forEach(field => { initial[field.key] = field.defaultValue ?? ''; });
    setEditing(null);
    setFormValues(initial);
    setFormOpen(true);
  };

  const openEdit = (record: ExtendedRecord) => {
    const values: Record<string, string> = {};
    definition.fields.forEach(field => { values[field.key] = record.values[field.key] ?? field.defaultValue ?? ''; });
    setEditing(record);
    setFormValues(values);
    setFormOpen(true);
  };

  const validateAndSave = async () => {
    const missing = definition.fields.find(field => field.required && !clean(formValues[field.key]));
    if (missing) {
      Alert.alert('Required information', `${missing.label} is required.`);
      return;
    }
    setSaving(true);
    try {
      await saveExtendedRecord(definition, formValues, editing?.id);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setFormOpen(false);
      setEditing(null);
      await load();
    } catch (error) {
      Alert.alert('Save failed', error instanceof Error ? error.message : 'The record could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (record: ExtendedRecord) => {
    Alert.alert('Delete record', `Delete “${recordTitle(record, definition.fields)}”?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          await deleteExtendedRecord(definition.id, record.id);
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          await load();
        },
      },
    ]);
  };

  const nextStatus = async (record: ExtendedRecord) => {
    await advanceExtendedRecordStatus(definition, record.id);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await load();
  };

  const exportCsv = async () => {
    if (!records.length) {
      Alert.alert('Nothing to export', 'Create at least one record before exporting.');
      return;
    }
    const csv = extendedRecordsToCsv(definition, records);
    await Share.share({
      title: `${definition.title} CSV`,
      message: csv,
    });
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: definition.title }} />
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 34, gap: 12 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.hero, { backgroundColor: definition.accent }]}>
          <View style={styles.heroIcon}>
            <Feather name={definition.icon as any} size={25} color="#fff" />
          </View>
          <View style={styles.heroText}>
            <Text style={styles.heroTitle}>{definition.title}</Text>
            <Text style={styles.heroSubtitle}>{definition.subtitle}</Text>
          </View>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity style={[styles.primaryButton, { backgroundColor: colors.primary }]} onPress={openCreate} activeOpacity={0.8}>
            <Feather name="plus" size={17} color="#fff" />
            <Text style={styles.primaryButtonText}>Add Record</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.outlineButton, { borderColor: colors.border, backgroundColor: colors.card }]} onPress={exportCsv} activeOpacity={0.8}>
            <Feather name="download" size={17} color={colors.primary} />
            <Text style={[styles.outlineButtonText, { color: colors.primary }]}>CSV</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.searchBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="search" size={18} color={colors.mutedForeground} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={`Search ${definition.title.toLowerCase()}`}
            placeholderTextColor={colors.mutedForeground}
            style={[styles.searchInput, { color: colors.foreground }]}
            autoCapitalize="none"
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')}><Feather name="x-circle" size={18} color={colors.mutedForeground} /></TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.summaryValue, { color: colors.primary }]}>{records.length}</Text>
            <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Total Records</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.summaryValue, { color: definition.accent }]}>{filtered.length}</Text>
            <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Visible</Text>
          </View>
        </View>

        {filtered.length ? filtered.map(record => {
          const statusIndex = Math.max(0, definition.statuses.indexOf(record.status));
          const isLastStatus = statusIndex >= definition.statuses.length - 1;
          return (
            <View key={record.id} style={[styles.recordCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.recordHeader}>
                <View style={[styles.recordIcon, { backgroundColor: `${definition.accent}18` }]}>
                  <Feather name={definition.icon as any} size={20} color={definition.accent} />
                </View>
                <View style={styles.recordTitleWrap}>
                  <Text style={[styles.recordTitle, { color: colors.foreground }]} numberOfLines={1}>{recordTitle(record, definition.fields)}</Text>
                  <Text style={[styles.recordId, { color: colors.mutedForeground }]} numberOfLines={1}>{record.id}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: `${definition.accent}18` }]}>
                  <Text style={[styles.statusText, { color: definition.accent }]}>{record.status}</Text>
                </View>
              </View>
              <Text style={[styles.recordSubtitle, { color: colors.mutedForeground }]} numberOfLines={3}>
                {recordSubtitle(record, definition.fields)}
              </Text>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <View style={styles.recordActions}>
                <TouchableOpacity style={styles.cardAction} onPress={() => openEdit(record)}>
                  <Feather name="edit-2" size={15} color={colors.primary} />
                  <Text style={[styles.cardActionText, { color: colors.primary }]}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.cardAction, isLastStatus && { opacity: 0.45 }]} disabled={isLastStatus} onPress={() => void nextStatus(record)}>
                  <Feather name="arrow-right-circle" size={15} color={definition.accent} />
                  <Text style={[styles.cardActionText, { color: definition.accent }]}>Next Status</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.cardAction} onPress={() => confirmDelete(record)}>
                  <Feather name="trash-2" size={15} color={colors.destructive} />
                  <Text style={[styles.cardActionText, { color: colors.destructive }]}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }) : (
          <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="inbox" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No records found</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Use Add Record to create the first working entry.</Text>
          </View>
        )}
      </ScrollView>

      <Modal visible={formOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setFormOpen(false)}>
        <KeyboardAvoidingView style={[styles.modalRoot, { backgroundColor: colors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.modalHeader, { backgroundColor: colors.card, borderBottomColor: colors.border, paddingTop: Platform.OS === 'android' ? insets.top + 8 : 12 }]}>
            <TouchableOpacity onPress={() => setFormOpen(false)} style={styles.headerButton}>
              <Text style={[styles.headerButtonText, { color: colors.mutedForeground }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>{editing ? 'Edit Record' : 'New Record'}</Text>
            <TouchableOpacity disabled={saving} onPress={() => void validateAndSave()} style={styles.headerButton}>
              <Text style={[styles.headerButtonText, { color: colors.primary, opacity: saving ? 0.5 : 1 }]}>{saving ? 'Saving…' : 'Save'}</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 36, gap: 14 }} keyboardShouldPersistTaps="handled">
            <View style={[styles.formIntro, { backgroundColor: `${definition.accent}12`, borderColor: `${definition.accent}40` }]}>
              <Feather name={definition.icon as any} size={20} color={definition.accent} />
              <Text style={[styles.formIntroText, { color: colors.foreground }]}>{definition.subtitle}</Text>
            </View>
            {definition.fields.map(field => (
              <View key={field.key} style={styles.fieldWrap}>
                <Text style={[styles.fieldLabel, { color: colors.foreground }]}>{field.label}{field.required ? ' *' : ''}</Text>
                {field.kind === 'select' ? (
                  <View style={styles.optionWrap}>
                    {(field.options ?? []).map(option => {
                      const active = formValues[field.key] === option;
                      return (
                        <TouchableOpacity
                          key={option}
                          onPress={() => setFormValues(current => ({ ...current, [field.key]: option }))}
                          style={[
                            styles.optionChip,
                            { borderColor: active ? definition.accent : colors.border, backgroundColor: active ? `${definition.accent}18` : colors.card },
                          ]}
                        >
                          <Text style={[styles.optionText, { color: active ? definition.accent : colors.foreground }]}>{option}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : (
                  <TextInput
                    value={formValues[field.key] ?? ''}
                    onChangeText={value => setFormValues(current => ({ ...current, [field.key]: value }))}
                    placeholder={field.placeholder ?? (field.kind === 'date' ? 'YYYY-MM-DD' : `Enter ${field.label.toLowerCase()}`)}
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType={field.kind === 'number' ? 'decimal-pad' : 'default'}
                    multiline={field.kind === 'multiline'}
                    numberOfLines={field.kind === 'multiline' ? 4 : 1}
                    textAlignVertical={field.kind === 'multiline' ? 'top' : 'center'}
                    style={[
                      styles.textField,
                      field.kind === 'multiline' && styles.multilineField,
                      { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border },
                    ]}
                  />
                )}
              </View>
            ))}
            <TouchableOpacity disabled={saving} style={[styles.saveBottom, { backgroundColor: colors.primary }]} onPress={() => void validateAndSave()} activeOpacity={0.8}>
              <Feather name="save" size={18} color="#fff" />
              <Text style={styles.saveBottomText}>{saving ? 'Saving…' : 'Save Record'}</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 10 },
  hero: { borderRadius: 18, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 14 },
  heroIcon: { width: 50, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.18)' },
  heroText: { flex: 1, gap: 4 },
  heroTitle: { color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 19 },
  heroSubtitle: { color: 'rgba(255,255,255,0.82)', fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 17 },
  actionRow: { flexDirection: 'row', gap: 10 },
  primaryButton: { flex: 1, height: 48, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  primaryButtonText: { color: '#fff', fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  outlineButton: { minWidth: 92, height: 48, borderRadius: 12, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  outlineButtonText: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  searchBox: { height: 48, borderRadius: 12, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 13 },
  searchInput: { flex: 1, height: '100%', fontFamily: 'Inter_400Regular', fontSize: 14 },
  summaryRow: { flexDirection: 'row', gap: 10 },
  summaryCard: { flex: 1, padding: 13, borderRadius: 12, borderWidth: 1 },
  summaryValue: { fontFamily: 'Inter_700Bold', fontSize: 20 },
  summaryLabel: { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 2 },
  recordCard: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 10 },
  recordHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  recordIcon: { width: 42, height: 42, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  recordTitleWrap: { flex: 1, gap: 2 },
  recordTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  recordId: { fontFamily: 'Inter_400Regular', fontSize: 10 },
  statusBadge: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6, maxWidth: 104 },
  statusText: { fontFamily: 'Inter_600SemiBold', fontSize: 10, textAlign: 'center' },
  recordSubtitle: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 17 },
  divider: { height: StyleSheet.hairlineWidth },
  recordActions: { flexDirection: 'row', justifyContent: 'space-between', gap: 6 },
  cardAction: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 7 },
  cardActionText: { fontFamily: 'Inter_500Medium', fontSize: 11 },
  emptyCard: { borderRadius: 14, borderWidth: 1, padding: 28, alignItems: 'center', gap: 8 },
  emptyTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 16, textAlign: 'center' },
  emptyText: { fontFamily: 'Inter_400Regular', fontSize: 12, textAlign: 'center', lineHeight: 18 },
  modalRoot: { flex: 1 },
  modalHeader: { minHeight: 62, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10, paddingBottom: 8 },
  modalTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 17 },
  headerButton: { minWidth: 72, padding: 10 },
  headerButtonText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, textAlign: 'center' },
  formIntro: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 13, borderRadius: 12, borderWidth: 1 },
  formIntroText: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 17 },
  fieldWrap: { gap: 7 },
  fieldLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  textField: { minHeight: 48, borderRadius: 11, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 10, fontFamily: 'Inter_400Regular', fontSize: 14 },
  multilineField: { minHeight: 104 },
  optionWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionChip: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 9 },
  optionText: { fontFamily: 'Inter_500Medium', fontSize: 12 },
  saveBottom: { height: 52, borderRadius: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8 },
  saveBottomText: { color: '#fff', fontFamily: 'Inter_600SemiBold', fontSize: 15 },
});
