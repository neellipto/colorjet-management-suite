import { Feather } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { FlatList, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState } from '@/components/EmptyState';
import { SearchBar } from '@/components/SearchBar';
import { StatCard } from '@/components/StatCard';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import type { Product } from '@/constants/types';

function fmt(n: number) {
  if (n >= 1000000) return `৳${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `৳${(n / 1000).toFixed(0)}K`;
  return `৳${n.toLocaleString()}`;
}

function ProductCard({ product }: { product: Product }) {
  const colors = useColors();
  const isLow = product.currentStock < product.minStockQty;
  const stockColor = isLow ? colors.destructive : product.currentStock <= product.minStockQty * 1.5 ? colors.warning : colors.success;

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: isLow ? colors.destructive : colors.border }]}>
      {isLow && (
        <View style={[styles.lowBadge, { backgroundColor: '#FFEBEE' }]}>
          <Feather name="alert-triangle" size={11} color={colors.destructive} />
          <Text style={[styles.lowText, { color: colors.destructive }]}>LOW STOCK</Text>
        </View>
      )}
      <View style={styles.cardTop}>
        <View style={[styles.typeIcon, { backgroundColor: colors.navyLight }]}>
          <Feather name={product.productType === 'machine' ? 'cpu' : product.productType === 'ink' ? 'droplet' : product.productType === 'spare' ? 'settings' : 'box'} size={18} color={colors.primary} />
        </View>
        <View style={styles.cardInfo}>
          <Text style={[styles.cardName, { color: colors.foreground }]} numberOfLines={2}>{product.name}</Text>
          <Text style={[styles.cardSku, { color: colors.mutedForeground }]}>{product.sku} · {product.categoryName}</Text>
        </View>
      </View>
      <View style={styles.cardBottom}>
        <View style={styles.stockBox}>
          <Text style={[styles.stockLabel, { color: colors.mutedForeground }]}>In Stock</Text>
          <Text style={[styles.stockValue, { color: stockColor }]}>{product.currentStock} <Text style={styles.uom}>{product.uom}</Text></Text>
          <Text style={[styles.minStock, { color: colors.mutedForeground }]}>Min: {product.minStockQty}</Text>
        </View>
        <View style={styles.priceBox}>
          <Text style={[styles.stockLabel, { color: colors.mutedForeground }]}>Sale Price</Text>
          <Text style={[styles.priceValue, { color: colors.foreground }]}>{fmt(product.salePrice)}</Text>
          <Text style={[styles.minStock, { color: colors.mutedForeground }]}>Cost: {fmt(product.costPrice)}</Text>
        </View>
        <View style={styles.stockBox}>
          <Text style={[styles.stockLabel, { color: colors.mutedForeground }]}>Stock Value</Text>
          <Text style={[styles.priceValue, { color: colors.primary }]}>{fmt(product.currentStock * product.costPrice)}</Text>
        </View>
      </View>
    </View>
  );
}

type StockFilter = 'all' | 'low' | 'machine' | 'ink' | 'spare';

export default function InventoryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { products } = useApp();

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<StockFilter>('all');

  const stats = useMemo(() => ({
    total: products.length,
    lowStock: products.filter(p => p.currentStock < p.minStockQty).length,
    stockValue: products.reduce((s, p) => s + p.currentStock * p.costPrice, 0),
    totalItems: products.reduce((s, p) => s + p.currentStock, 0),
  }), [products]);

  const filtered = useMemo(() => {
    let list = products;
    if (filter === 'low') list = list.filter(p => p.currentStock < p.minStockQty);
    else if (filter !== 'all') list = list.filter(p => p.productType === filter);
    if (search) list = list.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase()));
    return list.sort((a, b) => (a.currentStock < a.minStockQty ? -1 : 1));
  }, [products, filter, search]);

  const pb = insets.bottom + (Platform.OS === 'web' ? 34 : 0) + 70;
  const pt = Platform.OS === 'web' ? 67 : 0;

  const FILTERS: { label: string; key: StockFilter }[] = [
    { label: 'All', key: 'all' },
    { label: 'Low Stock', key: 'low' },
    { label: 'Machines', key: 'machine' },
    { label: 'Inks', key: 'ink' },
    { label: 'Spares', key: 'spare' },
  ];

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingTop: pt + 16, paddingBottom: pb, paddingHorizontal: 16, gap: 12 }}
      ListHeaderComponent={
        <>
          <Text style={[styles.screenTitle, { color: colors.foreground }]}>Inventory</Text>
          <View style={styles.statsRow}>
            <StatCard label="Total SKUs" value={String(stats.total)} accent="primary" />
            <StatCard label="Low Stock" value={String(stats.lowStock)} subLabel="Items" accent="error" />
          </View>
          <View style={styles.statsRow}>
            <StatCard label="Stock Value" value={fmt(stats.stockValue)} accent="success" />
            <StatCard label="Total Units" value={String(stats.totalItems)} accent="primary" />
          </View>
          <SearchBar value={search} onChangeText={setSearch} placeholder="Search products, SKU..." />
          <View style={styles.filterRow}>
            {FILTERS.map(f => (
              <TouchableOpacity
                key={f.key}
                style={[styles.filterBtn, { backgroundColor: filter === f.key ? colors.primary : colors.card, borderColor: filter === f.key ? colors.primary : colors.border }]}
                onPress={() => setFilter(f.key)}
                activeOpacity={0.75}
              >
                <Text style={[styles.filterText, { color: filter === f.key ? '#fff' : colors.mutedForeground }]}>{f.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      }
      data={filtered}
      keyExtractor={p => p.id}
      renderItem={({ item }) => <ProductCard product={item} />}
      ListEmptyComponent={<EmptyState icon="package" title="No products found" description="No matching products." />}
      ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  screenTitle: { fontSize: 22, fontFamily: 'Inter_700Bold', marginBottom: 4 },
  statsRow: { flexDirection: 'row', gap: 8 },
  filterRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  filterBtn: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1 },
  filterText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  card: { borderRadius: 12, padding: 14, borderWidth: 1, gap: 12 },
  lowBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  lowText: { fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 0.5 },
  cardTop: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  typeIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cardInfo: { flex: 1, gap: 3 },
  cardName: { fontSize: 14, fontFamily: 'Inter_600SemiBold', lineHeight: 19 },
  cardSku: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 10, borderTopWidth: 1, borderTopColor: '#E5E5EA' },
  stockBox: { flex: 1, gap: 2 },
  priceBox: { flex: 1, gap: 2, alignItems: 'center' },
  stockLabel: { fontSize: 10, fontFamily: 'Inter_500Medium', textTransform: 'uppercase' },
  stockValue: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  priceValue: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  uom: { fontSize: 10, fontFamily: 'Inter_400Regular' },
  minStock: { fontSize: 10, fontFamily: 'Inter_400Regular' },
});
