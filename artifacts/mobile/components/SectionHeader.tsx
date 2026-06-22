import { Feather } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useColors } from '@/hooks/useColors';

interface SectionHeaderProps {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  count?: number;
}

export function SectionHeader({ title, actionLabel, onAction, count }: SectionHeaderProps) {
  const colors = useColors();
  return (
    <View style={styles.row}>
      <View style={styles.left}>
        <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
        {count !== undefined ? (
          <View style={[styles.countBadge, { backgroundColor: colors.navyLight }]}>
            <Text style={[styles.count, { color: colors.primary }]}>{count}</Text>
          </View>
        ) : null}
      </View>
      {actionLabel && onAction ? (
        <TouchableOpacity style={styles.action} onPress={onAction} activeOpacity={0.7}>
          <Text style={[styles.actionText, { color: colors.primary }]}>{actionLabel}</Text>
          <Feather name="chevron-right" size={14} color={colors.primary} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
  countBadge: {
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 1,
  },
  count: {
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  actionText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
});
