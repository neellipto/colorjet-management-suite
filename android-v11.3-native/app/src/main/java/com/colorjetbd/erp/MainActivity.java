package com.colorjetbd.erp;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.Intent;
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
import android.widget.ProgressBar;
import android.widget.Toast;

import org.json.JSONObject;

import java.io.File;
import java.util.UUID;

public final class MainActivity extends Activity {
    private static final int FILE_CHOOSER_REQUEST = 5001;
    private static final int LOCATION_PERMISSION_REQUEST = 5101;
    private static final int NOTIFICATION_PERMISSION_REQUEST = 5102;
    private static final String TRUSTED_HOST = "erp1.colorjetbd.com";

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
        configureWebView();

        findViewById(R.id.nav_home).setOnClickListener(v -> loadUrl(getString(R.string.dashboard_url)));
        findViewById(R.id.nav_attendance).setOnClickListener(v -> loadUrl(getString(R.string.attendance_url)));
        findViewById(R.id.nav_notifications).setOnClickListener(v -> loadUrl(getString(R.string.notifications_url)));
        findViewById(R.id.nav_messages).setOnClickListener(v -> loadUrl(getString(R.string.messages_url)));
        findViewById(R.id.nav_more).setOnClickListener(v -> showMoreMenu());

        if (savedInstanceState != null) webView.restoreState(savedInstanceState);
        else loadUrl(getString(R.string.dashboard_url));
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
        settings.setUserAgentString(settings.getUserAgentString() + " COLORJET-ERP-Native/1.7.1");
        CookieManager.getInstance().setAcceptCookie(true);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
            CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);
        }

        webView.addJavascriptInterface(new NativeBridge(), "ColorjetNative");
        webView.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) { return routeUri(request.getUrl()); }
            @Override public boolean shouldOverrideUrlLoading(WebView view, String url) { return routeUri(Uri.parse(url)); }
            @Override public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) { loadingIndicator.setVisibility(View.VISIBLE); }
            @Override public void onPageFinished(WebView view, String url) {
                loadingIndicator.setVisibility(View.GONE);
                String nativeCss = "(function(){var s=document.getElementById('colorjet-native-style');if(!s){s=document.createElement('style');s.id='colorjet-native-style';s.textContent='.mobile-bottom-nav{display:none!important}body{padding-bottom:0!important}.main-content{padding-bottom:16px!important}';document.head.appendChild(s);}})();";
                view.evaluateJavascript(nativeCss, null);
                String status = permissionStatusJson().replace("\\", "\\\\").replace("'", "\\'");
                view.evaluateJavascript("window.dispatchEvent(new CustomEvent('colorjet-native-ready',{detail:" + status + "}));", null);
            }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) {
                    loadingIndicator.setVisibility(View.GONE);
                    Toast.makeText(MainActivity.this, R.string.network_error, Toast.LENGTH_LONG).show();
                }
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (filePathCallback != null) filePathCallback.onReceiveValue(null);
                filePathCallback = callback;
                try { startActivityForResult(params.createIntent(), FILE_CHOOSER_REQUEST); }
                catch (ActivityNotFoundException error) {
                    filePathCallback = null;
                    Toast.makeText(MainActivity.this, "No file picker is available.", Toast.LENGTH_LONG).show();
                    return false;
                }
                return true;
            }
        });
    }

    private void loadUrl(String url) {
        loadingIndicator.setVisibility(View.VISIBLE);
        webView.loadUrl(url);
    }

    private void showMoreMenu() {
        String[] items = {
            "Start Duty & Route Tracking",
            "Stop Duty & Route Tracking",
            "Employee Directory & ID Cards",
            "Employee Verification",
            "QR Code Generator",
            "Warranty Registration",
            "Notification / SMS / Email Settings",
            "Office Tasks",
            "Engineer Schedule",
            "Service Tickets",
            "Spare Parts Logistics",
            "LC/TT Shipment & Trucking",
            "Leave, Payroll & Holiday",
            "Biometric Connectors"
        };
        new AlertDialog.Builder(this)
            .setTitle("COLORJET Modules")
            .setItems(items, (dialog, which) -> {
                switch (which) {
                    case 0: startDuty(UUID.randomUUID().toString()); break;
                    case 1: stopDuty(); break;
                    case 2: loadUrl(base("/employee-cards")); break;
                    case 3: loadUrl(base("/employees")); break;
                    case 4: loadUrl(base("/qr-suite")); break;
                    case 5: loadUrl(base("/service-warranty-registration")); break;
                    case 6: loadUrl(base("/settings/notifications")); break;
                    case 7: loadUrl(base("/office-task-control")); break;
                    case 8: loadUrl(base("/engineer-schedule")); break;
                    case 9: loadUrl(base("/service-tickets")); break;
                    case 10: loadUrl(base("/spare-parts-logistics")); break;
                    case 11: loadUrl(base("/imports/trucking-control")); break;
                    case 12: loadUrl(base("/hr/attendance")); break;
                    case 13: loadUrl(base("/hr/biometric-connectors")); break;
                    default: break;
                }
            })
            .setNegativeButton("Close", null)
            .show();
    }

    private String base(String path) { return getString(R.string.erp_base_url) + path; }

    private boolean routeUri(Uri uri) {
        String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase();
        String host = uri.getHost() == null ? "" : uri.getHost().toLowerCase();
        if ("colorjeterp".equals(scheme)) {
            String action = host;
            if ("permissions".equals(action)) requestAttendancePermissions();
            else if ("location-start".equals(action)) startDuty(uri.getQueryParameter("session_uuid"));
            else if ("location-stop".equals(action)) stopDuty();
            else if ("settings".equals(action)) openAppSettings();
            return true;
        }
        if ("https".equals(scheme) && (TRUSTED_HOST.equals(host) || host.endsWith(".colorjetbd.com"))) return false;
        try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); }
        catch (ActivityNotFoundException error) { Toast.makeText(this, "Unable to open this link.", Toast.LENGTH_SHORT).show(); }
        return true;
    }

    private void requestAttendancePermissions() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, NOTIFICATION_PERMISSION_REQUEST);
        }
        if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION}, LOCATION_PERMISSION_REQUEST);
            return;
        }
        requestBackgroundLocationIfNeeded();
    }

    private void requestBackgroundLocationIfNeeded() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R && checkSelfPermission(Manifest.permission.ACCESS_BACKGROUND_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            new AlertDialog.Builder(this)
                .setTitle("Allow background location")
                .setMessage("Choose Permissions → Location → Allow all the time. COLORJET records location only during an active duty or customer visit session.")
                .setNegativeButton("Cancel", null)
                .setPositiveButton("Open settings", (dialog, which) -> openAppSettings())
                .show();
        } else if (Build.VERSION.SDK_INT == Build.VERSION_CODES.Q && checkSelfPermission(Manifest.permission.ACCESS_BACKGROUND_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.ACCESS_BACKGROUND_LOCATION}, LOCATION_PERMISSION_REQUEST);
        }
    }

    private void startDuty(String sessionUuid) {
        if (sessionUuid == null || sessionUuid.trim().isEmpty()) sessionUuid = UUID.randomUUID().toString();
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
        startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getPackageName())));
    }

    private String permissionStatusJson() {
        try {
            JSONObject status = new JSONObject();
            status.put("platform", "android");
            status.put("version", "1.7.1");
            status.put("fine_location", checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED);
            status.put("background_location", Build.VERSION.SDK_INT < Build.VERSION_CODES.Q || checkSelfPermission(Manifest.permission.ACCESS_BACKGROUND_LOCATION) == PackageManager.PERMISSION_GRANTED);
            status.put("notifications", Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU || checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED);
            status.put("tracking_active", getSharedPreferences(BackgroundLocationService.PREFS, MODE_PRIVATE).getBoolean(BackgroundLocationService.KEY_ACTIVE, false));
            return status.toString();
        } catch (Exception ignored) { return "{}"; }
    }

    public final class NativeBridge {
        @JavascriptInterface public String getPermissionStatus() { return permissionStatusJson(); }
        @JavascriptInterface public void requestPermissions() { runOnUiThread(MainActivity.this::requestAttendancePermissions); }
        @JavascriptInterface public void setApiToken(String token) {
            if (token == null || token.length() > 4096) return;
            getSharedPreferences(BackgroundLocationService.PREFS, MODE_PRIVATE).edit().putString(BackgroundLocationService.KEY_API_TOKEN, token).apply();
        }
        @JavascriptInterface public void startDuty(String sessionUuid) { runOnUiThread(() -> MainActivity.this.startDuty(sessionUuid)); }
        @JavascriptInterface public void stopDuty() { runOnUiThread(MainActivity.this::stopDuty); }
        @JavascriptInterface public int getQueuedLocationCount() {
            File queue = new File(getFilesDir(), "location-queue.jsonl");
            return queue.exists() ? (int)Math.min(Integer.MAX_VALUE, queue.length()) : 0;
        }
        @JavascriptInterface public void openSettings() { runOnUiThread(MainActivity.this::openAppSettings); }
    }

    @Override public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == LOCATION_PERMISSION_REQUEST && checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) requestBackgroundLocationIfNeeded();
    }

    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == FILE_CHOOSER_REQUEST && filePathCallback != null) {
            filePathCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data));
            filePathCallback = null;
        }
    }

    @Override public void onBackPressed() {
        if (webView.canGoBack()) webView.goBack(); else super.onBackPressed();
    }

    @Override protected void onSaveInstanceState(Bundle outState) { webView.saveState(outState); super.onSaveInstanceState(outState); }
    @Override protected void onDestroy() { if (webView != null) webView.destroy(); super.onDestroy(); }
}
