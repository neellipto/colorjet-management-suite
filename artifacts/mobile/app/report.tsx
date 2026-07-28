import { Feather } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import {
  exportReport,
  runReport,
  trustedDocumentUrl,
  type ReportColumn,
  type ReportFilters,
  type ReportResult,
} from '@/lib/reporting';

function single(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

function parseFilters(value: string): ReportFilters {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed as ReportFilters : {};
  } catch {
    return {};
  }
}

function displayValue(value: unknown, column: ReportColumn): string {
  if (value === null || value === undefined || value === '') return '—';
  if (column.dataType === 'currency') {
    const number = Number(value);
    return Number.isFinite(number) ? `৳${number.toLocaleString('en-BD', { maximumFractionDigits: 2 })}` : String(value);
  }
  if (column.dataType === 'number' || column.dataType === 'quantity') {
    const number = Number(value);
    return Number.isFinite(number) ? number.toLocaleString('en-BD', { maximumFractionDigits: 3 }) : String(value);
  }
  if (column.dataType === 'date' || column.dataType === 'datetime') {
    const date = new Date(String(value));
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('en-BD');
  }
  return String(value);
}

function summaryRows(result: ReportResult | null): Array<{ label: string; value: string }> {
  if (!result) return [];
  const summary = result.summary;
  const values: Array<[string, number | null | undefined]> = [
    ['Opening Balance', summary.openingBalance],
    ['Debit / OUT', summary.debitTotal],
    ['Credit / IN', summary.creditTotal],
    ['Closing Balance', summary.closingBalance],
    ['Quantity', summary.quantityTotal],
    ['Value', summary.valueTotal],
  ];
  return values
    .filter(([, value]) => value !== null && value !== undefined)
    .map(([label, value]) => ({
      label,
      value: Number(value).toLocaleString('en-BD', { maximumFractionDigits: 2 }),
    }));
}

function ReportRowCard({
  row,
  columns,
  expanded,
  onToggle,
}: {
  row: Record<string, unknown>;
  columns: ReportColumn[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const colors = useColors();
  const primaryColumns = columns.slice(0, 4);
  const detailColumns = columns.slice(4);

  return (
    <TouchableOpacity
      activeOpacity={0.82}
      onPress={onToggle}
      style={[styles.rowCard, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      {primaryColumns.map((column, index) => (
        <View key={column.key} style={styles.dataLine}>
          <Text style={[index === 0 ? styles.primaryLabel : styles.dataLabel, { color: colors.mutedForeground }]}>
            {column.label}
          </Text>
          <Text
            numberOfLines={expanded ? undefined : index === 0 ? 2 : 1}
            style={[index === 0 ? styles.primaryValue : styles.dataValue, { color: colors.foreground }]}
          >
            {displayValue(row[column.key], column)}
          </Text>
        </View>
      ))}

      {expanded && detailColumns.map(column => (
        <View key={column.key} style={styles.dataLine}>
          <Text style={[styles.dataLabel, { color: colors.mutedForeground }]}>{column.label}</Text>
          <Text style={[styles.dataValue, { color: colors.foreground }]}>{displayValue(row[column.key], column)}</Text>
        </View>
      ))}

      {detailColumns.length > 0 && (
        <View style={styles.expandLine}>
          <Text style={[styles.expandText, { color: colors.primary }]}>{expanded ? 'Show less' : 'View details'}</Text>
          <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.primary} />
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function ReportScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ code?: string; title?: string; filters?: string }>();
  const reportCode = single(params.code).trim();
  const title = single(params.title).trim() || 'Report';
  const filters = useMemo(() => parseFilters(single(params.filters)), [params.filters]);
  const [result, setResult] = useState<ReportResult<Record<string, unknown>> | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  const load = useCallback(async () => {
    if (!reportCode) {
      setError('Report code is missing.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await runReport<Record<string, unknown>>(reportCode, filters, 1);
      setResult(response);
      setExpandedRows(new Set());
    } catch (caught) {
      setResult(null);
      setError(caught instanceof Error ? caught.message : 'Unable to load this report.');
    } finally {
      setLoading(false);
    }
  }, [filters, reportCode]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleExport = async (format: 'pdf' | 'csv' | 'xlsx') => {
    if (!result?.runId || exporting) return;
    setExporting(format);
    try {
      const artifact = await exportReport(result.runId, format, {
        titleOverride: title,
        language: 'bilingual',
      });
      if (!trustedDocumentUrl(artifact.downloadUrl)) {
        throw new Error('The ERP returned an untrusted document URL.');
      }
      await Linking.openURL(artifact.downloadUrl);
    } catch (caught) {
      Alert.alert('Export failed', caught instanceof Error ? caught.message : 'Unable to export this report.');
    } finally {
      setExporting(null);
    }
  };

  const columns = useMemo(
    () => (result?.definition.columns ?? []).filter(column => column.visible),
    [result],
  );
  const summaries = useMemo(() => summaryRows(result), [result]);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{
        paddingTop: insets.top + 14,
        paddingBottom: insets.bottom + 30,
        paddingHorizontal: 16,
        gap: 14,
      }}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
    >
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={[styles.eyebrow, { color: colors.primary }]}>COLORJET Bangladesh</Text>
          <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
          <Text style={[styles.meta, { color: colors.mutedForeground }]}>Source: {result?.definition.module ?? reportCode}</Text>
        </View>
        {loading && <ActivityIndicator color={colors.primary} />}
      </View>

      {error && (
        <View style={[styles.errorBox, { backgroundColor: colors.card, borderColor: colors.destructive }]}> 
          <Feather name="alert-circle" size={18} color={colors.destructive} />
          <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
          <TouchableOpacity onPress={() => void load()} style={[styles.retryButton, { backgroundColor: colors.primary }]}> 
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {summaries.length > 0 && (
        <View style={styles.summaryGrid}>
          {summaries.map(item => (
            <View key={item.label} style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}> 
              <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>{item.label}</Text>
              <Text style={[styles.summaryValue, { color: colors.foreground }]}>{item.value}</Text>
            </View>
          ))}
        </View>
      )}

      {result && (
        <View style={styles.exportRow}>
          {(['pdf', 'csv', 'xlsx'] as const).map(format => (
            <TouchableOpacity
              key={format}
              disabled={Boolean(exporting) || !result.definition.exportFormats.includes(format)}
              onPress={() => void handleExport(format)}
              style={[
                styles.exportButton,
                { borderColor: colors.primary, opacity: result.definition.exportFormats.includes(format) ? 1 : 0.35 },
              ]}
            >
              {exporting === format
                ? <ActivityIndicator size="small" color={colors.primary} />
                : <Feather name="download" size={15} color={colors.primary} />}
              <Text style={[styles.exportText, { color: colors.primary }]}>{format.toUpperCase()}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {result && !loading && result.rows.length === 0 && (
        <View style={[styles.emptyBox, { backgroundColor: colors.card, borderColor: colors.border }]}> 
          <Feather name="inbox" size={28} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No matching records</Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>The ERP returned no rows for the selected filters.</Text>
        </View>
      )}

      {(result?.rows ?? []).map((row, index) => (
        <ReportRowCard
          key={`${result?.runId ?? reportCode}-${index}`}
          row={row}
          columns={columns}
          expanded={expandedRows.has(index)}
          onToggle={() => setExpandedRows(previous => {
            const next = new Set(previous);
            if (next.has(index)) next.delete(index); else next.add(index);
            return next;
          })}
        />
      ))}

      {result?.dataFreshness && (
        <Text style={[styles.freshness, { color: colors.mutedForeground }]}>Data freshness: {result.dataFreshness}</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  headerText: { flex: 1 },
  eyebrow: { fontSize: 12, fontFamily: 'Inter_700Bold', textTransform: 'uppercase', letterSpacing: 0.5 },
  title: { fontSize: 24, fontFamily: 'Inter_700Bold', marginTop: 3 },
  meta: { fontSize: 12, fontFamily: 'Inter_500Medium', marginTop: 4 },
  errorBox: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 10, alignItems: 'flex-start' },
  errorText: { fontSize: 13, lineHeight: 19, fontFamily: 'Inter_500Medium' },
  retryButton: { minHeight: 44, borderRadius: 10, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  retryText: { color: '#fff', fontFamily: 'Inter_700Bold' },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  summaryCard: { flexBasis: '47%', flexGrow: 1, minHeight: 88, borderWidth: 1, borderRadius: 14, padding: 12, justifyContent: 'space-between' },
  summaryLabel: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  summaryValue: { fontSize: 18, fontFamily: 'Inter_700Bold', marginTop: 8 },
  exportRow: { flexDirection: 'row', gap: 8 },
  exportButton: { minHeight: 44, flex: 1, borderWidth: 1, borderRadius: 10, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' },
  exportText: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  rowCard: { borderWidth: 1, borderLeftWidth: 4, borderLeftColor: '#0D47A1', borderRadius: 14, padding: 13, gap: 9 },
  dataLine: { gap: 3 },
  primaryLabel: { fontSize: 11, fontFamily: 'Inter_700Bold', textTransform: 'uppercase', letterSpacing: 0.35 },
  primaryValue: { fontSize: 16, lineHeight: 22, fontFamily: 'Inter_700Bold' },
  dataLabel: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  dataValue: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter_500Medium' },
  expandLine: { minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  expandText: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  emptyBox: { borderWidth: 1, borderRadius: 14, padding: 22, alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  emptyText: { fontSize: 13, lineHeight: 19, textAlign: 'center', fontFamily: 'Inter_500Medium' },
  freshness: { textAlign: 'center', fontSize: 11, fontFamily: 'Inter_500Medium', paddingVertical: 8 },
});
