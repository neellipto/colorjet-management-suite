import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

export function ModuleButton({ title, onPress }: { title: string; onPress?: () => void }) {
  return (
    <Pressable style={styles.button} onPress={onPress}>
      <Text style={styles.text}>{title}</Text>
      <Text style={styles.arrow}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 54,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  text: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700'
  },
  arrow: {
    color: colors.primary,
    fontSize: 28,
    fontWeight: '700'
  }
});
