import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';

export default function TabLayout() {
  const colors = useColors();
  const { currentUser } = useApp();
  const role = currentUser?.role ?? 'customer';

  const isAdmin = role === 'admin' || role === 'manager';
  const isEngineer = role === 'engineer';
  const isMarketing = role === 'marketing' || role === 'sales';
  const isStore = role === 'store';
  const isCustomer = role === 'customer';
  const isServiceControl = role === 'service_control';

  const showSales = !isEngineer && !isStore && !isServiceControl;
  const showService = isAdmin || isEngineer || isCustomer || isServiceControl;
  const showInventory = isAdmin || isStore;

  const salesTitle = isCustomer ? 'Invoices' : isMarketing ? 'Tasks' : 'Sales';
  const serviceTitle = isCustomer ? 'My Service' : isEngineer ? 'My Jobs' : 'Tickets';

  const isIOS = Platform.OS === 'ios';
  const isDark = false;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        headerShown: true,
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: '#fff',
        headerTitleStyle: { fontFamily: 'Inter_600SemiBold', fontSize: 17 },
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: isIOS ? 'transparent' : colors.card,
          borderTopWidth: 0,
          elevation: 0,
          height: Platform.OS === 'web' ? 84 : 60,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
        },
        tabBarLabelStyle: { fontFamily: 'Inter_500Medium', fontSize: 10, marginBottom: Platform.OS === 'web' ? 8 : 0 },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView intensity={100} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.card }]} />
          ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => <Feather name="grid" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="sales"
        options={{
          href: showSales ? undefined : null,
          title: salesTitle,
          tabBarIcon: ({ color, size }) => <Feather name={isMarketing ? 'clipboard' : 'file-text'} size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="service"
        options={{
          href: showService ? undefined : null,
          title: serviceTitle,
          tabBarIcon: ({ color, size }) => <Feather name="tool" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="inventory"
        options={{
          href: showInventory ? undefined : null,
          title: 'Stock',
          tabBarIcon: ({ color, size }) => <Feather name="package" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarIcon: ({ color, size }) => <Feather name="menu" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({});
