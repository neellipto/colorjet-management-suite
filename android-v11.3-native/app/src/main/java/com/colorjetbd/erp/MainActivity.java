package com.colorjetbd.erp;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.ProgressBar;
import android.widget.Toast;

import org.json.JSONObject;

import java.io.File;
import java.util.UUID;

public final class MainActivity extends Activity {
    private static final int FILE_CHOOSER_REQUEST = 5001;
    private static final int LOCATION_PERMISSION_REQUEST = 5101;
    private static final int NOTIFICATION_PERMISSION_REQUEST = 5102;

    private WebView webView;
    private ProgressBar loadingIndicator;
    private ValueCallback<Uri[]> filePathCallback;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.rgb(10, 16, 26));
        getWindow().setNavigationBarColor(Color.rgb(10, 16, 26));
        setContentView(R.layout.activity_main);

        webView = findViewById(R.id.erp_webview);
        loadingIndicator = findViewById(R.id.loading_indicator);
        Button permissionButton = findViewById(R.id.button_permissions);
        Button startButton = findViewById(R.id.button_start_duty);
        Button stopButton = findViewById(R.id.button_stop_duty);

        configureWebView();
        permissionButton.setOnClickListener(view -> requestAttendancePermissions());
        startButton.setOnClickListener(view -> startDuty(UUID.randomUUID().toString()));
        stopButton.setOnClickListener(view -> stopDuty());

        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState);
        } else {
            webView.loadUrl(getString(R.string.field_service_url));
        }
    }

    private void configureWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(false);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setUserAgentString(settings.getUserAgentString() + " COLORJET-ERP-Native/1.6.0");
        CookieManager.getInstance().setAcceptCookie(true);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
            CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);
        }

        webView.addJavascriptInterface(new NativeBridge(), "ColorjetNative");
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return routeUri(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return routeUri(Uri.parse(url));
            }

            @Override
            public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                loadingIndicator.setVisibility(View.VISIBLE);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                loadingIndicator.setVisibility(View.GONE);
                String status = permissionStatusJson().replace("\\", "\\\\").replace("'", "\\'");
                view.evaluateJavascript("window.dispatchEvent(new CustomEvent('colorjet-native-ready',{detail:" + status + "}));", null);
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) {
                    loadingIndicator.setVisibility(View.GONE);
                    Toast.makeText(MainActivity.this, R.string.network_error, Toast.LENGTH_LONG).show();
                }
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (filePathCallback != null) {
                    filePathCallback.onReceiveValue(null);
                }
                filePathCallback = callback;
                try {
                    startActivityForResult(params.createIntent(), FILE_CHOOSER_REQUEST);
                } catch (ActivityNotFoundException error) {
                    filePathCallback = null;
                    Toast.makeText(MainActivity.this, "No file picker is available.", Toast.LENGTH_LONG).show();
                    return false;
                }
                return true;
            }
        });
    }

    private boolean routeUri(Uri uri) {
        String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase();
        if ("colorjeterp".equals(scheme)) {
            String action = uri.getHost() == null ? "" : uri.getHost().toLowerCase();
            if ("permissions".equals(action)) {
                requestAttendancePermissions();
            } else if ("location-start".equals(action)) {
                String session = uri.getQueryParameter("session_uuid");
                startDuty(session == null ? UUID.randomUUID().toString() : session);
            } else if ("location-stop".equals(action)) {
                stopDuty();
            } else if ("settings".equals(action)) {
                openAppSettings();
            }
            return true;
        }
        if ("https".equals(scheme)) {
            return false;
        }
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
        } catch (ActivityNotFoundException error) {
            Toast.makeText(this, "Unable to open this link.", Toast.LENGTH_SHORT).show();
        }
        return true;
    }

    private void requestAttendancePermissions() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
            && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, NOTIFICATION_PERMISSION_REQUEST);
        }
        if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION}, LOCATION_PERMISSION_REQUEST);
            return;
        }
        requestBackgroundLocationIfNeeded();
    }

    private void requestBackgroundLocationIfNeeded() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R
            && checkSelfPermission(Manifest.permission.ACCESS_BACKGROUND_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            new AlertDialog.Builder(this)
                .setTitle("Allow background location")
                .setMessage("Choose Permissions → Location → Allow all the time. COLORJET records location only during an active duty or customer-visit session.")
                .setNegativeButton("Cancel", null)
                .setPositiveButton("Open settings", (dialog, which) -> openAppSettings())
                .show();
        } else if (Build.VERSION.SDK_INT == Build.VERSION_CODES.Q
            && checkSelfPermission(Manifest.permission.ACCESS_BACKGROUND_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.ACCESS_BACKGROUND_LOCATION}, LOCATION_PERMISSION_REQUEST);
        } else {
            Toast.makeText(this, "Attendance permissions are ready.", Toast.LENGTH_SHORT).show();
        }
    }

    private void startDuty(String sessionUuid) {
        if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            Toast.makeText(this, R.string.permission_required, Toast.LENGTH_LONG).show();
            requestAttendancePermissions();
            return;
        }
        BackgroundLocationService.start(this, sessionUuid);
        emitNativeEvent("colorjet-location-started", "{\"session_uuid\":\"" + sessionUuid + "\"}");
        Toast.makeText(this, "Duty route tracking started.", Toast.LENGTH_SHORT).show();
    }

    private void stopDuty() {
        BackgroundLocationService.stop(this);
        emitNativeEvent("colorjet-location-stopped", "{}");
        Toast.makeText(this, "Duty route tracking stopped.", Toast.LENGTH_SHORT).show();
    }

    private void emitNativeEvent(String name, String detailJson) {
        runOnUiThread(() -> webView.evaluateJavascript("window.dispatchEvent(new CustomEvent('" + name + "',{detail:" + detailJson + "}));", null));
    }

    private void openAppSettings() {
        Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getPackageName()));
        startActivity(intent);
    }

    private String permissionStatusJson() {
        try {
            JSONObject status = new JSONObject();
            status.put("platform", "android");
            status.put("version", "1.6.0");
            status.put("fine_location", checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED);
            status.put("background_location", Build.VERSION.SDK_INT < Build.VERSION_CODES.Q || checkSelfPermission(Manifest.permission.ACCESS_BACKGROUND_LOCATION) == PackageManager.PERMISSION_GRANTED);
            status.put("notifications", Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU || checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED);
            status.put("tracking_active", getSharedPreferences(BackgroundLocationService.PREFS, MODE_PRIVATE).getBoolean(BackgroundLocationService.KEY_ACTIVE, false));
            return status.toString();
        } catch (Exception ignored) {
            return "{}";
        }
    }

    public final class NativeBridge {
        @JavascriptInterface
        public String getPermissionStatus() {
            return permissionStatusJson();
        }

        @JavascriptInterface
        public void requestPermissions() {
            runOnUiThread(MainActivity.this::requestAttendancePermissions);
        }

        @JavascriptInterface
        public void setApiToken(String token) {
            if (token == null || token.length() > 4096) {
                return;
            }
            getSharedPreferences(BackgroundLocationService.PREFS, MODE_PRIVATE)
                .edit().putString(BackgroundLocationService.KEY_API_TOKEN, token).apply();
        }

        @JavascriptInterface
        public void startDuty(String sessionUuid) {
            runOnUiThread(() -> MainActivity.this.startDuty(sessionUuid));
        }

        @JavascriptInterface
        public void stopDuty() {
            runOnUiThread(MainActivity.this::stopDuty);
        }

        @JavascriptInterface
        public int getQueuedLocationCount() {
            File queue = new File(getFilesDir(), "location-queue.jsonl");
            if (!queue.exists()) {
                return 0;
            }
            return (int) Math.min(Integer.MAX_VALUE, queue.length());
        }

        @JavascriptInterface
        public void openSettings() {
            runOnUiThread(MainActivity.this::openAppSettings);
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == LOCATION_PERMISSION_REQUEST && checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
            requestBackgroundLocationIfNeeded();
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == FILE_CHOOSER_REQUEST && filePathCallback != null) {
            filePathCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data));
            filePathCallback = null;
        }
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        webView.saveState(outState);
        super.onSaveInstanceState(outState);
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.destroy();
        }
        super.onDestroy();
    }
}
