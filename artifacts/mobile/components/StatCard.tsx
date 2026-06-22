import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';

interface StatCardProps {
  label: string;
  value: string;
  subLabel?: string;
  accent?: 'primary' | 'orange' | 'success' | 'warning' | 'error';
  flex?: number;
}

export function StatCard({ label, value, subLabel, accent = 'primary', flex = 1 }: StatCardProps) {
  const colors = useColors();

  const accentColors: Record<string, string> = {
    primary: colors.primary,
    orange: colors.secondary,
    success: colors.success,
    warning: colors.warning,
    error: colors.destructive,
  };

  const bg: Record<string, string> = {
    primary: colors.navyLight,
    orange: colors.orangeLight,
    success: '#E8F5E9',
    warning: '#FFF8E1',
    error: '#FFEBEE',
  };

  const accentColor = accentColors[accent] ?? colors.primary;
  const bgColor = bg[accent] ?? colors.navyLight;

  return (
    <View style={[styles.card, { flex, backgroundColor: colors.card, borderLeftColor: accentColor }]}>
      <Text style={[styles.label, { color: colors.mutedForeground }]} numberOfLines={1}>{label}</Text>
      <Text style={[styles.value, { color: accentColor }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      {subLabel ? <Text style={[styles.sub, { color: colors.mutedForeground }]} numberOfLines={1}>{subLabel}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderLeftWidth: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    minWidth: 0,
  },
  label: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    letterSpacing: 0.2,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  value: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    letterSpacing: -0.5,
  },
  sub: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
  },
});
