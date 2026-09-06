"""
COLORJET ERP — Customer 360 standalone read-only service.

Wraps the 7 cj.usp_Customer360_* stored procedures behind plain HTTP
endpoints, using a dedicated EXECUTE-only SQL login (colorjet_c360_ro —
see database/mssql/09_customer360_readonly_login.sql). No table writes are
possible even if this code has a bug, because the DB login itself has no
write grants.

SECURITY — read before deploying:
This service has no way to validate the live ERP's own login session
(that would require the .NET app's cookie/token signing key, which is
not available here). It is protected only by a shared API key checked on
every request. That is enough to keep it as a STAFF-ONLY / INTERNAL tool
(e.g. called from a trusted script, an admin dashboard proxy, or curl by
staff who hold the key) — it is NOT safe to call directly from customer
portal browser JavaScript, because the key would be visible in the page
source and any customer could then read any other customer's data by
changing the customerAccountId in the URL. Wiring this into the
customer-facing portal needs real per-user auth, which requires the
.NET application's source/cooperation.
"""
import os
import pyodbc
from flask import Flask, request, jsonify, abort

app = Flask(__name__)

API_KEY = os.environ.get("CJEXT_C360_API_KEY")
DB_SERVER = os.environ.get("CJEXT_C360_DB_SERVER", "127.0.0.1,1433")
DB_NAME = os.environ.get("CJEXT_C360_DB_NAME", "COLORJET_ERP")
DB_USER = os.environ.get("CJEXT_C360_DB_USER", "colorjet_c360_ro")
DB_PASSWORD = os.environ.get("CJEXT_C360_DB_PASSWORD")

if not API_KEY or not DB_PASSWORD:
    raise RuntimeError(
        "CJEXT_C360_API_KEY and CJEXT_C360_DB_PASSWORD must be set in the "
        "environment (see cjext-customer360.env.example). Refusing to start "
        "with a missing secret rather than falling back to an insecure default."
    )

CONN_STR = (
    "DRIVER={ODBC Driver 18 for SQL Server};"
    f"SERVER={DB_SERVER};DATABASE={DB_NAME};"
    f"UID={DB_USER};PWD={DB_PASSWORD};"
    "Encrypt=yes;TrustServerCertificate=yes;"
)


def get_conn():
    return pyodbc.connect(CONN_STR, timeout=10)


def _camel(col_name):
    return col_name[:1].lower() + col_name[1:] if col_name else col_name


def rows_as_dicts(cursor):
    columns = [_camel(col[0]) for col in cursor.description]
    return [dict(zip(columns, row)) for row in cursor.fetchall()]


@app.before_request
def check_api_key():
    if request.path == "/health":
        return
    if request.headers.get("X-Internal-Api-Key") != API_KEY:
        abort(401)


@app.get("/health")
def health():
    return jsonify({"status": "ok"})


def _exec_single_set(proc_name, param_value):
    with get_conn() as conn:
        cursor = conn.cursor()
        cursor.execute(f"EXEC {proc_name} ?", param_value)
        return rows_as_dicts(cursor)


@app.get("/customer/<customer_account_id>/header")
def header(customer_account_id):
    rows = _exec_single_set("cj.usp_Customer360_Header", customer_account_id)
    return jsonify(rows[0] if rows else None)


@app.get("/customer/<customer_account_id>/portal")
def portal(customer_account_id):
    rows = _exec_single_set("cj.usp_Customer360_Portal", customer_account_id)
    return jsonify(rows[0] if rows else None)


@app.get("/customer/<customer_account_id>/service")
def service(customer_account_id):
    return jsonify(_exec_single_set("cj.usp_Customer360_Service", customer_account_id))


@app.get("/customer/<customer_account_id>/sales")
def sales(customer_account_id):
    return jsonify(_exec_single_set("cj.usp_Customer360_Sales", customer_account_id))


@app.get("/customer/<customer_account_id>/machines")
def machines(customer_account_id):
    return jsonify(_exec_single_set("cj.usp_Customer360_Machines", customer_account_id))


@app.get("/customer/<customer_account_id>/warranty")
def warranty(customer_account_id):
    return jsonify(_exec_single_set("cj.usp_Customer360_Warranty", customer_account_id))


@app.get("/customer/<customer_account_id>/financial")
def financial(customer_account_id):
    with get_conn() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "EXEC cj.usp_Customer360_Financial @CustomerAccountId=?",
            customer_account_id,
        )
        summary_rows = rows_as_dicts(cursor)
        cursor.nextset()
        ledger_rows = rows_as_dicts(cursor)
        cursor.nextset()
        reconciliation_rows = rows_as_dicts(cursor)

    return jsonify(
        {
            "summary": summary_rows[0] if summary_rows else None,
            "ledger": ledger_rows,
            "reconciliation": reconciliation_rows[0] if reconciliation_rows else None,
        }
    )


@app.get("/engineer/<engineer_id>/header")
def engineer_header(engineer_id):
    rows = _exec_single_set("cj.usp_Engineer360_Header", engineer_id)
    return jsonify(rows[0] if rows else None)


@app.get("/engineer/<engineer_id>/tickets")
def engineer_tickets(engineer_id):
    return jsonify(_exec_single_set("cj.usp_Engineer360_Tickets", engineer_id))


@app.get("/engineer/<engineer_id>/parts")
def engineer_parts(engineer_id):
    return jsonify(_exec_single_set("cj.usp_Engineer360_Parts", engineer_id))


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=8091)
