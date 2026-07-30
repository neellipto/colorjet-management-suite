import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

export function AppHeader() {
  return (
    <View style={styles.header}>
      <View style={styles.logoMark}>
        <Text style={styles.logoText}>C</Text>
      </View>
      <View>
        <Text style={styles.title}>COLORJET ERP</Text>
        <Text style={styles.subtitle}>Quality • Commitment • Service</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  logoMark: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center'
  },
  logoText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800'
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800'
  },
  subtitle: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 2
  }
});
