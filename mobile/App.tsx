import React from 'react';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { DashboardScreen } from './src/screens/DashboardScreen';

export default function App() {
  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1 }}>
        <StatusBar style="dark" />
        <DashboardScreen />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
