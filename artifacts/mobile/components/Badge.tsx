import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'orange' | 'navy';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
}

const variantStyles: Record<BadgeVariant, { bg: string; text: string }> = {
  success:  { bg: '#E8F5E9', text: '#2E7D32' },
  warning:  { bg: '#FFF8E1', text: '#F57F17' },
  error:    { bg: '#FFEBEE', text: '#C62828' },
  info:     { bg: '#E3F2FD', text: '#1565C0' },
  neutral:  { bg: '#F5F5F5', text: '#616161' },
  orange:   { bg: '#FFF3E0', text: '#E65100' },
  navy:     { bg: '#E8EAF6', text: '#1A237E' },
};

export function Badge({ label, variant = 'neutral', size = 'sm' }: BadgeProps) {
  const { bg, text } = variantStyles[variant];
  return (
    <View style={[styles.badge, { backgroundColor: bg }, size === 'md' && styles.badgeMd]}>
      <Text style={[styles.text, { color: text }, size === 'md' && styles.textMd]}>{label}</Text>
    </View>
  );
}

export function statusBadge(status: string): BadgeVariant {
  switch (status) {
    case 'paid':
    case 'completed':
    case 'delivered':
    case 'done':
    case 'available':
    case 'configured':
      return 'success';
    case 'partial':
    case 'in_progress':
    case 'out_for_delivery':
    case 'accepted':
    case 'on_the_way':
    case 'busy':
    case 'on_job':
      return 'warning';
    case 'posted':
    case 'pending':
    case 'assigned':
    case 'planned':
      return 'info';
    case 'cancelled':
    case 'overdue':
    case 'waiting_parts':
    case 'revisit':
    case 'leave':
      return 'error';
    case 'pending_customer':
      return 'orange';
    case 'draft':
    case 'offline':
    case 'not_configured':
      return 'neutral';
    case 'emergency':
      return 'error';
    case 'high':
      return 'orange';
    case 'normal':
      return 'info';
    case 'low':
      return 'neutral';
    default:
      return 'neutral';
  }
}

export function statusLabel(status: string): string {
  const map: Record<string, string> = {
    in_progress: 'In Progress',
    out_for_delivery: 'Out for Delivery',
    purchase_in: 'Purchase In',
    sale_out: 'Sale Out',
    service_use: 'Service Use',
    delivery_support: 'Delivery Support',
    on_the_way: 'On the Way',
    waiting_parts: 'Waiting Parts',
    pending_customer: 'Pending Customer',
    on_job: 'On Job',
    not_configured: 'Not Configured',
    in_warranty: 'In Warranty',
    out_warranty: 'Out of Warranty',
  };
  return map[status] ?? status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ');
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  badgeMd: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  text: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
  },
  textMd: {
    fontSize: 13,
  },
});
