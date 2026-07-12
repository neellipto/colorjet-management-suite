package com.colorjetbd.erp;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

public final class LocalDb extends SQLiteOpenHelper {
    private static final String DB_NAME = "colorjet_erp_native.db";
    private static final int DB_VERSION = 1;

    public LocalDb(Context context) {
        super(context, DB_NAME, null, DB_VERSION);
    }

    @Override
    public void onCreate(SQLiteDatabase db) {
        db.execSQL("CREATE TABLE users (" +
            "id INTEGER PRIMARY KEY AUTOINCREMENT," +
            "full_name TEXT NOT NULL," +
            "identifier TEXT NOT NULL UNIQUE COLLATE NOCASE," +
            "password_salt TEXT NOT NULL," +
            "password_hash TEXT NOT NULL," +
            "role TEXT NOT NULL DEFAULT 'OWNER'," +
            "active INTEGER NOT NULL DEFAULT 1," +
            "created_at TEXT NOT NULL)");

        db.execSQL("CREATE TABLE customers (" +
            "id INTEGER PRIMARY KEY AUTOINCREMENT," +
            "name TEXT NOT NULL," +
            "phone TEXT," +
            "company_name TEXT," +
            "address TEXT," +
            "city TEXT," +
            "credit_limit REAL NOT NULL DEFAULT 0," +
            "created_at TEXT NOT NULL," +
            "updated_at TEXT NOT NULL)");

        db.execSQL("CREATE TABLE products (" +
            "id INTEGER PRIMARY KEY AUTOINCREMENT," +
            "name TEXT NOT NULL," +
            "sku TEXT," +
            "brand TEXT," +
            "model TEXT," +
            "unit TEXT NOT NULL DEFAULT 'pcs'," +
            "purchase_price REAL NOT NULL DEFAULT 0," +
            "selling_price REAL NOT NULL DEFAULT 0," +
            "current_stock REAL NOT NULL DEFAULT 0," +
            "min_stock REAL NOT NULL DEFAULT 0," +
            "created_at TEXT NOT NULL," +
            "updated_at TEXT NOT NULL)");

        db.execSQL("CREATE TABLE tasks (" +
            "id INTEGER PRIMARY KEY AUTOINCREMENT," +
            "title TEXT NOT NULL," +
            "department TEXT," +
            "due_date TEXT," +
            "priority TEXT NOT NULL DEFAULT 'Normal'," +
            "notes TEXT," +
            "status TEXT NOT NULL DEFAULT 'New'," +
            "created_at TEXT NOT NULL," +
            "updated_at TEXT NOT NULL)");

        db.execSQL("CREATE TABLE service_tickets (" +
            "id INTEGER PRIMARY KEY AUTOINCREMENT," +
            "ticket_number TEXT NOT NULL UNIQUE," +
            "customer_name TEXT NOT NULL," +
            "phone TEXT," +
            "machine_model TEXT," +
            "serial_number TEXT," +
            "issue_category TEXT," +
            "problem_description TEXT," +
            "priority TEXT NOT NULL DEFAULT 'Normal'," +
            "visit_date TEXT," +
            "status TEXT NOT NULL DEFAULT 'Open'," +
            "created_at TEXT NOT NULL," +
            "updated_at TEXT NOT NULL)");

        db.execSQL("CREATE INDEX idx_customers_name ON customers(name)");
        db.execSQL("CREATE INDEX idx_products_name ON products(name)");
        db.execSQL("CREATE INDEX idx_tasks_status ON tasks(status)");
        db.execSQL("CREATE INDEX idx_service_status ON service_tickets(status)");
    }

    @Override
    public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {
        // Future migrations will be added here. Existing data is never dropped silently.
    }

    public boolean hasAnyUser() {
        try (Cursor cursor = getReadableDatabase().rawQuery("SELECT COUNT(*) FROM users", null)) {
            return cursor.moveToFirst() && cursor.getLong(0) > 0;
        }
    }

    public long createOwner(String fullName, String identifier, String password) {
        SecurityUtil.PasswordHash protectedPassword = SecurityUtil.hashPassword(password);
        ContentValues values = new ContentValues();
        values.put("full_name", fullName.trim());
        values.put("identifier", identifier.trim());
        values.put("password_salt", protectedPassword.salt);
        values.put("password_hash", protectedPassword.hash);
        values.put("role", "OWNER");
        values.put("active", 1);
        values.put("created_at", now());
        return getWritableDatabase().insertOrThrow("users", null, values);
    }

    public UserRecord authenticate(String identifier, String password) {
        UserRecord user = findUser(identifier);
        if (user == null || !user.active) return null;
        return SecurityUtil.verifyPassword(password, user.passwordSalt, user.passwordHash) ? user : null;
    }

    public UserRecord findUser(String identifier) {
        String sql = "SELECT id,full_name,identifier,password_salt,password_hash,role,active FROM users WHERE identifier = ? COLLATE NOCASE LIMIT 1";
        try (Cursor cursor = getReadableDatabase().rawQuery(sql, new String[]{identifier.trim()})) {
            if (!cursor.moveToFirst()) return null;
            return new UserRecord(
                cursor.getLong(0), cursor.getString(1), cursor.getString(2),
                cursor.getString(3), cursor.getString(4), cursor.getString(5), cursor.getInt(6) == 1
            );
        }
    }

    public boolean changePassword(long userId, String currentPassword, String newPassword) {
        UserRecord user = findUserById(userId);
        if (user == null || !SecurityUtil.verifyPassword(currentPassword, user.passwordSalt, user.passwordHash)) return false;
        SecurityUtil.PasswordHash protectedPassword = SecurityUtil.hashPassword(newPassword);
        ContentValues values = new ContentValues();
        values.put("password_salt", protectedPassword.salt);
        values.put("password_hash", protectedPassword.hash);
        return getWritableDatabase().update("users", values, "id=?", new String[]{String.valueOf(userId)}) == 1;
    }

    private UserRecord findUserById(long userId) {
        String sql = "SELECT id,full_name,identifier,password_salt,password_hash,role,active FROM users WHERE id=? LIMIT 1";
        try (Cursor cursor = getReadableDatabase().rawQuery(sql, new String[]{String.valueOf(userId)})) {
            if (!cursor.moveToFirst()) return null;
            return new UserRecord(
                cursor.getLong(0), cursor.getString(1), cursor.getString(2),
                cursor.getString(3), cursor.getString(4), cursor.getString(5), cursor.getInt(6) == 1
            );
        }
    }

    public Map<String, String> dashboardStats() {
        Map<String, String> stats = new LinkedHashMap<>();
        stats.put("Customers", scalar("SELECT COUNT(*) FROM customers"));
        stats.put("Products", scalar("SELECT COUNT(*) FROM products"));
        stats.put("Current stock", formatNumber(scalarDouble("SELECT COALESCE(SUM(current_stock),0) FROM products")));
        stats.put("Stock value", "৳ " + formatNumber(scalarDouble("SELECT COALESCE(SUM(current_stock * purchase_price),0) FROM products")));
        stats.put("Low stock", scalar("SELECT COUNT(*) FROM products WHERE current_stock <= min_stock"));
        stats.put("Pending tasks", scalar("SELECT COUNT(*) FROM tasks WHERE status <> 'Completed'"));
        stats.put("Open service", scalar("SELECT COUNT(*) FROM service_tickets WHERE status NOT IN ('Resolved','Closed')"));
        stats.put("Resolved service", scalar("SELECT COUNT(*) FROM service_tickets WHERE status IN ('Resolved','Closed')"));
        return stats;
    }

    public List<Record> search(String module, String query) {
        String table = tableFor(module);
        String q = "%" + (query == null ? "" : query.trim()) + "%";
        String where;
        String[] args;
        switch (module) {
            case "customers":
                where = "name LIKE ? OR phone LIKE ? OR company_name LIKE ? OR address LIKE ?";
                args = repeat(q, 4);
                break;
            case "products":
                where = "name LIKE ? OR sku LIKE ? OR brand LIKE ? OR model LIKE ?";
                args = repeat(q, 4);
                break;
            case "tasks":
                where = "title LIKE ? OR department LIKE ? OR status LIKE ? OR notes LIKE ?";
                args = repeat(q, 4);
                break;
            case "service":
                where = "ticket_number LIKE ? OR customer_name LIKE ? OR phone LIKE ? OR machine_model LIKE ? OR problem_description LIKE ?";
                args = repeat(q, 5);
                break;
            default:
                throw new IllegalArgumentException("Unknown module");
        }
        List<Record> records = new ArrayList<>();
        try (Cursor cursor = getReadableDatabase().query(table, null, where, args, null, null, "id DESC", "500")) {
            while (cursor.moveToNext()) records.add(toRecord(cursor));
        }
        return records;
    }

    public Record get(String module, long id) {
        String table = tableFor(module);
        try (Cursor cursor = getReadableDatabase().query(table, null, "id=?", new String[]{String.valueOf(id)}, null, null, null, "1")) {
            return cursor.moveToFirst() ? toRecord(cursor) : null;
        }
    }

    public long save(String module, long id, Map<String, String> input) {
        String table = tableFor(module);
        ContentValues values = new ContentValues();
        String timestamp = now();
        switch (module) {
            case "customers":
                required(values, "name", input);
                text(values, "phone", input);
                text(values, "company_name", input);
                text(values, "address", input);
                text(values, "city", input);
                number(values, "credit_limit", input);
                break;
            case "products":
                required(values, "name", input);
                text(values, "sku", input);
                text(values, "brand", input);
                text(values, "model", input);
                defaultText(values, "unit", input, "pcs");
                number(values, "purchase_price", input);
                number(values, "selling_price", input);
                numberFromAlias(values, "current_stock", input, "opening_stock");
                number(values, "min_stock", input);
                break;
            case "tasks":
                required(values, "title", input);
                text(values, "department", input);
                text(values, "due_date", input);
                defaultText(values, "priority", input, "Normal");
                text(values, "notes", input);
                defaultText(values, "status", input, "New");
                break;
            case "service":
                if (id == 0) values.put("ticket_number", createTicketNumber());
                requiredAlias(values, "customer_name", input, "customer");
                text(values, "phone", input);
                text(values, "machine_model", input);
                text(values, "serial_number", input);
                text(values, "issue_category", input);
                text(values, "problem_description", input);
                defaultText(values, "priority", input, "Normal");
                text(values, "visit_date", input);
                defaultText(values, "status", input, "Open");
                break;
            default:
                throw new IllegalArgumentException("Unknown module");
        }
        values.put("updated_at", timestamp);
        SQLiteDatabase db = getWritableDatabase();
        if (id > 0) {
            db.update(table, values, "id=?", new String[]{String.valueOf(id)});
            return id;
        }
        values.put("created_at", timestamp);
        return db.insertOrThrow(table, null, values);
    }

    public void delete(String module, long id) {
        getWritableDatabase().delete(tableFor(module), "id=?", new String[]{String.valueOf(id)});
    }

    public String advanceStatus(String module, long id) {
        Record record = get(module, id);
        if (record == null) return "";
        String current = record.get("status");
        String next;
        if ("tasks".equals(module)) {
            if ("New".equalsIgnoreCase(current)) next = "In Progress";
            else if ("In Progress".equalsIgnoreCase(current)) next = "Completed";
            else next = "New";
        } else if ("service".equals(module)) {
            if ("Open".equalsIgnoreCase(current)) next = "Assigned";
            else if ("Assigned".equalsIgnoreCase(current)) next = "In Progress";
            else if ("In Progress".equalsIgnoreCase(current)) next = "Resolved";
            else if ("Resolved".equalsIgnoreCase(current)) next = "Closed";
            else next = "Open";
        } else return current;
        ContentValues values = new ContentValues();
        values.put("status", next);
        values.put("updated_at", now());
        getWritableDatabase().update(tableFor(module), values, "id=?", new String[]{String.valueOf(id)});
        return next;
    }

    public String exportCsv(String module) {
        String table = tableFor(module);
        StringBuilder csv = new StringBuilder();
        try (Cursor cursor = getReadableDatabase().query(table, null, null, null, null, null, "id ASC")) {
            String[] columns = cursor.getColumnNames();
            for (int i = 0; i < columns.length; i++) {
                if (i > 0) csv.append(',');
                csv.append(csvCell(columns[i]));
            }
            csv.append('\n');
            while (cursor.moveToNext()) {
                for (int i = 0; i < columns.length; i++) {
                    if (i > 0) csv.append(',');
                    csv.append(csvCell(cursor.isNull(i) ? "" : cursor.getString(i)));
                }
                csv.append('\n');
            }
        }
        return csv.toString();
    }

    private Record toRecord(Cursor cursor) {
        Record record = new Record(cursor.getLong(cursor.getColumnIndexOrThrow("id")));
        String[] columns = cursor.getColumnNames();
        for (int i = 0; i < columns.length; i++) record.values.put(columns[i], cursor.isNull(i) ? "" : cursor.getString(i));
        return record;
    }

    private String tableFor(String module) {
        switch (module) {
            case "customers": return "customers";
            case "products": return "products";
            case "tasks": return "tasks";
            case "service": return "service_tickets";
            default: throw new IllegalArgumentException("Unknown module: " + module);
        }
    }

    private String scalar(String sql) {
        try (Cursor cursor = getReadableDatabase().rawQuery(sql, null)) {
            return cursor.moveToFirst() ? cursor.getString(0) : "0";
        }
    }

    private double scalarDouble(String sql) {
        try (Cursor cursor = getReadableDatabase().rawQuery(sql, null)) {
            return cursor.moveToFirst() ? cursor.getDouble(0) : 0;
        }
    }

    private void required(ContentValues values, String key, Map<String, String> input) {
        String value = clean(input.get(key));
        if (value.isEmpty()) throw new IllegalArgumentException(label(key) + " is required.");
        values.put(key, value);
    }

    private void requiredAlias(ContentValues values, String dbKey, Map<String, String> input, String inputKey) {
        String value = clean(input.get(inputKey));
        if (value.isEmpty()) value = clean(input.get(dbKey));
        if (value.isEmpty()) throw new IllegalArgumentException(label(dbKey) + " is required.");
        values.put(dbKey, value);
    }

    private void text(ContentValues values, String key, Map<String, String> input) {
        values.put(key, clean(input.get(key)));
    }

    private void defaultText(ContentValues values, String key, Map<String, String> input, String fallback) {
        String value = clean(input.get(key));
        values.put(key, value.isEmpty() ? fallback : value);
    }

    private void number(ContentValues values, String key, Map<String, String> input) {
        values.put(key, parseNumber(input.get(key)));
    }

    private void numberFromAlias(ContentValues values, String key, Map<String, String> input, String alias) {
        String raw = input.containsKey(key) ? input.get(key) : input.get(alias);
        values.put(key, parseNumber(raw));
    }

    private double parseNumber(String raw) {
        try { return Double.parseDouble(clean(raw).replace(",", "")); }
        catch (Exception ignored) { return 0; }
    }

    private String createTicketNumber() {
        return "CJT-" + new SimpleDateFormat("yyyyMMdd-HHmmss", Locale.US).format(new Date());
    }

    private String now() {
        return new SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US).format(new Date());
    }

    private String[] repeat(String value, int count) {
        String[] values = new String[count];
        for (int i = 0; i < count; i++) values[i] = value;
        return values;
    }

    private String clean(String value) { return value == null ? "" : value.trim(); }
    private String label(String key) { return key.replace('_', ' '); }

    private String formatNumber(double value) {
        if (Math.abs(value - Math.rint(value)) < 0.000001) return String.format(Locale.US, "%,.0f", value);
        return String.format(Locale.US, "%,.2f", value);
    }

    private String csvCell(String value) {
        return "\"" + value.replace("\"", "\"\"").replace("\r", " ").replace("\n", " ") + "\"";
    }

    public static final class UserRecord {
        public final long id;
        public final String fullName;
        public final String identifier;
        public final String passwordSalt;
        public final String passwordHash;
        public final String role;
        public final boolean active;

        UserRecord(long id, String fullName, String identifier, String passwordSalt, String passwordHash, String role, boolean active) {
            this.id = id;
            this.fullName = fullName;
            this.identifier = identifier;
            this.passwordSalt = passwordSalt;
            this.passwordHash = passwordHash;
            this.role = role;
            this.active = active;
        }
    }

    public static final class Record {
        public final long id;
        public final Map<String, String> values = new LinkedHashMap<>();
        Record(long id) { this.id = id; }
        public String get(String key) { String value = values.get(key); return value == null ? "" : value; }
    }
}
