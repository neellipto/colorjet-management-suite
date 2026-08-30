import { Feather } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useErpRuntime } from '@/context/ErpRuntimeContext';
import { can } from '@/lib/effectivePermissions';
import {
  listManualRegisters,
  type ManualRegisterDefinition,
} from '@/lib/manualRegisters';
import { useColors } from '@/hooks/useColors';

function iconFor(type: ManualRegisterDefinition['registerType']): keyof typeof Feather.glyphMap {
  if (type === 'amount' || type === 'expense' || type === 'income') return 'dollar-sign';
  if (type === 'asset') return 'box';
  if (type === 'item_quantity') return 'layers';
  if (type === 'document') return 'file-text';
  if (type === 'customer' || type === 'supplier' || type === 'employee' || type === 'engineer') return 'users';
  return 'clipboard';
}

export default function ManualRegistersScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { permissions } = useErpRuntime();
  const [registers, setRegisters] = useState<ManualRegisterDefinition[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allowed = Boolean(permissions?.isOwner || can(permissions, 'manual_registers', 'view'));

  const load = useCallback(async () => {
    if (!allowed) return;
    setLoading(true);
    setError(null);
    try {
      setRegisters(await listManualRegisters());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load manual registers.');
    } finally {
      setLoading(false);
    }
  }, [allowed]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!allowed) {
    return (
      <View style={[styles.locked, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <Feather name="lock" size={34} color={colors.mutedForeground} />
        <Text style={[styles.lockTitle, { color: colors.foreground }]}>Manual Register access denied</Text>
        <Text style={[styles.lockText, { color: colors.mutedForeground }]}>Your current ERP permission does not allow this module.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingTop: insets.top + 14, paddingBottom: insets.bottom + 28, paddingHorizontal: 16, gap: 12 }}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
    >
      <View style={styles.titleRow}>
        <View>
          <Text style={[styles.title, { color: colors.foreground }]}>Manual Registers</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>No account or stock impact without approved posting rules.</Text>
        </View>
        {loading && <ActivityIndicator color={colors.primary} />}
      </View>

      {error && (
        <View style={[styles.errorBox, { backgroundColor: colors.card, borderColor: colors.destructive }]}>
          <Text style={{ color: colors.destructive }}>{error}</Text>
        </View>
      )}

      {registers.map(item => (
        <TouchableOpacity
          key={item.id}
          activeOpacity={0.75}
          style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <View style={[styles.icon, { backgroundColor: colors.navyLight }]}>
            <Feather name={iconFor(item.registerType)} size={19} color={colors.primary} />
          </View>
          <View style={styles.cardText}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>{item.name}</Text>
            {!!item.nameBn && <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>{item.nameBn}</Text>}
            <Text style={[styles.cardMeta, { color: colors.mutedForeground }]}>
              {item.fields.length} field(s) • {item.approvalRequired ? 'Approval required' : 'Direct submit'} • {item.postingRuleConfigured ? 'Posting configured' : 'No financial posting'}
            </Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
        </TouchableOpacity>
      ))}

      {!loading && !registers.length && !error && (
        <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="clipboard" size={28} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No register configured</Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>An Owner or authorized Admin can create register definitions from the ERP configuration panel.</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  locked: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, gap: 12 },
  lockTitle: { fontSize: 19, fontFamily: 'Inter_700Bold' },
  lockText: { fontSize: 14, lineHeight: 20, textAlign: 'center', fontFamily: 'Inter_400Regular' },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 23, fontFamily: 'Inter_700Bold' },
  subtitle: { fontSize: 12, lineHeight: 18, fontFamily: 'Inter_400Regular', marginTop: 4 },
  errorBox: { borderWidth: 1, borderRadius: 10, padding: 12 },
  card: { minHeight: 82, borderWidth: 1, borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardText: { flex: 1, gap: 2 },
  cardTitle: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  cardSub: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  cardMeta: { fontSize: 10, lineHeight: 15, fontFamily: 'Inter_400Regular' },
  empty: { borderWidth: 1, borderRadius: 14, padding: 22, alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  emptyText: { fontSize: 12, lineHeight: 18, textAlign: 'center', fontFamily: 'Inter_400Regular' },
});
