import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import { getSupabase } from '@/lib/supabaseClient';

export const FIELD_LOCATION_TASK = 'colorjet-field-location-v12';

const ACTIVE_TRACKING_KEY = 'colorjet.v12.activeTracking';
const PENDING_POINTS_KEY = 'colorjet.v12.pendingLocationPoints';
const INSTALLATION_ID_KEY = 'colorjet.v12.installationId';
const MAX_PENDING_POINTS = 3000;

export interface ActiveTrackingState {
  sessionId: string;
  visitId: string;
  userId: string;
  deviceId: string;
  startedAt: string;
}

interface PendingLocationPoint {
  sessionId: string;
  latitude: number;
  longitude: number;
  accuracyM: number | null;
  speedMps: number | null;
  bearingDeg: number | null;
  altitudeM: number | null;
  isMock: boolean;
  capturedAt: string;
  idempotencyKey: string;
}

function randomId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

export async function getInstallationId(): Promise<string> {
  const existing = await AsyncStorage.getItem(INSTALLATION_ID_KEY);
  if (existing) return existing;

  const model = (Device.modelName || Device.deviceName || Platform.OS || 'device')
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .slice(0, 40);
  const value = `${model}-${randomId('install')}`;
  await AsyncStorage.setItem(INSTALLATION_ID_KEY, value);
  return value;
}

async function readPendingPoints(): Promise<PendingLocationPoint[]> {
  const raw = await AsyncStorage.getItem(PENDING_POINTS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as PendingLocationPoint[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function savePendingPoints(points: PendingLocationPoint[]): Promise<void> {
  await AsyncStorage.setItem(PENDING_POINTS_KEY, JSON.stringify(points.slice(-MAX_PENDING_POINTS)));
}

async function queuePoint(point: PendingLocationPoint): Promise<void> {
  const current = await readPendingPoints();
  if (current.some(item => item.idempotencyKey === point.idempotencyKey)) return;
  current.push(point);
  await savePendingPoints(current);
}

async function sendPoint(point: PendingLocationPoint): Promise<void> {
  const { error } = await getSupabase().rpc('v12_append_location', {
    p_session_id: point.sessionId,
    p_latitude: point.latitude,
    p_longitude: point.longitude,
    p_accuracy_m: point.accuracyM,
    p_speed_mps: point.speedMps,
    p_bearing_deg: point.bearingDeg,
    p_altitude_m: point.altitudeM,
    p_is_mock: point.isMock,
    p_captured_at: point.capturedAt,
    p_idempotency_key: point.idempotencyKey,
    p_battery_percent: null,
    p_network_type: null,
    p_metadata: {
      platform: Platform.OS,
      deviceModel: Device.modelName,
      appOwnedTracking: true,
    },
  });
  if (error) throw new Error(error.message);
}

export async function flushPendingLocationPoints(): Promise<{ sent: number; remaining: number }> {
  const pending = await readPendingPoints();
  if (!pending.length) return { sent: 0, remaining: 0 };

  const remaining: PendingLocationPoint[] = [];
  let sent = 0;

  for (const point of pending) {
    try {
      await sendPoint(point);
      sent += 1;
    } catch {
      remaining.push(point);
    }
  }

  await savePendingPoints(remaining);
  return { sent, remaining: remaining.length };
}

async function handleLocations(locations: Location.LocationObject[]): Promise<void> {
  const activeRaw = await AsyncStorage.getItem(ACTIVE_TRACKING_KEY);
  if (!activeRaw) return;

  let active: ActiveTrackingState;
  try {
    active = JSON.parse(activeRaw) as ActiveTrackingState;
  } catch {
    return;
  }

  for (const location of locations) {
    const capturedAt = new Date(location.timestamp).toISOString();
    const point: PendingLocationPoint = {
      sessionId: active.sessionId,
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracyM: location.coords.accuracy ?? null,
      speedMps: location.coords.speed ?? null,
      bearingDeg: location.coords.heading ?? null,
      altitudeM: location.coords.altitude ?? null,
      isMock: Boolean((location as Location.LocationObject & { mocked?: boolean }).mocked),
      capturedAt,
      idempotencyKey: `${active.sessionId}:${location.timestamp}:${location.coords.latitude.toFixed(6)}:${location.coords.longitude.toFixed(6)}`,
    };

    try {
      await sendPoint(point);
    } catch {
      await queuePoint(point);
    }
  }
}

if (Platform.OS !== 'web' && !TaskManager.isTaskDefined(FIELD_LOCATION_TASK)) {
  TaskManager.defineTask(FIELD_LOCATION_TASK, async ({ data, error }) => {
    if (error) return;
    const payload = data as { locations?: Location.LocationObject[] } | undefined;
    if (!payload?.locations?.length) return;
    await handleLocations(payload.locations);
  });
}

export async function getActiveTrackingState(): Promise<ActiveTrackingState | null> {
  const raw = await AsyncStorage.getItem(ACTIVE_TRACKING_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ActiveTrackingState;
  } catch {
    return null;
  }
}

export async function requestFieldLocationPermissions(): Promise<{
  foreground: boolean;
  background: boolean;
}> {
  if (Platform.OS === 'web') return { foreground: false, background: false };

  const foreground = await Location.requestForegroundPermissionsAsync();
  if (foreground.status !== Location.PermissionStatus.GRANTED) {
    return { foreground: false, background: false };
  }

  const background = await Location.requestBackgroundPermissionsAsync();
  return {
    foreground: true,
    background: background.status === Location.PermissionStatus.GRANTED,
  };
}

export async function getCurrentFieldPosition(): Promise<Location.LocationObject> {
  let permission = await Location.getForegroundPermissionsAsync();
  if (permission.status !== Location.PermissionStatus.GRANTED) {
    permission = await Location.requestForegroundPermissionsAsync();
  }
  if (permission.status !== Location.PermissionStatus.GRANTED) {
    throw new Error('Precise location permission is required.');
  }

  const servicesEnabled = await Location.hasServicesEnabledAsync();
  if (!servicesEnabled) throw new Error('Turn on device location services.');

  return Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
    mayShowUserSettingsDialog: true,
  });
}

export async function startFieldLocationTracking(input: {
  sessionId: string;
  visitId: string;
  userId: string;
  deviceId?: string;
}): Promise<ActiveTrackingState> {
  if (Platform.OS === 'web') throw new Error('Background tracking requires the Android app.');

  const permissions = await requestFieldLocationPermissions();
  if (!permissions.foreground) throw new Error('Location permission was denied.');
  if (!permissions.background) throw new Error('Allow all-the-time location access for active field tracking.');

  const deviceId = input.deviceId ?? await getInstallationId();
  const active: ActiveTrackingState = {
    sessionId: input.sessionId,
    visitId: input.visitId,
    userId: input.userId,
    deviceId,
    startedAt: new Date().toISOString(),
  };

  await AsyncStorage.setItem(ACTIVE_TRACKING_KEY, JSON.stringify(active));

  const alreadyRunning = await Location.hasStartedLocationUpdatesAsync(FIELD_LOCATION_TASK);
  if (!alreadyRunning) {
    await Location.startLocationUpdatesAsync(FIELD_LOCATION_TASK, {
      accuracy: Location.Accuracy.High,
      timeInterval: 30_000,
      distanceInterval: 25,
      deferredUpdatesInterval: 60_000,
      deferredUpdatesDistance: 50,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'COLORJET Field Tracking Active',
        notificationBody: 'Route tracking is active for the current customer visit.',
        notificationColor: '#1A237E',
        killServiceOnDestroy: false,
      },
    });
  }

  await flushPendingLocationPoints();
  return active;
}

export async function stopFieldLocationTracking(): Promise<void> {
  if (Platform.OS !== 'web') {
    const running = await Location.hasStartedLocationUpdatesAsync(FIELD_LOCATION_TASK);
    if (running) await Location.stopLocationUpdatesAsync(FIELD_LOCATION_TASK);
  }
  await AsyncStorage.removeItem(ACTIVE_TRACKING_KEY);
  await flushPendingLocationPoints();
}
