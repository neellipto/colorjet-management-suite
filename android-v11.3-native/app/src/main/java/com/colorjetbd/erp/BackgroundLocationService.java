package com.colorjetbd.erp;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.os.IBinder;
import android.util.Log;

import org.json.JSONObject;

import java.io.BufferedWriter;
import java.io.File;
import java.io.FileWriter;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class BackgroundLocationService extends Service implements LocationListener {
    public static final String PREFS = "colorjet_native";
    public static final String KEY_ACTIVE = "location_active";
    public static final String KEY_SESSION = "location_session_uuid";
    public static final String KEY_API_TOKEN = "api_token";
    private static final String CHANNEL_ID = "colorjet-duty-location";
    private static final int NOTIFICATION_ID = 1130;
    private static final long MIN_TIME_MS = 30_000L;
    private static final float MIN_DISTANCE_M = 25f;

    private LocationManager locationManager;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    public static void start(Context context, String requestedSessionUuid) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String session = requestedSessionUuid;
        if (session == null || session.trim().isEmpty()) session = prefs.getString(KEY_SESSION, "");
        if (session == null || session.trim().isEmpty()) session = UUID.randomUUID().toString();
        prefs.edit().putBoolean(KEY_ACTIVE, true).putString(KEY_SESSION, session).apply();
        Intent intent = new Intent(context, BackgroundLocationService.class);
        intent.putExtra(KEY_SESSION, session);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) context.startForegroundService(intent);
        else context.startService(intent);
    }

    public static void stop(Context context) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putBoolean(KEY_ACTIVE, false).apply();
        context.stopService(new Intent(context, BackgroundLocationService.class));
    }

    @Override public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        startForeground(NOTIFICATION_ID, buildNotification());
        locationManager = (LocationManager) getSystemService(LOCATION_SERVICE);
    }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        requestLocationUpdates();
        return START_STICKY;
    }

    private void requestLocationUpdates() {
        if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED
            && checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            stopSelf();
            return;
        }
        try { locationManager.requestLocationUpdates(LocationManager.GPS_PROVIDER, MIN_TIME_MS, MIN_DISTANCE_M, this); }
        catch (RuntimeException ignored) { }
        try { locationManager.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, MIN_TIME_MS, MIN_DISTANCE_M, this); }
        catch (RuntimeException ignored) { }
    }

    @Override public void onLocationChanged(Location location) { executor.execute(() -> persistAndSync(location)); }

    private void persistAndSync(Location location) {
        try {
            SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
            String sessionUuid = prefs.getString(KEY_SESSION, "");
            JSONObject payload = new JSONObject();
            payload.put("session_uuid", sessionUuid);
            payload.put("latitude", location.getLatitude());
            payload.put("longitude", location.getLongitude());
            payload.put("accuracy", location.hasAccuracy() ? location.getAccuracy() : JSONObject.NULL);
            payload.put("speed", location.hasSpeed() ? location.getSpeed() : JSONObject.NULL);
            payload.put("heading", location.hasBearing() ? location.getBearing() : JSONObject.NULL);
            payload.put("altitude", location.hasAltitude() ? location.getAltitude() : JSONObject.NULL);
            payload.put("provider", location.getProvider());
            payload.put("is_mock", Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ? location.isMock() : location.isFromMockProvider());
            payload.put("recorded_at", Build.VERSION.SDK_INT >= Build.VERSION_CODES.O ? Instant.ofEpochMilli(location.getTime()).toString() : String.valueOf(location.getTime()));
            payload.put("source", "android-native-v11.3");
            appendQueue(payload.toString());
            postToServer(payload.toString(), prefs.getString(KEY_API_TOKEN, ""));
        } catch (Exception error) {
            Log.e("COLORJET_LOCATION", "Location persistence failed", error);
        }
    }

    private void appendQueue(String json) throws Exception {
        File queue = new File(getFilesDir(), "location-queue.jsonl");
        try (BufferedWriter writer = new BufferedWriter(new FileWriter(queue, true))) {
            writer.write(json);
            writer.newLine();
        }
    }

    private void postToServer(String json, String token) {
        if (token == null || token.trim().isEmpty()) return;
        HttpURLConnection connection = null;
        try {
            URL url = new URL(getString(R.string.api_base_url) + "/operations/location/ping");
            connection = (HttpURLConnection) url.openConnection();
            connection.setRequestMethod("POST");
            connection.setConnectTimeout(12_000);
            connection.setReadTimeout(12_000);
            connection.setDoOutput(true);
            connection.setRequestProperty("Content-Type", "application/json");
            connection.setRequestProperty("Accept", "application/json");
            connection.setRequestProperty("Authorization", "Bearer " + token);
            byte[] bytes = json.getBytes(StandardCharsets.UTF_8);
            connection.setFixedLengthStreamingMode(bytes.length);
            try (OutputStream output = connection.getOutputStream()) { output.write(bytes); }
            int code = connection.getResponseCode();
            if (code < 200 || code >= 300) Log.w("COLORJET_LOCATION", "Location API returned HTTP " + code);
        } catch (Exception error) {
            Log.w("COLORJET_LOCATION", "Location sync deferred", error);
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    private Notification buildNotification() {
        Intent openIntent = new Intent(this, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(this, 0, openIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            ? new Notification.Builder(this, CHANNEL_ID)
            : new Notification.Builder(this);
        return builder
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setContentTitle(getString(R.string.notification_title))
            .setContentText(getString(R.string.notification_text))
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .build();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, getString(R.string.notification_channel_name), NotificationManager.IMPORTANCE_LOW);
            channel.setDescription(getString(R.string.notification_text));
            getSystemService(NotificationManager.class).createNotificationChannel(channel);
        }
    }

    @Override public void onProviderEnabled(String provider) { }
    @Override public void onProviderDisabled(String provider) { }
    @Override public void onStatusChanged(String provider, int status, Bundle extras) { }

    @Override public void onDestroy() {
        if (locationManager != null) locationManager.removeUpdates(this);
        executor.shutdown();
        super.onDestroy();
    }

    @Override public IBinder onBind(Intent intent) { return null; }
}
