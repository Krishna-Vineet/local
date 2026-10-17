# HAPPYPIX MASTER ALL-ROUNDER DOCUMENTATION

> **DEVELOPER NOTE:** This single document contains the complete, end-to-end architecture, API catalog, data flow, and migration plan for the HappyPix Backend. Use this as your primary reference guide.



---

# 00 BACKEND OVERVIEW

<!-- This section gives a bird's-eye view of how all the apps connect to the central backend. -->

## Purpose
The HappyPix backend is a monolithic Node.js/Express application acting as the central hub for the entire ecosystem.

## Target Architecture
```text
                     happypixcrm2
                          │
                          │ HTTPS API
                          ▼
                 ┌─────────────────┐
                 │     SERVER      │
                 │  HappyPix API   │
                 └────────┬────────┘
                          │
            ┌─────────────┼──────────────┐
            │             │              │
            ▼             ▼              ▼
        Database         S3       External Services
            │
       ┌────┴─────┐
       ▼          ▼
 Android Booth  Electron
```

## Status vs Target
- **Android Booth:** Fully integrated with existing endpoints.
- **Electron:** Empty scaffold, not integrated.
- **happypixcrm2:** Connected to auth only. Expects non-existent `/api/org` and `/api/platform` routes.
- **admin (Old CRM):** Fully integrated.
- **client (Old Web):** Integrated for photo sharing.


---

# 01 BACKEND ARCHITECTURE

<!-- This explains the request lifecycle. Notice there are no separate Service files; logic is in the routes. -->

```text
Client (Booth / CRM)
  │
  ▼
HTTP Request (Express)
  │
  ▼
Middleware (cors, cookieParser, express.json)
  │
  ▼
Auth Middleware (authenticate, authorize, deviceAuth)
  │
  ▼
Route (server/routes/*)
  │
  ▼
Controller Logic (Inside Route)
  │
  ▼
Database (Mongoose Models) / AWS S3
  │
  ▼
Response
```


---

# 02 ENTRY POINT & MIDDLEWARE

<!-- Important for understanding how the server starts and what global middlewares (like CORS and JSON parsing) are applied. -->

- **Entry file:** `server/server.js`
- **Path:** `/`
- **Server startup:** `app.listen(PORT)`
- **Port:** `process.env.PORT || 5000`
- **Middleware registration:** 
  - `cors({ origin: true, credentials: true })`
  - `express.json()`
  - `cookieParser()`
  - `morgan('dev')`
- **Routes registration:** `app.use('/api/...', ...Routes)`
- **Database connection:** `mongoose.connect(process.env.MONGODB_URI)`
- **Error handling:** Custom `errorHandler` middleware at the end of `server.js`.


---

# 03 MASTER API CATALOG

<!-- A quick reference of the most critical endpoints used by the clients. -->

| Method | Endpoint | Route File | Auth | Permission | Used By | Status |
| ------ | -------- | ---------- | ---- | ---------- | ------- | ------ |
| POST | `/api/auth/login` | `authRoutes.js` | No | None | admin, CRM2 | Keep |
| POST | `/api/devices/ping` | `deviceRoutes.js` | `deviceAuth` | None | Android | Keep |
| GET | `/api/events` | `eventRoutes.js` | Yes | `CLIENT_ADMIN` | admin | Modify for CRM2 |
| POST | `/api/upload` | `server.js` | `deviceAuth` | None | Android | Keep |
| POST | `/api/share/generate`| `photoShareRoutes.js` | `deviceAuth`| None | Android | Keep |


---

# 04 AUTHENTICATION

<!-- Explains the two completely different auth systems: Cookies for Web, x-device-token for Hardware. -->

## User Authentication (CRM)
- **Login API:** `POST /api/auth/login`
- **Logout API:** `POST /api/auth/logout`
- **Token type:** JWT (JSON Web Token)
- **Storage:** `HttpOnly` Cookie named `token`.
- **Middleware:** `authenticate` (extracts from cookie, decodes, attaches `req.user`).

## Device Authentication (Booth)
- **Token type:** Custom hardware string (`hp_dev_...`).
- **Storage:** Sent in `x-device-token` header.
- **Middleware:** `deviceAuth` (looks up `Device` in DB, attaches `req.device` and `req.organizationId`).


---

# 05 AUTHORIZATION (RBAC)

<!-- Role-Based Access Control logic. Explains who can do what. -->

**Roles:** OWNER, ADMIN, MANAGER, CLIENT_ADMIN, CLIENT_MANAGER, BOOTH_OPERATOR.

**Permission checks:** Enforced via `authorize([...roles])` middleware on routes.

| Role | API Access | Purpose |
| ---- | ---------- | ------- |
| OWNER / ADMIN | `/api/superadmin/*`, `/api/organizations` | Platform management |
| CLIENT_ADMIN | `/api/events`, `/api/devices` | Tenant management |
| BOOTH_OPERATOR | Very restricted CRM access | Floor staff |


---

# 06 MULTI-TENANCY

<!-- CRITICAL SECURITY CONCEPT: Explains how tenant isolation is handled to prevent data leaks between clients. -->

**Tenant Identifier:** `organizationId` (ObjectId) attached to User, Device, Event, Photo.

**Enforcement:**
There is no database-level sharding. Multi-tenancy is enforced manually at the route level:
```javascript
const events = await Event.find({ organizationId: req.user.organizationId });
```

**Vulnerabilities:** If a developer forgets to include `organizationId: req.user.organizationId` in a tenant-specific query, cross-tenant data leakage occurs.


---

# 07 DATABASE ARCHITECTURE

<!-- Breakdown of the MongoDB collections and how they relate to each other. -->

- **Technology:** MongoDB (via Mongoose)
- **Connection:** `mongoose.connect(process.env.MONGODB_URI)` inside `server.js`.

| Model | Purpose | Primary ID | Org Relation | Related Models |
| ----- | ------- | ---------- | ------------ | -------------- |
| User | Accounts | `_id` | `organizationId` | Organization |
| Organization | Tenant | `_id` | `_id` | Users, Events, Devices |
| Event | Photo Session | `_id` | `organizationId` | Photos, Devices |
| Device | Hardware | `_id` | `organizationId` | Event |
| Photo | Image record | `_id` | `organizationId` | Event |


---

# 08 STORAGE / S3

<!-- How photos and templates are stored in AWS S3. -->

- **Technology:** AWS S3 via `@aws-sdk/client-s3`.
- **Implementation:** `multer.memoryStorage()` intercepts uploads, backend streams buffer to S3.
- **Key Format:** `happypix/<orgId>/<eventId>/<sessionId>/<filename>`.
- **Consumers:** Android Booth (`/api/upload`), admin (Logos/Templates).


---

# 09 DEVICE ARCHITECTURE

<!-- How physical booth hardware connects and stays synced with the CRM. -->

- **Model:** `Device`
- **Authentication:** `x-device-token` header.
- **Heartbeat:** Devices ping `/api/devices/ping` to update `lastSeenAt`.
- **Assignment:** CRMs assign devices to events via `Device.currentEventId`. The ping endpoint returns this ID, telling the Android Booth which event to load.
- **Electron:** Will use the exact same architecture as Android.


---

# 10 EVENT ARCHITECTURE

<!-- The core entity that configures pricing, branding, and layouts for a party. -->

- **Model:** `Event`
- **Relations:** Belongs to `Organization`. Owns `Photos`. Contains branding limits.
- **APIs:** `/api/events`
- **Consumers:** Android Booth (fetches config), admin (CRUD).


---

# 11 PHOTO ARCHITECTURE

<!-- The lifecycle of a photo from capture to S3 to Database. -->

**Lifecycle:**
1. Camera captures photo -> Android Booth.
2. Booth calls `POST /api/upload`.
3. Backend uploads to S3.
4. Backend creates `Photo` record with S3 URL and 24H TTL (`expires`).
5. S3 URL returned to Booth.


---

# 12 TEMPLATE ARCHITECTURE

<!-- How photo frames and overlays are managed. -->

- **Model:** `Template`
- **Global Templates:** Shared across the platform.
- **Org Templates:** Scoped to `organizationId`.
- **AI Generation:** Integrates with TogetherAI / OpenAI in `services/ai/...` (needs verification if fully active).


---

# 13 GALLERY & SHARING

<!-- How users download photos using QR codes generated by the booth. -->

- **Flow:** Booth requests `/api/share/generate` -> Backend creates `PhotoShare` with unique token -> Returns `shareUrl` -> Booth generates QR.
- **Legacy Client:** The `client` repository reads these tokens via `/api/share/:token` to display the download page to the guest.


---

# 14 SUBSCRIPTIONS & PAYMENTS

<!-- Monetization layer using Razorpay. -->

- **Provider:** Razorpay
- **Booth Payments:** `POST /api/payments/create-order` generates a Razorpay Order ID for paid prints.
- **Webhooks:** `/api/payments/webhook` captures Razorpay success state.


---

# 15 EXTERNAL SERVICES

<!-- Third party dependencies that need API keys in the .env file. -->

- **AWS S3:** Storage. Required.
- **MongoDB Atlas:** Database. Required.
- **Razorpay:** Payments (INR). Required.
- **SendGrid/Twilio:** Messaging. Implemented but usage varies.


---

# 16 ENVIRONMENT VARIABLES

<!-- Required secrets for the backend to run. -->

| Variable | Purpose | Used By | Required | Secret |
| -------- | ------- | ------- | -------- | ------ |
| MONGODB_URI | DB Connection | server | Yes | Yes |
| JWT_SECRET | Auth signing | server | Yes | Yes |
| AWS_ACCESS_KEY_ID | S3 Auth | server | Yes | Yes |
| RAZORPAY_KEY_ID | Payments | server | Yes | No |


---

# 17 ERROR HANDLING

<!-- Developer guidance on how to return errors from routes. -->

- **Middleware:** `server.js` contains a global error handler that catches `next(err)`.
- **Format:** Returns `{ success: false, error: err.message }`.
- **Issues:** Many routes use `try/catch` and do `res.status(500).json()` manually instead of passing to global handler.


---

# 18 SECURITY

<!-- Known security risks that need attention before going to production. -->

- **CORS:** Origin set to `true`, credentials `true`. Needs lockdown for production.
- **Tenant Isolation:** Enforced manually per route (High Risk).
- **Tokens:** HttpOnly cookies mitigate XSS for CRMs. Device tokens are vulnerable if extracted from hardware.


---

# 19 ANDROID INTEGRATION

<!-- The endpoints that MUST remain untouched so the physical booths do not break. -->

**Crucial APIs (DO NOT REMOVE OR MODIFY BEHAVIOR):**
- `POST /api/devices/ping`
- `GET /api/devices/current-event`
- `POST /api/upload`
- `POST /api/share/generate`
- `POST /api/payments/create-order`


---

# 20 ELECTRON INTEGRATION

<!-- State of the Windows application. -->

**Status:** Scaffold only.
**Required Backend APIs:** None currently. 
**Future:** Must consume the exact same APIs as Android (`ping`, `upload`, `share`).


---

# 21 NEW CRM INTEGRATION

<!-- The core integration strategy to make happypixcrm2 work with this backend. -->

**Requirement:** happypixcrm2 expects `/api/org/...` and `/api/platform/...`.
**Solution:** Do not modify existing routes. Create a new router layer (`v2`) in `server.js` that maps the expected CRM paths to the existing Mongoose controllers.
**Auth Fix:** CRM2 uses localStorage for tokens; backend sets HttpOnly cookies. Must be aligned.


---

# 22 ADMIN REMOVAL IMPACT

<!-- What happens when we delete the old CRM folder. -->

**Safe to Remove:** 
- The `admin/` frontend folder.
- Backend routes EXCLUSIVELY used by the old admin dashboard (if any are not ported to CRM2).
**Do Not Remove:** 
- Any core Mongoose models.
- Any `/api/events`, `/api/organizations` logic, as CRM2 will wrap these.


---

# 23 CLIENT REMOVAL IMPACT

<!-- What happens when we delete the old website folder. -->

**Safe to Remove:** 
- `client/` web booth logic.
**Do Not Remove:**
- The photo download/share UI (`/share/:token`). If `client/` is deleted, this UI MUST be rebuilt elsewhere, or guests cannot download photos via QR.


---

# 24 BACKEND CLEANUP PLAN

<!-- Step-by-step cleanup logic for technical debt. -->

- **KEEP:** All device, auth, event, and upload APIs.
- **MODIFY:** Auth login to support CRM2 token extraction if needed.
- **DEPRECATE:** Legacy V1 routes once CRM2 v2 routes are fully stable.
- **REMOVE:** `admin` and `client` frontend repositories once CRM2 and new Share pages are deployed.


---

# 25 INTEGRATION GAPS

<!-- Critical blockers preventing the new CRM from working immediately. -->

**CRITICAL:** Token mismatch (localStorage vs Cookie).
**CRITICAL:** Route mismatch (`/api/org/events` vs `/api/events`).
**HIGH:** Dashboard aggregations (CRM2 expects aggregated stats that backend currently doesn't provide in a single endpoint).


---

# 26 MIGRATION PLAN

<!-- The exact chronological order developers should follow to deploy the new system. -->

1. Build `v2/platform` and `v2/org` routers in Backend mapping to CRM2 expectations.
2. Resolve Token/Cookie Auth conflict.
3. Test CRM2 against Backend.
4. Verify Android Booth still functions using V1 APIs.
5. Port legacy `client/` share page to a new stable URL.
6. Delete `admin/` and `client/`.


---

# 27 TESTING REQUIREMENTS

<!-- QA checklist before production launch. -->

- **Tenant Isolation:** Ensure User A cannot fetch User B's events using v2 APIs.
- **Booth Uploads:** Ensure device tokens correctly map uploads to the assigned event.
- **Auth:** Test HttpOnly cookie expiry and refresh.
