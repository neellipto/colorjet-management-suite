import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiPost } from './erp-api';
export const BACKGROUND_LOCATION_TASK = 'COLORJET_BACKGROUND_LOCATION_TASK';
const SESSION_KEY = 'cj_active_location_session_v113';
const SEQUENCE_KEY = 'cj_location_sequence_v113';
TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error || !data) return; const sessionUuid = await AsyncStorage.getItem(SESSION_KEY); if (!sessionUuid) return;
  const locations = (data as { locations?: Location.LocationObject[] }).locations ?? []; let sequence = Number(await AsyncStorage.getItem(SEQUENCE_KEY) ?? '0');
  for (const point of locations) { sequence += 1; try { await apiPost('operations/location/ping', {session_uuid:sessionUuid,point_uuid:`${sessionUuid}-${sequence}`,sequence_no:sequence,recorded_at:new Date(point.timestamp).toISOString().replace('T',' ').slice(0,19),latitude:point.coords.latitude,longitude:point.coords.longitude,accuracy_m:point.coords.accuracy,altitude_m:point.coords.altitude,speed_mps:point.coords.speed,heading_deg:point.coords.heading,is_mock:point.mocked?1:0,source:'android_background'}); } catch {} }
  await AsyncStorage.setItem(SEQUENCE_KEY, String(sequence));
});
export async function ensureLocationPermissions(): Promise<'background'|'foreground'> { const foreground = await Location.requestForegroundPermissionsAsync(); if (foreground.status !== 'granted') throw new Error('Precise location permission is required for attendance.'); const background = await Location.requestBackgroundPermissionsAsync(); return background.status === 'granted' ? 'background' : 'foreground'; }
export async function startBackgroundRoute(sessionUuid: string) { await AsyncStorage.setItem(SESSION_KEY, sessionUuid); await AsyncStorage.setItem(SEQUENCE_KEY, '0'); const started = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK); if (!started) await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {accuracy:Location.Accuracy.High,timeInterval:30000,distanceInterval:25,pausesUpdatesAutomatically:false,foregroundService:{notificationTitle:'COLORJET Field Duty Active',notificationBody:'Location is recorded only for the active attendance or customer-visit session.',notificationColor:'#0B1F3A'}}); }
export async function getActiveRouteSession() { return AsyncStorage.getItem(SESSION_KEY); }
export async function stopBackgroundRoute() { const started = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK); if (started) await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK); await AsyncStorage.multiRemove([SESSION_KEY,SEQUENCE_KEY]); }
