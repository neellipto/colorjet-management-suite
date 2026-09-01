import React, { useState } from 'react';
import { Alert, ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { erpApi } from '@/lib/erpApi';
import { useColors } from '@/hooks/useColors';

export default function ResetPasswordScreen() {
  const colors = useColors();
  const params = useLocalSearchParams<{ token?: string }>();
  const token = Array.isArray(params.token) ? params.token[0] : params.token;
  const [password, setPassword] = useState(''); const [confirmPassword, setConfirmPassword] = useState(''); const [saving, setSaving] = useState(false);
  const updatePassword = async () => {
    if (!token) { Alert.alert('Invalid link', 'Request a new password reset link.'); return; }
    if (password.length < 12) { Alert.alert('Password too short', 'Use at least 12 characters.'); return; }
    if (password !== confirmPassword) { Alert.alert('Passwords do not match', 'Enter the same password in both fields.'); return; }
    setSaving(true);
    try {
      await erpApi.post('/auth/reset-password', { token, new_password: password }, { skipAuthentication: true, retryAfterRefresh: false });
      Alert.alert('Password updated', 'Sign in with your new password.'); router.replace('/login');
    } catch (error: any) { Alert.alert('Unable to update password', error?.message || 'Request a new reset link and try again.'); }
    finally { setSaving(false); }
  };
  return <View style={[styles.container, { backgroundColor: colors.background }]}><View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
    <Text style={[styles.title, { color: colors.foreground }]}>Create New Password</Text>
    {!token ? <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>This reset link is invalid or expired.</Text> : <>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Set a strong password for your COLORJET ERP account.</Text>
      <TextInput style={[styles.input, { color: colors.foreground, borderColor: colors.border }]} placeholder="New password" placeholderTextColor={colors.mutedForeground} secureTextEntry autoCapitalize="none" value={password} onChangeText={setPassword} />
      <TextInput style={[styles.input, { color: colors.foreground, borderColor: colors.border }]} placeholder="Confirm new password" placeholderTextColor={colors.mutedForeground} secureTextEntry autoCapitalize="none" value={confirmPassword} onChangeText={setConfirmPassword} />
      <Pressable style={[styles.button, { backgroundColor: colors.primary }]} onPress={updatePassword} disabled={saving}>{saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Save New Password</Text>}</Pressable>
    </>}
    <Pressable onPress={() => router.replace('/login')}><Text style={[styles.link, { color: colors.primary }]}>Back to Sign In</Text></Pressable>
  </View></View>;
}
const styles = StyleSheet.create({ container: { flex: 1, justifyContent: 'center', padding: 20 }, card: { borderWidth: 1, borderRadius: 16, padding: 22, gap: 14 }, title: { fontSize: 24, fontWeight: '700' }, subtitle: { fontSize: 14, lineHeight: 20 }, input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16 }, button: { minHeight: 50, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }, buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' }, link: { textAlign: 'center', fontSize: 14, fontWeight: '600', paddingVertical: 8 } });
