import React, { useState } from 'react';
import { Alert, ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { getSupabase } from '@/lib/supabaseClient';
import { useColors } from '@/hooks/useColors';

export default function ForgotPasswordScreen() {
  const colors = useColors();
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);

  const sendReset = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      Alert.alert('Email required', 'Enter the email address for your COLORJET account.');
      return;
    }
    setSending(true);
    try {
      const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/reset-password` : undefined;
      const { error } = await getSupabase().auth.resetPasswordForEmail(cleanEmail, { redirectTo });
      if (error) throw error;
      Alert.alert('Email sent', 'Open the newest password-reset email once, then set your new password.');
    } catch (error: any) {
      Alert.alert('Unable to send reset email', error?.message || 'Please check the email address and try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Reset Password</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Enter your official email. We will send a secure password reset link.</Text>
        <TextInput
          style={[styles.input, { color: colors.foreground, borderColor: colors.border }]}
          placeholder="Email address"
          placeholderTextColor={colors.mutedForeground}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <Pressable style={[styles.button, { backgroundColor: colors.primary }]} onPress={sendReset} disabled={sending}>
          {sending ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Send Reset Email</Text>}
        </Pressable>
        <Pressable onPress={() => router.replace('/login')}><Text style={[styles.link, { color: colors.primary }]}>Back to Sign In</Text></Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 20 },
  card: { borderWidth: 1, borderRadius: 16, padding: 22, gap: 14 },
  title: { fontSize: 24, fontWeight: '700' },
  subtitle: { fontSize: 14, lineHeight: 20 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16 },
  button: { minHeight: 50, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  link: { textAlign: 'center', fontSize: 14, fontWeight: '600', paddingVertical: 8 },
});
