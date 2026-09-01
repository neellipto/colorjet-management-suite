import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AppProvider } from "@/context/AppContext";
import { ErpRuntimeProvider } from "@/context/ErpRuntimeContext";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: 1,
    },
  },
});

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerBackTitle: "Back", headerTintColor: "#1A237E" }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="forgot-password" options={{ headerShown: false }} />
      <Stack.Screen name="reset-password" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="invoice/[id]" options={{ title: "Invoice Detail", headerBackTitle: "Back" }} />
      <Stack.Screen name="ticket/[id]" options={{ title: "Job Detail", headerBackTitle: "Back" }} />
      <Stack.Screen name="ticket/report/[id]" options={{ title: "Service Report", headerBackTitle: "Back" }} />
      <Stack.Screen name="customer/[id]" options={{ title: "Customer", headerBackTitle: "Back" }} />
      <Stack.Screen name="reports" options={{ title: "Reports", headerBackTitle: "Back" }} />
      <Stack.Screen name="report" options={{ title: "Report Detail", headerBackTitle: "Back" }} />
      <Stack.Screen name="expenses" options={{ title: "Expenses", headerBackTitle: "Back" }} />
      <Stack.Screen name="delivery" options={{ title: "Deliveries", headerBackTitle: "Back" }} />
      <Stack.Screen name="profile" options={{ title: "My Profile", headerBackTitle: "Back" }} />
      <Stack.Screen name="attendance" options={{ title: "My Attendance", headerBackTitle: "Back" }} />
      <Stack.Screen name="notifications" options={{ title: "Notifications", headerBackTitle: "Back" }} />
      <Stack.Screen name="schedule" options={{ title: "Engineer Schedule", headerBackTitle: "Back" }} />
      <Stack.Screen name="service-control" options={{ title: "Service Control", headerBackTitle: "Back" }} />
      <Stack.Screen name="owner-command-center" options={{ title: "Owner Command Center", headerBackTitle: "Back" }} />
      <Stack.Screen name="owner-ai" options={{ title: "Owner AI", headerBackTitle: "Back" }} />
      <Stack.Screen name="manual-registers" options={{ title: "Manual Registers", headerBackTitle: "Back" }} />
      <Stack.Screen name="admin/company" options={{ title: "Company Profile", headerBackTitle: "Back" }} />
      <Stack.Screen name="admin/branding" options={{ title: "Branding", headerBackTitle: "Back" }} />
      <Stack.Screen name="admin/catalog" options={{ title: "Catalog & Categories", headerBackTitle: "Back" }} />
      <Stack.Screen name="admin/users" options={{ title: "User Management", headerBackTitle: "Back" }} />
      <Stack.Screen name="admin/engineers" options={{ title: "Engineer Management", headerBackTitle: "Back" }} />
      <Stack.Screen name="admin/integrations" options={{ title: "Integrations", headerBackTitle: "Back" }} />
      <Stack.Screen name="admin/notifications" options={{ title: "Notification Settings", headerBackTitle: "Back" }} />
      <Stack.Screen name="user/[id]" options={{ title: "User Detail", headerBackTitle: "Back" }} />
      <Stack.Screen name="engineer/[id]" options={{ title: "Engineer Profile", headerBackTitle: "Back" }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <ErpRuntimeProvider>
            <AppProvider>
              <GestureHandlerRootView style={{ flex: 1 }}>
                <KeyboardProvider>
                  <RootLayoutNav />
                </KeyboardProvider>
              </GestureHandlerRootView>
            </AppProvider>
          </ErpRuntimeProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
