import React, { useState } from 'react';
import { Alert, ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';

export default function ForgotPasswordScreen() {
  const colors = useColors();
  const { requestPasswordReset } = useApp();
  const [identifier, setIdentifier] = useState('');
  const [sending, setSending] = useState(false);
  const sendReset = async () => {
    if (!identifier.trim()) { Alert.alert('Account required', 'Enter your ERP email, phone, or employee code.'); return; }
    setSending(true);
    const ok = await requestPasswordReset(identifier.trim());
    setSending(false);
    Alert.alert(ok ? 'Request sent' : 'Unable to reset password', ok ? 'Follow the reset instructions sent by the ERP server.' : 'Check the account identifier and try again.');
  };
  return <View style={[styles.container, { backgroundColor: colors.background }]}><View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
    <Text style={[styles.title, { color: colors.foreground }]}>Reset Password</Text>
    <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Enter your COLORJET ERP account identifier.</Text>
    <TextInput style={[styles.input, { color: colors.foreground, borderColor: colors.border }]} placeholder="Email, phone, or employee code" placeholderTextColor={colors.mutedForeground} autoCapitalize="none" autoCorrect={false} value={identifier} onChangeText={setIdentifier} />
    <Pressable style={[styles.button, { backgroundColor: colors.primary }]} onPress={sendReset} disabled={sending}>{sending ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Request Password Reset</Text>}</Pressable>
    <Pressable onPress={() => router.replace('/login')}><Text style={[styles.link, { color: colors.primary }]}>Back to Sign In</Text></Pressable>
  </View></View>;
}
const styles = StyleSheet.create({ container: { flex: 1, justifyContent: 'center', padding: 20 }, card: { borderWidth: 1, borderRadius: 16, padding: 22, gap: 14 }, title: { fontSize: 24, fontWeight: '700' }, subtitle: { fontSize: 14, lineHeight: 20 }, input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16 }, button: { minHeight: 50, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }, buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' }, link: { textAlign: 'center', fontSize: 14, fontWeight: '600', paddingVertical: 8 } });
