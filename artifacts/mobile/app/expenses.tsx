import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useMemo, useState } from 'react';
import {
  Alert, FlatList, Modal, Platform, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState } from '@/components/EmptyState';
import { StatCard } from '@/components/StatCard';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import type { Expense } from '@/constants/types';

function fmt(n: number) {
  return `৳${n.toLocaleString()}`;
}

const CATEGORIES = ['Transport', 'Salary', 'Entertainment', 'Rent', 'Utility', 'Labour', 'LC/Customs', 'Office', 'Other'];
const METHODS = ['Cash', 'Bank Transfer', 'bKash', 'Nagad', 'Card'];

const CAT_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  Transport: 'truck', Salary: 'users', Entertainment: 'coffee', Rent: 'home',
  Utility: 'zap', Labour: 'tool', 'LC/Customs': 'globe', Office: 'briefcase', Other: 'circle',
};

function ExpenseCard({ expense }: { expense: Expense }) {
  const colors = useColors();
  const icon = CAT_ICONS[expense.category] ?? 'circle';
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.cardRow}>
        <View style={[styles.catIcon, { backgroundColor: colors.navyLight }]}>
          <Feather name={icon} size={16} color={colors.primary} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[styles.cardCat, { color: colors.foreground }]}>{expense.category}</Text>
          <Text style={[styles.cardDesc, { color: colors.mutedForeground }]} numberOfLines={2}>{expense.description}</Text>
          <Text style={[styles.cardMeta, { color: colors.mutedForeground }]}>{expense.expenseDate} · {expense.paidByName} · {expense.paymentMethod}</Text>
        </View>
        <Text style={[styles.cardAmount, { color: colors.destructive }]}>{fmt(expense.amount)}</Text>
      </View>
    </View>
  );
}

export default function ExpensesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { expenses, currentUser, addExpense } = useApp();

  const canAdd = currentUser?.role === 'admin' || currentUser?.role === 'accounts' || currentUser?.role === 'marketing' || currentUser?.role === 'engineer';

  const [showModal, setShowModal] = useState(false);
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState(METHODS[0]);

  const mtdExpenses = useMemo(() => expenses.filter(e => e.expenseDate.startsWith('2024-06')), [expenses]);
  const total = useMemo(() => mtdExpenses.reduce((s, e) => s + e.amount, 0), [mtdExpenses]);

  const pb = insets.bottom + (Platform.OS === 'web' ? 34 : 0) + 80;
  const pt = Platform.OS === 'web' ? 67 : 0;

  const handleAdd = () => {
    const amt = parseFloat(amount);
    if (!description.trim()) { Alert.alert('Required', 'Enter a description.'); return; }
    if (!amt || amt <= 0) { Alert.alert('Invalid', 'Enter a valid amount.'); return; }
    addExpense({
      expenseDate: new Date().toISOString().split('T')[0],
      category,
      description: description.trim(),
      amount: amt,
      paidById: currentUser?.id ?? '',
      paidByName: currentUser?.name ?? '',
      paymentMethod: method,
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowModal(false);
    setDescription('');
    setAmount('');
  };

  return (
    <>
      <FlatList
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ paddingTop: pt + 16, paddingBottom: pb, paddingHorizontal: 16, gap: 10 }}
        ListHeaderComponent={
          <>
            <Text style={[styles.screenTitle, { color: colors.foreground }]}>Expenses</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <StatCard label="MTD Total" value={fmt(total)} accent="error" />
              <StatCard label="Entries" value={String(mtdExpenses.length)} accent="primary" />
            </View>
          </>
        }
        data={expenses}
        keyExtractor={e => e.id}
        renderItem={({ item }) => <ExpenseCard expense={item} />}
        ListEmptyComponent={<EmptyState icon="dollar-sign" title="No expenses recorded" description="Add your first expense entry." />}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        showsVerticalScrollIndicator={false}
      />

      {canAdd && (
        <View style={[styles.fab, { bottom: insets.bottom + (Platform.OS === 'web' ? 34 : 0) + 16 }]}>
          <TouchableOpacity style={[styles.fabBtn, { backgroundColor: colors.primary }]} onPress={() => setShowModal(true)} activeOpacity={0.85}>
            <Feather name="plus" size={18} color="#fff" />
            <Text style={styles.fabText}>Add Expense</Text>
          </TouchableOpacity>
        </View>
      )}

      <Modal visible={showModal} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setShowModal(false)}>
        <View style={[styles.modal, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>New Expense</Text>
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <Feather name="x" size={22} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
          <FlatList
            contentContainerStyle={styles.modalBody}
            data={[1]}
            renderItem={() => (
              <>
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>CATEGORY</Text>
                <View style={styles.chipGrid}>
                  {CATEGORIES.map(c => (
                    <TouchableOpacity key={c} style={[styles.chip, { backgroundColor: category === c ? colors.primary : colors.card, borderColor: category === c ? colors.primary : colors.border }]} onPress={() => setCategory(c)}>
                      <Text style={[styles.chipText, { color: category === c ? '#fff' : colors.foreground }]}>{c}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>DESCRIPTION</Text>
                <TextInput style={[styles.input, { borderColor: colors.border, color: colors.foreground, fontFamily: 'Inter_400Regular' }]} value={description} onChangeText={setDescription} placeholder="Enter description..." placeholderTextColor={colors.mutedForeground} />
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>AMOUNT (BDT)</Text>
                <TextInput style={[styles.input, { borderColor: colors.border, color: colors.foreground, fontFamily: 'Inter_400Regular' }]} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={colors.mutedForeground} />
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>PAYMENT METHOD</Text>
                <View style={styles.chipGrid}>
                  {METHODS.map(m => (
                    <TouchableOpacity key={m} style={[styles.chip, { backgroundColor: method === m ? colors.primary : colors.card, borderColor: method === m ? colors.primary : colors.border }]} onPress={() => setMethod(m)}>
                      <Text style={[styles.chipText, { color: method === m ? '#fff' : colors.foreground }]}>{m}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: colors.primary }]} onPress={handleAdd} activeOpacity={0.85}>
                  <Text style={styles.confirmText}>Save Expense</Text>
                </TouchableOpacity>
              </>
            )}
            keyExtractor={() => 'form'}
          />
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  screenTitle: { fontSize: 22, fontFamily: 'Inter_700Bold', marginBottom: 4 },
  card: { borderRadius: 12, padding: 14, borderWidth: 1 },
  cardRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  catIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cardCat: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  cardDesc: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  cardMeta: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  cardAmount: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  fab: { position: 'absolute', right: 16, left: 16 },
  fabBtn: { borderRadius: 14, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, elevation: 6, shadowColor: '#1A237E', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
  fabText: { color: '#fff', fontSize: 15, fontFamily: 'Inter_700Bold' },
  modal: { flex: 1 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1 },
  modalTitle: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  modalBody: { padding: 20, gap: 10, paddingBottom: 40 },
  fieldLabel: { fontSize: 11, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.5, marginTop: 8 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1 },
  chipText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  confirmBtn: { borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 12 },
  confirmText: { color: '#fff', fontSize: 16, fontFamily: 'Inter_700Bold' },
});
