import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import type { DashboardKpi } from '../types';

function statusColor(status?: DashboardKpi['status']) {
  if (status === 'success') return colors.success;
  if (status === 'warning') return colors.warning;
  if (status === 'danger') return colors.danger;
  return colors.primary;
}

export function KpiCard({ item }: { item: DashboardKpi }) {
  return (
    <View style={styles.card}>
      <View style={[styles.dot, { backgroundColor: statusColor(item.status) }]} />
      <Text style={styles.label}>{item.label}</Text>
      <Text style={styles.value}>{item.value}</Text>
      {!!item.note && <Text style={styles.note}>{item.note}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '48%',
    minHeight: 112,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 99,
    marginBottom: 10
  },
  label: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700'
  },
  value: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    marginTop: 6
  },
  note: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 6
  }
});
