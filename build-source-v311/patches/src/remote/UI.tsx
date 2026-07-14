import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from './theme';

export function Card({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

export function Badge({ children, tone = 'blue' }: { children: React.ReactNode; tone?: 'blue' | 'green' | 'amber' | 'red' | 'grey' }) {
  return (
    <View style={[styles.badge, styles[tone]]}>
      <Text style={[styles.badgeText, tone === 'blue' ? { color: theme.colors.sky } : tone === 'green' ? { color: theme.colors.green } : tone === 'red' ? { color: theme.colors.red } : tone === 'amber' ? { color: theme.colors.amber } : { color: theme.colors.muted }]}>
        {children}
      </Text>
    </View>
  );
}

export function Button({ title, onPress, loading = false, variant = 'primary' }: { title: string; onPress: () => void; loading?: boolean; variant?: 'primary' | 'outline' | 'danger' }) {
  return (
    <Pressable onPress={onPress} disabled={loading} style={[styles.button, variant === 'outline' && styles.outline, variant === 'danger' && styles.danger]}>
      {loading ? <ActivityIndicator color="#fff" /> : <Text style={[styles.buttonText, variant === 'outline' && styles.outlineText]}>{title}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: theme.colors.border, padding: 14, marginBottom: 12 },
  badge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, alignSelf: 'flex-start' },
  badgeText: { fontWeight: '700', fontSize: 11 },
  blue: { backgroundColor: '#EFF8FD' },
  green: { backgroundColor: '#E9F7EF' },
  amber: { backgroundColor: '#FFF6D8' },
  red: { backgroundColor: '#FDEDEC' },
  grey: { backgroundColor: '#F2F4F6' },
  button: { backgroundColor: theme.colors.sky, paddingVertical: 13, paddingHorizontal: 16, borderRadius: 10, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#fff', fontWeight: '800' },
  outline: { backgroundColor: '#fff', borderWidth: 1, borderColor: theme.colors.sky },
  outlineText: { color: theme.colors.sky },
  danger: { backgroundColor: theme.colors.red },
});
