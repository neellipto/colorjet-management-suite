/* =============================================================================
   COLORJET ERP v3.3 — Canonical Identity, RBAC, Portals, Sessions, Audit,
   Service/Engineer Workflow & Machine 360   (Microsoft SQL Server)
   -----------------------------------------------------------------------------
   Implements the identity/access data model from the v3.3 requirement spec:

     * ONE canonical identity: ERP USER -> ROLE/PERMISSIONS
       -> (EMPLOYEE | ENGINEER | CUSTOMER | OWNER) link — NO duplicate masters.
     * Portal accounts (Customer / Engineer) LINK to the existing canonical
       Customer / Employee mirror rows; they never create a second master.
     * Server-side RBAC: roles, permissions, role_permissions, user overrides.
     * Sessions, login audit, admin impersonation log, account status.
     * Customer Service Request -> Ticket -> Engineer Job workflow with an
       immutable status-transition history and parts flow.
     * Machine 360 lifetime record.

   Design rules kept from the spec:
     - No second user / customer-login / engineer identity store.
     - Passwords are HASHED only (never plaintext); reset via invitations.
     - Every portal identity supports ACTIVE/INACTIVE/LOCKED/PASSWORD_CHANGE_REQUIRED
       (+ INVITED/INVITE_EXPIRED). Business history is preserved (no hard delete).

   Canonical links use the read-only report.* mirror (report.customers /
   report.products, which each carry the unique odoo_id) — that mirror is NOT a
   second master, it is the sync image of the ERP's own records.

   Run after 01..04. Idempotent. SQL Server 2019+ / Azure SQL.
   ============================================================================= */
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO
IF SCHEMA_ID(N'identity') IS NULL EXEC (N'CREATE SCHEMA [identity] AUTHORIZATION [dbo];');
GO
IF SCHEMA_ID(N'service')  IS NULL EXEC (N'CREATE SCHEMA [service]  AUTHORIZATION [dbo];');
GO
IF SCHEMA_ID(N'assets')   IS NULL EXEC (N'CREATE SCHEMA [assets]   AUTHORIZATION [dbo];');
GO

/* ===========================================================================
   1. CANONICAL USER  (the single identity)
   =========================================================================== */
IF OBJECT_ID(N'identity.users', N'U') IS NULL
BEGIN
    CREATE TABLE identity.users
    (
        id                   UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_users_id DEFAULT NEWSEQUENTIALID(),
        erp_user_id          BIGINT           NULL,          -- canonical ERP/Odoo user id (unique when present)
        username             NVARCHAR(128)    NULL,
        email                NVARCHAR(256)    NULL,
        mobile               NVARCHAR(64)     NULL,
        password_hash        NVARCHAR(512)    NULL,          -- hashed only; NULL until invite accepted
        password_algo        NVARCHAR(32)     NULL CONSTRAINT DF_users_algo DEFAULT (N'bcrypt'),
        user_type            NVARCHAR(32)     NOT NULL,      -- OWNER/ADMIN/MANAGER/ACCOUNTS/COMMERCIAL/SALES/STORE/SERVICE_MANAGER/ENGINEER/OFFICE_STAFF/DELIVERY_LOGISTICS/CUSTOMER
        status               NVARCHAR(32)     NOT NULL CONSTRAINT DF_users_status DEFAULT (N'ACTIVE'),
        force_password_change BIT             NOT NULL CONSTRAINT DF_users_fpc DEFAULT (0),
        last_login_at        DATETIME2(3)     NULL,
        failed_login_count   INT              NOT NULL CONSTRAINT DF_users_flc DEFAULT (0),
        locked_until         DATETIME2(3)     NULL,
        created_at           DATETIME2(3)     NOT NULL CONSTRAINT DF_users_ca DEFAULT (SYSUTCDATETIME()),
        updated_at           DATETIME2(3)     NOT NULL CONSTRAINT DF_users_ua DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_users PRIMARY KEY NONCLUSTERED (id),
        CONSTRAINT CK_users_type   CHECK (user_type IN
            (N'OWNER',N'ADMIN',N'MANAGER',N'ACCOUNTS',N'COMMERCIAL',N'SALES',N'STORE',
             N'SERVICE_MANAGER',N'ENGINEER',N'OFFICE_STAFF',N'DELIVERY_LOGISTICS',N'CUSTOMER')),
        CONSTRAINT CK_users_status CHECK (status IN
            (N'ACTIVE',N'INACTIVE',N'LOCKED',N'PASSWORD_CHANGE_REQUIRED',N'INVITED',N'INVITE_EXPIRED'))
    );
    CREATE UNIQUE INDEX UX_users_erp    ON identity.users (erp_user_id) WHERE erp_user_id IS NOT NULL;
    CREATE UNIQUE INDEX UX_users_email  ON identity.users (email)       WHERE email       IS NOT NULL;
    CREATE UNIQUE INDEX UX_users_mobile ON identity.users (mobile)      WHERE mobile      IS NOT NULL;
    CREATE UNIQUE INDEX UX_users_uname  ON identity.users (username)    WHERE username    IS NOT NULL;
END
GO

/* ===========================================================================
   2. ROLES / PERMISSIONS  (server-side RBAC)
   =========================================================================== */
IF OBJECT_ID(N'identity.roles', N'U') IS NULL
BEGIN
    CREATE TABLE identity.roles
    (
        id        UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_roles_id DEFAULT NEWSEQUENTIALID(),
        code      NVARCHAR(32)     NOT NULL,
        name      NVARCHAR(128)    NOT NULL,
        is_system BIT              NOT NULL CONSTRAINT DF_roles_sys DEFAULT (1),
        CONSTRAINT PK_roles PRIMARY KEY NONCLUSTERED (id),
        CONSTRAINT UQ_roles_code UNIQUE (code)
    );
END
GO
IF OBJECT_ID(N'identity.permissions', N'U') IS NULL
BEGIN
    CREATE TABLE identity.permissions
    (
        id       UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_perms_id DEFAULT NEWSEQUENTIALID(),
        code     NVARCHAR(128)    NOT NULL,  -- e.g. 'customer360.view', 'banking.manage', 'engineer.job.act'
        module   NVARCHAR(64)     NULL,
        name     NVARCHAR(200)    NULL,
        CONSTRAINT PK_perms PRIMARY KEY NONCLUSTERED (id),
        CONSTRAINT UQ_perms_code UNIQUE (code)
    );
END
GO
IF OBJECT_ID(N'identity.role_permissions', N'U') IS NULL
BEGIN
    CREATE TABLE identity.role_permissions
    (
        role_id       UNIQUEIDENTIFIER NOT NULL,
        permission_id UNIQUEIDENTIFIER NOT NULL,
        CONSTRAINT PK_role_permissions PRIMARY KEY (role_id, permission_id),
        CONSTRAINT FK_rp_role FOREIGN KEY (role_id)       REFERENCES identity.roles (id),
        CONSTRAINT FK_rp_perm FOREIGN KEY (permission_id) REFERENCES identity.permissions (id)
    );
END
GO
IF OBJECT_ID(N'identity.user_roles', N'U') IS NULL
BEGIN
    CREATE TABLE identity.user_roles
    (
        user_id UNIQUEIDENTIFIER NOT NULL,
        role_id UNIQUEIDENTIFIER NOT NULL,
        branch  NVARCHAR(128)    NULL,      -- optional branch scope
        CONSTRAINT PK_user_roles PRIMARY KEY (user_id, role_id),
        CONSTRAINT FK_ur_user FOREIGN KEY (user_id) REFERENCES identity.users (id),
        CONSTRAINT FK_ur_role FOREIGN KEY (role_id) REFERENCES identity.roles (id)
    );
END
GO
/* per-user grant/deny override (deny wins) */
IF OBJECT_ID(N'identity.user_permissions', N'U') IS NULL
BEGIN
    CREATE TABLE identity.user_permissions
    (
        user_id       UNIQUEIDENTIFIER NOT NULL,
        permission_id UNIQUEIDENTIFIER NOT NULL,
        effect        NVARCHAR(8)      NOT NULL CONSTRAINT DF_up_effect DEFAULT (N'ALLOW'),
        CONSTRAINT PK_user_permissions PRIMARY KEY (user_id, permission_id),
        CONSTRAINT CK_up_effect CHECK (effect IN (N'ALLOW', N'DENY')),
        CONSTRAINT FK_up_user FOREIGN KEY (user_id)       REFERENCES identity.users (id),
        CONSTRAINT FK_up_perm FOREIGN KEY (permission_id) REFERENCES identity.permissions (id)
    );
END
GO

/* Seed the canonical roles (idempotent). */
MERGE identity.roles AS t
USING (VALUES
    (N'OWNER',N'Owner'),(N'ADMIN',N'Administrator'),(N'MANAGER',N'Manager'),
    (N'ACCOUNTS',N'Accounts'),(N'COMMERCIAL',N'Commercial'),(N'SALES',N'Sales'),
    (N'STORE',N'Store'),(N'SERVICE_MANAGER',N'Service Manager'),(N'ENGINEER',N'Engineer'),
    (N'OFFICE_STAFF',N'Office Staff'),(N'DELIVERY_LOGISTICS',N'Delivery / Logistics'),
    (N'CUSTOMER',N'Customer')
) AS s(code,name) ON t.code = s.code
WHEN NOT MATCHED THEN INSERT (code,name,is_system) VALUES (s.code,s.name,1);
GO

/* ===========================================================================
   3. IDENTITY LINKS  (one user -> canonical employee / customer / engineer)
   =========================================================================== */
IF OBJECT_ID(N'identity.user_employee_links', N'U') IS NULL
BEGIN
    CREATE TABLE identity.user_employee_links
    (
        user_id             UNIQUEIDENTIFIER NOT NULL,
        canonical_employee_id BIGINT         NOT NULL,   -- ERP employee id (NOT duplicated here)
        employee_code       NVARCHAR(64)     NULL,
        linked_at           DATETIME2(3)     NOT NULL CONSTRAINT DF_uel_at DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_user_employee_links PRIMARY KEY (user_id),
        CONSTRAINT UQ_uel_emp UNIQUE (canonical_employee_id),
        CONSTRAINT FK_uel_user FOREIGN KEY (user_id) REFERENCES identity.users (id)
    );
END
GO
IF OBJECT_ID(N'identity.user_customer_links', N'U') IS NULL
BEGIN
    CREATE TABLE identity.user_customer_links
    (
        user_id      UNIQUEIDENTIFIER NOT NULL,
        customer_id  UNIQUEIDENTIFIER NOT NULL,           -- FK to report.customers mirror (carries odoo_id)
        portal_status NVARCHAR(32)    NOT NULL CONSTRAINT DF_ucl_status DEFAULT (N'ACTIVE'),
        linked_at    DATETIME2(3)     NOT NULL CONSTRAINT DF_ucl_at DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_user_customer_links PRIMARY KEY (user_id),
        CONSTRAINT UQ_ucl_customer UNIQUE (customer_id),  -- one portal user per canonical customer
        CONSTRAINT FK_ucl_user     FOREIGN KEY (user_id)     REFERENCES identity.users (id),
        CONSTRAINT FK_ucl_customer FOREIGN KEY (customer_id) REFERENCES report.customers (id),
        CONSTRAINT CK_ucl_status CHECK (portal_status IN (N'ACTIVE',N'INACTIVE',N'LOCKED',N'INVITED',N'INVITE_EXPIRED',N'REVOKED'))
    );
END
GO
IF OBJECT_ID(N'identity.engineer_profiles', N'U') IS NULL
BEGIN
    CREATE TABLE identity.engineer_profiles
    (
        user_id       UNIQUEIDENTIFIER NOT NULL,          -- must also be an employee-linked user
        specialty      NVARCHAR(128)   NULL,
        service_zone   NVARCHAR(128)   NULL,
        is_active      BIT             NOT NULL CONSTRAINT DF_eng_active DEFAULT (1),
        created_at     DATETIME2(3)    NOT NULL CONSTRAINT DF_eng_ca DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_engineer_profiles PRIMARY KEY (user_id),
        CONSTRAINT FK_eng_user FOREIGN KEY (user_id) REFERENCES identity.users (id)
    );
END
GO

/* ===========================================================================
   4. PORTAL INVITATIONS / PASSWORD RESET  (secure, hashed tokens)
   =========================================================================== */
IF OBJECT_ID(N'identity.invitations', N'U') IS NULL
BEGIN
    CREATE TABLE identity.invitations
    (
        id           UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_inv_id DEFAULT NEWSEQUENTIALID(),
        user_id      UNIQUEIDENTIFIER NOT NULL,
        purpose      NVARCHAR(32)     NOT NULL CONSTRAINT DF_inv_purpose DEFAULT (N'PORTAL_SETUP'), -- PORTAL_SETUP/PASSWORD_RESET
        token_hash   NVARCHAR(256)    NOT NULL,           -- hashed one-time token; plaintext never stored
        channel      NVARCHAR(16)     NULL,               -- EMAIL/SMS/MANUAL
        status       NVARCHAR(16)     NOT NULL CONSTRAINT DF_inv_status DEFAULT (N'PENDING'),
        expires_at   DATETIME2(3)     NOT NULL,
        consumed_at  DATETIME2(3)     NULL,
        created_by   UNIQUEIDENTIFIER NULL,
        created_at   DATETIME2(3)     NOT NULL CONSTRAINT DF_inv_ca DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_invitations PRIMARY KEY NONCLUSTERED (id),
        CONSTRAINT CK_inv_status CHECK (status IN (N'PENDING',N'CONSUMED',N'EXPIRED',N'REVOKED')),
        CONSTRAINT FK_inv_user FOREIGN KEY (user_id) REFERENCES identity.users (id)
    );
    CREATE INDEX IX_inv_user ON identity.invitations (user_id, status);
END
GO

/* ===========================================================================
   5. SESSIONS + LOGIN AUDIT + IMPERSONATION
   =========================================================================== */
IF OBJECT_ID(N'identity.sessions', N'U') IS NULL
BEGIN
    CREATE TABLE identity.sessions
    (
        id           UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_sess_id DEFAULT NEWSEQUENTIALID(),
        user_id      UNIQUEIDENTIFIER NOT NULL,
        token_hash   NVARCHAR(256)    NULL,               -- hashed refresh/session token
        ip_address   NVARCHAR(64)     NULL,
        device       NVARCHAR(256)    NULL,
        created_at   DATETIME2(3)     NOT NULL CONSTRAINT DF_sess_ca DEFAULT (SYSUTCDATETIME()),
        last_seen_at DATETIME2(3)     NULL,
        revoked_at   DATETIME2(3)     NULL,
        revoked_by   UNIQUEIDENTIFIER NULL,
        CONSTRAINT PK_sessions PRIMARY KEY NONCLUSTERED (id),
        CONSTRAINT FK_sess_user FOREIGN KEY (user_id) REFERENCES identity.users (id)
    );
    CREATE INDEX IX_sess_user ON identity.sessions (user_id) INCLUDE (revoked_at);
END
GO
IF OBJECT_ID(N'identity.login_audit', N'U') IS NULL
BEGIN
    CREATE TABLE identity.login_audit
    (
        id             UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_la_id DEFAULT NEWSEQUENTIALID(),
        user_id        UNIQUEIDENTIFIER NULL,             -- null when username unknown
        attempted_login NVARCHAR(256)   NULL,
        event_type     NVARCHAR(32)     NOT NULL,         -- LOGIN/LOGOUT/PASSWORD_RESET/ADMIN_REVOKE/LOCKED
        success        BIT              NOT NULL CONSTRAINT DF_la_success DEFAULT (0),
        failure_reason NVARCHAR(256)    NULL,
        ip_address     NVARCHAR(64)     NULL,
        device         NVARCHAR(256)    NULL,
        session_id     UNIQUEIDENTIFIER NULL,
        event_at       DATETIME2(3)     NOT NULL CONSTRAINT DF_la_at DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_login_audit PRIMARY KEY NONCLUSTERED (id)
    );
    CREATE INDEX IX_la_user ON identity.login_audit (user_id, event_at DESC);
    CREATE INDEX IX_la_time ON identity.login_audit (event_at DESC);
END
GO
IF OBJECT_ID(N'identity.impersonation_log', N'U') IS NULL
BEGIN
    CREATE TABLE identity.impersonation_log
    (
        id            UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_imp_id DEFAULT NEWSEQUENTIALID(),
        admin_user_id UNIQUEIDENTIFIER NOT NULL,
        target_user_id UNIQUEIDENTIFIER NOT NULL,
        reason        NVARCHAR(512)    NULL,
        started_at    DATETIME2(3)     NOT NULL CONSTRAINT DF_imp_start DEFAULT (SYSUTCDATETIME()),
        ended_at      DATETIME2(3)     NULL,
        CONSTRAINT PK_impersonation_log PRIMARY KEY NONCLUSTERED (id),
        CONSTRAINT FK_imp_admin  FOREIGN KEY (admin_user_id)  REFERENCES identity.users (id),
        CONSTRAINT FK_imp_target FOREIGN KEY (target_user_id) REFERENCES identity.users (id)
    );
END
GO

/* ===========================================================================
   6. MACHINE 360  (lifetime record; links canonical customer + product)
   =========================================================================== */
IF OBJECT_ID(N'assets.machines', N'U') IS NULL
BEGIN
    CREATE TABLE assets.machines
    (
        id               UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_mac_id DEFAULT NEWSEQUENTIALID(),
        odoo_id          BIGINT           NULL,
        model            NVARCHAR(256)    NOT NULL,
        serial_no        NVARCHAR(128)    NOT NULL,
        customer_id      UNIQUEIDENTIFIER NULL,
        product_id       UNIQUEIDENTIFIER NULL,
        sale_invoice_id  UNIQUEIDENTIFIER NULL,
        delivered_date   DATE             NULL,
        installed_date   DATE             NULL,
        warranty_end     DATE             NULL,
        status           NVARCHAR(32)     NOT NULL CONSTRAINT DF_mac_status DEFAULT (N'ACTIVE'),
        created_at       DATETIME2(3)     NOT NULL CONSTRAINT DF_mac_ca DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_machines PRIMARY KEY NONCLUSTERED (id),
        CONSTRAINT UQ_machines_serial UNIQUE (serial_no),
        CONSTRAINT FK_mac_customer FOREIGN KEY (customer_id)     REFERENCES report.customers (id),
        CONSTRAINT FK_mac_product  FOREIGN KEY (product_id)      REFERENCES report.products  (id),
        CONSTRAINT FK_mac_invoice  FOREIGN KEY (sale_invoice_id) REFERENCES report.sales_invoices (id)
    );
    CREATE INDEX IX_mac_customer ON assets.machines (customer_id);
END
GO

/* ===========================================================================
   7. SERVICE REQUEST -> TICKET -> ENGINEER JOB  (spec sections 12 & 16)
   =========================================================================== */
IF OBJECT_ID(N'service.service_requests', N'U') IS NULL
BEGIN
    CREATE TABLE service.service_requests
    (
        id             UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_sr_id DEFAULT NEWSEQUENTIALID(),
        request_no     NVARCHAR(64)     NOT NULL,
        customer_id    UNIQUEIDENTIFIER NULL,               -- canonical customer (report.customers)
        raised_by_user UNIQUEIDENTIFIER NULL,               -- portal user who raised it
        machine_id     UNIQUEIDENTIFIER NULL,
        machine_serial NVARCHAR(128)    NULL,
        problem        NVARCHAR(1000)   NOT NULL,
        priority       NVARCHAR(16)     NOT NULL CONSTRAINT DF_sr_priority DEFAULT (N'NORMAL'),
        address        NVARCHAR(1000)   NULL,
        preferred_date DATE             NULL,
        status         NVARCHAR(32)     NOT NULL CONSTRAINT DF_sr_status DEFAULT (N'CUSTOMER_REQUESTED'),
        created_at     DATETIME2(3)     NOT NULL CONSTRAINT DF_sr_ca DEFAULT (SYSUTCDATETIME()),
        updated_at     DATETIME2(3)     NOT NULL CONSTRAINT DF_sr_ua DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_service_requests PRIMARY KEY NONCLUSTERED (id),
        CONSTRAINT UQ_sr_no UNIQUE (request_no),
        CONSTRAINT CK_sr_status CHECK (status IN
            (N'CUSTOMER_REQUESTED',N'REVIEWED',N'TICKET_CREATED',N'ASSIGNED',
             N'ENGINEER_WORKFLOW',N'COMPLETED',N'CUSTOMER_CONFIRMED',N'CLOSED',N'CANCELLED')),
        CONSTRAINT FK_sr_customer FOREIGN KEY (customer_id) REFERENCES report.customers (id),
        CONSTRAINT FK_sr_user     FOREIGN KEY (raised_by_user) REFERENCES identity.users (id),
        CONSTRAINT FK_sr_machine  FOREIGN KEY (machine_id) REFERENCES assets.machines (id)
    );
    CREATE INDEX IX_sr_customer ON service.service_requests (customer_id, status);
END
GO
IF OBJECT_ID(N'service.engineer_jobs', N'U') IS NULL
BEGIN
    CREATE TABLE service.engineer_jobs
    (
        id             UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_ej_id DEFAULT NEWSEQUENTIALID(),
        job_no         NVARCHAR(64)     NOT NULL,
        request_id     UNIQUEIDENTIFIER NULL,
        customer_id    UNIQUEIDENTIFIER NULL,
        machine_id     UNIQUEIDENTIFIER NULL,
        engineer_user_id UNIQUEIDENTIFIER NULL,             -- assigned engineer (identity.users, ENGINEER)
        status         NVARCHAR(32)     NOT NULL CONSTRAINT DF_ej_status DEFAULT (N'ASSIGNED'),
        scheduled_date DATE             NULL,
        diagnosis      NVARCHAR(1000)   NULL,
        work_performed NVARCHAR(1000)   NULL,
        created_at     DATETIME2(3)     NOT NULL CONSTRAINT DF_ej_ca DEFAULT (SYSUTCDATETIME()),
        updated_at     DATETIME2(3)     NOT NULL CONSTRAINT DF_ej_ua DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_engineer_jobs PRIMARY KEY NONCLUSTERED (id),
        CONSTRAINT UQ_ej_no UNIQUE (job_no),
        CONSTRAINT CK_ej_status CHECK (status IN
            (N'ASSIGNED',N'ACCEPTED',N'TRAVELLING',N'ARRIVED',N'WORK_STARTED',N'WAITING_FOR_PARTS',
             N'PAUSED',N'RESUMED',N'COMPLETED',N'CUSTOMER_CONFIRMED',N'CLOSED',
             N'RESCHEDULED',N'ON_HOLD',N'VISIT_FAILED',N'CANCELLED',N'REOPENED')),
        CONSTRAINT FK_ej_request  FOREIGN KEY (request_id)  REFERENCES service.service_requests (id),
        CONSTRAINT FK_ej_customer FOREIGN KEY (customer_id) REFERENCES report.customers (id),
        CONSTRAINT FK_ej_machine  FOREIGN KEY (machine_id)  REFERENCES assets.machines (id),
        CONSTRAINT FK_ej_engineer FOREIGN KEY (engineer_user_id) REFERENCES identity.users (id)
    );
    CREATE INDEX IX_ej_engineer ON service.engineer_jobs (engineer_user_id, status);
    CREATE INDEX IX_ej_customer ON service.engineer_jobs (customer_id);
END
GO
/* immutable status-transition history (spec: Changed By/At/Location/Notes) */
IF OBJECT_ID(N'service.job_status_history', N'U') IS NULL
BEGIN
    CREATE TABLE service.job_status_history
    (
        id           UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_jsh_id DEFAULT NEWSEQUENTIALID(),
        job_id       UNIQUEIDENTIFIER NOT NULL,
        from_status  NVARCHAR(32)     NULL,
        to_status    NVARCHAR(32)     NOT NULL,
        changed_by   UNIQUEIDENTIFIER NULL,
        changed_at   DATETIME2(3)     NOT NULL CONSTRAINT DF_jsh_at DEFAULT (SYSUTCDATETIME()),
        geo_lat      DECIMAL(9,6)     NULL,
        geo_lng      DECIMAL(9,6)     NULL,
        notes        NVARCHAR(1000)   NULL,
        CONSTRAINT PK_job_status_history PRIMARY KEY NONCLUSTERED (id),
        CONSTRAINT FK_jsh_job  FOREIGN KEY (job_id)     REFERENCES service.engineer_jobs (id),
        CONSTRAINT FK_jsh_user FOREIGN KEY (changed_by) REFERENCES identity.users (id)
    );
    CREATE INDEX IX_jsh_job ON service.job_status_history (job_id, changed_at);
END
GO
/* engineer parts flow: REQUEST -> APPROVAL -> ISSUE -> RECEIPT -> USAGE -> RETURN */
IF OBJECT_ID(N'service.job_parts', N'U') IS NULL
BEGIN
    CREATE TABLE service.job_parts
    (
        id           UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_jp_id DEFAULT NEWSEQUENTIALID(),
        job_id       UNIQUEIDENTIFIER NOT NULL,
        product_id   UNIQUEIDENTIFIER NULL,
        quantity     DECIMAL(18,3)    NOT NULL CONSTRAINT DF_jp_qty DEFAULT (0),
        serial_no    NVARCHAR(180)    NULL,
        stage        NVARCHAR(32)     NOT NULL CONSTRAINT DF_jp_stage DEFAULT (N'REQUEST'),
        created_at   DATETIME2(3)     NOT NULL CONSTRAINT DF_jp_ca DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_job_parts PRIMARY KEY NONCLUSTERED (id),
        CONSTRAINT CK_jp_stage CHECK (stage IN (N'REQUEST',N'APPROVED',N'RESERVED',N'ISSUED',N'RECEIVED',N'USED',N'RETURNED')),
        CONSTRAINT FK_jp_job     FOREIGN KEY (job_id)     REFERENCES service.engineer_jobs (id),
        CONSTRAINT FK_jp_product FOREIGN KEY (product_id) REFERENCES report.products (id)
    );
    CREATE INDEX IX_jp_job ON service.job_parts (job_id);
END
GO

/* ===========================================================================
   8. CUSTOMER PAYMENT PROOF  (portal upload -> Accounts verify; NEVER auto-post)
   =========================================================================== */
IF OBJECT_ID(N'service.payment_proofs', N'U') IS NULL
BEGIN
    CREATE TABLE service.payment_proofs
    (
        id           UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_pp_id DEFAULT NEWSEQUENTIALID(),
        customer_id  UNIQUEIDENTIFIER NULL,
        invoice_id   UNIQUEIDENTIFIER NULL,
        submitted_by UNIQUEIDENTIFIER NULL,               -- portal user
        amount       DECIMAL(18,2)    NOT NULL CONSTRAINT DF_pp_amount DEFAULT (0),
        file_ref     NVARCHAR(512)    NULL,
        status       NVARCHAR(32)     NOT NULL CONSTRAINT DF_pp_status DEFAULT (N'PAYMENT_PROOF_SUBMITTED'),
        verified_by  UNIQUEIDENTIFIER NULL,
        created_at   DATETIME2(3)     NOT NULL CONSTRAINT DF_pp_ca DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_payment_proofs PRIMARY KEY NONCLUSTERED (id),
        CONSTRAINT CK_pp_status CHECK (status IN (N'PAYMENT_PROOF_SUBMITTED',N'VERIFIED',N'REJECTED')),
        CONSTRAINT FK_pp_customer FOREIGN KEY (customer_id) REFERENCES report.customers (id),
        CONSTRAINT FK_pp_invoice  FOREIGN KEY (invoice_id)  REFERENCES report.sales_invoices (id),
        CONSTRAINT FK_pp_user     FOREIGN KEY (submitted_by) REFERENCES identity.users (id)
    );
END
GO

/* ===========================================================================
   9. RBAC HELPERS  (server-side effective-permission resolution)
   =========================================================================== */
/* All effective permissions for a user = role grants MINUS user DENY PLUS user ALLOW */
CREATE OR ALTER VIEW identity.v_user_effective_permissions AS
    WITH role_grants AS (
        SELECT ur.user_id, p.code
        FROM identity.user_roles ur
        JOIN identity.role_permissions rp ON rp.role_id = ur.role_id
        JOIN identity.permissions p       ON p.id = rp.permission_id
    ),
    user_allow AS (
        SELECT up.user_id, p.code FROM identity.user_permissions up
        JOIN identity.permissions p ON p.id = up.permission_id WHERE up.effect = N'ALLOW'
    ),
    user_deny AS (
        SELECT up.user_id, p.code FROM identity.user_permissions up
        JOIN identity.permissions p ON p.id = up.permission_id WHERE up.effect = N'DENY'
    ),
    combined AS (
        SELECT user_id, code FROM role_grants
        UNION
        SELECT user_id, code FROM user_allow
    )
    SELECT c.user_id, c.code
    FROM combined c
    WHERE NOT EXISTS (SELECT 1 FROM user_deny d WHERE d.user_id = c.user_id AND d.code = c.code);
GO

/* Server-side gate: does @UserId hold @PermissionCode?  (RBAC enforcement point) */
CREATE OR ALTER FUNCTION identity.fn_user_has_permission
    (@UserId UNIQUEIDENTIFIER, @PermissionCode NVARCHAR(128))
RETURNS BIT AS
BEGIN
    RETURN (CASE WHEN EXISTS (
        SELECT 1 FROM identity.v_user_effective_permissions
        WHERE user_id = @UserId AND code = @PermissionCode
    ) THEN 1 ELSE 0 END);
END
GO

/* Customer isolation guard: the canonical customer this portal user may see.   */
CREATE OR ALTER FUNCTION identity.fn_user_customer_id (@UserId UNIQUEIDENTIFIER)
RETURNS UNIQUEIDENTIFIER AS
BEGIN
    RETURN (SELECT customer_id FROM identity.user_customer_links WHERE user_id = @UserId);
END
GO

PRINT N'COLORJET identity/RBAC/portal/service schema created (identity.*, service.*, assets.*).';
PRINT N'Roles seeded. Enforce access with identity.fn_user_has_permission and per-portal isolation guards.';
GO
