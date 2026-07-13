import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { Stack } from 'expo-router';
import * as TaskManager from 'expo-task-manager';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Linking,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';

const LOCATION_TASK = 'COLORJET_DUTY_ROUTE_LOCATION';
const CURRENT_SESSION_KEY = '@colorjet/attendance/current-session';
const SESSION_HISTORY_KEY = '@colorjet/attendance/session-history';
const ROUTE_POINTS_KEY = '@colorjet/attendance/route-points';

interface DutySession {
  id: string;
  employeeId?: string;
  employeeName: string;
  employeeCode?: string;
  checkInAt: string;
  checkOutAt?: string;
  pointCount: number;
  startLatitude?: number;
  startLongitude?: number;
  endLatitude?: number;
  endLongitude?: number;
  status: 'active' | 'completed';
}

interface RoutePoint {
  id: string;
  sessionId: string;
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  altitude?: number | null;
  speed?: number | null;
  recordedAt: string;
  source: string;
}

async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

async function appendRouteLocations(locations: Location.LocationObject[]): Promise<void> {
  const current = await readJson<DutySession | null>(CURRENT_SESSION_KEY, null);
  if (!current || current.status !== 'active') return;
  const stored = await readJson<RoutePoint[]>(ROUTE_POINTS_KEY, []);
  const incoming: RoutePoint[] = locations.map(location => ({
    id: `${current.id}-${location.timestamp}-${Math.random().toString(36).slice(2, 7)}`,
    sessionId: current.id,
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    accuracy: location.coords.accuracy,
    altitude: location.coords.altitude,
    speed: location.coords.speed,
    recordedAt: new Date(location.timestamp).toISOString(),
    source: location.mocked ? 'mock' : 'gps',
  }));
  const nextPoints = [...stored, ...incoming].slice(-10000);
  await AsyncStorage.setItem(ROUTE_POINTS_KEY, JSON.stringify(nextPoints));
  const nextSession: DutySession = {
    ...current,
    pointCount: current.pointCount + incoming.length,
    startLatitude: current.startLatitude ?? incoming[0]?.latitude,
    startLongitude: current.startLongitude ?? incoming[0]?.longitude,
  };
  await AsyncStorage.setItem(CURRENT_SESSION_KEY, JSON.stringify(nextSession));
}

if (!TaskManager.isTaskDefined(LOCATION_TASK)) {
  TaskManager.defineTask(LOCATION_TASK, async ({ data, error }: any) => {
    if (error || !data?.locations?.length) return;
    await appendRouteLocations(data.locations as Location.LocationObject[]);
  });
}

function formatDateTime(value?: string): string {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString([], {
      year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return value;
  }
}

function duration(start: string, end?: string): string {
  const endTime = end ? new Date(end).getTime() : Date.now();
  const minutes = Math.max(0, Math.round((endTime - new Date(start).getTime()) / 60000));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${hours}h ${rest}m`;
}

export default function AttendanceScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { currentUser } = useApp();
  const [current, setCurrent] = useState<DutySession | null>(null);
  const [history, setHistory] = useState<DutySession[]>([]);
  const [points, setPoints] = useState<RoutePoint[]>([]);
  const [permission, setPermission] = useState('Checking');
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [active, sessions, route, foreground, background, tracking] = await Promise.all([
      readJson<DutySession | null>(CURRENT_SESSION_KEY, null),
      readJson<DutySession[]>(SESSION_HISTORY_KEY, []),
      readJson<RoutePoint[]>(ROUTE_POINTS_KEY, []),
      Location.getForegroundPermissionsAsync(),
      Location.getBackgroundPermissionsAsync(),
      Location.hasStartedLocationUpdatesAsync(LOCATION_TASK).catch(() => false),
    ]);
    setCurrent(active?.status === 'active' ? active : null);
    setHistory(sessions);
    setPoints(route);
    setPermission(`${foreground.status === 'granted' ? 'Foreground ✓' : 'Foreground required'} • ${background.status === 'granted' ? 'Background ✓' : 'Background required'} • ${tracking ? 'Tracking active' : 'Tracking stopped'}`);
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 15000);
    return () => clearInterval(timer);
  }, [load]);

  const requestPermissions = async (): Promise<boolean> => {
    const servicesEnabled = await Location.hasServicesEnabledAsync();
    if (!servicesEnabled) {
      Alert.alert('Location is turned off', 'Enable GPS/Location on the device before starting duty.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Settings', onPress: () => void Linking.openSettings() },
      ]);
      return false;
    }

    const foreground = await Location.requestForegroundPermissionsAsync();
    if (foreground.status !== 'granted') {
      Alert.alert('Permission required', 'Precise location permission is required for attendance and customer-visit route history.');
      return false;
    }

    const background = await Location.requestBackgroundPermissionsAsync();
    if (background.status !== 'granted') {
      Alert.alert(
        'Allow all the time',
        'Open App permissions → Location and choose “Allow all the time”. COLORJET records location only while an active duty session is running.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => void Linking.openSettings() },
        ],
      );
      return false;
    }
    return true;
  };

  const checkIn = async () => {
    if (current) {
      Alert.alert('Duty already active', `Checked in at ${formatDateTime(current.checkInAt)}.`);
      return;
    }
    setBusy(true);
    try {
      if (!await requestPermissions()) return;
      const now = new Date().toISOString();
      const initialLocation = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const session: DutySession = {
        id: `DUTY-${Date.now()}`,
        employeeId: currentUser?.id,
        employeeName: currentUser?.name ?? 'COLORJET Employee',
        employeeCode: currentUser?.employeeCode,
        checkInAt: now,
        pointCount: 1,
        startLatitude: initialLocation.coords.latitude,
        startLongitude: initialLocation.coords.longitude,
        status: 'active',
      };
      await AsyncStorage.setItem(CURRENT_SESSION_KEY, JSON.stringify(session));
      await appendRouteLocations([initialLocation]);

      const started = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK);
      if (!started) {
        await Location.startLocationUpdatesAsync(LOCATION_TASK, {
          accuracy: Location.Accuracy.High,
          timeInterval: 30000,
          distanceInterval: 25,
          deferredUpdatesInterval: 30000,
          pausesUpdatesAutomatically: false,
          showsBackgroundLocationIndicator: true,
          foregroundService: {
            notificationTitle: 'COLORJET Duty Route',
            notificationBody: 'Attendance route tracking is active.',
            notificationColor: '#1A237E',
          },
        });
      }
      await load();
      Alert.alert('Duty started', 'Check-in recorded and background route tracking started.');
    } catch (error) {
      Alert.alert('Unable to start duty', error instanceof Error ? error.message : 'Location tracking could not be started.');
    } finally {
      setBusy(false);
    }
  };

  const checkOut = async () => {
    if (!current) {
      Alert.alert('No active duty', 'Start duty before attempting check-out.');
      return;
    }
    setBusy(true);
    try {
      let endLocation: Location.LocationObject | null = null;
      try {
        endLocation = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        await appendRouteLocations([endLocation]);
      } catch {
        endLocation = null;
      }

      const completed: DutySession = {
        ...current,
        checkOutAt: new Date().toISOString(),
        endLatitude: endLocation?.coords.latitude,
        endLongitude: endLocation?.coords.longitude,
        status: 'completed',
      };
      const sessions = await readJson<DutySession[]>(SESSION_HISTORY_KEY, []);
      await AsyncStorage.setItem(SESSION_HISTORY_KEY, JSON.stringify([completed, ...sessions].slice(0, 365)));
      await AsyncStorage.removeItem(CURRENT_SESSION_KEY);
      if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)) {
        await Location.stopLocationUpdatesAsync(LOCATION_TASK);
      }
      await load();
      Alert.alert('Duty completed', `Check-out recorded. Total duration: ${duration(completed.checkInAt, completed.checkOutAt)}.`);
    } catch (error) {
      Alert.alert('Unable to stop duty', error instanceof Error ? error.message : 'Check-out could not be completed.');
    } finally {
      setBusy(false);
    }
  };

  const clearHistory = () => {
    Alert.alert('Clear route history?', 'Completed duty sessions and stored route points will be removed from this device. Active duty will not be deleted.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear', style: 'destructive', onPress: async () => {
          await AsyncStorage.multiRemove([SESSION_HISTORY_KEY, ROUTE_POINTS_KEY]);
          await load();
        },
      },
    ]);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const activePoints = current ? points.filter(point => point.sessionId === current.id) : [];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: 'Attendance & Duty Route' }} />
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 36, gap: 12 }}
      >
        <View style={[styles.hero, { backgroundColor: colors.primary }]}>
          <View style={styles.heroIcon}><Feather name="navigation" size={27} color="#fff" /></View>
          <View style={styles.heroText}>
            <Text style={styles.heroTitle}>Attendance & Live Duty Route</Text>
            <Text style={styles.heroSubtitle}>Check-in, background route history and customer-visit tracking</Text>
          </View>
        </View>

        <View style={[styles.permissionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="shield" size={18} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.permissionTitle, { color: colors.foreground }]}>Android Permission Status</Text>
            <Text style={[styles.permissionText, { color: colors.mutedForeground }]}>{permission}</Text>
          </View>
          <TouchableOpacity onPress={() => void Linking.openSettings()}><Feather name="settings" size={19} color={colors.primary} /></TouchableOpacity>
        </View>

        {current ? (
          <View style={[styles.activeCard, { backgroundColor: '#E8F5E9', borderColor: '#A5D6A7' }]}>
            <View style={styles.activeHeader}>
              <View style={[styles.liveDot, { backgroundColor: '#2E7D32' }]} />
              <Text style={styles.activeTitle}>DUTY ACTIVE</Text>
              <Text style={styles.activeDuration}>{duration(current.checkInAt)}</Text>
            </View>
            <Text style={[styles.employeeName, { color: colors.foreground }]}>{current.employeeName}</Text>
            <Text style={[styles.meta, { color: colors.mutedForeground }]}>{current.employeeCode || 'Employee'} • Check-in: {formatDateTime(current.checkInAt)}</Text>
            <View style={styles.statsRow}>
              <View style={styles.stat}><Text style={styles.statValue}>{activePoints.length}</Text><Text style={styles.statLabel}>Route Points</Text></View>
              <View style={styles.stat}><Text style={styles.statValue}>{current.startLatitude?.toFixed(5) ?? '—'}</Text><Text style={styles.statLabel}>Start Latitude</Text></View>
              <View style={styles.stat}><Text style={styles.statValue}>{current.startLongitude?.toFixed(5) ?? '—'}</Text><Text style={styles.statLabel}>Start Longitude</Text></View>
            </View>
            <TouchableOpacity disabled={busy} style={[styles.checkoutButton, { opacity: busy ? 0.6 : 1 }]} onPress={() => void checkOut()}>
              <Feather name="log-out" size={18} color="#fff" />
              <Text style={styles.buttonText}>{busy ? 'Completing…' : 'Check Out & Stop Route'}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[styles.inactiveCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.clockIcon, { backgroundColor: colors.navyLight }]}><Feather name="clock" size={30} color={colors.primary} /></View>
            <Text style={[styles.inactiveTitle, { color: colors.foreground }]}>Ready to start duty</Text>
            <Text style={[styles.inactiveText, { color: colors.mutedForeground }]}>Check-in records the current position and starts Android foreground/background location tracking.</Text>
            <TouchableOpacity disabled={busy} style={[styles.checkinButton, { backgroundColor: colors.primary, opacity: busy ? 0.6 : 1 }]} onPress={() => void checkIn()}>
              <Feather name="log-in" size={18} color="#fff" />
              <Text style={styles.buttonText}>{busy ? 'Starting…' : 'Check In & Start Route'}</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Recent Duty Sessions</Text>
          {history.length ? <TouchableOpacity onPress={clearHistory}><Text style={[styles.clearText, { color: colors.destructive }]}>Clear</Text></TouchableOpacity> : null}
        </View>

        {history.length ? history.slice(0, 20).map(session => {
          const routeCount = points.filter(point => point.sessionId === session.id).length;
          return (
            <View key={session.id} style={[styles.sessionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.sessionIcon, { backgroundColor: colors.navyLight }]}><Feather name="map-pin" size={18} color={colors.primary} /></View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={[styles.sessionName, { color: colors.foreground }]}>{session.employeeName}</Text>
                <Text style={[styles.sessionMeta, { color: colors.mutedForeground }]}>{formatDateTime(session.checkInAt)} → {formatDateTime(session.checkOutAt)}</Text>
                <Text style={[styles.sessionMeta, { color: colors.mutedForeground }]}>{duration(session.checkInAt, session.checkOutAt)} • {routeCount || session.pointCount} route points</Text>
              </View>
              <Feather name="check-circle" size={19} color="#2E7D32" />
            </View>
          );
        }) : (
          <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="map" size={36} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No completed duty session is stored on this device.</Text>
          </View>
        )}

        <View style={[styles.infoCard, { backgroundColor: colors.orangeLight, borderColor: '#FFE0B2' }]}>
          <Feather name="info" size={18} color={colors.secondary} />
          <Text style={[styles.infoText, { color: colors.foreground }]}>Location is collected only after Check In and stops after Check Out. Android shows a persistent notification while tracking is active.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  hero: { borderRadius: 18, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 14 },
  heroIcon: { width: 52, height: 52, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.18)' },
  heroText: { flex: 1, gap: 4 },
  heroTitle: { color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 18 },
  heroSubtitle: { color: 'rgba(255,255,255,0.82)', fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 17 },
  permissionCard: { borderRadius: 13, borderWidth: 1, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 11 },
  permissionTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  permissionText: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16, marginTop: 2 },
  activeCard: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 8 },
  activeHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  liveDot: { width: 10, height: 10, borderRadius: 5 },
  activeTitle: { color: '#2E7D32', fontFamily: 'Inter_700Bold', fontSize: 12, letterSpacing: 0.8, flex: 1 },
  activeDuration: { color: '#2E7D32', fontFamily: 'Inter_700Bold', fontSize: 15 },
  employeeName: { fontFamily: 'Inter_700Bold', fontSize: 18, marginTop: 4 },
  meta: { fontFamily: 'Inter_400Regular', fontSize: 12 },
  statsRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  stat: { flex: 1, padding: 10, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.72)' },
  statValue: { color: '#1B5E20', fontFamily: 'Inter_700Bold', fontSize: 13 },
  statLabel: { color: '#558B2F', fontFamily: 'Inter_400Regular', fontSize: 9, marginTop: 2 },
  checkoutButton: { height: 50, borderRadius: 12, backgroundColor: '#C62828', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 7 },
  inactiveCard: { borderRadius: 16, borderWidth: 1, padding: 22, alignItems: 'center', gap: 10 },
  clockIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  inactiveTitle: { fontFamily: 'Inter_700Bold', fontSize: 18 },
  inactiveText: { fontFamily: 'Inter_400Regular', fontSize: 12, textAlign: 'center', lineHeight: 18 },
  checkinButton: { height: 50, alignSelf: 'stretch', borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 6 },
  buttonText: { color: '#fff', fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 5 },
  sectionTitle: { fontFamily: 'Inter_700Bold', fontSize: 16 },
  clearText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  sessionCard: { borderRadius: 13, borderWidth: 1, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 11 },
  sessionIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  sessionName: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  sessionMeta: { fontFamily: 'Inter_400Regular', fontSize: 11 },
  emptyCard: { borderRadius: 13, borderWidth: 1, padding: 26, alignItems: 'center', gap: 8 },
  emptyText: { fontFamily: 'Inter_400Regular', fontSize: 12, textAlign: 'center', lineHeight: 17 },
  infoCard: { borderRadius: 13, borderWidth: 1, padding: 13, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  infoText: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 17 },
});
