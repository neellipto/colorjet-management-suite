import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import type { CatalogAsset } from '@/constants/types';

const ASSET_TYPES: { key: CatalogAsset['type']; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { key: 'machine_image', label: 'Machine Image', icon: 'image' },
  { key: 'category_image', label: 'Category Image', icon: 'grid' },
  { key: 'spare_image', label: 'Spare Part Image', icon: 'box' },
  { key: 'catalog_pdf', label: 'Catalog PDF', icon: 'file-text' },
  { key: 'employee_photo', label: 'Employee Photo', icon: 'user' },
  { key: 'banner', label: 'Banner', icon: 'layout' },
  { key: 'datasheet', label: 'Datasheet', icon: 'file' },
];

export default function CatalogScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { categories, addCategory, deleteCategory, catalogAssets, addCatalogAsset, deleteCatalogAsset } = useApp();
  const [newCat, setNewCat] = useState('');
  const [assetName, setAssetName] = useState('');
  const [assetType, setAssetType] = useState<CatalogAsset['type']>('machine_image');

  const pb = insets.bottom + (Platform.OS === 'web' ? 34 : 0) + 24;
  const pt = Platform.OS === 'web' ? 16 : 0;

  const onAddCat = () => {
    if (!newCat.trim()) return;
    addCategory(newCat.trim());
    setNewCat('');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const onAddAsset = () => {
    if (!assetName.trim()) return;
    addCatalogAsset({ type: assetType, name: assetName.trim() });
    setAssetName('');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const confirmDelete = (label: string, fn: () => void) => {
    if (Platform.OS === 'web') { fn(); return; }
    Alert.alert('Delete', `Delete "${label}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: fn },
    ]);
  };

  const typeLabel = (t: CatalogAsset['type']) => ASSET_TYPES.find(a => a.key === t)?.label ?? t;
  const typeIcon = (t: CatalogAsset['type']) => ASSET_TYPES.find(a => a.key === t)?.icon ?? 'file';

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingTop: pt + 16, paddingBottom: pb, paddingHorizontal: 16, gap: 12 }}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.section, { color: colors.mutedForeground }]}>PRODUCT CATEGORIES</Text>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.addRow}>
          <TextInput
            style={[styles.input, { color: colors.foreground, borderColor: colors.border }]}
            value={newCat}
            onChangeText={setNewCat}
            placeholder="New category name"
            placeholderTextColor={colors.mutedForeground}
            onSubmitEditing={onAddCat}
          />
          <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.primary }]} onPress={onAddCat} activeOpacity={0.8}>
            <Feather name="plus" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
        {categories.map(c => (
          <View key={c.id} style={[styles.itemRow, { borderTopColor: colors.border }]}>
            <Feather name="tag" size={15} color={colors.primary} />
            <Text style={[styles.itemText, { color: colors.foreground }]}>{c.name}</Text>
            <TouchableOpacity onPress={() => confirmDelete(c.name, () => deleteCategory(c.id))} hitSlop={8}>
              <Feather name="trash-2" size={16} color={colors.destructive} />
            </TouchableOpacity>
          </View>
        ))}
      </View>

      <Text style={[styles.section, { color: colors.mutedForeground, marginTop: 4 }]}>CATALOG ASSETS</Text>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
          {ASSET_TYPES.map(t => (
            <TouchableOpacity
              key={t.key}
              style={[styles.chip, { backgroundColor: assetType === t.key ? colors.primary : colors.background, borderColor: assetType === t.key ? colors.primary : colors.border }]}
              onPress={() => setAssetType(t.key)}
              activeOpacity={0.75}
            >
              <Feather name={t.icon} size={13} color={assetType === t.key ? '#fff' : colors.mutedForeground} />
              <Text style={[styles.chipText, { color: assetType === t.key ? '#fff' : colors.mutedForeground }]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <View style={styles.addRow}>
          <TextInput
            style={[styles.input, { color: colors.foreground, borderColor: colors.border }]}
            value={assetName}
            onChangeText={setAssetName}
            placeholder="Asset name / reference"
            placeholderTextColor={colors.mutedForeground}
            onSubmitEditing={onAddAsset}
          />
          <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.primary }]} onPress={onAddAsset} activeOpacity={0.8}>
            <Feather name="plus" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
        {catalogAssets.length === 0 && (
          <Text style={[styles.empty, { color: colors.mutedForeground }]}>No assets yet. Add one above.</Text>
        )}
        {catalogAssets.map(a => (
          <View key={a.id} style={[styles.itemRow, { borderTopColor: colors.border }]}>
            <Feather name={typeIcon(a.type)} size={15} color={colors.orange} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.itemText, { color: colors.foreground }]}>{a.name}</Text>
              <Text style={[styles.itemSub, { color: colors.mutedForeground }]}>{typeLabel(a.type)}</Text>
            </View>
            <TouchableOpacity onPress={() => confirmDelete(a.name, () => deleteCatalogAsset(a.id))} hitSlop={8}>
              <Feather name="trash-2" size={16} color={colors.destructive} />
            </TouchableOpacity>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  section: { fontSize: 12, fontFamily: 'Inter_700Bold', letterSpacing: 0.5, marginTop: 4, marginLeft: 4 },
  card: { borderRadius: 14, padding: 14, borderWidth: 1, gap: 4 },
  addRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 4 },
  input: { flex: 1, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontFamily: 'Inter_400Regular' },
  addBtn: { width: 42, height: 42, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, borderTopWidth: StyleSheet.hairlineWidth },
  itemText: { fontSize: 14, fontFamily: 'Inter_500Medium', flex: 1 },
  itemSub: { fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 1 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  chipText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  empty: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center', paddingVertical: 12 },
});
