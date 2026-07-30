import React, { useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppHeader } from '../components/AppHeader';
import { KpiCard } from '../components/KpiCard';
import { ModuleButton } from '../components/ModuleButton';
import { api } from '../services/api';
import { colors } from '../theme/colors';
import type { DashboardKpi } from '../types';

const zeroKpis: DashboardKpi[] = [
  { key: 'sales_today', label: 'Today Sales', value: '৳0', note: 'Connect Odoo report', status: 'normal' },
  { key: 'collection_today', label: 'Today Collection', value: '৳0', note: 'Connect payment report', status: 'success' },
  { key: 'open_tickets', label: 'Open Service Tickets', value: 0, note: 'Service module', status: 'warning' },
  { key: 'low_stock', label: 'Low Stock Items', value: 0, note: 'Stock module', status: 'danger' }
];

export function DashboardScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [kpis, setKpis] = useState<DashboardKpi[]>([]);

  async function loadDashboard(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');

    const res = await api.dashboard();
    if (res.ok && res.data?.kpis) {
      setKpis(res.data.kpis);
    } else {
      setKpis(zeroKpis);
      setError(res.error || 'Backend not connected yet');
    }

    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  return (
    <View style={styles.root}>
      <AppHeader />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadDashboard(true)} />}
      >
        <Text style={styles.h1}>Owner Dashboard</Text>
        <Text style={styles.p}>Industrial digital printing business control center.</Text>

        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
        ) : (
          <View style={styles.kpiGrid}>
            {kpis.map((item) => (
              <KpiCard key={item.key} item={item} />
            ))}
          </View>
        )}

        {!!error && <Text style={styles.error}>API status: {error}</Text>}

        <Text style={styles.sectionTitle}>Modules</Text>
        <ModuleButton title="Office Tasks" />
        <ModuleButton title="Engineer Service" />
        <ModuleButton title="Warranty & Repair" />
        <ModuleButton title="Customers" />
        <ModuleButton title="Stock & Spare Parts" />
        <ModuleButton title="Odoo Reports" />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg
  },
  content: {
    padding: 16,
    paddingBottom: 40
  },
  h1: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900'
  },
  p: {
    color: colors.muted,
    fontSize: 14,
    marginTop: 6,
    marginBottom: 16
  },
  loader: {
    marginVertical: 30
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between'
  },
  error: {
    color: colors.warning,
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
    borderWidth: 1,
    padding: 12,
    borderRadius: 12,
    marginBottom: 14
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
    marginTop: 4,
    marginBottom: 10
  }
});
