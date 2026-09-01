import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { login } = useApp();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!identifier.trim() || !password.trim()) {
      Alert.alert('Required', 'Enter your ERP email, phone, or employee code and password.');
      return;
    }
    setLoading(true);
    const ok = await login(identifier.trim(), password);
    setLoading(false);
    if (ok) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/(tabs)');
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Login Failed', 'Your ERP credentials could not be verified.');
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.primary }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 0), paddingBottom: insets.bottom + 40 }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.logoBox}><Feather name="printer" size={32} color="#1A237E" /></View>
          <Text style={styles.brand}>COLORJET</Text>
          <Text style={styles.subtitle}>Business Management System</Text>
          <Text style={styles.tagline}>Bangladesh · ERP v2.0</Text>
        </View>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>Sign In</Text>
          <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>Enter your COLORJET ERP credentials.</Text>
          <View style={[styles.inputWrap, { borderColor: colors.border }]}>
            <Feather name="user" size={16} color={colors.mutedForeground} />
            <TextInput style={[styles.input, { color: colors.foreground, fontFamily: 'Inter_400Regular' }]} value={identifier} onChangeText={setIdentifier} placeholder="Email, phone, or employee code" placeholderTextColor={colors.mutedForeground} autoCapitalize="none" autoCorrect={false} />
          </View>
          <View style={[styles.inputWrap, { borderColor: colors.border }]}>
            <Feather name="lock" size={16} color={colors.mutedForeground} />
            <TextInput style={[styles.input, { color: colors.foreground, fontFamily: 'Inter_400Regular' }]} value={password} onChangeText={setPassword} placeholder="Password" placeholderTextColor={colors.mutedForeground} secureTextEntry={!showPassword} autoCapitalize="none" autoCorrect={false} onSubmitEditing={handleLogin} />
            <TouchableOpacity onPress={() => setShowPassword(value => !value)} style={styles.eyeBtn}><Feather name={showPassword ? 'eye-off' : 'eye'} size={16} color={colors.mutedForeground} /></TouchableOpacity>
          </View>
          <TouchableOpacity style={[styles.loginBtn, { backgroundColor: colors.primary }]} onPress={handleLogin} activeOpacity={0.85} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.loginBtnText}>Sign In</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/forgot-password')} disabled={loading}><Text style={[styles.forgotText, { color: colors.primary }]}>Forgot Password?</Text></TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingHorizontal: 20, gap: 20 }, header: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  logoBox: { width: 72, height: 72, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 6 },
  brand: { fontSize: 28, fontFamily: 'Inter_700Bold', color: '#fff', letterSpacing: 2 }, subtitle: { fontSize: 13, fontFamily: 'Inter_500Medium', color: 'rgba(255,255,255,0.85)' }, tagline: { fontSize: 11, fontFamily: 'Inter_400Regular', color: 'rgba(255,255,255,0.6)' },
  card: { borderRadius: 16, padding: 24, gap: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 },
  cardTitle: { fontSize: 20, fontFamily: 'Inter_700Bold' }, cardSub: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: -6 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, gap: 8 },
  input: { flex: 1, fontSize: 15, padding: 0 }, eyeBtn: { padding: 2 },
  loginBtn: { borderRadius: 12, paddingVertical: 15, alignItems: 'center', shadowColor: '#1A237E', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 4 },
  loginBtnText: { fontSize: 16, fontFamily: 'Inter_700Bold', color: '#fff', letterSpacing: 0.3 }, forgotText: { textAlign: 'center', fontSize: 14, fontFamily: 'Inter_700Bold', paddingVertical: 2 },
});
