package com.colorjetbd.erp;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.text.Editable;
import android.text.InputType;
import android.text.TextWatcher;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.inputmethod.InputMethodManager;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.Space;
import android.widget.TextView;
import android.widget.Toast;

import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

public final class MainActivity extends Activity {
    private static final int EXPORT_REQUEST = 6001;
    private static final int LOCATION_PERMISSION_REQUEST = 6101;
    private static final int NOTIFICATION_PERMISSION_REQUEST = 6102;

    private static final String SESSION_PREFS = "colorjet_erp_session";
    private static final String KEY_USER_ID = "user_id";
    private static final String KEY_USER_NAME = "user_name";
    private static final String KEY_USER_ROLE = "user_role";

    private final int COLOR_ACCENT = Color.rgb(14, 116, 198);
    private final int COLOR_ACCENT_DARK = Color.rgb(8, 73, 132);
    private final int COLOR_BG = Color.rgb(245, 248, 251);
    private final int COLOR_TEXT = Color.rgb(26, 39, 52);
    private final int COLOR_MUTED = Color.rgb(96, 113, 128);
    private final int COLOR_BORDER = Color.rgb(217, 226, 234);
    private final int COLOR_DANGER = Color.rgb(177, 42, 42);
    private final int COLOR_SUCCESS = Color.rgb(23, 132, 82);

    private LocalDb db;
    private SharedPreferences session;
    private LinearLayout page;
    private String currentModule;
    private String pendingCsv;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        configureWindow();
        db = new LocalDb(this);
        session = getSharedPreferences(SESSION_PREFS, MODE_PRIVATE);
        routeInitialScreen();
    }

    private void configureWindow() {
        Window window = getWindow();
        window.setStatusBarColor(Color.WHITE);
        window.setNavigationBarColor(Color.WHITE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            window.getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);
        }
    }

    private void routeInitialScreen() {
        if (!db.hasAnyUser()) {
            showOwnerSetup();
        } else if (session.getLong(KEY_USER_ID, 0) > 0) {
            showDashboard();
        } else {
            showLogin();
        }
    }

    private void newPage() {
        currentModule = null;
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(COLOR_BG);

        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        page = new LinearLayout(this);
        page.setOrientation(LinearLayout.VERTICAL);
        page.setPadding(dp(18), dp(18), dp(18), dp(38));
        scroll.addView(page, matchWrap());
        root.addView(scroll, matchMatch());
        setContentView(root);
    }

    private void showOwnerSetup() {
        newPage();
        addBrandHeader(false);
        page.addView(space(24));

        LinearLayout card = card();
        card.addView(title("First Owner Setup"));
        card.addView(body("এই ডিভাইসে প্রথম Owner account তৈরি করুন। কোনো default বা hardcoded password নেই। Password encrypted hash হিসেবে local database-এ থাকবে।"));

        EditText name = input("Owner full name", false, false);
        EditText identifier = input("Email / Phone / Employee ID", false, false);
        EditText password = input("Create password (minimum 8 characters)", true, false);
        EditText confirm = input("Confirm password", true, false);
        card.addView(name);
        card.addView(identifier);
        card.addView(password);
        card.addView(confirm);

        Button create = primaryButton("Create Owner & Open ERP");
        create.setOnClickListener(v -> {
            String fullName = clean(name);
            String loginId = clean(identifier);
            String pass = password.getText().toString();
            String confirmPass = confirm.getText().toString();
            if (fullName.isEmpty() || loginId.isEmpty()) {
                toast("Owner name and login ID are required.");
                return;
            }
            if (pass.length() < 8) {
                toast("Password must contain at least 8 characters.");
                return;
            }
            if (!pass.equals(confirmPass)) {
                toast("Password confirmation does not match.");
                return;
            }
            try {
                long userId = db.createOwner(fullName, loginId, pass);
                saveSession(userId, fullName, "OWNER");
                password.setText("");
                confirm.setText("");
                showDashboard();
            } catch (Exception error) {
                toast("Owner account could not be created. Use a unique login ID.");
            }
        });
        card.addView(create);
        page.addView(card);
        addOfflineNotice();
    }

    private void showLogin() {
        newPage();
        addBrandHeader(false);
        page.addView(space(24));

        LinearLayout card = card();
        card.addView(title("Secure Sign In"));
        card.addView(body("Owner login ID এবং password ব্যবহার করুন। এই build-এ কোনো default password রাখা হয়নি।"));
        EditText identifier = input("Email / Phone / Employee ID", false, false);
        EditText password = input("Password", true, false);
        card.addView(identifier);
        card.addView(password);

        Button signIn = primaryButton("Sign In");
        signIn.setOnClickListener(v -> {
            String loginId = clean(identifier);
            String pass = password.getText().toString();
            if (loginId.isEmpty() || pass.isEmpty()) {
                toast("Login ID and password are required.");
                return;
            }
            LocalDb.UserRecord user = db.authenticate(loginId, pass);
            if (user == null) {
                password.setText("");
                toast("Invalid login ID or password.");
                return;
            }
            saveSession(user.id, user.fullName, user.role);
            password.setText("");
            showDashboard();
        });
        card.addView(signIn);
        page.addView(card);
        addOfflineNotice();
    }

    private void showDashboard() {
        newPage();
        addBrandHeader(true);

        String userName = session.getString(KEY_USER_NAME, "Owner");
        String role = session.getString(KEY_USER_ROLE, "OWNER");
        LinearLayout welcome = card();
        TextView welcomeTitle = title("Welcome, " + userName);
        welcome.addView(welcomeTitle);
        welcome.addView(body(role + " • Native Android • Local database active"));
        page.addView(welcome);

        section("Owner Summary");
        LinearLayout grid = new LinearLayout(this);
        grid.setOrientation(LinearLayout.VERTICAL);
        Map<String, String> stats = db.dashboardStats();
        List<Map.Entry<String, String>> entries = new ArrayList<>(stats.entrySet());
        for (int i = 0; i < entries.size(); i += 2) {
            LinearLayout row = new LinearLayout(this);
            row.setOrientation(LinearLayout.HORIZONTAL);
            row.setGravity(Gravity.CENTER_VERTICAL);
            row.addView(metric(entries.get(i).getKey(), entries.get(i).getValue()), weighted());
            row.addView(space(10));
            if (i + 1 < entries.size()) row.addView(metric(entries.get(i + 1).getKey(), entries.get(i + 1).getValue()), weighted());
            else row.addView(new Space(this), weighted());
            grid.addView(row);
            grid.addView(space(10));
        }
        page.addView(grid);

        section("Operations");
        addModuleButton("Customers", "Customer database, contact and credit limit", "customers");
        addModuleButton("Products & Stock", "Price, current stock, stock value and low-stock alert", "products");
        addModuleButton("Office Tasks", "Department task, due date, priority and progress", "tasks");
        addModuleButton("Service Tickets", "Customer machine issue, visit date and service status", "service");

        section("Engineer Duty & Route");
        LinearLayout tracker = card();
        TextView trackerStatus = body(trackingActive() ? "Route tracking is currently active." : "Route tracking is stopped.");
        trackerStatus.setTextColor(trackingActive() ? COLOR_SUCCESS : COLOR_MUTED);
        tracker.addView(trackerStatus);
        LinearLayout trackerButtons = horizontalButtons();
        Button start = smallButton("Start Duty", COLOR_SUCCESS);
        Button stop = smallButton("Stop Duty", COLOR_DANGER);
        start.setOnClickListener(v -> startDuty());
        stop.setOnClickListener(v -> {
            BackgroundLocationService.stop(this);
            toast("Duty route tracking stopped.");
            showDashboard();
        });
        trackerButtons.addView(start, weighted());
        trackerButtons.addView(space(8));
        trackerButtons.addView(stop, weighted());
        tracker.addView(trackerButtons);
        page.addView(tracker);

        section("Account & Data");
        LinearLayout actions = card();
        Button password = outlineButton("Change Password");
        password.setOnClickListener(v -> showChangePasswordDialog());
        Button logout = outlineButton("Sign Out");
        logout.setTextColor(COLOR_DANGER);
        logout.setOnClickListener(v -> {
            session.edit().clear().apply();
            showLogin();
        });
        actions.addView(password);
        actions.addView(logout);
        page.addView(actions);
        addOfflineNotice();
    }

    private void showModule(String module, String initialSearch) {
        newPage();
        currentModule = module;
        addModuleHeader(module);

        EditText search = input("Search " + moduleTitle(module), false, false);
        search.setText(initialSearch == null ? "" : initialSearch);
        page.addView(search);
        page.addView(space(12));

        LinearLayout listHost = new LinearLayout(this);
        listHost.setOrientation(LinearLayout.VERTICAL);
        page.addView(listHost);

        Runnable reload = () -> renderRecords(module, search.getText().toString(), listHost);
        search.addTextChangedListener(new TextWatcher() {
            @Override public void beforeTextChanged(CharSequence s, int start, int count, int after) { }
            @Override public void onTextChanged(CharSequence s, int start, int before, int count) { reload.run(); }
            @Override public void afterTextChanged(Editable s) { }
        });
        reload.run();
    }

    private void addModuleHeader(String module) {
        LinearLayout top = new LinearLayout(this);
        top.setOrientation(LinearLayout.HORIZONTAL);
        top.setGravity(Gravity.CENTER_VERTICAL);
        top.setPadding(0, 0, 0, dp(12));

        Button back = textButton("← Dashboard");
        back.setOnClickListener(v -> showDashboard());
        top.addView(back, weighted());

        Button add = smallButton("＋ Add", COLOR_ACCENT);
        add.setOnClickListener(v -> showRecordDialog(module, 0));
        top.addView(add);
        top.addView(space(8));

        Button export = smallButton("CSV", COLOR_ACCENT_DARK);
        export.setOnClickListener(v -> exportModule(module));
        top.addView(export);
        page.addView(top);

        TextView heading = title(moduleTitle(module));
        heading.setTextSize(26);
        page.addView(heading);
        page.addView(body(moduleSubtitle(module)));
        page.addView(space(10));
    }

    private void renderRecords(String module, String query, LinearLayout host) {
        host.removeAllViews();
        List<LocalDb.Record> records = db.search(module, query);
        if (records.isEmpty()) {
            LinearLayout empty = card();
            empty.addView(title("No records found"));
            empty.addView(body("＋ Add button ব্যবহার করে প্রথম record তৈরি করুন।"));
            host.addView(empty);
            return;
        }
        for (LocalDb.Record record : records) {
            host.addView(recordCard(module, record));
            host.addView(space(10));
        }
    }

    private LinearLayout recordCard(String module, LocalDb.Record record) {
        LinearLayout card = card();
        TextView primary = title(recordPrimary(module, record));
        primary.setTextSize(17);
        card.addView(primary);
        TextView secondary = body(recordSecondary(module, record));
        card.addView(secondary);

        if ("products".equals(module)) {
            double stock = number(record.get("current_stock"));
            double min = number(record.get("min_stock"));
            if (stock <= min) card.addView(chip("LOW STOCK", COLOR_DANGER));
        }
        if ("tasks".equals(module) || "service".equals(module)) {
            card.addView(chip(record.get("status"), statusColor(record.get("status"))));
        }

        LinearLayout buttons = horizontalButtons();
        Button edit = smallButton("Edit", COLOR_ACCENT);
        edit.setOnClickListener(v -> showRecordDialog(module, record.id));
        buttons.addView(edit, weighted());

        if ("tasks".equals(module) || "service".equals(module)) {
            buttons.addView(space(8));
            Button status = smallButton("Next Status", COLOR_SUCCESS);
            status.setOnClickListener(v -> {
                String next = db.advanceStatus(module, record.id);
                toast("Status updated: " + next);
                showModule(module, "");
            });
            buttons.addView(status, weighted());
        }

        buttons.addView(space(8));
        Button delete = smallButton("Delete", COLOR_DANGER);
        delete.setOnClickListener(v -> confirmDelete(module, record));
        buttons.addView(delete, weighted());
        card.addView(buttons);
        return card;
    }

    private void showRecordDialog(String module, long id) {
        LocalDb.Record existing = id > 0 ? db.get(module, id) : null;
        FieldSpec[] specs = fieldsFor(module);
        Map<String, EditText> controls = new LinkedHashMap<>();

        LinearLayout form = new LinearLayout(this);
        form.setOrientation(LinearLayout.VERTICAL);
        form.setPadding(dp(18), dp(8), dp(18), dp(8));
        for (FieldSpec spec : specs) {
            TextView label = label(spec.label + (spec.required ? " *" : ""));
            form.addView(label);
            EditText control = input(spec.label, false, spec.multiline);
            if (spec.numeric) control.setInputType(InputType.TYPE_CLASS_NUMBER | InputType.TYPE_NUMBER_FLAG_DECIMAL | InputType.TYPE_NUMBER_FLAG_SIGNED);
            String value = existingValue(existing, spec.key);
            if (value.isEmpty() && id == 0 && spec.defaultValue != null) value = spec.defaultValue;
            control.setText(value);
            form.addView(control);
            controls.put(spec.key, control);
        }

        ScrollView scroll = new ScrollView(this);
        scroll.addView(form);
        AlertDialog dialog = new AlertDialog.Builder(this)
            .setTitle((id > 0 ? "Edit " : "Add ") + moduleTitle(module))
            .setView(scroll)
            .setNegativeButton("Cancel", null)
            .setPositiveButton("Save", null)
            .create();

        dialog.setOnShowListener(ignored -> dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v -> {
            Map<String, String> values = new LinkedHashMap<>();
            for (FieldSpec spec : specs) {
                String value = clean(controls.get(spec.key));
                if (spec.required && value.isEmpty()) {
                    controls.get(spec.key).setError(spec.label + " is required");
                    controls.get(spec.key).requestFocus();
                    return;
                }
                values.put(spec.key, value);
            }
            try {
                db.save(module, id, values);
                dialog.dismiss();
                hideKeyboard();
                toast(id > 0 ? "Record updated." : "Record saved.");
                showModule(module, "");
            } catch (Exception error) {
                toast(error.getMessage() == null ? "Record could not be saved." : error.getMessage());
            }
        }));
        dialog.show();
    }

    private void confirmDelete(String module, LocalDb.Record record) {
        new AlertDialog.Builder(this)
            .setTitle("Delete record?")
            .setMessage(recordPrimary(module, record) + " will be removed from this device.")
            .setNegativeButton("Cancel", null)
            .setPositiveButton("Delete", (dialog, which) -> {
                db.delete(module, record.id);
                toast("Record deleted.");
                showModule(module, "");
            })
            .show();
    }

    private void exportModule(String module) {
        pendingCsv = db.exportCsv(module);
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("text/csv");
        intent.putExtra(Intent.EXTRA_TITLE, "COLORJET_" + module + "_export.csv");
        startActivityForResult(intent, EXPORT_REQUEST);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != EXPORT_REQUEST || resultCode != RESULT_OK || data == null || data.getData() == null || pendingCsv == null) return;
        Uri uri = data.getData();
        try (OutputStream output = getContentResolver().openOutputStream(uri)) {
            if (output == null) throw new IllegalStateException("No output stream");
            output.write(pendingCsv.getBytes(StandardCharsets.UTF_8));
            output.flush();
            toast("CSV export completed.");
        } catch (Exception error) {
            toast("CSV export failed.");
        } finally {
            pendingCsv = null;
        }
    }

    private void showChangePasswordDialog() {
        LinearLayout form = new LinearLayout(this);
        form.setOrientation(LinearLayout.VERTICAL);
        form.setPadding(dp(18), dp(8), dp(18), dp(8));
        EditText current = input("Current password", true, false);
        EditText next = input("New password (minimum 8 characters)", true, false);
        EditText confirm = input("Confirm new password", true, false);
        form.addView(current);
        form.addView(next);
        form.addView(confirm);

        AlertDialog dialog = new AlertDialog.Builder(this)
            .setTitle("Change Password")
            .setView(form)
            .setNegativeButton("Cancel", null)
            .setPositiveButton("Update", null)
            .create();
        dialog.setOnShowListener(ignored -> dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v -> {
            String currentValue = current.getText().toString();
            String nextValue = next.getText().toString();
            if (nextValue.length() < 8) {
                next.setError("Minimum 8 characters required");
                return;
            }
            if (!nextValue.equals(confirm.getText().toString())) {
                confirm.setError("Password does not match");
                return;
            }
            boolean changed = db.changePassword(session.getLong(KEY_USER_ID, 0), currentValue, nextValue);
            if (!changed) {
                current.setError("Current password is incorrect");
                return;
            }
            dialog.dismiss();
            toast("Password updated securely.");
        }));
        dialog.show();
    }

    private void addBrandHeader(boolean showAccount) {
        LinearLayout header = new LinearLayout(this);
        header.setOrientation(LinearLayout.HORIZONTAL);
        header.setGravity(Gravity.CENTER_VERTICAL);
        header.setPadding(0, 0, 0, dp(16));

        ImageView logo = new ImageView(this);
        logo.setImageResource(getApplicationInfo().icon);
        logo.setScaleType(ImageView.ScaleType.FIT_CENTER);
        LinearLayout.LayoutParams logoParams = new LinearLayout.LayoutParams(dp(54), dp(54));
        header.addView(logo, logoParams);
        header.addView(space(12));

        LinearLayout brand = new LinearLayout(this);
        brand.setOrientation(LinearLayout.VERTICAL);
        TextView name = text("COLORJET ERP", 22, COLOR_ACCENT_DARK, Typeface.BOLD);
        TextView tagline = text("QUALITY • COMMITMENT • SERVICE", 9, COLOR_MUTED, Typeface.BOLD);
        tagline.setLetterSpacing(0.08f);
        brand.addView(name);
        brand.addView(tagline);
        header.addView(brand, weighted());

        if (showAccount) {
            Button account = textButton("Account");
            account.setOnClickListener(v -> showChangePasswordDialog());
            header.addView(account);
        }
        page.addView(header);
    }

    private void addModuleButton(String title, String subtitle, String module) {
        LinearLayout card = card();
        card.setClickable(true);
        card.setFocusable(true);
        card.setOnClickListener(v -> showModule(module, ""));
        TextView heading = title(title);
        heading.setTextColor(COLOR_ACCENT_DARK);
        heading.setTextSize(18);
        card.addView(heading);
        card.addView(body(subtitle));
        TextView open = text("Open module →", 13, COLOR_ACCENT, Typeface.BOLD);
        open.setPadding(0, dp(10), 0, 0);
        card.addView(open);
        page.addView(card);
        page.addView(space(10));
    }

    private void addOfflineNotice() {
        page.addView(space(18));
        LinearLayout notice = card();
        notice.setBackground(background(Color.rgb(237, 247, 255), dp(14), Color.rgb(184, 221, 246)));
        TextView heading = title("Local-first native build");
        heading.setTextSize(15);
        notice.addView(heading);
        notice.addView(body("Data এখন এই Android device-এর private SQLite database-এ সংরক্ষিত হবে। Expo, WebView এবং unavailable API ছাড়াই app কাজ করবে। App data clear/uninstall করার আগে module-wise CSV export রাখুন।"));
        page.addView(notice);
    }

    private LinearLayout metric(String label, String value) {
        LinearLayout box = card();
        box.setMinimumHeight(dp(94));
        TextView labelView = text(label, 12, COLOR_MUTED, Typeface.BOLD);
        TextView valueView = text(value, 20, COLOR_TEXT, Typeface.BOLD);
        valueView.setPadding(0, dp(8), 0, 0);
        box.addView(labelView);
        box.addView(valueView);
        return box;
    }

    private void section(String text) {
        TextView heading = title(text);
        heading.setTextSize(19);
        heading.setPadding(0, dp(18), 0, dp(10));
        page.addView(heading);
    }

    private LinearLayout card() {
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(dp(16), dp(16), dp(16), dp(16));
        card.setBackground(background(Color.WHITE, dp(14), COLOR_BORDER));
        LinearLayout.LayoutParams params = matchWrap();
        params.bottomMargin = dp(2);
        card.setLayoutParams(params);
        return card;
    }

    private EditText input(String hint, boolean password, boolean multiline) {
        EditText input = new EditText(this);
        input.setHint(hint);
        input.setHintTextColor(Color.rgb(143, 156, 168));
        input.setTextColor(COLOR_TEXT);
        input.setTextSize(15);
        input.setSingleLine(!multiline);
        input.setPadding(dp(12), dp(11), dp(12), dp(11));
        input.setBackground(background(Color.WHITE, dp(10), COLOR_BORDER));
        if (password) input.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);
        if (multiline) {
            input.setMinLines(3);
            input.setGravity(Gravity.TOP | Gravity.START);
            input.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_MULTI_LINE | InputType.TYPE_TEXT_FLAG_CAP_SENTENCES);
        }
        LinearLayout.LayoutParams params = matchWrap();
        params.topMargin = dp(8);
        params.bottomMargin = dp(8);
        input.setLayoutParams(params);
        return input;
    }

    private TextView title(String value) { return text(value, 22, COLOR_TEXT, Typeface.BOLD); }
    private TextView body(String value) {
        TextView view = text(value, 14, COLOR_MUTED, Typeface.NORMAL);
        view.setLineSpacing(0, 1.18f);
        view.setPadding(0, dp(6), 0, dp(8));
        return view;
    }
    private TextView label(String value) {
        TextView view = text(value, 13, COLOR_TEXT, Typeface.BOLD);
        view.setPadding(0, dp(8), 0, 0);
        return view;
    }

    private TextView text(String value, int sizeSp, int color, int style) {
        TextView view = new TextView(this);
        view.setText(value);
        view.setTextSize(sizeSp);
        view.setTextColor(color);
        view.setTypeface(Typeface.create(Typeface.DEFAULT, style));
        return view;
    }

    private TextView chip(String value, int color) {
        TextView chip = text(value == null || value.isEmpty() ? "—" : value.toUpperCase(Locale.US), 11, Color.WHITE, Typeface.BOLD);
        chip.setGravity(Gravity.CENTER);
        chip.setPadding(dp(10), dp(6), dp(10), dp(6));
        chip.setBackground(background(color, dp(20), color));
        LinearLayout.LayoutParams params = wrapWrap();
        params.topMargin = dp(8);
        params.bottomMargin = dp(8);
        chip.setLayoutParams(params);
        return chip;
    }

    private Button primaryButton(String text) {
        Button button = new Button(this);
        button.setText(text);
        button.setTextColor(Color.WHITE);
        button.setTextSize(15);
        button.setAllCaps(false);
        button.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        button.setBackground(background(COLOR_ACCENT, dp(10), COLOR_ACCENT));
        LinearLayout.LayoutParams params = matchWrap();
        params.height = dp(52);
        params.topMargin = dp(10);
        button.setLayoutParams(params);
        return button;
    }

    private Button outlineButton(String text) {
        Button button = new Button(this);
        button.setText(text);
        button.setTextColor(COLOR_ACCENT_DARK);
        button.setAllCaps(false);
        button.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        button.setBackground(background(Color.WHITE, dp(10), COLOR_BORDER));
        LinearLayout.LayoutParams params = matchWrap();
        params.height = dp(48);
        params.topMargin = dp(6);
        button.setLayoutParams(params);
        return button;
    }

    private Button smallButton(String text, int color) {
        Button button = new Button(this);
        button.setText(text);
        button.setTextColor(Color.WHITE);
        button.setTextSize(12);
        button.setAllCaps(false);
        button.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        button.setMinHeight(0);
        button.setMinimumHeight(0);
        button.setPadding(dp(10), dp(9), dp(10), dp(9));
        button.setBackground(background(color, dp(8), color));
        return button;
    }

    private Button textButton(String text) {
        Button button = new Button(this);
        button.setText(text);
        button.setTextColor(COLOR_ACCENT_DARK);
        button.setTextSize(13);
        button.setAllCaps(false);
        button.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        button.setBackgroundColor(Color.TRANSPARENT);
        button.setMinWidth(0);
        button.setMinimumWidth(0);
        return button;
    }

    private LinearLayout horizontalButtons() {
        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.CENTER_VERTICAL);
        LinearLayout.LayoutParams params = matchWrap();
        params.topMargin = dp(10);
        row.setLayoutParams(params);
        return row;
    }

    private GradientDrawable background(int fill, float radius, int stroke) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setColor(fill);
        drawable.setCornerRadius(radius);
        drawable.setStroke(dp(1), stroke);
        return drawable;
    }

    private Space space(int valueDp) {
        Space space = new Space(this);
        space.setLayoutParams(new LinearLayout.LayoutParams(dp(valueDp), dp(valueDp)));
        return space;
    }

    private LinearLayout.LayoutParams matchWrap() {
        return new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
    }
    private LinearLayout.LayoutParams matchMatch() {
        return new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT);
    }
    private LinearLayout.LayoutParams wrapWrap() {
        return new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
    }
    private LinearLayout.LayoutParams weighted() {
        return new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
    }

    private String recordPrimary(String module, LocalDb.Record record) {
        switch (module) {
            case "customers": return nonEmpty(record.get("name"), "Unnamed customer");
            case "products": return nonEmpty(record.get("name"), "Unnamed product");
            case "tasks": return nonEmpty(record.get("title"), "Untitled task");
            case "service": return nonEmpty(record.get("ticket_number"), "Service Ticket") + " • " + nonEmpty(record.get("customer_name"), "Customer");
            default: return "Record";
        }
    }

    private String recordSecondary(String module, LocalDb.Record record) {
        switch (module) {
            case "customers":
                return join(" • ", record.get("phone"), record.get("company_name"), record.get("city"), record.get("address"));
            case "products":
                return join(" • ",
                    prefix("SKU: ", record.get("sku")),
                    prefix("Stock: ", record.get("current_stock") + " " + record.get("unit")),
                    prefix("Sell: ৳ ", record.get("selling_price")),
                    join(" ", record.get("brand"), record.get("model"))
                );
            case "tasks":
                return join(" • ", record.get("department"), prefix("Due: ", record.get("due_date")), record.get("priority"), record.get("notes"));
            case "service":
                return join(" • ", record.get("phone"), record.get("machine_model"), prefix("Serial: ", record.get("serial_number")), record.get("problem_description"), prefix("Visit: ", record.get("visit_date")));
            default: return "";
        }
    }

    private FieldSpec[] fieldsFor(String module) {
        switch (module) {
            case "customers":
                return new FieldSpec[]{
                    field("name", "Customer name", true), field("phone", "Phone", false),
                    field("company_name", "Company / Factory", false), fieldMulti("address", "Address"),
                    field("city", "City / Area", false), fieldNumber("credit_limit", "Credit limit")
                };
            case "products":
                return new FieldSpec[]{
                    field("name", "Product name", true), field("sku", "SKU", false), field("brand", "Brand", false),
                    field("model", "Model", false), fieldDefault("unit", "Unit", "pcs"),
                    fieldNumber("purchase_price", "Purchase price"), fieldNumber("selling_price", "Selling price"),
                    fieldNumber("current_stock", "Current / Opening stock"), fieldNumber("min_stock", "Minimum stock")
                };
            case "tasks":
                return new FieldSpec[]{
                    field("title", "Task title", true), field("department", "Department", false),
                    field("due_date", "Due date (YYYY-MM-DD)", false), fieldDefault("priority", "Priority", "Normal"),
                    fieldMulti("notes", "Notes"), fieldDefault("status", "Status", "New")
                };
            case "service":
                return new FieldSpec[]{
                    field("customer", "Customer name", true), field("phone", "Phone", false),
                    field("machine_model", "Machine model", false), field("serial_number", "Serial number", false),
                    field("issue_category", "Issue category", false), fieldMulti("problem_description", "Problem description"),
                    fieldDefault("priority", "Priority", "Normal"), field("visit_date", "Visit date (YYYY-MM-DD)", false),
                    fieldDefault("status", "Status", "Open")
                };
            default: throw new IllegalArgumentException("Unknown module");
        }
    }

    private FieldSpec field(String key, String label, boolean required) { return new FieldSpec(key, label, required, false, false, null); }
    private FieldSpec fieldMulti(String key, String label) { return new FieldSpec(key, label, false, false, true, null); }
    private FieldSpec fieldNumber(String key, String label) { return new FieldSpec(key, label, false, true, false, "0"); }
    private FieldSpec fieldDefault(String key, String label, String value) { return new FieldSpec(key, label, false, false, false, value); }

    private String existingValue(LocalDb.Record record, String key) {
        if (record == null) return "";
        if ("customer".equals(key)) return record.get("customer_name");
        return record.get(key);
    }

    private String moduleTitle(String module) {
        switch (module) {
            case "customers": return "Customers";
            case "products": return "Products & Stock";
            case "tasks": return "Office Tasks";
            case "service": return "Service Tickets";
            default: return "Module";
        }
    }

    private String moduleSubtitle(String module) {
        switch (module) {
            case "customers": return "Customer contact, company, address and credit limit.";
            case "products": return "Product master, pricing, stock quantity and low-stock control.";
            case "tasks": return "Department work, deadline, priority, notes and completion status.";
            case "service": return "Machine service issue, serial, visit schedule and ticket workflow.";
            default: return "";
        }
    }

    private int statusColor(String status) {
        String normalized = status == null ? "" : status.toLowerCase(Locale.US);
        if (normalized.contains("completed") || normalized.contains("resolved") || normalized.contains("closed")) return COLOR_SUCCESS;
        if (normalized.contains("progress") || normalized.contains("assigned")) return COLOR_ACCENT;
        return Color.rgb(194, 118, 20);
    }

    private void saveSession(long userId, String name, String role) {
        session.edit().putLong(KEY_USER_ID, userId).putString(KEY_USER_NAME, name).putString(KEY_USER_ROLE, role).apply();
    }

    private boolean trackingActive() {
        return getSharedPreferences(BackgroundLocationService.PREFS, MODE_PRIVATE).getBoolean(BackgroundLocationService.KEY_ACTIVE, false);
    }

    private void startDuty() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, NOTIFICATION_PERMISSION_REQUEST);
        }
        if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION}, LOCATION_PERMISSION_REQUEST);
            toast("Location permission is required to start duty tracking.");
            return;
        }
        requestBackgroundLocationIfNeeded();
        BackgroundLocationService.start(this, UUID.randomUUID().toString());
        toast("Duty route tracking started.");
        showDashboard();
    }

    private void requestBackgroundLocationIfNeeded() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R && checkSelfPermission(Manifest.permission.ACCESS_BACKGROUND_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            new AlertDialog.Builder(this)
                .setTitle("Allow background location")
                .setMessage("Permissions → Location → Allow all the time নির্বাচন করুন। COLORJET শুধু active duty/customer visit চলাকালে location সংগ্রহ করবে।")
                .setNegativeButton("Later", null)
                .setPositiveButton("Open Settings", (dialog, which) -> openAppSettings())
                .show();
        } else if (Build.VERSION.SDK_INT == Build.VERSION_CODES.Q && checkSelfPermission(Manifest.permission.ACCESS_BACKGROUND_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.ACCESS_BACKGROUND_LOCATION}, LOCATION_PERMISSION_REQUEST);
        }
    }

    private void openAppSettings() {
        startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getPackageName())));
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == LOCATION_PERMISSION_REQUEST && checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
            requestBackgroundLocationIfNeeded();
        }
    }

    private void hideKeyboard() {
        View focused = getCurrentFocus();
        if (focused == null) return;
        InputMethodManager keyboard = (InputMethodManager) getSystemService(Context.INPUT_METHOD_SERVICE);
        keyboard.hideSoftInputFromWindow(focused.getWindowToken(), 0);
    }

    private String clean(EditText input) { return input.getText().toString().trim(); }
    private String clean(String value) { return value == null ? "" : value.trim(); }
    private double number(String value) {
        try { return Double.parseDouble(clean(value).replace(",", "")); }
        catch (Exception ignored) { return 0; }
    }
    private String nonEmpty(String value, String fallback) { return clean(value).isEmpty() ? fallback : value; }
    private String prefix(String prefix, String value) { return clean(value).isEmpty() ? "" : prefix + value; }

    private String join(String separator, String... values) {
        StringBuilder result = new StringBuilder();
        for (String value : values) {
            String clean = clean(value);
            if (clean.isEmpty()) continue;
            if (result.length() > 0) result.append(separator);
            result.append(clean);
        }
        return result.length() == 0 ? "—" : result.toString();
    }

    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }
    private void toast(String message) { Toast.makeText(this, message, Toast.LENGTH_LONG).show(); }

    @Override
    public void onBackPressed() {
        if (currentModule != null) showDashboard();
        else super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (db != null) db.close();
        super.onDestroy();
    }

    private static final class FieldSpec {
        final String key;
        final String label;
        final boolean required;
        final boolean numeric;
        final boolean multiline;
        final String defaultValue;

        FieldSpec(String key, String label, boolean required, boolean numeric, boolean multiline, String defaultValue) {
            this.key = key;
            this.label = label;
            this.required = required;
            this.numeric = numeric;
            this.multiline = multiline;
            this.defaultValue = defaultValue;
        }
    }
}
