"""Middleware, security layers and the permission matrix."""


def mw(name, file, kind, purpose, *, runs_on, behaviour, order=None, rejects=None):
    return {
        "name": name, "file": file, "kind": kind, "purpose": purpose,
        "runs_on": runs_on, "behaviour": behaviour, "order": order, "rejects": rejects or [],
    }


SERVER_CHAIN = [
    mw("Security headers", "server.js:108", "response",
       "Sets the browser hardening headers on every response.",
       runs_on="Every request",
       behaviour="X-Content-Type-Options: nosniff, X-Frame-Options: DENY, X-XSS-Protection: 0, "
                 "Referrer-Policy: strict-origin-when-cross-origin, plus HSTS (1 year, includeSubDomains) in production.",
       order=1),

    mw("globalLimiter", "server.js:118", "rate limit",
       "A generous baseline that stops a single IP from hammering the API, sized for polling booths.",
       runs_on="Every request",
       behaviour="express-rate-limit, 1200 requests / 15 minutes / IP, standard headers, JSON message.",
       order=2, rejects=[("429", "Too many requests from this IP. Please try again later.")]),

    mw("CORS allowlist", "server.js:129", "origin",
       "Only known front ends get CORS headers. Unknown origins are answered without CORS headers rather than with a 500.",
       runs_on="Every request with an Origin",
       behaviour="isOriginAllowed(): the configured CORS_ORIGINS list, *.vercel.app previews, and localhost in "
                 "non-production. credentials: true, so cookies work cross-site.",
       order=3),

    mw("Strict origin rejection", "server.js:141", "origin",
       "Turns a disallowed browser origin into an explicit 403 instead of a confusing CORS failure.",
       runs_on="Every request carrying an Origin header",
       behaviour="Rejects before body parsing, so no work is done for a hostile origin.",
       order=4, rejects=[("403 CORS_FORBIDDEN", "Cross-origin request blocked by security policy.")]),

    mw("Body parser + rawBody capture", "server.js:153", "parsing",
       "Parses JSON up to 50 MB and keeps the exact bytes for webhook HMAC verification.",
       runs_on="All JSON requests",
       behaviour="express.json({limit:'50mb', verify}) stores req.rawBody. The 50 MB ceiling exists because older "
                 "booths post base64 frames inline.",
       order=5, rejects=[("413", "Payload too large — the booth should use presigned S3 uploads instead.")]),

    mw("cookieParser", "server.js:159", "parsing",
       "Reads the HttpOnly hp_admin_token cookie so the CRM needs no JavaScript-visible token.",
       runs_on="All requests", behaviour="Attaches req.cookies.", order=6),

    mw("/uploads static", "server.js:162", "static",
       "Serves local files (fallback storage and AI cutouts) when S3 is not in use.",
       runs_on="Paths under /uploads",
       behaviour="express.static on <cwd>/uploads. No auth: the files it serves are non-sensitive by construction.",
       order=7),

    mw("Request logger", "server.js:165", "observability",
       "One line per request: ISO timestamp, method, URL.",
       runs_on="All requests", behaviour="console.log — Vercel captures it in the function log.", order=8),

    mw("Mongo readiness gate", "server.js:231", "infrastructure",
       "Serverless-safe database connection. Every request awaits a shared, cached connection promise.",
       runs_on="All /api routes",
       behaviour="Caches the connection across warm invocations; if the database is unreachable it answers 503 "
                 "instead of letting routes run against a buffered Mongoose instance.",
       order=9, rejects=[("503", "Database unavailable")]),

    mw("Router mounts", "server.js:243", "routing",
       "Mounts 12 routers plus the inline endpoints, in the order listed in the route inventory.",
       runs_on="All requests", behaviour="See the service bus diagram: auth → platform → org → events → coupons → "
                                          "settings → payments → support → devices → booth → share → downloads → root.",
       order=10),

    mw("leadsLimiter", "server.js:262", "rate limit",
       "Protects the public website form from spam bursts.",
       runs_on="POST /api/leads", behaviour="60 requests / 15 minutes / IP.", order=11,
       rejects=[("429", "Too many requests. Please try again in a few minutes.")]),

    mw("requireUserOrDevice", "server.js:474", "auth selector",
       "Lets one upload endpoint accept either a signed-in human or a paired booth.",
       runs_on="POST /api/upload",
       behaviour="If x-device-token, x-device-uuid or an 'Authorization: Device …' header is present it uses "
                 "authenticateDevice, otherwise authenticate (JWT).",
       order=12),

    mw("multer upload", "utils/s3.js:105", "parsing",
       "Buffered multipart parsing for the four upload endpoints.",
       runs_on="POST /api/upload, /api/upload/logo, /api/upload/profile-photo",
       behaviour="memoryStorage, 10 MB per file, MIME allowlist (image/jpeg, image/png, image/webp) and an extension "
                 "allowlist, so a renamed executable cannot pass.",
       order=13, rejects=[("400", "Invalid file type. Only JPEG, PNG, and WebP images are allowed.")]),

    mw("5xx masking error handler", "server.js:565", "error",
       "The final handler: logs the real error, returns a safe message and never leaks a stack trace.",
       runs_on="Any thrown or forwarded error",
       behaviour="Honours HttpError status/code, masks everything else as 500 with a generic body.",
       order=14),

    mw("VERCEL listen guard", "server.js:575", "runtime",
       "Skips app.listen() when running as a serverless function.",
       runs_on="Process start",
       behaviour="VERCEL !== '1' → listen on PORT; otherwise export the Express app for @vercel/node.", order=15),
]

AUTH_MIDDLEWARE = [
    mw("authenticate", "middleware/auth.js:63", "authentication",
       "Resolves the caller from cookie → bearer → ?token, verifies the HS256 JWT, and loads a live user + organisation.",
       runs_on="Every CRM route",
       behaviour="Checks the ver claim against User.sessionVersion (server-side revocation), rejects inactive users, "
                 "normalises the role, attaches req.user, req.permissions, req.organization, req.organizationId, "
                 "req.orgStatus and req.orgReadOnly. A banned organisation bumps every session version on the way out.",
       rejects=[("401 UNAUTHENTICATED", "no token"), ("401 TOKEN_EXPIRED", "past 12 h"),
                ("401 BAD_TOKEN", "signature or algorithm wrong"), ("401 USER_NOT_FOUND", "user deleted"),
                ("401 SESSION_REVOKED", "ver mismatch"), ("403 ACCOUNT_DEACTIVATED", "user inactive"),
                ("403 ORG_MISSING", "organisation deleted"), ("403 ORG_BANNED", "organisation banned")]),

    mw("authorize(...roles)", "middleware/auth.js:143", "authorization",
       "Coarse role gate. Roles are normalised on both sides, so a legacy value such as CLIENT_ADMIN still matches ORG_ADMIN.",
       runs_on="Router mounts and any route needing a role", behaviour="403 FORBIDDEN with the caller's role echoed.",
       rejects=[("403 FORBIDDEN", "role not in the list")]),

    mw("requirePerm(perm)", "middleware/auth.js:158", "authorization",
       "Fine-grained permission gate driven by config/permissions.js — the same matrix the CRM and the mock API use.",
       runs_on="Individual org and platform routes",
       behaviour="403 FORBIDDEN_PERMISSION with the permission name, so the CRM can explain exactly what is missing.",
       rejects=[("403 FORBIDDEN_PERMISSION", "role lacks the key")]),

    mw("requireAnyPerm(...perms)", "middleware/auth.js:171", "authorization",
       "OR-gate across permission keys, for screens that serve two audiences.", runs_on="Selected routes",
       behaviour="Passes when any key is held.", rejects=[("403 FORBIDDEN_PERMISSION", "none of the keys held")]),

    mw("requireWritableOrg", "middleware/auth.js:187", "policy",
       "Freezes writes for suspended tenants while leaving reads available.",
       runs_on="Every mutating org route",
       behaviour="Suspended → 403 ORG_SUSPENDED with readOnly:true; banned → 403 ORG_BANNED.",
       rejects=[("403 ORG_SUSPENDED", "read-only until restored"), ("403 ORG_BANNED", "banned")]),

    mw("issueToken / bumpSessionVersion", "middleware/auth.js:34/53", "session",
       "Signs the 12-hour JWT and revokes sessions by incrementing counters.",
       runs_on="Sign-in, password change, logout, ban, org suspension",
       behaviour="issueToken embeds id, role, organizationId and ver. bumpSessionVersion increments it for every user "
                 "of an organisation and for the organisation itself in one call."),

    mw("getOrgFilter(user)", "middleware/auth.js:220", "tenancy",
       "Builds the Mongo filter for a query that must never cross tenants. Fails closed.",
       runs_on="Ad-hoc queries in services and AI routes",
       behaviour="Org roles are pinned to their organizationId; internal roles get {organizationId: null} rather than "
                 "{} — an empty filter would have leaked every tenant's rows."),

    mw("orgScopeFilter(user, orgId)", "middleware/auth.js:229", "tenancy",
       "Same idea for platform routes that take an :orgId parameter.",
       runs_on="Platform routes with a tenant parameter", behaviour="Org roles are always pinned to their own id."),

    mw("authenticateDevice (strict)", "middleware/deviceAuth.js:104", "booth auth",
       "Validates the booth token (hashed), the installation uuid and the tenant's state. Used for anything that "
       "changes state or money.",
       runs_on="/api/booth/* mutations, /api/devices/*",
       behaviour="Accepts x-device-token or 'Authorization: Device …' plus x-device-uuid. Self-heals a legacy plaintext "
                 "token into a hash on first sight. Suspended tenants are rejected here.",
       rejects=[("401 UNPAIRED", "no token or uuid, or mismatch"), ("403 DEVICE_BLOCKED", "blocked or inactive"),
                ("403 BANNED", "tenant banned"), ("403 SUSPENDED", "tenant suspended"),
                ("410 DEVICE_DELETED", "device row removed")]),

    mw("softDeviceAuth", "middleware/deviceAuth.js:127", "booth auth",
       "Never rejects: it records the reason in req.deviceAuth so the kiosk can render the right screen.",
       runs_on="GET /api/booth/bootstrap, POST /api/booth/heartbeat",
       behaviour="Blocked booths still receive a 200 with state, message and invalidateCache:true."),

    mw("optionalDeviceAuth", "middleware/deviceAuth.js:145", "booth auth",
       "Scopes a public response to a tenant when a valid booth is calling, and does nothing otherwise.",
       runs_on="Public template / settings / event lookups",
       behaviour="Silently ignores any failure — the endpoint stays public either way."),
]

PERMISSION_MATRIX = {
    "roles": [
        ("OWNER", "Platform owner. The only role that can manage platform users, plans, leads and layout blueprints."),
        ("PLATFORM_ADMIN", "HappyPix staff. Every tenant, templates, gallery policy, platform audit."),
        ("SUPPORT_MANAGER", "Support staff. Dashboard, tenants and support tickets — read-mostly, no pricing or users."),
        ("ORG_ADMIN", "Tenant owner. Revenue, wallet, team, coupons, defaults, audit, gallery for their organisation."),
        ("ORG_MANAGER", "Tenant operator. Events, booths, gallery, guest tickets, escalations. No revenue, wallet, team, coupons or audit."),
    ],
    "keys": [
        ("platform.dashboard.view", "Company-wide dashboard", "OWNER · PLATFORM_ADMIN · SUPPORT_MANAGER"),
        ("platform.revenue.view", "Platform revenue workspace", "OWNER"),
        ("platform.organizations.view", "Tenant list and detail", "OWNER · PLATFORM_ADMIN · SUPPORT_MANAGER"),
        ("platform.organizations.suspend", "Suspend, ban and restore a tenant", "OWNER · PLATFORM_ADMIN"),
        ("platform.audit.view", "Platform audit trail", "OWNER · PLATFORM_ADMIN"),
        ("platform.team.view", "List platform users", "OWNER · PLATFORM_ADMIN · SUPPORT_MANAGER"),
        ("platform.users.manage", "Create and change platform users", "OWNER"),
        ("platform.subscription-plans.manage", "Plan catalogue (read and write)", "OWNER"),
        ("platform.templates.manage", "Global template library and platform AI generation", "OWNER · PLATFORM_ADMIN"),
        ("platform.template-layouts.manage", "Layout blueprints", "OWNER"),
        ("platform.leads.manage", "Marketing leads", "OWNER"),
        ("platform.organization-support.view", "Escalation queue and replies", "OWNER · PLATFORM_ADMIN · SUPPORT_MANAGER"),
        ("platform.gallery.settings", "The global gallery policy", "OWNER · PLATFORM_ADMIN"),
        ("organization.dashboard.view", "Organisation dashboard", "ORG_ADMIN · ORG_MANAGER"),
        ("organization.revenue.view", "Revenue, wallet and withdrawals", "ORG_ADMIN"),
        ("organization.audit.view", "Organisation audit trail", "ORG_ADMIN"),
        ("organization.team.view", "List team members", "ORG_ADMIN · ORG_MANAGER"),
        ("organization.team.manage", "Create, activate and deactivate members", "ORG_ADMIN"),
        ("organization.events.devices.manage", "Event list, booth fleet, coupon validation", "ORG_ADMIN · ORG_MANAGER"),
        ("organization.events.create", "Create an event", "ORG_ADMIN · ORG_MANAGER"),
        ("organization.events.edit", "Edit, pause, resume, delete an event", "ORG_ADMIN · ORG_MANAGER"),
        ("organization.events.templates.use", "Use the global template library", "ORG_ADMIN · ORG_MANAGER"),
        ("organization.coupons.manage", "Coupons (read and write)", "ORG_ADMIN"),
        ("organization.defaults.view", "Read pricing, payee and gateway defaults", "ORG_ADMIN · ORG_MANAGER"),
        ("organization.defaults.edit", "Change defaults, including gateway keys", "ORG_ADMIN"),
        ("organization.tickets.view.resolve", "Inbound guest tickets", "ORG_ADMIN · ORG_MANAGER"),
        ("organization.platform-support.use", "Raise and reply to escalations", "ORG_ADMIN · ORG_MANAGER"),
        ("organization.gallery.view", "Browse and stream gallery photos", "ORG_ADMIN · ORG_MANAGER"),
        ("profile.edit", "Edit own name, phone and avatar", "All five roles"),
    ],
    "notes": [
        "The matrix is a plain object in config/permissions.js and is imported by the API, the CRM front end and the "
        "mock API; backend/tests/permissions.parity.test.js fails the build if the two copies ever drift.",
        "ROLE_ALIASES maps legacy values (CLIENT_ADMIN, ORGANIZATION_MANAGER, SUPER_ADMIN, org-admin, staff…) onto the "
        "five real roles; normalisation happens at sign-in and again inside authenticate().",
        "Eight org endpoints — /template-layouts and the five AI routes — declare no key of their own and rely on the "
        "router-level org-role gate alone. That is a deliberate gap, documented in §10.",
        "Only OWNER can change platform users, plans, leads and layout blueprints, even though PLATFORM_ADMIN can see "
        "the same screens.",
    ],
}

LIMITERS = [
    ("Global", "1200 / 15 min / IP", "server.js", "Baseline for every request, sized for polling booths."),
    ("Sign-in", "15 / 15 min / IP", "routes/crm/auth.js", "Password brute force."),
    ("OTP request", "5 / 15 min / IP", "routes/crm/auth.js", "Reset-code spam and email cost."),
    ("OTP verify", "10 / 15 min / IP", "routes/crm/auth.js", "Code guessing."),
    ("AI generate", "20 / 15 min / IP", "routes/crm/org.js", "GPU and provider credit exhaustion."),
    ("Coupon validate", "30 / 15 min / IP", "routes/couponRoutes.js", "Code enumeration."),
    ("Device register", "15 / 15 min / IP", "routes/deviceRoutes.js", "Booth registration spam."),
    ("Guest downloads", "300 / 15 min / IP", "routes/downloadRoutes.js", "Bulk scraping of a download link."),
    ("Public events", "30 / 15 min / IP", "routes/eventRoutes.js", "Passkey guessing on /public/join."),
    ("Share", "100 / 15 min / IP", "routes/photoShareRoutes.js", "Share-token creation."),
    ("Share delivery", "15 / hour / IP", "routes/photoShareRoutes.js", "SMS and WhatsApp cost abuse."),
    ("Public settings", "120 / 15 min / IP", "routes/settingRoutes.js", "Snapshot polling by unpaired clients."),
    ("Public support", "20 / 15 min / IP", "routes/supportRoutes.js", "Ticket flooding."),
    ("Leads", "60 / 15 min / IP", "server.js", "Form spam."),
]
